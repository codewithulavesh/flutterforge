import { createWriteStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import extractZip from 'extract-zip';
import { getProjectDataRoot } from '../paths.mjs';
import { findFlutter, managedFlutterPath } from './flutter.mjs';

const RELEASE_INDEX = 'https://storage.googleapis.com/flutter_infra_release/releases/releases_';
const RELEASE_BASE = 'https://storage.googleapis.com/flutter_infra_release/releases/';
const MAX_ARCHIVE_BYTES = 3 * 1024 * 1024 * 1024;
let installTask = null;

function targetPlatform() {
  const platform = process.platform === 'darwin' ? 'macos'
    : process.platform === 'win32' ? 'windows'
      : process.platform === 'linux' ? 'linux' : null;
  const arch = process.arch === 'arm64' ? 'arm64' : process.arch === 'x64' ? 'x64' : null;
  if (!platform || !arch || (platform === 'windows' && arch !== 'x64')) {
    throw new Error(`FlutterForge cannot install Flutter automatically on ${process.platform}/${process.arch}. Install Flutter manually and set FLUTTER_BIN.`);
  }
  return { platform, arch };
}

function run(command, args, { signal, timeoutMs = 120_000 } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        shell: process.platform === 'win32',
        signal,
      });
    } catch (error) {
      reject(error);
      return;
    }
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    child.stdout.on('data', (chunk) => { stdout = `${stdout}${chunk}`.slice(-8000); });
    child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-8000); });
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error((stderr || stdout || `Process exited with code ${code}`).trim()));
    });
  });
}

async function existingFlutter(binary) {
  try {
    await run(binary, ['--version', '--machine'], { timeoutMs: 30_000 });
    return true;
  } catch {
    return false;
  }
}

async function releaseFor(platform, arch, signal) {
  let response;
  try {
    response = await fetch(`${RELEASE_INDEX}${platform}.json`, { signal, headers: { Accept: 'application/json' } });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Could not reach the official Flutter release service. Check the internet connection, then retry Preview.');
  }
  if (!response.ok) throw new Error(`Flutter release service returned HTTP ${response.status}.`);
  const index = await response.json();
  const currentHash = index.current_release?.stable;
  const release = index.releases?.find((entry) => entry.hash === currentHash && entry.channel === 'stable' && entry.dart_sdk_arch === arch);
  if (!release || typeof release.archive !== 'string' || !/^[a-f0-9]{64}$/i.test(release.sha256 || '')) {
    throw new Error(`No verified stable Flutter release is available for ${platform}/${arch}.`);
  }
  const relative = release.archive;
  if (relative.startsWith('/') || relative.split('/').includes('..') || !relative.startsWith(`stable/${platform}/`)) {
    throw new Error('Flutter release metadata contained an invalid archive path.');
  }
  return { ...release, url: new URL(relative, RELEASE_BASE).toString() };
}

async function downloadArchive(url, target, expectedHash, onProgress, signal) {
  let response;
  try {
    response = await fetch(url, { signal, redirect: 'follow' });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Could not download Flutter. Check the internet connection or proxy settings, then retry Preview.');
  }
  if (!response.ok || !response.body) throw new Error(`Flutter SDK download failed (HTTP ${response.status}).`);
  const finalUrl = new URL(response.url);
  if (finalUrl.protocol !== 'https:' || finalUrl.hostname !== 'storage.googleapis.com') {
    throw new Error('Flutter SDK download redirected to an untrusted host.');
  }
  const length = Number(response.headers.get('content-length') || 0);
  if (length > MAX_ARCHIVE_BYTES) throw new Error('Flutter SDK archive exceeded the 3 GiB safety limit.');

  const hash = createHash('sha256');
  let received = 0;
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length;
      if (received > MAX_ARCHIVE_BYTES) return callback(new Error('Flutter SDK archive exceeded the 3 GiB safety limit.'));
      hash.update(chunk);
      if (length > 0 && received % (32 * 1024 * 1024) < chunk.length) {
        onProgress?.(`Downloading Flutter SDK: ${Math.floor((received / length) * 100)}% (${Math.round(received / 1024 / 1024)} MiB).`);
      }
      callback(null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(response.body), meter, createWriteStream(target), { signal });
  const actualHash = hash.digest('hex');
  if (actualHash.toLowerCase() !== expectedHash.toLowerCase()) {
    throw new Error('Flutter SDK checksum verification failed. The incomplete download was discarded.');
  }
  onProgress?.('Flutter SDK archive verified.');
}

async function installManagedFlutter({ onProgress, signal } = {}) {
  if (!process.env.PUB_CACHE) process.env.PUB_CACHE = path.join(getProjectDataRoot(), 'toolchains', 'pub-cache');
  process.env.FLUTTER_SUPPRESS_ANALYTICS ||= 'true';
  const { platform, arch } = targetPlatform();
  const resolved = findFlutter();
  if (await existingFlutter(resolved)) return resolved;
  if (process.env.FLUTTER_BIN) {
    throw new Error(`The configured FLUTTER_BIN could not run (${resolved}). Fix FLUTTER_BIN or remove it to let FlutterForge install its managed SDK.`);
  }

  const toolchainRoot = path.dirname(path.dirname(path.dirname(managedFlutterPath({ platform, arch }))));
  const sdkRoot = path.join(toolchainRoot, 'flutter');
  const managedBinary = path.join(sdkRoot, 'bin', process.platform === 'win32' ? 'flutter.bat' : 'flutter');
  if (await fs.access(managedBinary).then(() => true).catch(() => false) && await existingFlutter(managedBinary)) return managedBinary;
  await fs.rm(sdkRoot, { recursive: true, force: true });

  onProgress?.('No Flutter SDK found. Preparing FlutterForge’s managed stable SDK…');
  const release = await releaseFor(platform, arch, signal);
  await fs.mkdir(toolchainRoot, { recursive: true });
  const stage = path.join(toolchainRoot, `.flutter-install-${process.pid}-${Date.now()}`);
  await fs.mkdir(stage, { recursive: true });
  const archivePath = path.join(stage, path.basename(release.archive));
  try {
    onProgress?.(`Installing Flutter ${release.version} (${platform}/${arch}). The first setup needs an internet connection and free disk space.`);
    await downloadArchive(release.url, archivePath, release.sha256, onProgress, signal);
    if (platform === 'linux') {
      onProgress?.('Extracting Flutter SDK…');
      await run('tar', ['-xJf', archivePath, '-C', stage], { signal, timeoutMs: 10 * 60_000 });
    } else {
      onProgress?.('Extracting Flutter SDK…');
      await extractZip(archivePath, { dir: stage });
    }
    const extracted = path.join(stage, 'flutter');
    const binaryName = process.platform === 'win32' ? 'flutter.bat' : 'flutter';
    if (!await fs.access(path.join(extracted, 'bin', binaryName)).then(() => true).catch(() => false)) {
      throw new Error('The verified Flutter archive did not contain the expected SDK executable.');
    }
    await fs.rm(sdkRoot, { recursive: true, force: true });
    await fs.rename(extracted, sdkRoot);
    await fs.writeFile(path.join(sdkRoot, '.flutterforge-managed-version'), `${release.version}\n${release.hash}\n`, 'utf8');
    onProgress?.(`Flutter ${release.version} is ready. Initial Flutter setup may download platform artifacts.`);
    return path.join(sdkRoot, 'bin', binaryName);
  } catch (error) {
    await fs.rm(sdkRoot, { recursive: true, force: true }).catch(() => {});
    if (signal?.aborted) throw new Error('Flutter SDK setup was cancelled. Start Preview again to retry.');
    throw error;
  } finally {
    await fs.rm(stage, { recursive: true, force: true }).catch(() => {});
  }
}

/** Reuse a compatible system SDK, otherwise install the official stable SDK in app data. */
export function ensureFlutter(options = {}) {
  if (!installTask) {
    installTask = installManagedFlutter(options).finally(() => { installTask = null; });
  }
  return installTask;
}
