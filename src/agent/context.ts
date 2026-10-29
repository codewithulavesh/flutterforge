import type { AgentContext } from './types';
import { VectorStore } from './vectorStore';

export class AgentContextBuilder {
  /**
   * Constructs an AgentContext from project files and conversation history
   */
  public static buildContext(params: {
    projectId: string;
    projectName: string;
    projectDescription?: string;
    files: Array<{ path: string; content: string; isDirectory?: boolean; is_directory?: boolean }>;
    conversationHistory?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    supabaseUrl?: string;
    supabaseAnonKey?: string;
    platform?: string;
    appId?: string;
    usesSupabase?: boolean;
    activeFile?: string | null;
    buildErrors?: string[];
  }): AgentContext {
    const installedPackages = this.extractPubspecDependencies(params.files);

    return {
      projectId: params.projectId,
      projectName: params.projectName,
      projectDescription: params.projectDescription,
      existingFiles: params.files.filter((f) => !f.isDirectory && !f.is_directory),
      installedPackages,
      platform: params.platform,
      appId: params.appId,
      usesSupabase: params.usesSupabase,
      activeFile: params.activeFile,
      buildErrors: params.buildErrors,
      conversationHistory: params.conversationHistory ?? [],
      supabaseUrl: params.supabaseUrl,
      supabaseAnonKey: params.supabaseAnonKey,
    };
  }

  /**
   * Generates a semantic, token-efficient summary of the existing project for LLM prompts
   */
  public static async buildSemanticContext(context: AgentContext, prompt: string): Promise<string> {
    const files = context.existingFiles;
    if (files.length === 0) {
      return 'Project is currently empty (New Project).';
    }

    // Try vector search for relevant existing files first
    if (context.projectId) {
      const relevant = await VectorStore.retrieveRelevantFiles(context.projectId, prompt, 6);
      if (relevant.length > 0) {
        const lines: string[] = [];
        lines.push(`Project Name: ${context.projectName}`);
        lines.push(`Semantically Relevant Files:`);
        relevant.forEach((r) => lines.push(` - ${r.filePath}: ${r.summary}`));
        return lines.join('\n');
      }
    }

    return this.summarizeProject(context);
  }

  /**
   * Generates a concise, token-efficient summary of the existing project for LLM prompts
   */
  public static summarizeProject(context: AgentContext): string {
    const files = context.existingFiles;
    if (files.length === 0) {
      return 'Project is currently empty (New Project).';
    }

    const lines: string[] = [];
    lines.push(`Project Name: ${context.projectName}`);
    lines.push(`Total Files: ${files.length}`);

    // Group files by directory
    const screens = files.filter((f) => f.path.startsWith('lib/screens/'));
    const models = files.filter((f) => f.path.startsWith('lib/models/'));
    const services = files.filter((f) => f.path.startsWith('lib/services/'));
    const core = files.filter((f) => f.path.startsWith('lib/core/'));
    const sqlMigrations = files.filter((f) => f.path.startsWith('supabase/'));

    if (screens.length > 0) {
      lines.push('\nScreens:');
      screens.forEach((s) => lines.push(` - ${s.path}`));
    }

    if (models.length > 0) {
      lines.push('\nData Models:');
      models.forEach((m) => lines.push(` - ${m.path}`));
    }

    if (services.length > 0) {
      lines.push('\nServices:');
      services.forEach((s) => lines.push(` - ${s.path}`));
    }

    if (core.length > 0) {
      lines.push('\nCore Architecture:');
      core.forEach((c) => lines.push(` - ${c.path}`));
    }

    if (sqlMigrations.length > 0) {
      lines.push('\nSupabase Migrations:');
      sqlMigrations.forEach((sq) => lines.push(` - ${sq.path}`));
    }

    // Extract pubspec summary
    const pubspec = files.find((f) => f.path === 'pubspec.yaml');
    if (pubspec) {
      lines.push('\nDependencies (from pubspec.yaml):');
      const deps = this.parseDependenciesFromYaml(pubspec.content);
      Object.entries(deps).forEach(([name, ver]) => lines.push(` - ${name}: ${ver}`));
    }

    return lines.join('\n');
  }

  /**
   * Extracts installed dependencies from pubspec.yaml
   */
  private static extractPubspecDependencies(
    files: Array<{ path: string; content: string; isDirectory?: boolean; is_directory?: boolean }>
  ): Record<string, string> {
    const pubspec = files.find((f) => f.path === 'pubspec.yaml');
    if (!pubspec) return {};
    return this.parseDependenciesFromYaml(pubspec.content);
  }


  /**
   * Simple YAML dependencies parser for pubspec.yaml
   */
  private static parseDependenciesFromYaml(yamlContent: string): Record<string, string> {
    const deps: Record<string, string> = {};
    const lines = yamlContent.split('\n');
    let inDeps = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('dependencies:')) {
        inDeps = true;
        continue;
      }
      if (inDeps && (trimmed.startsWith('dev_dependencies:') || (line.length > 0 && !line.startsWith(' ') && !line.startsWith('\t')))) {
        inDeps = false;
        continue;
      }
      if (inDeps && /^ {2}[^ \t]/.test(line) && trimmed.includes(':')) {
        // Exactly-2-space keys only: deeper lines are nested maps
        // (e.g. `sdk: flutter` under `flutter:`) and must not be captured.
        const parts = trimmed.split(':');
        const key = parts[0]?.trim();
        const value = parts.slice(1).join(':').trim();
        if (key && value && !key.startsWith('#')) {
          deps[key] = value;
        }
      }
    }

    return deps;
  }
}
