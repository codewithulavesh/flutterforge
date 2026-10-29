import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const PORT = parseInt(process.env.PORT || '3001', 10);
const BASE_WORK_DIR = process.env.FLUTTER_PREVIEW_DIR || '/tmp/flutter_previews';

// Ensure base dir exists
if (!fs.existsSync(BASE_WORK_DIR)) {
  fs.mkdirSync(BASE_WORK_DIR, { recursive: true });
}

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '30mb' }));

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

// In-memory sessions: sessionId -> { sessionId, projectId, status, logs: string[], url: string | null }
const sessions = new Map();
const projectToSession = new Map();
const logSubscribers = new Map(); // sessionId -> Set<ws>
const buildingProjects = new Set(); // projectIds with an active build (no overlapping compiles)

// Sweeps sessions idle longer than TTL (running builds are never swept).
const SESSION_TTL_MS = 30 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [id, sess] of sessions) {
    if (sess.status !== 'building' && now - sess.createdAt > SESSION_TTL_MS) {
      sessions.delete(id);
      if (projectToSession.get(sess.projectId) === id) projectToSession.delete(sess.projectId);
      logSubscribers.delete(id);
      try {
        fs.rmSync(path.join(BASE_WORK_DIR, sess.projectId), { recursive: true, force: true });
      } catch { /* best-effort disk cleanup */ }
    }
  }
}, 5 * 60 * 1000).unref();

function broadcastLog(sessionId, line) {
  const sess = sessions.get(sessionId);
  if (sess) {
    sess.logs.push(line);
    if (sess.logs.length > 500) sess.logs.shift();
  }
  const subs = logSubscribers.get(sessionId);
  if (subs) {
    for (const ws of subs) {
      if (ws.readyState === ws.OPEN) {
        ws.send(line);
      }
    }
  }
}

// ---- Health Checks ----
app.get('/health', (req, res) => res.json({ ok: true, runner: 'local-flutter', activeSessions: sessions.size }));
app.get('/api/health', (req, res) => res.json({ ok: true, runner: 'local-flutter' }));

// ---- Serve Compiled Flutter Web Assets ----
app.use('/preview/:projectId', (req, res, next) => {
  const projectId = req.params.projectId;
  const webDir = path.join(BASE_WORK_DIR, projectId, 'build', 'web');

  if (!fs.existsSync(webDir)) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.removeHeader('X-Frame-Options');
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Flutter Web Preview</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              background: #0a0e17;
              color: #e2e8f0;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              overflow: hidden;
            }
            .card {
              text-align: center;
              padding: 24px 32px;
              background: rgba(15, 23, 42, 0.7);
              border: 1px solid rgba(99, 102, 241, 0.2);
              border-radius: 16px;
              backdrop-filter: blur(12px);
              box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
              max-width: 320px;
            }
            .spinner {
              width: 36px;
              height: 36px;
              border: 3px solid rgba(99, 102, 241, 0.2);
              border-top-color: #6366f1;
              border-radius: 50%;
              animation: spin 0.8s linear infinite;
              margin: 0 auto 16px;
            }
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
            h3 {
              color: #f8fafc;
              margin: 0 0 6px;
              font-size: 15px;
              font-weight: 600;
            }
            p {
              color: #94a3b8;
              font-size: 12px;
              margin: 0;
              line-height: 1.5;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="spinner"></div>
            <h3>Building Flutter Web...</h3>
            <p>Compiling app in background.<br>Preview will load automatically.</p>
          </div>
          <script>
            let checkCount = 0;
            const timer = setInterval(async () => {
              checkCount++;
              try {
                const res = await fetch('/api/preview/${projectId}/status');
                if (res.ok) {
                  const data = await res.json();
                  if (data.status === 'running') {
                    clearInterval(timer);
                    window.location.reload();
                    return;
                  }
                }
              } catch(e) {}
              if (checkCount > 120) {
                clearInterval(timer);
              }
            }, 1500);
          </script>
        </body>
      </html>
    `);
  }

  express.static(webDir, {
    setHeaders: (res, filePath) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.removeHeader('X-Frame-Options');
      if (filePath.endsWith('.wasm')) {
        res.setHeader('Content-Type', 'application/wasm');
      }
      // Never serve a stale cached app shell: every rebuild overwrites the
      // same filenames (index.html, main.dart.js), so a fresh build must
      // never render the previous app from browser cache.
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store');
      } else {
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      }
    }
  })(req, res, next);
});

// ---- Start / Queue Flutter Build ----
app.post('/api/preview/:projectId/build', async (req, res) => {
  const { projectId } = req.params;
  const { files, supabaseUrl, supabaseAnonKey } = req.body;

  if (!files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'files[] required' });
  }

  // One build per project at a time: a second build would interleave file
  // writes with an in-flight `flutter build` and corrupt both.
  if (buildingProjects.has(projectId)) {
    return res.status(409).json({ error: 'A build for this project is already running.' });
  }
  buildingProjects.add(projectId);

  const sessionId = `${projectId.slice(0, 8)}-${Date.now().toString(36)}`;
  const projectDir = path.join(BASE_WORK_DIR, projectId);

  const session = {
    sessionId,
    projectId,
    status: 'building',
    logs: ['[flutter-forge] Preparing project directory...'],
    url: null,
    createdAt: Date.now(),
    cancelled: false,
    proc: null,
  };

  sessions.set(sessionId, session);
  projectToSession.set(projectId, sessionId);

  res.status(202).json({
    sessionId,
    status: 'building',
    url: `/preview/${projectId}/`,
  });

  // Execute Build in Background
  (async () => {
    try {
      // 0. Invalidate the previous build output FIRST. `flutter build`
      // only replaces build/web on success — without this, a failed
      // rebuild keeps serving the previous app at the same URL, which
      // reads as "every preview shows the same app".
      try {
        fs.rmSync(path.join(projectDir, 'build'), { recursive: true, force: true });
        broadcastLog(sessionId, '[build] Cleared previous build output...');
      } catch { /* nothing to clear */ }

      // 1. Write all incoming files to disk (contained: no path escapes).
      broadcastLog(sessionId, `[build] Writing project files...`);
      // Persistent backup (never auto-deleted) so a failed build's sources
      // can be inspected/fixed even if the work dir is cleaned.
      try {
        const backupDir = path.join('/tmp', 'flutter_previews_backup', projectId);
        fs.mkdirSync(backupDir, { recursive: true });
        fs.writeFileSync(
          path.join(backupDir, `_files_${sessionId}.json`),
          JSON.stringify(files.map((f) => ({ path: f.path, content: f.content ?? '' }))),
          'utf-8',
        );
      } catch { /* backup is best-effort */ }
      for (const f of files) {
        if (!f.path) continue;
        const isDir = f.is_directory || f.isDirectory || f.path.endsWith('/') || (f.content === null && !path.extname(f.path));
        const absPath = path.normalize(path.join(projectDir, f.path));
        if (!absPath.startsWith(projectDir + path.sep) && absPath !== projectDir) continue;
        if (isDir) {
          if (!fs.existsSync(absPath)) fs.mkdirSync(absPath, { recursive: true });
          continue;
        }
        const dir = path.dirname(absPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        if (fs.existsSync(absPath) && fs.statSync(absPath).isDirectory()) continue;
        fs.writeFileSync(absPath, f.content || '', 'utf-8');
      }

      // 2. Ensure Flutter SDK is installed and available
      const flutterBin = await ensureFlutterSdk(sessionId);

      // 2b. Normalize known-bad pubspec pins before resolving. The classic
      // killer: flutter_localizations from the SDK requires intl ^0.20.x,
      // but older/agent-drafted pubspecs pin intl ^0.19.0 (unresolvable).
      // Second killer: dead packages (e.g. freezed_generator was pulled
      // from pub.dev — any version of it fails version solving outright).
      const pubspecPath = path.join(projectDir, 'pubspec.yaml');
      if (fs.existsSync(pubspecPath)) {
        let pub = fs.readFileSync(pubspecPath, 'utf-8');
        if (/flutter_localizations\s*:/.test(pub)) {
          const m = pub.match(/^\s*intl\s*:\s*['"]?([^'"\s]+)['"]?/m);
          const ver = m?.[1] ?? '';
          const mm = ver.match(/(\d+)\.(\d+)/);
          if (mm && parseInt(mm[1], 10) === 0 && parseInt(mm[2], 10) < 20) {
            pub = pub.replace(/^(\s*intl\s*:\s*)['"]?[^'"\s]+['"]?/m, '$1^0.20.3');
            broadcastLog(sessionId, `[build] Normalized stale intl pin ${ver} -> ^0.20.3 (SDK flutter_localizations requires it).`);
          }
        }
        const dropped = await dropDeadPackages(pubspecPath, pub, sessionId);
        if (dropped.text !== pub) {
          pub = dropped.text;
          fs.writeFileSync(pubspecPath, pub, 'utf-8');
        }
        // 2c. Rewrite self-stem imports: the LLM often imports its own files
        // as `package:<stem>/...` (e.g. `package:apex/...`) while the real
        // package name is `package:<stem>_<suffix>/...`. Those URIs can never
        // resolve — point them at the real package name before compiling.
        fixSelfPackageImports(projectDir, sessionId);

        // 2d. Ensure declared asset directories exist
        const assetDirs = [...pub.matchAll(/^\s*-\s*([a-zA-Z0-9_\-\/]+)\/\s*$/gm)].map((m) => m[1]);
        for (const ad of assetDirs) {
          const fullAd = path.join(projectDir, ad);
          if (!fs.existsSync(fullAd)) {
            fs.mkdirSync(fullAd, { recursive: true });
          }
        }

        // 2e. Defensive code fixes & ensure all imported packages exist in pubspec.yaml
        const sdkBundled = new Set(['flutter', 'flutter_test', 'flutter_localizations', 'sky_engine']);
        const ownPkgName = pub.match(/^name\s*:\s*([A-Za-z0-9_]+)/m)?.[1] || '';
        const KNOWN_PREVIEW_DEPS = {
          supabase_flutter: '^2.8.3',
          go_router: '^14.8.1',
          google_fonts: '^6.2.1',
          flutter_animate: '^4.5.2',
          cached_network_image: '^3.4.1',
          flutter_riverpod: '^2.6.1',
          provider: '^6.1.2',
          intl: '^0.20.2',
          shared_preferences: '^2.5.2',
          flutter_svg: '^2.0.17',
          shimmer: '^3.0.0',
          fl_chart: '^0.70.2',
          dio: '^5.8.0+1',
          http: '^1.3.0',
          uuid: '^4.5.1',
          path_provider: '^2.1.5',
        };

        const libDir = path.join(projectDir, 'lib');
        if (fs.existsSync(libDir)) {
          const scanDart = (dir) => {
            const results = [];
            for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
              const full = path.join(dir, ent.name);
              if (ent.isDirectory()) results.push(...scanDart(full));
              else if (ent.isFile() && ent.name.endsWith('.dart')) results.push(full);
            }
            return results;
          };
          const dartFiles = scanDart(libDir);
          let pubChanged = false;
          for (const df of dartFiles) {
            let dartCode = fs.readFileSync(df, 'utf-8');
            let dartModified = false;
            // context.go/push/pop require the go_router extension import.
            // Missing import surfaces as "The method 'go' isn't defined for
            // the type 'BuildContext'". Add it when used but not imported.
            if (
              /context\s*\.\s*(go|push|pop|replace)\s*\(/.test(dartCode) &&
              !/package:go_router\/go_router\.dart/.test(dartCode)
            ) {
              if (/^import\s/m.test(dartCode)) {
                dartCode = dartCode.replace(
                  /^(import\s+['"][^'"]+['"];?\s*\n)/m,
                  `$1import 'package:go_router/go_router.dart';\n`,
                );
              } else {
                dartCode = `import 'package:go_router/go_router.dart';\n${dartCode}`;
              }
              dartModified = true;
              broadcastLog(sessionId, `[build] Added missing go_router import in ${path.relative(projectDir, df)}.`);
            }
            if (dartCode.includes('cardTheme: CardTheme(')) {
              dartCode = dartCode.replace(/cardTheme: CardTheme\(/g, 'cardTheme: CardThemeData(');
              dartModified = true;
            }
            if (df.endsWith('app_router.dart') && dartCode.includes("import '../screens/")) {
              dartCode = dartCode.replace(/import '\.\.\/screens\//g, "import '../../screens/");
              dartModified = true;
            }
            if (/[a-zA-Z0-9]+&[a-zA-Z0-9]+/.test(dartCode)) {
              dartCode = dartCode.replace(/([a-zA-Z0-9]+)&([a-zA-Z0-9]+)/g, '$1$2');
              dartModified = true;
            }
            if (dartModified) {
              fs.writeFileSync(df, dartCode, 'utf-8');
            }
            for (const m of dartCode.matchAll(/import\s+['"]package:([^/'"]+)\//g)) {
              const pkg = m[1];
              if (pkg === ownPkgName || sdkBundled.has(pkg)) continue;
              if (!new RegExp(`^ {2}${pkg}\\s*:`, 'm').test(pub)) {
                const ver = KNOWN_PREVIEW_DEPS[pkg] || 'any';
                if (/^dependencies:\s*$/m.test(pub)) {
                  pub = pub.replace(/^(dependencies:\s*)$/m, `$1\n  ${pkg}: ${ver}`);
                  pubChanged = true;
                } else if (/^dependencies:/m.test(pub)) {
                  pub = pub.replace(/^(dependencies:[^\n]*\n)/m, `$1  ${pkg}: ${ver}\n`);
                  pubChanged = true;
                }
              }
            }
          }
          if (pubChanged) {
            fs.writeFileSync(pubspecPath, pub, 'utf-8');
          }
        }
      }

      // 3. Ensure web/ directory with index.html exists
      const webIndex = path.join(projectDir, 'web', 'index.html');
      if (!fs.existsSync(webIndex)) {
        broadcastLog(sessionId, '[build] Scaffolding Flutter web harness...');
        await runCommand(flutterBin, ['create', '--platforms=web', '--no-pub', '--org', 'com.flutterforge', '.'], projectDir, sessionId);
      }

      // 4. Inject Supabase env constants if AppConstants exists
      const appConstantsPath = path.join(projectDir, 'lib', 'core', 'constants', 'app_constants.dart');
      if (fs.existsSync(appConstantsPath) && (supabaseUrl || supabaseAnonKey)) {
        let content = fs.readFileSync(appConstantsPath, 'utf-8');
        if (supabaseUrl) content = content.replace(/supabaseUrl\s*=\s*['"][^'"]*['"]/, `supabaseUrl = '${supabaseUrl}'`);
        if (supabaseAnonKey) content = content.replace(/supabaseAnonKey\s*=\s*['"][^'"]*['"]/, `supabaseAnonKey = '${supabaseAnonKey}'`);
        fs.writeFileSync(appConstantsPath, content, 'utf-8');
      }

      // 5. Run `flutter pub get`
      broadcastLog(sessionId, '[build] Running flutter pub get...');
      await runCommand(flutterBin, ['pub', 'get'], projectDir, sessionId);

      // 6. Run `flutter build web`. The app is served from the subpath
      // `/preview/<projectId>/` (not domain root), so the base href must
      // point there — otherwise the browser resolves flutter_bootstrap.js,
      // main.dart.js and canvaskit against `/`, gets 404s, and renders a
      // blank white screen despite a successful build.
      broadcastLog(sessionId, '[build] Compiling Flutter Web (fast preview: -O1, no-wasm-dry-run)...');
      await runCommand(
        flutterBin,
        [
          'build',
          'web',
          '--release',
          '-O1',
          '--no-wasm-dry-run',
          '--no-source-maps',
          '--no-tree-shake-icons',
          '--base-href',
          `/preview/${projectId}/`,
        ],
        projectDir,
        sessionId
      );

      // 6b. Belt-and-braces: enforce the subpath <base href> in the emitted
      // index.html in case the SDK ignored the flag.
      const builtIndex = path.join(projectDir, 'build', 'web', 'index.html');
      if (fs.existsSync(builtIndex)) {
        const expectedBase = `/preview/${projectId}/`;
        let html = fs.readFileSync(builtIndex, 'utf-8');
        if (!html.includes(`<base href="${expectedBase}"`)) {
          if (/<base\s+href=/.test(html)) {
            html = html.replace(/<base\s+href="[^"]*"\s*\/?>/, `<base href="${expectedBase}">`);
          } else {
            html = html.replace(/<head[^>]*>/, (m) => `${m}\n    <base href="${expectedBase}">`);
          }
          fs.writeFileSync(builtIndex, html, 'utf-8');
          broadcastLog(sessionId, '[build] Rewrote <base href> for preview subpath serving.');
        }
      }

      // 6. Build Completed Successfully (unless the user stopped it —
      // a stale completion must never resurrect a stopped session).
      if (session.cancelled || session.status === 'stopped') {
        broadcastLog(sessionId, '[build] Build finished after stop — discarding.');
      } else {
        session.status = 'running';
        session.url = `/preview/${projectId}/`;
        broadcastLog(sessionId, '[build] Flutter Web compiled successfully! Preview is ready.');
      }
    } catch (err) {
      if (!session.cancelled && session.status !== 'stopped') {
        session.status = 'failed';
        broadcastLog(sessionId, `[error] Build failed: ${err.message || String(err)}`);
      }
    } finally {
      buildingProjects.delete(projectId);
    }
  })();
});

// ---- Status Polling ----
app.get('/api/preview/:sessionId/status', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  res.json({
    sessionId: session.sessionId,
    status: session.status,
    url: session.url,
    publicUrl: null,
    port: null,
    logs: session.logs.slice(-200),
    createdAt: session.createdAt,
  });
});

// ---- Project Status Polling & Recovery ----
app.get('/api/preview/project/:projectId/status', (req, res) => {
  const { projectId } = req.params;
  const sessionId = projectToSession.get(projectId);
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId);
    return res.json({
      sessionId: session.sessionId,
      projectId,
      status: session.status,
      url: session.url,
      publicUrl: null,
      port: null,
      logs: session.logs.slice(-200),
      createdAt: session.createdAt,
    });
  }

  // Check if compiled build already exists on disk
  const webIndex = path.join(BASE_WORK_DIR, projectId, 'build', 'web', 'index.html');
  if (fs.existsSync(webIndex)) {
    const recoveredSessionId = `rec-${projectId.slice(0, 8)}`;
    const session = {
      sessionId: recoveredSessionId,
      projectId,
      status: 'running',
      logs: ['[preview] Recovered existing Flutter Web build.'],
      url: `/preview/${projectId}/`,
      createdAt: Date.now(),
      cancelled: false,
      proc: null,
    };
    sessions.set(recoveredSessionId, session);
    projectToSession.set(projectId, recoveredSessionId);
    return res.json({
      sessionId: session.sessionId,
      projectId,
      status: 'running',
      url: session.url,
      publicUrl: null,
      port: null,
      logs: session.logs,
      createdAt: session.createdAt,
    });
  }

  res.status(404).json({ error: 'No active session or build found for project' });
});

// ---- Stop Session ----
app.post('/api/preview/:sessionId/stop', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (session) {
    session.cancelled = true;
    session.status = 'stopped';
    session.url = null;
    // Kill the in-flight compiler so it can't resurrect this session later.
    try {
      if (session.proc) session.proc.kill('SIGTERM');
    } catch { /* already exited */ }
    session.proc = null;
  }
  res.json({ ok: true });
});

// ---- WebSocket Upgrade for Live Terminal Logs ----
server.on('upgrade', (req, socket, head) => {
  const match = req.url.match(/\/api\/preview\/([^/]+)\/logs/);
  if (match) {
    const sessionId = match[1];
    wss.handleUpgrade(req, socket, head, (ws) => {
      if (!logSubscribers.has(sessionId)) {
        logSubscribers.set(sessionId, new Set());
      }
      const subs = logSubscribers.get(sessionId);
      subs.add(ws);

      // Send existing logs as history
      const sess = sessions.get(sessionId);
      if (sess && sess.logs.length > 0) {
        ws.send(JSON.stringify({ type: 'history', logs: sess.logs }));
      }

      ws.on('close', () => {
        subs.delete(ws);
        if (subs.size === 0) logSubscribers.delete(sessionId);
      });
    });
  } else {
    socket.destroy();
  }
});

function findFlutterBinary() {
  const possiblePaths = [
    '/opt/homebrew/bin/flutter',
    '/usr/local/bin/flutter',
    '/opt/homebrew/share/flutter/bin/flutter',
    path.join(process.env.HOME || '', 'development/flutter/bin/flutter'),
    path.join(process.env.HOME || '', '.config/flutter/bin/flutter'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// pub.dev existence + version cache: name -> { exists: boolean, versions: string[] }.
const packageInfoCache = new Map();

// Minimal semver helpers: pub's version-solver rejects a dependency when NO
// published version satisfies its constraint (e.g. `apex: ^1.0.0` when pub.dev
// only ever published 0.0.3). Unknown syntaxes always "satisfy" — we never
// drop a dependency on uncertainty.
function parseVer(v) {
  const m = String(v).trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)] : null;
}

function cmpVer(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function caretUpper(v) {
  if (v[0] > 0) return [v[0] + 1, 0, 0];
  if (v[1] > 0) return [0, v[1] + 1, 0];
  return [0, 0, v[2] + 1];
}

function versionSatisfies(versionStr, constraint) {
  const c = String(constraint || '').trim();
  if (!c || c === 'any') return true;
  const v = parseVer(versionStr);
  if (!v) return false;
  let m = c.match(/^(\d+\.\d+\.\d+)$/);
  if (m) return cmpVer(v, parseVer(m[1])) === 0;
  m = c.match(/^\^(\d+\.\d+\.\d+)$/);
  if (m) {
    const low = parseVer(m[1]);
    return cmpVer(v, low) >= 0 && cmpVer(v, caretUpper(low)) < 0;
  }
  // Range combos like ">=1.0.0 <2.0.0".
  for (const part of c.split(/\s+/)) {
    const pm = part.match(/^(>=|>|<=|<)(\d+\.\d+\.\d+)$/);
    if (!pm) return true; // unknown syntax: keep on uncertainty
    const bound = parseVer(pm[2]);
    const cmp = cmpVer(v, bound);
    const ok = pm[1] === '>=' ? cmp >= 0 : pm[1] === '>' ? cmp > 0 : pm[1] === '<=' ? cmp <= 0 : cmp < 0;
    if (!ok) return false;
  }
  return true;
}

// Drops hosted dependencies that can never version-solve, which otherwise
// fail `flutter pub get` with an unfixable error. Four cases:
//  1. Self-stem deps: the LLM names every app `<stem>_<suffix>` (e.g.
//     `apex_3e9d1a`) and then mistakenly lists `<stem>: ^x.y.z` as a
//     dependency — dropped instantly without any network call.
//  2. Dead packages (404 on pub.dev — e.g. pulled packages like freezed_generator).
//  3. Hallucinated pins: the package exists but NO published version satisfies
//     the constraint (e.g. `apex: ^1.0.0` when only 0.0.3 was ever published).
//  4. Dangling path deps: `path: ./something` whose target does not exist on
//     disk (e.g. the LLM adding a dependency on the app's own package name).
// SDK/git deps are never touched. Returns { text, dropped }.
async function dropDeadPackages(pubspecPath, pubText, sessionId) {
  const projectDir = path.dirname(pubspecPath);
  let cleaned = pubText;
  const dropped = [];
  let changed = false;

  // Extract this app's own package name + stem (e.g. `apex_3e9d1a` → stem `apex`).
  // The LLM frequently adds the stem as a dependency (`apex: ^1.0.0`) — those are
  // self-referential hallucinations and must be dropped without any network call.
  const ownName = pubText.match(/^name\s*:\s*([A-Za-z0-9_]+)/m)?.[1] || '';
  const ownStem = ownName.includes('_') ? ownName.replace(/_[^_]+$/, '') : '';

  for (const section of ['dependencies', 'dev_dependencies']) {
    const secRe = new RegExp(`^${section}:\\s*\\n((?:[ \\t]+.*\\n?)*)`, 'm');
    const depSection = cleaned.match(secRe);
    if (!depSection) continue;
    const names = [...depSection[1].matchAll(/^ {2}([A-Za-z0-9_]+)\s*:/gm)].map((m) => m[1]);
    for (const name of names) {
      if (name === 'flutter') continue;
      // Peek at the dep body: skip sdk/git hosted deps (never touch those).
      const body = (depSection[1].match(new RegExp(`^ {2}${name}\\s*:\\s*(.*)$`, 'm'))?.[1] || '').trim();
      if (!body || /^(sdk:|git:)/.test(body)) continue;
      // Inline `sdk:` on the next line (flutter_localizations style).
      const blockRe = new RegExp(`^ {2}${name}\\s*:\\s*\\n(?: {4}.*\\n?)*`, 'm');
      const block = depSection[1].match(blockRe)?.[0] || '';
      if (/sdk:|git:/.test(block)) continue;

      // Case 1: Self-stem dep — the LLM named the app `<stem>_<suffix>` and
      // then added `<stem>: ^x.y.z` as a dependency. Drop instantly.
      if (ownStem && name === ownStem) {
        const lineRe = new RegExp(`^ {2}${name}\\s*:\\s*(?:[^\\n]*\\n(?: {4}.*\\n?)*)?`, 'm');
        cleaned = cleaned.replace(lineRe, '');
        changed = true;
        dropped.push(name);
        broadcastLog(sessionId, `[build] Dropped self-stem dependency '${name}' — app is named '${ownName}', '${name}' is its own stem, not a real pub.dev package.`);
        continue;
      }

      // Case 4: local path dep — resolve relative to the project dir.
      const pathTarget =
        block.match(/^\s*path\s*:\s*['"]?([^'"\s]+)['"]?\s*$/m)?.[1] ||
        body.match(/^path\s*:\s*['"]?([^'"\s]+)['"]?$/)?.[1];
      if (pathTarget) {
        const absTarget = path.resolve(projectDir, pathTarget);
        if (!fs.existsSync(absTarget)) {
          const lineRe = new RegExp(`^ {2}${name}\\s*:\\s*(?:[^\\n]*\\n(?: {4}.*\\n?)*)?`, 'm');
          cleaned = cleaned.replace(lineRe, '');
          changed = true;
          dropped.push(name);
          broadcastLog(sessionId, `[build] Dropped dangling path dependency '${name}' (local path '${pathTarget}' does not exist).`);
        }
        continue;
      }
      if (/path:/.test(block)) continue; // points at something real — keep

      // Extract the version constraint: same-line (`apex: ^1.0.0`) or
      // expanded (`apex:\n    version: ^1.0.0`). Strip YAML trailing
      // comments FIRST — agent-written pins often carry them
      // (`apex: ^1.0.0   # Added missing dependency`), and the leftover
      // comment text made the constraint unparsable, so it was wrongly
      // kept "on uncertainty" and broke version solving downstream.
      let constraint = body.split('#')[0].trim();
      const versionLine = block.match(/^\s*version\s*:\s*['"]?([^'"\s]+)['"]?\s*$/m);
      if ((!constraint || constraint === '') && versionLine) constraint = versionLine[1].split('#')[0].trim();
      if (!constraint) continue; // map-form without version: hosted/git — keep

      let info = packageInfoCache.get(name);
      if (info === undefined) {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 5000);
          const r = await fetch(`https://pub.dev/api/packages/${name}`, { signal: ctrl.signal });
          clearTimeout(t);
          if (r.status === 404) {
            info = { exists: false, versions: [] };
          } else if (!r.ok) {
            info = null; // uncertain: never drop
          } else {
            const data = await r.json();
            const versions = Array.isArray(data?.versions) ? data.versions.map((v) => v.version).filter(Boolean) : [];
            info = { exists: true, versions };
          }
        } catch {
          info = null; // network blip: never drop on uncertainty
        }
        packageInfoCache.set(name, info);
      }
      if (info === null) continue;
      // Stable releases only: plain constraints ignore prereleases, same as pub.
      const stableVersions = info.versions.filter((v) => !/-/.test(v));

      let reason = null;
      if (!info.exists) {
        reason = 'not found on pub.dev';
      } else if (!stableVersions.some((v) => versionSatisfies(v, constraint))) {
        reason = `no published version satisfies '${constraint}' (latest: ${stableVersions[0] || 'none'})`;
      }
      if (reason) {
        const lineRe = new RegExp(`^ {2}${name}\\s*:\\s*(?:[^\\n]*\\n(?: {4}.*\\n?)*)?`, 'm');
        cleaned = cleaned.replace(lineRe, '');
        changed = true;
        dropped.push(name);
        broadcastLog(sessionId, `[build] Dropped unsatisfiable dependency '${name}: ${constraint}' (${reason}).`);
      }
    }
  }
  return { text: changed ? cleaned : pubText, dropped };
}

/**
 * Rewrites self-stem imports to the real package name. The generator names
 * every app `<stem>_<suffix>` (e.g. `apex_3e9d1a`) but the LLM frequently
 * imports its own files as `package:<stem>/...` (e.g. `package:apex/...`),
 * which can never resolve. For every imported stem X where the pubspec name
 * is `X_<suffix>` and X is NOT a declared dependency, rewrite the imports
 * in all Dart sources (generated build output excluded).
 */
function listDartFiles(dir, out = []) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === 'build' || e.name === '.dart_tool' || e.name === '.git') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) listDartFiles(full, out);
    else if (e.isFile() && e.name.endsWith('.dart')) out.push(full);
  }
  return out;
}

function fixSelfPackageImports(projectDir, sessionId) {
  const pubspecPath = path.join(projectDir, 'pubspec.yaml');
  if (!fs.existsSync(pubspecPath)) return 0;
  const pub = fs.readFileSync(pubspecPath, 'utf-8');
  const realName = pub.match(/^name\s*:\s*([A-Za-z0-9_]+)/m)?.[1];
  if (!realName || !realName.includes('_')) return 0;
  const declared = new Set([...pub.matchAll(/^ {2}([A-Za-z0-9_]+)\s*:/gm)].map((m) => m[1]));

  const dartFiles = listDartFiles(projectDir);
  const contents = new Map();
  const stems = new Set();
  for (const f of dartFiles) {
    let content = '';
    try {
      content = fs.readFileSync(f, 'utf-8');
    } catch {
      continue;
    }
    contents.set(f, content);
    for (const m of content.matchAll(/import\s+['"]package:([^/'"]+)\//g)) {
      stems.add(m[1]);
    }
  }

  let fixedFiles = 0;
  for (const stem of stems) {
    if (stem === realName) continue;
    if (!realName.startsWith(`${stem}_`)) continue;
    if (declared.has(stem)) continue; // genuinely depends on it — leave alone
    const from = `package:${stem}/`;
    const to = `package:${realName}/`;
    for (const [f, content] of contents) {
      if (!content.includes(from)) continue;
      const next = content.split(from).join(to);
      contents.set(f, next);
      try {
        fs.writeFileSync(f, next, 'utf-8');
        fixedFiles++;
      } catch {
        // read-only file — leave it; the compiler error will surface it
      }
    }
    broadcastLog(sessionId, `[build] Rewrote self-imports '${from}...' -> '${to}...' (LLM used the app stem instead of its package name).`);
  }
  return fixedFiles;
}

async function ensureFlutterSdk(sessionId) {
  let bin = findFlutterBinary();
  if (bin) return bin;

  broadcastLog(sessionId, '[sdk-setup] Searching for Flutter SDK...');

  // Check Homebrew cache for in-progress download
  const cacheDir = path.join(process.env.HOME || '', 'Library/Caches/Homebrew/downloads');
  let waitCount = 0;

  while (!bin && waitCount < 300) {
    bin = findFlutterBinary();
    if (bin) return bin;

    let downloadMsg = '';
    if (fs.existsSync(cacheDir)) {
      const files = fs.readdirSync(cacheDir);
      const flutterFile = files.find((f) => f.includes('flutter') && f.endsWith('.incomplete'));
      if (flutterFile) {
        const stats = fs.statSync(path.join(cacheDir, flutterFile));
        const mb = (stats.size / (1024 * 1024)).toFixed(1);
        const percent = Math.min(99, Math.round((stats.size / 2262108309) * 100));
        downloadMsg = ` (${mb} MB / 2,262 MB — ${percent}%)`;
      }
    }

    broadcastLog(sessionId, `[sdk-setup] Flutter SDK is downloading via Homebrew${downloadMsg}. Waiting for download to finish...`);
    await new Promise((r) => setTimeout(r, 6000));
    waitCount++;
  }

  bin = findFlutterBinary();
  if (!bin) {
    throw new Error('Flutter SDK download taking longer than expected. Please wait for Homebrew to finish, then click Retry Web Build.');
  }
  return bin;
}

function runCommand(cmd, args, cwd, sessionId) {
  return new Promise((resolve, reject) => {
    // Check if flutter executable is in PATH or Homebrew path
    const env = {
      ...process.env,
      PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin:/opt/homebrew/share/flutter/bin`,
    };

    const proc = spawn(cmd, args, { cwd, env });
    const sess = sessions.get(sessionId);
    if (sess) sess.proc = proc;

    proc.stdout.on('data', (d) => {
      const text = d.toString().trim();
      if (text) {
        text.split('\n').forEach((l) => broadcastLog(sessionId, l));
      }
    });

    proc.stderr.on('data', (d) => {
      const text = d.toString().trim();
      if (text) {
        text.split('\n').forEach((l) => broadcastLog(sessionId, l));
      }
    });

    proc.on('close', (code) => {
      const sess = sessions.get(sessionId);
      if (sess && sess.proc === proc) sess.proc = null;
      if (code === 0) resolve();
      else reject(new Error(`Command "${cmd} ${args.join(' ')}" exited with code ${code}`));
    });

    proc.on('error', (err) => reject(err));
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[local-compiler] Flutter Web compiler & server running at http://localhost:${PORT}`);
  console.log(`[local-compiler] Workspace preview directory: ${BASE_WORK_DIR}`);
});
