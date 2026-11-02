import { create } from 'zustand';
import type { AgentPlan, ValidationReport } from '@/agent/types';
import type { SSEAgentEvent, SSEFileReadyEvent } from '@/agent/harnessClient';

/**
 * Real-time activity for one agent run.
 *
 * Everything in this store is derived from actual harness output — SSE
 * `agent_event` / `file_ready` frames, progress callbacks and preview build
 * logs. There are no canned pipeline stages: if the engine did not emit it,
 * it does not appear in the chat activity.
 */

export type ActivityStatus = 'running' | 'success' | 'error' | 'stopped';

export interface ActivityRun {
  id: string;
  projectId: string;
  prompt: string;
  isInitial: boolean;
  model?: string;
  startedAt: number;
  endedAt: number | null;
  status: ActivityStatus;
  phase: string | null;
  step: number;
  totalSteps: number;
}

interface BaseActivity {
  id: string;
  at: number;
}

export interface ReasoningActivity extends BaseActivity {
  kind: 'reasoning';
  text: string;
}

export interface PhaseActivity extends BaseActivity {
  kind: 'phase';
  phase: string;
  message: string;
  step?: number;
  totalSteps?: number;
}

export interface ToolActivity extends BaseActivity {
  kind: 'tool';
  tool: string;
  title: string;
  detail?: string;
  status: 'running' | 'done' | 'error';
  input?: unknown;
  output?: string;
  toolCallId?: string;
}

export interface FileActivity extends BaseActivity {
  kind: 'file';
  path: string;
  action: 'created' | 'modified' | 'deleted';
  language?: string;
}

export interface TerminalActivity extends BaseActivity {
  kind: 'terminal';
  text: string;
  stream: 'stdout' | 'stderr' | 'info';
}

export interface ValidationActivity extends BaseActivity {
  kind: 'validation';
  report: ValidationReport;
}

export interface ErrorActivity extends BaseActivity {
  kind: 'error';
  message: string;
  stack?: string;
}

export interface CheckpointActivity extends BaseActivity {
  kind: 'checkpoint';
  label: string;
  detail?: string;
}

export interface PlanActivity extends BaseActivity {
  kind: 'plan';
  plan: AgentPlan;
}

export interface BuildActivity extends BaseActivity {
  kind: 'build';
  status: 'started' | 'succeeded' | 'failed' | 'stopped';
  message: string;
}

export type ActivityEvent =
  | ReasoningActivity
  | PhaseActivity
  | ToolActivity
  | FileActivity
  | TerminalActivity
  | ValidationActivity
  | ErrorActivity
  | CheckpointActivity
  | PlanActivity
  | BuildActivity;

interface ActivityState {
  run: ActivityRun | null;
  events: ActivityEvent[];
  files: Record<string, FileActivity>;
  plan: AgentPlan | null;
  validation: ValidationReport | null;
  buildErrors: string[];
  loadedProjectId: string | null;

  begin: (projectId: string, prompt: string, isInitial?: boolean, model?: string) => void;
  load: (projectId: string) => void;
  ingestAgent: (
    event: Omit<Partial<SSEAgentEvent>, 'phase' | 'kind'> & {
      message: string;
      phase?: string;
      kind?: string;
    },
  ) => void;
  ingestFile: (file: SSEFileReadyEvent) => void;
  ingestProgress: (message: string) => void;
  ingestBuildLog: (line: string) => void;
  ingestBuildStatus: (status: string, message: string, errors?: string[]) => void;
  end: (status: Exclude<ActivityStatus, 'running'>, summary?: string) => void;
  clear: () => void;
}

const MAX_EVENTS = 240;
const MAX_BUILD_ERRORS = 24;
const STORAGE_KEY = 'ff-activity-v1';

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function pushEvent(events: ActivityEvent[], event: ActivityEvent): ActivityEvent[] {
  const next = [...events, event];
  return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
}

function lastOfKind<K extends ActivityEvent['kind']>(
  events: ActivityEvent[],
  kind: K,
): Extract<ActivityEvent, { kind: K }> | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.kind === kind) return event as Extract<ActivityEvent, { kind: K }>;
  }
  return undefined;
}

function isDuplicatePhase(events: ActivityEvent[], message: string): boolean {
  const last = lastOfKind(events, 'phase');
  return Boolean(last && last.message === message);
}

function filePathFromMessage(message: string): { path: string; action: 'created' | 'modified' | 'deleted' } | null {
  const created = message.match(/^✓\s+(.+)$/);
  if (created?.[1]) {
    const path = created[1].replace(/\s+\(deleted\)$/, '').trim();
    return path ? { path, action: 'created' } : null;
  }
  const deleted = message.match(/^✕\s+(.+?)(?:\s+\(deleted\))?$/);
  if (deleted?.[1]) return { path: deleted[1].trim(), action: 'deleted' };
  return null;
}

function isCheckpoint(message: string): boolean {
  return /harness session ready|harness finished|collected \d+ files|validation passed|files? merged|preview (?:is )?live|preview build started|repair pass complete/i.test(message);
}

function isError(message: string): boolean {
  return /(?:^|\b)(?:failed|failure|error|exception|timed out|cancelled|aborted)(?:\b|:)/i.test(message);
}

function persist(state: ActivityState): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        projectId: state.run?.projectId ?? state.loadedProjectId,
        run: state.run,
        events: state.events,
      }),
    );
  } catch {
    // Storage can be unavailable (private mode, quota); activity is non-critical.
  }
}

function hydrate(projectId: string): Pick<ActivityState, 'run' | 'events' | 'files' | 'plan' | 'validation' | 'buildErrors' | 'loadedProjectId'> {
  const empty = {
    run: null,
    events: [] as ActivityEvent[],
    files: {} as Record<string, FileActivity>,
    plan: null,
    validation: null,
    buildErrors: [] as string[],
    loadedProjectId: projectId,
  };
  if (typeof sessionStorage === 'undefined') return empty;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as { projectId?: string; run?: ActivityRun | null; events?: ActivityEvent[] };
    if (parsed.projectId !== projectId || !Array.isArray(parsed.events)) return empty;
    const files: Record<string, FileActivity> = {};
    let plan: AgentPlan | null = null;
    let validation: ValidationReport | null = null;
    const buildErrors: string[] = [];
    for (const event of parsed.events) {
      if (event.kind === 'file') files[event.path] = event;
      if (event.kind === 'plan') plan = event.plan;
      if (event.kind === 'validation') validation = event.report;
      if (event.kind === 'error') buildErrors.push(event.message);
    }
    return {
      run: parsed.run ?? null,
      events: parsed.events,
      files,
      plan,
      validation,
      buildErrors: buildErrors.slice(-MAX_BUILD_ERRORS),
      loadedProjectId: projectId,
    };
  } catch {
    return empty;
  }
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  run: null,
  events: [],
  files: {},
  plan: null,
  validation: null,
  buildErrors: [],
  loadedProjectId: null,

  begin: (projectId, prompt, isInitial = false, model) => {
    set({
      run: {
        id: newId(),
        projectId,
        prompt,
        isInitial,
        model,
        startedAt: Date.now(),
        endedAt: null,
        status: 'running',
        phase: 'starting',
        step: 0,
        totalSteps: 7,
      },
      events: [
        {
          kind: 'checkpoint',
          id: newId(),
          at: Date.now(),
          label: isInitial ? 'Generation started' : 'Change requested',
          detail: prompt.slice(0, 220),
        },
      ],
      files: {},
      plan: null,
      validation: null,
      buildErrors: [],
      loadedProjectId: projectId,
    });
    persist(get());
  },

  load: (projectId) => {
    if (!projectId) return;
    const state = get();
    if (state.loadedProjectId === projectId) return;
    set(hydrate(projectId));
  },

  ingestAgent: (event) => {
    const message = String(event.message ?? '').trim();
    if (!message) return;
    const at = event.timestamp ? Date.parse(event.timestamp) || Date.now() : Date.now();

    set((state) => {
      let events = state.events;
      let files = state.files;
      let plan = state.plan;
      let validation = state.validation;
      let buildErrors = state.buildErrors;
      const run = state.run
        ? {
            ...state.run,
            phase: event.phase ?? state.run.phase,
            step: Number(event.stepNumber ?? event.step_number ?? state.run.step) || state.run.step,
            totalSteps: Number(event.totalSteps ?? state.run.totalSteps) || state.run.totalSteps,
          }
        : state.run;

      const add = (activity: ActivityEvent) => {
        events = pushEvent(events, activity);
      };

      if (event.thought && event.thought.trim()) {
        const thought = event.thought.trim();
        const last = lastOfKind(events, 'reasoning');
        if (!last || last.text !== thought) {
          add({ kind: 'reasoning', id: newId(), at, text: thought });
        }
      }

      if (event.plan) {
        plan = event.plan;
        const last = lastOfKind(events, 'plan');
        if (!last || last.plan.id !== event.plan.id) {
          add({ kind: 'plan', id: newId(), at, plan: event.plan });
        }
      }

      if (event.validationReport) {
        validation = event.validationReport;
        add({ kind: 'validation', id: newId(), at, report: event.validationReport });
      }

      const structuredKind = (event as { kind?: string }).kind;
      const toolCallId = (event as { toolCallId?: string }).toolCallId;

      if (structuredKind === 'tool') {
        add({
          kind: 'tool',
          id: newId(),
          at,
          tool: String((event as { tool?: string }).tool ?? 'tool'),
          title: message,
          detail: (event as { detail?: string }).detail,
          status: 'running',
          input: (event as { toolInput?: unknown }).toolInput,
          toolCallId,
        });
      } else if (structuredKind === 'tool_result' && toolCallId) {
        const index = [...events].reverse().findIndex(
          (candidate) => candidate.kind === 'tool' && candidate.toolCallId === toolCallId,
        );
        if (index >= 0) {
          const realIndex = events.length - 1 - index;
          const tool = events[realIndex] as ToolActivity;
          const status = (event as { status?: string }).status === 'error' ? 'error' : 'done';
          const next = [...events];
          next[realIndex] = { ...tool, status, output: message };
          events = next;
        }
        const completedPath = (event as { filePath?: string }).filePath;
        if (completedPath) {
          const previous = files[completedPath];
          const file: FileActivity = {
            kind: 'file',
            id: previous?.id ?? newId(),
            at,
            path: completedPath,
            action: previous?.action === 'created' ? 'modified' : 'created',
            language: previous?.language,
          };
          files = { ...files, [completedPath]: file };
          const lastFile = lastOfKind(events, 'file');
          if (!lastFile || lastFile.path !== file.path || lastFile.action !== file.action) add(file);
        }
      } else {
        const fileChange = filePathFromMessage(message);
        if (fileChange) {
          const previous = files[fileChange.path];
          const action = previous && previous.action === 'created' && fileChange.action === 'created'
            ? 'modified'
            : fileChange.action;
          const file: FileActivity = {
            kind: 'file',
            id: previous?.id ?? newId(),
            at,
            path: fileChange.path,
            action,
            language: previous?.language,
          };
          files = { ...files, [fileChange.path]: file };
          const lastFile = lastOfKind(events, 'file');
          if (!lastFile || lastFile.path !== file.path || lastFile.action !== action) {
            add(file);
          }
        } else if (structuredKind === 'reasoning') {
          // Thought-only event; reasoning was already added above.
        } else if (isError(message) && event.phase === 'failed') {
          add({ kind: 'error', id: newId(), at, message });
          buildErrors = [...buildErrors, message].slice(-MAX_BUILD_ERRORS);
        } else if (isCheckpoint(message)) {
          const lastCheckpoint = lastOfKind(events, 'checkpoint');
          if (!lastCheckpoint || lastCheckpoint.label !== message) {
            add({ kind: 'checkpoint', id: newId(), at, label: message });
          }
        } else if (!isDuplicatePhase(events, message)) {
          add({
            kind: 'phase',
            id: newId(),
            at,
            phase: String(event.phase ?? 'working'),
            message,
            step: Number(event.stepNumber ?? event.step_number ?? 0) || undefined,
            totalSteps: Number(event.totalSteps ?? 0) || undefined,
          });
        }
      }

      return { run, events, files, plan, validation, buildErrors };
    });
    persist(get());
  },

  ingestFile: (file) => {
    if (!file?.path) return;
    const at = Date.now();
    set((state) => {
      const previous = state.files[file.path];
      const action = file.action === 'deleted'
        ? 'deleted'
        : previous?.action === 'created' && file.action === 'created'
          ? 'modified'
          : file.action;
      const activity: FileActivity = {
        kind: 'file',
        id: previous?.id ?? newId(),
        at,
        path: file.path,
        action,
        language: file.language,
      };
      const last = lastOfKind(state.events, 'file');
      return {
        files: { ...state.files, [file.path]: activity },
        events: !last || last.path !== file.path || last.action !== action
          ? pushEvent(state.events, activity)
          : state.events,
      };
    });
    persist(get());
  },

  ingestProgress: (message) => {
    const text = String(message ?? '').trim();
    if (!text) return;
    const at = Date.now();

    set((state) => {
      let events = state.events;
      let files = state.files;
      let buildErrors = state.buildErrors;
      const run = state.run ? { ...state.run } : null;
      const add = (activity: ActivityEvent) => {
        events = pushEvent(events, activity);
      };

      // The terminal is the unfiltered, append-only log — this is the real
      // time stream, including build/repair lines that never become phases.
      const lastTerminal = lastOfKind(events, 'terminal');
      if (!lastTerminal || lastTerminal.text !== text) {
        add({ kind: 'terminal', id: newId(), at, text, stream: isError(text) ? 'stderr' : 'stdout' });
      }

      const fileChange = filePathFromMessage(text);
      if (fileChange) {
        const previous = files[fileChange.path];
        const action = previous?.action === 'created' && fileChange.action === 'created'
          ? 'modified'
          : fileChange.action;
        const file: FileActivity = {
          kind: 'file',
          id: previous?.id ?? newId(),
          at,
          path: fileChange.path,
          action,
          language: previous?.language,
        };
        files = { ...files, [fileChange.path]: file };
        const lastFile = lastOfKind(events, 'file');
        if (!lastFile || lastFile.path !== file.path || lastFile.action !== action) add(file);
      } else if (/preview build started|preview is live|repair pass complete/i.test(text)) {
        const last = lastOfKind(events, 'checkpoint');
        if (!last || last.label !== text) add({ kind: 'checkpoint', id: newId(), at, label: text });
      } else if (/^\[repair|^✗|build failed|error:|exception/i.test(text)) {
        add({ kind: 'error', id: newId(), at, message: text });
        buildErrors = [...buildErrors, text].slice(-MAX_BUILD_ERRORS);
      } else if (!isDuplicatePhase(events, text) && !/^harness engine active|^harness attempt|^edge |^ai generated|^sending request|^generating with local/i.test(text)) {
        add({ kind: 'phase', id: newId(), at, phase: run?.phase ?? 'working', message: text });
      }

      return { run, events, files, buildErrors };
    });
    persist(get());
  },

  ingestBuildLog: (line) => {
    const text = String(line ?? '').trim();
    if (!text) return;
    set((state) => {
      const last = lastOfKind(state.events, 'terminal');
      if (last?.text === text) return state;
      const isErr = /error|exception|failed to|because|not found|invalid|undefined/i.test(text);
      return {
        events: pushEvent(state.events, {
          kind: 'terminal',
          id: newId(),
          at: Date.now(),
          text,
          stream: isErr ? 'stderr' : 'stdout',
        }),
        buildErrors: isErr
          ? [...state.buildErrors, text].slice(-MAX_BUILD_ERRORS)
          : state.buildErrors,
      };
    });
    persist(get());
  },

  ingestBuildStatus: (status, message, errors = []) => {
    const normalized = status === 'queued' || status === 'building'
      ? 'started'
      : status === 'running'
        ? 'succeeded'
        : status === 'failed'
          ? 'failed'
          : status === 'stopped'
            ? 'stopped'
            : null;
    if (!normalized) return;

    set((state) => {
      const last = lastOfKind(state.events, 'build');
      if (last?.status === normalized) return state;
      let events = pushEvent(state.events, {
        kind: 'build',
        id: newId(),
        at: Date.now(),
        status: normalized,
        message,
      });
      if (normalized === 'succeeded') {
        events = pushEvent(events, {
          kind: 'checkpoint',
          id: newId(),
          at: Date.now(),
          label: message,
        });
      }
      if (normalized === 'failed') {
        events = pushEvent(events, {
          kind: 'error',
          id: newId(),
          at: Date.now(),
          message,
          stack: errors.join('\n'),
        });
      }
      return {
        events,
        buildErrors: normalized === 'failed' && errors.length > 0
          ? [...state.buildErrors, ...errors].slice(-MAX_BUILD_ERRORS)
          : state.buildErrors,
      };
    });
    persist(get());
  },

  end: (status, summary) => {
    set((state) => {
      if (!state.run || state.run.status !== 'running') return state;
      const at = Date.now();
      let events = state.events;
      if (summary) {
        events = pushEvent(events, {
          kind: 'checkpoint',
          id: newId(),
          at,
          label: summary,
        });
      }
      return {
        run: { ...state.run, status, endedAt: at },
        events,
      };
    });
    persist(get());
  },

  clear: () => {
    set({
      run: null,
      events: [],
      files: {},
      plan: null,
      validation: null,
      buildErrors: [],
      loadedProjectId: null,
    });
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  },
}));
