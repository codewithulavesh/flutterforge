'use strict';

/**
 * Visual QA capture for the live preview.
 *
 * Flutter web paints into a canvas, so the renderer cannot inspect the iframe.
 * This module loads the preview in hidden Chromium windows at real device
 * sizes, captures a PNG, reads the Flutter semantics tree, and runs cheap
 * pixel checks (blank screen, flat contrast, RenderFlex overflow stripes).
 * Everything stays on the machine; only the screenshots live in the app data
 * directory.
 */

const { BrowserWindow } = require('electron');
const { promises: fs } = require('node:fs');
const path = require('node:path');

const DEVICES = [
  { label: 'Mobile', width: 393, height: 852 },
  { label: 'Tablet', width: 1024, height: 1366 },
  { label: 'Desktop', width: 1440, height: 900 },
];

const READY_TIMEOUT_MS = 30_000;
const SETTLE_MS = 2_600;
const MAX_SEMANTICS = 40;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Only local preview origins are eligible for capture. */
function resolvePreviewUrl(raw, base) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('A preview URL is required.');
  let url;
  try {
    url = new URL(raw, base || undefined);
  } catch {
    throw new Error('The preview URL is not valid.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http(s) previews can be captured.');
  }
  const host = url.hostname.toLowerCase();
  const local = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  if (!local) throw new Error('Visual QA only captures previews served from this machine.');
  return url.toString();
}

function sanitizeSegment(value, fallback) {
  return String(value || fallback).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || fallback;
}

/** Wait until Flutter has attached its view and painted at least one frame. */
async function waitForFlutter(webContents) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const ready = await webContents
      .executeJavaScript(`(() => {
        if (document.readyState !== 'complete') return false;
        const view = document.querySelector('flutter-view, flt-glass-pane, #flutter');
        const canvas = document.querySelector('canvas');
        return Boolean(view && canvas);
      })()`)
      .catch(() => false);
    if (ready) return true;
    await delay(350);
  }
  return false;
}

/** Read the accessibility tree Flutter exposes as DOM nodes. */
async function readSemantics(webContents) {
  try {
    const nodes = await webContents.executeJavaScript(`(async () => {
      const placeholder = document.querySelector('flt-semantics-placeholder');
      if (placeholder) placeholder.click();
      await new Promise((resolve) => setTimeout(resolve, 700));
      const host = document.querySelector('flt-semantics-host') || document;
      return [...host.querySelectorAll('flt-semantics')]
        .map((node) => {
          const rect = node.getBoundingClientRect();
          const label = (node.getAttribute('aria-label') || node.textContent || '').replace(/\\s+/g, ' ').trim();
          return {
            role: node.getAttribute('role') || 'element',
            label: label.slice(0, 90),
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        })
        .filter((node) => node.label || node.role === 'button' || node.role === 'textbox');
    })()`);
    // Flutter repeats labels across nested nodes; keep the first of each.
    const seen = new Set();
    return (Array.isArray(nodes) ? nodes : [])
      .filter((node) => {
        const key = `${node.role}|${node.label}|${node.x}|${node.y}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, MAX_SEMANTICS);
  } catch {
    return [];
  }
}

/**
 * Cheap pixel heuristics over a BGRA bitmap. These are deliberately limited:
 * they catch a broken/blank canvas, unreadable flat screens, and Flutter's
 * yellow overflow stripe. Layout judgement still belongs to the screenshots.
 */
function analyzeBitmap(image) {
  const { width, height } = image.getSize();
  const bitmap = image.toBitmap();
  const total = Math.max(1, Math.floor(bitmap.length / 4));
  const stride = 7;
  let samples = 0;
  let sum = 0;
  let sumSq = 0;
  let yellow = 0;
  /** @type {Map<number, number>} */
  const colors = new Map();

  for (let pixel = 0; pixel < total; pixel += stride) {
    const index = pixel * 4;
    const blue = bitmap[index];
    const green = bitmap[index + 1];
    const red = bitmap[index + 2];
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    sum += luminance;
    sumSq += luminance * luminance;
    samples += 1;
    if (red > 200 && green > 170 && blue < 100 && Math.abs(red - green) < 80) yellow += 1;
    const key = ((red >> 4) << 8) | ((green >> 4) << 4) | (blue >> 4);
    colors.set(key, (colors.get(key) || 0) + 1);
  }

  const mean = samples ? sum / samples : 0;
  const variance = samples ? Math.max(0, sumSq / samples - mean * mean) : 0;
  const dominant = samples ? Math.max(...colors.values()) / samples : 0;
  const yellowShare = samples ? yellow / samples : 0;

  const issues = [];
  if (dominant > 0.985) {
    issues.push('The screen is almost one flat color — the app may not have painted.');
  } else if (Math.sqrt(variance) < 6) {
    issues.push('Very low contrast across the screen — content may be unreadable.');
  }
  if (yellowShare > 0.002) {
    issues.push('Yellow overflow stripe detected — a widget is overflowing its bounds.');
  }

  return {
    width,
    height,
    meanLuminance: Math.round(mean * 10) / 10,
    contrast: Math.round(Math.sqrt(variance) * 10) / 10,
    dominantShare: Math.round(dominant * 1000) / 1000,
    yellowShare: Math.round(yellowShare * 1000) / 1000,
    issues,
  };
}

/**
 * @param {{ url: string, baseUrl?: string, projectId?: string, outputRoot: string }} input
 */
async function captureScreens(input) {
  const target = resolvePreviewUrl(input.url, input.baseUrl);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const directory = path.join(
    input.outputRoot,
    sanitizeSegment(input.projectId, 'project'),
    stamp,
  );
  await fs.mkdir(directory, { recursive: true });

  /** @type {Array<Record<string, unknown>>} */
  const captures = [];
  /** @type {Array<{role: string, label: string, x: number, y: number, width: number, height: number}>} */
  let semantics = [];

  for (const device of DEVICES) {
    const window = new BrowserWindow({
      show: false,
      width: device.width,
      height: device.height,
      useContentSize: true,
      backgroundColor: '#0b0b0f',
      webPreferences: {
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: false,
      },
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));

    try {
      await window.loadURL(target);
      const ready = await waitForFlutter(window.webContents);
      await delay(SETTLE_MS);
      const image = await window.webContents.capturePage();
      const png = image.toPNG();
      const file = path.join(directory, `${sanitizeSegment(device.label.toLowerCase(), 'device')}-${device.width}x${device.height}.png`);
      await fs.writeFile(file, png);
      const pixels = analyzeBitmap(image);
      const deviceSemantics = await readSemantics(window.webContents);
      if (deviceSemantics.length > semantics.length) semantics = deviceSemantics;
      captures.push({
        label: device.label,
        width: device.width,
        height: device.height,
        ready,
        path: file,
        dataUrl: `data:image/png;base64,${png.toString('base64')}`,
        pixels,
        issues: ready ? pixels.issues : ['Flutter did not finish starting in this viewport.'],
      });
    } catch (error) {
      captures.push({
        label: device.label,
        width: device.width,
        height: device.height,
        ready: false,
        path: null,
        dataUrl: null,
        pixels: null,
        issues: [error instanceof Error ? error.message : String(error)],
      });
    } finally {
      try {
        window.destroy();
      } catch {
        // already gone
      }
    }
  }

  return {
    ok: true,
    url: target,
    capturedAt: new Date().toISOString(),
    captures,
    semantics,
  };
}

module.exports = { captureScreens, DEVICES };
