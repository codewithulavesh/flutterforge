import type {
  AgentContext,
  AgentGenerationOptions,
  AgentGenerationResult,
  AgentEvent,
  AgentFileArtifact,
  AgentPlan,
  CodePattern,
} from './types';
import { AgentContextBuilder } from './context';
import { AgentPlanner } from './planner';
import { MultiFileCodeGenerator } from './codeGenerator';
import { AgentValidator } from './validator';
import { OpenRouterClient } from './llmClient';
import { VectorStore } from './vectorStore';

export * from './types';
export * from './prompts';
export * from './planner';
export * from './context';
export * from './schemaGenerator';
export * from './codeGenerator';
export * from './validator';
export * from './llmClient';
export * from './keyPool';
export * from './vectorStore';

/**
 * Lovable-grade Flutter & Supabase AI Agent Orchestrator
 * Single-pass generation like Lovable — all files in one LLM call
 */
export class FlutterSupabaseAgent {
  public static async execute(
    prompt: string,
    context: AgentContext,
    options: AgentGenerationOptions = {}
  ): Promise<AgentGenerationResult> {
    const startTime = performance.now();
    const logs: string[] = [];
    const TOTAL_STEPS = 7;

    const emit = (event: Omit<AgentEvent, 'timestamp'>) => {
      const fullEvent: AgentEvent = { ...event, timestamp: new Date().toISOString() };
      logs.push(`[${fullEvent.phase.toUpperCase()}] ${fullEvent.message}`);
      options.onEvent?.(fullEvent);
    };

    const apiKey =
      options.modelConfig?.apiKey ||
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENROUTER_API_KEY) ||
      (typeof process !== 'undefined' && (process.env?.VITE_OPENROUTER_API_KEY || process.env?.OPENROUTER_API_KEY)) ||
      '';

    const stateManagement = options.stateManagement || 'provider';
    const conversationHistory = options.conversationHistory || [];
    const isIncremental = options.isIncremental || false;

    const llmClient = new OpenRouterClient({
      apiKey,
      model: options.modelConfig?.modelName || 'nvidia/nemotron-3-ultra-550b-a55b:free',
    });

    try {
      // Phase 1: Analyzing context
      emit({
        phase: 'analyzing',
        stepNumber: 1,
        totalSteps: TOTAL_STEPS,
        message: 'Analyzing user request and project workspace...',
        detail: `Found ${context.existingFiles.length} existing files in workspace.`,
      });

      // Phase 2: Feature Detection & Vector Pattern Retrieval
      const domain = AgentPlanner.detectDomain(prompt.toLowerCase());
      const features = AgentPlanner.detectFeatures(prompt, domain);

      emit({
        phase: 'feature_detection',
        stepNumber: 2,
        totalSteps: TOTAL_STEPS,
        message: `Detected domain: "${domain}". Searching vector database for production patterns...`,
        thought: `Domain=${domain}, auth=${features.authMode}, darkMode=${features.hasDarkMode}, realtime=${features.hasRealtime}`,
      });

      let retrievedPatterns: CodePattern[] = [];
      try {
        retrievedPatterns = await VectorStore.retrievePatterns(prompt, domain, undefined, 4);
        if (retrievedPatterns.length > 0) {
          emit({
            phase: 'vector_retrieval',
            stepNumber: 2,
            totalSteps: TOTAL_STEPS,
            message: `Retrieved ${retrievedPatterns.length} verified Flutter patterns (RAG)`,
            retrievedPatterns,
          });
        }
      } catch {
        // Continue if vector search fails
      }

      let generatedFiles: AgentFileArtifact[] = [];

      if (isIncremental && apiKey) {
        // ── INCREMENTAL EDIT PATH (follow-up prompts) ──────────────────
        emit({
          phase: 'incremental_edit',
          stepNumber: 3,
          totalSteps: TOTAL_STEPS,
          message: 'Generating incremental changes...',
        });

        const existingFiles = context.existingFiles.map((f) => ({ path: f.path, content: f.content }));

        let editSuccess = false;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const editFiles = await llmClient.generateIncrementalEdit(
              prompt,
              existingFiles,
              conversationHistory,
              (msg) => emit({ phase: 'incremental_edit', stepNumber: 4, totalSteps: TOTAL_STEPS, message: msg })
            );

            if (editFiles.length > 0) {
              const existingFileMap = new Map(context.existingFiles.map((f) => [f.path, f.content]));
              generatedFiles = editFiles.map((f) => ({
                ...f,
                oldContent: existingFileMap.get(f.path),
                action: (existingFileMap.has(f.path) ? 'modified' : 'created') as 'modified' | 'created',
              }));
              editSuccess = true;
              break;
            }
          } catch (e) {
            if (attempt === 0) {
              emit({
                phase: 'incremental_edit',
                stepNumber: 4,
                totalSteps: TOTAL_STEPS,
                message: `Edit attempt failed (${(e as Error).message.slice(0, 40)}) - retrying...`,
              });
              llmClient.resetModelChain();
            }
          }
        }

        if (!editSuccess) {
          emit({
            phase: 'incremental_edit',
            stepNumber: 4,
            totalSteps: TOTAL_STEPS,
            message: 'Incremental edit failed - falling back to full generation...',
          });
          // Fall through to full generation
        }
      }

      // ── FULL GENERATION PATH ─────────────────────────────────────────
      if (generatedFiles.length === 0) {
        // Phase 3: Planning
        emit({
          phase: 'planning',
          stepNumber: 3,
          totalSteps: TOTAL_STEPS,
          message: 'Generating custom architecture & Supabase schema via AI...',
        });

        let plan: AgentPlan;
        if (apiKey) {
          try {
            plan = await llmClient.planLive(prompt, context, stateManagement, (msg) => {
              emit({ phase: 'planning', stepNumber: 3, totalSteps: TOTAL_STEPS, message: msg });
            });
          } catch (e) {
            emit({
              phase: 'planning',
              stepNumber: 3,
              totalSteps: TOTAL_STEPS,
              message: `First planning attempt failed (${(e as Error).message.slice(0, 40)}) - retrying...`,
            });
            try {
              llmClient.resetModelChain();
              plan = await llmClient.planLive(prompt, context, stateManagement, (msg) => {
                emit({ phase: 'planning', stepNumber: 3, totalSteps: TOTAL_STEPS, message: msg });
              });
            } catch {
              emit({
                phase: 'planning',
                stepNumber: 3,
                totalSteps: TOTAL_STEPS,
                message: 'Using structured planner as fallback...',
              });
              plan = AgentPlanner.plan(prompt, context);
            }
          }
        } else {
          emit({
            phase: 'planning',
            stepNumber: 3,
            totalSteps: TOTAL_STEPS,
            message: 'No API key configured - using structured planner...',
          });
          plan = AgentPlanner.plan(prompt, context);
        }
        plan.domain = domain;
        plan.features = features;

        emit({
          phase: 'schema_design',
          stepNumber: 3,
          totalSteps: TOTAL_STEPS,
          message: `Generated plan with ${plan.schema.tables.length} tables, ${plan.screens.length} screens, and ${plan.services.length} services.`,
          plan,
        });

        // Phase 4: Single-pass code generation (like Lovable)
        emit({
          phase: 'batch_generation',
          stepNumber: 4,
          totalSteps: TOTAL_STEPS,
          message: 'Generating complete, production-grade Flutter + Supabase files...',
        });

        if (apiKey) {
          const semanticSummary = await AgentContextBuilder.buildSemanticContext(context, prompt);
          let liveSuccess = false;

          // Attempt 1: Single-pass generation
          try {
            const liveFiles = await llmClient.generateCodeSinglePass(
              prompt, plan, semanticSummary, retrievedPatterns, conversationHistory,
              (msg) => emit({ phase: 'code_generation', stepNumber: 4, totalSteps: TOTAL_STEPS, message: msg })
            );

            if (liveFiles.length > 0) {
              const existingFileMap = new Map(context.existingFiles.map((f) => [f.path, f.content]));
              generatedFiles = liveFiles.map((f) => ({
                ...f,
                oldContent: existingFileMap.get(f.path),
                action: (existingFileMap.has(f.path) ? 'modified' : 'created') as 'modified' | 'created',
              }));
              liveSuccess = true;
            }
          } catch (e) {
            emit({
              phase: 'code_generation',
              stepNumber: 4,
              totalSteps: TOTAL_STEPS,
              message: `Generation attempt failed (${(e as Error).message.slice(0, 40)}) - retrying with different model...`,
            });
          }

          // Attempt 2: Retry with next model
          if (!liveSuccess) {
            try {
              llmClient.resetModelChain();
              const liveFiles = await llmClient.generateCodeSinglePass(
                prompt, plan, semanticSummary, retrievedPatterns, conversationHistory,
                (msg) => emit({ phase: 'code_generation', stepNumber: 4, totalSteps: TOTAL_STEPS, message: msg })
              );

              if (liveFiles.length > 0) {
                const existingFileMap = new Map(context.existingFiles.map((f) => [f.path, f.content]));
                generatedFiles = liveFiles.map((f) => ({
                  ...f,
                  oldContent: existingFileMap.get(f.path),
                  action: (existingFileMap.has(f.path) ? 'modified' : 'created') as 'modified' | 'created',
                }));
                liveSuccess = true;
              }
            } catch {
              // Continue to template fallback
            }
          }

          // Absolute last resort: templates
          if (!liveSuccess) {
            emit({
              phase: 'code_generation',
              stepNumber: 4,
              totalSteps: TOTAL_STEPS,
              message: 'All AI generation attempts failed - using structured fallback',
            });
            const existingFileMap = new Map(context.existingFiles.map((f) => [f.path, f.content]));
            generatedFiles = MultiFileCodeGenerator.generateAllFiles(plan, context).map((f) => ({
              ...f,
              oldContent: existingFileMap.get(f.path),
              action: (existingFileMap.has(f.path) ? 'modified' : 'created') as 'modified' | 'created',
            }));
          }
        } else {
          emit({
            phase: 'code_generation',
            stepNumber: 4,
            totalSteps: TOTAL_STEPS,
            message: 'No API key configured - using structured generator...',
          });
          const existingFileMap = new Map(context.existingFiles.map((f) => [f.path, f.content]));
          generatedFiles = MultiFileCodeGenerator.generateAllFiles(plan, context).map((f) => ({
            ...f,
            oldContent: existingFileMap.get(f.path),
            action: (existingFileMap.has(f.path) ? 'modified' : 'created') as 'modified' | 'created',
          }));
        }
      }

      // Phase 5: Async non-blocking file embedding
      if (context.projectId) {
        void VectorStore.embedProjectFiles(context.projectId, generatedFiles);
      }

      // Phase 6: Validation & LLM-based Auto-Healing
      emit({
        phase: 'validation',
        stepNumber: 5,
        totalSteps: TOTAL_STEPS,
        message: 'Validating Dart null-safety, widget hierarchy, and dependencies...',
        generatedFiles,
      });

      let validationReport = AgentValidator.validate(generatedFiles);

      if (options.enableAutoHealing !== false && !validationReport.isValid && apiKey) {
        // LLM-based healing: feed errors back to LLM for repair
        emit({
          phase: 'auto_healing',
          stepNumber: 6,
          totalSteps: TOTAL_STEPS,
          message: `Auto-healing ${validationReport.issues.length} validation errors via AI...`,
          validationReport,
        });

        for (const issue of validationReport.issues.slice(0, 5)) {
          const file = generatedFiles.find((f) => f.path === issue.filePath);
          if (file && file.content) {
            const healedContent = await llmClient.healCode(
              file.path,
              file.content,
              [issue.message],
              (msg) => emit({ phase: 'auto_healing', stepNumber: 6, totalSteps: TOTAL_STEPS, message: msg })
            );
            if (healedContent) {
              file.content = healedContent;
              file.action = 'modified';
            }
          }
        }

        // Re-validate after healing
        validationReport = AgentValidator.validate(generatedFiles);
      } else if (options.enableAutoHealing !== false && !validationReport.isValid) {
        // No API key — use regex-based healing
        const healed = AgentValidator.autoHeal(generatedFiles, validationReport);
        generatedFiles = healed.healedFiles;
        validationReport = healed.report;
      }

      const durationMs = Math.round(performance.now() - startTime);

      emit({
        phase: 'completed',
        stepNumber: 7,
        totalSteps: TOTAL_STEPS,
        message: `Successfully generated ${generatedFiles.length} files in ${durationMs}ms.`,
        generatedFiles,
        validationReport,
      });

      const planSummary: AgentPlan = {
        id: crypto.randomUUID(),
        appName: context.projectName || 'App',
        appDescription: `Generated app for: ${prompt.slice(0, 100)}`,
        architecture: 'feature_first',
        stateManagement: stateManagement as AgentPlan['stateManagement'],
        domain,
        theme: { primaryColor: '#3B82F6', secondaryColor: '#8B5CF6', backgroundColor: '#FFFFFF', isDarkPreferred: false },
        dependencies: {},
        devDependencies: {},
        schema: { projectName: '', tables: [] },
        models: [],
        services: [],
        screens: [],
        filesToCreate: [],
        filesToModify: [],
        estimatedSteps: 10,
      };

      const summary = this.buildSummary(planSummary, generatedFiles, validationReport);

      return {
        success: true,
        plan: planSummary,
        files: generatedFiles,
        schemaSql: generatedFiles.find((f) => f.path.endsWith('.sql'))?.content,
        validationReport,
        summary,
        durationMs,
        logs,
        retrievedPatterns,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown generation error';
      emit({
        phase: 'failed',
        stepNumber: 0,
        totalSteps: TOTAL_STEPS,
        message: `Agent execution failed: ${message}`,
      });
      throw error;
    }
  }

  private static buildSummary(
    plan: AgentPlan,
    files: AgentFileArtifact[],
    report: import('./types').ValidationReport
  ): string {
    const dartCount = files.filter((f) => f.path.endsWith('.dart')).length;
    const sqlCount = files.filter((f) => f.path.endsWith('.sql')).length;

    return `### FlutterForge Lovable Agent Generation Summary

- **App Name:** ${plan.appName} (${plan.domain || 'general'})
- **Generated Files:** ${files.length} (${dartCount} Dart files, ${sqlCount} SQL migrations, pubspec.yaml)
- **Supabase Tables:** ${plan.schema.tables.map((t) => `\`${t.name}\``).join(', ')}
- **Screens:** ${plan.screens.map((s) => `\`${s.name}\``).join(', ')}
- **Theme:** Material 3 with primary \`${plan.theme.primaryColor}\`
- **Validation:** ${report.isValid ? 'Clean (0 errors)' : report.summary}
`;
  }
}

export async function runFlutterSupabaseAgent(
  prompt: string,
  context: AgentContext,
  options?: AgentGenerationOptions
): Promise<AgentGenerationResult> {
  return FlutterSupabaseAgent.execute(prompt, context, options);
}
