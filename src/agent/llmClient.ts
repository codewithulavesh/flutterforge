import {
  FLUTTER_SUPABASE_SYSTEM_PROMPT,
  PLANNING_PROMPT_TEMPLATE,
  SINGLE_PASS_GENERATION_PROMPT,
  INCREMENTAL_EDIT_PROMPT,
  VALIDATION_AND_HEALING_PROMPT,
} from './prompts';
import { MultiFileCodeGenerator } from './codeGenerator';
import { keyPool } from './keyPool';
import { VectorStore } from './vectorStore';
import type { AgentPlan, AgentFileArtifact, AgentContext, CodePattern } from './types';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  siteUrl?: string;
  siteName?: string;
}

// Free model fallback chain - verified available free models on OpenRouter (Aug 2026)
const FREE_MODEL_CHAIN = [
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'poolside/laguna-s-2.1:free',
  'cohere/north-mini-code:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3.5-lightning:free',
];

export class OpenRouterClient {
  private explicitApiKey?: string;
  private model: string;
  private baseUrl = 'https://openrouter.ai/api/v1';
  private modelChainIndex = 0;

  constructor(config?: OpenRouterConfig) {
    if (config?.apiKey) {
      this.explicitApiKey = config.apiKey;
    }
    this.model = config?.model || FREE_MODEL_CHAIN[0];
  }

  public setApiKey(key: string) {
    this.explicitApiKey = key;
    keyPool.addKey(key);
  }

  public setModel(model: string) {
    this.model = model;
  }

  private getNextModel(): string {
    this.modelChainIndex = (this.modelChainIndex + 1) % FREE_MODEL_CHAIN.length;
    return FREE_MODEL_CHAIN[this.modelChainIndex];
  }

  public resetModelChain() {
    this.modelChainIndex = 0;
  }

  /**
   * Sends a chat completion request with multi-key failover and model fallback
   */
  public async chat(
    messages: LLMMessage[],
    options?: { temperature?: number; maxTokens?: number; responseFormat?: { type: string } }
  ): Promise<string> {
    const maxRetries = 3;
    let lastError: Error | null = null;
    let currentModel = this.model;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const activeKey = this.explicitApiKey || keyPool.getNextKey();

      try {
        const payload: Record<string, unknown> = {
          model: currentModel,
          messages,
          temperature: options?.temperature ?? 0.15,
          max_tokens: options?.maxTokens ?? 64000,
        };

        if (options?.responseFormat) {
          payload.response_format = options.responseFormat;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${activeKey}`,
            'HTTP-Referer': 'https://flutterforge.dev',
            'X-Title': 'FlutterForge AI Agent',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          let errorDetail = errorText;
          try {
            const errorJson = JSON.parse(errorText) as { error?: { message?: string } };
            errorDetail = errorJson.error?.message || errorText;
          } catch { /* use raw */ }

          const isRetryable = [429, 402, 401, 404].includes(response.status);
          keyPool.markFailure(activeKey, `HTTP ${response.status}: ${errorDetail}`, isRetryable);

          if (isRetryable && attempt < maxRetries - 1) {
            currentModel = this.getNextModel();
            continue;
          }

          throw new Error(`OpenRouter API error (${response.status}): ${errorDetail}`);
        }

        const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          keyPool.markFailure(activeKey, 'Empty response from API', false);
          throw new Error('Empty response from OpenRouter API.');
        }

        keyPool.markSuccess(activeKey);
        return content;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if ((lastError as Error).name === 'AbortError') {
          lastError = new Error(`OpenRouter timeout (120s) on ${currentModel}`);
        }
        if (attempt < maxRetries - 1) {
          currentModel = this.getNextModel();
          continue;
        }
      }
    }

    throw lastError || new Error('All OpenRouter models and keys failed.');
  }

  /**
   * Performs live AI planning via OpenRouter LLM
   */
  public async planLive(prompt: string, context: AgentContext, stateManagement: string, onProgress?: (msg: string) => void): Promise<AgentPlan> {
    onProgress?.(`Sending live planning request to OpenRouter (${this.model})...`);

    const planningPrompt = PLANNING_PROMPT_TEMPLATE
      .replace('{USER_PROMPT}', prompt)
      .replace('{PROJECT_NAME}', context.projectName || 'FlutterForgeApp')
      .replace('{STATE_MANAGEMENT}', stateManagement)
      .replace('{EXISTING_FILES_COUNT}', context.existingFiles.length.toString());

    const messages: LLMMessage[] = [
      { role: 'system', content: FLUTTER_SUPABASE_SYSTEM_PROMPT },
      { role: 'user', content: planningPrompt },
    ];

    const rawResponse = await this.chat(messages, { temperature: 0.1 });

    try {
      const cleaned = rawResponse
        .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : cleaned;
      const parsed = JSON.parse(jsonString) as Partial<AgentPlan>;

      return {
        id: crypto.randomUUID(),
        appName: parsed.appName || context.projectName || 'FlutterForgeApp',
        appDescription: parsed.appDescription || `Production-grade app for ${prompt}`,
        architecture: 'feature_first',
        stateManagement: (stateManagement || 'provider') as AgentPlan['stateManagement'],
        domain: parsed.domain || 'general',
        theme: parsed.theme || {
          primaryColor: '#3B82F6',
          secondaryColor: '#8B5CF6',
          backgroundColor: '#FFFFFF',
          isDarkPreferred: false,
        },
        dependencies: parsed.dependencies || {
          supabase_flutter: '^2.8.0',
          go_router: '^14.6.2',
          google_fonts: '^6.2.1',
          provider: '^6.1.2',
          flutter_animate: '^4.5.0',
        },
        devDependencies: {
          flutter_test: 'sdk',
          flutter_lints: '^5.0.0',
        },
        schema: parsed.schema || {
          projectName: parsed.appName || 'App Schema',
          tables: [],
        },
        models: parsed.models || [],
        services: parsed.services || [],
        screens: parsed.screens || [],
        filesToCreate: parsed.filesToCreate || [],
        filesToModify: parsed.filesToModify || [],
        estimatedSteps: 10,
      };
    } catch {
      onProgress?.('Falling back to structured planner.');
      throw new Error('Failed to parse OpenRouter plan JSON response.');
    }
  }

  /**
   * Single-pass code generation: ALL files in one LLM call (like Lovable)
   */
  public async generateCodeSinglePass(
    prompt: string,
    plan: AgentPlan,
    contextSummary: string,
    patterns: CodePattern[],
    conversationHistory: Array<{ role: string; content: string }> = [],
    onProgress?: (msg: string) => void
  ): Promise<AgentFileArtifact[]> {
    const domain = plan.domain || 'general';

    const patternsText = patterns.length > 0
      ? patterns.map((p) => `// [Pattern: ${p.name} (${p.category})]\n${p.code}`).join('\n\n')
      : '// Standard Flutter & Material 3 Best Practices';

    const allFilePaths = [
      'pubspec.yaml',
      'analysis_options.yaml',
      'lib/main.dart',
      'lib/app.dart',
      'lib/core/constants/app_constants.dart',
      'lib/core/theme/app_theme.dart',
      'lib/core/router/app_router.dart',
      ...plan.screens.map((s) => s.filePath),
      ...plan.models.map((m) => m.filePath),
      ...plan.services.map((s) => s.filePath),
      'supabase/migrations/001_initial_schema.sql',
    ];

    const generationPrompt = SINGLE_PASS_GENERATION_PROMPT
      .replace('{PLAN_JSON}', JSON.stringify({
        appName: plan.appName,
        domain: plan.domain,
        theme: plan.theme,
        screens: plan.screens.map((s) => ({ name: s.name, filePath: s.filePath, description: s.description, widgets: s.widgets, stateNeeds: s.stateNeeds })),
        models: plan.models.map((m) => ({ name: m.name, filePath: m.filePath, tableName: m.tableName, fields: m.fields })),
        services: plan.services.map((s) => ({ name: s.name, filePath: s.filePath, purpose: s.purpose, methods: s.methods })),
        schema: plan.schema,
      }, null, 2))
      .replace('{ALL_FILES_LIST}', allFilePaths.map((p) => `- ${p}`).join('\n'))
      .replace('{RETRIEVED_PATTERNS}', patternsText)
      .replace('{CONTEXT_SUMMARY}', contextSummary)
      .replace('{USER_PROMPT}', prompt)
      .replace('{DOMAIN}', domain)
      .replace('{STATE_MANAGEMENT}', plan.stateManagement || 'provider');

    const messages: LLMMessage[] = [
      { role: 'system', content: FLUTTER_SUPABASE_SYSTEM_PROMPT },
    ];

    // Include last few conversation turns for context
    const recentHistory = conversationHistory.slice(-6);
    for (const msg of recentHistory) {
      messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
    }

    messages.push({ role: 'user', content: generationPrompt });

    onProgress?.('Generating all files in single AI pass...');

    const rawResponse = await this.chat(messages, { temperature: 0.15, maxTokens: 64000 });

    onProgress?.('Parsing AI-generated files...');

    const files = MultiFileCodeGenerator.parseLLMCodeArtifacts(rawResponse);

    // Check completeness: warn if expected files are missing
    const generatedPaths = new Set(files.map((f) => f.path));
    const missingFiles = allFilePaths.filter((p) => !generatedPaths.has(p));
    if (missingFiles.length > 0) {
      onProgress?.(`Warning: ${missingFiles.length} expected files missing from AI output: ${missingFiles.slice(0, 5).join(', ')}${missingFiles.length > 5 ? '...' : ''}`);
    }

    onProgress?.(`Successfully parsed ${files.length} files from AI output`);
    return files;
  }

  /**
   * Incremental edit: only changed files for follow-up prompts
   */
  public async generateIncrementalEdit(
    prompt: string,
    existingFiles: Array<{ path: string; content: string }>,
    conversationHistory: Array<{ role: string; content: string }>,
    onProgress?: (msg: string) => void
  ): Promise<AgentFileArtifact[]> {
    onProgress?.('Generating incremental changes...');

    const filesSummary = existingFiles.slice(0, 30).map((f) => `--- ${f.path} ---\n${f.content.slice(0, 500)}`).join('\n\n');

    const editPrompt = INCREMENTAL_EDIT_PROMPT
      .replace('{EXISTING_FILES_SUMMARY}', filesSummary)
      .replace('{USER_PROMPT}', prompt);

    const messages: LLMMessage[] = [
      { role: 'system', content: FLUTTER_SUPABASE_SYSTEM_PROMPT },
    ];

    const recentHistory = conversationHistory.slice(-8);
    for (const msg of recentHistory) {
      messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
    }

    messages.push({ role: 'user', content: editPrompt });

    const rawResponse = await this.chat(messages, { temperature: 0.15, maxTokens: 64000 });

    return MultiFileCodeGenerator.parseLLMCodeArtifacts(rawResponse);
  }

  /**
   * LLM-based error healing: feed compilation errors back for auto-fix
   */
  public async healCode(
    filePath: string,
    fileContent: string,
    issues: string[],
    onProgress?: (msg: string) => void
  ): Promise<string | null> {
    onProgress?.(`Healing ${filePath} (${issues.length} issues)...`);

    const healingPrompt = VALIDATION_AND_HEALING_PROMPT
      .replace('{FILE_PATH}', filePath)
      .replace('{ISSUES_LIST}', issues.join('\n'))
      .replace('{FILE_CONTENT}', fileContent);

    try {
      const rawResponse = await this.chat([
        { role: 'system', content: FLUTTER_SUPABASE_SYSTEM_PROMPT },
        { role: 'user', content: healingPrompt },
      ], { temperature: 0.1, maxTokens: 32000 });

      const files = MultiFileCodeGenerator.parseLLMCodeArtifacts(rawResponse);
      const healed = files.find((f) => f.path === filePath);
      return healed?.content || null;
    } catch {
      return null;
    }
  }

  /**
   * Legacy batched generation (kept as fallback)
   */
  public async generateCodeBatched(
    prompt: string,
    plan: AgentPlan,
    contextSummary: string,
    patterns: CodePattern[],
    onProgress?: (msg: string) => void
  ): Promise<AgentFileArtifact[]> {
    return this.generateCodeSinglePass(prompt, plan, contextSummary, patterns, [], onProgress);
  }

  /**
   * Legacy wrapper
   */
  public async generateCodeLive(
    prompt: string,
    plan: AgentPlan,
    contextSummary: string,
    onProgress?: (msg: string) => void
  ): Promise<AgentFileArtifact[]> {
    const domain = plan.domain || 'general';
    const patterns = await VectorStore.retrievePatterns(prompt, domain, undefined, 4);
    return this.generateCodeSinglePass(prompt, plan, contextSummary, patterns, [], onProgress);
  }
}
