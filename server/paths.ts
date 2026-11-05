import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
export const APP_ROOT = path.resolve(SERVER_DIR, '..');

/** Project-owned runtime data lives in this checkout by default. */
export function getProjectDataRoot(): string {
  return process.env.FLUTTERFORGE_DATA_DIR || path.join(APP_ROOT, '.flutterforge');
}

