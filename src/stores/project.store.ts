import { create } from 'zustand';
import { supabase } from '@/services/supabase';
import type { Project, ProjectFile, ProjectVersion, AIConversation, AIMessage, GenerationTask, Build, Dependency, Deployment, FileChange } from '@/types';
import { useAuthStore } from './auth.store';
import { generateFlutterProjectFiles } from '@/utils/flutterTemplates';
import { FlutterSupabaseAgent, AgentContextBuilder, keyPool } from '@/agent';
import { usePreviewStore } from './preview.store';

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

  loadProjects: () => Promise<void>;
  createProject: (data: { name: string; description: string; template: string; flutter_version?: string; state_management?: string; theme_mode?: string; platform?: string }) => Promise<Project | null>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  loadFiles: (projectId: string) => Promise<void>;
  saveFile: (projectId: string, path: string, content: string) => Promise<void>;
  createFile: (projectId: string, path: string, content: string, isDirectory?: boolean) => Promise<void>;
  deleteFile: (projectId: string, path: string) => Promise<void>;
  renameFile: (projectId: string, oldPath: string, newPath: string) => Promise<void>;
  loadConversation: (projectId: string) => Promise<void>;
  sendMessage: (projectId: string, content: string, onProgress?: (message: string) => void) => Promise<void>;
  loadDependencies: (projectId: string) => Promise<void>;
  addDependency: (projectId: string, packageName: string, version: string) => Promise<void>;
  removeDependency: (projectId: string, packageId: string) => Promise<void>;
  loadVersions: (projectId: string) => Promise<void>;
  createVersion: (projectId: string, label: string, description: string) => Promise<void>;
  restoreVersion: (projectId: string, versionId: string) => Promise<void>;
  restoreFile: (projectId: string, filePath: string, content?: string) => Promise<void>;
  loadBuilds: (projectId: string) => Promise<void>;
  loadDeployments: (projectId: string) => Promise<void>;
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
    if (!user) return null;
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

    const starterFiles = generateFlutterProjectFiles(data.name, data.template);
    const { error: filesError } = await supabase.from('project_files').insert(
      starterFiles.map((file) => ({
        project_id: project.id,
        path: file.path,
        content: file.content ?? '',
        file_type: file.path.split('.').pop() ?? null,
        is_directory: false,
      })),
    );
    if (filesError) {
      set({ loading: false, error: `Project created, but starter files could not be saved: ${filesError.message}` });
      return null;
    }

    set((state) => ({ projects: [project as Project, ...state.projects], loading: false }));
    return project as Project;
  },

  updateProject: async (id, data) => {
    const { error } = await supabase.from('projects').update(data).eq('id', id);
    if (error) {
      set({ error: error.message });
      return;
    }
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, ...data } : p)),
      currentProject: state.currentProject?.id === id ? { ...state.currentProject, ...data } : state.currentProject,
    }));
  },

  deleteProject: async (id) => {
    await supabase.from('projects').delete().eq('id', id);
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProject: state.currentProject?.id === id ? null : state.currentProject,
    }));
  },

  duplicateProject: async (id) => {
    const project = get().projects.find((p) => p.id === id);
    if (!project) return;
    const user = useAuthStore.getState().user;
    if (!user) return;
    const { data: newProject } = await supabase
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
    if (newProject) {
      const { data: files } = await supabase.from('project_files').select('*').eq('project_id', id);
      if (files && files.length > 0) {
        const fileInserts = files.map((f) => ({
          project_id: (newProject as Project).id,
          path: f.path,
          content: f.content,
          file_type: f.file_type,
          is_directory: f.is_directory,
        }));
        await supabase.from('project_files').insert(fileInserts);
      }
      set((state) => ({ projects: [newProject as Project, ...state.projects] }));
    }
  },

  loadProject: async (id) => {
    set({ loading: true });
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
  },

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
    const { error } = await supabase
      .from('project_files')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('project_id', projectId)
      .eq('path', path);
    if (error) {
      set({ error: error.message });
      return;
    }
    set((state) => ({
      files: state.files.map((f) =>
        f.project_id === projectId && f.path === path ? { ...f, content } : f
      ),
    }));
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
      set({ error: error.message });
      return;
    }
    set((state) => ({ files: [...state.files, data as ProjectFile] }));
  },

  deleteFile: async (projectId, path) => {
    await supabase
      .from('project_files')
      .delete()
      .eq('project_id', projectId)
      .eq('path', path);
    set((state) => ({
      files: state.files.filter((f) => !(f.project_id === projectId && f.path === path)),
    }));
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

  loadConversation: async (projectId) => {
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
      const { data: newConv } = await supabase
        .from('ai_conversations')
        .insert({ project_id: projectId, title: 'New Conversation' })
        .select('*')
        .single();
      set({ conversation: newConv as AIConversation, messages: [] });
    }
  },

  sendMessage: async (projectId, content, onProgress) => {
    const conv = get().conversation;
    if (!conv) {
      throw new Error('Chat is still loading. Please try again in a moment.');
    }

    onProgress?.('Prompt received');

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

    onProgress?.(`Sending request to AI with ${get().files.filter((file) => !file.is_directory).length} existing files`);

    const project = get().currentProject;
    if (!project) {
      throw new Error('Project is still loading. Please try again in a moment.');
    }

    const isFirstPrompt = get().messages.length === 1;
    const hasStarterOnly = get().files.length > 0 && get().files.length <= 6;
    const isInitialGen = isFirstPrompt || hasStarterOnly;
    
    if (!isInitialGen) {
      try {
        await get().createVersion(projectId, `Before: ${content.slice(0, 30)}`, 'Auto checkpoint before generation');
      } catch {
        // Continue if version creation fails
      }
    } else {
      onProgress?.('Initial generation from wizard Describe - full app synthesis');
    }

    // Build conversation history for context
    const conversationHistory = get().messages.map((m) => ({ role: m.role, content: m.content }));
    const stateManagement = project.state_management || 'provider';

    const changedFiles = await requestAIGeneration(
      get().messages,
      get().files,
      isInitialGen,
      project.name,
      stateManagement,
      conversationHistory,
      onProgress,
    );
    onProgress?.(`AI returned ${changedFiles.length} file${changedFiles.length === 1 ? '' : 's'}`);

    for (const change of changedFiles) {
      onProgress?.(`${change.action === 'created' ? 'Creating' : 'Updating'} ${change.path}`);
      if (change.action === 'created' || change.action === 'modified') {
        const existing = get().files.find((f) => f.path === change.path);
        if (existing) {
          await get().saveFile(projectId, change.path, change.content ?? '');
        } else {
          await get().createFile(projectId, change.path, change.content ?? '');
        }
      } else if (change.action === 'deleted') {
        await get().deleteFile(projectId, change.path);
      }
    }

    const nextActionPrompts = generateNextActionPrompts(content, changedFiles);
    const assistantContent = buildAssistantResponse(content, changedFiles);
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
    onProgress?.('Files saved and explorer refreshed');

    // Auto-build preview after generation (like Lovable)
    onProgress?.('Auto-building preview...');
    try {
      const previewStore = usePreviewStore.getState();
      const currentSession = previewStore.getSession(projectId);
      if (!currentSession || currentSession.status === 'stopped' || currentSession.status === 'failed') {
        const currentFiles = get().files
          .filter((f) => !f.is_directory)
          .map((f) => ({ path: f.path, content: f.content }));
        if (currentFiles.length > 0) {
          await previewStore.build(projectId, currentFiles, {
            supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
            supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          });
          onProgress?.('Preview build started - check Preview tab');
        }
      }
    } catch {
      // Auto-build is best-effort — don't block the flow
    }
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
    if (!error && data) {
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
    }
  },

  removeDependency: async (projectId, packageId) => {
    await supabase.from('dependencies').delete().eq('id', packageId);
    set((state) => ({
      dependencies: state.dependencies.filter((d) => d.id !== packageId),
    }));
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
    const { data } = await supabase
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
    if (data) {
      set((state) => ({ versions: [data as ProjectVersion, ...state.versions] }));
    }
  },

  restoreVersion: async (projectId, versionId) => {
    const version = get().versions.find((v) => v.id === versionId);
    if (!version) return;
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

function buildAssistantResponse(prompt: string, changes: FileChange[]): string {
  const created = changes.filter((c) => c.action === 'created');
  const modified = changes.filter((c) => c.action === 'modified');
  const deleted = changes.filter((c) => c.action === 'deleted');

  let response = `I've analyzed your request and generated the Flutter project files.\n\n`;
  response += `**Summary:**\n`;
  if (created.length > 0) response += `- Created ${created.length} file(s)\n`;
  if (modified.length > 0) response += `- Modified ${modified.length} file(s)\n`;
  if (deleted.length > 0) response += `- Deleted ${deleted.length} file(s)\n`;
  response += `\n**Files changed:**\n`;
  for (const c of changes) {
    const icon = c.action === 'created' ? 'A' : c.action === 'modified' ? 'M' : 'D';
    response += `${icon} ${c.path}\n`;
  }
  response += `\nReview the changes in the file explorer, then run the analyzer and build to preview your app.`;
  return response;
}

export function generateNextActionPrompts(prompt: string, changes: FileChange[]): string[] {
  const lower = prompt.toLowerCase();
  const prompts: string[] = [];

  const hasSql = changes.some((c) => c.path.endsWith('.sql'));
  const hasAuth = changes.some((c) => c.path.includes('auth'));
  const hasCart = changes.some((c) => c.path.includes('cart'));

  if (!lower.includes('dark') && !lower.includes('theme')) {
    prompts.push('Add an animated Dark/Light Mode toggle');
  }

  if (!hasAuth && !lower.includes('auth') && !lower.includes('login')) {
    prompts.push('Add Supabase Auth with login, signup and password recovery');
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


async function requestAIGeneration(
  messages: AIMessage[],
  files: ProjectFile[],
  isInitialGeneration: boolean,
  projectName = 'FlutterForgeApp',
  stateManagement = 'provider',
  conversationHistory: Array<{ role: string; content: string }> = [],
  onProgress?: (msg: string) => void,
): Promise<FileChange[]> {
  // TIER 1: Edge Function (real AI generation with model fallback chain)
  try {
    onProgress?.('Sending request to AI (Nemotron Ultra + fallback models)...');
    const edgeKey = keyPool.getNextKey();
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
      headers: {
        'X-OpenRouter-Key': edgeKey,
      },
    });
    const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Edge timeout 90s')), 90000));
    const { data, error } = await Promise.race([invokePromise, timeoutPromise]) as Awaited<typeof invokePromise>;

    if (!error && data) {
      const generatedFiles = (data as { files?: Array<{ path?: unknown; content?: unknown }>; model?: string } | null)?.files;
      const usedModel = (data as { model?: string })?.model;
      if (Array.isArray(generatedFiles) && generatedFiles.length > 0) {
        onProgress?.(`AI generated ${generatedFiles.length} files using ${usedModel || 'unknown model'}`);
        const existingPaths = new Set(files.map((file) => file.path));
        return generatedFiles
          .filter((file: { path?: unknown; content?: unknown }): file is { path: string; content: string } => typeof file.path === 'string' && typeof file.content === 'string')
          .map((file) => ({
            path: file.path,
            content: file.content,
            action: existingPaths.has(file.path) ? 'modified' as const : 'created' as const,
          }));
      }
      onProgress?.('Edge returned empty - trying local AI agent...');
    } else if (error) {
      onProgress?.(`Edge failed (${(error as Error).message?.slice(0, 60)}) - trying local AI agent...`);
    }
  } catch (e) {
    onProgress?.(`Edge timeout/error (${(e as Error).message?.slice(0, 40)}) - trying local AI agent...`);
  }

  // TIER 2: Local FlutterSupabaseAgent (client-side AI with model fallback chain)
  onProgress?.('Generating with local AI agent (Nemotron Ultra + fallback models)...');
  const latestUserPrompt = messages.filter((m) => m.role === 'user').pop()?.content || 'Create Flutter application';
  const context = AgentContextBuilder.buildContext({
    projectId: 'active-project',
    projectName,
    files,
    conversationHistory: messages.map((m) => ({ role: m.role, content: m.content })),
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  });

  // Detect if this is an incremental edit (follow-up prompt after initial generation)
  const isIncremental = !isInitialGeneration && files.length > 6;

  const result = await FlutterSupabaseAgent.execute(latestUserPrompt, context, {
    enableAutoHealing: true,
    stateManagement: stateManagement as 'provider' | 'riverpod' | 'bloc' | 'change_notifier',
    isIncremental,
    conversationHistory,
    modelConfig: {
      provider: 'custom',
      modelName: 'nvidia/nemotron-3-ultra-550b-a55b:free',
      apiKey: keyPool.getNextKey(),
    },
    onEvent: (event) => {
      onProgress?.(event.message);
    },
  });

  const existingFileMap = new Map(files.map((file) => [file.path, file.content]));
  return result.files.map((file) => ({
    path: file.path,
    content: file.content,
    oldContent: existingFileMap.get(file.path),
    action: existingFileMap.has(file.path) ? ('modified' as const) : ('created' as const),
  }));
}

