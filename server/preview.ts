import { spawn, ChildProcess } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getProjectDataRoot } from './paths.js';
import net from 'node:net';
import { createHash } from 'node:crypto';
import { materializeFiles, safeRelativePath } from './harness/workspace.js';
import { ensureFlutter } from './harness/managedFlutter.js';
import { analyzeProject, formatDiagnostic, Diagnostic } from './harness/analyze.js';
import { sanitizeSdkConstraint, sanitizeFlutterConstraint, fixInvalidPlainScalars, getToolchainVersions } from './harness/pubspecFix.js';

const MAX_LOG_LINES = 500;
const BUILD_TIMEOUT_MS = Number(process.env.FLUTTERFORGE_PREVIEW_TIMEOUT_MS || 15 * 60 * 1000);
const PUB_GET_TIMEOUT_MS = 4 * 60 * 1000;

function projectKey(projectId: string): string {
  const raw = String(projectId ?? '').trim();
  const readable = raw.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
  if (readable.length >= 3 && readable === raw) return readable;
  return `${readable || 'preview'}-${createHash('sha256').update(raw || 'default').digest('hex').slice(0, 10)}`;
}

function tail(text: string, max = 4000): string {
  return text.length > max ? text.slice(-max) : text;
}

interface RunStreamingOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  onLine: (line: string) => void;
  onSpawn?: (child: ChildProcess) => void;
}

function runStreaming(command: string, args: string[], options: RunStreamingOptions): Promise<{ ok: boolean; code?: number | null; error?: string; output: string }> {
  return new Promise((resolve) => {
    let child: ChildProcess;
    try {
      child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env ?? process.env,
        shell: process.platform === 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      resolve({ ok: false, code: null, error: error instanceof Error ? error.message : String(error), output: '' });
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

function freePort(): Promise<number> {
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

function spawnWebRunner(command: string, args: string[], options: RunStreamingOptions): Promise<{ ok: boolean; url?: string; child?: ChildProcess; code?: number | null; error?: string; output: string }> {
  return new Promise((resolve) => {
    let child: ChildProcess;
    try {
      child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env ?? process.env,
        shell: process.platform === 'win32',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error) {
      resolve({ ok: false, error: error instanceof Error ? error.message : String(error), output: '' });
      return;
    }
    options.onSpawn?.(child);
    let output = '';
    let settled = false;
    const finish = (result: any) => {
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

    const handle = (chunk: Buffer | string) => {
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

export function createPreviewService(options: { rootDir?: string } = {}) {
  const rootDir = options.rootDir
    || process.env.FLUTTERFORGE_PREVIEWS
    || path.join(getProjectDataRoot(), 'previews');

  const sessions = new Map<string, any>();
  const projectToSession = new Map<string, string>();
  const buildingProjects = new Set<string>();
  const runners = new Map<string, { child: ChildProcess; port: number; url: string }>();

  const MAX_RUNNERS = Number(process.env.FLUTTERFORGE_MAX_PREVIEWS || 3);

  function killRunner(key: string) {
    const runner = runners.get(key);
    if (!runner) return;
    runners.delete(key);
    try {
      runner.child.kill('SIGKILL');
    } catch {
      // already gone
    }
  }

  const previewDir = (projectId: string) => path.join(rootDir, projectKey(projectId));

  async function startBuild(projectId: string, files: Array<{ path: string; content?: string | null; is_directory?: boolean }>, meta: { supabaseUrl?: string; supabaseAnonKey?: string } = {}) {
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
      } catch (error: any) {
        return { statusCode: 400, body: { error: error.message } };
      }
    }

    buildingProjects.add(key);
    const sessionId = `${key.slice(0, 8)}-${Date.now().toString(36)}`;
    const session: any = {
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
      diagnostics: [] as Diagnostic[],
    };
    sessions.set(sessionId, session);
    projectToSession.set(key, sessionId);

    void (async () => {
      const log = (line: string) => {
        session.logs.push(line);
        if (session.logs.length > MAX_LOG_LINES) session.logs.shift();
      };
      const directory = previewDir(projectId);
      try {
        const flutterBin = await ensureFlutter({ onProgress: log });
        if (session.cancelled) throw new Error('cancelled');
        killRunner(key);
        await fs.mkdir(directory, { recursive: true });
        for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
          if (['.dart_tool', 'build', 'pubspec.lock', '.flutterforge-pubspec-hash'].includes(entry.name)) continue;
          await fs.rm(path.join(directory, entry.name), { recursive: true, force: true });
        }
        log(`[preview] Writing ${files.length} project files…`);
        await materializeFiles(directory, files);

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

        const pubspecPath = path.join(directory, 'pubspec.yaml');
        let pubspecContent = await fs.readFile(pubspecPath, 'utf8').catch(() => '');
        if (pubspecContent.trim()) {
          const lines = pubspecContent.split(/\r?\n/);
          const indentOf = (l: string) => (l.match(/^[ \t]*/) || [''])[0].length;
          const flutterIdx = lines.findIndex((l) => l.trim() === 'flutter:' && indentOf(l) === 0);
          if (flutterIdx !== -1) {
            const parentIndent = 0;
            let end = flutterIdx + 1;
            const kept: string[] = [];
            let sawUsesMaterial = false;
            let inAssets = false;
            let assetsIndent = -1;
            while (end < lines.length) {
              const line = lines[end];
              if (!line.trim()) { kept.push(line); end++; continue; }
              const indent = indentOf(line);
              if (indent <= parentIndent) break;
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
        } catch (fixError: any) {
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

        log('[preview] Running compile gate (dart analyze)…');
        const analysis = await analyzeProject(directory, { flutterBin });
        session.diagnostics = analysis.diagnostics;
        for (const diagnostic of analysis.diagnostics.slice(0, 40)) {
          log(`[preview] ${formatDiagnostic(diagnostic)}`);
        }
        if (analysis.skipped) {
          log(`[preview] ${analysis.summary}`);
        } else if (!analysis.ok) {
          const first = analysis.diagnostics.find((item) => item.severity === 'error');
          throw new Error(
            `${analysis.summary}${first ? ` First error: ${formatDiagnostic(first)}` : ''}`,
          );
        } else {
          log(`[preview] ${analysis.summary}`);
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
          runners.set(key, { child: runner.child!, port, url: runner.url! });
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

  function sessionStatus(sessionId: string) {
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
      diagnostics: session.diagnostics.slice(0, 60),
      createdAt: session.createdAt,
    };
  }

  process.once('exit', () => {
    for (const key of [...runners.keys()]) killRunner(key);
  });

  function statusForProject(projectId: string) {
    const sessionId = projectToSession.get(projectKey(projectId));
    if (!sessionId) return null;
    return sessionStatus(sessionId);
  }

  function stop(sessionId: string): boolean {
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

  function reload(projectId: string, options: { restart?: boolean } = {}) {
    const key = projectKey(projectId);
    const runner = runners.get(key);
    if (!runner?.child?.stdin?.writable) {
      return { ok: false, statusCode: 409, body: { error: 'No warm preview is running. Compile the preview first.' } };
    }
    const mode = options.restart ? 'R' : 'r';
    try {
      runner.child.stdin.write(`${mode}\n`);
    } catch (error) {
      return { ok: false, statusCode: 500, body: { error: error instanceof Error ? error.message : String(error) } };
    }
    return { ok: true, statusCode: 202, body: { ok: true, mode: options.restart ? 'restart' : 'reload', port: runner.port } };
  }

  async function serve(req: any, res: any, pathname: string): Promise<boolean> {
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
      const types: Record<string, string> = {
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

  return { startBuild, sessionStatus, statusForProject, stop, reload, serve, rootDir };
}

