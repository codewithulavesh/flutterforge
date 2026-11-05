import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  diffSnapshots,
  languageForPath,
  snapshotFiles,
  type FileSnapshotEntry,
} from './workspace.js';
import { findInvalidPlainScalar } from './pubspecFix.js';

const TOTAL_STEPS = 7;
const MAX_THOUGHT_CHARS = 600;
const THOUGHT_THROTTLE_MS = 750;

/**
 * Convert a tool-supplied path (relative or absolute) into a stable
 * workspace-relative POSIX path. Absolute paths are common when the model
 * follows a read result's canonical path, and leaking them into the project
 * store corrupts every later write.
 */
function relativeArtifactPath(workspace: string, input: any): string | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  const normalized = raw.replaceAll('\\', '/');
  if (path.isAbsolute(normalized)) {
    const relative = path.relative(workspace, normalized).replaceAll(path.sep, '/');
    if (!relative || relative.startsWith('..')) return null;
    return relative.replace(/^\.\/+/, '');
  }
  return normalized.replace(/^\.\/+/, '');
}

/**
 * The React workspace timeline is keyed by the historical LangGraph node
 * names. Keep those keys as the UI contract and map harness phases onto them
 * so step advancement stays node-driven (no keyword guessing in the panel).
 */
const NODE_BY_PHASE: Record<string, string> = {
  analyzing: 'classify_intent',
  feature_detection: 'parallel_init',
  vector_retrieval: 'parallel_init',
  planning: 'plan_architecture',
  schema_design: 'plan_architecture',
  code_generation: 'generate_batch',
  incremental_edit: 'incremental_edit',
  dependency_resolution: 'merge_files',
  validation: 'validate_code',
  auto_healing: 'auto_heal_llm',
  completed: 'embed_artifacts',
  failed: 'validate_code',
};

export type FileAction = 'created' | 'modified' | 'deleted';

export interface ProjectorFileArtifact {
  path: string;
  content: string;
  action: FileAction;
  language: string;
}

export interface ValidationIssue {
  filePath: string;
  severity: 'error' | 'warning';
  code: string;
  message: string;
  autoFixAvailable: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  summary: string;
}

export interface EventProjectorOptions {
  workspace: string;
  snapshotBefore: Map<string, FileSnapshotEntry>;
  emit: (type: string, data: Record<string, any>) => void;
}

export interface FinishOptions {
  exit?: {
    code?: number | null;
    stderr?: string;
    timedOut?: boolean;
    aborted?: boolean;
  };
}

export interface ProjectorResult {
  success: boolean;
  files: ProjectorFileArtifact[];
  validation: ValidationResult;
  summary: string;
  logs: string[];
  finalText: string;
}

export interface EventProjector {
  handle: (event: Record<string, any>) => Promise<void>;
  finish: (options?: FinishOptions) => Promise<ProjectorResult>;
  emitted: Map<string, ProjectorFileArtifact>;
  logs: string[];
}

/**
 * Project one harness run into the SSE contract the React app already speaks.
 * It emits agent progress, per-file artefacts, a validation summary and done.
 */
export function createEventProjector({ workspace, snapshotBefore, emit }: EventProjectorOptions): EventProjector {
  const emitted = new Map<string, ProjectorFileArtifact>();
  const toolPaths = new Map<string, string>();
  const logs: string[] = [];
  let finalText = '';
  let textBuffer = '';
  let lastThoughtAt = 0;
  let lastThought = '';
  let currentStep = 1;
  let currentPhase = 'analyzing';
  let sawWrite = false;

  const log = (message: string) => {
    logs.push(message);
  };

  const agentEvent = (phase: string, message: string, extra: Record<string, any> = {}) => {
    currentPhase = phase;
    log(`[${phase}] ${message}`);
    emit('agent_event', {
      phase,
      stepNumber: currentStep,
      totalSteps: TOTAL_STEPS,
      message,
      timestamp: new Date().toISOString(),
      node: NODE_BY_PHASE[phase] ?? 'classify_intent',
      ...extra,
    });
  };

  /**
   * Read a written file and emit it once. Repeated writes update the artifact
   * but only emit again when the content actually changed.
   */
  async function emitFile(relativePath: string): Promise<void> {
    const normalizedPath = relativeArtifactPath(workspace, relativePath);
    if (!normalizedPath) return;
    let absolute: string;
    try {
      absolute = path.resolve(workspace, normalizedPath);
      if (absolute !== workspace && !absolute.startsWith(`${workspace}${path.sep}`)) return;
      const stat = await fs.stat(absolute);
      if (!stat.isFile() || stat.size > 1024 * 1024) return;
      const content = await fs.readFile(absolute, 'utf8');
      const previous = snapshotBefore.get(normalizedPath);
      const action: FileAction = previous ? 'modified' : 'created';
      const existing = emitted.get(normalizedPath);
      if (existing && existing.content === content) return;
      const artifact: ProjectorFileArtifact = { path: normalizedPath, content, action, language: languageForPath(normalizedPath) };
      emitted.set(relativePath, artifact);
      emit('file_ready', {
        path: artifact.path,
        content: artifact.content,
        action: artifact.action,
        language: artifact.language,
        node: 'generate_batch',
      });
    } catch {
      // The file may be deleted again within the same run; the final diff wins.
    }
  }

  async function handle(event: Record<string, any>): Promise<void> {
    switch (event.type) {
      case 'session':
        currentStep = 1;
        agentEvent('analyzing', `Harness session ready (${event.sessionId ?? 'new'}).`, {
          kind: 'phase',
          detail: event.cwd ? `Workspace: ${event.cwd}` : undefined,
        });
        return;

      case 'status': {
        if (event.phase === 'turn_start') {
          currentStep = Math.max(currentStep, 2);
          agentEvent('planning', `Harness turn ${event.turn ?? 1} started.`, { kind: 'phase' });
        } else if (event.phase === 'step_start') {
          currentStep = Math.max(currentStep, 3);
          agentEvent(sawWrite ? 'code_generation' : 'planning', `Agent step ${event.step ?? 1}: reasoning and tool use…`, { kind: 'phase' });
        } else if (event.phase === 'step_end' && event.usage) {
          const used = Number(event.usage.totalTokens ?? 0);
          if (used > 0) log(`[usage] step ${event.step}: ${used} tokens`);
        } else if (event.phase === 'turn_end') {
          const kind = event.reason?.kind;
          if (kind && kind !== 'completed' && kind !== 'max_steps') {
            agentEvent('validation', `Harness turn ended: ${kind}.`);
          }
        }
        return;
      }

      case 'thinking': {
        const thought = String(event.text ?? '').trim();
        if (!thought || thought === lastThought) return;
        const now = Date.now();
        if (now - lastThoughtAt < THOUGHT_THROTTLE_MS) return;
        lastThoughtAt = now;
        lastThought = thought;
        agentEvent('planning', 'Reasoning about the next change…', {
          kind: 'reasoning',
          thought: thought.slice(0, MAX_THOUGHT_CHARS),
        });
        return;
      }

      case 'text': {
        const text = String(event.text ?? '');
        if (!text) return;
        textBuffer += text;
        emit('token', { node: 'harness', token: text, phase: currentPhase });
        return;
      }

      case 'tool_call': {
        const tool = String(event.tool ?? 'tool');
        const input = event.input && typeof event.input === 'object' ? event.input : {};
        const filePath = typeof input.file_path === 'string'
          ? relativeArtifactPath(workspace, input.file_path) ?? ''
          : '';
        const toolCallId = String(event.callId ?? '');
        const toolInput = {
          ...(filePath ? { file_path: filePath } : {}),
          ...(typeof input.command === 'string' ? { command: String(input.command).slice(0, 400) } : {}),
          ...(typeof input.pattern === 'string' ? { pattern: String(input.pattern).slice(0, 200) } : {}),
        };

        if (tool === 'write' || tool === 'edit') {
          sawWrite = true;
          currentStep = Math.max(currentStep, 4);
          if (filePath) toolPaths.set(toolCallId, filePath);
          agentEvent('code_generation', `${tool === 'write' ? 'Writing' : 'Editing'} ${filePath || 'a project file'}…`, {
            kind: 'tool',
            tool,
            toolCallId,
            toolInput,
            filePath: filePath || undefined,
            activeFile: filePath || undefined,
          });
        } else if (tool === 'bash') {
          const command = String(input.command ?? '').replace(/\s+/g, ' ').slice(0, 160);
          agentEvent('validation', command ? `Running: ${command}` : 'Running a validation command…', {
            kind: 'tool',
            tool,
            toolCallId,
            toolInput,
          });
        } else if (tool === 'read' || tool === 'read_image' || tool === 'glob' || tool === 'grep') {
          agentEvent('analyzing', `${tool === 'read' ? 'Reading' : 'Searching'} ${filePath || 'the workspace'}…`, {
            kind: 'tool',
            tool,
            toolCallId,
            toolInput,
            filePath: filePath || undefined,
          });
        } else if (tool.startsWith('mcp__dart__')) {
          agentEvent('validation', `Dart tool: ${tool.replace('mcp__dart__', '')}`, {
            kind: 'tool',
            tool,
            toolCallId,
            toolInput,
          });
        } else if (tool === 'todo_write') {
          agentEvent('planning', 'Updating the generation plan…', {
            kind: 'tool',
            tool,
            toolCallId,
            toolInput,
          });
        } else {
          agentEvent(currentPhase, `Tool call: ${tool}`, {
            kind: 'tool',
            tool,
            toolCallId,
            toolInput,
          });
        }
        return;
      }

      case 'tool_result': {
        const callId = String(event.callId ?? '');
        const filePath = toolPaths.get(callId);
        toolPaths.delete(callId);
        if (event.status === 'error') {
          const message = String(event.result ?? 'tool failed').split('\n')[0]?.slice(0, 220);
          agentEvent('validation', `Tool error: ${message}`, {
            kind: 'tool_result',
            toolCallId: callId,
            status: 'error',
          });
          return;
        }
        if (filePath) {
          await emitFile(filePath);
          agentEvent('code_generation', `✓ ${filePath}`, {
            kind: 'tool_result',
            toolCallId: callId,
            status: 'ok',
            filePath,
            activeFile: filePath,
          });
        } else {
          agentEvent(currentPhase, `Tool completed${event.tool ? `: ${event.tool}` : ''}.`, {
            kind: 'tool_result',
            toolCallId: callId,
            status: 'ok',
          });
        }
        return;
      }

      case 'final': {
        finalText = String(event.text ?? '').trim();
        currentStep = Math.max(currentStep, 6);
        return;
      }

      case 'error': {
        const message = String(event.message ?? event.error ?? 'Harness run failed.').slice(0, 800);
        throw new Error(message);
      }

      case 'diagnostic':
        log(`[harness] ${String(event.text ?? '').slice(0, 300)}`);
        return;

      default:
        return;
    }
  }

  /**
   * Diff the workspace and finish the stream.
   */
  async function finish(options: FinishOptions = {}): Promise<ProjectorResult> {
    const exit = options.exit;
    if (exit?.aborted) {
      agentEvent('failed', 'Generation cancelled by user.');
      return {
        success: false,
        files: [...emitted.values()],
        validation: { isValid: false, issues: [], summary: 'Cancelled' },
        summary: 'Generation cancelled',
        logs,
        finalText,
      };
    }
    if (exit?.timedOut) {
      agentEvent('failed', 'The harness run exceeded its time limit.');
    } else if (typeof exit?.code === 'number' && exit.code !== 0) {
      // A non-zero exit after files were written is usually a failed optional
      // check (for example `dart analyze` inside a read-only SDK cache). The
      // files are still the product, so warn instead of discarding them.
      const detail = String(exit.stderr || '').split('\n').slice(-3).join(' ').slice(0, 500);
      agentEvent('validation', `Harness exited with code ${exit.code}${detail ? `: ${detail}` : ''}`);
    }

    const snapshotAfter = await snapshotFiles(workspace);
    const changes = diffSnapshots(snapshotBefore, snapshotAfter);

    for (const change of changes) {
      if (change.action === 'deleted') {
        emitted.set(change.path, { ...change });
        emit('file_ready', {
          path: change.path,
          content: '',
          action: 'deleted',
          language: change.language,
          node: 'generate_batch',
        });
        agentEvent('code_generation', `✕ ${change.path} (deleted)`);
        continue;
      }
      const existing = emitted.get(change.path);
      if (existing && existing.content === change.content) continue;
      emitted.set(change.path, change);
      emit('file_ready', {
        path: change.path,
        content: change.content,
        action: change.action,
        language: change.language,
        node: 'generate_batch',
      });
      agentEvent('code_generation', `✓ ${change.path}`);
    }

    const files = [...emitted.values()];
    const paths = files.map((file) => file.path);
    emit('files_merged', { count: files.length, paths });

    const validation = validateProject(files);
    currentStep = 6;
    agentEvent('validation', validation.summary, {
      generatedFiles: files,
      validationReport: {
        isValid: validation.isValid,
        issues: validation.issues,
        fixedIssues: [],
        summary: validation.summary,
      },
    });
    emit('validation', {
      is_valid: validation.isValid,
      summary: validation.summary,
      issue_count: validation.issues.length,
    });

    const summary = finalText || `Generated ${files.length} files with the DeepSeek Harness engine.`;
    currentStep = 7;
    agentEvent('completed', `Harness finished: ${files.length} file(s) ready.`, { generatedFiles: files });
    const succeeded = !exit?.aborted
      && !exit?.timedOut
      && (exit?.code === 0 || exit?.code === null || exit === undefined || files.length > 0);

    return {
      success: succeeded,
      files,
      validation,
      summary,
      logs,
      finalText,
    };
  }

  return { handle, finish, emitted, logs };
}

/**
 * Deterministic checks that do not require the Dart SDK. They catch the
 * unbuildable shapes the UI must never silently accept.
 */
export function validateProject(files: Array<{ path: string; content: string }>): ValidationResult {
  const issues: ValidationIssue[] = [];
  const byPath = new Map<string, string>(files.map((file) => [file.path, file.content]));
  const pubspec = byPath.get('pubspec.yaml');

  if (!pubspec) {
    issues.push({
      filePath: 'pubspec.yaml',
      severity: 'error',
      code: 'MISSING_PUBSPEC',
      message: 'pubspec.yaml is missing; the project cannot build.',
      autoFixAvailable: false,
    });
  } else {
    const badScalar = findInvalidPlainScalar(pubspec);
    if (badScalar) {
      issues.push({
        filePath: 'pubspec.yaml',
        severity: 'error',
        code: 'INVALID_PUBSPEC_YAML',
        message: `pubspec.yaml is not valid YAML (unquoted ":" in a value): ${badScalar.trim().slice(0, 80)}`,
        autoFixAvailable: true,
      });
    }
  }
  if (!byPath.get('lib/main.dart')) {
    issues.push({
      filePath: 'lib/main.dart',
      severity: 'error',
      code: 'MISSING_MAIN',
      message: 'lib/main.dart is missing; the app has no entry point.',
      autoFixAvailable: false,
    });
  }

  const packageName = pubspec?.match(/^name\s*:\s*([A-Za-z0-9_]+)/m)?.[1];
  for (const [filePath, content] of byPath) {
    if (!filePath.endsWith('.dart')) continue;
    if (/package:([A-Za-z0-9_]+)\//.test(content) && packageName) {
      const selfImports = [...content.matchAll(/package:([A-Za-z0-9_]+)\//g)]
        .map((match) => match[1])
        .filter((name) => name.startsWith(packageName) && name !== packageName);
      if (selfImports.length > 0) {
        issues.push({
          filePath,
          severity: 'warning',
          code: 'SELF_IMPORT_MISMATCH',
          message: `Import uses package:${selfImports[0]}/ but pubspec name is ${packageName}.`,
          autoFixAvailable: true,
        });
      }
    }
    if (/\bTODO\b|NotImplementedException/.test(content)) {
      issues.push({
        filePath,
        severity: 'warning',
        code: 'STUB_CODE',
        message: 'File still contains a TODO or NotImplementedException.',
        autoFixAvailable: false,
      });
    }
  }

  issues.push(...lintGeneratedUi(byPath));
  issues.push(...contrastIssues(byPath.get('lib/core/theme/app_theme.dart')));

  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.length - errors;
  const summary = issues.length === 0
    ? 'Validation passed: required Flutter files present, no stub markers found.'
    : `${errors} error(s), ${warnings} warning(s): ${issues.slice(0, 3).map((issue) => issue.message).join(' ')}`;

  return { isValid: errors === 0, issues, summary };
}

/**
 * Design and UX checks that are deterministic on source text alone:
 * token drift, placeholder copy and missing loading/empty/error paths.
 */
function lintGeneratedUi(byPath: Map<string, string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const [filePath, content] of byPath) {
    if (!filePath.endsWith('.dart')) continue;
    const isUiFile = /^lib\/(screens|features)\//.test(filePath)
      && /extends\s+(StatelessWidget|StatefulWidget|ConsumerWidget|HookWidget)/.test(content);
    if (!isUiFile) continue;

    if (/Color\(0xFF[0-9A-Fa-f]{6}\)|Color\.fromARGB\(/.test(content)) {
      issues.push({
        filePath,
        severity: 'warning',
        code: 'HARDCODED_COLOR',
        message: 'Screen hardcodes a color. Use Theme.of(context).colorScheme or AppTheme tokens.',
        autoFixAvailable: false,
      });
    }

    if (/\blorem ipsum\b|\bcoming soon\b|\bItem\s+\d+\b/i.test(content)) {
      issues.push({
        filePath,
        severity: 'warning',
        code: 'PLACEHOLDER_COPY',
        message: 'Screen contains placeholder copy. Write real content from the brief.',
        autoFixAvailable: false,
      });
    }

    const loadsData = /Supabase\.instance|\.from\(|\.stream\(|\bawait\s+/.test(content);
    if (!loadsData) continue;

    const hasLoading = /CircularProgressIndicator|LinearProgressIndicator|Shimmer|Skeleton|isLoading|loading\s*[:=]/i.test(content);
    const hasError = /\bcatch\s*\(|\bhasError\b|\berrorMessage\b|SnackBar|errorText/.test(content);
    const hasEmpty = /\bisEmpty\b|\bEmptyState\b|\bempty\b/i.test(content);
    const missing = [
      hasLoading ? null : 'loading',
      hasEmpty ? null : 'empty',
      hasError ? null : 'error',
    ].filter(Boolean);

    if (missing.length > 0) {
      issues.push({
        filePath,
        severity: 'warning',
        code: 'MISSING_UI_STATES',
        message: `Data screen has no ${missing.join(', ')} state. Add all three before shipping.`,
        autoFixAvailable: false,
      });
    }
  }
  return issues;
}

function srgbChannel(hex: string): number {
  const value = parseInt(hex, 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function contrastRatio(a: string, b: string): number {
  const lumA = 0.2126 * srgbChannel(a.slice(0, 2))
    + 0.7152 * srgbChannel(a.slice(2, 4))
    + 0.0722 * srgbChannel(a.slice(4, 6));
  const lumB = 0.2126 * srgbChannel(b.slice(0, 2))
    + 0.7152 * srgbChannel(b.slice(2, 4))
    + 0.0722 * srgbChannel(b.slice(4, 6));
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA check for the generated theme's primary text pairs. */
function contrastIssues(themeSource?: string): ValidationIssue[] {
  if (!themeSource) return [];
  const colorOf = (name: string) => themeSource
    .match(new RegExp(`static\\s+const\\s+Color\\s+${name}\\s*=\\s*Color\\(0xFF([0-9A-Fa-f]{6})\\)`))?.[1];
  const pairs = [
    { label: 'light', background: colorOf('backgroundLight'), text: colorOf('textPrimaryLight') },
    { label: 'dark', background: colorOf('backgroundDark'), text: colorOf('textPrimaryDark') },
  ];
  const issues: ValidationIssue[] = [];
  for (const pair of pairs) {
    if (!pair.background || !pair.text) continue;
    const ratio = contrastRatio(pair.background, pair.text);
    if (ratio < 4.5) {
      issues.push({
        filePath: 'lib/core/theme/app_theme.dart',
        severity: 'error',
        code: 'LOW_CONTRAST',
        message: `${pair.label} primary text contrast is ${ratio.toFixed(2)}:1 (needs 4.5:1).`,
        autoFixAvailable: true,
      });
    }
  }
  return issues;
}
