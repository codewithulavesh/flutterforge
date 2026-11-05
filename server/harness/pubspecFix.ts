import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { findFlutter } from './flutter.js';

const execFile = promisify(execFileCallback);

/**
 * LLM-generated pubspecs regularly hallucinate impossible toolchain
 * constraints (e.g. `sdk: ">=3.24.0"` — a *Flutter* version pasted into the
 * *Dart SDK* field). `pub get` then fails before a single Dart error is
 * shown. These helpers clamp such constraints to the actually-installed
 * toolchain so builds proceed.
 */

const FALLBACK_SDK = '>=3.0.0 <4.0.0';

export interface SanitizeResult {
  content: string;
  changed: boolean;
  note?: string;
}

export interface ToolchainVersions {
  dartVersion: string | null;
  flutterVersion: string | null;
}

/**
 * Compare dotted versions segment-wise (`3.13.4` < `3.24.0`).
 */
export function compareVersions(a: string | number, b: string | number): number {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Lowest version a `>=X.Y.Z` / `^X.Y.Z` / bare exact-pin constraint admits. */
function lowerBound(constraint: any): string | null {
  if (typeof constraint !== 'string') return null;
  const c = constraint.trim();
  const ge = c.match(/^(?:>=?|\^)\s*(\d+(?:\.\d+){0,2})/);
  if (ge) return ge[1];
  const bare = c.match(/^(\d+(?:\.\d+){0,2})$/); // exact pin (valid for environment.flutter)
  return bare ? bare[1] : null;
}

/** Highest exclusive bound of a `<X.Y.Z` segment, when present. */
function upperBound(constraint: any): string | null {
  if (typeof constraint !== 'string') return null;
  const match = constraint.match(/<\s*(\d+(?:\.\d+){0,2})/);
  return match ? match[1] : null;
}

/**
 * Rewrite the `sdk:` line of a top-level `environment:` block so the
 * installed Dart toolchain can satisfy it. The nested `sdk: flutter` under
 * `dependencies:` is a package reference, not a constraint — it must never
 * be touched, so only lines inside `environment:` are considered.
 */
export function sanitizeSdkConstraint(content: string, { dartVersion }: { dartVersion?: string | null } = {}): SanitizeResult {
  // Top-level (indent 0) `environment:` block and its child lines.
  const envMatch = content.match(/^environment\s*:[^\n]*\n((?:[ \t]+[^\n]*\n?)*)/m);
  if (!envMatch) return { content, changed: false };

  const block = envMatch[1];
  const lineMatch = block.match(/^([ \t]+sdk\s*:\s*)(['"]?)([^'"\n]+)\2[ \t]*$/m);
  if (!lineMatch) return { content, changed: false };

  const raw = lineMatch[3];
  const constraint = raw.trim();
  const lower = lowerBound(constraint);
  const upper = upperBound(constraint);

  let reason = '';
  if (!lower && !upper) {
    // Unparsable junk (e.g. `sdk: "flutter"`): replace wholesale.
    reason = `unparsable sdk constraint "${constraint}"`;
  } else if (dartVersion && lower && compareVersions(dartVersion, lower) < 0) {
    reason = `sdk lower bound ${lower} exceeds the installed Dart ${dartVersion}`;
  } else if (dartVersion && upper && compareVersions(dartVersion, upper) >= 0) {
    reason = `sdk upper bound <${upper} excludes the installed Dart ${dartVersion}`;
  }
  if (!reason) return { content, changed: false };

  const fixed = `${lineMatch[1]}'${FALLBACK_SDK}'`; // group 1 = indent + "sdk:" label
  return {
    content: content.replace(lineMatch[0], fixed),
    changed: true,
    note: `pubspec: ${reason} — reset to '${FALLBACK_SDK}'`,
  };
}

/**
 * Drop a top-level `environment.flutter:` pin the installed Flutter cannot
 * satisfy (the key is optional; removing it unblocks the build).
 */
export function sanitizeFlutterConstraint(content: string, { flutterVersion }: { flutterVersion?: string | null } = {}): SanitizeResult {
  // `environment:` block → `flutter:` child line (deeper indent than env).
  const envMatch = content.match(/^[ \t]*environment\s*:[^\n]*\n((?:[ \t]+[^\n]*\n?)*)/m);
  if (!envMatch) return { content, changed: false };

  const block = envMatch[1];
  const lineMatch = block.match(/^([ \t]+flutter\s*:\s*['"]?([^'"\n]+)['"]?\s*)$/m);
  if (!lineMatch) return { content, changed: false };

  const constraint = lineMatch[2].trim();
  const lower = lowerBound(constraint);
  const broken =
    !lower || (flutterVersion && compareVersions(flutterVersion, lower) < 0);
  if (!broken) return { content, changed: false };

  const reason = !lower
    ? `unparsable flutter constraint "${constraint}"`
    : `flutter lower bound ${lower} exceeds the installed Flutter ${flutterVersion}`;
  return {
    content: content.replace(lineMatch[1], '').replace(/\n{3,}/g, '\n\n'),
    changed: true,
    note: `pubspec: ${reason} — removed the environment.flutter pin`,
  };
}

let cachedVersions: ToolchainVersions | null = null;

/**
 * Quote plain YAML scalars that contain `": "` — the single most common
 * LLM pubspec typo (e.g. `description: A timer: 25 minutes`), which makes
 * the whole file unparseable and fails pub/analyze before anything runs.
 */
export function fixInvalidPlainScalars(content: string): SanitizeResult {
  const lines = content.split(/\r?\n/);
  let changed = false;
  const fixed = lines.map((line) => {
    // Top-level or nested `key: value` lines only (no list items, no comments).
    const match = line.match(/^([ \t]*)([A-Za-z0-9_.-]+):[ \t]+(.*?)[ \t]*$/);
    if (!match) return line;
    const [, indent, key, raw] = match;
    // Already quoted, block scalar, flow collection, anchor/alias/tag → skip.
    if (/^['"|[>{&*]/.test(raw)) return line;
    // A plain scalar must not contain ": " (YAML scanner error).
    if (!/:\s/.test(raw)) return line;
    changed = true;
    return `${indent}${key}: '${raw.replace(/'/g, "''")}'`;
  }).join('\n');
  return changed
    ? { content: fixed, changed, note: 'pubspec: quoted a plain scalar containing ": " (invalid YAML)' }
    : { content, changed };
}

/**
 * First invalid plain-scalar line in a pubspec, for validation reporting.
 */
export function findInvalidPlainScalar(content: string): string | null {
  if (typeof content !== 'string') return null;
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([ \t]*)([A-Za-z0-9_.-]+):[ \t]+(.*?)[ \t]*$/);
    if (!match) continue;
    const raw = match[3];
    if (/^['"|[>{&*]/.test(raw)) continue;
    if (/:\s/.test(raw)) return line;
  }
  return null;
}

/**
 * Installed toolchain versions (cached per server process). Resolves to
 * nulls when Flutter is unavailable — the sanitizers then only repair
 * syntactically broken constraints.
 */
export async function getToolchainVersions(): Promise<ToolchainVersions> {
  if (cachedVersions) return cachedVersions;
  const result: ToolchainVersions = { dartVersion: null, flutterVersion: null };
  try {
    const { stdout } = await execFile(findFlutter(), ['--version', '--machine'], {
      timeout: 30_000,
    });
    const parsed = JSON.parse(stdout);
    result.dartVersion = parsed.dartSdkVersion || null;
    result.flutterVersion = parsed.flutterVersion || null;
  } catch {
    // Leave nulls; callers proceed without version-aware clamping.
  }
  cachedVersions = result;
  return result;
}
