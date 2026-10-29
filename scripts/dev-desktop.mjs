#!/usr/bin/env node
/**
 * One-command desktop development:
 *   1. Vite dev server on :5173
 *   2. Electron main process, which starts the harness engine on :8787
 *
 * The engine server is owned by Electron, so closing the app stops it. If a
 * developer already runs `npm run server`, Electron reuses it.
 */
import { spawn } from 'node:child_process';
import process from 'node:process';

const isWindows = process.platform === 'win32';
const VITE_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
const children = [];

function run(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: isWindows,
    ...options,
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const child of children) {
    try {
      child.kill('SIGTERM');
    } catch {
      // already gone
    }
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));

async function waitForVite(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

const viteBin = isWindows ? 'node_modules/.bin/vite.cmd' : 'node_modules/.bin/vite';
const vite = run(viteBin, ['--port', '5173'], { env: { ...process.env, BROWSER: 'none' } });
vite.on('exit', (code) => {
  if (code && code !== 0) shutdown(code);
});

if (!(await waitForVite(VITE_URL))) {
  console.error(`[dev:desktop] Vite did not start at ${VITE_URL}`);
  shutdown(1);
}

// `electron`'s main export is the executable path.
const { default: electronPath } = await import('electron');
const electronEnv = { ...process.env, FLUTTERFORGE_DEV: '1', VITE_DEV_SERVER_URL: VITE_URL };
// A harness/CI shell may export ELECTRON_RUN_AS_NODE=1; that turns Electron into
// a plain Node process, so strip it before launching the desktop shell.
delete electronEnv.ELECTRON_RUN_AS_NODE;
const electron = run(electronPath, ['.'], {
  shell: false,
  env: electronEnv,
});

electron.on('exit', (code) => shutdown(code ?? 0));
