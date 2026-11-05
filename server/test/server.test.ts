import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const FIXTURE = path.join(HERE, 'fixture-dsh.ts');
const FLUTTER_FIXTURE = path.join(HERE, 'fixture-flutter.ts');

let server: ChildProcess;
let baseUrl: string;
let tmp: string;

function parseSse(text: string) {
  const events: Array<{ type: string; data: any }> = [];
  for (const chunk of text.split(/\r?\n\r?\n/)) {
    let type = 'message';
    const data: string[] = [];
    for (const line of chunk.split(/\r?\n/)) {
      if (line.startsWith('event: ')) type = line.slice(7).trim();
      else if (line.startsWith('data: ')) data.push(line.slice(6));
    }
    if (data.length === 0) continue;
    try {
      events.push({ type, data: JSON.parse(data.join('\n')) });
    } catch {
      // ignore malformed
    }
  }
  return events;
}

async function waitForServer(child: ChildProcess, timeoutMs = 20_000): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => reject(new Error(`server did not start:\n${buffer}`)), timeoutMs);
    child.stdout!.on('data', (chunk) => {
      buffer += chunk.toString();
      const match = buffer.match(/flutterforge server: (http:\/\/\S+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    child.stderr!.on('data', (chunk) => {
      buffer += chunk.toString();
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`server exited early (${code}):\n${buffer}`));
    });
  });
}

async function postStream(body: Record<string, any>) {
  const response = await fetch(`${baseUrl}/api/harness/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { response, events: parseSse(text) };
}

test.before(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'flutterforge-test-'));
  await fs.chmod(FIXTURE, 0o755);
  await fs.chmod(FLUTTER_FIXTURE, 0o755);

  server = spawn(process.execPath, ['--import', 'tsx/esm', path.join(ROOT, 'server', 'index.ts')], {
    env: {
      ...process.env,
      PORT: '0',
      HOST: '127.0.0.1',
      DSH_BIN: FIXTURE,
      DSH_HOME: path.join(tmp, 'dsh-home'),
      FLUTTERFORGE_WORKSPACES: path.join(tmp, 'workspaces'),
      FLUTTERFORGE_PREVIEWS: path.join(tmp, 'previews'),
      FLUTTERFORGE_PUBLISH: path.join(tmp, 'publish'),
      FLUTTER_BIN: FLUTTER_FIXTURE,
      FLUTTERFORGE_HARNESS_TIMEOUT_MS: '30000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  baseUrl = await waitForServer(server);
});

test.after(async () => {
  server?.kill('SIGTERM');
  if (tmp) await fs.rm(tmp, { recursive: true, force: true });
});

test('health reports the harness engine', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  const body: any = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.engine, 'deepseek-harness');
  assert.equal(body.runtime.version, '9.9.9-fixture');
});

test('stream generates files and projects SSE events', async () => {
  const { response, events } = await postStream({
    prompt: 'Build a fixture app',
    project_id: 'project-one',
    project_name: 'FixtureApp',
    mode: 'new',
    existing_files: [],
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/);

  const fileEvents = events.filter((event) => event.type === 'file_ready');
  assert.deepEqual(fileEvents.map((event) => event.data.path).sort(), ['lib/main.dart', 'pubspec.yaml']);
  assert.ok(
    fileEvents.every((event) => !event.data.path.startsWith('/') && !event.data.path.includes('..')),
    'file_ready paths must stay workspace-relative',
  );

  const validation = events.find((event) => event.type === 'validation');
  assert.ok(validation);
  assert.equal(validation.data.is_valid, true);

  const done = events.find((event) => event.type === 'done');
  assert.ok(done);
  assert.equal(done.data.success, true);
  assert.equal(done.data.fileCount, 2);

  const workspace = path.join(tmp, 'workspaces', 'project-one');
  assert.equal(await fs.readFile(path.join(workspace, 'lib', 'main.dart'), 'utf8').then((text) => text.includes('Fixture OK')), true);
  assert.equal(await fs.readFile(path.join(workspace, 'pubspec.yaml'), 'utf8').then((text) => text.includes('fixture_app')), true);
  assert.equal(await fs.readFile(path.join(workspace, 'AGENTS.md'), 'utf8').then((text) => text.includes('FlutterForge')), true);
});

test('pins the requested package name into the generated pubspec', async () => {
  const { events } = await postStream({
    prompt: 'Build a fixture app',
    project_id: 'project-package',
    project_name: 'FixtureApp',
    mode: 'new',
    app_id: 'fixture_ab12cd',
    uses_supabase: false,
    existing_files: [],
  });
  const done = events.find((event) => event.type === 'done');
  assert.ok(done);
  assert.equal(done.data.success, true);

  const workspace = path.join(tmp, 'workspaces', 'project-package');
  const pubspec = await fs.readFile(path.join(workspace, 'pubspec.yaml'), 'utf8');
  assert.match(pubspec, /^name: fixture_ab12cd$/m);
});

test('edit mode reuses the persisted session and keeps the project', async () => {
  const readResponse = await fetch(`${baseUrl}/api/harness/session/project-one`);
  assert.equal(readResponse.status, 200);
  const snapshot: any = await readResponse.json();
  assert.equal(snapshot.fileCount >= 2, true);

  const { events } = await postStream({
    prompt: 'Add a counter to the fixture app',
    project_id: 'project-one',
    project_name: 'FixtureApp',
    mode: 'edit',
    existing_files: snapshot.files.map((file: any) => ({ path: file.path, content: file.content })),
  });
  const done = events.find((event) => event.type === 'done');
  assert.ok(done);
  assert.equal(done.data.success, true);
});

test('rejects a path escape before opening the stream', async () => {
  const response = await fetch(`${baseUrl}/api/harness/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'escape',
      project_id: 'project-two',
      mode: 'new',
      existing_files: [{ path: '../../etc/passwd', content: 'x' }],
    }),
  });
  assert.equal(response.status, 400);
  const body: any = await response.json();
  assert.match(body.error, /escapes the workspace/);
});

test('terminal runs real allow-listed commands in the project workspace', async () => {
  const pwd = await fetch(`${baseUrl}/api/terminal/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: 'project-one', command: 'pwd' }),
  });
  assert.equal(pwd.status, 200);
  const pwdBody: any = await pwd.json();
  assert.match(pwdBody.output, /project-one/);

  const cat = await fetch(`${baseUrl}/api/terminal/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: 'project-one', command: 'cat pubspec.yaml' }),
  });
  assert.equal(cat.status, 200);
  const catBody: any = await cat.json();
  assert.match(catBody.output, /fixture_app/);

  const forbidden = await fetch(`${baseUrl}/api/terminal/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: 'project-one', command: 'rm -rf .' }),
  });
  assert.equal(forbidden.status, 400);
});

test('preview compiler builds and serves the app from the same origin', async () => {
  const files = [
    { path: 'pubspec.yaml', content: 'name: preview_app\n' },
    { path: 'lib/main.dart', content: 'void main() {}\n' },
  ];
  const start = await fetch(`${baseUrl}/api/preview/project-preview/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  });
  assert.equal(start.status, 202);
  const started: any = await start.json();
  assert.ok(started.sessionId);

  let status: any = null;
  for (let attempt = 0; attempt < 100; attempt++) {
    const response = await fetch(`${baseUrl}/api/preview/project/project-preview/status`);
    if (response.ok) status = await response.json();
    if (status?.status === 'running' || status?.status === 'failed') break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(status?.status, 'running', status?.logs?.slice(-5).join('\n'));

  const page = await fetch(`${baseUrl}/preview/project-preview/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /PREVIEW_OK/);

  const stop = await fetch(`${baseUrl}/api/preview/${started.sessionId}/stop`, { method: 'POST' });
  assert.equal(stop.status, 200);
});

test('frontier loop routes generation, downgrades honestly, and never leaks the key', async () => {
  await fetch(`${baseUrl}/api/credentials/openrouter`, { method: 'DELETE' });
  await fetch(`${baseUrl}/api/credentials/deepseek`, { method: 'DELETE' });

  const free = await postStream({
    prompt: 'Build a routed app',
    project_id: 'project-routing',
    project_name: 'RouteApp',
    mode: 'new',
    existing_files: [],
    task_role: 'frontier',
    plan: 'free',
  });
  assert.equal(free.response.status, 200);
  const freeRoute = free.events.find((event) => event.type === 'routing');
  assert.equal(freeRoute?.data.role, 'economy');
  assert.equal(freeRoute?.data.downgraded, true);
  assert.equal(freeRoute?.data.apiKey, undefined);
  const freeDone = free.events.find((event) => event.type === 'done');
  assert.equal(freeDone?.data.route.role, 'economy');

  const saved = await fetch(`${baseUrl}/api/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'openrouter', key: 'sk-or-test-key-1234' }),
  });
  assert.equal(saved.status, 200);
  const snapshot: any = await saved.json();
  assert.equal(snapshot.credentials.openrouter.configured, true);
  assert.equal(JSON.stringify(snapshot).includes('sk-or-test-key-1234'), false);

  const frontier = await postStream({
    prompt: 'Build a routed app',
    project_id: 'project-routing',
    project_name: 'RouteApp',
    mode: 'edit',
    existing_files: [],
    task_role: 'frontier',
    plan: 'pro',
  });
  assert.equal(frontier.response.status, 200);
  const frontierRoute = frontier.events.find((event) => event.type === 'routing');
  assert.equal(frontierRoute?.data.role, 'frontier');
  assert.equal(frontierRoute?.data.provider, 'openrouter');
  assert.match(String(frontierRoute?.data.model), /nemotron-3-ultra/);
  assert.equal(frontierRoute?.data.downgraded, false);
  assert.equal(JSON.stringify(frontier.events).includes('sk-or-test-key-1234'), false);

  await fetch(`${baseUrl}/api/credentials/openrouter`, { method: 'DELETE' });
});

test('reset deletes the project workspace', async () => {
  const response = await fetch(`${baseUrl}/api/harness/session/project-one`, { method: 'DELETE' });
  assert.equal(response.status, 200);

  const snapshotResponse = await fetch(`${baseUrl}/api/harness/session/project-one`);
  const snapshot: any = await snapshotResponse.json();
  assert.equal(snapshot.fileCount, 0);
});

test('publish builds a web bundle, hosts it, and writes a build report', async () => {
  const files = [
    { path: 'pubspec.yaml', content: 'name: publish_app\n' },
    { path: 'lib/main.dart', content: 'void main() {}\n' },
  ];
  const start = await fetch(`${baseUrl}/api/publish/project-publish/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files, target: 'web' }),
  });
  assert.equal(start.status, 202);
  assert.equal(((await start.json()) as any).status, 'building');

  let status: any = null;
  for (let attempt = 0; attempt < 100; attempt++) {
    const response = await fetch(`${baseUrl}/api/publish/project/project-publish/status`);
    status = await response.json();
    if (status.status === 'succeeded' || status.status === 'failed') break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(status?.status, 'succeeded', status?.logs?.slice(-6).join('\n'));
  assert.equal(status.report.target, 'web');
  assert.match(status.report.publicPath, /^\/publish\/project-publish\/$/);
  assert.ok(status.report.artifact.bytes > 0);

  const page = await fetch(`${baseUrl}/publish/project-publish/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /PREVIEW_OK/);

  const reportResponse = await fetch(`${baseUrl}/api/publish/project/project-publish/report`);
  assert.equal(reportResponse.status, 200);
  const report: any = await reportResponse.json();
  assert.equal(report.status, 'succeeded');

  const artifact = await fetch(`${baseUrl}/api/publish/project/project-publish/artifact`);
  assert.equal(artifact.status, 404);
});

