#!/usr/bin/env node
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCapabilities, getRuntimeInfo } from './harness/dsh.js';
import { runGeneration, resetProject, getProjectWorkspace, getProjectSnapshot } from './harness/run.js';
import { analyzeProject } from './harness/analyze.js';
import { materializeFiles, safeRelativePath } from './harness/workspace.js';
import { createPreviewService } from './preview.js';
import { createPublishService } from './publish.js';
import { runTerminalCommand } from './terminal.js';
import {
  credentialSnapshot,
  getCredentialBundle,
  isProvider,
  removeCredential,
  seedCredentialsFromEnv,
  setCredential,
} from './credentials.js';
import { ECONOMY_MODEL, FRONTIER_MODEL, publicRoute, routeGeneration } from './routing.js';

seedCredentialsFromEnv();

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const WEB_DIR = process.env.FLUTTERFORGE_WEB_DIR || path.resolve(HERE, '..', 'dist');
const MAX_BODY_BYTES = 64 * 1024 * 1024;
const preview = createPreviewService();
const publish = createPublishService();

const MIME_TYPES: Record<string, string> = {
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

function sendJson(res: ServerResponse, status: number, body: Record<string, any>) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function applyCors(res: ServerResponse, origin: string, requestHost: string) {
  if (origin && isAllowedLocalOrigin(origin, requestHost)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function isAllowedLocalOrigin(origin: string, requestHost = '') {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname)) return false;
    const configured = (process.env.FLUTTERFORGE_ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean);
    return url.host === requestHost || ['5173', '5175'].includes(url.port) || configured.includes(origin);
  } catch {
    return false;
  }
}

function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
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

function openSse(res: ServerResponse, origin: string): (type: string, data: Record<string, any>) => void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': origin || '*',
  });
  (res as any).flushHeaders?.();
  res.write(': FlutterForge harness stream\n\n');
  return (type, data) => {
    if (res.writableEnded) return;
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };
}

function normalizeStreamRequest(body: any) {
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
    } catch (error: any) {
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

async function serveStatic(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  let pathname: string;
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
  } catch (error: any) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'Static file error.' });
  }
}

function routeProjectId(pathname: string): string | null {
  const match = pathname.match(/^\/api\/harness\/session\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
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

  if (pathname === '/api/credentials' && req.method === 'GET') {
    sendJson(res, 200, {
      credentials: credentialSnapshot(),
      routing: {
        frontier: { model: FRONTIER_MODEL },
        economy: { model: ECONOMY_MODEL },
        policy: 'frontier for planning/design/first pass, fast for edits and repairs',
      },
    });
    return;
  }

  if (pathname === '/api/credentials' && req.method === 'POST') {
    let body: any;
    try {
      body = await readJsonBody(req);
    } catch (error: any) {
      sendJson(res, error.statusCode || 400, { error: error.message });
      return;
    }
    try {
      if (!isProvider(body.provider)) {
        sendJson(res, 400, { error: 'provider must be "openrouter" or "deepseek".' });
        return;
      }
      setCredential(body.provider, body.key, 'session');
      sendJson(res, 200, { credentials: credentialSnapshot() });
    } catch (error: any) {
      sendJson(res, error.statusCode || 500, { error: error.message });
    }
    return;
  }

  const credentialDelete = pathname.match(/^\/api\/credentials\/([a-z]+)\/?$/);
  if (credentialDelete && req.method === 'DELETE') {
    try {
      if (!isProvider(credentialDelete[1])) {
        sendJson(res, 400, { error: 'Unknown credential provider.' });
        return;
      }
      removeCredential(credentialDelete[1]);
      sendJson(res, 200, { credentials: credentialSnapshot() });
    } catch (error: any) {
      sendJson(res, error.statusCode || 500, { error: error.message });
    }
    return;
  }

  if (pathname === '/api/harness/stream' && req.method === 'POST') {
    let body: any;
    try {
      body = await readJsonBody(req);
    } catch (error: any) {
      sendJson(res, error.statusCode || 400, { error: error.message });
      return;
    }

    let normalized: any;
    try {
      normalized = normalizeStreamRequest(body);
    } catch (error: any) {
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
    const route = routeGeneration({
      role: body.task_role,
      plan: body.plan,
      requestedModel: body.model_name,
      requestKey: typeof body.api_key === 'string' ? body.api_key : '',
      credentials: getCredentialBundle(),
    });
    emit('routing', publicRoute(route));
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
        designBrief: body.design_brief ?? null,
        fresh: normalized.fresh,
        apiKey: route.apiKey,
        model: route.model,
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
        route: publicRoute(route),
      });
    } catch (error: any) {
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

  const analyzeRoute = pathname.match(/^\/api\/analyze\/([^/]+)\/?$/);
  if (analyzeRoute && req.method === 'POST') {
    let body: any = {};
    try {
      body = await readJsonBody(req);
    } catch (error: any) {
      sendJson(res, error.statusCode || 400, { error: error.message });
      return;
    }
    try {
      const workspace = getProjectWorkspace(decodeURIComponent(analyzeRoute[1]));
      if (Array.isArray(body.files) && body.files.length > 0) {
        for (const file of body.files) {
          if (file && typeof file.path === 'string') safeRelativePath(file.path);
        }
        await materializeFiles(workspace, body.files);
      }
      const result = await analyzeProject(workspace, { timeoutMs: body.timeout_ms });
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : 'Compile gate failed.' });
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
    let body: any;
    try {
      body = await readJsonBody(req);
    } catch (error: any) {
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

  const previewBuild = pathname.match(/^\/api\/preview\/([^/]+)\/build\/?$/);
  if (previewBuild && req.method === 'POST') {
    let body: any;
    try {
      body = await readJsonBody(req);
    } catch (error: any) {
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

  const previewReload = pathname.match(/^\/api\/preview\/project\/([^/]+)\/reload\/?$/);
  if (previewReload && req.method === 'POST') {
    const result = preview.reload(decodeURIComponent(previewReload[1]));
    sendJson(res, result.statusCode, result.body);
    return;
  }

  if (pathname.startsWith('/preview/')) {
    if (await preview.serve(req, res, pathname)) return;
  }

  const publishBuild = pathname.match(/^\/api\/publish\/([^/]+)\/build\/?$/);
  if (publishBuild && req.method === 'POST') {
    let body: any;
    try {
      body = await readJsonBody(req);
    } catch (error: any) {
      sendJson(res, error.statusCode || 400, { error: error.message });
      return;
    }
    const result = await publish.startPublish(decodeURIComponent(publishBuild[1]), body.files, {
      target: body.target,
      supabaseUrl: body.supabaseUrl,
      supabaseAnonKey: body.supabaseAnonKey,
    });
    sendJson(res, result.statusCode, result.body);
    return;
  }

  const publishStatus = pathname.match(/^\/api\/publish\/project\/([^/]+)\/status\/?$/);
  if (publishStatus && req.method === 'GET') {
    const status = publish.statusForProject(decodeURIComponent(publishStatus[1]));
    sendJson(res, 200, status ?? { ok: true, status: 'none' });
    return;
  }

  const publishReport = pathname.match(/^\/api\/publish\/project\/([^/]+)\/report\/?$/);
  if (publishReport && req.method === 'GET') {
    try {
      const report = await fs.readFile(publish.reportForProject(decodeURIComponent(publishReport[1])), 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(report);
    } catch {
      sendJson(res, 404, { error: 'No build report yet. Publish the project first.' });
    }
    return;
  }

  const publishArtifact = pathname.match(/^\/api\/publish\/project\/([^/]+)\/artifact\/?$/);
  if (publishArtifact && req.method === 'GET') {
    const file = publish.artifactForProject(decodeURIComponent(publishArtifact[1]));
    if (!file) {
      sendJson(res, 404, { error: 'No downloadable artifact for this build.' });
      return;
    }
    try {
      const stat = await fs.stat(file);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Length': stat.size,
        'Content-Disposition': `attachment; filename="${path.basename(file)}"`,
      });
      createReadStream(file).pipe(res);
    } catch {
      sendJson(res, 404, { error: 'The built artifact is missing. Publish again.' });
    }
    return;
  }

  if (pathname.startsWith('/publish/')) {
    if (await publish.serve(req, res, pathname)) return;
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

server.on('error', (error: any) => {
  console.error(`flutterforge server error: ${error.code || error.message}`);
  process.exit(1);
});

server.listen(DEFAULT_PORT, HOST, () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : DEFAULT_PORT;
  console.log(`flutterforge server: http://${HOST}:${port}`);
  console.log(`FlutterForge harness server listening on http://${HOST}:${port} (web dir: ${WEB_DIR})`);
});

function shutdown(signal: string) {
  console.log(`flutterforge server: stopping (${signal})`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

