import { create } from 'zustand';
import { supabase } from '@/services/supabase';
import type { Project, ProjectFile, ProjectVersion, AIConversation, AIMessage, GenerationTask, Build, Dependency, Deployment, FileChange } from '@/types';
import { useAuthStore } from './auth.store';
import { generateFlutterProjectFiles, generateMinimalStarterFiles } from '@/utils/flutterTemplates';
import { applyAppIdToPubspec, generateUniqueAppId } from '@/utils/appId';
import { detectSupabaseNeed, isExplicitLocalOnly } from '@/utils/backendNeed';
import { classifyChatIntent } from '@/agent/chatIntent';
import { answerGeneralQuestion } from '@/agent/chatAnswer';
import { ChatContextHandler } from '@/agent/chatContext';
import { FlutterSupabaseAgent, AgentContextBuilder, AgentPlanner, MultiFileCodeGenerator, keyPool, SkillRegistry } from '@/agent';
import type { SSEFileReadyEvent } from '@/agent/harnessClient';
import { usePreviewStore } from './preview.store';
import { useWorkspaceStore } from './workspace.store';
import { useTerminalStore } from './terminal.store';
import { useActivityStore } from './activity.store';
import { useCredentialsStore } from './credentials.store';
import { ECONOMY_MODEL, FRONTIER_MODEL, resolveModelChoice, type ModelPreference } from '@/agent/modelRouting';
import { snapshotHash } from '@/utils/versionDiff';

/** One in-flight promise per key — collapsing concurrent duplicate calls
 *  (React StrictMode double-mounts, double navigations) prevents races like
 *  two `loadConversation` runs inserting two chat conversations. */
const inFlightCalls = new Map<string, Promise<unknown>>();

function ensureSingleFlight<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inFlightCalls.get(key);
  if (existing) return existing as Promise<T>;
  const promise = run().finally(() => {
    inFlightCalls.delete(key);
  });
  inFlightCalls.set(key, promise);
  return promise;
}

function snapshotProjectFiles(files: ProjectFile[]): Record<string, { content: string }> {
  const snapshot: Record<string, { content: string }> = {};
  for (const file of files) {
    if (!file.is_directory) snapshot[file.path] = { content: file.content };
  }
  return snapshot;
}

export interface SendMessageOptions {
  /** Explicit initial-generation flag (wizard/first prompt). Falls back to heuristics when omitted. */
  isInitialGeneration?: boolean;
  /** Watch the auto-built preview and auto-repair on build failure. Default true. */
  autoRepairBuild?: boolean;
  /** Internal: marks a repair pass and which round it belongs to. */
  isRepair?: boolean;
  /** 1-based automatic repair round; caps the self-healing loop. */
  repairRound?: number;
  /** Typed AgentEvent callback — receives structured events from the harness engine
   *  (includes node name, phase, step_number). Used by AIBuilderPanel for direct step
   *  advancement without keyword matching. Falls back to onProgress for other paths. */
  onEvent?: (event: {
    message: string;
    node?: string;
    phase?: string;
    step_number?: number;
    stepNumber?: number;
    totalSteps?: number;
    thought?: string;
    plan?: any;
    validationReport?: any;
    generatedFiles?: any[];
    detail?: string;
    kind?: string;
    tool?: string;
    toolInput?: unknown;
    toolCallId?: string;
    status?: string;
    filePath?: string;
    timestamp?: string;
  }) => void;
  /** Raw harness file artefact as it is written to the workspace. */
  onFile?: (file: SSEFileReadyEvent) => void;
  /** AbortSignal from the UI Stop button — cancels the backend stream / LLM calls. */
  signal?: AbortSignal;
  /** Auto routes frontier for first passes and fast for edits; fast/quality pin a tier. */
  modelPreference?: ModelPreference;
  /** Project-relative files the user explicitly attached as context. */
  attachedFiles?: string[];
  /** Receives each assistant text chunk while a chat-only answer streams. */
  onToken?: (token: string) => void;
  /** Called when a chat answer switches credentials/models after an error. */
  onRetry?: (message: string) => void;
}

export interface SendMessageResult {
  /** 'duplicate' = a generation for this conversation is already running;
      the caller must NOT report it as a completed 0-file generation. */
  mode: 'chat' | 'generation' | 'duplicate';
  fileCount?: number;
  files?: import('@/types').FileChange[];
}

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  files: ProjectFile[];
  versions: ProjectVersion[];
  conversation: AIConversation | null;
  messages: AIMessage[];
  tasks: GenerationTask[];
  builds: Build[];
  dependencies: Dependency[];
  deployments: Deployment[];
  loading: boolean;
  error: string | null;
  /** ProjectId whose generation is running at the STORE level (auto-repair,
      wizard auto-start, …) — the panel drives its own busy state for sends it
      initiates, so store-driven runs are otherwise invisible in the UI. */
  generatingIn: string | null;

  loadProjects: () => Promise<void>;
  createProject: (data: { name: string; description: string; template: string; flutter_version?: string; state_management?: string; theme_mode?: string; platform?: string }) => Promise<Project | null>;
  /** Returns false when the remote update failed (state error is also set). */
  updateProject: (id: string, data: Partial<Project>) => Promise<boolean>;
  /** Returns false when the remote delete failed — nothing is removed locally. */
  deleteProject: (id: string) => Promise<boolean>;
  /** Returns false when the duplicate could not be created. */
  duplicateProject: (id: string) => Promise<boolean>;
  loadProject: (id: string) => Promise<void>;
  loadFiles: (projectId: string) => Promise<void>;
  /** Returns false when the edit only exists in memory (backend write failed). */
  saveFile: (projectId: string, path: string, content: string) => Promise<boolean>;
  /** Returns false when the file only exists in memory (backend write failed). */
  createFile: (projectId: string, path: string, content: string, isDirectory?: boolean) => Promise<boolean>;
  /** Returns false when the delete failed — the file is kept. */
  deleteFile: (projectId: string, path: string) => Promise<boolean>;
  renameFile: (projectId: string, oldPath: string, newPath: string) => Promise<void>;
  loadConversation: (projectId: string) => Promise<void>;
  newConversation: (projectId: string) => Promise<void>;
  sendMessage: (projectId: string, content: string, onProgress?: (message: string) => void, opts?: SendMessageOptions) => Promise<SendMessageResult>;
  loadDependencies: (projectId: string) => Promise<void>;
  /** Returns false when the dependency could not be recorded. */
  addDependency: (projectId: string, packageName: string, version: string) => Promise<boolean>;
  /** Returns false when the dependency could not be removed remotely. */
  removeDependency: (projectId: string, packageId: string) => Promise<boolean>;
  loadVersions: (projectId: string) => Promise<void>;
  /** Returns false when the checkpoint could not be stored. */
  createVersion: (projectId: string, label: string, description: string) => Promise<boolean>;
  /** Best-effort checkpoint after a run, repair, or manual edit. Never throws
      and skips when the project state matches the newest checkpoint. */
  autoCheckpoint: (projectId: string, label: string, description: string) => Promise<boolean>;
  /** Returns false when the version was not found or files could not be restored. */
  restoreVersion: (projectId: string, versionId: string) => Promise<boolean>;
  restoreFile: (projectId: string, filePath: string, content?: string) => Promise<void>;
  loadBuilds: (projectId: string) => Promise<void>;
  loadDeployments: (projectId: string) => Promise<void>;
  /** Manual entry to the build-repair loop: feeds the latest failed preview
      logs back through the agent. Same pipeline the auto-watcher uses. */
  repairBuild: (projectId: string, round?: number) => Promise<void>;
  /** Aborts the store-driven repair run (panel Stop button). */
  stopRepair: () => void;
  clearCurrent: () => void;
  clearError: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  files: [],
  versions: [],
  conversation: null,
  messages: [],
  tasks: [],
  builds: [],
  dependencies: [],
  deployments: [],
  loading: false,
  error: null,
  generatingIn: null,

  loadProjects: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    set({ loading: true });
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    if (error) {
      set({ loading: false, error: error.message });
      return;
    }
    set({ projects: (data as Project[]) ?? [], loading: false });
  },

  createProject: async (data) => {
    const user = useAuthStore.getState().user;
    if (!user) {
      set({ error: 'You must be signed in to create a project.' });
      return null;
    }
    set({ loading: true, error: null });
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: data.name,
        description: data.description,
        template: data.template,
        flutter_version: data.flutter_version ?? '3.24.0',
        state_management: data.state_management ?? 'provider',
        theme_mode: data.theme_mode ?? 'light',
        platform: data.platform ?? 'web',
        status: 'created',
      })
      .select('*')
      .single();
    if (error) {
      set({ loading: false, error: error.message });
      return null;
    }

    // New projects start empty. The first prompt creates the real app; shipping
    // demo auth/onboarding/Supabase files first caused them to leak into
    // unrelated apps and confused the generation model.
    set((state) => ({ projects: [project as Project, ...state.projects], loading: false }));
    return project as Project;
  },

  updateProject: async (id, data) => {
    const { error } = await supabase.from('projects').update(data).eq('id', id);
    if (error) {
      set({ error: error.message });
      return false;
    }
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, ...data } : p)),
      currentProject: state.currentProject?.id === id ? { ...state.currentProject, ...data } : state.currentProject,
    }));
    return true;
  },

  deleteProject: async (id) => {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) {
      set({ error: error.message });
      return false;
    }
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProject: state.currentProject?.id === id ? null : state.currentProject,
    }));
    return true;
  },

  duplicateProject: async (id) => {
    const project = get().projects.find((p) => p.id === id);
    if (!project) {
      set({ error: 'Project not found.' });
      return false;
    }
    const user = useAuthStore.getState().user;
    if (!user) {
      set({ error: 'You must be signed in to duplicate a project.' });
      return false;
    }
    const { data: newProject, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: `${project.name} (Copy)`,
        description: project.description,
        template: project.template,
        flutter_version: project.flutter_version,
        state_management: project.state_management,
        theme_mode: project.theme_mode,
        platform: project.platform,
        status: 'created',
      })
      .select('*')
      .single();
    if (error || !newProject) {
      set({ error: error?.message ?? 'Could not duplicate the project.' });
      return false;
    }
    const { data: files } = await supabase.from('project_files').select('*').eq('project_id', id);
    if (files && files.length > 0) {
      // The copy is a NEW app, so it needs a DIFFERENT id: rewrite the
      // pubspec package name instead of copying the original verbatim.
      const freshAppId = generateUniqueAppId(
        `${project.name} copy`,
        (newProject as Project).id,
      );
      const fileInserts = files.map((f) => ({
        project_id: (newProject as Project).id,
        path: f.path,
        content:
          f.path === 'pubspec.yaml' && typeof f.content === 'string'
            ? applyAppIdToPubspec(f.content, freshAppId)
            : f.content,
        file_type: f.file_type,
        is_directory: f.is_directory,
      }));
      await supabase.from('project_files').insert(fileInserts);
    }
    set((state) => ({ projects: [newProject as Project, ...state.projects] }));
    return true;
  },

  loadProject: (id) => ensureSingleFlight(`project:${id}`, async () => {
    // Clear the previous project's state first so switching projects never
    // flashes (or previews from) stale files/messages of another app.
    // Also reset editor tabs: openTabs/activeFile otherwise leak across
    // projects and the Files/Code view opens stale or missing files.
    useWorkspaceStore.getState().resetWorkspace();
    set({
      loading: true,
      currentProject: null,
      files: [],
      versions: [],
      conversation: null,
      messages: [],
      tasks: [],
      builds: [],
      dependencies: [],
      deployments: [],
      error: null,
    });
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) {
      set({ loading: false, error: error?.message ?? 'Project not found' });
      return;
    }
    set({ currentProject: data as Project, loading: false });
    await get().loadFiles(id);
    await Promise.allSettled([
      get().loadConversation(id),
      get().loadDependencies(id),
      get().loadVersions(id),
      get().loadBuilds(id),
      get().loadDeployments(id),
    ]);
  }),

  loadFiles: async (projectId) => {
    const { data, error } = await supabase
      .from('project_files')
      .select('*')
      .eq('project_id', projectId)
      .order('path', { ascending: true });
    if (error) {
      set({ error: error.message });
      return;
    }
    set({ files: (data as ProjectFile[]) ?? [] });
  },

  saveFile: async (projectId, path, content) => {
    const applyLocal = () =>
      set((state) => ({
        files: state.files.map((f) =>
          f.project_id === projectId && f.path === path ? { ...f, content } : f
        ),
      }));
    // Local-only files (created while Supabase was unreachable) have no DB
    // row to update — persist in memory so edits never silently vanish.
    const existing = get().files.find((f) => f.project_id === projectId && f.path === path);
    if (existing?.id.startsWith('local-')) {
      applyLocal();
      return false;
    }
    const { error } = await supabase
      .from('project_files')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('project_id', projectId)
      .eq('path', path);
    if (error) {
      // Same fallback as createFile: keep the edit locally instead of
      // dropping it when the backend write fails.
      applyLocal();
      set({ error: error.message });
      return false;
    }
    applyLocal();
    return true;
  },

  createFile: async (projectId, path, content, isDirectory = false) => {
    const ext = path.split('.').pop() ?? '';
    const { data, error } = await supabase
      .from('project_files')
      .insert({
        project_id: projectId,
        path,
        content,
        file_type: ext,
        is_directory: isDirectory,
      })
      .select('*')
      .single();
    if (error) {
      // Fallback to local state if Supabase returns error or is unconfigured
      const fallbackFile: ProjectFile = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        project_id: projectId,
        path,
        content,
        file_type: ext,
        is_directory: isDirectory,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      set((state) => ({ files: [...state.files.filter(f => f.path !== path), fallbackFile] }));
      return false;
    }
    set((state) => ({ files: [...state.files.filter(f => f.path !== path), data as ProjectFile] }));
    return true;
  },

  deleteFile: async (projectId, path) => {
    const { error } = await supabase
      .from('project_files')
      .delete()
      .eq('project_id', projectId)
      .eq('path', path);
    if (error) {
      set({ error: error.message });
      return false;
    }
    set((state) => ({
      files: state.files.filter((f) => !(f.project_id === projectId && f.path === path)),
    }));
    return true;
  },

  renameFile: async (projectId, oldPath, newPath) => {
    await supabase
      .from('project_files')
      .update({ path: newPath, updated_at: new Date().toISOString() })
      .eq('project_id', projectId)
      .eq('path', oldPath);
    set((state) => ({
      files: state.files.map((f) =>
        f.project_id === projectId && f.path === oldPath ? { ...f, path: newPath } : f
      ),
    }));
  },

  newConversation: async (projectId) => {
    const { data, error } = await supabase
      .from('ai_conversations')
      .insert({ project_id: projectId, title: 'New Conversation' })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    set({ conversation: data as AIConversation, messages: [] });
  },

  loadConversation: (projectId) => ensureSingleFlight(`conv:${projectId}`, () => (async () => {
    const { data: conv } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (conv) {
      set({ conversation: conv as AIConversation });
      const { data: msgs } = await supabase
        .from('ai_messages')
        .select('*')
        .eq('conversation_id', (conv as AIConversation).id)
        .order('created_at', { ascending: true });
      set({ messages: (msgs as AIMessage[]) ?? [] });
    } else {
      const { data: newConv, error } = await supabase
        .from('ai_conversations')
        .insert({ project_id: projectId, title: 'New Conversation' })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      set({ conversation: newConv as AIConversation, messages: [] });
    }
  })()),

  sendMessage: async (projectId, content, onProgress, opts) => {
    let conv = get().conversation;
    if (!conv || conv.project_id !== projectId) {
      await get().loadConversation(projectId);
      conv = get().conversation;
    }
    if (!conv) {
      throw new Error('Chat is still loading. Please try again in a moment.');
    }

    // Duplicate-send guard (store level): the panel already guards with a
    // ref, but auto-start effects, retries, or a second open tab can still
    // enter concurrently. One in-flight generation per conversation.
    // Returns mode 'duplicate' (NOT a 0-file success) so the UI reports it
    // honestly instead of "Generation complete — 0 files".
    if (inFlightSends.has(conv.id)) {
      onProgress?.('Generation already in progress — ignoring duplicate send.');
      return { mode: 'duplicate' as const };
    }
    inFlightSends.add(conv.id);
    set({ generatingIn: projectId });
    return runBody().finally(() => {
      inFlightSends.delete(conv.id);
      set({ generatingIn: null });
    });

    // Original send flow, unchanged — nested so it keeps closure access to
    // get()/set() and `finally` above always releases the guard.
    async function runBody(): Promise<SendMessageResult> {
      let conv = get().conversation;
      if (!conv || conv.project_id !== projectId) {
        await get().loadConversation(projectId);
        conv = get().conversation;
      }
      if (!conv) {
        throw new Error('Chat is still loading. Please try again in a moment.');
      }

      const userMessage: AIMessage = {
        id: crypto.randomUUID(),
        conversation_id: conv.id,
        role: 'user',
        content,
        tool_calls: null,
        changed_files: null,
        metadata: {},
        created_at: new Date().toISOString(),
      };
      set((state) => ({ messages: [...state.messages, userMessage] }));

      // Persist immediately, but don't make a network round-trip sit in front of
      // the generation request. The model run usually gives this insert plenty
      // of time to finish; we await it before saving the assistant reply so the
      // conversation stays ordered.
      const userMessageSaved = (async () => {
        try {
          const { error } = await supabase.from('ai_messages').insert({
            conversation_id: conv.id,
            role: 'user',
            content,
          });
          if (error) console.warn('Could not persist user message:', error.message);
        } catch (error) {
          console.warn('Could not persist user message:', error);
        }
      })();

      const project = get().currentProject;
      if (!project) {
        throw new Error('Project is still loading. Please try again in a moment.');
      }

      // General questions ("what is Supabase?", "thanks", "how do I...?") are
      // answered conversationally: no files change, no version checkpoint, no
      // preview rebuild. Wizard prompts and build-repair passes always build.
      const forceBuild = opts?.isInitialGeneration === true || opts?.isRepair === true;
      if (!forceBuild && classifyChatIntent(content) === 'chat') {
        onProgress?.('Answering your question...');
        const previewSession = usePreviewStore.getState().getSession(projectId);
        const chatContext = ChatContextHandler.build({
          projectName: project.name,
          projectDescription: project.description,
          files: get().files,
          messages: get().messages.slice(0, -1),
          activeFile: useWorkspaceStore.getState().activeFile,
          buildErrors: previewSession?.logs ?? [],
          question: content,
          attachedFiles: opts?.attachedFiles ?? [],
        });
        const reply = await answerGeneralQuestion(content, {
          projectName: project.name,
          projectSummary: chatContext.summary,
          history: chatContext.history,
          apiKey: safePoolKey() || '',
          model: opts?.modelPreference === 'quality'
            ? 'nvidia/nemotron-3-ultra-550b-a55b:free'
            : 'nvidia/nemotron-3.5-lightning:free',
          onProgress,
          onToken: opts?.onToken,
          onRetry: opts?.onRetry,
          signal: opts?.signal,
        });
        const projectUsesSupabase = get().files.some((file) => !file.is_directory && (
          file.path.startsWith('supabase/') || /supabase_flutter|Supabase\.initialize|SupabaseService/.test(file.content)
        ));
        const chatPrompts = generateNextActionPrompts(content, [], projectUsesSupabase);
        const chatMessage: AIMessage = {
          id: crypto.randomUUID(),
          conversation_id: conv.id,
          role: 'assistant',
          content: reply,
          tool_calls: null,
          changed_files: [],
          metadata: { chatOnly: true, nextActionPrompts: chatPrompts },
          created_at: new Date().toISOString(),
        };
        set((state) => ({ messages: [...state.messages, chatMessage] }));
        await userMessageSaved;
        await supabase.from('ai_messages').insert({
          conversation_id: conv.id,
          role: 'assistant',
          content: reply,
          changed_files: [],
          metadata: { chatOnly: true, nextActionPrompts: chatPrompts },
        });
        onProgress?.('Answered — project files untouched');
        return { mode: 'chat' as const };
      }

      const isFirstPrompt = get().messages.length === 1;
      const hasStarterOnly = get().files.length > 0 && get().files.length <= 6;
      // An explicit flag (e.g. from the creation wizard's first prompt) always
      // wins: file-counting alone misclassifies templates with 7+ starter files.
      const isInitialGen = opts?.isInitialGeneration ?? (isFirstPrompt || hasStarterOnly);

      if (!isInitialGen) {
        try {
          await get().createVersion(projectId, `Before: ${content.slice(0, 30)}`, 'Auto checkpoint before generation');
        } catch {
          // Continue if version creation fails
        }
      }

      // Build conversation history for context
      const conversationHistory = get().messages.map((m) => ({ role: m.role, content: m.content }));
      const stateManagement = project.state_management || 'provider';

      const changedFiles = await requestAIGeneration(
        projectId,
        get().messages,
        get().files,
        isInitialGen,
        project.name,
        stateManagement,
        conversationHistory,
        onProgress,
        opts?.onEvent,
        opts?.signal,
        project.platform || 'web',
        project.description || '',
        opts?.modelPreference ?? 'auto',
        opts?.onFile,
        opts?.isRepair ?? false,
      );
      // Belt-and-braces: AI output sometimes carries a stale/copied pubspec
      // name — pin it to this project's unique id before saving.
      const uniqueAppId = generateUniqueAppId(project.name, projectId);
      for (const change of changedFiles) {
        if (change.path === 'pubspec.yaml' && typeof change.content === 'string') {
          const pinned = applyAppIdToPubspec(change.content, uniqueAppId);
          if (pinned !== change.content) {
            change.content = pinned;
            onProgress?.(`Pinned unique package name: ${uniqueAppId}`);
          }
        }
      }
      // Batch the writes. Saving 20-40 generated files one request at a time
      // dominated generation latency on slower connections.
      const upserts = changedFiles
        .filter((change) => change.action === 'created' || change.action === 'modified')
        .map((change) => ({
          project_id: projectId,
          path: change.path,
          content: change.content ?? '',
          file_type: change.path.split('.').pop() ?? null,
          is_directory: false,
        }));
      if (upserts.length > 0) {
        const { error: upsertError } = await supabase
          .from('project_files')
          .upsert(upserts, { onConflict: 'project_id,path' });
        if (upsertError) {
          throw new Error(`Could not save generated files: ${upsertError.message}`);
        }
      }
      const deletedPaths = changedFiles
        .filter((change) => change.action === 'deleted')
        .map((change) => change.path);
      if (deletedPaths.length > 0) {
        await supabase
          .from('project_files')
          .delete()
          .eq('project_id', projectId)
          .in('path', deletedPaths);
      }

      const generatedPaths = new Set(
        changedFiles.filter((change) => change.action !== 'deleted').map((change) => change.path),
      );
      const looksComplete = changedFiles.length >= 4
        && generatedPaths.has('pubspec.yaml')
        && generatedPaths.has('lib/main.dart');
      const usesSupabase = detectSupabaseNeed(`${content} ${project.description ?? ''} ${project.name}`);

      // Initial generation replaces the starter wholesale. Leaving the old
      // demo auth/onboarding/Supabase files behind is what made a calculator
      // ship with 17 unrelated files and broken imports.
      if (looksComplete && (isInitialGen || !usesSupabase)) {
        const stale = get().files.filter((file) => {
          if (file.is_directory || generatedPaths.has(file.path)) return false;
          if (!usesSupabase && /supabase/i.test(file.path)) return true;
          return STARTER_FILE_PATTERNS.some((pattern) => pattern.test(file.path));
        });
        const stalePaths = stale.map((file) => file.path);
        if (stalePaths.length > 0) {
          await supabase
            .from('project_files')
            .delete()
            .eq('project_id', projectId)
            .in('path', stalePaths);
        }
      }

      const nextActionPrompts = generateNextActionPrompts(content, changedFiles, usesSupabase);
      const assistantContent = buildAssistantResponse(content, changedFiles, usesSupabase);
      const assistantMessage: AIMessage = {
        id: crypto.randomUUID(),
        conversation_id: conv.id,
        role: 'assistant',
        content: assistantContent,
        tool_calls: null,
        changed_files: changedFiles,
        metadata: { fileCount: changedFiles.length, nextActionPrompts },
        created_at: new Date().toISOString(),
      };
      set((state) => ({ messages: [...state.messages, assistantMessage] }));

      await userMessageSaved;
      await supabase.from('ai_messages').insert({
        conversation_id: conv.id,
        role: 'assistant',
        content: assistantContent,
        changed_files: changedFiles,
        metadata: { nextActionPrompts },
      });

      await get().loadFiles(projectId);
      const promptSummary = content.replace(/\s+/g, ' ').trim().slice(0, 60);
      const checkpointLabel = opts?.isRepair
        ? `Repair ${opts.repairRound ?? 1}: ${promptSummary}`
        : isInitialGen
          ? `Generated ${project.name}`.slice(0, 80)
          : `Edited: ${promptSummary}`;
      await get().autoCheckpoint(
        projectId,
        checkpointLabel,
        `${changedFiles.length} ${changedFiles.length === 1 ? 'file' : 'files'} changed`,
      );
      // Auto-build preview after generation (like Lovable). Always (re)build
      // from the freshly generated files: a previous session may have been
      // compiled from the identical starter template (or an older revision),
      // and serving that stale build is what made every fresh app preview
      // render "the same app".
      try {
        const previewStore = usePreviewStore.getState();
        const prevSession = previewStore.getSession(projectId);
        if (prevSession && (prevSession.status === 'queued' || prevSession.status === 'building')) {
          // Tear down the in-flight stale build first — the server rejects
          // overlapping builds per project (409) and would otherwise keep
          // serving the old files.
          try {
            await previewStore.stop(prevSession.sessionId);
          } catch {
            // Best-effort; the retry below covers a slow teardown.
          }
          await new Promise((r) => setTimeout(r, 1200));
        }
        const currentFiles = get().files
          .filter((f) => !f.is_directory)
          .map((f) => ({ path: f.path, content: f.content }));
        if (currentFiles.length > 0) {
          let sessionId: string | null = null;
          try {
            sessionId = await previewStore.build(projectId, currentFiles, {
              supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
              supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            });
          } catch (buildErr) {
            // Previous build may still be tearing down (409) — one retry.
            if (buildErr instanceof Error && /already running/i.test(buildErr.message)) {
              onProgress?.('Previous build still finishing — retrying preview build...');
              await new Promise((r) => setTimeout(r, 4000));
              sessionId = await previewStore.build(projectId, currentFiles, {
                supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
                supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              });
            } else {
              throw buildErr;
            }
          }
          if (sessionId) {
            onProgress?.('Preview build started - check Preview tab');
            // Lovable instant loop: initial generations land on the live
            // preview; follow-up edits stay where the user is working.
            if (isInitialGen) {
              useWorkspaceStore.getState().setActiveView('preview');
            }
            // Watch the build: on failure, feed the logs back to the agent
            // for one capped auto-repair pass (A3). Repairs never re-arm.
            const repairRound = opts?.repairRound ?? 0;
            if (opts?.autoRepairBuild !== false && (!opts?.isRepair || repairRound < MAX_AUTO_REPAIRS)) {
              watchPreviewBuild(projectId, sessionId, repairRound);
            }
          }
        }
      } catch {
        // Auto-build is best-effort — don't block the flow
      }
      return { mode: 'generation' as const, fileCount: changedFiles.length, files: changedFiles };
    } // end runBody
  },


  loadDependencies: async (projectId) => {
    const { data } = await supabase
      .from('dependencies')
      .select('*')
      .eq('project_id', projectId)
      .order('package_name', { ascending: true });
    set({ dependencies: (data as Dependency[]) ?? [] });
  },

  addDependency: async (projectId, packageName, version) => {
    const { data, error } = await supabase
      .from('dependencies')
      .insert({
        project_id: projectId,
        package_name: packageName,
        version,
        package_type: 'direct',
        status: 'installing',
      })
      .select('*')
      .single();
    if (error || !data) {
      set({ error: error?.message ?? 'Could not add the dependency.' });
      return false;
    }
    set((state) => ({ dependencies: [...state.dependencies, data as Dependency] }));
    await supabase
      .from('dependencies')
      .update({ status: 'installed' })
      .eq('id', data.id);
    set((state) => ({
      dependencies: state.dependencies.map((d) =>
        d.id === data.id ? { ...d, status: 'installed' } : d
      ),
    }));
    return true;
  },

  removeDependency: async (projectId, packageId) => {
    const { error } = await supabase.from('dependencies').delete().eq('id', packageId);
    if (error) {
      set({ error: error.message });
      return false;
    }
    set((state) => ({
      dependencies: state.dependencies.filter((d) => d.id !== packageId),
    }));
    return true;
  },

  loadVersions: async (projectId) => {
    const { data } = await supabase
      .from('project_versions')
      .select('*')
      .eq('project_id', projectId)
      .order('version_number', { ascending: false });
    set({ versions: (data as ProjectVersion[]) ?? [] });
  },

  createVersion: async (projectId, label, description) => {
    const snapshot = snapshotProjectFiles(get().files);
    const localMax = get().versions.reduce(
      (max, version) => Math.max(max, version.version_number || 0),
      0,
    );
    // Local state can lag behind the table (another window, a failed load), and
    // `versions.length + 1` reused numbers after restore/deletes. Always derive
    // the next number from the highest number stored anywhere.
    const { data: latest } = await supabase
      .from('project_versions')
      .select('version_number')
      .eq('project_id', projectId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    const versionNumber = Math.max(localMax, latest?.version_number ?? 0) + 1;
    const { data, error } = await supabase
      .from('project_versions')
      .insert({
        project_id: projectId,
        version_number: versionNumber,
        label,
        description,
        file_snapshot: snapshot,
      })
      .select('*')
      .single();
    if (error || !data) {
      set({ error: error?.message ?? 'Could not create the checkpoint.' });
      return false;
    }
    set((state) => ({ versions: [data as ProjectVersion, ...state.versions] }));
    return true;
  },

  autoCheckpoint: async (projectId, label, description) => {
    if (get().currentProject?.id !== projectId) return false;
    const files = get().files.filter((file) => !file.is_directory);
    if (files.length === 0) return false;
    const snapshot = snapshotProjectFiles(files);
    const hash = snapshotHash(snapshot);

    let latest: ProjectVersion | undefined = get().versions[0];
    if (!latest) {
      const { data } = await supabase
        .from('project_versions')
        .select('*')
        .eq('project_id', projectId)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      latest = (data as ProjectVersion | null) ?? undefined;
    }
    if (latest && snapshotHash(latest.file_snapshot ?? {}) === hash) return true;

    try {
      return await get().createVersion(projectId, label, description);
    } catch {
      return false;
    }
  },

  restoreVersion: async (projectId, versionId) => {
    const version = get().versions.find((v) => v.id === versionId);
    if (!version) return false;
    const snapshot = version.file_snapshot;
    const currentFiles = get().files;

    for (const [path, data] of Object.entries(snapshot)) {
      const existing = currentFiles.find((f) => f.path === path);
      if (existing) {
        await get().saveFile(projectId, path, data.content);
      } else {
        await get().createFile(projectId, path, data.content);
      }
    }

    for (const file of currentFiles) {
      if (!file.is_directory && !(file.path in snapshot)) {
        await get().deleteFile(projectId, file.path);
      }
    }

    await get().loadFiles(projectId);
    return true;
  },

  restoreFile: async (projectId, filePath, content) => {
    if (content !== undefined) {
      await get().saveFile(projectId, filePath, content);
      await get().loadFiles(projectId);
      return;
    }

    // Lookup in previous versions
    const prevVersions = get().versions;
    for (const v of prevVersions) {
      const snap = v.file_snapshot?.[filePath];
      if (snap?.content !== undefined) {
        await get().saveFile(projectId, filePath, snap.content);
        await get().loadFiles(projectId);
        return;
      }
    }
  },

  loadBuilds: async (projectId) => {
    const { data } = await supabase
      .from('builds')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    set({ builds: (data as Build[]) ?? [] });
  },

  repairBuild: async (projectId, round = 1) => {
    const session = usePreviewStore.getState().getSession(projectId);
    if (!session || session.status !== 'failed') return;
    if (activeRepairAbort) activeRepairAbort.abort(); // superseded repair
    const controller = new AbortController();
    activeRepairAbort = controller;
    try {
      await repairFailedBuild(projectId, session.logs ?? [], round, controller.signal);
    } finally {
      if (activeRepairAbort === controller) activeRepairAbort = null;
      set({ generatingIn: null });
    }
  },

  stopRepair: () => {
    activeRepairAbort?.abort();
    activeRepairAbort = null;
    set({ generatingIn: null });
  },

  loadDeployments: async (projectId) => {
    const { data } = await supabase
      .from('deployments')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    set({ deployments: (data as Deployment[]) ?? [] });
  },

  clearCurrent: () => {
    set({
      currentProject: null,
      files: [],
      versions: [],
      conversation: null,
      messages: [],
      tasks: [],
      builds: [],
      dependencies: [],
      deployments: [],
    });
  },

  clearError: () => set({ error: null }),
}));

const STARTER_FILE_PATTERNS = [
  /^supabase\//,
  /^lib\/core\/services\/supabase_service\.dart$/,
  /^lib\/features\/onboarding\//,
  /^lib\/features\/auth\//,
  /^lib\/features\/profile\//,
  /^lib\/features\/settings\//,
  /^lib\/features\/shared\//,
  /^lib\/core\/widgets\/main_nav_scaffold\.dart$/,
  /^lib\/core\/widgets\/app_header\.dart$/,
  /^lib\/core\/router\/app_router\.dart$/,
  /^lib\/features\/home\/screens\/home_screen\.dart$/,
];

function buildAssistantResponse(prompt: string, changes: FileChange[], usesSupabase = false): string {
  const generated = changes.filter((change) => change.action !== 'deleted');
  const isInitial = generated.filter((change) => change.action === 'created').length >= 4;

  const screens = generated
    .filter((change) => change.path.includes('/screens/') || change.path.endsWith('_screen.dart'))
    .map((change) => change.path.split('/').pop()?.replace('.dart', ''))
    .filter(Boolean);

  const models = generated
    .filter((change) => change.path.includes('/models/'))
    .map((change) => change.path.split('/').pop()?.replace('.dart', ''))
    .filter(Boolean);

  const services = generated
    .filter((change) => change.path.includes('/services/'))
    .map((change) => change.path.split('/').pop()?.replace('.dart', ''))
    .filter(Boolean);

  const backendDesc = usesSupabase
    ? 'Supabase Cloud Backend (PostgreSQL migrations & client init)'
    : 'Local In-Memory Singleton Repositories with realistic sample data';

  if (!isInitial) {
    let resp = `### ✨ Project Updated Successfully\n\n` +
      `Applied updates across **${generated.length} file${generated.length === 1 ? '' : 's'}**.\n\n`;
    if (screens.length > 0) {
      resp += `* **Screens:** ${screens.map((s) => `\`${s}\``).join(', ')}\n`;
    }
    resp += `* **Validation:** Clean Dart null-safety & dependency check with 0 fatal errors.\n\n` +
      `The changes are active in your workspace. Check the **Preview** tab to see your live build!`;
    return resp;
  }

  let response = `### 🚀 Production-Grade Flutter App Generated\n\n` +
    `I have engineered a complete, runnable **Material 3** Flutter application with **${generated.length} production files**:\n\n` +
    `#### 📱 Screens & Routing\n` +
    (screens.length > 0
      ? screens.map((s) => `- \`${s}\`: Interactive UI with responsive layout & state bindings`).join('\n')
      : '- `home_screen`: Main responsive application view') +
    `\n\n#### ⚡ State & Data Layer\n` +
    `- **Data Source**: ${backendDesc}\n` +
    (models.length > 0 ? `- **Domain Models**: ${models.map((m) => `\`${m}\``).join(', ')} with complete \`fromJson\`, \`toJson\`, and \`copyWith\` serialization\n` : '') +
    (services.length > 0 ? `- **Services**: ${services.map((s) => `\`${s}\``).join(', ')} with async CRUD & search support\n` : '') +
    `- **State Management**: Reactive \`AppProvider\` notifying listeners across the widget hierarchy\n\n` +
    `#### 🎨 Design System & Theming\n` +
    `- Adaptive \`AppTheme\` with Material 3 styling and dynamic light/dark mode persistence\n` +
    `- Polished UI components: CustomButton, CustomTextField, LoadingIndicator, EmptyState, and Shimmer skeletons\n\n` +
    `> **Interactive Preview:** The web compiler has been queued. Switch to the **Preview** tab to test your live application!`;

  return response;
}

export function generateNextActionPrompts(prompt: string, changes: FileChange[], usesSupabase = true): string[] {
  const lower = prompt.toLowerCase();
  const prompts: string[] = [];

  const hasSql = changes.some((c) => c.path.endsWith('.sql'));
  const hasAuth = changes.some((c) => c.path.includes('auth'));
  const hasCart = changes.some((c) => c.path.includes('cart'));

  if (!lower.includes('dark') && !lower.includes('theme')) {
    prompts.push('Add an animated Dark/Light Mode toggle');
  }

  if (usesSupabase && !hasAuth && !lower.includes('auth') && !lower.includes('login')) {
    prompts.push('Add Supabase Auth with login, signup and password recovery');
  }

  if (!usesSupabase) {
    prompts.push('Add local persistence so the app remembers state after restart');
    prompts.push('Add keyboard shortcuts and responsive desktop layout');
  }

  if (lower.includes('ecommerce') || lower.includes('shop') || hasCart) {
    prompts.push('Add Stripe checkout flow and order receipt history');
    prompts.push('Add category filter and price range slider');
  } else if (lower.includes('crypto') || lower.includes('wallet')) {
    prompts.push('Add interactive price history chart with 24h P&L');
    prompts.push('Add real-time price alerts in Supabase');
  } else if (lower.includes('chat') || lower.includes('ai')) {
    prompts.push('Add streaming typewriter response effect');
    prompts.push('Add voice input and audio message recorder');
  } else {
    prompts.push('Add a search bar with instant autocomplete');
    prompts.push('Add real-time Supabase subscription stream');
  }

  if (hasSql) {
    prompts.push('Generate mock seed data SQL for instant testing');
  }

  return prompts.slice(0, 4);
}


function safePoolKey(): string {
  try {
    const key = keyPool.getNextKey();
    if (key) return key;
  } catch {
    // continue
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('openrouter_api_key')
        || localStorage.getItem('openrouter_key')
        || localStorage.getItem('ff_openrouter_key');
      if (stored) {
        keyPool.addKey(stored);
        return stored;
      }
    }
  } catch {
    // continue
  }
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENROUTER_API_KEY) {
    const envKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    if (envKey) {
      keyPool.addKey(envKey);
      return envKey;
    }
  }
  return '';
}

// Short display name for progress messages ("nemotron-3-ultra" etc.).
function shortModel(modelId: string): string {
  const base = modelId.split('/').pop() || modelId;
  return base.replace(/:free$/, '').replace(/-/g, ' ');
}


// Conversations with a generation currently running. Second concurrent
// sendMessage for the same conversation returns immediately (see C4).
const inFlightSends = new Set<string>();

// Abort controller for the CURRENT store-driven repair run. The panel's Stop
// button owns its own controller for panel-initiated sends; repairs are
// started outside the panel, so their signal lives here.
let activeRepairAbort: AbortController | null = null;

// Session flag: the Supabase `ai-generate` edge function answered 404/absent.
// Every generation used to retry it (404 + CORS noise) before falling through;
// after the first miss we skip the tier for the rest of the session.
let edgeGenerateUnavailable = false;

// Files without which a Flutter project can never build. When the Edge LLM
// omits any of these, they are backfilled from the deterministic offline
// generator (same guarantee as the local agent's mergeWithBaseline).
const CRITICAL_FILES = [
  'pubspec.yaml',
  'lib/main.dart',
  'lib/app.dart',
  'supabase/migrations/001_initial_schema.sql',
];

// How long the post-generation build watcher waits for a terminal preview
// status before giving up (5s poll × 144 = 12 min, covers cold Docker builds).
const BUILD_WATCH_POLLS = 144;
const BUILD_WATCH_INTERVAL_MS = 5000;
// Keep self-healing bounded: the first build plus two repair builds.
const MAX_AUTO_REPAIRS = 2;

/**
 * Lovable-style self-healing loop (A3): watches a just-triggered preview
 * build and, if it FAILS, sends the build logs back through the agent as a
 * repair prompt. Exactly one repair per build — repair passes carry
 * isRepair so they never arm another watcher (no infinite loops).
 * Fire-and-forget: never throws.
 */
function watchPreviewBuild(projectId: string, sessionId: string, round = 0): void {
  let polls = 0;
  const timer = setInterval(() => {
    polls++;
    try {
      const session = usePreviewStore.getState().getSession(projectId);
      // Superseded (newer build started) or project switched away.
      if (!session || session.sessionId !== sessionId) {
        clearInterval(timer);
        return;
      }
      if (session.status === 'running') {
        useTerminalStore.getState().addLine({ type: 'success', content: '✓ Preview is live' });
        clearInterval(timer);
        return;
      }
      if (session.status === 'failed') {
        clearInterval(timer);
        if (round < MAX_AUTO_REPAIRS) {
          useTerminalStore.getState().addLine({
            type: 'output',
            content: `[repair] Build failed — automatic repair ${round + 1}/${MAX_AUTO_REPAIRS}…`,
          });
          void useProjectStore.getState().repairBuild(projectId, round + 1);
        } else {
          useTerminalStore.getState().addLine({
            type: 'error',
            content: `[repair] Automatic repair limit reached (${MAX_AUTO_REPAIRS}). Use “Fix automatically” in the chat, or fix the error in the Terminal.`,
          });
        }
        return;
      }
      if (session.status === 'stopped' || polls >= BUILD_WATCH_POLLS) {
        clearInterval(timer);
      }
    } catch {
      clearInterval(timer);
    }
  }, BUILD_WATCH_INTERVAL_MS);
}

async function attemptDeterministicRepair(projectId: string, logs: string[]): Promise<boolean> {
  const store = useProjectStore.getState();
  const files = store.files;
  if (!files || files.length === 0) return false;

  let fixedAny = false;

  // 1. Proactively scan lib/core/router/app_router.dart for common mismatched imports
  const routerFile = files.find((f) => f.path === 'lib/core/router/app_router.dart');
  if (routerFile && routerFile.content) {
    let content = routerFile.content;
    let routerModified = false;

    const replacements: Array<[RegExp, string]> = [
      [/screens\/usermanagement\/user_management_screen\.dart/g, 'screens/users/user_management_screen.dart'],
      [/screens\/auditlogs\/audit_logs_screen\.dart/g, 'screens/audit/audit_logs_screen.dart'],
      [/screens\/healthmonitor\/health_monitor_screen\.dart/g, 'screens/health/health_monitor_screen.dart'],
      [/screens\/usermanagement\//g, 'screens/users/'],
      [/screens\/auditlogs\//g, 'screens/audit/'],
    ];

    for (const [pattern, repl] of replacements) {
      if (pattern.test(content)) {
        content = content.replace(pattern, repl);
        routerModified = true;
      }
    }

    // Check all screen imports against actual project files
    const importRegex = /import\s+['"]([^'"]+\.dart)['"];/g;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(routerFile.content)) !== null) {
      const imp = match[1];
      if (imp.startsWith('package:') || imp.startsWith('dart:')) continue;
      const fileName = imp.split('/').pop();
      if (!fileName) continue;

      const normalized = imp.replace(/^\.\.\/\.\.\//, 'lib/');
      const exists = files.some((f) => f.path === normalized || f.path.endsWith(normalized));
      if (!exists) {
        const actual = files.find((f) => f.path.endsWith(`/${fileName}`) || f.path === fileName);
        if (actual) {
          const relativeToRouter = `../../${actual.path.replace(/^lib\//, '')}`;
          content = content.replace(imp, relativeToRouter);
          routerModified = true;
        }
      }
    }

    if (routerModified && content !== routerFile.content) {
      await store.saveFile(projectId, routerFile.path, content);
      fixedAny = true;
    }
  }

  // 2. Scan compiler logs for "Error when reading '...': No such file or directory"
  const missingImports: string[] = [];
  for (const line of logs) {
    const m = line.match(/Error(?: when reading)? ['"]([^'"]+\.dart)['"]: No such file or directory/i);
    if (m) missingImports.push(m[1]);
  }

  if (missingImports.length > 0) {
    for (const missing of missingImports) {
      const fileName = missing.split('/').pop();
      if (!fileName) continue;
      const actual = files.find((f) => f.path.endsWith(`/${fileName}`));
      if (!actual) continue;

      for (const file of files) {
        if (!file.content || file.is_directory) continue;
        if (file.content.includes(fileName)) {
          const depth = file.path.split('/').length - 2;
          const up = depth > 0 ? Array(depth).fill('..').join('/') : '.';
          const newRel = `${up}/${actual.path.replace(/^lib\//, '')}`;
          const badRegex = new RegExp(`['"][^'"]*${fileName}['"]`, 'g');
          const newContent = file.content.replace(badRegex, `'${newRel}'`);
          if (newContent !== file.content) {
            await store.saveFile(projectId, file.path, newContent);
            fixedAny = true;
          }
        }
      }
    }
  }

  return fixedAny;
}

async function repairFailedBuild(projectId: string, logs: string[], round = 1, signal?: AbortSignal): Promise<void> {
  const terminal = useTerminalStore.getState();
  const activity = useActivityStore.getState();
  activity.begin(projectId, `Repair preview build (round ${round})`, false);

  terminal.addLine({
    type: 'output',
    content: `[repair] Checking preview build errors (attempt ${round}/${MAX_AUTO_REPAIRS})…`,
  });
  activity.ingestProgress(`Checking preview build errors (attempt ${round}/${MAX_AUTO_REPAIRS})`);

  try {
    const store = useProjectStore.getState();
    if (!store.currentProject || store.currentProject.id !== projectId) {
      await store.loadProject(projectId);
    } else if (!store.conversation) {
      await store.loadConversation(projectId);
    }

    // Step 1: Attempt deterministic zero-latency import repair
    const repairedDeterministically = await attemptDeterministicRepair(projectId, logs);
    if (repairedDeterministically) {
      terminal.addLine({ type: 'success', content: '✓ Repaired router screen imports deterministically — rebuilding preview' });
      activity.end('success', 'Repaired router screen imports deterministically');
      const updatedFiles = useProjectStore.getState().files;
      const newSessionId = await usePreviewStore.getState().build(projectId, updatedFiles);
      if (newSessionId) {
        watchPreviewBuild(projectId, newSessionId, round);
      }
      return;
    }

    // Step 2: Clean and filter logs to remove kernel/dev_compiler stack traces
    const cleanErrors = logs
      .filter((line) => !/package:dev_compiler|package:frontend_server|package:kernel|dart:core-patch|<asynchronous suspension>|#\d+\s+/i.test(line))
      .filter((line) => /error:|Error:|Failed to compile|because|not found|undefined|Expected|Too many|Invalid/i.test(line))
      .slice(-10)
      .join('\n')
      .slice(-2500);

    terminal.addLine({
      type: 'error',
      content: `✗ Preview build failed — agent repairing compile errors…`,
    });

    await useProjectStore.getState().sendMessage(
      projectId,
      `The Flutter preview build encountered compile errors (attempt ${round}/${MAX_AUTO_REPAIRS}). Fix the code so it compiles cleanly.\n\nErrors:\n${cleanErrors || '(no specific errors captured)'}\n\nRules:\n- Read the failing file(s) and fix the actual root cause.\n- Keep every file complete and compilable; no TODOs or placeholders.`,
      (message) => {
        terminal.addLine({ type: 'output', content: `  [repair ${round}] ${message}` });
        activity.ingestProgress(message);
      },
      {
        isInitialGeneration: false,
        autoRepairBuild: true,
        isRepair: true,
        repairRound: round,
        signal,
        onEvent: (event) => activity.ingestAgent(event),
        onFile: (file) => activity.ingestFile(file),
      },
    );
    terminal.addLine({ type: 'success', content: '✓ Repair pass complete — preview rebuilding' });
    activity.end('success', 'Repair pass complete — preview rebuilding');
  } catch (e) {
    const message = (e as Error).message;
    terminal.addLine({ type: 'error', content: `✗ Auto-repair failed: ${message}` });
    activity.end('error', `Repair failed: ${message}`);
  }
}

async function requestAIGeneration(
  projectId: string,
  messages: AIMessage[],
  files: ProjectFile[],
  isInitialGeneration: boolean,
  projectName = 'FlutterForgeApp',
  stateManagement = 'provider',
  conversationHistory: Array<{ role: string; content: string }> = [],
  onProgress?: (msg: string) => void,
  onEvent?: (event: { message: string; node?: string; phase?: string; step_number?: number }) => void,
  signal?: AbortSignal,
  platform = 'web',
  projectDescription = '',
  modelPreference: ModelPreference = 'auto',
  onFile?: (file: SSEFileReadyEvent) => void,
  isRepair = false,
): Promise<FileChange[]> {
  // Routing policy: frontier for planning/design/first pass, fast for routine
  // edits, repairs, and chat. The engine re-checks entitlement server-side.
  if (!useCredentialsStore.getState().status) {
    await useCredentialsStore.getState().load();
  }
  const plan = useAuthStore.getState().profile?.plan ?? 'free';
  const choice = resolveModelChoice({
    preference: modelPreference,
    isInitialGeneration,
    isRepair,
    plan,
    hasByok: useCredentialsStore.getState().hasOpenRouterKey(),
  });
  const fastModel =
    (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_AGENT_MODEL as string | undefined)) ||
    ECONOMY_MODEL;
  const qualityModel = FRONTIER_MODEL;
  const preferredModel = choice.role === 'frontier' ? qualityModel : fastModel;
  const agentModel = preferredModel;

  const latestUserPrompt = messages.filter((m) => m.role === 'user').pop()?.content || 'Create Flutter application';
  const appId = generateUniqueAppId(projectName, projectId);
  const promptText = `${latestUserPrompt} ${projectDescription} ${projectName}`;
  const filesUseSupabase = files.some((file) => !file.is_directory && (
    /^supabase\//.test(file.path)
    || /supabase_flutter|Supabase\.initialize|SupabaseService/.test(file.content)
  ));
  const usesSupabase = isExplicitLocalOnly(latestUserPrompt)
    ? false
    : (isInitialGeneration
      ? detectSupabaseNeed(promptText)
      : (detectSupabaseNeed(promptText) || filesUseSupabase));
  const context = AgentContextBuilder.buildContext({
    projectId,
    projectName,
    projectDescription,
    files,
    conversationHistory: messages.map((m) => ({ role: m.role, content: m.content })),
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    platform,
    appId,
    usesSupabase,
    activeFile: useWorkspaceStore.getState().activeFile,
    buildErrors: usePreviewStore.getState().getSession(projectId)?.logs ?? [],
  });

  const isIncremental = !isInitialGeneration && files.length > 0;
  const activeSkills = SkillRegistry.getActiveSkills();

  // TIER 1: Primary Lovable-Grade Flutter & Supabase Agent (Direct, Efficient, Scalable)
  try {
    if (signal?.aborted) throw new Error('Generation cancelled by user');

    const apiKey = safePoolKey() || '';
    onProgress?.(`AI Agent active — generating Flutter app (${choice.role === 'frontier' ? 'frontier' : 'fast'} model, ${activeSkills.length} skills active)...`);

    const result = await FlutterSupabaseAgent.execute(latestUserPrompt, context, {
      enableAutoHealing: true,
      stateManagement: stateManagement as 'provider' | 'riverpod' | 'bloc' | 'change_notifier',
      isIncremental,
      conversationHistory,
      skills: activeSkills,
      signal,
      modelConfig: {
        provider: 'custom',
        modelName: agentModel,
        apiKey,
      },
      onEvent: (event) => {
        onEvent?.({
          message: event.message,
          node: event.phase,
          phase: event.phase,
          step_number: event.stepNumber,
        });
        onProgress?.(event.message);
      },
      onFile,
    });

    if (signal?.aborted) throw new Error('Generation cancelled by user');

    if (result.files && result.files.length > 0) {
      if (apiKey) keyPool.markSuccess(apiKey);
      onProgress?.(`Generation complete: produced ${result.files.length} production-grade Flutter files`);
      const existingFileMap = new Map(files.map((file) => [file.path, file.content]));
      return result.files.map((file) => {
        const prevContent = file.oldContent ?? existingFileMap.get(file.path);
        const isNew = !existingFileMap.has(file.path);
        return {
          path: file.path,
          content: file.content ?? '',
          previous_content: prevContent,
          oldContent: prevContent,
          action: isNew ? ('created' as const) : ('modified' as const),
        };
      });
    }
  } catch (agentError) {
    if (signal?.aborted) throw new Error('Generation cancelled by user');
    console.warn('[Tier 1] Primary FlutterSupabaseAgent generation encountered error, falling back:', agentError);
  }

  if (signal?.aborted) throw new Error('Generation cancelled by user');

  // TIER 1: Edge Function (real AI generation with model fallback chain).
  // Deployments without this function answered 404+CORS on EVERY generation —
  // remember the first miss for the session and skip straight to the local agent.
  if (edgeGenerateUnavailable) {
    console.info('[Agent] Skipping Supabase edge function (unavailable in this deployment).');
  } else
    try {
      onProgress?.(`Sending request to AI (${shortModel(agentModel)} + fallback models)...`);
      const edgeKey = safePoolKey();
      const edgeHeaders: Record<string, string> = {};
      if (edgeKey) edgeHeaders['X-OpenRouter-Key'] = edgeKey;
      if (agentModel) edgeHeaders['X-OpenRouter-Model'] = agentModel;
      const invokePromise = supabase.functions.invoke('ai-generate', {
        body: {
          messages: messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          files: files.filter((file) => !file.is_directory).map((file) => ({
            path: file.path,
            content: file.content,
          })),
          mode: isInitialGeneration ? 'new' : 'edit',
        },
        headers: Object.keys(edgeHeaders).length > 0 ? edgeHeaders : undefined,
      });
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Edge timeout 90s')), 90000));
      const { data, error } = await Promise.race([invokePromise, timeoutPromise]) as Awaited<typeof invokePromise>;

      if (!error && data) {
        const generatedFiles = (data as { files?: Array<{ path?: unknown; content?: unknown }>; model?: string; complete?: boolean; missing?: string[] } | null)?.files;
        const usedModel = (data as { model?: string })?.model;
        if (Array.isArray(generatedFiles) && generatedFiles.length > 0) {
          onProgress?.(`AI generated ${generatedFiles.length} files using ${usedModel || 'unknown model'}`);
          const existingPaths = new Set(files.map((file) => file.path));
          const changes: FileChange[] = generatedFiles
            .filter((file: { path?: unknown; content?: unknown }): file is { path: string; content: string } => typeof file.path === 'string' && typeof file.content === 'string')
            .map((file) => ({
              path: file.path,
              content: file.content,
              action: existingPaths.has(file.path) ? 'modified' as const : 'created' as const,
            }));

          // An edge response that parses to zero usable files is treated as
          // empty — fall through to the local agent, never return 0 files.
          if (changes.length === 0) {
            onProgress?.('Edge output had no usable files - trying local AI agent...');
          } else {

            // E2E completeness: backfill any critical files the LLM omitted so
            // the project is never left unbuildable by a truncated response.
            const produced = new Set(changes.map((c) => c.path));
            const missingCritical = CRITICAL_FILES.filter((p) => !produced.has(p));
            if (missingCritical.length > 0) {
              onProgress?.(`AI omitted ${missingCritical.length} critical file(s) — backfilling from structured generator...`);
              try {
                const latestUserPrompt = messages.filter((m) => m.role === 'user').pop()?.content || 'Create Flutter application';
                const bContext = AgentContextBuilder.buildContext({
                  projectId,
                  projectName,
                  files,
                  conversationHistory: messages.map((m) => ({ role: m.role, content: m.content })),
                });
                const bPlan = AgentPlanner.plan(latestUserPrompt, bContext, {
                  stateManagement: stateManagement as 'provider' | 'riverpod' | 'bloc' | 'change_notifier',
                });
                const baseline = MultiFileCodeGenerator.generateAllFiles(bPlan, bContext);
                for (const b of baseline) {
                  if (missingCritical.includes(b.path) && !produced.has(b.path)) {
                    changes.push({
                      path: b.path,
                      content: b.content,
                      action: existingPaths.has(b.path) ? 'modified' as const : 'created' as const,
                    });
                    produced.add(b.path);
                  }
                }
              } catch {
                // Backfill is best-effort — partial Edge output still proceeds.
              }
            }

            return changes;
          }
        }
        onProgress?.('Edge returned empty - trying local AI agent...');
      } else if (error) {
        const errorMessage = (error as Error).message ?? '';
        // 404 / "function not found" / CORS-blocked fetches mean the function is
        // NOT deployed — remember and skip this tier for the rest of the session.
        if (/404|FunctionsNotFound|not found|Failed to fetch|Failed to send/i.test(errorMessage)) {
          edgeGenerateUnavailable = true;
        }
        onProgress?.(`Edge failed (${errorMessage.slice(0, 60)}) - trying local AI agent...`);
      }
    } catch (e) {
      const message = (e as Error).message ?? '';
      if (/404|FunctionsNotFound|not found|Failed to fetch|Failed to send/i.test(message)) {
        edgeGenerateUnavailable = true;
      }
      onProgress?.(`Edge timeout/error (${message.slice(0, 40)}) - using structured fallback...`);
    }

  if (signal?.aborted) throw new Error('Generation cancelled by user');

  // TIER 3: Deterministic Structured Template Generator Fallback
  // If ALL AI models are unavailable (503 capacity limit, 402 credits exhausted, offline, etc.)
  // NEVER leave the project with 0 files or broken state. Generate the complete, production-grade
  // Flutter project containing: Home, Profile, Settings, Navbar, Header, Login, Register, Onboard,
  // GoRouter, ThemeController, Item/User models, AppProvider, Supabase service, and SQL migrations.
  onProgress?.('AI model unavailable — applying complete production Flutter app structure with all sections...');
  if (!isInitialGeneration && files.length > 0) {
    throw new Error(
      'AI providers are unavailable, so I could not safely apply this change. Your existing project files were kept unchanged. Check the AI connection or API key, then retry.',
    );
  }
  // Last-resort deterministic fallback must also respect the backend choice.
  // A local calculator should never receive auth screens and SQL.
  const fallbackFiles = usesSupabase
    ? generateFlutterProjectFiles(
      projectName,
      'standard',
      [],
      undefined,
      projectId,
    )
    : generateMinimalStarterFiles(projectName, projectId);
  const existingFileMap = new Map(files.map((file) => [file.path, file.content]));
  return fallbackFiles.map((file) => ({
    path: file.path,
    content: file.content ?? '',
    oldContent: existingFileMap.get(file.path),
    action: existingFileMap.has(file.path) ? ('modified' as const) : ('created' as const),
  }));
}

