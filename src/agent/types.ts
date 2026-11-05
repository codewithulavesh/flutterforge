import type { FlutterSkill } from './skills';

export type AgentPhase =
  | 'analyzing'
  | 'feature_detection'
  | 'vector_retrieval'
  | 'planning'
  | 'schema_design'
  | 'batch_generation'
  | 'code_generation'
  | 'incremental_edit'
  | 'embedding'
  | 'dependency_resolution'
  | 'validation'
  | 'auto_healing'
  | 'completed'
  | 'failed';

export interface AgentModelConfig {
  provider: 'openai' | 'anthropic' | 'gemini' | 'groq' | 'custom' | 'local';
  modelName: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  baseUrl?: string;
}

export interface DetectedFeatures {
  domain: string;
  authMode: 'email' | 'oauth' | 'magic_link' | 'none';
  hasDarkMode: boolean;
  hasSearch: boolean;
  hasFilters: boolean;
  hasCharts: boolean;
  hasNotifications: boolean;
  hasMaps: boolean;
  hasPayments: boolean;
  hasRealtime: boolean;
  hasFileUpload: boolean;
  hasAnimations: boolean;
}

export interface CodePattern {
  id?: string;
  domain: string;
  category: 'screen' | 'widget' | 'service' | 'model' | 'sql';
  name: string;
  description: string;
  code: string;
  language: 'dart' | 'sql' | 'yaml';
  tags?: string[];
  similarity?: number;
}

export interface RelevantFile {
  filePath: string;
  summary: string;
  similarity: number;
}

export interface ColumnDefinition {
  name: string;
  type: 'uuid' | 'text' | 'varchar' | 'integer' | 'bigint' | 'boolean' | 'timestamp' | 'timestamptz' | 'jsonb' | 'numeric' | 'float';
  isPrimary?: boolean;
  isNullable?: boolean;
  defaultValue?: string;
  isUnique?: boolean;
  references?: {
    table: string;
    column: string;
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
  };
  description?: string;
}

export interface RLSPolicyDefinition {
  name: string;
  table: string;
  action: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';
  role?: 'authenticated' | 'anon' | 'public';
  usingExpression?: string;
  withCheckExpression?: string;
  description?: string;
}

export interface TableDefinition {
  name: string;
  description: string;
  columns: ColumnDefinition[];
  enableRLS: boolean;
  policies: RLSPolicyDefinition[];
  enableRealtime?: boolean;
}

export interface DatabaseSchemaPlan {
  projectName: string;
  tables: TableDefinition[];
  customTypes?: Array<{ name: string; values: string[] }>;
  storageBuckets?: Array<{ name: string; isPublic: boolean; fileLimitMb?: number }>;
  migrationSql?: string;
  seedSql?: string;
}

export interface ScreenPlan {
  name: string;
  routeName: string;
  routePath: string;
  filePath: string;
  description: string;
  isAuthProtected: boolean;
  widgets: string[];
  stateNeeds: string[];
  supabaseQueries?: string[];
}

export interface ServicePlan {
  name: string;
  filePath: string;
  purpose: string;
  methods: string[];
  dependencies: string[];
}

export interface ModelPlan {
  name: string;
  filePath: string;
  tableName?: string;
  fields: Array<{ name: string; dartType: string; isNullable: boolean; jsonKey: string }>;
}

/**
 * The design contract for a generated app. The planner commits to a direction
 * before any screen is written, and every screen is expected to consume these
 * tokens instead of inventing colors, fonts, spacing or motion per widget.
 */
export interface DesignBrief {
  direction: string;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    ink: string;
    muted: string;
    backgroundDark: string;
    surfaceDark: string;
    inkDark: string;
  };
  typography: {
    display: string;
    body: string;
    mono: string;
    displayWeight: number;
    bodyWeight: number;
  };
  spacing: {
    unit: number;
    scale: number[];
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
    pill: number;
  };
  motion: {
    fastMs: number;
    baseMs: number;
    slowMs: number;
    curve: string;
    style: string;
  };
  voice: {
    tone: string;
    rule: string;
  };
}

export interface AgentPlan {
  id: string;
  appName: string;
  /** Unique Dart package name (`name:` in pubspec.yaml). Always unique per project. */
  appId: string;
  /** Android applicationId derived from appId (com.flutterforge.<appId>). */
  applicationId: string;
  /** iOS bundle identifier derived from appId. */
  bundleId: string;
  appDescription: string;
  architecture: 'clean_architecture' | 'feature_first' | 'modular';
  stateManagement: 'riverpod' | 'provider' | 'bloc' | 'change_notifier';
  domain?: string;
  features?: DetectedFeatures;
  theme: {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    isDarkPreferred: boolean;
  };
  /** Palette, type, spacing, radius, motion and copy voice for every screen. */
  design?: DesignBrief;
  /** Active modular Flutter capability skills applied to this plan. */
  appliedSkills?: string[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  schema: DatabaseSchemaPlan;
  models: ModelPlan[];
  services: ServicePlan[];
  screens: ScreenPlan[];
  filesToCreate: string[];
  filesToModify: string[];
  estimatedSteps: number;
}

export interface AgentFileArtifact {
  path: string;
  content: string;
  oldContent?: string;
  language: 'dart' | 'yaml' | 'sql' | 'json' | 'markdown' | 'env';
  description?: string;
  isNew: boolean;
  action?: 'created' | 'modified' | 'deleted';
}

export interface ValidationIssue {
  filePath: string;
  line?: number;
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  suggestion?: string;
  autoFixAvailable: boolean;
}

export interface ValidationReport {
  isValid: boolean;
  issues: ValidationIssue[];
  fixedIssues: Array<{ issue: ValidationIssue; fixDescription: string }>;
  summary: string;
}

export interface AgentEvent {
  phase: AgentPhase;
  stepNumber: number;
  totalSteps: number;
  message: string;
  detail?: string;
  activeFile?: string;
  thought?: string;
  plan?: AgentPlan;
  generatedFiles?: AgentFileArtifact[];
  validationReport?: ValidationReport;
  retrievedPatterns?: CodePattern[];
  timestamp: string;
}

export type AgentEventListener = (event: AgentEvent) => void;

export interface AgentContext {
  projectId: string;
  projectName: string;
  projectDescription?: string;
  existingFiles: Array<{ path: string; content: string; isDirectory?: boolean; is_directory?: boolean }>;
  installedPackages?: Record<string, string>;
  /** Target platform selected when the project was created (web, mobile, desktop, macos, windows). */
  platform?: string;
  /** Exact Dart package name the generated pubspec must use. */
  appId?: string;
  /** True only when the app genuinely needs accounts/shared data/realtime. */
  usesSupabase?: boolean;
  /** File the user is currently viewing (helps chat/edit focus). */
  activeFile?: string | null;
  /** Latest preview/build errors to repair. */
  buildErrors?: string[];
  conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export interface AgentGenerationOptions {
  modelConfig?: AgentModelConfig;
  temperature?: number;
  enableAutoHealing?: boolean;
  maxHealingRounds?: number;
  includeSqlMigrations?: boolean;
  stateManagement?: 'riverpod' | 'provider' | 'bloc' | 'change_notifier';
  onEvent?: AgentEventListener;
  /** Raw harness file artefact (path, content, action) as it is written. */
  onFile?: (file: { path: string; content: string; action: 'created' | 'modified' | 'deleted'; language: string; node: string }) => void;
  isIncremental?: boolean;
  conversationHistory?: Array<{ role: string; content: string }>;
  /** Design contract for this project; the harness persists it per workspace. */
  designBrief?: DesignBrief;
  /** Routing hint: frontier for first-pass work, economy for routine edits. */
  modelRole?: 'frontier' | 'economy';
  /** Account plan the local engine uses to enforce frontier entitlement. */
  plan?: string;
  /** Active capability skills to guide planning and code generation. */
  skills?: FlutterSkill[] | string[];
  /** AbortSignal from the UI Stop button — cancels backend streams / LLM calls. */
  signal?: AbortSignal;
}

export interface AgentGenerationResult {
  success: boolean;
  plan: AgentPlan;
  files: AgentFileArtifact[];
  schemaSql?: string;
  validationReport: ValidationReport;
  summary: string;
  durationMs: number;
  logs: string[];
  retrievedPatterns?: CodePattern[];
}
