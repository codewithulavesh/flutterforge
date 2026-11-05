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
import { SkillRegistry, type FlutterSkill } from './skills';
import { generateMinimalStarterFiles } from '../utils/flutterTemplates';

export * from './types';
export * from './skills';
export * from './prompts';
export * from './planner';
export * from './context';
export * from './chatIntent';
export * from './chatAnswer';
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
      try {
        const { useTerminalStore } = require('../stores/terminal.store');
        useTerminalStore.getState().addAgentEvent(fullEvent as any);
      } catch {
        // browser / non-cjs fallback
        import('../stores/terminal.store').then((m) => m.useTerminalStore.getState().addAgentEvent(fullEvent as any)).catch(() => {});
      }
      options.onEvent?.(fullEvent);
    };

    // Provider credentials must come from an explicit user setting or a
    // trusted server endpoint. VITE_* values are bundled into public JS.
    const apiKey = options.modelConfig?.apiKey || '';

    const stateManagement = options.stateManagement || 'provider';
    const conversationHistory = options.conversationHistory || [];
    const isIncremental = options.isIncremental || false;

    // Resolve modular capability skills
    const rawSkills: FlutterSkill[] = options.skills && options.skills.length > 0
      ? (typeof options.skills[0] === 'string'
          ? SkillRegistry.getAllSkills().filter((s) => (options.skills as string[]).includes(s.id))
          : (options.skills as FlutterSkill[]))
      : SkillRegistry.getActiveSkills();
    // Local-only requests explicitly do not use Supabase backend
    const activeSkills = context.usesSupabase === false
      ? rawSkills.filter((s) => s.id !== 'supabase')
      : rawSkills;
    const skillsPromptInjection = SkillRegistry.formatPromptInjection(activeSkills);

    const envModel =
      (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_AGENT_MODEL as string | undefined)) ||
      (typeof process !== 'undefined' && process.env?.VITE_AGENT_MODEL) ||
      'nvidia/nemotron-3.5-lightning:free';
    const llmClient = new OpenRouterClient({
      apiKey,
      model: options.modelConfig?.modelName || envModel,
      temperature: options.temperature ?? options.modelConfig?.temperature,
    });

    try {
      // Phase 1: Analyzing context
      emit({
        phase: 'analyzing',
        stepNumber: 1,
        totalSteps: TOTAL_STEPS,
        message: activeSkills.length > 0
          ? `Analyzing workspace with ${activeSkills.length} active Flutter skill(s): ${activeSkills.map((s) => s.name).join(', ')}`
          : 'Analyzing user request and project workspace...',
        detail: `Found ${(context.existingFiles || []).length} existing files in workspace.`,
      });

      // Phase 2: Feature Detection & Vector Pattern Retrieval
      const domain = AgentPlanner.detectDomain(prompt.toLowerCase());
      const features = AgentPlanner.detectFeatures(prompt, domain);

      emit({
        phase: 'feature_detection',
        stepNumber: 2,
        totalSteps: TOTAL_STEPS,
        message: `Detected domain: "${domain}". Searching the verified Flutter pattern library...`,
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
            message: `Retrieved ${retrievedPatterns.length} verified Flutter patterns`,
            retrievedPatterns,
          });
        }
      } catch {
        // Continue if vector search fails
      }

      let generatedFiles: AgentFileArtifact[] = [];
      // Hoisted so the E2E result always returns the REAL plan (not a dummy).
      let plan: AgentPlan | null = null;

      if (isIncremental && apiKey) {
        // ── INCREMENTAL EDIT PATH (follow-up prompts) ──────────────────
        emit({
          phase: 'incremental_edit',
          stepNumber: 3,
          totalSteps: TOTAL_STEPS,
          message: 'Generating incremental changes...',
        });

        const existingFiles = (context.existingFiles || []).map((f) => ({ path: f.path, content: f.content }));

        let editSuccess = false;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const editFiles = await llmClient.generateIncrementalEdit(
              prompt,
              existingFiles,
              conversationHistory,
              (msg) => emit({ phase: 'incremental_edit', stepNumber: 4, totalSteps: TOTAL_STEPS, message: msg }),
              context.usesSupabase !== false,
              options.signal,
            );

            if (editFiles.length > 0) {
              const existingFileMap = new Map((context.existingFiles || []).map((f) => [f.path, f.content]));
              generatedFiles = editFiles.map((f) => ({
                ...f,
                oldContent: existingFileMap.get(f.path),
                action: (existingFileMap.has(f.path) ? 'modified' : 'created') as 'modified' | 'created',
              }));
              editSuccess = true;
              break;
            }
          } catch (e) {
            if (options.signal?.aborted) throw new Error('Generation cancelled by user');
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
          throw new Error(
            'The AI could not produce a safe incremental edit after two attempts. Your existing files were left unchanged; retry when the AI service is available.',
          );
        }
      }

      if (isIncremental && !apiKey && (context.existingFiles || []).length > 0) {
        throw new Error(
          'An AI key is required to make this project change safely. Your existing files were left unchanged.',
        );
      }

      // ── FULL GENERATION PATH ─────────────────────────────────────────
      if (generatedFiles.length === 0) {
        // Phase 3: Planning
        emit({
          phase: 'planning',
          stepNumber: 3,
          totalSteps: TOTAL_STEPS,
          message: 'Planning the app architecture and data schema...',
        });

        if (apiKey) {
          // Attempt 1: live AI planning
          try {
            plan = await llmClient.planLive(prompt, context, stateManagement, (msg) => {
              emit({ phase: 'planning', stepNumber: 3, totalSteps: TOTAL_STEPS, message: msg });
            }, conversationHistory, options.signal);
          } catch {
            if (options.signal?.aborted) throw new Error('Generation cancelled by user');
            // Attempt 2: retry with next model in chain (silent — no scary error message)
            try {
              llmClient.resetModelChain();
              plan = await llmClient.planLive(prompt, context, stateManagement, (msg) => {
                emit({ phase: 'planning', stepNumber: 3, totalSteps: TOTAL_STEPS, message: msg });
              }, conversationHistory, options.signal);
            } catch {
              if (options.signal?.aborted) throw new Error('Generation cancelled by user');
              // Final fallback: deterministic structured planner (always works, no LLM needed)
              emit({
                phase: 'planning',
                stepNumber: 3,
                totalSteps: TOTAL_STEPS,
                message: 'Using smart structured planner for architecture design...',
              });
              plan = AgentPlanner.plan(prompt, context, { stateManagement: stateManagement as AgentPlan['stateManagement'], skills: activeSkills });
            }
          }
        } else {
          emit({
            phase: 'planning',
            stepNumber: 3,
            totalSteps: TOTAL_STEPS,
            message: 'No API key configured - using structured planner...',
          });
          plan = AgentPlanner.plan(prompt, context, { stateManagement: stateManagement as AgentPlan['stateManagement'], skills: activeSkills });
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
          const rawSummary = await AgentContextBuilder.buildSemanticContext(context, prompt);
          const semanticSummary = skillsPromptInjection ? `${rawSummary}\n\n${skillsPromptInjection}` : rawSummary;
          let liveSuccess = false;

          // Attempt 1: Single-pass generation
          try {
            const liveFiles = await llmClient.generateCodeSinglePass(
              prompt, plan, semanticSummary, retrievedPatterns, conversationHistory,
              (msg) => emit({ phase: 'code_generation', stepNumber: 4, totalSteps: TOTAL_STEPS, message: msg }),
              context.usesSupabase !== false,
              options.signal,
            );

            if (liveFiles.length > 0) {
              generatedFiles = this.mergeWithBaseline(
                liveFiles,
                this.generateBaselineFiles(plan, context),
                context,
                (msg) => emit({ phase: 'code_generation', stepNumber: 4, totalSteps: TOTAL_STEPS, message: msg }),
              );
              liveSuccess = true;
            }
          } catch (e) {
            if (options.signal?.aborted) throw new Error('Generation cancelled by user');
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
                (msg) => emit({ phase: 'code_generation', stepNumber: 4, totalSteps: TOTAL_STEPS, message: msg }),
                context.usesSupabase !== false,
                options.signal,
              );

              if (liveFiles.length > 0) {
                generatedFiles = this.mergeWithBaseline(
                  liveFiles,
                  this.generateBaselineFiles(plan, context),
                  context,
                  (msg) => emit({ phase: 'code_generation', stepNumber: 4, totalSteps: TOTAL_STEPS, message: msg }),
                );
                liveSuccess = true;
              }
            } catch {
              if (options.signal?.aborted) throw new Error('Generation cancelled by user');
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
            const existingFileMap = new Map((context.existingFiles || []).map((f) => [f.path, f.content]));
            generatedFiles = this.generateBaselineFiles(plan, context).map((f) => ({
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
          const existingFileMap = new Map((context.existingFiles || []).map((f) => [f.path, f.content]));
          generatedFiles = this.generateBaselineFiles(plan, context).map((f) => ({
            ...f,
            oldContent: existingFileMap.get(f.path),
            action: (existingFileMap.has(f.path) ? 'modified' : 'created') as 'modified' | 'created',
          }));
        }
      }

      // Ensure we always have a REAL plan for the E2E result.
      // Incremental edits skip planning, so synthesize the base plan for metadata.
      if (!plan) {
        plan = AgentPlanner.plan(prompt, context, { stateManagement: stateManagement as AgentPlan['stateManagement'], skills: activeSkills });
        plan.domain = domain;
        plan.features = features;
      }
      const finalPlan: AgentPlan = plan;

      // Enforce unique app id: the LLM often invents its own pubspec name.
      // Rewrite it to the plan's unique appId so every app ships different.
      if (finalPlan.appId && generatedFiles.length > 0) {
        const pubIdx = generatedFiles.findIndex((f) => f.path === 'pubspec.yaml');
        if (pubIdx >= 0 && generatedFiles[pubIdx]) {
          const current = generatedFiles[pubIdx].content;
          const rewritten = current.replace(/^name\s*:.*$/m, `name: ${finalPlan.appId}`);
          if (rewritten !== current) {
            generatedFiles[pubIdx] = { ...generatedFiles[pubIdx], content: rewritten };
            emit({
              phase: 'code_generation',
              stepNumber: 4,
              totalSteps: TOTAL_STEPS,
              message: `Pinned unique package name: ${finalPlan.appId}`,
            });
          }
        }
      }

      // Honor includeSqlMigrations === false by dropping SQL artifacts.
      if (options.includeSqlMigrations === false && generatedFiles.length > 0) {
        const dropped = generatedFiles.filter((f) => f.path.endsWith('.sql')).length;
        if (dropped > 0) {
          generatedFiles = generatedFiles.filter((f) => !f.path.endsWith('.sql'));
          emit({
            phase: 'code_generation',
            stepNumber: 4,
            totalSteps: TOTAL_STEPS,
            message: `Skipped ${dropped} SQL migration file(s) (includeSqlMigrations: false).`,
          });
        }
      }

      // Cross-check the plan's file manifest against what was actually
      // produced — surfaces silent LLM omissions before validation.
      {
        const produced = new Set(generatedFiles.map((f) => f.path));
        const missingPlanned = [...finalPlan.filesToCreate, ...finalPlan.filesToModify].filter(
          (p) => !produced.has(p),
        );
        if (missingPlanned.length > 0) {
          emit({
            phase: 'code_generation',
            stepNumber: 4,
            totalSteps: TOTAL_STEPS,
            message: `Warning: ${missingPlanned.length} planned file(s) missing from output: ${missingPlanned.slice(0, 5).join(', ')}${missingPlanned.length > 5 ? '...' : ''}`,
          });
        }
      }

      // Phase 5: Dependency resolution (E2E completeness gate)
      emit({
        phase: 'dependency_resolution',
        stepNumber: 5,
        totalSteps: TOTAL_STEPS,
        message: `Resolving ${Object.keys(finalPlan.dependencies).length} dependencies across ${generatedFiles.length} files...`,
      });

      // Phase 5b: Async non-blocking file embedding
      if (context.projectId) {
        void VectorStore.embedProjectFiles(context.projectId, generatedFiles);
      }

      // Phase 6: Validation & LLM-based Auto-Healing
      emit({
        phase: 'validation',
        stepNumber: 6,
        totalSteps: TOTAL_STEPS,
        message: 'Validating Dart null-safety, widget hierarchy, and dependencies...',
        generatedFiles,
      });

      let validationReport = AgentValidator.validate(generatedFiles, { usesSupabase: context.usesSupabase });

      if (options.enableAutoHealing !== false && !validationReport.isValid) {
        // Deterministic regex fixes FIRST on every path (typo imports,
        // missing deps, stale pins) — cheap and exact. The LLM then only
        // sees what regex cannot fix.
        const healed = AgentValidator.autoHeal(generatedFiles, validationReport, { usesSupabase: context.usesSupabase });
        generatedFiles = healed.healedFiles;
        validationReport = healed.report;
        if (healed.report.fixedIssues.length > 0) {
          emit({
            phase: 'auto_healing',
            stepNumber: 6,
            totalSteps: TOTAL_STEPS,
            message: `Deterministic fixes applied to ${healed.report.fixedIssues.length} issue(s); re-validating...`,
            validationReport,
          });
        }

        if (apiKey) {
          // LLM-based healing: feed errors back to LLM for repair, in bounded
          // rounds (default 1, max 3) so a failing model can't hang the run.
          const maxRounds = Math.min(Math.max(options.maxHealingRounds ?? 1, 1), 3);
          for (let round = 0; round < maxRounds && !validationReport.isValid; round++) {
            if (options.signal?.aborted) throw new Error('Generation cancelled by user');
            emit({
              phase: 'auto_healing',
              stepNumber: 6,
              totalSteps: TOTAL_STEPS,
              message: `Auto-healing ${validationReport.issues.length} validation errors via AI (round ${round + 1}/${maxRounds})...`,
              validationReport,
            });

            for (const issue of validationReport.issues.slice(0, 3)) {
              if (options.signal?.aborted) throw new Error('Generation cancelled by user');
              // Never pass pubspec.yaml or non-Dart files to the LLM Dart code healer.
              // Dependencies and configs must be resolved deterministically.
              if (issue.filePath === 'pubspec.yaml' || !issue.filePath.endsWith('.dart')) continue;

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

            // Always re-apply deterministic fixes (missing dependencies, pubspec pins, etc.)
            const healed = AgentValidator.autoHeal(generatedFiles, validationReport, { usesSupabase: context.usesSupabase });
            generatedFiles = healed.healedFiles;

            // Re-validate after each healing round
            validationReport = AgentValidator.validate(generatedFiles, { usesSupabase: context.usesSupabase });
          }
        }
      }

      const durationMs = Math.round(performance.now() - startTime);

      // Compact plan line so it is obvious WHAT was generated (domain,
      // tables, screens). Vague prompts all collapse to the generic template —
      // surfacing the detected plan here (plus a keyword tip) explains why
      // two such apps look alike instead of leaving users guessing.
      {
        const tables = finalPlan.schema.tables.map((t) => t.name).join(', ') || '—';
        const screens = finalPlan.screens.map((s) => s.name.replace(/Screen$/, '')).join(', ') || '—';
        emit({
          phase: 'schema_design',
          stepNumber: 3,
          totalSteps: TOTAL_STEPS,
          message: `Plan: ${finalPlan.appName} (${finalPlan.domain || 'general'}) — ${generatedFiles.length} files · tables: ${tables} · screens: ${screens}`,
          plan: finalPlan,
        });
        if ((finalPlan.domain || 'general') === 'general') {
          emit({
            phase: 'schema_design',
            stepNumber: 3,
            totalSteps: TOTAL_STEPS,
            message: 'Tip: name a domain (shop, chat, fitness, crypto, food…) for a tailored template instead of the generic one.',
          });
        }
      }

      // Per-file completion events drive the live file list in the UI
      // (center progress view + panel row). One `✓ path` line per file —
      // always the real produced set, never placeholders.
      for (const f of generatedFiles) {
        emit({
          phase: 'code_generation',
          stepNumber: 4,
          totalSteps: TOTAL_STEPS,
          message: `✓ ${f.path}`,
        });
        if (options.onFile) {
          options.onFile({
            path: f.path,
            content: f.content,
            action: f.action ?? 'created',
            language: f.language ?? (f.path.endsWith('.dart') ? 'dart' : f.path.endsWith('.yaml') ? 'yaml' : f.path.endsWith('.sql') ? 'sql' : 'text'),
            node: 'generation',
          });
        }
      }

      emit({
        phase: 'completed',
        stepNumber: 7,
        totalSteps: TOTAL_STEPS,
        message: `Successfully generated ${generatedFiles.length} files in ${durationMs}ms.`,
        generatedFiles,
        validationReport,
        plan: finalPlan,
      });

      const summary = this.buildSummary(finalPlan, generatedFiles, validationReport);

      return {
        success: true,
        plan: finalPlan,
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

  /**
   * Deterministic fallback. A local-only app must never inherit the starter's
   * Supabase service, auth screens or SQL, so it gets the small clean starter
   * instead of the full Supabase template.
   */
  private static generateBaselineFiles(plan: AgentPlan, context: AgentContext): AgentFileArtifact[] {
    return MultiFileCodeGenerator.generateAllFiles(plan, context);
  }

  private static buildSummary(
    plan: AgentPlan,
    files: AgentFileArtifact[],
    report: import('./types').ValidationReport
  ): string {
    const dartCount = files.filter((f) => f.path.endsWith('.dart')).length;
    const sqlCount = files.filter((f) => f.path.endsWith('.sql')).length;
    const tables = plan.schema.tables.map((t) => `\`${t.name}\``).join(', ') || '—';
    const screens = plan.screens.map((s) => `\`${s.name}\``).join(', ') || '—';

    return `### FlutterForge Lovable Agent Generation Summary

- **App Name:** ${plan.appName} (${plan.domain || 'general'})
- **Generated Files:** ${files.length} (${dartCount} Dart files, ${sqlCount} SQL migrations, pubspec.yaml)
- **Supabase Tables:** ${tables}
- **Screens:** ${screens}
- **Theme:** Material 3 with primary \`${plan.theme.primaryColor}\`
- **Validation:** ${report.isValid ? 'Clean (0 errors)' : report.summary}
`;
  }

  /**
   * E2E completeness gate: live LLM output wins, but any missing
   * planned/critical files are backfilled from the deterministic baseline
   * so validation never fails with MISSING_PUBSPEC / MISSING_MAIN_DART.
   */
  private static mergeWithBaseline(
    liveFiles: AgentFileArtifact[],
    baselineFiles: AgentFileArtifact[],
    context: AgentContext,
    onMessage?: (msg: string) => void,
  ): AgentFileArtifact[] {
    const livePaths = new Set(liveFiles.map((f) => f.path));
    const missing = baselineFiles.filter((f) => !livePaths.has(f.path));
    if (missing.length > 0) {
      onMessage?.(
        `Live output missing ${missing.length} file(s) — backfilling from structured generator: ${missing.slice(0, 5).map((f) => f.path).join(', ')}${missing.length > 5 ? '...' : ''}`,
      );
    }
    const existingFileMap = new Map((context.existingFiles || []).map((f) => [f.path, f.content]));
    return [...liveFiles, ...missing].map((f) => ({
      ...f,
      oldContent: existingFileMap.get(f.path),
      action: (existingFileMap.has(f.path) ? 'modified' : 'created') as 'modified' | 'created',
    }));
  }
}
