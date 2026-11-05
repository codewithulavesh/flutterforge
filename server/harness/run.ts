import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createEventProjector } from './events.js';
import { runHarness } from './dsh.js';
import {
  diffSnapshots,
  ensureDirectory,
  languageForPath,
  materializeFiles,
  parseCodeBlocks,
  resetDirectory,
  snapshotFiles,
} from './workspace.js';
import { buildAgentsMd, buildTaskPrompt } from './prompt.js';
import { normalizeProjectPackage, pruneSupabaseArtifacts } from './normalize.js';
import { ensureSkills } from './skills.js';
import {
  loadDesignBrief,
  sanitizeDesignBrief,
  saveDesignBrief,
  DesignBrief,
} from './design.js';
import { getProjectDataRoot } from '../paths.js';

const SESSION_FILE = '.flutterforge/session.json';
const ACTIVE_PROJECTS = new Set<string>();

export function getWorkspacesRoot(): string {
  return process.env.FLUTTERFORGE_WORKSPACES || path.join(getProjectDataRoot(), 'workspaces');
}

export function safeProjectKey(projectId: string): string {
  const raw = String(projectId ?? '').trim();
  const readable = raw.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
  if (readable.length >= 3 && readable === raw) return readable;
  const digest = createHash('sha256').update(raw || 'default').digest('hex').slice(0, 12);
  return `${readable || 'project'}-${digest}`;
}

export function getProjectWorkspace(projectId: string): string {
  return path.join(getWorkspacesRoot(), safeProjectKey(projectId));
}

async function readSession(workspace: string): Promise<{ sessionId: string } | null> {
  try {
    const raw = await fs.readFile(path.join(workspace, SESSION_FILE), 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.sessionId !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeSession(workspace: string, sessionId: string): Promise<void> {
  const dir = path.join(workspace, '.flutterforge');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, 'session.json'),
    JSON.stringify({ sessionId, updatedAt: new Date().toISOString() }, null, 2),
    'utf8',
  );
}

async function ensureAgentsFile(workspace: string, usesSupabase?: boolean, designBrief?: DesignBrief | null): Promise<void> {
  const file = path.join(workspace, 'AGENTS.md');
  const content = buildAgentsMd(Boolean(usesSupabase), designBrief);
  try {
    const current = await fs.readFile(file, 'utf8');
    if (current === content) return;
  } catch {
    // missing
  }
  await fs.writeFile(file, content, 'utf8');
}

export async function resetProject(projectId: string): Promise<string> {
  const workspace = getProjectWorkspace(projectId);
  await resetDirectory(workspace);
  return workspace;
}

export interface RunGenerationInput {
  projectId: string;
  prompt: string;
  projectName?: string;
  projectDescription?: string;
  appId?: string;
  usesSupabase?: boolean;
  activeFile?: string;
  buildErrors?: string[];
  platform?: string;
  stateManagement?: string;
  files?: Array<{ path: string; content?: string | null; is_directory?: boolean; isDirectory?: boolean }>;
  conversationHistory?: Array<{ role: string; content: string }>;
  isIncremental?: boolean;
  designBrief?: any;
  includeSqlMigrations?: boolean;
  fresh?: boolean;
  apiKey?: string;
  model?: string;
  signal?: AbortSignal;
  emit: (type: string, data: Record<string, any>) => void;
}

export async function runGeneration(input: RunGenerationInput) {
  const projectKey = safeProjectKey(input.projectId);
  if (ACTIVE_PROJECTS.has(projectKey)) {
    const error: any = new Error('A generation for this project is already running.');
    error.code = 'ALREADY_RUNNING';
    throw error;
  }
  ACTIVE_PROJECTS.add(projectKey);

  const workspace = getProjectWorkspace(input.projectId);
  try {
    if (input.fresh) {
      await resetDirectory(workspace);
    } else {
      await ensureDirectory(workspace);
    }

    input.emit('agent_event', {
      phase: 'analyzing',
      stepNumber: 1,
      totalSteps: 7,
      message: `Preparing harness workspace (${input.fresh ? 'new project' : 'incremental edit'})…`,
      timestamp: new Date().toISOString(),
      node: 'harness',
    });

    const materialized = await materializeFiles(workspace, input.files ?? []);
    const storedDesign = await loadDesignBrief(workspace);
    const incomingDesign = sanitizeDesignBrief(input.designBrief);
    const designBrief = storedDesign || incomingDesign;
    if (incomingDesign && !storedDesign) await saveDesignBrief(workspace, incomingDesign);
    await ensureAgentsFile(workspace, input.usesSupabase, designBrief);
    const skills = await ensureSkills(workspace, Boolean(input.usesSupabase));
    input.emit('agent_event', {
      phase: 'analyzing',
      stepNumber: 1,
      totalSteps: 7,
      message: `Loaded ${skills.length} project skill(s): ${skills.join(', ')}.`,
      timestamp: new Date().toISOString(),
      node: 'classify_intent',
    });
    const snapshotBefore = await snapshotFiles(workspace);

    const priorSession = input.fresh ? null : await readSession(workspace);
    const sessionId = priorSession?.sessionId;

    input.emit('agent_event', {
      phase: 'planning',
      stepNumber: 2,
      totalSteps: 7,
      message: materialized > 0
        ? `Loaded ${materialized} existing file(s); routing to the DeepSeek Harness engine…`
        : 'Empty workspace; starting a new Flutter project with the DeepSeek Harness engine…',
      timestamp: new Date().toISOString(),
      node: 'harness',
    });

    const prompt = buildTaskPrompt({
      prompt: input.prompt,
      projectName: input.projectName || 'FlutterForgeApp',
      appId: input.appId,
      projectDescription: input.projectDescription,
      platform: input.platform,
      stateManagement: input.stateManagement,
      usesSupabase: Boolean(input.usesSupabase),
      activeFile: input.activeFile,
      buildErrors: input.buildErrors,
      files: (input.files ?? []).filter((file) => !file.is_directory && !file.isDirectory && typeof file.content === 'string') as any,
      conversationHistory: input.conversationHistory,
      isIncremental: Boolean(input.isIncremental),
      includeSqlMigrations: input.includeSqlMigrations !== false,
      designBrief,
    });

    const projector = createEventProjector({ workspace, snapshotBefore, emit: input.emit });
    let runtimeSessionId = sessionId;
    let exitEvent: any = null;
    let harnessError: any = null;

    try {
      for await (const event of runHarness({
        cwd: workspace,
        prompt,
        sessionId,
        apiKey: input.apiKey,
        model: input.model,
        signal: input.signal,
      })) {
        if (event.type === 'session' && typeof event.sessionId === 'string') {
          runtimeSessionId = event.sessionId;
        }
        if (event.type === 'exit') {
          exitEvent = event;
          continue;
        }
        await projector.handle(event);
      }
    } catch (error) {
      harnessError = error;
    }

    const normalized = input.appId
      ? await normalizeProjectPackage(workspace, input.appId)
      : { changed: [], oldName: '' };
    if (normalized.changed.length > 0) {
      input.emit('agent_event', {
        phase: 'code_generation',
        stepNumber: 4,
        totalSteps: 7,
        message: `Aligned ${normalized.changed.length} file(s) to package ${input.appId}.`,
        timestamp: new Date().toISOString(),
        node: 'generate_batch',
        kind: 'phase',
      });
    }

    if (input.usesSupabase === false) {
      const removed = await pruneSupabaseArtifacts(workspace);
      if (removed.length > 0) {
        input.emit('agent_event', {
          phase: 'validation',
          stepNumber: 6,
          totalSteps: 7,
          message: 'Removed unused Supabase scaffolding (local-only app).',
          timestamp: new Date().toISOString(),
          node: 'validate_code',
          kind: 'phase',
        });
      }
    }

    let result = await projector.finish({ exit: exitEvent ?? undefined });

    if (result.files.length === 0 && result.finalText) {
      const recovered = parseCodeBlocks(result.finalText);
      if (recovered.length > 0) {
        await materializeFiles(workspace, recovered);
        const after = await snapshotFiles(workspace);
        const changes = diffSnapshots(snapshotBefore, after);
        for (const change of changes) {
          input.emit('file_ready', {
            path: change.path,
            content: change.content,
            action: change.action,
            language: change.language,
            node: 'harness',
          });
        }
        result = { ...result, files: changes.map((change) => ({ ...change })), success: true };
        input.emit('agent_event', {
          phase: 'code_generation',
          stepNumber: 4,
          totalSteps: 7,
          message: `Recovered ${changes.length} file(s) from the harness answer.`,
          timestamp: new Date().toISOString(),
          node: 'harness',
          kind: 'phase',
        });
      }
    }

    if (runtimeSessionId) await writeSession(workspace, runtimeSessionId);

    if (input.fresh) {
      const finalFiles = await snapshotFiles(workspace);
      const missingCore = ['pubspec.yaml', 'lib/main.dart'].filter((file) => !finalFiles.has(file));
      if (missingCore.length > 0) {
        const error: any = new Error(
          `The harness did not produce a complete project (missing ${missingCore.join(', ')}).`,
        );
        error.code = 'HARNESS_INCOMPLETE';
        throw error;
      }
    }

    if (!result.success && result.files.length === 0) {
      const detail = harnessError?.message
        || (exitEvent?.stderr ? exitEvent.stderr.split('\n').slice(-4).join(' ') : '')
        || 'The harness produced no files.';
      const error: any = new Error(detail.slice(0, 1200));
      error.code = 'HARNESS_FAILED';
      throw error;
    }

    return {
      ...result,
      workspace,
      projectKey,
      designBrief,
      sessionId: runtimeSessionId,
      exit: exitEvent,
    };
  } finally {
    ACTIVE_PROJECTS.delete(projectKey);
  }
}

export async function getProjectSnapshot(projectId: string) {
  const workspace = getProjectWorkspace(projectId);
  const snapshot = await snapshotFiles(workspace);
  return {
    workspace,
    files: [...snapshot.entries()].map(([filePath, entry]) => ({
      path: filePath,
      content: entry.content,
      language: languageForPath(filePath),
    })),
  };
}

