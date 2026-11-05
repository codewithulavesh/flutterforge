import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

/**
 * Directories that are build output, VCS metadata, or harness bookkeeping —
 * never part of the generated Flutter project the user sees.
 */
export const IGNORED_DIRS = new Set<string>([
  '.git',
  '.hg',
  '.svn',
  '.dart_tool',
  '.flutterforge',
  '.dsh',
  '.idea',
  '.vscode',
  '.gradle',
  '.cxx',
  '.symlinks',
  'build',
  'node_modules',
  'Pods',
  'ephemeral',
  '.plugin_symlinks',
]);

/** Text artefacts a Flutter project can round-trip through JSON safely. */
const TEXT_EXTENSIONS = new Set<string>([
  '.dart', '.yaml', '.yml', '.sql', '.json', '.md', '.txt', '.xml', '.plist',
  '.swift', '.kt', '.kts', '.java', '.gradle', '.properties', '.sh', '.bat',
  '.ps1', '.rc', '.cpp', '.cc', '.c', '.h', '.hpp', '.m', '.mm', '.xcconfig',
  '.entitlements', '.storyboard', '.xcscheme', '.pbxproj', '.iml', '.env',
  '.example', '.gitignore', '.metadata', '.js', '.mjs', '.ts', '.tsx', '.css',
  '.html', '.arb', '.csv', '.toml', '.lock',
]);

const EXTENSIONLESS_TEXT = new Set<string>([
  'README', 'LICENSE', 'LICENCE', 'Dockerfile', 'Podfile', 'Makefile',
  'AGENTS', 'CHANGELOG', 'AUTHORS', 'NOTICE', 'CODEOWNERS',
]);

const MAX_FILE_BYTES = 1024 * 1024;
const MAX_WRITE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_WRITE_BYTES = 64 * 1024 * 1024;

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  '.dart': 'dart',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.sql': 'sql',
  '.json': 'json',
  '.md': 'markdown',
  '.env': 'env',
};

export class UnsafePathError extends Error {
  code: string;
  constructor(message: string) {
    super(message);
    this.name = 'UnsafePathError';
    this.code = 'UNSAFE_PATH';
  }
}

/**
 * Normalize a client-supplied project-relative path and reject anything that
 * could escape the workspace (absolute paths, `..`, drive letters, NUL bytes).
 */
export function safeRelativePath(input: string): string {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new UnsafePathError('File path must be a non-empty string.');
  }
  const normalized = input.replaceAll('\\', '/').replace(/^\.\/+/, '').trim();
  if (normalized.includes('\0')) throw new UnsafePathError('File path contains a NUL byte.');
  if (normalized.startsWith('/') || /^[a-zA-Z]:\//.test(normalized) || normalized.startsWith('//')) {
    throw new UnsafePathError(`File path must be relative: ${input}`);
  }
  const segments = normalized.split('/').filter((segment) => segment !== '' && segment !== '.');
  if (segments.length === 0) throw new UnsafePathError(`File path is empty: ${input}`);
  if (segments.some((segment) => segment === '..')) {
    throw new UnsafePathError(`File path escapes the workspace: ${input}`);
  }
  if (segments.some((segment) => segment === '.flutterforge')) {
    throw new UnsafePathError('File path targets FlutterForge bookkeeping.');
  }
  return segments.join('/');
}

/**
 * Resolve a relative path inside `root`, refusing anything outside it.
 */
export function resolveInside(root: string, relativePath: string): string {
  const safe = safeRelativePath(relativePath);
  const absoluteRoot = path.resolve(root);
  const absolute = path.resolve(absoluteRoot, safe);
  if (absolute !== absoluteRoot && !absolute.startsWith(`${absoluteRoot}${path.sep}`)) {
    throw new UnsafePathError(`File path escapes the workspace: ${relativePath}`);
  }
  return absolute;
}

export function languageForPath(filePath: string): string {
  const base = path.basename(filePath);
  if (base === 'pubspec.yaml' || base === 'pubspec.lock') return 'yaml';
  if (base.startsWith('.env')) return 'env';
  return LANGUAGE_BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? 'markdown';
}

export function shouldIncludeFile(filePath: string): boolean {
  const base = path.basename(filePath);
  // Lockfiles and the engine's own instructions are noise in the project diff.
  if (base === 'pubspec.lock' || base === 'Podfile.lock' || base === 'AGENTS.md') return false;
  const extension = path.extname(base).toLowerCase();
  if (TEXT_EXTENSIONS.has(extension)) return true;
  if (extension === '') return EXTENSIONLESS_TEXT.has(base);
  return false;
}

export interface FileSnapshotEntry {
  content: string;
  hash: string;
}

export type SnapshotChangeAction = 'created' | 'modified' | 'deleted';

export interface SnapshotChange {
  path: string;
  content: string;
  action: SnapshotChangeAction;
  language: string;
}

export interface MaterializeFileInput {
  path: string;
  content?: string | null;
  is_directory?: boolean;
  isDirectory?: boolean;
}

export interface ParsedCodeBlock {
  path: string;
  content: string;
}

/**
 * Snapshot every text source file under `root` (hash + content). Build output
 * and harness bookkeeping are excluded so a diff reflects the project only.
 */
export async function snapshotFiles(root: string): Promise<Map<string, FileSnapshotEntry>> {
  const snapshot = new Map<string, FileSnapshotEntry>();

  async function walk(directory: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error: any) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).replaceAll(path.sep, '/');

      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        await walk(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!relative || relative.startsWith('..')) continue;
      if (!shouldIncludeFile(relative)) continue;

      let stat;
      try {
        stat = await fs.stat(absolute);
      } catch {
        continue;
      }
      if (!stat.isFile() || stat.size > MAX_FILE_BYTES) continue;

      const content = await fs.readFile(absolute, 'utf8');
      snapshot.set(relative, { content, hash: createHash('sha256').update(content).digest('hex') });
    }
  }

  await walk(path.resolve(root));
  return snapshot;
}

/**
 * Compare two snapshots and return created / modified / deleted artefacts.
 */
export function diffSnapshots(before: Map<string, FileSnapshotEntry>, after: Map<string, FileSnapshotEntry>): SnapshotChange[] {
  const changes: SnapshotChange[] = [];

  for (const [filePath, entry] of after) {
    const previous = before.get(filePath);
    if (!previous) {
      changes.push({ path: filePath, content: entry.content, action: 'created', language: languageForPath(filePath) });
    } else if (previous.hash !== entry.hash) {
      changes.push({ path: filePath, content: entry.content, action: 'modified', language: languageForPath(filePath) });
    }
  }

  for (const [filePath, entry] of before) {
    if (!after.has(filePath)) {
      changes.push({ path: filePath, content: entry.content, action: 'deleted', language: languageForPath(filePath) });
    }
  }

  return changes.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Write client-supplied project files into the workspace. Every path is
 * validated; the total payload is bounded.
 */
export async function materializeFiles(root: string, files: MaterializeFileInput[]): Promise<number> {
  if (!Array.isArray(files)) return 0;
  let written = 0;
  let totalBytes = 0;

  for (const file of files) {
    if (!file || file.is_directory || file.isDirectory) continue;
    if (typeof file.path !== 'string') continue;
    if (typeof file.content !== 'string') continue;

    const bytes = Buffer.byteLength(file.content, 'utf8');
    if (bytes > MAX_WRITE_BYTES) {
      throw new UnsafePathError(`File is too large to materialize: ${file.path}`);
    }
    totalBytes += bytes;
    if (totalBytes > MAX_TOTAL_WRITE_BYTES) {
      throw new UnsafePathError('Project exceeds the 64 MiB materialization limit.');
    }

    const absolute = resolveInside(root, file.path);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, file.content, 'utf8');
    written += 1;
  }

  return written;
}

/**
 * Parse fenced code blocks that carry a file path. This is a safety net for a
 * model that answers with code instead of calling the write tool.
 */
export function parseCodeBlocks(text: string): ParsedCodeBlock[] {
  if (typeof text !== 'string' || text === '') return [];
  const files: ParsedCodeBlock[] = [];
  const fence = /```[^\n]*?(?:filepath|path)=["']([^"']+)["'][^\n]*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = fence.exec(text)) !== null) {
    try {
      const filePath = safeRelativePath(match[1]);
      const content = match[2] ?? '';
      if (content.trim() !== '') files.push({ path: filePath, content });
    } catch {
      // Ignore unsafe or malformed blocks; the workspace diff remains authoritative.
    }
  }
  return files;
}

export async function ensureDirectory(directory: string): Promise<void> {
  await fs.mkdir(directory, { recursive: true });
}

export async function resetDirectory(directory: string): Promise<void> {
  await fs.rm(directory, { recursive: true, force: true });
  await fs.mkdir(directory, { recursive: true });
}
