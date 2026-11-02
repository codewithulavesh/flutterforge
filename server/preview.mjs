import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getProjectDataRoot } from './paths.mjs';
import net from 'node:net';
import { createHash } from 'node:crypto';
import { materializeFiles, safeRelativePath } from './harness/workspace.mjs';
import { ensureFlutter } from './harness/managedFlutter.mjs';
import { sanitizeSdkConstraint, sanitizeFlutterConstraint, fixInvalidPlainScalars, getToolchainVersions } from './harness/pubspecFix.mjs';

const MAX_LOG_LINES = 500;
const BUILD_TIMEOUT_MS = Number(process.env.FLUTTERFORGE_PREVIEW_TIMEOUT_MS || 15 * 60 * 1000);
const PUB_GET_TIMEOUT_MS = 4 * 60 * 1000;
const ANALYZE_TIMEOUT_MS = 3 * 60 * 1000;

/** @param {string} projectId */
function projectKey(projectId) {
  const raw = String(projectId ?? '').trim();
  const readable = raw.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
  if (readable.length >= 3 && readable === raw) return readable;
  return `${readable || 'preview'}-${createHash('sha256').update(raw || 'default').digest('hex').slice(0, 10)}`;
}

/** @param {string} text */
function tail(text, max = 4000) {
  return text.length > max ? text.slice(-max) : text;
}

/**
 * Spawn a command, stream its output line-by-line, and resolve with the exit.
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd: string, env?: NodeJS.ProcessEnv, timeoutMs?: number, onLine: (line: string) => void, onSpawn?: (child: import('node:child_process').ChildProcess) => void }} options
 */
function runStreaming(command, args, options) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env ?? process.env,
        shell: process.platform === 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      resolve({ ok: false, code: null, error: error instanceof Error ? error.message : String(error) });
      return;
    }
    options.onSpawn?.(child);

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
      options.onLine(`[preview] timed out after ${Math.round((options.timeoutMs ?? BUILD_TIMEOUT_MS) / 1000)}s`);
      resolve({ ok: false, code: null, error: 'timeout', output });
    }, options.timeoutMs ?? BUILD_TIMEOUT_MS);

    const handle = (chunk) => {
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
      resolve({ ok: false, code: null, error: error.message, output });
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: code === 0, code, output });
    });
  });
}

/** Ask the OS for an unused loopback port. */
function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

/**
 * Start `flutter run -d web-server` and resolve as soon as it prints its URL.
 * The child stays alive for warm reloads; the caller owns it.
 */
function spawnWebRunner(command, args, options) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env ?? process.env,
        shell: process.platform === 'win32',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error) {
      resolve({ ok: false, error: error instanceof Error ? error.message : String(error) });
      return;
    }
    options.onSpawn?.(child);
    let output = '';
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // gone
      }
      finish({ ok: false, error: 'timeout', output });
    }, options.timeoutMs ?? 180_000);

    const handle = (chunk) => {
      const text = chunk.toString();
      output = tail(`${output}${text}`, 16_384);
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) options.onLine(line.trim());
      }
      const match = output.match(/https?:\/\/(?:127\.0\.0\.1|localhost):(\d+)\/?/);
      if (match) {
        finish({ ok: true, url: match[0].endsWith('/') ? match[0] : `${match[0]}/`, output, child });
      }
    };
    child.stdout?.on('data', handle);
    child.stderr?.on('data', handle);
    child.on('error', (error) => finish({ ok: false, error: error.message, output }));
    child.on('exit', (code) => finish({ ok: false, code, output }));
  });
}

/**
 * Local Flutter web preview compiler + static host, built into the same Node
 * process as the harness bridge so the desktop app needs no second service.
 *
 * Two modes:
 * - `run` (default): a warm `flutter run -d web-server` process per project.
 *   Reloads are seconds, like FlutterPad, instead of a full release build.
 * - `build`: one-shot `flutter build web` + static host (hosted/Docker mode).
 *
 * @param {{ rootDir?: string }} [options]
 */
export function createPreviewService(options = {}) {
  const rootDir = options.rootDir
    || process.env.FLUTTERFORGE_PREVIEWS
    || path.join(getProjectDataRoot(), 'previews');

  /** @type {Map<string, any>} */
  const sessions = new Map();
  /** @type {Map<string, string>} */
  const projectToSession = new Map();
  /** @type {Map<string, Set<string>>} */
  const buildingProjects = new Set();
  /** @type {Map<string, { child: import('node:child_process').ChildProcess, port: number, url: string }>} */
  const runners = new Map();

  // Keep a bounded number of warm Flutter servers alive (each is a real SDK
  // process). The oldest is evicted when a new project starts.
  const MAX_RUNNERS = Number(process.env.FLUTTERFORGE_MAX_PREVIEWS || 3);

  /** @param {string} key */
  function killRunner(key) {
    const runner = runners.get(key);
    if (!runner) return;
    runners.delete(key);
    try {
      runner.child.kill('SIGKILL');
    } catch {
      // already gone
    }
  }

  /** @param {string} projectId */
  const previewDir = (projectId) => path.join(rootDir, projectKey(projectId));

  /**
   * @param {string} projectId
   * @param {Array<{path: string, content?: string|null, is_directory?: boolean}>} files
   * @param {{ supabaseUrl?: string, supabaseAnonKey?: string }} [meta]
   */
  async function startBuild(projectId, files, meta = {}) {
    if (!Array.isArray(files) || files.length === 0) {
      return { statusCode: 400, body: { error: 'files[] required' } };
    }
    const key = projectKey(projectId);
    if (buildingProjects.has(key)) {
      return { statusCode: 409, body: { error: 'A preview build for this project is already running.' } };
    }

    for (const file of files) {
      if (!file || typeof file.path !== 'string') continue;
      try {
        safeRelativePath(file.path);
      } catch (error) {
        return { statusCode: 400, body: { error: error.message } };
      }
    }

    buildingProjects.add(key);
    const sessionId = `${key.slice(0, 8)}-${Date.now().toString(36)}`;
    const session = {
      sessionId,
      projectId,
      projectKey: key,
      status: 'building',
      logs: ['[preview] Preparing project…'],
      url: `/preview/${key}/`,
      publicUrl: null,
      port: null,
      createdAt: Date.now(),
      proc: null,
      cancelled: false,
    };
    sessions.set(sessionId, session);
    projectToSession.set(key, sessionId);

    void (async () => {
      const log = (line) => {
        session.logs.push(line);
        if (session.logs.length > MAX_LOG_LINES) session.logs.shift();
      };
      const directory = previewDir(projectId);
      try {
        const flutterBin = await ensureFlutter({ onProgress: log });
        if (session.cancelled) throw new Error('cancelled');
        // A warm runner keeps the old files open; stop it before rewriting.
        killRunner(key);
        await fs.mkdir(directory, { recursive: true });
        // Keep the Dart package cache and build artifacts between edits. A
        // full rm forced `flutter pub get` and a cold compile every time.
        for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
          if (['.dart_tool', 'build', 'pubspec.lock', '.flutterforge-pubspec-hash'].includes(entry.name)) continue;
          await fs.rm(path.join(directory, entry.name), { recursive: true, force: true });
        }
        log(`[preview] Writing ${files.length} project files…`);
        await materializeFiles(directory, files);

        // Flutter web needs `web/`; scaffold it in a throwaway project so the
        // generated lib/ and pubspec.yaml are never overwritten.
        const webIndex = path.join(directory, 'web', 'index.html');
        try {
          await fs.access(webIndex);
        } catch {
          log('[preview] Scaffolding the Flutter web runner…');
          const scratchRoot = path.join(getProjectDataRoot(), 'tmp');
          await fs.mkdir(scratchRoot, { recursive: true });
          const scaffold = path.join(scratchRoot, `flutterforge-web-${key}-${Date.now().toString(36)}`);
          const pubspec = await fs.readFile(path.join(directory, 'pubspec.yaml'), 'utf8').catch(() => '');
          const packageName = pubspec.match(/^name\s*:\s*([A-Za-z0-9_]+)/m)?.[1] || 'flutterforge_preview';
          const created = await runStreaming(
            flutterBin,
            ['create', '--platforms=web', '--no-pub', '--org', 'com.flutterforge', '--project-name', packageName, scaffold],
            { cwd: path.dirname(scaffold), onLine: log, timeoutMs: 180_000 },
          );
          if (created.ok) {
            await fs.cp(path.join(scaffold, 'web'), path.join(directory, 'web'), { recursive: true });
          } else {
            log('[preview] flutter create failed; writing a minimal web shell instead.');
            await fs.mkdir(path.join(directory, 'web'), { recursive: true });
            await fs.writeFile(webIndex, [
              '<!DOCTYPE html>',
              '<html>',
              '<head>',
              '  <base href="$FLUTTER_BASE_HREF">',
              '  <meta charset="UTF-8">',
              '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
              '  <title>FlutterForge Preview</title>',
              '</head>',
              '<body>',
              '  <script src="flutter_bootstrap.js" async></script>',
              '</body>',
              '</html>',
              '',
            ].join('\n'), 'utf8');
          }
          await fs.rm(scaffold, { recursive: true, force: true }).catch(() => {});
        }

        if (session.cancelled) throw new Error('cancelled');

        // Inject Supabase values when the generated constants file exists.
        if (meta.supabaseUrl || meta.supabaseAnonKey) {
          const constants = path.join(directory, 'lib', 'core', 'constants', 'app_constants.dart');
          try {
            let content = await fs.readFile(constants, 'utf8');
            if (meta.supabaseUrl) content = content.replace(/supabaseUrl\s*=\s*['"][^'"]*['"]/, `supabaseUrl = '${meta.supabaseUrl}'`);
            if (meta.supabaseAnonKey) content = content.replace(/supabaseAnonKey\s*=\s*['"][^'"]*['"]/, `supabaseAnonKey = '${meta.supabaseAnonKey}'`);
            await fs.writeFile(constants, content, 'utf8');
          } catch {
            // No AppConstants file; skip injection.
          }
        }

        const pubspecPath = path.join(directory, 'pubspec.yaml');
        let pubspecContent = await fs.readFile(pubspecPath, 'utf8').catch(() => '');
        // Self-heal the most common AI pubspec mistake before it fails the
        // whole build: hallucinated keys under `flutter:` (e.g. a generated
        // `uses-material3: true` — that flag belongs in Dart's ThemeData,
        // never in the pubspec). Keep only the keys pub actually accepts and
        // guarantee `uses-material-design` exists so icon fonts ship.
        if (pubspecContent.trim()) {
          const lines = pubspecContent.split(/\r?\n/);
          const indentOf = (l) => (l.match(/^[ \t]*/) || [''])[0].length;
          // Only the TOP-LEVEL `flutter:` section (indent 0) — the string
          // `flutter:` also appears under `dependencies:` as the SDK dep, and
          // rewriting that one corrupts the file instead of fixing it.
          const flutterIdx = lines.findIndex((l) => l.trim() === 'flutter:' && indentOf(l) === 0);
          if (flutterIdx !== -1) {
            const parentIndent = 0;
            let end = flutterIdx + 1;
            const kept = [];
            let sawUsesMaterial = false;
            let inAssets = false;
            let assetsIndent = -1;
            while (end < lines.length) {
              const line = lines[end];
              if (!line.trim()) { kept.push(line); end++; continue; }
              const indent = indentOf(line);
              if (indent <= parentIndent) break; // left the flutter: block
              if (inAssets && indent > assetsIndent) { kept.push(line); end++; continue; }
              inAssets = false;
              if (/^\s+uses-material-design\s*:/i.test(line)) {
                sawUsesMaterial = true;
                kept.push(line);
              } else if (/^\s+assets\s*:/.test(line)) {
                inAssets = true;
                assetsIndent = indent;
                kept.push(line);
              }
              // anything else (uses-material3, stray keys, …) is dropped
              end++;
            }
            if (!sawUsesMaterial) kept.push('  uses-material-design: true');
            const sanitized = [
              ...lines.slice(0, flutterIdx + 1),
              ...kept,
              ...lines.slice(end),
            ].join('\n').replace(/\n{3,}/g, '\n\n');
            if (sanitized !== pubspecContent) {
              log('[preview] Sanitized pubspec.yaml (removed keys pub does not accept, ensured uses-material-design).');
              pubspecContent = sanitized;
              await fs.writeFile(pubspecPath, sanitized, 'utf8');
            }
          }
        }
        // Clamp impossible toolchain constraints and repair invalid YAML
        // (LLMs quote nothing: `description: A timer: 25 minutes` is fatal)
        // before pub get, which fails before a single Dart error is shown.
        try {
          const scalarFix = fixInvalidPlainScalars(pubspecContent);
          if (scalarFix.changed) pubspecContent = scalarFix.content;
          const toolchain = await getToolchainVersions();
          const sdkFix = sanitizeSdkConstraint(pubspecContent, { dartVersion: toolchain.dartVersion });
          if (sdkFix.changed) pubspecContent = sdkFix.content;
          const flutterFix = sanitizeFlutterConstraint(pubspecContent, { flutterVersion: toolchain.flutterVersion });
          if (flutterFix.changed) pubspecContent = flutterFix.content;
          for (const note of [scalarFix.note, sdkFix.note, flutterFix.note]) {
            if (note) log(`[preview] ${note}`);
          }
          if (scalarFix.changed || sdkFix.changed || flutterFix.changed) {
            await fs.writeFile(pubspecPath, pubspecContent, 'utf8');
          }
        } catch (fixError) {
          log(`[preview] pubspec constraint check skipped: ${fixError?.message || fixError}`);
        }
        const pubspecHash = createHash('sha256').update(pubspecContent).digest('hex');
        const hashFile = path.join(directory, '.flutterforge-pubspec-hash');
        const previousHash = await fs.readFile(hashFile, 'utf8').catch(() => '');
        const hasPackageConfig = await fs.access(path.join(directory, '.dart_tool', 'package_config.json')).then(() => true).catch(() => false);
        if (previousHash === pubspecHash && hasPackageConfig) {
          log('[preview] Dependencies unchanged — reusing the warm pub cache.');
        } else {
          log('[preview] Running flutter pub get…');
          const pub = await runStreaming(flutterBin, ['pub', 'get'], {
            cwd: directory,
            timeoutMs: PUB_GET_TIMEOUT_MS,
            onLine: log,
          });
          if (!pub.ok) throw new Error(`flutter pub get failed${pub.error ? `: ${pub.error}` : ''}`);
          await fs.writeFile(hashFile, pubspecHash, 'utf8');
        }

        if (session.cancelled) throw new Error('cancelled');

        // Fail fast: a quick `flutter analyze` catches the engine's broken
        // Dart before the minutes-long compile of the warm runner. Only real
        // errors block the preview — lint/info noise must not.
        log('[preview] Running flutter analyze…');
        let analyzeSawError = false;
        const analyze = await runStreaming(flutterBin, ['analyze', '--no-pub'], {
          cwd: directory,
          timeoutMs: ANALYZE_TIMEOUT_MS,
          onLine: (line) => {
            if (/error\s+•|\berror -/i.test(line)) analyzeSawError = true;
            log(line);
          },
        });
        if (analyzeSawError) {
          throw new Error('flutter analyze found Dart errors — repair the project before the preview can start.');
        }
        if (!analyze.ok && analyze.error) {
          throw new Error(`flutter analyze failed${analyze.error ? `: ${analyze.error}` : ''}`);
        }

        const mode = process.env.FLUTTERFORGE_PREVIEW_MODE || 'run';
        if (mode === 'build') {
          log('[preview] Building Flutter web (release)…');
          const built = await runStreaming(
            flutterBin,
            ['build', 'web', '--release', '--base-href', session.url],
            {
              cwd: directory,
              timeoutMs: BUILD_TIMEOUT_MS,
              onLine: log,
              onSpawn: (child) => {
                session.proc = child;
              },
            },
          );
          session.proc = null;
          if (!built.ok) throw new Error(`flutter build web failed${built.error ? `: ${built.error}` : ''}`);

          await fs.access(path.join(directory, 'build', 'web', 'index.html'));
          session.status = 'running';
          session.url = `/preview/${key}/`;
          log('[preview] Ready.');
        } else {
          if (runners.size >= MAX_RUNNERS) {
            const oldest = runners.keys().next().value;
            if (oldest) killRunner(oldest);
          }
          // FlutterPad-style warm server: `flutter run -d web-server` stays
          // alive, so the next edit restarts in seconds instead of a full
          // release build. The iframe points straight at the loopback server.
          const port = await freePort();
          log(`[preview] Starting warm Flutter web server on 127.0.0.1:${port}…`);
          const runner = await spawnWebRunner(
            flutterBin,
            ['run', '-d', 'web-server', '--web-hostname', '127.0.0.1', '--web-port', String(port)],
            {
              cwd: directory,
              timeoutMs: 180_000,
              onLine: log,
              onSpawn: (child) => {
                session.proc = child;
              },
            },
          );
          if (!runner.ok) {
            try {
              runner.child?.kill('SIGKILL');
            } catch {
              // gone
            }
            throw new Error(`flutter run failed${runner.error ? `: ${runner.error}` : ''}`);
          }
          runners.set(key, { child: runner.child, port, url: runner.url });
          session.proc = runner.child;
          session.port = port;
          session.status = 'running';
          session.url = runner.url;
          log(`[preview] Ready at ${runner.url}`);
        }
      } catch (error) {
        if (session.cancelled) {
          session.status = 'stopped';
          session.url = null;
          log('[preview] Stopped.');
        } else {
          session.status = 'failed';
          session.url = null;
          log(`[preview] Failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      } finally {
        buildingProjects.delete(key);
      }
    })();

    return {
      statusCode: 202,
      body: { sessionId, status: session.status, url: session.url },
    };
  }

  /** @param {string} sessionId */
  function sessionStatus(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return null;
    return {
      sessionId: session.sessionId,
      projectId: session.projectId,
      status: session.status,
      url: session.status === 'running' ? session.url : null,
      publicUrl: null,
      port: null,
      logs: session.logs.slice(-200),
      createdAt: session.createdAt,
    };
  }

  process.once('exit', () => {
    for (const key of [...runners.keys()]) killRunner(key);
  });

  /** @param {string} projectId */
  function statusForProject(projectId) {
    const sessionId = projectToSession.get(projectKey(projectId));
    if (!sessionId) return null;
    return sessionStatus(sessionId);
  }

  /** @param {string} sessionId */
  function stop(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return false;
    session.cancelled = true;
    killRunner(session.projectKey);
    try {
      session.proc?.kill('SIGKILL');
    } catch {
      // gone
    }
    if (session.status !== 'failed') session.status = 'stopped';
    session.url = null;
    return true;
  }

  /**
   * Serve a built preview from `/preview/<projectId>/…`.
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   * @param {string} pathname
   * @returns {Promise<boolean>} true when the request was handled
   */
  async function serve(req, res, pathname) {
    const match = pathname.match(/^\/preview\/([^/]+)(?:\/(.*))?$/);
    if (!match) return false;
    const key = match[1];
    const rest = match[2] || '';
    const runner = runners.get(key);
    if (runner?.url) {
      res.writeHead(302, { Location: runner.url });
      res.end();
      return true;
    }
    const base = path.join(rootDir, key, 'build', 'web');
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
        res.end('<!doctype html><title>Preview</title><p>Preview is not built yet.</p>');
        return true;
      }
      const extension = path.extname(absolute).toLowerCase();
      const types = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.mjs': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
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
      const headers = {
        'Content-Type': types[extension] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=60',
      };
      res.writeHead(200, headers);
      if (req.method === 'HEAD') {
        res.end();
        return true;
      }
      res.end(await fs.readFile(absolute));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(error instanceof Error ? error.message : 'Preview error');
    }
    return true;
  }

  return { startBuild, sessionStatus, statusForProject, stop, serve, rootDir };
}
