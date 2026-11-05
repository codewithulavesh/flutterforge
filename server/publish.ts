import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { getProjectDataRoot } from './paths.js';
import { materializeFiles, safeRelativePath } from './harness/workspace.js';
import { ensureFlutter } from './harness/managedFlutter.js';
import { analyzeProject, formatDiagnostic } from './harness/analyze.js';
import { sanitizeSdkConstraint, sanitizeFlutterConstraint, fixInvalidPlainScalars, getToolchainVersions } from './harness/pubspecFix.js';

export const PUBLISH_TARGETS = new Set(['web', 'pwa', 'android', 'macos', 'windows']);

const MAX_LOG_LINES = 300;
const BUILD_TIMEOUT_MS = Number(process.env.FLUTTERFORGE_PUBLISH_TIMEOUT_MS || 20 * 60 * 1000);
const PUB_GET_TIMEOUT_MS = 4 * 60 * 1000;

const TARGET_LABEL: Record<string, string> = {
  web: 'Web',
  pwa: 'Progressive Web App',
  android: 'Android APK',
  macos: 'macOS app',
  windows: 'Windows app',
};

function projectKey(projectId: string): string {
  const raw = String(projectId ?? '').trim();
  const readable = raw.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
  if (readable.length >= 3 && readable === raw) return readable;
  return `${readable || 'publish'}-${createHash('sha256').update(raw || 'default').digest('hex').slice(0, 10)}`;
}

function tail(text: string, max = 4000): string {
  return text.length > max ? text.slice(-max) : text;
}

function runStreaming(command: string, args: string[], options: { cwd: string; env?: NodeJS.ProcessEnv; timeoutMs?: number; onLine: (line: string) => void }): Promise<{ ok: boolean; code?: number | null; error?: string; output: string }> {
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env ?? process.env,
        shell: process.platform === 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      resolve({ ok: false, error: error instanceof Error ? error.message : String(error), output: '' });
      return;
    }
    let output = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // gone
      }
      options.onLine(`[publish] timed out after ${Math.round((options.timeoutMs ?? BUILD_TIMEOUT_MS) / 1000)}s`);
      resolve({ ok: false, error: 'timeout', output });
    }, options.timeoutMs ?? BUILD_TIMEOUT_MS);

    const handle = (chunk: Buffer | string) => {
      const text = chunk.toString();
      output = tail(`${output}${text}`, 16_384);
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) options.onLine(line.trim());
      }
    };
    child.stdout?.on('data', handle);
    child.stderr?.on('data', handle);
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, error: error.message, output });
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: code === 0, code, output });
    });
  });
}

async function directorySize(target: string, budget = 20_000): Promise<{ bytes: number; entries: number }> {
  let total = 0;
  let entries = 0;
  const walk = async (current: string) => {
    if (entries >= budget) return;
    let stat;
    try {
      stat = await fs.lstat(current);
    } catch {
      return;
    }
    entries += 1;
    if (stat.isDirectory()) {
      const children = await fs.readdir(current).catch(() => []);
      for (const child of children) await walk(path.join(current, child));
    } else if (stat.isFile()) {
      total += stat.size;
    }
  };
  await walk(target);
  return { bytes: total, entries };
}

export function createPublishService(options: { rootDir?: string } = {}) {
  const rootDir = options.rootDir
    || process.env.FLUTTERFORGE_PUBLISH
    || path.join(getProjectDataRoot(), 'publish');

  const jobs = new Map<string, any>();
  const busy = new Set<string>();

  const outputDir = (projectId: string) => path.join(rootDir, projectKey(projectId));
  const sourceDir = (projectId: string) => path.join(outputDir(projectId), 'project');

  async function writePubspecFixes(directory: string, log: (line: string) => void) {
    const pubspecPath = path.join(directory, 'pubspec.yaml');
    let content = await fs.readFile(pubspecPath, 'utf8').catch(() => '');
    if (!content.trim()) return;
    const scalarFix = fixInvalidPlainScalars(content);
    if (scalarFix.changed) content = scalarFix.content;
    const toolchain = await getToolchainVersions();
    const sdkFix = sanitizeSdkConstraint(content, { dartVersion: toolchain.dartVersion });
    if (sdkFix.changed) content = sdkFix.content;
    const flutterFix = sanitizeFlutterConstraint(content, { flutterVersion: toolchain.flutterVersion });
    if (flutterFix.changed) content = flutterFix.content;
    for (const note of [scalarFix.note, sdkFix.note, flutterFix.note]) if (note) log(`[publish] ${note}`);
    if (scalarFix.changed || sdkFix.changed || flutterFix.changed) {
      await fs.writeFile(pubspecPath, content, 'utf8');
    }
  }

  async function scaffoldPlatform(flutterBin: string, directory: string, platform: string, log: (line: string) => void) {
    const exists = await fs.access(path.join(directory, platform)).then(() => true).catch(() => false);
    if (exists) return;
    log(`[publish] Scaffolding the ${platform} runner…`);
    const scratchRoot = path.join(getProjectDataRoot(), 'tmp');
    await fs.mkdir(scratchRoot, { recursive: true });
    const scaffold = path.join(scratchRoot, `flutterforge-publish-${projectKey(path.basename(directory))}-${platform}-${Date.now().toString(36)}`);
    const pubspec = await fs.readFile(path.join(directory, 'pubspec.yaml'), 'utf8').catch(() => '');
    const packageName = pubspec.match(/^name\s*:\s*([A-Za-z0-9_]+)/m)?.[1] || 'flutterforge_app';
    try {
      const created = await runStreaming(
        flutterBin,
        ['create', `--platforms=${platform}`, '--no-pub', '--org', 'com.flutterforge', '--project-name', packageName, scaffold],
        { cwd: path.dirname(scaffold), onLine: log, timeoutMs: 180_000 },
      );
      if (!created.ok) throw new Error(`flutter create failed${created.error ? `: ${created.error}` : ''}`);
      await fs.cp(path.join(scaffold, platform), path.join(directory, platform), { recursive: true });
    } finally {
      await fs.rm(scaffold, { recursive: true, force: true }).catch(() => {});
    }
  }

  async function startPublish(projectId: string, files: Array<{ path: string; content?: string | null; is_directory?: boolean }>, meta: { target?: string; supabaseUrl?: string; supabaseAnonKey?: string } = {}) {
    const target = String(meta.target || 'web').toLowerCase();
    if (!PUBLISH_TARGETS.has(target)) {
      return { statusCode: 400, body: { error: `Unsupported publish target: ${target}` } };
    }
    if (!Array.isArray(files) || files.length === 0) {
      return { statusCode: 400, body: { error: 'files[] required' } };
    }
    const key = projectKey(projectId);
    if (busy.has(key)) {
      return { statusCode: 409, body: { error: 'A publish build for this project is already running.' } };
    }
    for (const file of files) {
      if (!file || typeof file.path !== 'string') continue;
      try {
        safeRelativePath(file.path);
      } catch (error: any) {
        return { statusCode: 400, body: { error: error.message } };
      }
    }

    busy.add(key);
    const job: any = {
      projectId,
      key,
      target,
      status: 'building',
      startedAt: Date.now(),
      durationMs: null,
      logs: [`[publish] Preparing the ${TARGET_LABEL[target]} build…`],
      report: null,
      error: null,
    };
    jobs.set(key, job);

    void (async () => {
      const log = (line: string) => {
        job.logs.push(line);
        if (job.logs.length > MAX_LOG_LINES) job.logs.shift();
      };
      const directory = sourceDir(projectId);
      try {
        const flutterBin = await ensureFlutter({ onProgress: log });
        await fs.mkdir(directory, { recursive: true });
        for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
          if (['.dart_tool', 'build', 'pubspec.lock', '.flutterforge-pubspec-hash'].includes(entry.name)) continue;
          await fs.rm(path.join(directory, entry.name), { recursive: true, force: true });
        }
        log(`[publish] Writing ${files.length} project files…`);
        await materializeFiles(directory, files);

        if (meta.supabaseUrl || meta.supabaseAnonKey) {
          const constants = path.join(directory, 'lib', 'core', 'constants', 'app_constants.dart');
          try {
            let content = await fs.readFile(constants, 'utf8');
            if (meta.supabaseUrl) content = content.replace(/supabaseUrl\s*=\s*['"][^'"]*['"]/, `supabaseUrl = '${meta.supabaseUrl}'`);
            if (meta.supabaseAnonKey) content = content.replace(/supabaseAnonKey\s*=\s*['"][^'"]*['"]/, `supabaseAnonKey = '${meta.supabaseAnonKey}'`);
            await fs.writeFile(constants, content, 'utf8');
          } catch {
            // No constants
          }
        }

        await writePubspecFixes(directory, log);

        const platform = target === 'pwa' ? 'web' : target;
        if (platform === 'windows' && process.platform !== 'win32') {
          throw new Error('Windows builds must run on a Windows machine. Publish Web/PWA here, or build on Windows.');
        }
        if (platform === 'macos' && process.platform !== 'darwin') {
          throw new Error('macOS builds must run on a Mac. Publish Web/PWA here, or build on macOS.');
        }
        await scaffoldPlatform(flutterBin, directory, platform, log);

        log('[publish] Running flutter pub get…');
        const pub = await runStreaming(flutterBin, ['pub', 'get'], { cwd: directory, timeoutMs: PUB_GET_TIMEOUT_MS, onLine: log });
        if (!pub.ok) throw new Error(`flutter pub get failed${pub.error ? `: ${pub.error}` : ''}`);

        log('[publish] Running the compile gate (dart analyze)…');
        const analysis = await analyzeProject(directory, { flutterBin });
        for (const diagnostic of analysis.diagnostics.slice(0, 30)) log(`[publish] ${formatDiagnostic(diagnostic)}`);
        if (!analysis.skipped && !analysis.ok) {
          const first = analysis.diagnostics.find((item) => item.severity === 'error');
          throw new Error(`${analysis.summary}${first ? ` First error: ${formatDiagnostic(first)}` : ''}`);
        }

        let artifactPath: string | null = null;
        let publicPath: string | null = null;
        let artifactKind = 'directory';
        const notes: string[] = [];

        if (target === 'web' || target === 'pwa') {
          publicPath = `/publish/${key}/`;
          log('[publish] Building Flutter web (release)…');
          const built = await runStreaming(
            flutterBin,
            ['build', 'web', '--release', '--base-href', publicPath],
            { cwd: directory, timeoutMs: BUILD_TIMEOUT_MS, onLine: log },
          );
          if (!built.ok) throw new Error(`flutter build web failed${built.error ? `: ${built.error}` : ''}`);
          artifactPath = path.join(directory, 'build', 'web');
          await fs.access(path.join(artifactPath, 'index.html'));
          if (target === 'pwa') {
            const manifest = await fs.access(path.join(artifactPath, 'manifest.json')).then(() => true).catch(() => false);
            const worker = await fs.access(path.join(artifactPath, 'flutter_service_worker.js')).then(() => true).catch(() => false);
            if (!manifest) notes.push('No manifest.json was emitted — add PWA metadata before installing.');
            if (!worker) notes.push('No service worker was emitted — offline install may be limited.');
            if (manifest && worker) notes.push('PWA manifest and service worker are present.');
          }
        } else if (target === 'android') {
          log('[publish] Building the Android APK (release)…');
          const built = await runStreaming(
            flutterBin,
            ['build', 'apk', '--release'],
            { cwd: directory, timeoutMs: BUILD_TIMEOUT_MS, onLine: log },
          );
          if (!built.ok) throw new Error(`flutter build apk failed${built.error ? `: ${built.error}` : ''}`);
          artifactPath = path.join(directory, 'build', 'app', 'outputs', 'flutter-apk', 'app-release.apk');
          await fs.access(artifactPath);
          artifactKind = 'file';
          notes.push('Install with `adb install -r app-release.apk` or sideload the file.');
        } else {
          log(`[publish] Building the ${TARGET_LABEL[target]} app (release)…`);
          const built = await runStreaming(
            flutterBin,
            ['build', platform, '--release'],
            { cwd: directory, timeoutMs: BUILD_TIMEOUT_MS, onLine: log },
          );
          if (!built.ok) throw new Error(`flutter build ${platform} failed${built.error ? `: ${built.error}` : ''}`);
          artifactPath = platform === 'macos'
            ? path.join(directory, 'build', 'macos', 'Build', 'Products', 'Release')
            : path.join(directory, 'build', 'windows', 'x64', 'runner', 'Release');
          await fs.access(artifactPath);
          artifactKind = 'directory';
        }

        const size = await directorySize(artifactPath);
        const report = {
          target,
          label: TARGET_LABEL[target],
          status: 'succeeded',
          startedAt: new Date(job.startedAt).toISOString(),
          durationMs: Date.now() - job.startedAt,
          fileCount: files.filter((file) => !file.is_directory).length,
          analyzer: {
            skipped: Boolean(analysis.skipped),
            summary: analysis.summary,
            errors: analysis.errorCount ?? 0,
            warnings: analysis.warningCount ?? 0,
          },
          artifact: {
            kind: artifactKind,
            name: path.basename(artifactPath),
            bytes: size.bytes,
            entries: size.entries,
          },
          publicPath,
          notes,
        };
        await fs.writeFile(path.join(outputDir(projectId), 'build-report.json'), JSON.stringify(report, null, 2), 'utf8');
        job.status = 'succeeded';
        job.durationMs = report.durationMs;
        job.report = report;
        log(`[publish] ${TARGET_LABEL[target]} build ready${publicPath ? ` at ${publicPath}` : ''}.`);
      } catch (error) {
        job.status = 'failed';
        job.durationMs = Date.now() - job.startedAt;
        job.error = error instanceof Error ? error.message : String(error);
        job.report = {
          target,
          label: TARGET_LABEL[target],
          status: 'failed',
          startedAt: new Date(job.startedAt).toISOString(),
          durationMs: job.durationMs,
          fileCount: files.filter((file) => !file.is_directory).length,
          error: job.error,
          notes: [],
        };
        log(`[publish] Failed: ${job.error}`);
      } finally {
        busy.delete(key);
      }
    })();

    return { statusCode: 202, body: { ok: true, status: 'building', target } };
  }

  function statusForProject(projectId: string) {
    const job = jobs.get(projectKey(projectId));
    if (!job) return null;
    const directory = outputDir(projectId);
    return {
      ok: true,
      status: job.status,
      target: job.target,
      label: TARGET_LABEL[job.target] || job.target,
      startedAt: job.startedAt,
      durationMs: job.durationMs,
      error: job.error,
      report: job.report,
      reportPath: path.join(directory, 'build-report.json'),
      logs: job.logs.slice(-80),
    };
  }

  function reportForProject(projectId: string): string {
    return path.join(outputDir(projectId), 'build-report.json');
  }

  function artifactForProject(projectId: string): string | null {
    const job = jobs.get(projectKey(projectId));
    if (!job?.report?.artifact || job.report.artifact.kind !== 'file') return null;
    const directory = sourceDir(projectId);
    const target = job.target;
    if (target === 'android') return path.join(directory, 'build', 'app', 'outputs', 'flutter-apk', 'app-release.apk');
    return null;
  }

  async function serve(req: any, res: any, pathname: string): Promise<boolean> {
    const match = pathname.match(/^\/publish\/([^/]+)(?:\/(.*))?$/);
    if (!match) return false;
    const key = match[1];
    const rest = match[2] || '';
    const base = path.join(rootDir, key, 'project', 'build', 'web');
    let absolute = path.resolve(base, rest || 'index.html');
    if (absolute !== base && !absolute.startsWith(`${base}${path.sep}`)) {
      res.writeHead(403).end('Forbidden');
      return true;
    }
    try {
      let stat = await fs.stat(absolute).catch(() => null);
      if (!stat || stat.isDirectory()) {
        absolute = path.join(base, 'index.html');
        stat = await fs.stat(absolute).catch(() => null);
      }
      if (!stat || !stat.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<!doctype html><title>Publish</title><p>No published build exists yet.</p>');
        return true;
      }
      const types: Record<string, string> = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.mjs': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.webmanifest': 'application/manifest+json; charset=utf-8',
        '.wasm': 'application/wasm',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.otf': 'font/otf',
        '.map': 'application/json; charset=utf-8',
      };
      const extension = path.extname(absolute).toLowerCase();
      res.writeHead(200, {
        'Content-Type': types[extension] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=300',
      });
      if (req.method === 'HEAD') {
        res.end();
        return true;
      }
      res.end(await fs.readFile(absolute));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(error instanceof Error ? error.message : 'Publish error');
    }
    return true;
  }

  return { startPublish, statusForProject, reportForProject, artifactForProject, serve, rootDir };
}

