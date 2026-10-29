import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  diffSnapshots,
  languageForPath,
  snapshotFiles,
} from './workspace.mjs';

const TOTAL_STEPS = 7;
const MAX_THOUGHT_CHARS = 600;
const THOUGHT_THROTTLE_MS = 750;

/**
 * Convert a tool-supplied path (relative or absolute) into a stable
 * workspace-relative POSIX path. Absolute paths are common when the model
 * follows a read result's canonical path, and leaking them into the project
 * store corrupts every later write.
 * @param {string} workspace
 * @param {string} input
 * @returns {string | null}
 */
function relativeArtifactPath(workspace, input) {
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
const NODE_BY_PHASE = {
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

/** @typedef {'created' | 'modified' | 'deleted'} FileAction */

/**
 * Project one harness run into the SSE contract the React app already speaks.
 * It emits agent progress, per-file artefacts, a validation summary and done.
 *
 * @param {object} options
 * @param {string} options.workspace
 * @param {Map<string, { content: string, hash: string }>} options.snapshotBefore
 * @param {(type: string, data: Record<string, any>) => void} options.emit
 */
export function createEventProjector({ workspace, snapshotBefore, emit }) {
  /** @type {Map<string, { path: string, content: string, action: FileAction, language: string }>} */
  const emitted = new Map();
  /** @type {Map<string, string>} */
  const toolPaths = new Map();
  const logs = [];
  let finalText = '';
  let textBuffer = '';
  let lastThoughtAt = 0;
  let lastThought = '';
  let currentStep = 1;
  let currentPhase = 'analyzing';
  let sawWrite = false;

  const log = (message) => {
    logs.push(message);
  };

  const agentEvent = (phase, message, extra = {}) => {
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
   * @param {string} relativePath
   */
  async function emitFile(relativePath) {
    const normalizedPath = relativeArtifactPath(workspace, relativePath);
    if (!normalizedPath) return;
    let absolute;
    try {
      absolute = path.resolve(workspace, normalizedPath);
      if (absolute !== workspace && !absolute.startsWith(`${workspace}${path.sep}`)) return;
      const stat = await fs.stat(absolute);
      if (!stat.isFile() || stat.size > 1024 * 1024) return;
      const content = await fs.readFile(absolute, 'utf8');
      const previous = snapshotBefore.get(normalizedPath);
      const action = previous ? 'modified' : 'created';
      const existing = emitted.get(normalizedPath);
      if (existing && existing.content === content) return;
      const artifact = { path: normalizedPath, content, action, language: languageForPath(normalizedPath) };
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

  /** @param {Record<string, any>} event */
  async function handle(event) {
    switch (event.type) {
      case 'session':
        currentStep = 1;
        agentEvent('analyzing', `Harness session ready (${event.sessionId ?? 'new'}).`, {
          detail: event.cwd ? `Workspace: ${event.cwd}` : undefined,
        });
        return;

      case 'status': {
        if (event.phase === 'turn_start') {
          currentStep = Math.max(currentStep, 2);
          agentEvent('planning', `Harness turn ${event.turn ?? 1} started.`);
        } else if (event.phase === 'step_start') {
          currentStep = Math.max(currentStep, 3);
          agentEvent(sawWrite ? 'code_generation' : 'planning', `Agent step ${event.step ?? 1}: reasoning and tool use…`);
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

        if (tool === 'write' || tool === 'edit') {
          sawWrite = true;
          currentStep = Math.max(currentStep, 4);
          if (filePath) toolPaths.set(String(event.callId ?? ''), filePath);
          agentEvent('code_generation', `${tool === 'write' ? 'Writing' : 'Editing'} ${filePath || 'a project file'}…`, {
            activeFile: filePath || undefined,
          });
        } else if (tool === 'bash') {
          const command = String(input.command ?? '').replace(/\s+/g, ' ').slice(0, 160);
          agentEvent('validation', command ? `Running: ${command}` : 'Running a validation command…');
        } else if (tool === 'read' || tool === 'read_image' || tool === 'glob' || tool === 'grep') {
          agentEvent('analyzing', `${tool === 'read' ? 'Reading' : 'Searching'} ${filePath || 'the workspace'}…`);
        } else if (tool.startsWith('mcp__dart__')) {
          agentEvent('validation', `Dart tool: ${tool.replace('mcp__dart__', '')}`);
        } else if (tool === 'todo_write') {
          agentEvent('planning', 'Updating the generation plan…');
        } else {
          agentEvent(currentPhase, `Tool call: ${tool}`);
        }
        return;
      }

      case 'tool_result': {
        const callId = String(event.callId ?? '');
        const filePath = toolPaths.get(callId);
        toolPaths.delete(callId);
        if (event.status === 'error') {
          const message = String(event.result ?? 'tool failed').split('\n')[0]?.slice(0, 220);
          agentEvent('validation', `Tool error: ${message}`);
          return;
        }
        if (filePath) {
          await emitFile(filePath);
          agentEvent('code_generation', `✓ ${filePath}`, { activeFile: filePath });
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
   * @param {{ exit?: { code: number | null, stderr?: string, timedOut?: boolean, aborted?: boolean } }} [options]
   */
  async function finish(options = {}) {
    const exit = options.exit;
    if (exit?.aborted) {
      agentEvent('failed', 'Generation cancelled by user.');
      return {
        success: false,
        files: [...emitted.values()],
        validation: { isValid: false, issueCount: 0, summary: 'Cancelled' },
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
 * @param {Array<{ path: string, content: string }>} files
 */
export function validateProject(files) {
  const issues = [];
  const byPath = new Map(files.map((file) => [file.path, file.content]));
  const pubspec = byPath.get('pubspec.yaml');

  if (!pubspec) {
    issues.push({
      filePath: 'pubspec.yaml',
      severity: 'error',
      code: 'MISSING_PUBSPEC',
      message: 'pubspec.yaml is missing; the project cannot build.',
      autoFixAvailable: false,
    });
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

  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.length - errors;
  const summary = issues.length === 0
    ? 'Validation passed: required Flutter files present, no stub markers found.'
    : `${errors} error(s), ${warnings} warning(s): ${issues.slice(0, 3).map((issue) => issue.message).join(' ')}`;

  return { isValid: errors === 0, issues, summary };
}
