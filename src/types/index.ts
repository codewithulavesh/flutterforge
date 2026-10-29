export type ProjectStatus = 'created' | 'generating' | 'ready' | 'building' | 'built' | 'failed' | 'deployed';
export type TaskStatus = 'queued' | 'planning' | 'generating' | 'analyzing' | 'fixing' | 'building' | 'ready' | 'failed' | 'deploying' | 'deployed';
export type BuildStatus = 'pending' | 'running' | 'success' | 'failed';
export type DeploymentStatus = 'pending' | 'deploying' | 'deployed' | 'failed';
export type DependencyStatus = 'installed' | 'installing' | 'failed' | 'available';
export type MessageRole = 'user' | 'assistant' | 'system';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  template: string;
  status: ProjectStatus;
  flutter_version: string;
  state_management: string;
  theme_mode: string;
  platform: string;
  config: Record<string, unknown>;
  preview_url: string | null;
  deployment_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  path: string;
  content: string;
  file_type: string | null;
  is_directory: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectVersion {
  id: string;
  project_id: string;
  version_number: number;
  label: string | null;
  description: string | null;
  file_snapshot: Record<string, { content: string }>;
  created_at: string;
}

export interface AIConversation {
  id: string;
  project_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AIMessage {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  tool_calls: ToolCall[] | null;
  changed_files: FileChange[] | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result: Record<string, unknown> | null;
}

export interface FileChange {
  path: string;
  action: 'created' | 'modified' | 'deleted';
  content?: string;
  previous_content?: string;
  oldContent?: string;
}

export interface GenerationTask {
  id: string;
  project_id: string;
  conversation_id: string | null;
  task_type: string;
  status: TaskStatus;
  progress: number;
  steps: GenerationStep[];
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface GenerationStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  detail?: string;
  files?: string[];
}

export interface Build {
  id: string;
  project_id: string;
  build_type: string;
  status: BuildStatus;
  logs: string;
  output_url: string | null;
  duration_ms: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface Dependency {
  id: string;
  project_id: string;
  package_name: string;
  version: string;
  package_type: 'direct' | 'dev' | 'transitive';
  status: DependencyStatus;
  created_at: string;
}

export interface Deployment {
  id: string;
  project_id: string;
  build_id: string | null;
  url: string | null;
  status: DeploymentStatus;
  provider: string;
  logs: string;
  created_at: string;
  completed_at: string | null;
}

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
  file?: ProjectFile;
}

export interface ThemeConfig {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    error: string;
    success: string;
    warning: string;
    text: string;
  };
  typography: {
    display: string;
    heading: string;
    subtitle: string;
    body: string;
    caption: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  radius: string;
  elevation: string;
  mode: 'light' | 'dark' | 'system';
}

export interface DevicePreset {
  name: string;
  width: number;
  height: number;
  icon: string;
}

export interface TerminalLine {
  id: string;
  type: 'command' | 'output' | 'error' | 'success';
  content: string;
  timestamp: number;
}

export interface Problem {
  id: string;
  file: string;
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  features: string[];
  badge?: string;
  category?: 'starter' | 'commerce' | 'analytics' | 'social' | 'ai';
  suggestedName?: string;
  defaultPrompt?: string;
  chips?: string[];
}

export type ConnectorStatus = 'connected' | 'disconnected' | 'error' | 'configuring';

export interface ConnectorField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'select';
  placeholder?: string;
  required?: boolean;
  options?: string[];
  value: string;
}
