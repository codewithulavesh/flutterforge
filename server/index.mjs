#!/usr/bin/env node
import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCapabilities, getRuntimeInfo } from './harness/dsh.mjs';
import { runGeneration, resetProject, getProjectWorkspace, getProjectSnapshot } from './harness/run.mjs';
import { safeRelativePath } from './harness/workspace.mjs';
import { createPreviewService } from './preview.mjs';
import { runTerminalCommand } from './terminal.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const WEB_DIR = process.env.FLUTTERFORGE_WEB_DIR || path.resolve(HERE, '..', 'dist');
const MAX_BODY_BYTES = 64 * 1024 * 1024;
const preview = createPreviewService();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

/** @param {import('node:http').ServerResponse} res @param {number} status @param {Record<string, any>} body */
function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

/** @param {import('node:http').ServerResponse} res */
function applyCors(res, origin, requestHost) {
  // The harness is a loopback service with filesystem and command access.
  // Never reflect arbitrary Origin values: that would let any website use it
  // as a privileged localhost bridge.
  if (origin && isAllowedLocalOrigin(origin, requestHost)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function isAllowedLocalOrigin(origin, requestHost = '') {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname)) return false;
    // Accept same-origin packaged requests and the known Vite dev ports.
    const configured = (process.env.FLUTTERFORGE_ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean);
    return url.host === requestHost || ['5173', '5175'].includes(url.port) || configured.includes(origin);
  } catch {
    return false;
  }
}

/** @param {import('node:http').IncomingMessage} req */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    /** @type {Buffer[]} */
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body is too large (64 MiB limit).'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('Request body is not valid JSON.'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

/**
 * @param {import('node:http').ServerResponse} res
 * @returns {(type: string, data: Record<string, any>) => void}
 */
function openSse(res, origin) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': origin || '*',
  });
  res.flushHeaders?.();
  res.write(': FlutterForge harness stream\n\n');
  return (type, data) => {
    if (res.writableEnded) return;
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };
}

/**
 * @param {object} body
 * @returns {{ projectId: string, prompt: string, appId: string, usesSupabase: boolean, files: any[], fresh: boolean }}
 */
function normalizeStreamRequest(body) {
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) {
    throw Object.assign(new Error('prompt is required.'), { statusCode: 400 });
  }
  if (prompt.length > 60_000) {
    throw Object.assign(new Error('prompt exceeds the 60,000 character limit.'), { statusCode: 413 });
  }

  const projectId = typeof body.project_id === 'string' && body.project_id.trim()
    ? body.project_id.trim().slice(0, 160)
    : 'anonymous';

  const incomingFiles = Array.isArray(body.existing_files) ? body.existing_files : [];
  if (incomingFiles.length > 5000) {
    throw Object.assign(new Error('existing_files exceeds the 5,000 file limit.'), { statusCode: 413 });
  }
  for (const file of incomingFiles) {
    if (!file || typeof file.path !== 'string') continue;
    try {
      safeRelativePath(file.path);
    } catch (error) {
      throw Object.assign(new Error(error.message), { statusCode: 400 });
    }
  }

  const fresh = body.fresh === true
    || body.mode === 'new'
    || (body.mode !== 'edit' && body.is_initial_generation === true);

  const requestedAppId = typeof body.app_id === 'string'
    ? body.app_id
    : (typeof body.appId === 'string' ? body.appId : '');
  const appId = /^[a-z][a-z0-9_]{1,63}$/.test(requestedAppId) ? requestedAppId : '';
  const usesSupabase = body.uses_supabase === true;

  return { projectId, prompt, appId, usesSupabase, files: incomingFiles, fresh };
}

/**
 * Serve the built Vite app with SPA fallback. Missing `dist` is not an error in
 * development (Vite owns the UI), so return a short explanatory page.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
async function serveStatic(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    sendJson(res, 400, { error: 'Malformed URL.' });
    return;
  }

  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  let absolute = path.resolve(WEB_DIR, relative);
  if (absolute !== WEB_DIR && !absolute.startsWith(`${WEB_DIR}${path.sep}`)) {
    sendJson(res, 403, { error: 'Forbidden.' });
    return;
  }

  try {
    let stat = await fs.stat(absolute).catch(() => null);
    if (!stat || !stat.isFile()) {
      // SPA fallback for client-side routes.
      absolute = path.join(WEB_DIR, 'index.html');
      stat = await fs.stat(absolute).catch(() => null);
    }
    if (!stat || !stat.isFile()) {
      res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><title>FlutterForge</title><p>Web build not found. Run <code>npm run build</code> or use the Vite dev server.</p>');
      return;
    }

    const extension = path.extname(absolute).toLowerCase();
    const immutable = absolute.includes(`${path.sep}assets${path.sep}`);
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    const content = await fs.readFile(absolute);
    res.end(content);
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'Static file error.' });
  }
}

/** @param {string} pathname */
function routeProjectId(pathname) {
  const match = pathname.match(/^\/api\/harness\/session\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function handleRequest(req, res) {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
  applyCors(res, origin, req.headers.host || '');

  if (origin && !isAllowedLocalOrigin(origin, req.headers.host || '')) {
    sendJson(res, 403, { error: 'Origin is not allowed to access the local FlutterForge engine.' });
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // The UI polls this endpoint before starting a generation. Keep readiness
  // independent of the DSH CLI version probe (which can take several seconds
  // on a cold start); the stream route performs the runtime check itself.
  if (pathname === '/api/harness/health') {
    sendJson(res, 200, {
      ok: true,
      engine: 'deepseek-harness',
      pid: process.pid,
      uptime: Math.round(process.uptime()),
    });
    return;
  }

  if (pathname === '/health') {
    const runtime = await getRuntimeInfo();
    sendJson(res, 200, {
      ok: true,
      engine: 'deepseek-harness',
      runtime: { available: runtime.available, version: runtime.version },
      pid: process.pid,
      uptime: Math.round(process.uptime()),
    });
    return;
  }

  if (pathname === '/api/harness/capabilities') {
    sendJson(res, 200, await getCapabilities());
    return;
  }

  if (pathname === '/api/harness/stream' && req.method === 'POST') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, error.statusCode || 400, { error: error.message });
      return;
    }

    let normalized;
    try {
      normalized = normalizeStreamRequest(body);
    } catch (error) {
      sendJson(res, error.statusCode || 400, { error: error.message });
      return;
    }

    const runtime = await getRuntimeInfo();
    if (!runtime.available) {
      sendJson(res, 503, {
        error: 'DeepSeek Harness runtime is not available on this machine.',
        code: 'HARNESS_UNAVAILABLE',
        runtime,
      });
      return;
    }

    const emit = openSse(res, origin);
    const abortController = new AbortController();
    let finished = false;
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(': ping\n\n');
    }, 15_000);
    heartbeat.unref?.();

    res.on('close', () => {
      if (!finished) abortController.abort();
    });

    try {
      const history = Array.isArray(body.conversation_history)
        ? body.conversation_history
          .filter((message) => message && typeof message.content === 'string')
          .map((message) => ({ role: String(message.role || 'user'), content: message.content }))
          .slice(-20)
        : [];

      const result = await runGeneration({
        projectId: normalized.projectId,
        prompt: normalized.prompt,
        projectName: typeof body.project_name === 'string' ? body.project_name.slice(0, 120) : 'FlutterForgeApp',
        appId: normalized.appId,
        usesSupabase: normalized.usesSupabase,
        activeFile: typeof body.active_file === 'string' ? body.active_file.slice(0, 300) : '',
        buildErrors: Array.isArray(body.build_errors)
          ? body.build_errors.filter((line) => typeof line === 'string').slice(-8).map((line) => line.slice(0, 500))
          : [],
        projectDescription: typeof body.project_description === 'string' ? body.project_description.slice(0, 4000) : '',
        platform: typeof body.platform === 'string' ? body.platform.slice(0, 40) : 'web',
        stateManagement: typeof body.state_management === 'string' ? body.state_management.slice(0, 40) : 'provider',
        files: normalized.files,
        conversationHistory: history,
        isIncremental: body.mode === 'edit' || body.is_incremental === true,
        includeSqlMigrations: body.include_sql_migrations !== false,
        fresh: normalized.fresh,
        apiKey: typeof body.api_key === 'string' ? body.api_key : '',
        model: typeof body.model_name === 'string' ? body.model_name : '',
        signal: abortController.signal,
        emit,
      });

      finished = true;
      emit('done', {
        success: result.success,
        fileCount: result.files.length,
        sessionId: result.sessionId,
        workspace: result.workspace,
        summary: result.summary,
      });
    } catch (error) {
      finished = true;
      const message = error instanceof Error ? error.message : String(error);
      emit('error', {
        message,
        code: error?.code || 'HARNESS_ERROR',
      });
    } finally {
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
    }
    return;
  }

  const projectIdFromPath = routeProjectId(pathname);
  if (projectIdFromPath && req.method === 'GET') {
    try {
      const snapshot = await getProjectSnapshot(projectIdFromPath);
      sendJson(res, 200, {
        projectId: projectIdFromPath,
        workspace: snapshot.workspace,
        fileCount: snapshot.files.length,
        files: snapshot.files,
      });
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : 'Snapshot failed.' });
    }
    return;
  }

  if (projectIdFromPath && req.method === 'DELETE') {
    try {
      const workspace = await resetProject(projectIdFromPath);
      sendJson(res, 200, { ok: true, workspace });
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : 'Reset failed.' });
    }
    return;
  }

  if (pathname === '/api/harness/workspace' && req.method === 'GET') {
    const projectId = url.searchParams.get('project_id') || 'anonymous';
    sendJson(res, 200, { projectId, workspace: getProjectWorkspace(projectId) });
    return;
  }

  if (pathname === '/api/terminal/run' && req.method === 'POST') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, error.statusCode || 400, { error: error.message });
      return;
    }
    const result = await runTerminalCommand(
      typeof body.project_id === 'string' ? body.project_id : 'anonymous',
      typeof body.command === 'string' ? body.command : '',
    );
    sendJson(res, result.statusCode, result.body);
    return;
  }

  // ── Local Flutter web preview (same origin as the app) ──────────────────
  const previewBuild = pathname.match(/^\/api\/preview\/([^/]+)\/build\/?$/);
  if (previewBuild && req.method === 'POST') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, error.statusCode || 400, { error: error.message });
      return;
    }
    const result = await preview.startBuild(decodeURIComponent(previewBuild[1]), body.files, {
      supabaseUrl: body.supabaseUrl,
      supabaseAnonKey: body.supabaseAnonKey,
    });
    sendJson(res, result.statusCode, result.body);
    return;
  }

  const previewProjectStatus = pathname.match(/^\/api\/preview\/project\/([^/]+)\/status\/?$/);
  if (previewProjectStatus && req.method === 'GET') {
    const status = preview.statusForProject(decodeURIComponent(previewProjectStatus[1]));
    if (!status) {
      // "No session yet" is a normal state (every fresh project polls this on
      // entry) — answer 200 so the browser doesn't spam console errors.
      sendJson(res, 200, { ok: true, status: 'none' });
      return;
    }
    sendJson(res, 200, status);
    return;
  }

  const previewSessionStatus = pathname.match(/^\/api\/preview\/([^/]+)\/status\/?$/);
  if (previewSessionStatus && req.method === 'GET') {
    const status = preview.sessionStatus(decodeURIComponent(previewSessionStatus[1]));
    if (!status) {
      sendJson(res, 404, { error: 'Unknown preview session.' });
      return;
    }
    sendJson(res, 200, status);
    return;
  }

  const previewStop = pathname.match(/^\/api\/preview\/([^/]+)\/stop\/?$/);
  if (previewStop && req.method === 'POST') {
    const stopped = preview.stop(decodeURIComponent(previewStop[1]));
    sendJson(res, stopped ? 200 : 404, { ok: stopped });
    return;
  }

  if (pathname.startsWith('/preview/')) {
    if (await preview.serve(req, res, pathname)) return;
  }

  if (pathname.startsWith('/api/')) {
    sendJson(res, 404, { error: `Unknown API route: ${pathname}` });
    return;
  }

  await serveStatic(req, res);
}

const server = createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    if (res.headersSent) {
      res.end();
      return;
    }
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'Internal server error.' });
  });
});

server.on('error', (error) => {
  console.error(`flutterforge server error: ${error.code || error.message}`);
  process.exit(1);
});

server.listen(DEFAULT_PORT, HOST, () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : DEFAULT_PORT;
  // Electron's main process parses this exact line to discover the port.
  console.log(`flutterforge server: http://${HOST}:${port}`);
  console.log(`FlutterForge harness server listening on http://${HOST}:${port} (web dir: ${WEB_DIR})`);
});

function shutdown(signal) {
  console.log(`flutterforge server: stopping (${signal})`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
