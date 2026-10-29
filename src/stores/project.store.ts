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
import { FlutterSupabaseAgent, AgentContextBuilder, AgentPlanner, MultiFileCodeGenerator, keyPool } from '@/agent';
import { HarnessClient, runFlutterSupabaseAgentHarness } from '@/agent/harnessClient';
import { usePreviewStore } from './preview.store';
import { useWorkspaceStore } from './workspace.store';
import { useTerminalStore } from './terminal.store';

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
  onEvent?: (event: { message: string; node?: string; phase?: string; step_number?: number; thought?: string }) => void;
  /** AbortSignal from the UI Stop button — cancels the backend stream / LLM calls. */
  signal?: AbortSignal;
  /** Fast/lightning or quality/ultra model for this request. Defaults to fast. */
  modelPreference?: 'fast' | 'quality';
  /** Project-relative files the user explicitly attached as context. */
  attachedFiles?: string[];
  /** Receives each assistant text chunk while a chat-only answer streams. */
  onToken?: (token: string) => void;
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
    await get().loadConversation(id);
    await get().loadDependencies(id);
    await get().loadVersions(id);
    await get().loadBuilds(id);
    await get().loadDeployments(id);
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

    await supabase.from('ai_messages').insert({
      conversation_id: conv.id,
      role: 'user',
      content,
    });

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
      const envKey =
        (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_OPENROUTER_API_KEY as string | undefined)) ||
        '';
      if (envKey) keyPool.addKey(envKey);
      const reply = await answerGeneralQuestion(content, {
        projectName: project.name,
        projectSummary: chatContext.summary,
        history: chatContext.history,
        apiKey: safePoolKey() || envKey || '',
        onProgress,
        onToken: opts?.onToken,
        signal: opts?.signal,
      });
      const chatPrompts = generateNextActionPrompts(content, []);
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
      opts?.modelPreference ?? 'fast',
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

    await supabase.from('ai_messages').insert({
      conversation_id: conv.id,
      role: 'assistant',
      content: assistantContent,
      changed_files: changedFiles,
      metadata: { nextActionPrompts },
    });

    await get().loadFiles(projectId);
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
    const files = get().files;
    const snapshot: Record<string, { content: string }> = {};
    for (const f of files) {
      if (!f.is_directory) snapshot[f.path] = { content: f.content };
    }
    const versionNumber = get().versions.length + 1;
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
    }
  },

  stopRepair: () => {
    activeRepairAbort?.abort();
    activeRepairAbort = null;
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

  const verb = isInitial ? 'Built' : 'Updated';
  const backend = usesSupabase ? 'Supabase' : 'local state only';
  let response = `${verb} ${generated.length} file${generated.length === 1 ? '' : 's'} with Material 3 and ${backend}.`;

  if (screens.length > 0) {
    response += `\n\nScreens: ${screens.slice(0, 6).map((screen) => `\`${screen}\``).join(', ')}${screens.length > 6 ? '…' : ''}`;
  }

  response += `\n\nPreview build requested — the result will appear in the Preview tab.`;
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
    return keyPool.getNextKey();
  } catch {
    return '';
  }
}

// Short display name for progress messages ("nemotron-3-ultra" etc.).
function shortModel(modelId: string): string {
  const base = modelId.split('/').pop() || modelId;
  return base.replace(/:free$/, '').replace(/-/g, ' ');
}

/**
 * Runs the Tier-0 harness stream with an overall timeout. An engine that
 * accepts the request but never emits (stalled LLM call, lost SSE) must
 * reject so the fallback chain (Edge → local agent → templates) proceeds
 * instead of hanging the UI at 0% forever.
 */
function runTier0WithTimeout<T>(
  run: () => Promise<T>,
  timeoutMs: number,
  onProgress?: (msg: string) => void,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onProgress?.(`Harness engine stalled (${Math.round(timeoutMs / 1000)}s without finishing) — falling back...`);
      reject(new Error(`Harness engine timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  return Promise.race([run(), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
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

async function repairFailedBuild(projectId: string, logs: string[], round = 1, signal?: AbortSignal): Promise<void> {
  const terminal = useTerminalStore.getState();
  const compileErrors = logs.filter((line) => /error:|Error:|Failed to compile|because|not found|undefined|Expected|Too many|Invalid/i.test(line));
  const tail = [...compileErrors.slice(-20), ...logs.slice(-30)].join('\n').slice(-7000);
  terminal.addLine({
    type: 'error',
    content: `✗ Preview build failed — repair attempt ${round}/${MAX_AUTO_REPAIRS} is reading the compile errors…`,
  });
  try {
    const store = useProjectStore.getState();
    if (!store.currentProject || store.currentProject.id !== projectId) {
      await store.loadProject(projectId);
    } else if (!store.conversation) {
      await store.loadConversation(projectId);
    }
    await useProjectStore.getState().sendMessage(
      projectId,
      `The Flutter preview build FAILED (automatic repair attempt ${round}/${MAX_AUTO_REPAIRS}). Fix the project so it compiles and the preview loads.\n\nCompile errors and log tail:\n${tail || '(no logs captured)'}\n\nRules:\n- Read the failing file(s) and fix the actual root cause; do not rewrite unrelated files.\n- Run flutter analyze or dart analyze when useful.\n- Keep every file complete and compilable; no TODOs or placeholders.\n- If the same error repeats, change approach instead of repeating the same edit.`,
      (message) => terminal.addLine({ type: 'output', content: `  [repair ${round}] ${message}` }),
      { isInitialGeneration: false, autoRepairBuild: true, isRepair: true, repairRound: round, signal },
    );
    terminal.addLine({ type: 'success', content: '✓ Repair pass complete — preview rebuilding' });
  } catch (e) {
    terminal.addLine({ type: 'error', content: `✗ Auto-repair failed: ${(e as Error).message}` });
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
  modelPreference: 'fast' | 'quality' = 'fast',
): Promise<FileChange[]> {
  // Model override: set VITE_AGENT_MODEL to pin a specific OpenRouter model.
  // Free-first default so free-tier keys work everywhere (paid users pin via env).
  // Fast model first: the lightning model finishes a small app in ~1 minute.
  // A retry (usually a different pool key) upgrades to the larger model so a
  // weak first answer still has a quality path.
  const fastModel =
    (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_AGENT_MODEL as string | undefined)) ||
    'nvidia/nemotron-3.5-lightning:free';
  const qualityModel = 'nvidia/nemotron-3-ultra-550b-a55b:free';
  const preferredModel = modelPreference === 'quality' ? qualityModel : fastModel;
  const agentModel = preferredModel;

  // Tier-0 timeout per attempt. The fast model normally finishes in under two
  // minutes; a larger/quality retry gets more room. The Stop button still
  // aborts immediately through the request signal.
  const FAST_ATTEMPT_TIMEOUT_MS = 240000;
  const QUALITY_ATTEMPT_TIMEOUT_MS = 480000;

  // TIER 0: DeepSeek Harness engine (local Node service, SSE streaming)
  try {
    const harnessClient = new HarnessClient();
    const isUp = await harnessClient.isHealthy();
    if (signal?.aborted) throw new Error('Generation cancelled by user');
    if (isUp) {
      onProgress?.(`Harness engine active — ${shortModel(agentModel)} via DeepSeek Harness...`);
      const envKey =
        (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_OPENROUTER_API_KEY as string | undefined)) ||
        '';
      if (envKey) keyPool.addKey(envKey);
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
      // Try up to three OpenRouter pool keys, then one attempt on the
      // signed-in DeepSeek account. The two providers have independent quotas,
      // so an exhausted free tier can still produce a real app.
      const poolStatus = keyPool.getPoolStatus();
      const healthyKeyCount = poolStatus.filter((status) => status.isHealthy).length;
      // If every pool key is cooling down, do not spend a minute retrying them
      // before reaching the managed account.
      const openRouterAttempts = healthyKeyCount > 0 ? Math.min(3, healthyKeyCount) : 0;
      const attempts = openRouterAttempts + 1;
      let lastHarnessError: unknown = null;

      // The key pool is the failover unit: a rate-limited free key should not
      // dump the user into the slower in-browser agent. Retry the harness once
      // with the next healthy key before leaving Tier 0.
      for (let attempt = 0; attempt < attempts; attempt++) {
        if (signal?.aborted) throw new Error('Generation cancelled by user');
        const useManagedAccount = attempt >= openRouterAttempts;
        const apiKey = useManagedAccount ? '' : (safePoolKey() || envKey || '');
        const modelForAttempt = useManagedAccount
          ? 'deepseek-flash'
          : (attempt === 0 || preferredModel === qualityModel ? preferredModel : qualityModel);
        if (useManagedAccount) {
          onProgress?.('OpenRouter keys are unavailable — trying your signed-in DeepSeek account...');
        }

        try {
          const result = await runTier0WithTimeout(
            () => runFlutterSupabaseAgentHarness(
              latestUserPrompt,
              context,
              {
                enableAutoHealing: true,
                stateManagement: stateManagement as 'provider' | 'riverpod' | 'bloc' | 'change_notifier',
                isIncremental,
                conversationHistory,
                modelConfig: {
                  provider: 'custom',
                  modelName: modelForAttempt,
                  apiKey,
                },
                signal,
                onEvent: (event) => {
                  onEvent?.(event);
                  onProgress?.(event.message);
                },
              }
            ),
            attempt === 0 && modelPreference !== 'quality' ? FAST_ATTEMPT_TIMEOUT_MS : QUALITY_ATTEMPT_TIMEOUT_MS,
            onProgress,
          );

          if (signal?.aborted) throw new Error('Generation cancelled by user');

          if (result.files.length > 0) {
            if (!useManagedAccount && apiKey) keyPool.markSuccess(apiKey);
            onProgress?.(`Harness finished: generated ${result.files.length} files in ${result.durationMs}ms`);
            const existingFileMap = new Map(files.map((file) => [file.path, file.content]));
            return result.files.map((file) => {
              const prevContent = (file as { oldContent?: string }).oldContent ?? existingFileMap.get(file.path);
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

          if (!useManagedAccount && apiKey) keyPool.markFailure(apiKey, 'Harness returned no files', false);
          onProgress?.('Harness returned no files — retrying with the next key...');
        } catch (error) {
          if (signal?.aborted) throw new Error('Generation cancelled by user');
          lastHarnessError = error;
          if (!useManagedAccount && apiKey) {
            const message = error instanceof Error ? error.message : String(error);
            const rateLimited = /rate.?limit|429|quota|credit|capacity/i.test(message);
            keyPool.markFailure(apiKey, message, rateLimited);
            // A daily free-tier quota is account-wide; retrying the remaining
            // keys just burns time. Jump straight to the managed account.
            if (/free-models-per-day|daily free|quota|429/i.test(message) && openRouterAttempts > 0) {
              attempt = Math.max(0, openRouterAttempts - 1);
            }
          }
          onProgress?.(`Harness attempt ${attempt + 1}/${attempts} failed — retrying with the next key...`);
        }
      }

      if (lastHarnessError) throw lastHarnessError;
    }
  } catch (harnessError) {
    if (signal?.aborted) throw new Error('Generation cancelled by user');
    const message = harnessError instanceof Error ? harnessError.message : String(harnessError);
    onProgress?.(`Harness failed (${message.slice(0, 100)}) — using the browser fallback...`);
    console.warn('[Harness] Execution bypassed or failed, continuing fallback chain:', harnessError);
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
    onProgress?.(`Edge timeout/error (${message.slice(0, 40)}) - trying local AI agent...`);
  }

  if (signal?.aborted) throw new Error('Generation cancelled by user');

  // TIER 2: Local FlutterSupabaseAgent (client-side AI with model fallback chain)
  // E2E: never throw when no API keys exist — fall back to offline structured generation.
  onProgress?.(`Generating with local AI agent (${shortModel(agentModel)} + fallback models)...`);
  const latestUserPrompt = messages.filter((m) => m.role === 'user').pop()?.content || 'Create Flutter application';
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
    appId: generateUniqueAppId(projectName, projectId),
    usesSupabase,
    activeFile: useWorkspaceStore.getState().activeFile,
    buildErrors: usePreviewStore.getState().getSession(projectId)?.logs ?? [],
  });

  // Detect if this is an incremental edit (follow-up prompt after initial generation)
  const isIncremental = !isInitialGeneration && files.length > 0;

  const envKey =
    (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_OPENROUTER_API_KEY as string | undefined)) ||
    '';
  // Belt-and-braces: ensure the env key participates in pool rotation even if
  // the singleton was constructed before the env was injected (e.g. tests).
  if (envKey) keyPool.addKey(envKey);
  const poolKey = safePoolKey();
  const apiKey = poolKey || envKey || '';

  try {
    const result = await FlutterSupabaseAgent.execute(latestUserPrompt, context, {
      enableAutoHealing: true,
      stateManagement: stateManagement as 'provider' | 'riverpod' | 'bloc' | 'change_notifier',
      isIncremental,
      conversationHistory,
      modelConfig: {
        provider: 'custom',
        modelName: agentModel,
        apiKey,
      },
      onEvent: (event) => {
        onProgress?.(event.message);
      },
    });

    if (result.files && result.files.length > 0) {
      const existingFileMap = new Map(files.map((file) => [file.path, file.content]));
      return result.files.map((file) => ({
        path: file.path,
        content: file.content,
        oldContent: existingFileMap.get(file.path),
        action: existingFileMap.has(file.path) ? ('modified' as const) : ('created' as const),
      }));
    }
  } catch (err) {
    console.warn('[Tier 2] Local agent generation failed, proceeding to structured generator fallback:', err);
  }

  // TIER 3: Deterministic Structured Template Generator Fallback
  // If ALL AI models are unavailable (503 capacity limit, 402 credits exhausted, offline, etc.)
  // NEVER leave the project with 0 files or broken state. Generate the complete, production-grade
  // Flutter project containing: Home, Profile, Settings, Navbar, Header, Login, Register, Onboard,
  // GoRouter, ThemeController, Item/User models, AppProvider, Supabase service, and SQL migrations.
  onProgress?.('AI model unavailable — applying complete production Flutter app structure with all sections...');
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

