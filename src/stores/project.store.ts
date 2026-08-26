import { create } from 'zustand';
import { supabase } from '@/services/supabase';
import type { Project, ProjectFile, ProjectVersion, AIConversation, AIMessage, GenerationTask, Build, Dependency, Deployment, FileChange } from '@/types';
import { useAuthStore } from './auth.store';
import { generateFlutterProjectFiles } from '@/utils/flutterTemplates';

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

    const isInitialGen = get().files.length === 0;
    const changedFiles = await requestAIGeneration(get().messages, get().files, isInitialGen);
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

    const assistantContent = buildAssistantResponse(content, changedFiles);
    const assistantMessage: AIMessage = {
      id: crypto.randomUUID(),
      conversation_id: conv.id,
      role: 'assistant',
      content: assistantContent,
      tool_calls: null,
      changed_files: changedFiles,
      metadata: { fileCount: changedFiles.length },
      created_at: new Date().toISOString(),
    };
    set((state) => ({ messages: [...state.messages, assistantMessage] }));

    await supabase.from('ai_messages').insert({
      conversation_id: conv.id,
      role: 'assistant',
      content: assistantContent,
      changed_files: changedFiles,
    });

    await get().loadFiles(projectId);
    onProgress?.('Files saved and explorer refreshed');
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

function extractScreens(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const screens: string[] = [];
  const screenKeywords: Record<string, string> = {
    'splash': 'splash',
    'login': 'login',
    'sign in': 'login',
    'signup': 'signup',
    'sign up': 'signup',
    'register': 'signup',
    'home': 'home',
    'search': 'search',
    'category': 'categories',
    'categories': 'categories',
    'product': 'products',
    'products': 'products',
    'product detail': 'product_detail',
    'product details': 'product_detail',
    'cart': 'cart',
    'checkout': 'checkout',
    'order': 'orders',
    'orders': 'orders',
    'profile': 'profile',
    'settings': 'settings',
    'restaurant': 'restaurants',
    'restaurants': 'restaurants',
    'menu': 'menu',
    'dashboard': 'dashboard',
    'chat': 'chat',
    'feed': 'feed',
    'transaction': 'transactions',
    'transactions': 'transactions',
    'budget': 'budget',
  };

  for (const [keyword, screen] of Object.entries(screenKeywords)) {
    if (lower.includes(keyword) && !screens.includes(screen)) {
      screens.push(screen);
    }
  }

  if (screens.length === 0) screens.push('home');
  return screens;
}

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

async function generateIncrementalChanges(prompt: string, _files: ProjectFile[]): Promise<FileChange[]> {
  const lower = prompt.toLowerCase();
  const changes: FileChange[] = [];

  if (lower.includes('dark') || lower.includes('theme')) {
    changes.push({
      path: 'lib/core/theme/app_theme.dart',
      action: 'modified',
      content: `import 'package:flutter/material.dart';

class AppTheme {
  static const Color primary = Color(0xFF3B82F6);
  static const Color secondary = Color(0xFF8B5CF6);
  static const Color background = Color(0xFF111827);
  static const Color surface = Color(0xFF1F2937);
  static const Color error = Color(0xFFEF4444);
  static const Color success = Color(0xFF10B981);
  static const Color warning = Color(0xFFF59E0B);
  static const Color text = Color(0xFFF9FAFB);

  static ThemeData get lightTheme => ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(seedColor: primary, brightness: Brightness.light),
    scaffoldBackgroundColor: background,
  );

  static ThemeData get darkTheme => ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(seedColor: primary, brightness: Brightness.dark),
    scaffoldBackgroundColor: const Color(0xFF111827),
  );
}
`,
    });
  }

  if (lower.includes('search bar') || lower.includes('search')) {
    changes.push({
      path: 'lib/screens/home/home_screen.dart',
      action: 'modified',
      content: `import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Home')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            TextField(
              decoration: InputDecoration(
                hintText: 'Search...',
                prefixIcon: const Icon(Icons.search),
                filled: true,
                fillColor: AppTheme.surface,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
            const SizedBox(height: 16),
            Expanded(
              child: ListView.builder(
                itemCount: 10,
                itemBuilder: (context, index) => Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    leading: Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        color: AppTheme.primary.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.widgets, color: AppTheme.primary),
                    ),
                    title: Text('Item \${index + 1}'),
                    subtitle: const Text('Product description'),
                    trailing: const Icon(Icons.chevron_right),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
`,
    });
  }

  if (lower.includes('rounded') || lower.includes('card')) {
    changes.push({
      path: 'lib/widgets/app_card.dart',
      action: 'created',
      content: `import 'package:flutter/material.dart';

class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;

  const AppCard({
    super.key,
    required this.child,
    this.padding,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).cardColor,
      borderRadius: BorderRadius.circular(16),
      elevation: 2,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: padding ?? const EdgeInsets.all(16),
          child: child,
        ),
      ),
    );
  }
}
`,
    });
  }

  if (lower.includes('supabase') || lower.includes('auth')) {
    changes.push({
      path: 'lib/services/auth_service.dart',
      action: 'created',
      content: `import 'package:flutter/material.dart';

class AuthService extends ChangeNotifier {
  bool _isAuthenticated = false;
  bool get isAuthenticated => _isAuthenticated;

  Future<bool> signIn(String email, String password) async {
    await Future.delayed(const Duration(seconds: 1));
    _isAuthenticated = true;
    notifyListeners();
    return true;
  }

  Future<bool> signUp(String email, String password) async {
    await Future.delayed(const Duration(seconds: 1));
    _isAuthenticated = true;
    notifyListeners();
    return true;
  }

  Future<void> signOut() async {
    _isAuthenticated = false;
    notifyListeners();
  }
}
`,
    });
    changes.push({
      path: 'pubspec.yaml',
      action: 'modified',
      content: `name: flutter_app
description: A Flutter application generated by FlutterForge
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  go_router: ^14.0.0
  supabase_flutter: ^2.0.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^4.0.0

flutter:
  uses-material-design: true
`,
    });
  }

  return changes;
}

async function requestAIGeneration(
  messages: AIMessage[],
  files: ProjectFile[],
  isInitialGeneration: boolean,
): Promise<FileChange[]> {
  const { data, error } = await supabase.functions.invoke('ai-generate', {
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
  });

  if (error) {
    let detail = error.message;
    const context = (error as unknown as { context?: Response }).context;
    if (context) {
      try {
        const body = await context.clone().json() as { error?: string };
        detail = body.error ?? detail;
      } catch {
        // Keep the SDK message when the function response is not JSON.
      }
    }
    throw new Error(`AI generation failed: ${detail}`);
  }
  const generatedFiles = (data as { files?: Array<{ path?: unknown; content?: unknown }> } | null)?.files;
  if (!Array.isArray(generatedFiles)) {
    throw new Error('AI generation returned no files. Check the ai-generate Edge Function response.');
  }

  const existingPaths = new Set(files.map((file) => file.path));
  const changes = generatedFiles
    .filter((file: { path?: unknown; content?: unknown }): file is { path: string; content: string } => typeof file.path === 'string' && typeof file.content === 'string')
    .map((file) => ({
      path: file.path,
      content: file.content,
      action: existingPaths.has(file.path) ? 'modified' as const : 'created' as const,
    }));

  if (changes.length === 0) {
    throw new Error('AI generation returned an empty file list. Try a more specific prompt.');
  }

  return changes;
}
