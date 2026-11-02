'use strict';

const { app, BrowserWindow, Menu, dialog, ipcMain, session, shell } = require('electron');
const { spawn } = require('node:child_process');
const { existsSync, writeFileSync } = require('node:fs');
const path = require('node:path');

app.setName('FlutterForge');

const isMac = process.platform === 'darwin';
const isWindows = process.platform === 'win32';
const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
const isDev = !app.isPackaged || process.env.FLUTTERFORGE_DEV === '1';

let mainWindow = null;
let serverProcess = null;
let serverUrl = null;
let ownsServer = false;
let quitting = false;

/** Resolve the harness server entry, preferring the unpacked copy in a build. */
function serverEntry() {
  const appPath = app.getAppPath();
  const unpacked = appPath.replace(/app\.asar$/, 'app.asar.unpacked');
  const candidates = [
    path.join(unpacked, 'server', 'index.mjs'),
    path.join(appPath, 'server', 'index.mjs'),
  ];
  return candidates.find((candidate) => existsSync(candidate)) || candidates[1];
}

/** Resolve the built renderer directory. */
function webDir() {
  const appPath = app.getAppPath();
  const unpacked = appPath.replace(/app\.asar$/, 'app.asar.unpacked');
  const candidates = [
    path.join(appPath, 'dist'),
    path.join(unpacked, 'dist'),
  ];
  return candidates.find((candidate) => existsSync(candidate)) || path.join(appPath, 'dist');
}

async function isServerUp(url) {
  try {
    const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1200) });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Start the local engine server. In a packaged app it serves the built UI and
 * the harness API from one origin; in development Vite serves the UI and
 * proxies /api to this server.
 */
function startServer({ port = 8787 } = {}) {
  return new Promise((resolve, reject) => {
    const entry = serverEntry();
    if (!existsSync(entry)) {
      reject(new Error(`Harness server entry not found at ${entry}`));
      return;
    }

    const child = spawn(process.execPath, [entry], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        PORT: String(port),
        HOST: '127.0.0.1',
        FLUTTERFORGE_WEB_DIR: webDir(),
        ...(app.isPackaged
          ? { FLUTTERFORGE_DATA_DIR: process.env.FLUTTERFORGE_DATA_DIR || path.join(app.getPath('userData'), '.flutterforge') }
          : {}),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    serverProcess = child;
    ownsServer = true;
    let settled = false;
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`Harness server did not start within 30s.\n${stdout}\n${stderr}`.slice(-2000)));
    }, 30_000);

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      const match = stdout.match(/flutterforge server: (http:\/\/\S+)/);
      if (match && !settled) {
        settled = true;
        clearTimeout(timer);
        serverUrl = match[1];
        console.log(`[desktop] engine ready at ${serverUrl}`);
        resolve(serverUrl);
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-4000);
      process.stderr.write(`[harness] ${chunk}`);
    });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on('exit', (code) => {
      serverProcess = null;
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`Harness server exited (code ${code}).\n${stderr}`.slice(-2000)));
      } else if (!quitting) {
        console.error(`[harness] server exited unexpectedly (code ${code})`);
      }
    });
  });
}

function applyProductionCsp() {
  if (isDev) return;
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https: wss: http://127.0.0.1:* http://localhost:*",
    "worker-src 'self' blob:",
    "frame-src 'self' http://127.0.0.1:* http://localhost:* https:",
  ].join('; ');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });
}

async function ensureServer() {
  if (isDev) {
    // Reuse a developer-started `npm run server` when one is already listening.
    if (await isServerUp('http://127.0.0.1:8787')) {
      serverUrl = 'http://127.0.0.1:8787';
      ownsServer = false;
      return serverUrl;
    }
    return startServer({ port: 8787 });
  }
  // Packaged: keep a stable origin so localStorage (Supabase session,
  // preferences) survives relaunches. Fall back through a small port range.
  for (let port = 17878; port < 17888; port += 1) {
    try {
      return await startServer({ port });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/EADDRINUSE|exited \(code 1\)/i.test(message)) throw error;
    }
  }
  // Last resort: ephemeral port (session persistence may reset for this run).
  return startServer({ port: 0 });
}

function sendMenuAction(action) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('menu:action', action);
  }
}

function buildMenu() {
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Project', accelerator: 'CmdOrCtrl+N', click: () => sendMenuAction('new-project') },
        { label: 'Dashboard', accelerator: 'CmdOrCtrl+Shift+D', click: () => sendMenuAction('dashboard') },
        { type: 'separator' },
        { label: 'Export Project…', accelerator: 'CmdOrCtrl+Shift+E', click: () => sendMenuAction('export') },
        { label: 'Open Project Folder', click: () => sendMenuAction('open-folder') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Workspace',
      submenu: [
        { label: 'AI Builder', accelerator: 'CmdOrCtrl+1', click: () => sendMenuAction('ai-builder') },
        { label: 'Preview', accelerator: 'CmdOrCtrl+2', click: () => sendMenuAction('preview') },
        { label: 'Files', accelerator: 'CmdOrCtrl+3', click: () => sendMenuAction('files') },
        { label: 'Code', accelerator: 'CmdOrCtrl+4', click: () => sendMenuAction('code') },
        { label: 'Terminal', accelerator: 'CmdOrCtrl+5', click: () => sendMenuAction('terminal') },
        { type: 'separator' },
        { label: 'Dependencies', click: () => sendMenuAction('dependencies') },
        { label: 'Versions', click: () => sendMenuAction('versions') },
        { label: 'Settings', accelerator: 'CmdOrCtrl+,', click: () => sendMenuAction('settings') },
        { label: 'Export', click: () => sendMenuAction('export') },
        { type: 'separator' },
        { label: 'Toggle Bottom Panel', accelerator: 'CmdOrCtrl+J', click: () => sendMenuAction('toggle-bottom-panel') },
      ],
    },
    {
      label: 'Chat',
      submenu: [
        { label: 'New Chat', accelerator: 'CmdOrCtrl+Shift+N', click: () => sendMenuAction('new-chat') },
        { label: 'Focus Composer', accelerator: 'CmdOrCtrl+L', click: () => sendMenuAction('focus-composer') },
        { type: 'separator' },
        { label: 'Retry Last Response', click: () => sendMenuAction('retry-last') },
        { label: 'Copy Last Response', click: () => sendMenuAction('copy-last') },
        { label: 'Stop Generation', accelerator: 'CmdOrCtrl+.', click: () => sendMenuAction('stop-generation') },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' },
        { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' }, { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : [])],
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Keyboard shortcuts',
          click: () => sendMenuAction('shortcuts'),
        },
        {
          label: 'DeepSeek Harness documentation',
          click: () => shell.openExternal('https://github.com/deepseek-ai/deepseek-harness'),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1040,
    minHeight: 700,
    show: false,
    backgroundColor: '#0b0b0f',
    title: 'FlutterForge',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: isMac ? { x: 16, y: 18 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = [serverUrl, DEV_URL].filter(Boolean);
    if (!allowed.some((base) => url.startsWith(base))) {
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });

  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  const target = isDev ? DEV_URL : serverUrl;
  if (!target) throw new Error('No renderer URL resolved.');
  mainWindow.loadURL(target).catch((error) => {
    console.error('[desktop] failed to load renderer:', error);
  });

  if (process.env.FLUTTERFORGE_SMOKE === '1') {
    mainWindow.webContents.once('did-finish-load', () => {
      runSmokeTest(mainWindow).catch((error) => {
        console.error('[smoke] failed:', error);
        app.exit(1);
      });
    });
  }

  return mainWindow;
}

/**
 * Headless-ish CI check: wait for React, capture a screenshot, print a small
 * JSON summary, then quit. Enabled only with FLUTTERFORGE_SMOKE=1.
 */
async function runSmokeTest(window) {
  await new Promise((resolve) => setTimeout(resolve, 3500));
  const forcedTheme = process.env.FLUTTERFORGE_SMOKE_THEME;
  if (forcedTheme === 'dark' || forcedTheme === 'light') {
    await window.webContents.executeJavaScript(`localStorage.setItem('ff-theme', '${forcedTheme}');`);
    await new Promise((resolve) => {
      window.webContents.once('did-finish-load', resolve);
      window.webContents.reloadIgnoringCache();
    });
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  const info = await window.webContents.executeJavaScript(`(async () => {
    let health = null;
    try {
      health = await fetch('/api/harness/health').then((response) => response.json());
    } catch (error) {
      health = { error: String(error) };
    }
    return {
      title: document.title,
      rootChildren: document.getElementById('root')?.childElementCount ?? 0,
      text: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 240),
      theme: document.documentElement.getAttribute('data-theme'),
      desktopBridge: Boolean(window.flutterforgeDesktop),
      health,
    };
  })()`);
  const target = process.env.FLUTTERFORGE_SMOKE_OUT || path.join(process.cwd(), '.tmp', 'desktop-smoke.png');
  try {
    const image = await window.webContents.capturePage();
    writeFileSync(target, image.toPNG());
  } catch (error) {
    console.error('[smoke] screenshot failed:', error);
  }
  console.log(`[smoke] ${JSON.stringify({ ...info, screenshot: target, serverUrl, isDev })}`);
  app.quit();
}

function registerIpc() {
  ipcMain.handle('desktop:info', () => ({
    isDesktop: true,
    platform: process.platform,
    arch: process.arch,
    version: app.getVersion(),
    isDev,
    serverUrl,
    engine: 'deepseek-harness',
  }));

  ipcMain.handle('desktop:pick-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose where FlutterForge should keep generated apps',
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  const isWorkspacePath = (target) => {
    const resolved = path.resolve(target);
    const roots = [
      process.env.FLUTTERFORGE_WORKSPACES,
      path.join(app.getPath('userData'), '.flutterforge', 'workspaces'),
      path.join(app.getAppPath(), '.flutterforge', 'workspaces'),
    ].filter(Boolean).map((root) => path.resolve(root));
    return roots.some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`));
  };
  const isTrustedRenderer = (event) => {
    const frameUrl = event.senderFrame?.url || '';
    try {
      const frameOrigin = new URL(frameUrl).origin;
      return [serverUrl, DEV_URL].filter(Boolean).some((base) => new URL(base).origin === frameOrigin);
    } catch {
      return false;
    }
  };

  ipcMain.handle('desktop:open-path', async (event, target) => {
    if (!isTrustedRenderer(event)) return { ok: false, error: 'Untrusted renderer.' };
    if (typeof target !== 'string' || target.trim() === '') return { ok: false, error: 'Invalid path.' };
    const resolved = path.resolve(target);
    if (!isWorkspacePath(resolved)) return { ok: false, error: 'Only FlutterForge workspace paths can be opened.' };
    if (!existsSync(resolved)) return { ok: false, error: 'Path does not exist.' };
    const error = await shell.openPath(resolved);
    return error ? { ok: false, error } : { ok: true };
  });

  ipcMain.handle('desktop:show-item', (event, target) => {
    if (!isTrustedRenderer(event)) return false;
    if (typeof target !== 'string' || target.trim() === '') return false;
    const resolved = path.resolve(target);
    if (!isWorkspacePath(resolved)) return false;
    shell.showItemInFolder(resolved);
    return true;
  });

  ipcMain.handle('desktop:harness-health', async () => {
    if (!serverUrl) return { ok: false, error: 'Harness server is not running.' };
    try {
      const response = await fetch(`${serverUrl}/api/harness/health`, { signal: AbortSignal.timeout(3000) });
      return { ok: response.ok, status: response.status, body: await response.json().catch(() => null) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}

function stopServer() {
  if (!serverProcess || !ownsServer) return;
  quitting = true;
  const child = serverProcess;
  serverProcess = null;
  try {
    if (isWindows) spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], { windowsHide: true });
    else child.kill('SIGTERM');
  } catch {
    // best effort
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    app.setAboutPanelOptions({
      applicationName: 'FlutterForge',
      applicationVersion: app.getVersion(),
      copyright: 'FlutterForge — DeepSeek Harness engine',
    });
    try {
      await ensureServer();
      applyProductionCsp();
      registerIpc();
      buildMenu();
      createWindow();
    } catch (error) {
      dialog.showErrorBox(
        'FlutterForge could not start',
        `${error instanceof Error ? error.message : String(error)}\n\nMake sure DeepSeek Harness is installed (or set DSH_BIN) and port 8787 is free.`,
      );
      app.quit();
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        if (serverUrl) {
          createWindow();
          return;
        }
        ensureServer().then(createWindow).catch((error) => {
          console.error('[desktop] activate failed:', error);
        });
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});

app.on('before-quit', () => {
  quitting = true;
  stopServer();
});

process.on('exit', stopServer);
