import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { findFlutter } from './flutter.js';

const ANALYZE_TIMEOUT_MS = Number(process.env.FLUTTERFORGE_ANALYZE_TIMEOUT_MS || 3 * 60 * 1000);
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;

export interface Diagnostic {
  filePath: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  correction: string;
}

interface RunResult {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

function run(command: string, args: string[], { cwd, timeoutMs = ANALYZE_TIMEOUT_MS }: { cwd?: string; timeoutMs?: number } = {}): Promise<RunResult> {
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(command, args, {
        cwd,
        shell: process.platform === 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      resolve({ ok: false, code: null, stdout: '', stderr: error instanceof Error ? error.message : String(error), timedOut: false });
      return;
    }

    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // gone
      }
      resolve({ ok: false, code: null, stdout, stderr, timedOut: true });
    }, timeoutMs);

    child.stdout?.on('data', (chunk) => {
      if (stdout.length < MAX_OUTPUT_BYTES) stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      if (stderr.length < MAX_OUTPUT_BYTES) stderr += chunk.toString();
    });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, code: null, stdout, stderr: error.message, timedOut: false });
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: code === 0, code, stdout, stderr, timedOut: false });
    });
  });
}

/** Resolve the Dart executable bundled inside a Flutter SDK. */
export function dartBinaryFor(flutterBin: string): string {
  return path.join(
    path.dirname(flutterBin),
    'cache',
    'dart-sdk',
    'bin',
    process.platform === 'win32' ? 'dart.exe' : 'dart',
  );
}

function normalizeSeverity(value: unknown): 'error' | 'warning' | 'info' {
  const lower = String(value || 'error').toLowerCase();
  if (lower === 'warning' || lower === 'info') return lower;
  return 'error';
}

function toDiagnostic(entry: Record<string, any>, workspace: string): Diagnostic {
  const location = entry.location ?? entry.range?.start ?? {};
  const rawFile = entry.file ?? location.file ?? entry.path ?? '';
  const filePath = rawFile
    ? (path.isAbsolute(rawFile) ? path.relative(workspace, rawFile) : rawFile).split(path.sep).join('/')
    : '';
  return {
    filePath,
    line: Number(entry.line ?? location.line ?? 0) || 0,
    column: Number(entry.column ?? location.column ?? 0) || 0,
    severity: normalizeSeverity(entry.severity ?? entry.type),
    code: String(entry.code ?? entry.errorCode ?? 'ANALYZE'),
    message: String(entry.problemMessage ?? entry.message ?? 'Analyzer reported a problem.'),
    correction: entry.correctionMessage ? String(entry.correctionMessage) : '',
  };
}

function parseDiagnostics(text: string, workspace: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const seen = new Set<string>();
  const push = (value: any) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value.diagnostics)) {
      for (const item of value.diagnostics) push(item);
    }
    if (!value.severity && !value.code && !value.errorCode) return;
    const diagnostic = toDiagnostic(value, workspace);
    const key = `${diagnostic.filePath}:${diagnostic.line}:${diagnostic.column}:${diagnostic.code}:${diagnostic.message}`;
    if (seen.has(key)) return;
    seen.add(key);
    diagnostics.push(diagnostic);
  };

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try {
      push(JSON.parse(trimmed));
    } catch {
      // Non-JSON analyzer output line.
    }
  }
  try {
    push(JSON.parse(text.trim()));
  } catch {
    // Output was line-delimited or contained warnings; line pass above ran.
  }
  return diagnostics;
}

export function formatDiagnostic(diagnostic: Diagnostic): string {
  const location = diagnostic.filePath
    ? `${diagnostic.filePath}:${diagnostic.line}:${diagnostic.column}`
    : '(project)';
  return `${location} • ${diagnostic.severity.toUpperCase()} ${diagnostic.code} • ${diagnostic.message}`;
}

/**
 * Compile gate: run the Dart analyzer with machine-readable output.
 * Skips honestly when the project has no resolved dependencies or no SDK.
 */
export async function analyzeProject(workspace: string, options: { flutterBin?: string; requirePackageConfig?: boolean; timeoutMs?: number } = {}) {
  const flutterBin = options.flutterBin || findFlutter();
  const flutterAvailable = flutterBin
    ? await fs.access(flutterBin).then(() => true).catch(() => false)
    : false;
  if (!flutterAvailable) {
    return {
      available: false,
      skipped: true,
      ok: false,
      errorCount: 0,
      warningCount: 0,
      diagnostics: [] as Diagnostic[],
      summary: 'Flutter SDK not found; compile gate skipped.',
    };
  }

  const dartBin = dartBinaryFor(flutterBin);
  const dartAvailable = await fs.access(dartBin).then(() => true).catch(() => false);
  if (!dartAvailable) {
    return {
      available: false,
      skipped: true,
      ok: false,
      errorCount: 0,
      warningCount: 0,
      diagnostics: [] as Diagnostic[],
      summary: 'Bundled Dart SDK not found; compile gate skipped.',
    };
  }

  if (options.requirePackageConfig !== false) {
    const resolved = await fs
      .access(path.join(workspace, '.dart_tool', 'package_config.json'))
      .then(() => true)
      .catch(() => false);
    if (!resolved) {
      return {
        available: true,
        skipped: true,
        ok: false,
        errorCount: 0,
        warningCount: 0,
        diagnostics: [] as Diagnostic[],
        summary: 'Dependencies are not resolved yet; compile gate skipped until pub get runs.',
      };
    }
  }

  const result = await run(dartBin, ['analyze', '--format=json', '.'], {
    cwd: workspace,
    timeoutMs: options.timeoutMs ?? ANALYZE_TIMEOUT_MS,
  });
  const diagnostics = parseDiagnostics(`${result.stdout}\n${result.stderr}`, workspace);
  const errorCount = diagnostics.filter((item) => item.severity === 'error').length;
  const warningCount = diagnostics.filter((item) => item.severity === 'warning').length;
  const summary = result.timedOut
    ? 'Compile gate timed out; the project was not verified.'
    : errorCount > 0
      ? `Compile gate failed: ${errorCount} error(s), ${warningCount} warning(s).`
      : `Compile gate passed: 0 errors, ${warningCount} warning(s).`;

  return {
    available: true,
    skipped: false,
    ok: !result.timedOut && errorCount === 0,
    timedOut: result.timedOut,
    exitCode: result.code,
    errorCount,
    warningCount,
    diagnostics,
    summary,
  };
}

