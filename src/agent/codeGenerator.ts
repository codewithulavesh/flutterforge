import type {
  AgentPlan,
  AgentFileArtifact,
  AgentContext,
  ModelPlan,
  ServicePlan,
  ScreenPlan,
} from './types';
import { SupabaseSchemaGenerator } from './schemaGenerator';
import { AgentPlanner } from './planner';

const SAFE_CURVES = new Set([
  'linear', 'ease', 'easeIn', 'easeOut', 'easeInOut', 'fastOutSlowIn',
  'easeInQuad', 'easeOutQuad', 'easeInOutQuad',
  'easeInCubic', 'easeOutCubic', 'easeInOutCubic',
  'easeInQuart', 'easeOutQuart', 'easeInOutQuart',
  'easeInExpo', 'easeOutExpo', 'easeInOutExpo',
  'easeInBack', 'easeOutBack', 'easeInOutBack',
]);

function dartHex(value: string | undefined, fallback: string): string {
  const raw = String(value ?? '').replace('#', '').trim();
  return /^[0-9A-Fa-f]{6}$/.test(raw) ? raw.toUpperCase() : fallback;
}

function dartFont(value: string | undefined, fallback: string): string {
  const cleaned = String(value ?? '').replace(/[^A-Za-z0-9 ]/g, '').trim();
  return cleaned || fallback;
}

function dartWeight(value: number | undefined, fallback: number): number {
  const rounded = Math.round(Number(value ?? fallback) / 100) * 100;
  return rounded >= 100 && rounded <= 900 ? rounded : fallback;
}

function dartCurve(value: string | undefined): string {
  return value && SAFE_CURVES.has(value) ? value : 'easeOutCubic';
}

export class MultiFileCodeGenerator {
  /**
   * Generates all required Flutter + Supabase source files according to the AgentPlan
   */
  public static generateAllFiles(plan: AgentPlan, context: AgentContext): AgentFileArtifact[] {
    const artifacts: AgentFileArtifact[] = [];
    const usesSupabase = context.usesSupabase !== false;

    // 1. Pubspec and config files
    artifacts.push(this.generatePubspecYaml(plan, usesSupabase));
    artifacts.push(this.generateAnalysisOptions());

    // 2. Core architecture
    artifacts.push(this.generateAppConstants(plan, context));
    artifacts.push(this.generateAppTheme(plan));
    artifacts.push(this.generateThemeController());
    artifacts.push(this.generateThemeToggleButton());
    artifacts.push(this.generateAppRouter(plan, usesSupabase));
    artifacts.push(this.generateFormatters());

    // 3. Reusable UI components
    artifacts.push(this.generateCustomButton());
    artifacts.push(this.generateCustomTextField());
    artifacts.push(this.generateLoadingIndicator());
    artifacts.push(this.generateEmptyState());
    artifacts.push(this.generateShimmerSkeleton());

    // 4. Data models
    for (const model of plan.models) {
      artifacts.push(this.generateModelFile(model));
    }

    // 5. Services
    if (usesSupabase) {
      artifacts.push(this.generateSupabaseService());
      for (const service of plan.services) {
        if (service.name === 'SupabaseService') continue;
        artifacts.push(this.generateEntityService(service, plan));
      }
    } else {
      for (const service of plan.services) {
        if (service.name === 'SupabaseService') continue;
        artifacts.push(this.generateLocalEntityService(service, plan));
      }
    }

    // 6. State management providers
    artifacts.push(this.generateAppProvider(plan, usesSupabase));

    // 7. Feature screens
    for (const screen of plan.screens) {
      artifacts.push(this.generateScreenFile(screen, plan, usesSupabase));
    }

    // 8. App entry points
    artifacts.push(this.generateAppDart(plan));
    artifacts.push(this.generateMainDart(plan, usesSupabase));

    // 9. Supabase migration SQL (only if cloud backend requested)
    if (usesSupabase) {
      const migrationSql = SupabaseSchemaGenerator.generateMigrationSql(plan.schema);
      artifacts.push({
        path: 'supabase/migrations/001_initial_schema.sql',
        content: migrationSql,
        language: 'sql',
        description: 'Supabase PostgreSQL DDL and Row Level Security policies',
        isNew: true,
      });
    }

    return artifacts;
  }

  private static generateSeedItems(model: ModelPlan | undefined, modelName: string, count = 5): string {
    const fields = model?.fields || [];
    const items: string[] = [];

    const sampleTitles = [
      'Production API Cluster',
      'Telemetry Pipeline Node',
      'PostgreSQL Primary Replica',
      'Worker Job Queue',
      'Redis Distributed Cache',
      'Edge CDN Ingress',
    ];

    const sampleDescs = [
      'High-throughput distributed compute node running v3.4.',
      'Active message processing queue with automatic scaling.',
      'Primary database instance with automated replication.',
      'In-memory cache layer serving low-latency read traffic.',
      'Global edge router with TLS termination and DDoS mitigation.',
      'Background analytics batch processor with hourly triggers.',
    ];

    for (let i = 0; i < count; i++) {
      const fieldAssignments = fields.map((f) => {
        const lower = f.name.toLowerCase();
        if (lower === 'id') {
          return `        ${f.name}: '${i + 1}',`;
        }
        if (f.dartType === 'String') {
          if (lower.includes('title') || lower.includes('name')) {
            return `        ${f.name}: '${sampleTitles[i % sampleTitles.length]}',`;
          }
          if (lower.includes('desc') || lower.includes('detail') || lower.includes('message')) {
            return `        ${f.name}: '${sampleDescs[i % sampleDescs.length]}',`;
          }
          if (lower.includes('email')) {
            return `        ${f.name}: 'member${i + 1}@domain.com',`;
          }
          if (lower.includes('role')) {
            return `        ${f.name}: '${['Admin', 'Editor', 'Viewer'][i % 3]}',`;
          }
          if (lower.includes('status')) {
            return `        ${f.name}: '${['Active', 'Operational', 'Optimal'][i % 3]}',`;
          }
          if (lower.includes('category') || lower.includes('type')) {
            return `        ${f.name}: '${['Infrastructure', 'Database', 'Compute'][i % 3]}',`;
          }
          if (lower.includes('action')) {
            return `        ${f.name}: '${['CLUSTER_PROVISIONED', 'BACKUP_SNAPSHOT', 'FAILOVER_TEST', 'CACHE_FLUSHED'][i % 4]}',`;
          }
          if (lower.includes('image') || lower.includes('url') || lower.includes('avatar')) {
            return `        ${f.name}: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400',`;
          }
          return `        ${f.name}: '${modelName} Record #${i + 1}',`;
        }
        if (f.dartType === 'double') {
          if (lower.includes('price') || lower.includes('amount') || lower.includes('cost')) {
            return `        ${f.name}: ${(19.99 * (i + 1)).toFixed(2)},`;
          }
          if (lower.includes('rate') || lower.includes('load') || lower.includes('percent')) {
            return `        ${f.name}: ${(24.5 + i * 11.2).toFixed(1)},`;
          }
          return `        ${f.name}: ${(10.5 * (i + 1)).toFixed(1)},`;
        }
        if (f.dartType === 'int') {
          if (lower.includes('count') || lower.includes('quantity') || lower.includes('total')) {
            return `        ${f.name}: ${(i + 1) * 12},`;
          }
          return `        ${f.name}: ${(i + 1) * 5},`;
        }
        if (f.dartType === 'bool') {
          return `        ${f.name}: ${i % 2 === 0 ? 'true' : 'false'},`;
        }
        if (f.dartType.includes('DateTime')) {
          return `        ${f.name}: DateTime.now().subtract(const Duration(hours: ${i * 6 + 1})),`;
        }
        if (f.isNullable) {
          return `        ${f.name}: null,`;
        }
        return `        ${f.name}: '',`;
      });

      items.push(`      ${modelName}(\n${fieldAssignments.join('\n')}\n      ),`);
    }

    return items.join('\n');
  }

  private static generateLocalEntityService(service: ServicePlan, plan: AgentPlan): AgentFileArtifact {
    const entityName = service.name.replace('Service', '');
    const modelName = entityName;
    const modelSnake = this.toSnakeCase(modelName);
    const model = plan.models.find((m) => m.name === modelName) || plan.models[0];
    const seedCode = this.generateSeedItems(model, modelName, 5);

    const content = `import '../models/${modelSnake}.dart';

class ${service.name} {
  static final ${service.name} _instance = ${service.name}._internal();
  factory ${service.name}() => _instance;

  final List<${modelName}> _items = [];

  ${service.name}._internal() {
    _seedInitialData();
  }

  void _seedInitialData() {
    if (_items.isNotEmpty) return;
    _items.addAll([
${seedCode}
    ]);
  }

  Future<List<${modelName}>> fetchAll() async {
    await Future.delayed(const Duration(milliseconds: 100));
    return List<${modelName}>.from(_items);
  }

  Stream<List<${modelName}>> streamAll() async* {
    yield List<${modelName}>.from(_items);
  }

  Future<${modelName}?> create(${modelName} item) async {
    await Future.delayed(const Duration(milliseconds: 100));
    _items.insert(0, item);
    return item;
  }

  Future<bool> update(String id, ${modelName} updated) async {
    await Future.delayed(const Duration(milliseconds: 80));
    final index = _items.indexWhere((item) => (item as dynamic).id == id);
    if (index != -1) {
      _items[index] = updated;
      return true;
    }
    return false;
  }

  Future<bool> delete(String id) async {
    await Future.delayed(const Duration(milliseconds: 80));
    final before = _items.length;
    _items.removeWhere((item) => (item as dynamic).id == id);
    return _items.length < before;
  }

  Future<List<${modelName}>> search(String query) async {
    await Future.delayed(const Duration(milliseconds: 60));
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return fetchAll();
    return _items.where((item) {
      final json = item.toJson();
      return json.values.any((v) => v?.toString().toLowerCase().contains(q) == true);
    }).toList();
  }
}
`;
    return {
      path: `lib/services/${this.toSnakeCase(service.name)}.dart`,
      content,
      language: 'dart',
      description: `Singleton in-memory repository for ${modelName} with realistic seed data and search`,
      isNew: true,
    };
  }

  /**
   * Resolves an artifact language from the fence tag, falling back to the
   * file extension. Previously every non-dart/sql/yaml block was coerced to
   * `dart`, misclassifying json/markdown/env artifacts downstream.
   */
  private static inferArtifactLanguage(
    tag: string | undefined,
    filePath: string,
  ): AgentFileArtifact['language'] {
    const t = (tag || '').toLowerCase();
    const byTag: Record<string, AgentFileArtifact['language']> = {
      dart: 'dart',
      sql: 'sql',
      yaml: 'yaml',
      yml: 'yaml',
      json: 'json',
      markdown: 'markdown',
      md: 'markdown',
      env: 'env',
    };
    if (byTag[t]) return byTag[t];
    if (filePath.endsWith('.dart')) return 'dart';
    if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) return 'yaml';
    if (filePath.endsWith('.sql')) return 'sql';
    if (filePath.endsWith('.json')) return 'json';
    if (filePath.endsWith('.md') || filePath.endsWith('.markdown')) return 'markdown';
    if (filePath.endsWith('.env')) return 'env';
    return 'dart';
  }

  /**
   * Parses LLM raw text output containing file codeblocks into AgentFileArtifact objects
   */
  public static parseLLMCodeArtifacts(rawText: string): AgentFileArtifact[] {
    const artifacts: AgentFileArtifact[] = [];
    const seenPaths = new Set<string>();
    const blockRegex = /```([a-zA-Z0-9_-]+)?(?:\s+filepath=["']([^"']+)["']|\s+file=["']([^"']+)["']|\s+path=["']([^"']+)["'])?([\s\S]*?)```/g;

    let match: RegExpExecArray | null;
    let droppedBlocks = 0;
    while ((match = blockRegex.exec(rawText)) !== null) {
      const language = this.inferArtifactLanguage(match[1], match[2] || match[3] || match[4] || '');
      const content = match[5]?.trim() ?? '';

      // The prompt requires `filepath="..."` on every block, but models
      // occasionally omit it. Silently dropping those blocks used to lose
      // entire files (AppConstants/AppRouter/ThemeController) — the app then
      // failed to compile with "Undefined name" errors. Infer the path from
      // common leading-comment conventions before giving up on the block.
      let filePath = match[2] || match[3] || match[4];
      if (!filePath && content) {
        const firstLine = content.split('\n').find((l) => l.trim().length > 0)?.trim() ?? '';
        const candidates = [
          firstLine.match(/^\/\/+\s*(?:filepath|path|file)[:=]?\s*([^\s]+)$/i),
          firstLine.match(/^\/\/+\s*([\w./-]+\.(?:dart|yaml|yml|json|sql|md|html|css|txt))$/i),
          firstLine.match(/^#\s*([\w./-]+\.(?:yaml|yml|sql|sh|md|txt))$/i),
        ];
        const inferred = candidates.find((c) => c?.[1])?.[1];
        if (inferred && !inferred.includes(' ')) {
          filePath = inferred.replace(/^\.?\//, '');
        }
      }

      if (filePath && content) {
        // Deduplicate: keep last occurrence if same path appears twice
        if (seenPaths.has(filePath)) {
          const existingIdx = artifacts.findIndex((a) => a.path === filePath);
          if (existingIdx >= 0) {
            artifacts[existingIdx] = {
              path: filePath,
              content,
              language,
              isNew: true,
            };
            continue;
          }
        }
        seenPaths.add(filePath);
        artifacts.push({
          path: filePath,
          content,
          language,
          isNew: true,
        });
      } else if (content) {
        // A real code block with no recoverable path would be lost forever —
        // surface it loudly instead of failing later with compile errors.
        droppedBlocks++;
        console.warn('[Parser] Dropped code block without a file path — first line:', content.split('\n')[0].slice(0, 80));
      }
    }

    if (droppedBlocks > 0) {
      console.warn(`[Parser] ${droppedBlocks} code block(s) had no file path and were skipped.`);
    }

    // Detect truncation: if rawText ends mid-code-block (no closing ```)
    const lastFence = rawText.lastIndexOf('```');
    const afterLastFence = rawText.slice(lastFence + 3).trim();
    if (lastFence > 0 && afterLastFence.length > 0 && !afterLastFence.startsWith('```')) {
      // Possible truncation — the last block may be incomplete
      // Check if it looks like it was cut off (no closing fence)
      const openBlocks = (rawText.match(/```/g) || []).length;
      if (openBlocks % 2 !== 0) {
        console.warn('[Parser] Possible truncation detected — odd number of code fences');
      }
    }

    return artifacts;
  }

  private static generatePubspecYaml(plan: AgentPlan, usesSupabase = true): AgentFileArtifact {
    const isRiverpod = plan.stateManagement === 'riverpod';
    const stateDep = isRiverpod ? '  flutter_riverpod: ^2.5.1' : '  provider: ^6.1.2';
    // Unique per app: falls back to a sanitized app name for legacy plans.
    const packageName =
      plan.appId || plan.appName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const supabaseDep = usesSupabase ? '\n  supabase_flutter: ^2.8.0' : '';
    const content = `name: ${packageName}
description: A production-grade Flutter application generated by FlutterForge Lovable Agent.
publish_to: 'none'
version: 1.0.0+1
# Application ID: ${plan.applicationId || `com.flutterforge.${packageName}`}
# iOS Bundle ID: ${plan.bundleId || `com.flutterforge.${packageName}`}

environment:
  sdk: '>=3.4.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter${supabaseDep}
  go_router: ^14.6.2
  google_fonts: ^6.2.1
${stateDep}
  intl: ^0.20.3
  cached_network_image: ^3.4.1
  flutter_animate: ^4.5.0
  uuid: ^4.5.1
  shared_preferences: ^2.3.2

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^5.0.0

flutter:
  uses-material-design: true
`;
    return {
      path: 'pubspec.yaml',
      content,
      language: 'yaml',
      description: 'Flutter dependencies and project configuration',
      isNew: true,
    };
  }

  private static generateAnalysisOptions(): AgentFileArtifact {
    const content = `include: package:flutter_lints/flutter.yaml

linter:
  rules:
    prefer_const_constructors: true
    prefer_const_literals_to_create_immutables: true
    avoid_print: true
    use_build_context_synchronously: true
    prefer_single_quotes: true
    sort_child_properties_last: true
    sized_box_for_whitespace: true
`;
    return {
      path: 'analysis_options.yaml',
      content,
      language: 'yaml',
      description: 'Dart analysis and linter configuration',
      isNew: true,
    };
  }

  private static generateAppConstants(plan: AgentPlan, context: AgentContext): AgentFileArtifact {
    const supabaseUrl = context.supabaseUrl || 'https://your-project.supabase.co';
    const supabaseKey = context.supabaseAnonKey || 'your-anon-key';

    const content = `class AppConstants {
  static const String appName = '${plan.appName}';
  static const String appId = '${plan.appId || ''}';
  static const String applicationId = '${plan.applicationId || ''}';
  static const String bundleId = '${plan.bundleId || ''}';
  static const String supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: '${supabaseUrl}',
  );
  static const String supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: '${supabaseKey}',
  );

  static const Duration defaultAnimationDuration = Duration(milliseconds: 300);
  static const double defaultPadding = 16.0;
  static const double defaultBorderRadius = 16.0;
}
`;
    return {
      path: 'lib/core/constants/app_constants.dart',
      content,
      language: 'dart',
      description: 'Application constants and environment variables',
      isNew: true,
    };
  }

  private static generateAppTheme(plan: AgentPlan): AgentFileArtifact {
    const design = plan.design
      ?? AgentPlanner.planDesign(plan.appDescription || plan.appName, plan.domain || 'general');

    const primary = dartHex(design.palette.primary, '02AFB9');
    const secondary = dartHex(design.palette.secondary, 'F07067');
    const accent = dartHex(design.palette.accent, 'FACC15');
    const backgroundLight = dartHex(design.palette.background, 'FBFADD');
    const surfaceLight = dartHex(design.palette.surface, 'FFFFFF');
    const inkLight = dartHex(design.palette.ink, '0B3542');
    const mutedLight = dartHex(design.palette.muted, '5A7178');
    const backgroundDark = dartHex(design.palette.backgroundDark, '0A3542');
    const surfaceDark = dartHex(design.palette.surfaceDark, '124551');
    const inkDark = dartHex(design.palette.inkDark, 'F2FAFB');

    const displayFont = dartFont(design.typography.display, 'Sora');
    const bodyFont = dartFont(design.typography.body, 'Inter');
    const displayWeight = dartWeight(design.typography.displayWeight, 700);
    const bodyWeight = dartWeight(design.typography.bodyWeight, 400);
    const curve = dartCurve(design.motion.curve);

    const spacingValues = [...new Set(
      [design.spacing.unit, ...design.spacing.scale]
        .map((n) => Math.round(Number(n)))
        .filter((n) => Number.isFinite(n) && n > 0),
    )].sort((a, b) => a - b);
    const spacingTokens = spacingValues
      .map((n) => `  static const double space${n} = ${n};`)
      .join('\n');
    const pageGutter = spacingValues.find((n) => n >= 16) ?? 16;

    const radiusSm = Math.max(0, Math.round(design.radius.sm));
    const radiusMd = Math.max(radiusSm, Math.round(design.radius.md));
    const radiusLg = Math.max(radiusMd, Math.round(design.radius.lg));
    const radiusPill = Math.max(radiusLg, Math.round(design.radius.pill));

    const fastMs = Math.max(50, Math.round(design.motion.fastMs));
    const baseMs = Math.max(fastMs, Math.round(design.motion.baseMs));
    const slowMs = Math.max(baseMs, Math.round(design.motion.slowMs));

    const content = `import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Design tokens committed before any screen was written.
/// Screens consume these instead of inventing colors, spacing, radii,
/// type sizes or durations per widget.
abstract class AppTokens {
  // Spacing scale (${design.spacing.unit}pt base)
${spacingTokens}

  static const double pageGutter = ${pageGutter};

  static const double radiusSm = ${radiusSm};
  static const double radiusMd = ${radiusMd};
  static const double radiusLg = ${radiusLg};
  static const double radiusPill = ${radiusPill};

  static const Duration motionFast = Duration(milliseconds: ${fastMs});
  static const Duration motionBase = Duration(milliseconds: ${baseMs});
  static const Duration motionSlow = Duration(milliseconds: ${slowMs});
  static const Curve curve = Curves.${curve};
}

class AppTheme {
  static const Color primary = Color(0xFF${primary});
  static const Color secondary = Color(0xFF${secondary});
  static const Color accent = Color(0xFF${accent});

  static const Color backgroundLight = Color(0xFF${backgroundLight});
  static const Color surfaceLight = Color(0xFF${surfaceLight});
  static const Color textPrimaryLight = Color(0xFF${inkLight});
  static const Color textSecondaryLight = Color(0xFF${mutedLight});

  static const Color backgroundDark = Color(0xFF${backgroundDark});
  static const Color surfaceDark = Color(0xFF${surfaceDark});
  static const Color textPrimaryDark = Color(0xFF${inkDark});
  static const Color textSecondaryDark = Color(0xFF${inkDark});

  static final Color borderLight = textSecondaryLight.withOpacity(0.16);
  static final Color borderDark = textSecondaryDark.withOpacity(0.18);

  /// Display face for headings and titles, body face for prose.
  /// Both come from the approved design brief, not per-screen guesses.
  static TextTheme _textTheme(TextTheme base) {
    final display = GoogleFonts.getTextTheme('${displayFont}', base);
    final body = GoogleFonts.getTextTheme('${bodyFont}', base);
    return body.copyWith(
      displayLarge: display.displayLarge?.copyWith(
        fontWeight: FontWeight.w${displayWeight}, letterSpacing: -0.6, height: 1.05),
      displayMedium: display.displayMedium?.copyWith(
        fontWeight: FontWeight.w${displayWeight}, letterSpacing: -0.4, height: 1.1),
      displaySmall: display.displaySmall?.copyWith(
        fontWeight: FontWeight.w${displayWeight}, letterSpacing: -0.3, height: 1.15),
      headlineLarge: display.headlineLarge?.copyWith(
        fontWeight: FontWeight.w${displayWeight}, letterSpacing: -0.2),
      headlineMedium: display.headlineMedium?.copyWith(fontWeight: FontWeight.w${displayWeight}),
      headlineSmall: display.headlineSmall?.copyWith(fontWeight: FontWeight.w${displayWeight}),
      titleLarge: display.titleLarge?.copyWith(fontWeight: FontWeight.w${displayWeight}),
      bodyLarge: body.bodyLarge?.copyWith(fontWeight: FontWeight.w${bodyWeight}, height: 1.5),
      bodyMedium: body.bodyMedium?.copyWith(fontWeight: FontWeight.w${bodyWeight}, height: 1.5),
      bodySmall: body.bodySmall?.copyWith(fontWeight: FontWeight.w${bodyWeight}, height: 1.45),
      labelLarge: body.labelLarge?.copyWith(
        fontWeight: FontWeight.w600, letterSpacing: 0.2),
    );
  }

  static ThemeData get lightTheme {
    final scheme = ColorScheme.fromSeed(
      seedColor: primary,
      secondary: secondary,
      tertiary: accent,
      brightness: Brightness.light,
      surface: surfaceLight,
    ).copyWith(surface: surfaceLight, onSurface: textPrimaryLight);

    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: scheme,
      scaffoldBackgroundColor: backgroundLight,
    );

    return base.copyWith(
      textTheme: _textTheme(base.textTheme),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        foregroundColor: textPrimaryLight,
      ),
      cardTheme: CardThemeData(
        color: surfaceLight,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusLg),
          side: BorderSide(color: borderLight),
        ),
      ),
      dividerTheme: DividerThemeData(color: borderLight, thickness: 1),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: scheme.primary,
          foregroundColor: scheme.onPrimary,
          minimumSize: const Size(48, 48),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppTokens.radiusMd),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceLight,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        hintStyle: TextStyle(color: textSecondaryLight),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusMd),
          borderSide: BorderSide(color: borderLight),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusMd),
          borderSide: BorderSide(color: borderLight),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusMd),
          borderSide: BorderSide(color: primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusMd),
          borderSide: BorderSide(color: scheme.error),
        ),
      ),
    );
  }

  static ThemeData get darkTheme {
    final scheme = ColorScheme.fromSeed(
      seedColor: primary,
      secondary: secondary,
      tertiary: accent,
      brightness: Brightness.dark,
      surface: surfaceDark,
    ).copyWith(surface: surfaceDark, onSurface: textPrimaryDark);

    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: scheme,
      scaffoldBackgroundColor: backgroundDark,
    );

    return base.copyWith(
      textTheme: _textTheme(base.textTheme),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        foregroundColor: textPrimaryDark,
      ),
      cardTheme: CardThemeData(
        color: surfaceDark,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusLg),
          side: BorderSide(color: borderDark),
        ),
      ),
      dividerTheme: DividerThemeData(color: borderDark, thickness: 1),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: scheme.primary,
          foregroundColor: scheme.onPrimary,
          minimumSize: const Size(48, 48),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppTokens.radiusMd),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceDark,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        hintStyle: TextStyle(color: textSecondaryDark),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusMd),
          borderSide: BorderSide(color: borderDark),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusMd),
          borderSide: BorderSide(color: borderDark),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusMd),
          borderSide: BorderSide(color: primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusMd),
          borderSide: BorderSide(color: scheme.error),
        ),
      ),
    );
  }
}
`;
    return {
      path: 'lib/core/theme/app_theme.dart',
      content,
      language: 'dart',
      description: 'Material 3 design system with brief-driven palette, type scale, spacing and motion tokens',
      isNew: true,
    };
  }

  /**
   * Global theme state (light / dark / system) persisted with
   * shared_preferences. Every generated app ships this so its theme
   * toggle works from the first run — no setup required.
   */
  private static generateThemeController(): AgentFileArtifact {
    const content = `import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Global theme state: light / dark / system, persisted across restarts.
class ThemeController extends ValueNotifier<ThemeMode> {
  ThemeController._() : super(ThemeMode.system);

  static final ThemeController instance = ThemeController._();

  static const _prefsKey = 'ff_theme_mode';

  Future<void> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_prefsKey);
      value = _decode(raw);
    } catch (_) {
      value = ThemeMode.system;
    }
  }

  Future<void> setMode(ThemeMode mode) async {
    value = mode;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefsKey, mode.name);
    } catch (_) {
      // Persistence is best-effort — the in-memory mode still applies.
    }
  }

  Future<void> toggleLightDark() async {
    await setMode(value == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark);
  }

  static ThemeMode _decode(String? raw) {
    switch (raw) {
      case 'light':
        return ThemeMode.light;
      case 'dark':
        return ThemeMode.dark;
      case 'system':
      default:
        return ThemeMode.system;
    }
  }
}
`;
    return {
      path: 'lib/core/theme/theme_controller.dart',
      content,
      language: 'dart',
      description: 'Persisted global ThemeMode state (light/dark/system)',
      isNew: true,
    };
  }

  /**
   * AppBar-ready theme toggle button driven by [ThemeController].
   * Sun in dark mode, moon in light mode, with a smooth icon crossfade.
   */
  private static generateThemeToggleButton(): AgentFileArtifact {
    const content = `import 'package:flutter/material.dart';
import '../theme/theme_controller.dart';

/// AppBar-ready theme toggle: sun in dark mode, moon in light mode.
/// Tap toggles light <-> dark. Use alongside the full Light/Dark/Auto
/// selector on the Profile screen for complete theme control.
class ThemeToggleButton extends StatelessWidget {
  const ThemeToggleButton({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: ThemeController.instance,
      builder: (context, mode, _) {
        final isDark = mode == ThemeMode.dark ||
            (mode == ThemeMode.system &&
                MediaQuery.platformBrightnessOf(context) == Brightness.dark);
        return IconButton(
          tooltip: 'Toggle theme (currently ' + mode.name + ')',
          icon: AnimatedSwitcher(
            duration: const Duration(milliseconds: 250),
            child: Icon(
              isDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined,
              key: ValueKey<bool>(isDark),
            ),
          ),
          onPressed: () => ThemeController.instance.toggleLightDark(),
        );
      },
    );
  }
}
`;
    return {
      path: 'lib/core/widgets/theme_toggle_button.dart',
      content,
      language: 'dart',
      description: 'Animated AppBar theme toggle button',
      isNew: true,
    };
  }

  private static generateAppRouter(plan: AgentPlan, usesSupabase = true): AgentFileArtifact {
    const imports: string[] = [];
    const routes: string[] = [];

    const KNOWN_SCREEN_PATHS: Record<string, string> = {
      users: '../../screens/users/user_management_screen.dart',
      audit: '../../screens/audit/audit_logs_screen.dart',
      health: '../../screens/health/health_monitor_screen.dart',
      analytics: '../../screens/analytics/analytics_screen.dart',
      splash: '../../screens/splash/splash_screen.dart',
      auth: '../../screens/auth/auth_screen.dart',
      home: '../../screens/home/home_screen.dart',
      profile: '../../screens/profile/profile_screen.dart',
      detail: '../../screens/detail/detail_screen.dart',
      cart: '../../screens/cart/cart_screen.dart',
      UserManagementScreen: '../../screens/users/user_management_screen.dart',
      AuditLogsScreen: '../../screens/audit/audit_logs_screen.dart',
      HealthMonitorScreen: '../../screens/health/health_monitor_screen.dart',
      AnalyticsScreen: '../../screens/analytics/analytics_screen.dart',
    };

    for (const s of plan.screens) {
      const known = KNOWN_SCREEN_PATHS[s.routeName] || KNOWN_SCREEN_PATHS[s.name];
      const importPath = known
        ? known
        : s.filePath
        ? s.filePath.replace(/^lib\//, '../../')
        : `../../screens/${this.toSnakeCase(s.name.replace('Screen', ''))}/${this.toSnakeCase(s.name)}.dart`;
      imports.push(`import '${importPath}';`);
      // DetailScreen takes the route id param — every other screen is const.
      const builder = s.routeName === 'detail'
        ? `(context, state) => DetailScreen(itemId: state.pathParameters['id'],)`
        : `(context, state) => const ${s.name}(),`;
      routes.push(`      GoRoute(
        path: '${s.routePath}',
        name: '${s.routeName}',
        builder: ${builder}
      ),`);
    }

    const hasSplash = plan.screens.some((s) => s.routeName === 'splash');
    const initialLocation = (usesSupabase && hasSplash) ? '/splash' : '/';

    const content = `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
${imports.join('\n')}

class AppRouter {
  static final router = GoRouter(
    initialLocation: '${initialLocation}',
    routes: [
${routes.join('\n')}
    ],
  );
}
`;
    return {
      path: 'lib/core/router/app_router.dart',
      content,
      language: 'dart',
      description: 'GoRouter declarative routing configuration',
      isNew: true,
    };
  }

  private static generateFormatters(): AgentFileArtifact {
    const content = `import 'package:intl/intl.dart';

class Formatters {
  static String formatCurrency(double amount) {
    return NumberFormat.currency(symbol: '\\$', decimalDigits: 2).format(amount);
  }

  static String formatDate(DateTime? date) {
    if (date == null) return '';
    return DateFormat('MMM dd, yyyy').format(date);
  }

  static String formatTimeAgo(DateTime? date) {
    if (date == null) return '';
    final diff = DateTime.now().difference(date);
    if (diff.inDays > 7) return formatDate(date);
    if (diff.inDays > 0) return '\${diff.inDays}d ago';
    if (diff.inHours > 0) return '\${diff.inHours}h ago';
    if (diff.inMinutes > 0) return '\${diff.inMinutes}m ago';
    return 'Just now';
  }
}
`;
    return {
      path: 'lib/core/utils/formatters.dart',
      content,
      language: 'dart',
      description: 'String, currency and date formatting utilities',
      isNew: true,
    };
  }

  private static generateCustomButton(): AgentFileArtifact {
    const content = `import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class CustomButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final bool isLoading;
  final bool isOutlined;
  final IconData? icon;

  const CustomButton({
    super.key,
    required this.text,
    this.onPressed,
    this.isLoading = false,
    this.isOutlined = false,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    if (isOutlined) {
      return OutlinedButton(
        onPressed: isLoading ? null : onPressed,
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          side: const BorderSide(color: AppTheme.primary, width: 1.5),
        ),
        child: _buildChild(context, AppTheme.primary),
      );
    }

    return ElevatedButton(
      onPressed: isLoading ? null : onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: AppTheme.primary,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        elevation: 0,
      ),
      child: _buildChild(context, Colors.white),
    );
  }

  Widget _buildChild(BuildContext context, Color color) {
    if (isLoading) {
      return SizedBox(
        height: 20,
        width: 20,
        child: CircularProgressIndicator(strokeWidth: 2, color: color),
      );
    }
    if (icon != null) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 8),
          Text(text, style: TextStyle(color: color, fontWeight: FontWeight.w600)),
        ],
      );
    }
    return Text(text, style: TextStyle(color: color, fontWeight: FontWeight.w600));
  }
}
`;
    return {
      path: 'lib/core/widgets/custom_button.dart',
      content,
      language: 'dart',
      description: 'Reusable polished primary and secondary action buttons',
      isNew: true,
    };
  }

  private static generateCustomTextField(): AgentFileArtifact {
    const content = `import 'package:flutter/material.dart';

class CustomTextField extends StatelessWidget {
  final TextEditingController? controller;
  final String label;
  final String? hint;
  final IconData? prefixIcon;
  final Widget? suffixIcon;
  final bool obscureText;
  final TextInputType keyboardType;
  final String? Function(String?)? validator;
  final int maxLines;

  const CustomTextField({
    super.key,
    this.controller,
    required this.label,
    this.hint,
    this.prefixIcon,
    this.suffixIcon,
    this.obscureText = false,
    this.keyboardType = TextInputType.text,
    this.validator,
    this.maxLines = 1,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return TextFormField(
      controller: controller,
      obscureText: obscureText,
      keyboardType: keyboardType,
      validator: validator,
      maxLines: maxLines,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        prefixIcon: prefixIcon != null ? Icon(prefixIcon, size: 20) : null,
        suffixIcon: suffixIcon,
        filled: true,
        fillColor: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: theme.colorScheme.primary, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
    );
  }
}
`;
    return {
      path: 'lib/core/widgets/custom_text_field.dart',
      content,
      language: 'dart',
      description: 'Polished form input field with validation and icons',
      isNew: true,
    };
  }

  private static generateLoadingIndicator(): AgentFileArtifact {
    const content = `import 'package:flutter/material.dart';

class LoadingIndicator extends StatelessWidget {
  final String? message;

  const LoadingIndicator({super.key, this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(),
          if (message != null) ...[
            const SizedBox(height: 16),
            Text(
              message!,
              style: TextStyle(
                color: Theme.of(context).textTheme.bodySmall?.color,
                fontSize: 14,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
`;
    return {
      path: 'lib/core/widgets/loading_indicator.dart',
      content,
      language: 'dart',
      description: 'Centered animated loading indicator component',
      isNew: true,
    };
  }

  private static generateEmptyState(): AgentFileArtifact {
    const content = `import 'package:flutter/material.dart';
import 'custom_button.dart';

class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;
  final String? actionText;
  final VoidCallback? onAction;

  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.description,
    this.actionText,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: theme.colorScheme.primary.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 48, color: theme.colorScheme.primary),
            ),
            const SizedBox(height: 20),
            Text(
              title,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              description,
              style: TextStyle(color: theme.textTheme.bodyMedium?.color?.withOpacity(0.7), fontSize: 14),
              textAlign: TextAlign.center,
            ),
            if (actionText != null && onAction != null) ...[
              const SizedBox(height: 24),
              CustomButton(text: actionText!, onPressed: onAction),
            ],
          ],
        ),
      ),
    );
  }
}
`;
    return {
      path: 'lib/core/widgets/empty_state.dart',
      content,
      language: 'dart',
      description: 'Rich empty state component with call to action',
      isNew: true,
    };
  }

  private static generateShimmerSkeleton(): AgentFileArtifact {
    const content = `import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

class ShimmerSkeleton extends StatelessWidget {
  final double width;
  final double height;
  final double borderRadius;

  const ShimmerSkeleton({
    super.key,
    this.width = double.infinity,
    required this.height,
    this.borderRadius = 12,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0),
        borderRadius: BorderRadius.circular(borderRadius),
      ),
    )
        .animate(onPlay: (controller) => controller.repeat())
        .shimmer(
          duration: 1200.ms,
          color: isDark ? const Color(0xFF334155) : const Color(0xFFF8FAFC),
        );
  }
}
`;
    return {
      path: 'lib/core/widgets/shimmer_skeleton.dart',
      content,
      language: 'dart',
      description: 'Animated skeleton loading placeholder',
      isNew: true,
    };
  }

  private static generateModelFile(model: ModelPlan): AgentFileArtifact {
    const fieldsCode = model.fields
      .map((f) => `  final ${f.dartType} ${f.name};`)
      .join('\n');

    const constructorParams = model.fields
      .map((f) => `    ${f.isNullable ? '' : 'required '}this.${f.name},`)
      .join('\n');

    const fromJsonBody = model.fields
      .map((f) => {
        if (f.dartType.includes('DateTime')) {
          if (f.isNullable) {
            return `      ${f.name}: json['${f.jsonKey}'] != null ? DateTime.parse(json['${f.jsonKey}'] as String) : null,`;
          }
          return `      ${f.name}: json['${f.jsonKey}'] != null ? DateTime.parse(json['${f.jsonKey}'] as String) : DateTime.now(),`;
        }
        if (f.dartType.includes('double')) {
          return `      ${f.name}: (json['${f.jsonKey}'] as num?)?.toDouble() ?? 0.0,`;
        }
        if (f.dartType.includes('int')) {
          return `      ${f.name}: (json['${f.jsonKey}'] as num?)?.toInt() ?? 0,`;
        }
        if (f.dartType.includes('bool')) {
          return `      ${f.name}: json['${f.jsonKey}'] as bool? ?? false,`;
        }
        return `      ${f.name}: json['${f.jsonKey}'] as ${f.dartType}${f.isNullable ? '' : " ?? ''"},`;
      })
      .join('\n');

    const toJsonBody = model.fields
      .map((f) => {
        if (f.dartType.includes('DateTime')) {
          return `      '${f.jsonKey}': ${f.name}${f.dartType.endsWith('?') ? '?' : ''}.toIso8601String(),`;
        }
        return `      '${f.jsonKey}': ${f.name},`;
      })
      .join('\n');

    const copyWithParams = model.fields
      .map((f) => {
        const nullableType = f.dartType.endsWith('?') ? f.dartType : `${f.dartType}?`;
        return `    ${nullableType} ${f.name},`;
      })
      .join('\n');

    const copyWithBody = model.fields
      .map((f) => `      ${f.name}: ${f.name} ?? this.${f.name},`)
      .join('\n');

    const content = `class ${model.name} {
${fieldsCode}

  const ${model.name}({
${constructorParams}
  });

  factory ${model.name}.fromJson(Map<String, dynamic> json) {
    return ${model.name}(
${fromJsonBody}
    );
  }

  Map<String, dynamic> toJson() {
    return {
${toJsonBody}
    };
  }

  ${model.name} copyWith({
${copyWithParams}
  }) {
    return ${model.name}(
${copyWithBody}
    );
  }
}
`;
    return {
      path: model.filePath,
      content,
      language: 'dart',
      description: `Immutable Dart model for ${model.name}`,
      isNew: true,
    };
  }

  private static generateSupabaseService(): AgentFileArtifact {
    const content = `import 'package:supabase_flutter/supabase_flutter.dart';

class SupabaseService {
  static SupabaseClient get client => Supabase.instance.client;

  static User? get currentUser => client.auth.currentUser;
  static bool get isAuthenticated => currentUser != null;

  static Future<AuthResponse> signIn({
    required String email,
    required String password,
  }) async {
    return await client.auth.signInWithPassword(
      email: email,
      password: password,
    );
  }

  static Future<AuthResponse> signUp({
    required String email,
    required String password,
    Map<String, dynamic>? data,
  }) async {
    return await client.auth.signUp(
      email: email,
      password: password,
      data: data,
    );
  }

  static Future<void> signOut() async {
    await client.auth.signOut();
  }

  static Stream<AuthState> get authStateStream => client.auth.onAuthStateChange;
}
`;
    return {
      path: 'lib/services/supabase_service.dart',
      content,
      language: 'dart',
      description: 'Central Supabase client holder and authentication service',
      isNew: true,
    };
  }

  private static generateEntityService(service: ServicePlan, plan: AgentPlan): AgentFileArtifact {
    const entityName = service.name.replace('Service', '');
    const modelName = entityName;
    // E2E: resolve the REAL table name from the plan schema (fallback to pluralized guess).
    const modelPlan = plan.models.find((m) => m.name === modelName);
    const schemaTable = plan.schema.tables.find((t) => t.name === modelPlan?.tableName);
    const tableName = schemaTable?.name ?? modelPlan?.tableName ?? `${this.toSnakeCase(entityName)}s`;
    const modelSnake = this.toSnakeCase(modelName);

    const content = `import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/${modelSnake}.dart';
import 'supabase_service.dart';

class ${service.name} {
  final SupabaseClient _client = SupabaseService.client;

  Future<List<${modelName}>> fetchAll() async {
    try {
      final response = await _client
          .from('${tableName}')
          .select('*')
          .order('created_at', ascending: false);
      return (response as List<dynamic>)
          .map((json) => ${modelName}.fromJson(json as Map<String, dynamic>))
          .toList();
    } catch (e) {
      return [];
    }
  }

  Stream<List<${modelName}>> streamAll() {
    return _client
        .from('${tableName}')
        .stream(primaryKey: ['id'])
        .order('created_at', ascending: false)
        .map((maps) => maps.map((m) => ${modelName}.fromJson(m)).toList());
  }

  Future<${modelName}?> create(${modelName} item) async {
    final response = await _client
        .from('${tableName}')
        .insert(item.toJson())
        .select()
        .single();
    return ${modelName}.fromJson(response);
  }

  Future<void> update(String id, Map<String, dynamic> data) async {
    await _client.from('${tableName}').update(data).eq('id', id);
  }

  Future<void> delete(String id) async {
    await _client.from('${tableName}').delete().eq('id', id);
  }
}
`;
    return {
      path: service.filePath,
      content,
      language: 'dart',
      description: `Supabase CRUD and Realtime service for ${modelName}`,
      isNew: true,
    };
  }

  private static generateAppProvider(plan: AgentPlan, usesSupabase = true): AgentFileArtifact {
    const mainModel = plan.models.find((m) => m.name !== 'UserProfile') || plan.models[0];
    const modelName = mainModel?.name || 'Item';
    const modelSnake = this.toSnakeCase(modelName);
    const serviceName = `${modelName}Service`;

    if (plan.stateManagement === 'riverpod') {
      return this.generateRiverpodProvider(modelName, modelSnake, serviceName);
    }

    const supabaseImport = usesSupabase ? "\nimport '../services/supabase_service.dart';" : '';
    const authGetter = usesSupabase ? 'SupabaseService.isAuthenticated' : 'true';

    const content = `import 'package:flutter/material.dart';
import '../models/${modelSnake}.dart';
import '../services/${this.toSnakeCase(serviceName)}.dart';${supabaseImport}

class AppProvider extends ChangeNotifier {
  final ${serviceName} _service = ${serviceName}();

  List<${modelName}> _items = [];
  bool _isLoading = false;
  String? _error;

  List<${modelName}> get items => _items;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isAuthenticated => ${authGetter};

  AppProvider() {
    loadItems();
  }

  Future<void> loadItems() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _items = await _service.fetchAll();
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> addItem(${modelName} item) async {
    try {
      final created = await _service.create(item);
      if (created != null) {
        _items.insert(0, created);
        notifyListeners();
      }
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  Future<void> deleteItem(String id) async {
    try {
      await _service.delete(id);
      _items.removeWhere((item) => (item as dynamic).id == id);
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  Future<void> updateItem(String id, ${modelName} updated) async {
    try {
      await _service.update(id, updated);
      final idx = _items.indexWhere((item) => (item as dynamic).id == id);
      if (idx != -1) {
        _items[idx] = updated;
        notifyListeners();
      }
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  Future<void> search(String query) async {
    _isLoading = true;
    notifyListeners();
    try {
      _items = await _service.search(query);
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
`;
    return {
      path: 'lib/state/app_provider.dart',
      content,
      language: 'dart',
      description: 'ChangeNotifier state controller for application data',
      isNew: true,
    };
  }

  private static generateRiverpodProvider(
    modelName: string,
    modelSnake: string,
    serviceName: string,
  ): AgentFileArtifact {
    const serviceSnake = this.toSnakeCase(serviceName);
    const content = `import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/${modelSnake}.dart';
import '../services/${serviceSnake}.dart';
import '../services/supabase_service.dart';

class AppState {
  final List<${modelName}> items;
  final bool isLoading;
  final String? error;

  const AppState({
    this.items = const [],
    this.isLoading = false,
    this.error,
  });

  AppState copyWith({
    List<${modelName}>? items,
    bool? isLoading,
    String? error,
  }) {
    return AppState(
      items: items ?? this.items,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class AppNotifier extends StateNotifier<AppState> {
  AppNotifier() : super(const AppState()) {
    loadItems();
  }

  final ${serviceName} _service = ${serviceName}();

  bool get isAuthenticated => SupabaseService.isAuthenticated;

  Future<void> loadItems() async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final items = await _service.fetchAll();
      state = state.copyWith(items: items, isLoading: false);
    } catch (e) {
      state = state.copyWith(error: e.toString(), isLoading: false);
    }
  }

  Future<void> addItem(${modelName} item) async {
    try {
      final created = await _service.create(item);
      if (created != null) {
        state = state.copyWith(items: [created, ...state.items]);
      }
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  Future<void> deleteItem(String id) async {
    try {
      await _service.delete(id);
      state = state.copyWith(
        items: state.items.where((item) => item.id != id).toList(),
      );
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }
}

final appProvider = StateNotifierProvider<AppNotifier, AppState>((ref) {
  return AppNotifier();
});
`;
    return {
      path: 'lib/state/app_provider.dart',
      content,
      language: 'dart',
      description: 'Riverpod StateNotifier state controller for application data',
      isNew: true,
    };
  }

  private static generateScreenFile(screen: ScreenPlan, plan: AgentPlan, usesSupabase = true): AgentFileArtifact {
    if (screen.routeName === 'splash') {
      return this.generateSplashScreen();
    }
    if (screen.routeName === 'auth') {
      return this.generateAuthScreen();
    }
    if (screen.routeName === 'home') {
      return this.generateHomeScreen(plan, usesSupabase);
    }
    if (screen.routeName === 'profile') {
      return this.generateProfileScreen(usesSupabase);
    }
    if (screen.routeName === 'detail') {
      return this.generateDetailScreen(plan);
    }
    if (screen.routeName === 'cart') {
      return this.generateCartScreen(plan);
    }
    if (screen.routeName === 'users') {
      return this.generateUserManagementScreen(plan);
    }
    if (screen.routeName === 'audit') {
      return this.generateAuditLogsScreen(plan);
    }
    if (screen.routeName === 'health') {
      return this.generateHealthMonitorScreen(plan);
    }
    if (screen.routeName === 'analytics') {
      return this.generateAnalyticsScreen(plan);
    }

    // Default screen template
    const content = `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class ${screen.name} extends StatelessWidget {
  const ${screen.name}({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('${screen.name.replace('Screen', '')}'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: const Center(
        child: Text('${screen.description}'),
      ),
    );
  }
}
`;
    return {
      path: screen.filePath,
      content,
      language: 'dart',
      description: `${screen.name} UI Screen`,
      isNew: true,
    };
  }

  private static generateUserManagementScreen(plan: AgentPlan): AgentFileArtifact {
    const content = `import 'package:flutter/material.dart';

class UserManagementScreen extends StatefulWidget {
  const UserManagementScreen({super.key});

  @override
  State<UserManagementScreen> createState() => _UserManagementScreenState();
}

class _UserManagementScreenState extends State<UserManagementScreen> {
  final List<Map<String, String>> _users = [
    {'id': '1', 'name': 'Alex Mercer', 'email': 'alex@admin.co', 'role': 'Admin', 'status': 'Active'},
    {'id': '2', 'name': 'Sarah Connor', 'email': 'sarah@admin.co', 'role': 'Editor', 'status': 'Active'},
    {'id': '3', 'name': 'Marcus Vance', 'email': 'marcus@admin.co', 'role': 'Viewer', 'status': 'Active'},
    {'id': '4', 'name': 'Elena Rostova', 'email': 'elena@admin.co', 'role': 'Editor', 'status': 'Inactive'},
    {'id': '5', 'name': 'David Chen', 'email': 'david@admin.co', 'role': 'Viewer', 'status': 'Active'},
    {'id': '6', 'name': 'James Wilson', 'email': 'james@admin.co', 'role': 'Admin', 'status': 'Active'},
  ];

  String _filter = 'All';
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Color _getRoleColor(String role) {
    switch (role) {
      case 'Admin':
        return Colors.indigo;
      case 'Editor':
        return Colors.amber.shade800;
      case 'Viewer':
      default:
        return Colors.teal;
    }
  }

  void _cycleRole(int index) {
    final currentRole = _users[index]['role'] ?? 'Viewer';
    final nextRole = currentRole == 'Admin'
        ? 'Editor'
        : (currentRole == 'Editor' ? 'Viewer' : 'Admin');
    setState(() {
      _users[index]['role'] = nextRole;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('\${_users[index]['name']} promoted to \$nextRole'),
        duration: const Duration(seconds: 1),
      ),
    );
  }

  void _deleteUser(int index) {
    final removed = _users[index];
    setState(() {
      _users.removeAt(index);
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('\${removed['name']} removed'),
        action: SnackBarAction(
          label: 'UNDO',
          onPressed: () {
            setState(() {
              _users.insert(index, removed);
            });
          },
        ),
      ),
    );
  }

  void _showAddUserDialog() {
    final nameCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    String selectedRole = 'Viewer';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Row(
            children: [
              Icon(Icons.person_add_outlined, color: Colors.indigo),
              SizedBox(width: 10),
              Text('Add New Team Member'),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Full Name',
                    hintText: 'e.g. Jane Doe',
                    prefixIcon: Icon(Icons.badge_outlined),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: emailCtrl,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'Email Address',
                    hintText: 'e.g. jane@company.com',
                    prefixIcon: Icon(Icons.email_outlined),
                  ),
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  value: selectedRole,
                  decoration: const InputDecoration(
                    labelText: 'Role Permission',
                    prefixIcon: Icon(Icons.security_outlined),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'Admin', child: Text('Admin (Full Access)')),
                    DropdownMenuItem(value: 'Editor', child: Text('Editor (Manage Data)')),
                    DropdownMenuItem(value: 'Viewer', child: Text('Viewer (Read Only)')),
                  ],
                  onChanged: (v) => setDialogState(() => selectedRole = v ?? 'Viewer'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                final name = nameCtrl.text.trim();
                final email = emailCtrl.text.trim();
                if (name.isEmpty || email.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Please fill out all fields.')),
                  );
                  return;
                }
                setState(() {
                  _users.insert(0, {
                    'id': DateTime.now().millisecondsSinceEpoch.toString(),
                    'name': name,
                    'email': email,
                    'role': selectedRole,
                    'status': 'Active',
                  });
                });
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('User \$name added successfully!'),
                    backgroundColor: Colors.green.shade700,
                  ),
                );
              },
              child: const Text('Add Member'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _users.where((u) {
      final matchesRole = _filter == 'All' || u['role'] == _filter;
      final q = _searchQuery.toLowerCase();
      final matchesSearch = q.isEmpty ||
          (u['name']?.toLowerCase().contains(q) == true) ||
          (u['email']?.toLowerCase().contains(q) == true);
      return matchesRole && matchesSearch;
    }).toList();

    final adminCount = _users.where((u) => u['role'] == 'Admin').length;
    final editorCount = _users.where((u) => u['role'] == 'Editor').length;
    final viewerCount = _users.where((u) => u['role'] == 'Viewer').length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('User Management'),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add_alt_1),
            tooltip: 'Add User',
            onPressed: _showAddUserDialog,
          ),
        ],
      ),
      body: Column(
        children: [
          // KPI Counter Strip
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Row(
              children: [
                _buildStatPill('Total', '\${_users.length}', Colors.grey.shade800),
                const SizedBox(width: 8),
                _buildStatPill('Admins', '\$adminCount', Colors.indigo),
                const SizedBox(width: 8),
                _buildStatPill('Editors', '\$editorCount', Colors.amber.shade800),
                const SizedBox(width: 8),
                _buildStatPill('Viewers', '\$viewerCount', Colors.teal),
              ],
            ),
          ),

          // Search and Role Filter Bar
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    onChanged: (val) => setState(() => _searchQuery = val),
                    decoration: InputDecoration(
                      hintText: 'Search by name or email...',
                      prefixIcon: const Icon(Icons.search, size: 20),
                      suffixIcon: _searchQuery.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear, size: 18),
                              onPressed: () {
                                _searchController.clear();
                                setState(() => _searchQuery = '');
                              },
                            )
                          : null,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    border: Border.Border.all(color: Theme.of(context).dividerColor),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _filter,
                      items: ['All', 'Admin', 'Editor', 'Viewer']
                          .map((r) => DropdownMenuItem(value: r, child: Text(r)))
                          .toList(),
                      onChanged: (v) => setState(() => _filter = v ?? 'All'),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // User Cards List
          Expanded(
            child: filtered.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.person_search_outlined, size: 48, color: Colors.grey.shade400),
                        const SizedBox(height: 12),
                        const Text('No members found', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 4),
                        Text(
                          'Try modifying your search or filter criteria.',
                          style: TextStyle(color: Colors.grey.shade500, fontSize: 13),
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          onPressed: () {
                            _searchController.clear();
                            setState(() {
                              _searchQuery = '';
                              _filter = 'All';
                            });
                          },
                          icon: const Icon(Icons.restart_alt, size: 16),
                          label: const Text('Reset Filters'),
                        ),
                      ],
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, i) {
                      final user = filtered[i];
                      final role = user['role'] ?? 'Viewer';
                      final roleColor = _getRoleColor(role);
                      final originalIndex = _users.indexOf(user);

                      return Card(
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                          side: BorderSide(color: Theme.of(context).dividerColor.withOpacity(0.4)),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          child: Row(
                            children: [
                              CircleAvatar(
                                radius: 20,
                                backgroundColor: roleColor.withOpacity(0.15),
                                child: Text(
                                  (user['name'] ?? 'U')[0].toUpperCase(),
                                  style: TextStyle(color: roleColor, fontWeight: FontWeight.bold),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      user['name'] ?? '',
                                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      user['email'] ?? '',
                                      style: TextStyle(color: Colors.grey.shade500, fontSize: 12),
                                    ),
                                  ],
                                ),
                              ),
                              // Role Badge with Tap to promote
                              InkWell(
                                onTap: () => _cycleRole(originalIndex),
                                borderRadius: BorderRadius.circular(12),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: roleColor.withOpacity(0.15),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: roleColor.withOpacity(0.4)),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        role,
                                        style: TextStyle(color: roleColor, fontSize: 11, fontWeight: FontWeight.bold),
                                      ),
                                      const SizedBox(width: 4),
                                      Icon(Icons.sync_alt, size: 12, color: roleColor),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              IconButton(
                                icon: Icon(Icons.delete_outline, size: 20, color: Colors.red.shade300),
                                tooltip: 'Delete User',
                                onPressed: () => _deleteUser(originalIndex),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatPill(String label, String count, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
        decoration: BoxDecoration(
          color: color.withOpacity(0.12),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Column(
          children: [
            Text(count, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: color)),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 10, color: color)),
          ],
        ),
      ),
    );
  }
}
`;
    return {
      path: 'lib/screens/users/user_management_screen.dart',
      content,
      language: 'dart',
      description: 'Fully interactive User Management Screen with live search, roles, and add/delete actions',
      isNew: true,
    };
  }

  private static generateAuditLogsScreen(plan: AgentPlan): AgentFileArtifact {
    const content = `import 'package:flutter/material.dart';

class AuditLogsScreen extends StatefulWidget {
  const AuditLogsScreen({super.key});

  @override
  State<AuditLogsScreen> createState() => _AuditLogsScreenState();
}

class _AuditLogsScreenState extends State<AuditLogsScreen> {
  final List<Map<String, String>> _logs = [
    {
      'id': 'LOG-9402',
      'action': 'USER_ROLE_PROMOTED',
      'user': 'alex@admin.co',
      'target': 'marcus@admin.co -> Editor',
      'time': 'Just now',
      'status': 'success',
      'ip': '192.168.1.42',
    },
    {
      'id': 'LOG-9401',
      'action': 'SYSTEM_BACKUP_COMPLETED',
      'user': 'cron_backup_worker',
      'target': 's3://backups/snapshot_prod.tar',
      'time': '12 mins ago',
      'status': 'success',
      'ip': '10.0.0.1',
    },
    {
      'id': 'LOG-9400',
      'action': 'API_KEY_ROTATED',
      'user': 'alex@admin.co',
      'target': 'Telemetry API Key #3',
      'time': '45 mins ago',
      'status': 'success',
      'ip': '192.168.1.42',
    },
    {
      'id': 'LOG-9399',
      'action': 'FAILED_LOGIN_ATTEMPT',
      'user': 'unknown_actor',
      'target': '192.168.1.104 (5 failed tries)',
      'time': '2 hours ago',
      'status': 'warning',
      'ip': '192.168.1.104',
    },
    {
      'id': 'LOG-9398',
      'action': 'RATE_LIMIT_TRIGGERED',
      'user': 'gateway_rate_limiter',
      'target': 'Client IP 203.0.113.88 exceeded 1000 req/min',
      'time': '3 hours ago',
      'status': 'warning',
      'ip': '203.0.113.88',
    },
    {
      'id': 'LOG-9397',
      'action': 'SCHEMA_MIGRATION_DEPLOYED',
      'user': 'ci_pipeline',
      'target': '002_add_audit_indexes.sql',
      'time': '5 hours ago',
      'status': 'success',
      'ip': '10.0.4.12',
    },
    {
      'id': 'LOG-9396',
      'action': 'DATABASE_FAILOVER_TEST',
      'user': 'devops_lead',
      'target': 'Primary Replica Switch (0 downtime)',
      'time': '1 day ago',
      'status': 'success',
      'ip': '192.168.2.15',
    },
  ];

  String _selectedSeverity = 'All';
  String _searchQuery = '';

  void _simulateNewEvent() {
    final actions = [
      {'action': 'ACCESS_TOKEN_REFRESHED', 'user': 'sarah@admin.co', 'target': 'Auth Session #88', 'status': 'success'},
      {'action': 'CACHE_INVALIDATED', 'user': 'system_cache', 'target': 'Redis Cache Cluster A', 'status': 'success'},
      {'action': 'UNUSUAL_GEO_LOGIN', 'user': 'elena@admin.co', 'target': 'Login from Madrid, Spain', 'status': 'warning'},
      {'action': 'EXPORT_JOB_REQUESTED', 'user': 'james@admin.co', 'target': 'Analytics CSV Export', 'status': 'success'},
    ];
    final selected = (actions..shuffle()).first;
    final newId = 'LOG-\${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}';

    setState(() {
      _logs.insert(0, {
        'id': newId,
        'action': selected['action']!,
        'user': selected['user']!,
        'target': selected['target']!,
        'time': 'Just now',
        'status': selected['status']!,
        'ip': '192.168.1.\${DateTime.now().second}',
      });
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Simulated event: \${selected['action']}'),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _showEventDetail(Map<String, String> log) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(
              log['status'] == 'warning' ? Icons.warning_amber_rounded : Icons.check_circle_outline,
              color: log['status'] == 'warning' ? Colors.orange : Colors.green,
            ),
            const SizedBox(width: 10),
            Text(log['id'] ?? 'Audit Record'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildDetailRow('Action Type', log['action'] ?? ''),
            _buildDetailRow('Initiator', log['user'] ?? ''),
            _buildDetailRow('Target', log['target'] ?? ''),
            _buildDetailRow('Timestamp', log['time'] ?? ''),
            _buildDetailRow('Origin IP', log['ip'] ?? ''),
            _buildDetailRow('Status', (log['status'] ?? '').toUpperCase()),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
          Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _logs.where((l) {
      final matchesSeverity = _selectedSeverity == 'All' ||
          l['status']?.toLowerCase() == _selectedSeverity.toLowerCase();
      final q = _searchQuery.toLowerCase();
      final matchesSearch = q.isEmpty ||
          (l['action']?.toLowerCase().contains(q) == true) ||
          (l['user']?.toLowerCase().contains(q) == true) ||
          (l['target']?.toLowerCase().contains(q) == true);
      return matchesSeverity && matchesSearch;
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Audit Logs'),
        actions: [
          IconButton(
            icon: const Icon(Icons.file_download_outlined),
            tooltip: 'Export CSV',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Exported \${_logs.length} audit records to CSV.')),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.add_alert_outlined),
            tooltip: 'Simulate Event',
            onPressed: _simulateNewEvent,
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter Chips Row
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Row(
              children: [
                _buildSeverityChip('All', _logs.length),
                const SizedBox(width: 8),
                _buildSeverityChip('Success', _logs.where((l) => l['status'] == 'success').length),
                const SizedBox(width: 8),
                _buildSeverityChip('Warning', _logs.where((l) => l['status'] == 'warning').length),
              ],
            ),
          ),

          // Search Field
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: TextField(
              onChanged: (v) => setState(() => _searchQuery = v),
              decoration: InputDecoration(
                hintText: 'Search audit records...',
                prefixIcon: const Icon(Icons.search, size: 20),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              ),
            ),
          ),

          // Log list
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: filtered.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final l = filtered[i];
                final isWarning = l['status'] == 'warning';
                final statusColor = isWarning ? Colors.orange : Colors.green;

                return Card(
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                    side: BorderSide(color: Theme.of(context).dividerColor.withOpacity(0.3)),
                  ),
                  child: ListTile(
                    onTap: () => _showEventDetail(l),
                    leading: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: statusColor.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        isWarning ? Icons.warning_amber_rounded : Icons.check_circle_outline,
                        color: statusColor,
                        size: 20,
                      ),
                    ),
                    title: Text(
                      l['action'] ?? '',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, fontFamily: 'monospace'),
                    ),
                    subtitle: Text(
                      '\${l['user']} • \${l['target']}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11),
                    ),
                    trailing: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(l['time'] ?? '', style: TextStyle(color: Colors.grey.shade500, fontSize: 11)),
                        const SizedBox(height: 4),
                        const Icon(Icons.chevron_right, size: 16, color: Colors.grey),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _simulateNewEvent,
        icon: const Icon(Icons.bolt),
        label: const Text('Simulate Event'),
      ),
    );
  }

  Widget _buildSeverityChip(String label, int count) {
    final isSelected = _selectedSeverity == label;
    return ChoiceChip(
      label: Text('\$label (\$count)'),
      selected: isSelected,
      onSelected: (_) => setState(() => _selectedSeverity = label),
    );
  }
}
`;
    return {
      path: 'lib/screens/audit/audit_logs_screen.dart',
      content,
      language: 'dart',
      description: 'Fully interactive Audit Logs Screen with live simulation, search, and detail modal',
      isNew: true,
    };
  }

  private static generateHealthMonitorScreen(plan: AgentPlan): AgentFileArtifact {
    const content = `import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';

class HealthMonitorScreen extends StatefulWidget {
  const HealthMonitorScreen({super.key});

  @override
  State<HealthMonitorScreen> createState() => _HealthMonitorScreenState();
}

class _HealthMonitorScreenState extends State<HealthMonitorScreen> {
  Timer? _ticker;
  final Random _rng = Random();

  double _cpuLoad = 28.0;
  double _memoryGb = 1.6;
  int _apiLatencyMs = 38;
  int _uptimeSeconds = 1234560;
  bool _isStressTestActive = false;

  final List<Map<String, dynamic>> _nodes = [
    {'name': 'Primary API Gateway', 'status': 'Operational', 'isHealthy': true},
    {'name': 'Web Application Server', 'status': 'Operational', 'isHealthy': true},
    {'name': 'Background Event Worker', 'status': 'Operational', 'isHealthy': true},
    {'name': 'Local Storage Engine', 'status': 'Operational', 'isHealthy': true},
  ];

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 2), (_) {
      if (!mounted) return;
      setState(() {
        _uptimeSeconds += 2;
        if (!_isStressTestActive) {
          _cpuLoad = (_cpuLoad + (_rng.nextDouble() * 6 - 3)).clamp(16.0, 72.0);
          _memoryGb = (_memoryGb + (_rng.nextDouble() * 0.1 - 0.05)).clamp(1.2, 3.2);
          _apiLatencyMs = (_apiLatencyMs + (_rng.nextInt(7) - 3)).clamp(22, 65);
        }
      });
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  void _triggerLoadSpike() {
    setState(() {
      _isStressTestActive = true;
      _cpuLoad = 89.4;
      _memoryGb = 3.65;
      _apiLatencyMs = 210;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Simulating high traffic load for 5 seconds...'),
        backgroundColor: Colors.orange,
      ),
    );

    Future.delayed(const Duration(seconds: 5), () {
      if (!mounted) return;
      setState(() {
        _isStressTestActive = false;
        _cpuLoad = 32.0;
        _memoryGb = 1.7;
        _apiLatencyMs = 36;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Cluster load stabilized. Telemetry optimal.'),
          backgroundColor: Colors.green,
        ),
      );
    });
  }

  String _formatUptime(int totalSeconds) {
    final days = totalSeconds ~/ 86400;
    final hours = (totalSeconds % 86400) ~/ 3600;
    final mins = (totalSeconds % 3600) ~/ 60;
    final secs = totalSeconds % 60;
    return '\${days}d \${hours}h \${mins}m \${secs}s';
  }

  Color _getMetricColor(double ratio) {
    if (ratio < 0.6) return Colors.green;
    if (ratio < 0.8) return Colors.orange;
    return Colors.red;
  }

  @override
  Widget build(BuildContext context) {
    final cpuRatio = _cpuLoad / 100.0;
    final memRatio = _memoryGb / 4.0;
    final latencyRatio = (_apiLatencyMs / 200.0).clamp(0.0, 1.0);

    return Scaffold(
      appBar: AppBar(
        title: const Text('System Health Monitor'),
        actions: [
          IconButton(
            icon: const Icon(Icons.flash_on_outlined),
            tooltip: 'Simulate Traffic Spike',
            onPressed: _triggerLoadSpike,
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Live Status Header Banner
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: (_isStressTestActive ? Colors.orange : Colors.green).withOpacity(0.12),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: (_isStressTestActive ? Colors.orange : Colors.green).withOpacity(0.3),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    _isStressTestActive ? Icons.warning_amber_rounded : Icons.check_circle,
                    color: _isStressTestActive ? Colors.orange : Colors.green,
                    size: 28,
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _isStressTestActive ? 'High Traffic Stress In Progress' : 'All Systems Fully Operational',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                            color: _isStressTestActive ? Colors.orange.shade800 : Colors.green.shade800,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Live telemetry refreshed every 2 seconds.',
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // Telemetry Gauges Grid
            Row(
              children: [
                _buildGaugeCard(
                  'CPU Load',
                  '\${_cpuLoad.toStringAsFixed(1)}%',
                  cpuRatio,
                  _getMetricColor(cpuRatio),
                  Icons.memory,
                ),
                const SizedBox(width: 12),
                _buildGaugeCard(
                  'Memory Usage',
                  '\${_memoryGb.toStringAsFixed(2)} / 4.0 GB',
                  memRatio,
                  _getMetricColor(memRatio),
                  Icons.storage,
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _buildGaugeCard(
                  'API Latency',
                  '\$_apiLatencyMs ms',
                  latencyRatio,
                  _getMetricColor(latencyRatio),
                  Icons.speed,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Card(
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: BorderSide(color: Theme.of(context).dividerColor.withOpacity(0.3)),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(Icons.timer_outlined, size: 16, color: Colors.purple.shade400),
                              const SizedBox(width: 6),
                              Text('System Uptime', style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Text(
                            _formatUptime(_uptimeSeconds),
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
                          ),
                          const SizedBox(height: 4),
                          const Text('SLA 99.98% guaranteed', style: TextStyle(color: Colors.grey, fontSize: 11)),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 24),

            // Service Nodes Section
            const Text('Infrastructure Nodes', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            ..._nodes.map((node) => _buildServiceRow(node)),

            const SizedBox(height: 16),

            // Diagnostics Button
            Center(
              child: ElevatedButton.icon(
                onPressed: _triggerLoadSpike,
                icon: const Icon(Icons.bolt),
                label: const Text('Simulate Load Stress Test'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGaugeCard(String title, String value, double ratio, Color color, IconData icon) {
    return Expanded(
      child: Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: Theme.of(context).dividerColor.withOpacity(0.3)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(icon, size: 16, color: color),
                  const SizedBox(width: 6),
                  Text(title, style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
                ],
              ),
              const SizedBox(height: 8),
              Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
              const SizedBox(height: 10),
              LinearProgressIndicator(
                value: ratio.clamp(0.0, 1.0),
                backgroundColor: color.withOpacity(0.15),
                valueColor: AlwaysStoppedAnimation<Color>(color),
                borderRadius: BorderRadius.circular(8),
                minHeight: 6,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildServiceRow(Map<String, dynamic> node) {
    final isHealthy = node['isHealthy'] as bool;
    final color = isHealthy ? Colors.green : Colors.red;

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: Theme.of(context).dividerColor.withOpacity(0.3)),
      ),
      child: ListTile(
        title: Text(node['name'] as String, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircleAvatar(radius: 4, backgroundColor: color),
            const SizedBox(width: 8),
            Text(
              node['status'] as String,
              style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}
`;
    return {
      path: 'lib/screens/health/health_monitor_screen.dart',
      content,
      language: 'dart',
      description: 'Fully interactive Health Monitor with real-time periodic ticking telemetry',
      isNew: true,
    };
  }

  private static generateAnalyticsScreen(plan: AgentPlan): AgentFileArtifact {
    const content = `import 'package:flutter/material.dart';

class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  String _timeRange = '7 Days';

  final Map<String, Map<String, dynamic>> _dataByRange = {
    '24 Hours': {
      'pageViews': '1,420',
      'activeSessions': '342',
      'events': '4,120',
      'conversion': '8.4%',
      'bars': [0.2, 0.45, 0.3, 0.8, 0.95, 0.6, 0.75],
      'labels': ['00h', '04h', '08h', '12h', '16h', '20h', '24h'],
    },
    '7 Days': {
      'pageViews': '14,890',
      'activeSessions': '2,450',
      'events': '38,920',
      'conversion': '9.2%',
      'bars': [0.4, 0.65, 0.8, 0.55, 0.95, 0.35, 0.5],
      'labels': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    },
    '30 Days': {
      'pageViews': '64,200',
      'activeSessions': '11,200',
      'events': '142,000',
      'conversion': '8.9%',
      'bars': [0.55, 0.7, 0.6, 0.85, 0.9, 0.75, 0.95],
      'labels': ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'],
    },
  };

  int _selectedBarIndex = 4;

  @override
  Widget build(BuildContext context) {
    final current = _dataByRange[_timeRange] ?? _dataByRange['7 Days']!;
    final bars = (current['bars'] as List<double>);
    final labels = (current['labels'] as List<String>);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Analytics & Reports'),
        actions: [
          IconButton(
            icon: const Icon(Icons.file_download_outlined),
            tooltip: 'Export Report',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Analytics report for \$_timeRange exported.')),
              );
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Time Range Segment Selector
            Center(
              child: SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: '24 Hours', label: Text('24h')),
                  ButtonSegment(value: '7 Days', label: Text('7d')),
                  ButtonSegment(value: '30 Days', label: Text('30d')),
                ],
                selected: {_timeRange},
                onSelectionChanged: (set) => setState(() {
                  _timeRange = set.first;
                  _selectedBarIndex = 0;
                }),
              ),
            ),

            const SizedBox(height: 20),

            // Dynamic KPI Cards
            Row(
              children: [
                _buildStatCard('Page Views', current['pageViews'] as String, '+14.2%'),
                const SizedBox(width: 12),
                _buildStatCard('Active Sessions', current['activeSessions'] as String, '+6.8%'),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _buildStatCard('Total Events', current['events'] as String, '+22.4%'),
                const SizedBox(width: 12),
                _buildStatCard('Conversion Rate', current['conversion'] as String, '+1.2%'),
              ],
            ),

            const SizedBox(height: 24),

            // Interactive Telemetry Chart
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Traffic Trend', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                Text(
                  'Selected: \${labels[_selectedBarIndex]} (\${(bars[_selectedBarIndex] * 100).toInt()}% peak)',
                  style: const TextStyle(fontSize: 12, color: Colors.indigo, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: Theme.of(context).dividerColor.withOpacity(0.3)),
              ),
              child: Container(
                height: 190,
                padding: const EdgeInsets.all(16),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: List.generate(bars.length, (i) {
                    final isSelected = _selectedBarIndex == i;
                    return InkWell(
                      onTap: () => setState(() => _selectedBarIndex = i),
                      borderRadius: BorderRadius.circular(8),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            AnimatedContainer(
                              duration: const Duration(milliseconds: 300),
                              width: 28,
                              height: 120 * bars[i],
                              decoration: BoxDecoration(
                                color: isSelected ? Colors.indigo : Colors.indigo.shade200,
                                borderRadius: BorderRadius.circular(6),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              labels[i],
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                                color: isSelected ? Colors.indigo : Colors.grey,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                ),
              ),
            ),

            const SizedBox(height: 24),

            // Device Breakdown
            const Text('Device Distribution', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            _buildDeviceRow('Mobile Browsers', 0.58, Colors.blue),
            _buildDeviceRow('Desktop Browsers', 0.34, Colors.teal),
            _buildDeviceRow('Tablet / Other', 0.08, Colors.amber),
          ],
        ),
      ),
    );
  }

  Widget _buildStatCard(String title, String value, String change) {
    return Expanded(
      child: Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: Theme.of(context).dividerColor.withOpacity(0.3)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
              const SizedBox(height: 6),
              Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.trending_up, size: 14, color: Colors.green),
                  const SizedBox(width: 4),
                  Text(change, style: const TextStyle(fontSize: 11, color: Colors.green, fontWeight: FontWeight.bold)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDeviceRow(String label, double ratio, Color color) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
              Text('\${(ratio * 100).toInt()}%', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: color)),
            ],
          ),
          const SizedBox(height: 6),
          LinearProgressIndicator(
            value: ratio,
            backgroundColor: color.withOpacity(0.12),
            valueColor: AlwaysStoppedAnimation<Color>(color),
            borderRadius: BorderRadius.circular(6),
            minHeight: 6,
          ),
        ],
      ),
    );
  }
}
`;
    return {
      path: 'lib/screens/analytics/analytics_screen.dart',
      content,
      language: 'dart',
      description: 'Fully interactive Analytics Screen with dynamic time range filtering and charts',
      isNew: true,
    };
  }

  private static generateSplashScreen(): AgentFileArtifact {
    const content = `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/constants/app_constants.dart';
import '../../core/theme/app_theme.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 800));
    _fadeAnimation = CurvedAnimation(parent: _controller, curve: Curves.easeIn);
    _controller.forward();
    _checkAuth();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _checkAuth() async {
    // Supabase is already initialized in main.dart — just route based on session.
    await Future<void>.delayed(const Duration(milliseconds: 1500));
    if (!mounted) return;
    try {
      final session = Supabase.instance.client.auth.currentSession;
      if (session != null) {
        context.go('/');
      } else {
        context.go('/auth');
      }
    } catch (e) {
      if (!mounted) return;
      context.go('/auth');
    }
    // Reference constants to keep imports used across themes.
    assert(AppConstants.appName.isNotEmpty);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: AppTheme.primary.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.bolt, size: 64, color: AppTheme.primary),
              ),
            const SizedBox(height: 24),
            const CircularProgressIndicator(),
          ],
        ),
      ),
      ),
    );
  }
}
`;
    return {
      path: 'lib/screens/splash/splash_screen.dart',
      content,
      language: 'dart',
      description: 'Animated splash screen and auth status router',
      isNew: true,
    };
  }

  private static generateAuthScreen(): AgentFileArtifact {
    const content = `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../services/supabase_service.dart';
import '../../core/widgets/custom_button.dart';
import '../../core/widgets/custom_text_field.dart';
import '../../core/theme/app_theme.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isSignUp = false;
  bool _isLoading = false;
  String? _errorMessage;

  Future<void> _handleSubmit() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();

    if (email.isEmpty || password.isEmpty) {
      setState(() => _errorMessage = 'Please fill in all fields');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      if (_isSignUp) {
        await SupabaseService.signUp(email: email, password: password);
      } else {
        await SupabaseService.signIn(email: email, password: password);
      }
      if (mounted) context.go('/');
    } catch (e) {
      setState(() => _errorMessage = e.toString());
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.lock_outline, size: 48, color: AppTheme.primary),
                const SizedBox(height: 16),
                Text(
                  _isSignUp ? 'Create an Account' : 'Welcome Back',
                  style: const TextStyle(fontSize: 26, fontWeight: FontWeight.bold),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  _isSignUp ? 'Sign up with Supabase' : 'Sign in to continue',
                  style: const TextStyle(color: Colors.grey),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 32),
                if (_errorMessage != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(_errorMessage!, style: const TextStyle(color: Colors.red)),
                  ),
                  const SizedBox(height: 16),
                ],
                CustomTextField(
                  controller: _emailController,
                  label: 'Email',
                  prefixIcon: Icons.email_outlined,
                  keyboardType: TextInputType.emailAddress,
                ),
                const SizedBox(height: 16),
                CustomTextField(
                  controller: _passwordController,
                  label: 'Password',
                  prefixIcon: Icons.lock_outline,
                  obscureText: true,
                ),
                const SizedBox(height: 24),
                CustomButton(
                  text: _isSignUp ? 'Sign Up' : 'Sign In',
                  isLoading: _isLoading,
                  onPressed: _handleSubmit,
                ),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: () => setState(() => _isSignUp = !_isSignUp),
                  child: Text(_isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
`;
    return {
      path: 'lib/screens/auth/auth_screen.dart',
      content,
      language: 'dart',
      description: 'Supabase Authentication login and registration screen',
      isNew: true,
    };
  }

  private static generateHomeScreen(plan: AgentPlan, usesSupabase = true): AgentFileArtifact {
    // For dashboard-domain or local-only apps, generate a proper nav dashboard instead of a data list
    if (plan.domain === 'dashboard' || !usesSupabase) {
      return this.generateDashboardHomeScreen(plan);
    }

    const mainModel = plan.models.find((m) => m.name !== 'UserProfile') || plan.models[0];
    const modelName = mainModel?.name || 'Item';
    const titleField = mainModel?.fields?.find((f) => f.name === 'title' || f.jsonKey === 'title');
    const titleBase = titleField ? `item.${titleField.name}` : `'Item \${index + 1}'`;
    // Null-safe accessor for Text() which requires non-null String
    const titleAccessor = titleField?.isNullable ? `(${titleBase} ?? '')` : titleBase;
    const descField = mainModel?.fields?.find((f) => f.name === 'description' || f.jsonKey === 'description');
    const descBase = descField ? `item.${descField.name}` : `'No description'`;
    const descAccessor = (descField?.isNullable || !descField) && !descBase.startsWith(`'`) ? `(${descBase} ?? '')` : descBase;
    const idField = mainModel?.fields?.find((f) => f.name === 'id');
    const idAccessor = idField ? `item.${idField.name}` : 'index';

    const isRiverpod = plan.stateManagement === 'riverpod';
    const stateImport = isRiverpod
      ? `import 'package:flutter_riverpod/flutter_riverpod.dart';`
      : `import 'package:provider/provider.dart';`;
    const widgetDecl = isRiverpod
      ? `class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(appProvider);
    final notifier = ref.read(appProvider.notifier);`
      : `class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AppProvider>();`;
    const itemsExpr = isRiverpod ? 'state.items' : 'provider.items';
    const loadingExpr = isRiverpod ? 'state.isLoading' : 'provider.isLoading';
    const reloadExpr = isRiverpod ? 'notifier.loadItems()' : 'provider.loadItems()';

    const content = `import 'package:flutter/material.dart';
${stateImport}
import 'package:go_router/go_router.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../state/app_provider.dart';
import '../../core/widgets/empty_state.dart';
import '../../core/widgets/loading_indicator.dart';
import '../../core/widgets/theme_toggle_button.dart';
import '../../core/theme/app_theme.dart';

${widgetDecl}

    return Scaffold(
      appBar: AppBar(
        title: const Text('${plan.appName}'),
        actions: [
          const ThemeToggleButton(),
          IconButton(
            icon: const Icon(Icons.person_outline),
            onPressed: () => context.push('/profile'),
          ),
        ],
      ),
      body: ${loadingExpr}
          ? _buildShimmerList()
          : ${itemsExpr}.isEmpty
              ? EmptyState(
                  icon: Icons.layers_outlined,
                  title: 'No ${modelName}s Found',
                  description: 'Get started by creating your first ${modelName.toLowerCase()} in Supabase.',
                  actionText: 'Refresh',
                  onAction: () => ${reloadExpr},
                )
              : RefreshIndicator(
                  onRefresh: () => ${reloadExpr},
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: ${itemsExpr}.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final item = ${itemsExpr}[index];
                      return Card(
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                          side: BorderSide(color: Theme.of(context).colorScheme.outlineVariant.withOpacity(0.3)),
                        ),
                        child: ListTile(
                          contentPadding: const EdgeInsets.all(16),
                          leading: CircleAvatar(
                            backgroundColor: AppTheme.primary.withOpacity(0.1),
                            child: const Icon(Icons.star, color: AppTheme.primary),
                          ),
                          title: Text(
                            ${titleAccessor},
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          subtitle: Text(
                            ${descAccessor},
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => context.push('/detail/\${${idAccessor}}'),
                        ),
                      ).animate().fadeIn(delay: Duration(milliseconds: 50 * index), duration: 300.ms).slideY(begin: 0.05);
                    },
                  ),
                ),
    );
  }

  Widget _buildShimmerList() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: 6,
      itemBuilder: (context, index) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Card(
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          child: ListTile(
            contentPadding: const EdgeInsets.all(16),
            leading: CircleAvatar(backgroundColor: Colors.grey.shade200),
            title: Container(height: 16, width: 120, color: Colors.grey.shade200),
            subtitle: Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Container(height: 12, width: 200, color: Colors.grey.shade100),
            ),
          ),
        ),
      ),
    );
  }
}
`;
    return {
      path: 'lib/screens/home/home_screen.dart',
      content,
      language: 'dart',
      description: 'Main dashboard with dynamic Supabase entity list',
      isNew: true,
    };
  }

  private static generateDashboardHomeScreen(plan: AgentPlan): AgentFileArtifact {
    // Build navigation cards for all non-home screens
    const navScreens = plan.screens.filter(
      (s) => !['home', 'splash', 'auth', 'detail'].includes(s.routeName)
    );

    const navCards = navScreens.map((s) => {
      const icon = s.routeName === 'users' ? 'Icons.people_outline'
        : s.routeName === 'audit' ? 'Icons.history_outlined'
        : s.routeName === 'health' ? 'Icons.monitor_heart_outlined'
        : s.routeName === 'analytics' ? 'Icons.bar_chart_outlined'
        : s.routeName === 'profile' ? 'Icons.person_outline'
        : s.routeName === 'cart' ? 'Icons.shopping_cart_outlined'
        : 'Icons.dashboard_outlined';
      const label = s.name.replace('Screen', '');
      return `          _NavCard(
            icon: ${icon},
            label: '${label}',
            description: '${s.description || label}',
            onTap: () => context.push('/${s.routeName}'),
          ),`;
    }).join('\n');

    const content = `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/widgets/theme_toggle_button.dart';
import '../../core/theme/app_theme.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('${plan.appName}'),
        centerTitle: false,
        actions: const [ThemeToggleButton()],
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Welcome banner
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppTheme.primary, AppTheme.primary.withOpacity(0.7)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.admin_panel_settings, color: Colors.white, size: 28),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Welcome back!',
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: Colors.white.withOpacity(0.8),
                              ),
                            ),
                            Text(
                              '${plan.appName} Dashboard',
                              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Manage your system from one central hub.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Colors.white.withOpacity(0.85),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 32),

            Text(
              'Quick Navigation',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: 16),

            // Nav grid
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
              childAspectRatio: 1.2,
              children: [
${navCards}
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _NavCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String description;
  final VoidCallback onTap;

  const _NavCard({
    required this.icon,
    required this.label,
    required this.description,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Material(
      color: colorScheme.surfaceContainerHighest.withOpacity(0.5),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppTheme.primary.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: AppTheme.primary, size: 24),
              ),
              const SizedBox(height: 12),
              Text(
                label,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: colorScheme.onSurface,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),
              Text(
                description,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
`;
    return {
      path: 'lib/screens/home/home_screen.dart',
      content,
      language: 'dart',
      description: 'Dashboard home with navigation grid cards',
      isNew: true,
    };
  }

  private static generateProfileScreen(usesSupabase = true): AgentFileArtifact {
    const supabaseImport = usesSupabase ? `import '../../services/supabase_service.dart';` : '';
    const userExpr = usesSupabase ? `final user = SupabaseService.currentUser;` : `const userEmail = 'admin@example.com';`;
    const userEmailExpr = usesSupabase ? `user?.email ?? 'user@example.com'` : `userEmail`;
    const signOutBtn = usesSupabase ? `          CustomButton(
            text: 'Sign Out',
            isOutlined: true,
            icon: Icons.logout,
            onPressed: () async {
              await SupabaseService.signOut();
              if (context.mounted) context.go('/auth');
            },
          ),` : `          CustomButton(
            text: 'Back to Dashboard',
            icon: Icons.dashboard_outlined,
            onPressed: () => context.go('/'),
          ),`;

    const content = `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
${supabaseImport}
import '../../core/widgets/custom_button.dart';
import '../../core/widgets/theme_toggle_button.dart';
import '../../core/theme/theme_controller.dart';
import '../../core/theme/app_theme.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    ${userExpr}

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        actions: const [ThemeToggleButton()],
      ),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Center(
            child: CircleAvatar(
              radius: 48,
              backgroundColor: AppTheme.primary.withOpacity(0.1),
              child: const Icon(Icons.person, size: 48, color: AppTheme.primary),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            ${userEmailExpr},
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          const Text(
            'Appearance',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          ValueListenableBuilder<ThemeMode>(
            valueListenable: ThemeController.instance,
            builder: (context, mode, _) => SegmentedButton<ThemeMode>(
              segments: const [
                ButtonSegment(
                  value: ThemeMode.light,
                  icon: Icon(Icons.light_mode_outlined, size: 18),
                  label: Text('Light'),
                ),
                ButtonSegment(
                  value: ThemeMode.dark,
                  icon: Icon(Icons.dark_mode_outlined, size: 18),
                  label: Text('Dark'),
                ),
                ButtonSegment(
                  value: ThemeMode.system,
                  icon: Icon(Icons.settings_suggest_outlined, size: 18),
                  label: Text('Auto'),
                ),
              ],
              selected: {mode},
              onSelectionChanged: (selection) =>
                  ThemeController.instance.setMode(selection.first),
            ),
          ),
          const SizedBox(height: 8),
          ListTile(
            leading: const Icon(Icons.security),
            title: const Text('Account Security'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {},
          ),
          ListTile(
            leading: const Icon(Icons.notifications_outlined),
            title: const Text('Notifications'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {},
          ),
          const SizedBox(height: 32),
${signOutBtn}
        ],
      ),
    );
  }
}
`;
    return {
      path: 'lib/screens/profile/profile_screen.dart',
      content,
      language: 'dart',
      description: 'Profile and user settings screen',
      isNew: true,
    };
  }

  private static generateDetailScreen(plan: AgentPlan): AgentFileArtifact {
    const mainModel = plan.models.find((m) => m.name !== 'UserProfile') || plan.models[0];
    const modelName = mainModel?.name || 'Item';
    const modelSnake = this.toSnakeCase(modelName);
    const titleField = mainModel?.fields?.find((f) => f.name === 'title' || f.jsonKey === 'title');
    const titleBase = titleField ? `item.${titleField.name}` : `'Details'`;
    const titleExpr = titleField?.isNullable ? `(${titleBase} ?? 'Details')` : titleBase;
    const descField = mainModel?.fields?.find((f) => f.name === 'description' || f.jsonKey === 'description');
    const descBase = descField ? `item.${descField.name}` : `'No description available.'`;
    const descExpr = descField?.isNullable ? `(${descBase} ?? 'No description available.')` : descBase;
    const hasId = !!mainModel?.fields?.some((f) => f.name === 'id');

    const isRiverpod = plan.stateManagement === 'riverpod';
    const stateImport = isRiverpod
      ? `import 'package:flutter_riverpod/flutter_riverpod.dart';`
      : `import 'package:provider/provider.dart';`;
    const widgetDecl = isRiverpod
      ? `class DetailScreen extends ConsumerWidget {
  const DetailScreen({super.key, this.itemId});

  final String? itemId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(appProvider);
    final items = state.items;
    final isLoading = state.isLoading;`
      : `class DetailScreen extends StatelessWidget {
  const DetailScreen({super.key, this.itemId});

  final String? itemId;

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AppProvider>();
    final items = provider.items;
    final isLoading = provider.isLoading;`;
    const deleteExpr = isRiverpod ? 'ref.read(appProvider.notifier).deleteItem(item.id)' : 'provider.deleteItem(item.id)';

    const content = `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
${stateImport}
import '../../models/${modelSnake}.dart';
import '../../state/app_provider.dart';
import '../../core/widgets/loading_indicator.dart';
import '../../core/widgets/empty_state.dart';

${widgetDecl}

    if (isLoading && items.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Details')),
        body: const LoadingIndicator(message: 'Loading details...'),
      );
    }

    final matches = ${hasId ? `itemId == null ? <${modelName}>[] : items.where((e) => e.id == itemId).toList()` : `<${modelName}>[]`};
    final item = matches.isNotEmpty ? matches.first : null;

    if (item == null) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Details'),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => context.pop(),
          ),
        ),
        body: EmptyState(
          icon: Icons.search_off_outlined,
          title: 'Item not found',
          description: 'The requested ${modelName.toLowerCase()} could not be found. It may have been deleted.',
          actionText: 'Go back',
          onAction: () => context.pop(),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(${titleExpr}),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.delete_outline),
            onPressed: () async {
              await ${deleteExpr};
              if (context.mounted) context.pop();
            },
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Icon(Icons.star, size: 64),
          ),
          const SizedBox(height: 24),
          Text(
            ${titleExpr},
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Text(
            ${descExpr},
            style: TextStyle(fontSize: 15, color: Theme.of(context).textTheme.bodyMedium?.color?.withOpacity(0.7)),
          ),
        ],
      ),
    );
  }
}
`;
    return {
      path: 'lib/screens/detail/detail_screen.dart',
      content,
      language: 'dart',
      description: `${modelName} detail view bound to the route id param`,
      isNew: true,
    };
  }

  private static generateCartScreen(plan: AgentPlan): AgentFileArtifact {
    const isRiverpod = plan.stateManagement === 'riverpod';
    const stateImport = isRiverpod
      ? `import 'package:flutter_riverpod/flutter_riverpod.dart';`
      : `import 'package:provider/provider.dart';`;
    const widgetDecl = isRiverpod
      ? `class CartScreen extends ConsumerStatefulWidget {
  const CartScreen({super.key});

  @override
  ConsumerState<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends ConsumerState<CartScreen> {`
      : `class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {`;
    const productsExpr = isRiverpod ? 'ref.watch(appProvider).items' : 'context.watch<AppProvider>().items';

    const content = `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
${stateImport}
import '../../state/app_provider.dart';
import '../../services/supabase_service.dart';
import '../../core/widgets/custom_button.dart';
import '../../core/widgets/empty_state.dart';
import '../../core/widgets/loading_indicator.dart';
import '../../core/theme/app_theme.dart';

${widgetDecl}
  final Map<String, int> _quantities = {};
  bool _isPlacingOrder = false;

  @override
  Widget build(BuildContext context) {
    final products = ${productsExpr};

    if (products.isEmpty) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Cart'),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => context.pop(),
          ),
        ),
        body: EmptyState(
          icon: Icons.shopping_cart_outlined,
          title: 'Your cart is empty',
          description: 'Browse the catalog and add items to get started.',
          actionText: 'Browse products',
          onAction: () => context.go('/'),
        ),
      );
    }

    double total = 0;
    for (final p in products) {
      total += (p.price as num).toDouble() * (_quantities[p.id] ?? 1);
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Cart'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: products.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final item = products[index];
                final qty = _quantities[item.id] ?? 1;
                return Card(
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                    side: BorderSide(color: Theme.of(context).colorScheme.outlineVariant.withOpacity(0.3)),
                  ),
                  child: ListTile(
                    contentPadding: const EdgeInsets.all(12),
                    leading: CircleAvatar(
                      backgroundColor: AppTheme.primary.withOpacity(0.1),
                      child: const Icon(Icons.shopping_bag_outlined, color: AppTheme.primary),
                    ),
                    title: Text(item.title, style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text('\\\${(item.price as num).toDouble().toStringAsFixed(2)} each'),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.remove_circle_outline),
                          onPressed: qty > 1
                              ? () => setState(() => _quantities[item.id] = qty - 1)
                              : null,
                        ),
                        Text('$qty', style: const TextStyle(fontWeight: FontWeight.bold)),
                        IconButton(
                          icon: const Icon(Icons.add_circle_outline),
                          onPressed: () => setState(() => _quantities[item.id] = qty + 1),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Theme.of(context).cardColor,
              border: Border(top: BorderSide(color: Theme.of(context).dividerColor.withOpacity(0.3))),
            ),
            child: SafeArea(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Total', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      Text(
                        '\\\${total.toStringAsFixed(2)}',
                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppTheme.primary),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  CustomButton(
                    text: 'Place order',
                    isLoading: _isPlacingOrder,
                    icon: Icons.shopping_bag_outlined,
                    onPressed: () => _checkout(products, total),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _checkout(List<dynamic> products, double total) async {
    final userId = SupabaseService.currentUser?.id;
    if (userId == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please sign in to place an order.')),
        );
      }
      return;
    }

    setState(() => _isPlacingOrder = true);
    try {
      await SupabaseService.client.from('orders').insert({
        'user_id': userId,
        'total_amount': total,
        'status': 'pending',
        'items_json': products
            .map((p) => {'id': p.id, 'qty': _quantities[p.id] ?? 1, 'price': (p.price as num).toDouble()})
            .toList(),
      });
      _quantities.clear();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Order placed successfully!')),
        );
        context.go('/');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Checkout failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isPlacingOrder = false);
    }
  }
}
`;
    return {
      path: 'lib/screens/cart/cart_screen.dart',
      content,
      language: 'dart',
      description: 'Shopping cart with quantities and Supabase order checkout',
      isNew: true,
    };
  }

  private static generateAppDart(plan: AgentPlan): AgentFileArtifact {
    const className = this.appClassName(plan.appName);
    const isRiverpod = plan.stateManagement === 'riverpod';
    const stateImport = isRiverpod
      ? `import 'package:flutter_riverpod/flutter_riverpod.dart';`
      : `import 'package:provider/provider.dart';
import 'state/app_provider.dart';`;
    const wrapperOpen = isRiverpod ? `    return ProviderScope(` : `    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AppProvider()),
      ],`;
    const content = `import 'package:flutter/material.dart';
${stateImport}
import 'core/theme/app_theme.dart';
import 'core/theme/theme_controller.dart';
import 'core/router/app_router.dart';

class ${className} extends StatelessWidget {
  const ${className}({super.key});

  @override
  Widget build(BuildContext context) {
${wrapperOpen}
      child: ValueListenableBuilder<ThemeMode>(
        valueListenable: ThemeController.instance,
        builder: (context, themeMode, _) => MaterialApp.router(
          title: '${plan.appName}',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.lightTheme,
          darkTheme: AppTheme.darkTheme,
          themeMode: themeMode,
          routerConfig: AppRouter.router,
        ),
      ),
    );
  }
}
`;
    return {
      path: 'lib/app.dart',
      content,
      language: 'dart',
      description: isRiverpod
        ? 'Main App widget with Riverpod ProviderScope and GoRouter'
        : 'Main App widget with MultiProvider and GoRouter',
      isNew: true,
    };
  }

  private static generateMainDart(plan: AgentPlan, usesSupabase = true): AgentFileArtifact {
    const content = usesSupabase ? `import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'core/constants/app_constants.dart';
import 'core/theme/theme_controller.dart';
import 'app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ThemeController.instance.load();
  await Supabase.initialize(
    url: AppConstants.supabaseUrl,
    anonKey: AppConstants.supabaseAnonKey,
  );
  runApp(const ${this.appClassName(plan.appName)}());
}
` : `import 'package:flutter/material.dart';
import 'core/theme/theme_controller.dart';
import 'app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ThemeController.instance.load();
  runApp(const ${this.appClassName(plan.appName)}());
}
`;
    return {
      path: 'lib/main.dart',
      content,
      language: 'dart',
      description: usesSupabase ? 'Application entry point initializing Supabase' : 'Application entry point',
      isNew: true,
    };
  }

  /**
   * Root widget class name for an app. Sanitized so it is always a valid
   * Dart identifier and never stutters (MyApp -> MyApp, not MyAppApp).
   */
  private static appClassName(appName: string): string {
    const pascal = this.toPascalCase(appName);
    const safe = /^[A-Za-z]/.test(pascal) ? pascal : `App${pascal}`;
    return safe.endsWith('App') ? safe : `${safe}App`;
  }

  private static toPascalCase(str: string): string {
    return str
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
      .replace(/^[a-z]/, (chr) => chr.toUpperCase());
  }

  private static toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  }
}
