import {
  FLUTTER_SUPABASE_SYSTEM_PROMPT,
  PLANNING_PROMPT_TEMPLATE,
  SINGLE_PASS_GENERATION_PROMPT,
  INCREMENTAL_EDIT_PROMPT,
  VALIDATION_AND_HEALING_PROMPT,
  NO_BACKEND_RULES,
} from './prompts';
import { MultiFileCodeGenerator } from './codeGenerator';
import { AgentPlanner } from './planner';
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

// Per-model output caps (tokens). The chain mixes models with very different
// completion limits (e.g. Laguna caps at 32k) — requesting more can fail the
// call outright, so every request is clamped to the active model's cap.
const MODEL_OUTPUT_CAPS: Array<{ match: string; maxTokens: number }> = [
  { match: 'laguna', maxTokens: 32000 },
];

export function clampMaxTokens(model: string, requested: number): number {
  const lower = model.toLowerCase();
  for (const cap of MODEL_OUTPUT_CAPS) {
    if (lower.includes(cap.match)) return Math.min(requested, cap.maxTokens);
  }
  return requested;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Token-budgeted conversation history: most-recent turns first, oldest
 * dropped when over budget, each message truncated. Replaces unbounded
 * slice(-N) so long workspace chats can't blow the context window.
 */
export function budgetHistory<T extends { role: string; content: string }>(
  history: T[],
  opts: { maxTurns?: number; maxTokens?: number; maxCharsPerMessage?: number } = {},
): T[] {
  const { maxTurns = 6, maxTokens = 6000, maxCharsPerMessage = 4000 } = opts;
  const recent = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-maxTurns)
    .map((m) =>
      m.content.length > maxCharsPerMessage
        ? { ...m, content: `${m.content.slice(0, maxCharsPerMessage)}\n…[truncated for context budget]` }
        : m,
    );
  let total = recent.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  let start = 0;
  while (start < recent.length && total > maxTokens) {
    total -= estimateTokens(recent[start].content);
    start++;
  }
  return recent.slice(start);
}

// Keep the preferred fast/quality models first, then use OpenRouter's free
// router before provider-specific fallbacks. The router tracks live free-model
// availability, so a retired or temporarily unavailable model does not strand
// the request on a stale ID.
const FREE_MODEL_CHAIN = [
  'nvidia/nemotron-3.5-lightning:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'openrouter/free',
  'cohere/north-mini-code:free',
  'poolside/laguna-s-2.1:free',
];

export class OpenRouterClient {
  private explicitApiKey?: string;
  private model: string;
  private defaultTemperature = 0.15;
  private baseUrl = 'https://openrouter.ai/api/v1';
  private modelChainIndex = 0;

  constructor(config?: OpenRouterConfig) {
    if (config?.apiKey) {
      this.explicitApiKey = config.apiKey;
    }
    this.model = config?.model || FREE_MODEL_CHAIN[0];
    // Anchor the rotation index to the starting model so retries advance
    // through the chain instead of restarting or skipping entries.
    const startIdx = FREE_MODEL_CHAIN.indexOf(this.model);
    this.modelChainIndex = startIdx >= 0 ? startIdx : 0;
    if (config?.temperature !== undefined) {
      this.defaultTemperature = config.temperature;
    }
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
    const startIdx = FREE_MODEL_CHAIN.indexOf(this.model);
    this.modelChainIndex = startIdx >= 0 ? startIdx : 0;
  }

  /**
   * Sends a chat completion request with multi-key failover and model fallback
   */
  public async chat(
    messages: LLMMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      responseFormat?: { type: string };
      signal?: AbortSignal;
      onToken?: (token: string) => void;
      onReasoning?: (reasoning: string) => void;
      onRetry?: (message: string) => void;
      idleTimeoutMs?: number;
      timeoutMs?: number;
    }
  ): Promise<string> {
    const maxRetries = 3;
    let lastError: Error | null = null;
    let currentModel = this.model;

    // The old implementation set a 120s AbortController timeout but cleared it
    // the moment response *headers* arrived — `response.json()` then waited for
    // the body with no deadline at all. A slow (or hung) large completion
    // stalled generation forever with no retry. We now stream the completion
    // and enforce two real deadlines per attempt:
    //   • idle — no SSE delta for 30s (covers "never starts producing" too)
    //   • hard — 3 min cap even if the provider keeps trickling bytes
    const IDLE_TIMEOUT_MS = options?.idleTimeoutMs ?? 30000;
    const HARD_TIMEOUT_MS = options?.timeoutMs ?? 180000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (options?.signal?.aborted) throw new Error('Generation cancelled by user');
      const activeKey = this.explicitApiKey || keyPool.getNextKey();
      let timedOut = false;
      let removeAbortListener = () => {};
      let idleTimer: ReturnType<typeof setTimeout> | null = null;
      let hardTimer: ReturnType<typeof setTimeout> | null = null;

      try {
        const payload: Record<string, unknown> = {
          model: currentModel,
          messages,
          temperature: options?.temperature ?? this.defaultTemperature,
          max_tokens: clampMaxTokens(currentModel, options?.maxTokens ?? 64000),
          stream: true,
        };

        if (options?.responseFormat) {
          payload.response_format = options.responseFormat;
        }

        const controller = new AbortController();
        const abortFromCaller = () => controller.abort();
        options?.signal?.addEventListener('abort', abortFromCaller, { once: true });
        removeAbortListener = () => options?.signal?.removeEventListener('abort', abortFromCaller);
        if (options?.signal?.aborted) controller.abort();
        idleTimer = setTimeout(
          () => controller.abort(),
          IDLE_TIMEOUT_MS,
        );
        hardTimer = setTimeout(() => controller.abort(), HARD_TIMEOUT_MS);
        const bumpIdle = () => {
          if (idleTimer) clearTimeout(idleTimer);
          idleTimer = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS);
        };
        controller.signal.addEventListener('abort', () => { timedOut = true; });

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

        if (!response.ok) {
          clearTimeout(idleTimer);
          clearTimeout(hardTimer);
          removeAbortListener();
          const errorText = await response.text();
          let errorDetail = errorText;
          try {
            const errorJson = JSON.parse(errorText) as { error?: { message?: string } };
            errorDetail = errorJson.error?.message || errorText;
          } catch { /* use raw */ }

          const isRetryable = response.status === 401 || response.status === 402
            || response.status === 404 || response.status === 429 || response.status >= 500;
          // Rotate both credentials and models for auth/model availability
          // failures too; a bad key or unavailable model must not block the
          // remaining configured fallbacks.
          keyPool.markFailure(activeKey, `HTTP ${response.status}: ${errorDetail}`, isRetryable);

          if (isRetryable && attempt < maxRetries - 1) {
            options?.onRetry?.(`Retrying the answer with another key or model (${attempt + 2}/${maxRetries})…`);
            currentModel = this.getNextModel();
            continue;
          }

          throw new Error(`OpenRouter API error (${response.status}): ${errorDetail}`);
        }

        if (!response.body) {
          keyPool.markFailure(activeKey, 'No response stream from API', false);
          throw new Error('OpenRouter returned no response stream.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let content = '';

        const consumeFrame = (frame: string) => {
          const data = frame
            .split(/\r?\n/)
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trimStart())
            .join('\n');
          if (!data || data === '[DONE]') return;

          let ssePayload: {
            choices?: Array<{
              delta?: {
                content?: string | null;
                reasoning?: string | null;
                reasoning_content?: string | null;
              };
            }>;
          };
          try {
            ssePayload = JSON.parse(data) as typeof ssePayload;
          } catch {
            return;
          }

          // Active frame received — bump idle timeout immediately
          bumpIdle();

          const delta = ssePayload.choices?.[0]?.delta;
          const reasoning = delta?.reasoning || delta?.reasoning_content;
          if (typeof reasoning === 'string' && reasoning) {
            options?.onReasoning?.(reasoning);
          }

          const token = delta?.content;
          if (typeof token !== 'string' || !token) return;
          content += token;
          options?.onToken?.(token);
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bumpIdle();
            buffer += decoder.decode(value, { stream: true });
            const frames = buffer.split(/\r?\n\r?\n/);
            buffer = frames.pop() ?? '';
            frames.forEach(consumeFrame);
          }
          buffer += decoder.decode();
          if (buffer.trim()) consumeFrame(buffer);
        } finally {
          clearTimeout(idleTimer);
          clearTimeout(hardTimer);
          removeAbortListener();
          reader.releaseLock();
        }

        if (!content) {
          keyPool.markFailure(activeKey, 'Empty response from API', false);
          throw new Error(timedOut
            ? `OpenRouter stalled (no data for ${Math.round(IDLE_TIMEOUT_MS / 1000)}s) on ${currentModel}.`
            : 'Empty response from OpenRouter API.');
        }

        keyPool.markSuccess(activeKey);
        return content;
      } catch (err) {
        if (idleTimer) clearTimeout(idleTimer);
        if (hardTimer) clearTimeout(hardTimer);
        removeAbortListener();
        if (options?.signal?.aborted) throw new Error('Generation cancelled by user');
        lastError = err instanceof Error ? err : new Error(String(err));
        if (lastError.name === 'AbortError' || timedOut) {
          lastError = new Error(`OpenRouter stream stalled or timed out on ${currentModel} — retrying with the next key/model.`);
        }
        if (attempt < maxRetries - 1) {
          options?.onRetry?.(`The response stalled; retrying with another key or model (${attempt + 2}/${maxRetries})…`);
          currentModel = this.getNextModel();
          continue;
        }
      }
    }

    throw lastError || new Error('All OpenRouter models and keys failed.');
  }

  public async chatStream(
    messages: LLMMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      signal?: AbortSignal;
      onToken?: (token: string) => void;
      onReasoning?: (reasoning: string) => void;
      onRetry?: (message: string) => void;
      idleTimeoutMs?: number;
      timeoutMs?: number;
    },
  ): Promise<string> {
    return this.chat(messages, {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      signal: options?.signal,
      onToken: options?.onToken,
      onReasoning: options?.onReasoning,
      onRetry: options?.onRetry,
      idleTimeoutMs: options?.idleTimeoutMs,
      timeoutMs: options?.timeoutMs,
    });
  }

  /**
   * Performs live AI planning via OpenRouter LLM
   */
  public async planLive(
    prompt: string,
    context: AgentContext,
    stateManagement: string,
    onProgress?: (msg: string) => void,
    conversationHistory: Array<{ role: string; content: string }> = [],
    signal?: AbortSignal,
  ): Promise<AgentPlan> {
    onProgress?.(`Sending live planning request to OpenRouter (${this.model})...`);

    const planningPrompt = PLANNING_PROMPT_TEMPLATE
      .replace('{USER_PROMPT}', prompt)
      .replace('{PROJECT_NAME}', context.projectName || 'FlutterForgeApp')
      .replace('{STATE_MANAGEMENT}', stateManagement)
      .replace('{EXISTING_FILES_COUNT}', context.existingFiles.length.toString());

    const messages: LLMMessage[] = [
      // Ask the model explicitly to return only JSON — many models respect this
      // even without response_format, reducing parse failures.
      {
        role: 'system',
        content: FLUTTER_SUPABASE_SYSTEM_PROMPT
          + (context.usesSupabase === false ? NO_BACKEND_RULES : '')
          + '\n\nIMPORTANT: Respond with ONLY a valid JSON object. No preamble, no explanation, no markdown fences, no <think> blocks.',
      },
    ];

    // Follow-up prompts replan in conversational context (was: ignored).
    for (const msg of budgetHistory(conversationHistory, { maxTurns: 4, maxTokens: 2000 })) {
      messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
    }
    messages.push({ role: 'user', content: planningPrompt });

    // Try with json_object response_format first (supported by many models);
    // fall back to plain text if the API rejects it.
    let rawResponse: string;
    try {
      rawResponse = await this.chat(messages, {
        temperature: 0.1,
        maxTokens: 8000,
        responseFormat: { type: 'json_object' },
        signal,
      });
    } catch {
      if (signal?.aborted) throw new Error('Generation cancelled by user');
      rawResponse = await this.chat(messages, { temperature: 0.1, maxTokens: 8000, signal });
    }

    try {
      // Strip thinking/reasoning tags that some models (Nemotron, DeepSeek) prepend
      const cleaned = rawResponse
        .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      // Strategy 1: the whole cleaned string is JSON
      // Strategy 2: first {...} block
      // Strategy 3: last {...} block (some models put JSON after prose)
      let parsed: Partial<AgentPlan> | null = null;
      const candidates: string[] = [];
      if (cleaned.startsWith('{')) candidates.push(cleaned);
      const allMatches = [...cleaned.matchAll(/\{[\s\S]*?\}/g)].map((m) => m[0]);
      // Prefer longest match (most complete JSON object)
      allMatches.sort((a, b) => b.length - a.length);
      candidates.push(...allMatches);
      // Also try the entire string even if it doesn't start with {
      candidates.push(cleaned);

      for (const candidate of candidates) {
        try {
          parsed = JSON.parse(candidate) as Partial<AgentPlan>;
          if (parsed && typeof parsed === 'object') break;
        } catch {
          // try next candidate
        }
      }

      if (!parsed) throw new Error('No valid JSON found in response');

      const liveAppName = parsed.appName || context.projectName || 'FlutterForgeApp';
      // Live plans skip the deterministic planner, so backfill the unique
      // app identity here — otherwise every AI-planned app reuses one name.
      const { generateUniqueAppId, getAndroidApplicationId, getIosBundleId } =
        await import('../utils/appId');
      const liveAppId =
        parsed.appId || generateUniqueAppId(liveAppName, context.projectId || undefined);
      const liveDomain = parsed.domain || 'general';
      // A live plan may omit the design contract; derive the same deterministic
      // brief so every generated screen still shares one palette and type scale.
      const design = parsed.design || AgentPlanner.planDesign(prompt, liveDomain);

      return {
        id: crypto.randomUUID(),
        appName: liveAppName,
        appId: liveAppId,
        applicationId: parsed.applicationId || getAndroidApplicationId(liveAppId),
        bundleId: parsed.bundleId || getIosBundleId(liveAppId),
        appDescription: parsed.appDescription || `Production-grade app for ${prompt}`,
        architecture: 'feature_first',
        stateManagement: (stateManagement || 'provider') as AgentPlan['stateManagement'],
        domain: liveDomain,
        theme: parsed.theme || {
          primaryColor: design.palette.primary,
          secondaryColor: design.palette.secondary,
          backgroundColor: design.palette.background,
          isDarkPreferred: false,
        },
        design,
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
      // Silently fall back — the caller handles this with the structured planner
      throw new Error('plan_parse_failed');
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
    onProgress?: (msg: string) => void,
    usesSupabase = true,
    signal?: AbortSignal,
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
      'lib/core/theme/theme_controller.dart',
      'lib/core/widgets/theme_toggle_button.dart',
      'lib/core/router/app_router.dart',
      ...plan.screens.map((s) => s.filePath),
      ...plan.models.map((m) => m.filePath),
      ...plan.services.map((s) => s.filePath),
      ...(usesSupabase ? ['supabase/migrations/001_initial_schema.sql'] : []),
    ];

    const generationPrompt = SINGLE_PASS_GENERATION_PROMPT
      .replace('{PLAN_JSON}', JSON.stringify({
        appName: plan.appName,
        appId: (plan as Partial<AgentPlan>).appId,
        applicationId: (plan as Partial<AgentPlan>).applicationId,
        bundleId: (plan as Partial<AgentPlan>).bundleId,
        domain: plan.domain,
        theme: plan.theme,
        design: plan.design,
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
      { role: 'system', content: FLUTTER_SUPABASE_SYSTEM_PROMPT + (usesSupabase ? '' : NO_BACKEND_RULES) },
    ];

    // Token-budgeted recent history (was: unbounded slice(-6)).
    for (const msg of budgetHistory(conversationHistory, { maxTurns: 6, maxTokens: 6000 })) {
      messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
    }

    messages.push({ role: 'user', content: generationPrompt });

    onProgress?.('Generating all files in single AI pass...');

    const rawResponse = await this.chat(messages, { temperature: 0.15, maxTokens: 64000, signal });

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
    onProgress?: (msg: string) => void,
    usesSupabase = true,
    signal?: AbortSignal,
  ): Promise<AgentFileArtifact[]> {
    onProgress?.('Generating incremental changes...');

    const filesSummary = existingFiles.slice(0, 30).map((f) => `--- ${f.path} ---\n${f.content.slice(0, 500)}`).join('\n\n');

    const editPrompt = INCREMENTAL_EDIT_PROMPT
      .replace('{EXISTING_FILES_SUMMARY}', filesSummary)
      .replace('{USER_PROMPT}', prompt);

    const messages: LLMMessage[] = [
      { role: 'system', content: FLUTTER_SUPABASE_SYSTEM_PROMPT + (usesSupabase ? '' : NO_BACKEND_RULES) },
    ];

    for (const msg of budgetHistory(conversationHistory, { maxTurns: 8, maxTokens: 4000 })) {
      messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
    }

    messages.push({ role: 'user', content: editPrompt });

    const rawResponse = await this.chat(messages, { temperature: 0.15, maxTokens: 32000, signal });

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
      ], { temperature: 0.1, maxTokens: 16000 });

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
    return this.generateCodeSinglePass(prompt, plan, contextSummary, patterns, [], onProgress, true);
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
    return this.generateCodeSinglePass(prompt, plan, contextSummary, patterns, [], onProgress, true);
  }
}
