// E2E probe: replicate the frontend preview-build flow against the live engine.
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const PROJECT = process.argv[2] || '04b051db-8271-4b12-a6f0-918a2a7f834d';
const BASE = 'http://127.0.0.1:8787';
const WS = path.join(process.env.HOME, '.flutterforge', 'workspaces', PROJECT);
const SKIP = new Set(['.dart_tool', 'build', '.git', 'node_modules', '.flutterforge-pubspec-hash', '.flutterforge', '.dsh', '.idea', '.vscode']);

async function walk(dir, acc = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, acc);
    else {
      const info = await stat(full);
      if (info.size > 512 * 1024) continue; // mirror client cap
      acc.push({ path: path.relative(WS, full), content: await readFile(full, 'utf8') });
    }
  }
  return acc;
}

const files = await walk(WS);
console.log(`posting ${files.length} files (${files.reduce((n, f) => n + f.content.length, 0)} bytes)`);

const t0 = Date.now();
const buildRes = await fetch(`${BASE}/api/preview/${PROJECT}/build`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ files, userId: PROJECT }),
});
const buildBody = await buildRes.text();
console.log(`build POST → HTTP ${buildRes.status} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(buildBody.slice(0, 300));

let sessionId = null;
try { sessionId = JSON.parse(buildBody).sessionId; } catch {}
if (!sessionId) {
  console.log('no sessionId — build endpoint did not accept the job');
  process.exit(1);
}

// Poll like the client does (1.5s cadence, up to 8 min)
for (let i = 0; i < 320; i++) {
  await new Promise((r) => setTimeout(r, 1500));
  const s = await fetch(`${BASE}/api/preview/${sessionId}/status`);
  const st = await s.text();
  let data;
  try { data = JSON.parse(st); } catch { console.log(`poll ${i}: unparseable (${s.status}) ${st.slice(0, 120)}`); continue; }
  const tail = (data.logs || []).slice(-1)[0] || '';
  if (data.status !== (globalThis.__last ?? '')) {
    globalThis.__last = data.status;
    console.log(`poll ${i}: status=${data.status} port=${data.port ?? '-'} ${tail.slice(0, 100)}`);
  }
  if (['running', 'failed', 'stopped'].includes(data.status)) {
    console.log(`final: ${JSON.stringify({ status: data.status, url: data.url, publicUrl: data.publicUrl, port: data.port }, null, 1)}`);
    console.log('last logs:\n' + (data.logs || []).slice(-6).join('\n'));
    break;
  }
}
