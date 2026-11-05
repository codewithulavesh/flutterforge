/**
 * harnessClient.ts — client for the FlutterForge DeepSeek Harness engine.
 *
 * The engine is a local Node service (Electron main process or `npm run
 * server`) that drives `dsh headless --json`. It speaks the same SSE event
 * vocabulary the workspace UI already consumes:
 *
 *   agent_event  — progress update from the harness
 *   token        — text committed by the harness
 *   file_ready   — a generated file is available
 *   files_merged — all files collected
 *   validation   — deterministic quality report
 *   error        — fatal error
 *   done         — stream finished
 */

import type {
  AgentContext,
  AgentEvent,
  AgentFileArtifact,
  AgentGenerationOptions,
  AgentGenerationResult,
  AgentPlan,
  ValidationReport,
} from './types';
import { AgentPlanner } from './planner';

const HARNESS_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_HARNESS_API_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_HARNESS_API_URL) ||
  '';

// ── SSE event shapes ──────────────────────────────────────────────────────────

export interface SSEAgentEvent {
  phase: AgentEvent['phase'];
  stepNumber?: number;
  totalSteps?: number;
  step_number?: number;
  total_steps?: number;
  message: string;
  detail?: string;
  thought?: string;
  node?: string;
  timestamp?: string;
  activeFile?: string;
  plan?: AgentPlan;
  generatedFiles?: AgentFileArtifact[];
  validationReport?: ValidationReport;
  retrievedPatterns?: AgentEvent['retrievedPatterns'];
  /** Structured activity kind emitted by the harness projector. */
  kind?: 'phase' | 'reasoning' | 'tool' | 'tool_result' | 'validation' | 'file' | 'error';
  tool?: string;
  toolInput?: unknown;
  toolCallId?: string;
  status?: string;
  filePath?: string;
}

export interface SSETokenEvent {
  node: string;
  token: string;
  phase: string;
}

export interface SSEFileReadyEvent {
  path: string;
  content: string;
  action: 'created' | 'modified' | 'deleted';
  language: string;
  node: string;
}

export interface SSEFilesMergedEvent {
  count: number;
  paths: string[];
}

export interface SSEValidationEvent {
  is_valid: boolean;
  summary: string;
  issue_count: number;
}

export interface SSEDoneEvent {
  success?: boolean;
  fileCount?: number;
  sessionId?: string;
  workspace?: string;
  summary?: string;
  route?: HarnessRouting;
}

/** The model route the local engine actually used (keys never included). */
export interface HarnessRouting {
  requestedRole: 'frontier' | 'economy';
  role: 'frontier' | 'economy';
  entitled: boolean;
  provider: string;
  model: string;
  keySource: string;
  downgraded: boolean;
  reason: string;
}

export interface HarnessCapabilities {
  engine: 'deepseek-harness';
  runtime: { available: boolean; version: string | null; path: string | null; error?: string };
  profile: { name: string; installed: boolean; path: string };
  route: { provider: string; model: string };
  flutter: { available: boolean; version: string | null; error?: string };
  desktop: { macos: boolean; windows: boolean };
  dshHome: string;
}

export type StreamEvent =
  | { type: 'agent_event'; data: SSEAgentEvent }
  | { type: 'token'; data: SSETokenEvent }
  | { type: 'file_ready'; data: SSEFileReadyEvent }
  | { type: 'files_merged'; data: SSEFilesMergedEvent }
  | { type: 'validation'; data: SSEValidationEvent }
  | { type: 'chat_answer'; data: { answer: string } }
  | { type: 'routing'; data: HarnessRouting }
  | { type: 'error'; data: { message: string; code?: string } }
  | { type: 'done'; data: SSEDoneEvent };

// ── Harness client ────────────────────────────────────────────────────────────

export class HarnessClient {
  private baseUrl: string;

  constructor(baseUrl: string = HARNESS_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  private url(pathname: string): string {
    return `${this.baseUrl}${pathname}`;
  }

  /**
   * Stream a generation turn from the local harness engine.
   */
  async *stream(
    prompt: string,
    context: AgentContext,
    options: AgentGenerationOptions = {},
    signal?: AbortSignal,
  ): AsyncGenerator<StreamEvent> {
    const isIncremental = Boolean(options.isIncremental);
    // Initial generation starts from an empty engine workspace: the UI starter
    // is only a pre-generation placeholder and otherwise distracts the model
    // into preserving demo screens. Incremental runs keep the real project, but
    // filter Supabase files when the user asked for a local-only app.
    const localOnlyStarter = [
      /^supabase\//,
      /^lib\/features\/(auth|onboarding|profile|settings|shared)\//,
      /^lib\/core\/services\/supabase_service\.dart$/,
      /^lib\/core\/router\/app_router\.dart$/,
      /^lib\/core\/widgets\/(app_header|main_nav_scaffold)\.dart$/,
      /^lib\/main\.dart$/,
      /^pubspec\.yaml$/,
    ];
    const engineFiles = !isIncremental
      ? []
      : context.usesSupabase === false
        ? context.existingFiles.filter((file) => (
          !localOnlyStarter.some((pattern) => pattern.test(file.path))
          && !/supabase_flutter|SupabaseService|Supabase\.initialize/.test(file.content)
        ))
        : context.existingFiles;
    const body = {
      prompt,
      project_id: context.projectId,
      project_name: context.projectName,
      project_description: context.projectDescription ?? '',
      platform: context.platform ?? 'web',
      app_id: context.appId ?? '',
      uses_supabase: context.usesSupabase === true,
      active_file: context.activeFile ?? '',
      build_errors: (context.buildErrors ?? []).slice(-8),
      existing_files: engineFiles.map((file) => ({
        path: file.path,
        content: file.content,
        is_directory: file.isDirectory ?? file.is_directory ?? false,
      })),
      conversation_history: context.conversationHistory.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      api_key: options.modelConfig?.apiKey ?? '',
      model_name: options.modelConfig?.modelName ?? null,
      task_role: options.modelRole ?? (isIncremental ? 'economy' : 'frontier'),
      plan: options.plan ?? 'free',
      state_management: options.stateManagement ?? 'provider',
      mode: isIncremental ? 'edit' : 'new',
      is_initial_generation: !isIncremental,
      include_sql_migrations: options.includeSqlMigrations !== false,
      design_brief: options.designBrief ?? this.deriveDesignBrief(prompt, context, isIncremental),
    };

    const response = await fetch(this.url('/api/harness/stream'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      let detail = '';
      try {
        const payload = await response.json() as { error?: string };
        detail = payload?.error ?? '';
      } catch {
        detail = await response.text();
      }
      throw new Error(`Harness engine error ${response.status}: ${detail || response.statusText}`);
    }

    yield* this._readSSE(response);
  }

  /**
   * Derive the project's design contract from the original brief. Incremental
   * edits reuse the first user turn so an app never changes identity midway;
   * the server also persists the brief per workspace.
   */
  private deriveDesignBrief(prompt: string, context: AgentContext, isIncremental: boolean) {
    const historySeed = context.conversationHistory.find((message) => message.role === 'user')?.content;
    const seed = isIncremental && historySeed ? historySeed : prompt;
    return AgentPlanner.planDesign(seed, AgentPlanner.detectDomain(seed.toLowerCase()));
  }

  /** Cancel/reset the persisted session and workspace for a project. */
  async reset(projectId: string): Promise<void> {
    const response = await fetch(this.url(`/api/harness/session/${encodeURIComponent(projectId)}`), {
      method: 'DELETE',
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Could not reset harness session (${response.status})`);
    }
  }

  private async *_readSSE(response: Response): AsyncGenerator<StreamEvent> {
    if (!response.body) throw new Error('Harness response has no body stream.');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split(/\r?\n\r?\n/);
      buffer = chunks.pop() ?? '';

      for (const chunk of chunks) {
        let eventType = 'agent_event';
        const dataLines: string[] = [];
        for (const line of chunk.split(/\r?\n/)) {
          if (line.startsWith('event: ')) eventType = line.slice(7).trim();
          else if (line.startsWith('data: ')) dataLines.push(line.slice(6).trim());
          // Comment/heartbeat lines are ignored.
        }
        if (dataLines.length === 0) continue;
        const dataStr = dataLines.join('\n');
        try {
          const parsed = JSON.parse(dataStr);
          yield { type: eventType, data: parsed } as StreamEvent;
        } catch {
          // Malformed frame — skip rather than abort the stream.
        }
      }
    }
  }

  /** Check whether the local harness engine is reachable. */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(this.url('/api/harness/health'), {
        signal: AbortSignal.timeout(2500),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /** Absolute path of the harness workspace for a project. */
  async workspacePath(projectId: string): Promise<string | null> {
    try {
      const response = await fetch(
        this.url(`/api/harness/workspace?project_id=${encodeURIComponent(projectId)}`),
        { signal: AbortSignal.timeout(4000) },
      );
      if (!response.ok) return null;
      const body = await response.json() as { workspace?: string };
      return body.workspace ?? null;
    } catch {
      return null;
    }
  }

  /** Engine/runtime/profile/toolchain capability snapshot. */
  async capabilities(): Promise<HarnessCapabilities | null> {
    try {
      const response = await fetch(this.url('/api/harness/capabilities'), {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return null;
      return await response.json() as HarnessCapabilities;
    } catch {
      return null;
    }
  }
}

/**
 * Drop-in entry point used by the project store.
 *
 * Uses the local DeepSeek Harness engine; falls back to the in-browser TS
 * agent when the engine is unavailable (plain web dev with no `npm run server`,
 * or a machine without the harness runtime).
 */
export async function runFlutterSupabaseAgentHarness(
  prompt: string,
  context: AgentContext,
  options: AgentGenerationOptions = {},
): Promise<AgentGenerationResult> {
  const client = new HarnessClient();
  const isEngineUp = await client.isHealthy();

  if (!isEngineUp) {
    console.warn('[HarnessClient] Engine unreachable — falling back to the in-browser TS agent');
    const { FlutterSupabaseAgent } = await import('./index');
    return FlutterSupabaseAgent.execute(prompt, context, options);
  }

  const startTime = performance.now();
  const files: AgentFileArtifact[] = [];
  const logs: string[] = [];
  let plan: AgentPlan | undefined;
  let validationReport: ValidationReport | undefined;
  let harnessSummary = '';
  let success = false;

  const abortController = new AbortController();
  const externalSignal = options.signal;
  if (externalSignal) {
    if (externalSignal.aborted) abortController.abort();
    else externalSignal.addEventListener('abort', () => abortController.abort(), { once: true });
  }

  const { addAgentEvent } = await import('@/stores/terminal.store').then((module) => module.useTerminalStore.getState());

  try {
    for await (const event of client.stream(prompt, context, options, abortController.signal)) {
      switch (event.type) {
        case 'agent_event': {
          const data = event.data as SSEAgentEvent;
          const mappedEvent: AgentEvent & {
            node?: string;
            kind?: string;
            tool?: string;
            toolInput?: unknown;
            toolCallId?: string;
            status?: string;
            filePath?: string;
          } = {
            phase: data.phase || 'code_generation',
            stepNumber: data.stepNumber ?? data.step_number ?? 1,
            totalSteps: data.totalSteps ?? data.total_steps ?? 7,
            message: data.message || '',
            detail: data.detail,
            thought: data.thought,
            node: data.node,
            activeFile: data.activeFile,
            plan: data.plan,
            generatedFiles: data.generatedFiles,
            validationReport: data.validationReport,
            retrievedPatterns: data.retrievedPatterns,
            timestamp: data.timestamp ?? new Date().toISOString(),
            kind: data.kind,
            tool: data.tool,
            toolInput: data.toolInput,
            toolCallId: data.toolCallId,
            status: data.status,
            filePath: data.filePath,
          };

          addAgentEvent(mappedEvent as SSEAgentEvent);
          options.onEvent?.(mappedEvent);
          logs.push(`[${(data.node ?? data.phase ?? '').toUpperCase()}] ${data.message}`);
          break;
        }

        case 'token': {
          // Harness text is committed, not streamed token-by-token. It is not
          // needed for file generation; chat answers already take another path.
          break;
        }

        case 'file_ready': {
          const file = event.data as SSEFileReadyEvent;
          options.onFile?.(file);
          const existing = files.findIndex((candidate) => candidate.path === file.path);
          const artifact: AgentFileArtifact = {
            path: file.path,
            content: file.content,
            language: file.language as AgentFileArtifact['language'],
            isNew: file.action === 'created',
            action: file.action,
          };
          if (existing >= 0) files[existing] = artifact;
          else files.push(artifact);

          if (file.action !== 'deleted') {
            const synthetic: AgentEvent & { node?: string } = {
              phase: 'code_generation',
              stepNumber: 4,
              totalSteps: 7,
              node: 'generate_batch',
              message: `✓ ${file.path}`,
              timestamp: new Date().toISOString(),
            };
            addAgentEvent(synthetic as SSEAgentEvent);
            options.onEvent?.(synthetic);
          }
          break;
        }

        case 'files_merged': {
          const merged = event.data as SSEFilesMergedEvent;
          const synthetic: AgentEvent & { node?: string } = {
            phase: 'code_generation',
            stepNumber: 4,
            totalSteps: 7,
            node: 'merge_files',
            message: `Collected ${merged.count} files — validating…`,
            timestamp: new Date().toISOString(),
          };
          addAgentEvent(synthetic as SSEAgentEvent);
          options.onEvent?.(synthetic);
          break;
        }

        case 'validation': {
          const validation = event.data as SSEValidationEvent;
          validationReport = {
            isValid: validation.is_valid,
            issues: [],
            fixedIssues: [],
            summary: validation.summary,
          };
          break;
        }

        case 'chat_answer': {
          harnessSummary = (event.data as { answer: string }).answer;
          break;
        }

        case 'routing': {
          const route = event.data as HarnessRouting;
          const synthetic: AgentEvent & { node?: string } = {
            phase: 'planning',
            stepNumber: 1,
            totalSteps: 7,
            node: 'model_route',
            message: `${route.role === 'frontier' ? 'Frontier' : 'Fast'} route · ${route.provider} · ${route.model}${route.downgraded ? ' (downgraded)' : ''}`,
            detail: route.reason,
            timestamp: new Date().toISOString(),
          };
          addAgentEvent(synthetic as SSEAgentEvent);
          options.onEvent?.(synthetic);
          logs.push(`[ROUTE] ${route.role} ${route.provider}/${route.model} — ${route.reason}`);
          break;
        }

        case 'error': {
          const error = event.data as { message: string; code?: string };
          throw new Error(error.message || 'Harness generation failed.');
        }

        case 'done': {
          const done = event.data as SSEDoneEvent;
          success = done.success !== false;
          harnessSummary = done.summary || harnessSummary;
          break;
        }
      }
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      logs.push('[ABORTED] Generation cancelled by user');
    } else {
      throw error;
    }
  }

  const durationMs = Math.round(performance.now() - startTime);

  // A fresh project is only usable with a package manifest and an entry point.
  // Reject a partial agent answer so the store can retry with the next key or
  // the quality model instead of saving a broken project.
  if (!options.isIncremental) {
    const paths = new Set(files.map((file) => file.path));
    const missingCore = ['pubspec.yaml', 'lib/main.dart'].filter((file) => !paths.has(file));
    if (missingCore.length > 0) {
      throw new Error(`The harness returned an incomplete project (missing ${missingCore.join(', ')}).`);
    }
  }

  if (!plan) {
    const { AgentPlanner } = await import('./planner');
    plan = AgentPlanner.plan(prompt, context);
  }
  if (!validationReport) {
    validationReport = { isValid: false, issues: [], fixedIssues: [], summary: 'Not validated' };
  }

  return {
    success,
    plan,
    files,
    validationReport,
    summary: harnessSummary || `Generated ${files.length} files in ${durationMs}ms`,
    durationMs,
    logs,
    retrievedPatterns: [],
  };
}

/** Small helper for the workspace header: is the optional engine available? */
export async function getHarnessCapabilities(): Promise<HarnessCapabilities | null> {
  return new HarnessClient().capabilities();
}
