import type { AgentFileArtifact, ValidationIssue, ValidationReport } from './types';

export class AgentValidator {
  /**
   * Validates all generated files for Flutter, Dart, Supabase and YAML compliance
   */
  public static validate(files: AgentFileArtifact[]): ValidationReport {
    const issues: ValidationIssue[] = [];

    // 1. Validate pubspec.yaml
    const pubspec = files.find((f) => f.path === 'pubspec.yaml');
    if (!pubspec) {
      issues.push({
        filePath: 'pubspec.yaml',
        severity: 'error',
        code: 'MISSING_PUBSPEC',
        message: 'pubspec.yaml is missing from the generated project files.',
        suggestion: 'Regenerate with baseline backfill (mergeWithBaseline) to restore it.',
        // Honest flag: autoHeal injects deps/imports but cannot recreate a
        // whole missing file — creation happens in the orchestrator.
        autoFixAvailable: false,
      });
    } else {
      this.validatePubspec(pubspec, issues);
    }

    // 2. Validate main.dart
    const mainDart = files.find((f) => f.path === 'lib/main.dart');
    if (!mainDart) {
      issues.push({
        filePath: 'lib/main.dart',
        severity: 'error',
        code: 'MISSING_MAIN_DART',
        message: 'lib/main.dart entrypoint is missing.',
        suggestion: 'Regenerate with baseline backfill (mergeWithBaseline) to restore it.',
        autoFixAvailable: false,
      });
    } else {
      this.validateMainDart(mainDart, issues);
    }

    // 3. Validate each Dart file
    for (const file of files.filter((f) => f.language === 'dart' || f.path.endsWith('.dart'))) {
      this.validateDartFile(file, issues);
    }

    // 3b. Cross-file: every hosted `package:X/` import must be declared.
    // LLMs routinely import riverpod/animate/etc. without declaring them —
    // `flutter pub get` succeeds but compilation then fails on the import.
    if (pubspec) {
      this.validatePackageImports(files, pubspec, issues);
    }

    // 4. Validate SQL files
    for (const file of files.filter((f) => f.language === 'sql' || f.path.endsWith('.sql'))) {
      this.validateSqlFile(file, issues);
    }

    return {
      isValid: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
      fixedIssues: [],
      summary: `Found ${issues.length} issue(s) (${issues.filter((i) => i.severity === 'error').length} errors, ${issues.filter((i) => i.severity === 'warning').length} warnings).`,
    };
  }

  /**
   * Performs automated self-healing on detected issues
   */
  public static autoHeal(files: AgentFileArtifact[], report: ValidationReport): {
    healedFiles: AgentFileArtifact[];
    report: ValidationReport;
  } {
    const healed = [...files];
    const fixedIssues: Array<{ issue: ValidationIssue; fixDescription: string }> = [];

    const usesRiverpod =
      healed.some((f) => f.path.endsWith('.dart') && f.content.includes('flutter_riverpod')) ||
      healed.some((f) => f.path === 'pubspec.yaml' && f.content.includes('flutter_riverpod'));

    // Auto-fix missing pubspec dependencies (state-management aware:
    // riverpod projects need flutter_riverpod, provider projects need provider).
    const pubspecIdx = healed.findIndex((f) => f.path === 'pubspec.yaml');
    if (pubspecIdx >= 0) {
      let pubspecContent = healed[pubspecIdx].content;
      const usesProvider =
        healed.some((f) => f.path.endsWith('.dart') && (f.content.includes('package:provider/') || f.content.includes('ChangeNotifierProvider'))) ||
        pubspecContent.includes('provider:');

      const knownVersions: Record<string, string> = {
        supabase_flutter: '^2.8.3',
        go_router: '^14.8.1',
        google_fonts: '^6.2.1',
        flutter_animate: '^4.5.2',
        cached_network_image: '^3.4.1',
        intl: '^0.20.2',
        shared_preferences: '^2.5.2',
        flutter_svg: '^2.0.17',
        shimmer: '^3.0.0',
        fl_chart: '^0.70.2',
        dio: '^5.8.0+1',
        http: '^1.3.0',
        uuid: '^4.5.1',
        path_provider: '^2.1.5',
      };
      if (usesRiverpod) knownVersions['flutter_riverpod'] = '^2.6.1';
      if (usesProvider || !usesRiverpod) knownVersions['provider'] = '^6.1.2';

      // Also discover any undeclared packages imported in Dart files
      const undeclared = this.findUndeclaredImports(healed, pubspecContent);
      for (const u of undeclared) {
        if (!knownVersions[u]) {
          knownVersions[u] = 'any';
        }
      }

      let changed = false;
      for (const [dep, version] of Object.entries(knownVersions)) {
        if (!new RegExp(`^ {2}${dep}\\s*:`, 'm').test(pubspecContent)) {
          // Robust injection under dependencies:
          if (/^dependencies:\s*$/m.test(pubspecContent)) {
            pubspecContent = pubspecContent.replace(/^(dependencies:\s*)$/m, `$1\n  ${dep}: ${version}`);
            changed = true;
          } else if (/^dependencies:/m.test(pubspecContent)) {
            pubspecContent = pubspecContent.replace(/^(dependencies:[^\n]*\n)/m, `$1  ${dep}: ${version}\n`);
            changed = true;
          }
          if (changed) {
            fixedIssues.push({
              issue: {
                filePath: 'pubspec.yaml',
                severity: 'warning',
                code: 'AUTO_ADDED_DEPENDENCY',
                message: `Added missing dependency '${dep}: ${version}' to pubspec.yaml`,
                autoFixAvailable: true,
              },
              fixDescription: `Injected '${dep}: ${version}' into pubspec.yaml`,
            });
          }
        }
      }

      // Fix intl/SDK conflict: flutter_localizations from the SDK pins
      // intl ^0.20.x, so a stale `intl: ^0.19.0` (or older) can never
      // resolve — this exact failure broke real preview builds.
      if (/flutter_localizations\s*:/.test(pubspecContent)) {
        const intlLine = pubspecContent.match(/^(\s*intl\s*:\s*)['"]?([^'"\s]+)['"]?/m);
        const ver = intlLine?.[2] ?? '';
        const mm = ver.match(/(\d+)\.(\d+)/);
        const stale = mm !== null && (parseInt(mm[1], 10) === 0 && parseInt(mm[2], 10) < 20);
        if (stale && intlLine) {
          pubspecContent = pubspecContent.replace(
            /^(\s*intl\s*:\s*)['"]?[^'"\s]+['"]?/m,
            `$1^0.20.3`,
          );
          changed = true;
          fixedIssues.push({
            issue: {
              filePath: 'pubspec.yaml',
              severity: 'error',
              code: 'INTL_SDK_CONFLICT',
              message: `intl ${ver} conflicts with flutter_localizations from the SDK (requires intl ^0.20.3) — version solving would fail.`,
              autoFixAvailable: true,
            },
            fixDescription: `Bumped intl from ${ver} to ^0.20.3`,
          });
        }
      }

      if (changed) {
        healed[pubspecIdx] = { ...healed[pubspecIdx], content: pubspecContent };
      }

      // Self-dependency + self-stem import healing: the LLM derives deps and
      // imports from the app name (app `apex_3e9d1a` gets `apex: ^1.0.0` or
      // `import 'package:apex/...'`). A package can never depend on itself,
      // and `package:<stem>/` can never resolve when the package is
      // `<stem>_<suffix>` — both break `flutter pub get` / compilation.
      const ownName = (pubspecContent.match(/^name\s*:\s*([A-Za-z0-9_]+)/m)?.[1] || '').trim();
      if (ownName) {
        const selfDepRe = new RegExp(`^ {2}${ownName}\\s*:\\s*(?:[^\\n]*\\n(?: {4}.*\\n?)*)?`, 'm');
        if (selfDepRe.test(pubspecContent)) {
          pubspecContent = pubspecContent.replace(selfDepRe, '');
          healed[pubspecIdx] = { ...healed[pubspecIdx], content: pubspecContent };
          fixedIssues.push({
            issue: {
              filePath: 'pubspec.yaml',
              severity: 'error',
              code: 'SELF_DEPENDENCY_REMOVED',
              message: `pubspec depended on itself ('${ownName}') — a package can never depend on itself, version solving would fail.`,
              autoFixAvailable: true,
            },
            fixDescription: `Removed self-dependency '${ownName}' from pubspec.yaml`,
          });
        }

        const declared = new Set(
          [...pubspecContent.matchAll(/^ {2}([A-Za-z0-9_]+)\s*:/gm)].map((m) => m[1]),
        );
        const stems = new Set<string>();
        for (const f of healed) {
          if (!f.path.endsWith('.dart')) continue;
          for (const m of f.content.matchAll(/import\s+['"]package:([^/'"]+)\//g)) {
            stems.add(m[1]);
          }
        }
        const dartPaths = new Set(
          healed.filter((f) => f.path.endsWith('.dart')).map((f) => f.path),
        );
        const dropDepBlock = (depName: string): boolean => {
          const re = new RegExp(`^ {2}${depName}\\s*:\\s*(?:[^\\n]*\\n(?: {4}.*\\n?)*)?`, 'm');
          if (!re.test(pubspecContent)) return false;
          pubspecContent = pubspecContent.replace(re, '');
          healed[pubspecIdx] = { ...healed[pubspecIdx], content: pubspecContent };
          return true;
        };
        for (const stem of stems) {
          if (stem === ownName || !ownName.startsWith(`${stem}_`)) continue;
          const isDeclared = declared.has(stem);
          // Prove self-usage: every `package:<stem>/<sub>` import must map to
          // a real generated file (`lib/<sub>`). If so, the stem dep (when
          // present) exists only to satisfy these wrong imports — rewrite the
          // imports AND drop the dep. Otherwise the dep may be a genuine
          // third-party package and the build-time compiler (which checks
          // pub.dev for real) decides its fate.
          const subs = new Set<string>();
          for (const f of healed) {
            if (!f.path.endsWith('.dart')) continue;
            for (const m of f.content.matchAll(new RegExp(`package:${stem}\\/([^'"]+)`, 'g'))) {
              subs.add(m[1]);
            }
          }
          const allLocal =
            subs.size > 0 &&
            [...subs].every((s) => dartPaths.has(`lib/${s}`) || dartPaths.has(s));
          if (isDeclared && !allLocal) continue;
          const from = `package:${stem}/`;
          const to = `package:${ownName}/`;
          for (let i = 0; i < healed.length; i++) {
            const f = healed[i];
            if (!f.path.endsWith('.dart') || !f.content.includes(from)) continue;
            healed[i] = { ...f, content: f.content.split(from).join(to) };
            fixedIssues.push({
              issue: {
                filePath: f.path,
                severity: 'error',
                code: 'SELF_IMPORT_REWRITTEN',
                message: `Imported '${from}...' but the package name is '${ownName}' — that URI can never resolve.`,
                autoFixAvailable: true,
              },
              fixDescription: `Rewrote '${from}...' to '${to}...'`,
            });
          }
          if (isDeclared && dropDepBlock(stem)) {
            declared.delete(stem);
            fixedIssues.push({
              issue: {
                filePath: 'pubspec.yaml',
                severity: 'error',
                code: 'SELF_STEM_DEP_REMOVED',
                message: `pubspec depended on '${stem}' only to satisfy mis-scoped self-imports (now rewritten to '${ownName}') — that pin could never resolve.`,
                autoFixAvailable: true,
              },
              fixDescription: `Removed bogus '${stem}' dependency from pubspec.yaml`,
            });
          }
        }
      }
    }

    // Auto-fix Dart file missing imports & syntax issues
    for (let i = 0; i < healed.length; i++) {
      const f = healed[i];
      if (f.path.endsWith('.dart')) {
        let content = f.content;
        let modified = false;

        // Missing flutter/material.dart
        if ((content.includes('Widget') || content.includes('BuildContext') || content.includes('StatelessWidget') || content.includes('StatefulWidget')) &&
            !content.includes("import 'package:flutter/material.dart';")) {
          content = `import 'package:flutter/material.dart';\n` + content;
          modified = true;
          fixedIssues.push({
            issue: {
              filePath: f.path,
              severity: 'warning',
              code: 'MISSING_MATERIAL_IMPORT',
              message: 'Missing Flutter Material package import',
              autoFixAvailable: true,
            },
            fixDescription: "Added import 'package:flutter/material.dart';",
          });
        }

        // Missing flutter_animate
        if (content.includes('.animate(') && !content.includes('flutter_animate')) {
          content = `import 'package:flutter_animate/flutter_animate.dart';\n` + content;
          modified = true;
          fixedIssues.push({
            issue: {
              filePath: f.path,
              severity: 'warning',
              code: 'MISSING_ANIMATE_IMPORT',
              message: 'Missing flutter_animate package import',
              autoFixAvailable: true,
            },
            fixDescription: "Added import 'package:flutter_animate/flutter_animate.dart';",
          });
        }

        // Missing go_router
        if ((content.includes('context.go(') || content.includes('context.push(') || content.includes('GoRoute(')) && !content.includes('go_router')) {
          content = `import 'package:go_router/go_router.dart';\n` + content;
          modified = true;
          fixedIssues.push({
            issue: {
              filePath: f.path,
              severity: 'warning',
              code: 'MISSING_GOROUTER_IMPORT',
              message: 'Missing go_router package import',
              autoFixAvailable: true,
            },
            fixDescription: "Added import 'package:go_router/go_router.dart';",
          });
        }

        // Missing provider (only for provider-based projects — riverpod code
        // uses ref.watch, never context.watch, so injecting this is wrong).
        if (!usesRiverpod && (content.includes('Provider.of') || content.includes('context.watch<') || content.includes('context.read<')) && !content.includes('package:provider')) {
          content = `import 'package:provider/provider.dart';\n` + content;
          modified = true;
          fixedIssues.push({
            issue: {
              filePath: f.path,
              severity: 'warning',
              code: 'MISSING_PROVIDER_IMPORT',
              message: 'Missing provider package import',
              autoFixAvailable: true,
            },
            fixDescription: "Added import 'package:provider/provider.dart';",
          });
        }

        // Missing supabase_flutter
        if ((content.includes('Supabase') || content.includes('SupabaseClient')) &&
            !content.includes('supabase_flutter') &&
            !content.includes('supabase_service.dart')) {
          content = `import 'package:supabase_flutter/supabase_flutter.dart';\n` + content;
          modified = true;
          fixedIssues.push({
            issue: {
              filePath: f.path,
              severity: 'warning',
              code: 'MISSING_SUPABASE_IMPORT',
              message: 'Missing Supabase Flutter import',
              autoFixAvailable: true,
            },
            fixDescription: "Added import 'package:supabase_flutter/supabase_flutter.dart';",
          });
        }

        if (modified) {
          healed[i] = { ...f, content };
        }
      }
    }

    const remainingIssues = report.issues.filter(
      (iss) => !fixedIssues.some((fx) => fx.issue.filePath === iss.filePath && fx.issue.code === iss.code)
    );

    return {
      healedFiles: healed,
      report: {
        isValid: remainingIssues.filter((i) => i.severity === 'error').length === 0,
        issues: remainingIssues,
        fixedIssues,
        summary: `Self-healing resolved ${fixedIssues.length} issue(s). Remaining: ${remainingIssues.length}.`,
      },
    };
  }

  private static validatePubspec(file: AgentFileArtifact, issues: ValidationIssue[]) {
    const ownName = (file.content.match(/^name\s*:\s*([A-Za-z0-9_]+)/m)?.[1] || '').trim();
    // A package can never depend on itself (LLMs derive this from the app
    // name) — version solving fails outright.
    if (ownName && new RegExp(`^ {2}${ownName}\\s*:`, 'm').test(file.content)) {
      issues.push({
        filePath: file.path,
        severity: 'error',
        code: 'SELF_DEPENDENCY',
        message: `pubspec declares a dependency on itself ('${ownName}') — version solving would fail.`,
        suggestion: `Remove the '${ownName}' entry under dependencies`,
        autoFixAvailable: true,
      });
    }
    const usesRiverpod = file.content.includes('flutter_riverpod');
    const requiredPackages = usesRiverpod
      ? ['supabase_flutter', 'go_router', 'flutter_riverpod', 'flutter_animate']
      : ['supabase_flutter', 'go_router', 'provider', 'flutter_animate'];
    for (const pkg of requiredPackages) {
      if (!file.content.includes(pkg)) {
        issues.push({
          filePath: file.path,
          severity: 'warning',
          code: 'MISSING_RECOMMENDED_DEP',
          message: `Recommended package '${pkg}' is not declared in pubspec.yaml.`,
          suggestion: `Add ${pkg} under dependencies`,
          autoFixAvailable: true,
        });
      }
    }

    // intl/SDK conflict: flutter_localizations from the SDK pins intl
    // ^0.20.x — a stale `intl: ^0.19.0` can never resolve (broke real builds).
    if (/flutter_localizations\s*:/.test(file.content)) {
      const intlLine = file.content.match(/^\s*intl\s*:\s*['"]?([^'"\s]+)['"]?/m);
      const ver = intlLine?.[1] ?? '';
      const mm = ver.match(/(\d+)\.(\d+)/);
      if (mm && parseInt(mm[1], 10) === 0 && parseInt(mm[2], 10) < 20) {
        issues.push({
          filePath: file.path,
          severity: 'error',
          code: 'INTL_SDK_CONFLICT',
          message: `intl ${ver} conflicts with flutter_localizations from the SDK (requires intl ^0.20.3) — version solving would fail.`,
          suggestion: 'Bump intl to ^0.20.3',
          autoFixAvailable: true,
        });
      }
    }
  }

  private static validateMainDart(file: AgentFileArtifact, issues: ValidationIssue[]) {
    if (!file.content.includes('Supabase.initialize')) {
      issues.push({
        filePath: file.path,
        severity: 'warning',
        code: 'MISSING_SUPABASE_INIT',
        message: 'lib/main.dart does not call Supabase.initialize(). Supabase features may fail at runtime.',
        suggestion: 'Add await Supabase.initialize(...) in main()',
        autoFixAvailable: true,
      });
    }

    if (!file.content.includes('WidgetsFlutterBinding.ensureInitialized()')) {
      issues.push({
        filePath: file.path,
        severity: 'warning',
        code: 'MISSING_BINDING_INIT',
        message: 'WidgetsFlutterBinding.ensureInitialized() is required before asynchronous initializations.',
        suggestion: 'Call WidgetsFlutterBinding.ensureInitialized() at the beginning of main()',
        autoFixAvailable: true,
      });
    }
  }

  private static validateDartFile(file: AgentFileArtifact, issues: ValidationIssue[]) {
    // Wrong riverpod entrypoint LLMs emit: this file does not exist, so
    // every riverpod symbol (ConsumerWidget, ref, providers) goes undefined
    // in a cascade. Separated from autoHeal so live repair sees it too.
    if (file.content.includes('flutter_riverpod/flutter_provider.dart')) {
      issues.push({
        filePath: file.path,
        severity: 'error',
        code: 'BAD_RIVERPOD_IMPORT',
        message: `Imports 'package:flutter_riverpod/flutter_provider.dart' which does not exist (correct: 'package:flutter_riverpod/flutter_riverpod.dart').`,
        suggestion: `Replace with 'package:flutter_riverpod/flutter_riverpod.dart'`,
        autoFixAvailable: true,
      });
    }

    // Check balanced delimiters — the real Flutter compiler rejects these,
    // and the offline templates once shipped a missing paren (splash).
    // Naive counting, same philosophy as the historical brace check.
    const delimiterPairs: Array<{ open: RegExp; close: RegExp; label: string; code: string }> = [
      { open: /\{/g, close: /\}/g, label: 'curly braces', code: 'UNBALANCED_BRACES' },
      { open: /\(/g, close: /\)/g, label: 'parentheses', code: 'UNBALANCED_PARENS' },
      { open: /\[/g, close: /\]/g, label: 'square brackets', code: 'UNBALANCED_BRACKETS' },
    ];
    for (const { open, close, label, code } of delimiterPairs) {
      const openCount = (file.content.match(open) || []).length;
      const closeCount = (file.content.match(close) || []).length;
      if (openCount !== closeCount) {
        issues.push({
          filePath: file.path,
          severity: 'error',
          code,
          message: `Syntax error: Unbalanced ${label} (${openCount} open vs ${closeCount} close).`,
          autoFixAvailable: false,
        });
      }
    }

    // Check placeholder / stub patterns
    if (file.content.includes('// TODO') || file.content.includes('// implement') || file.content.includes('// ...rest')) {
      issues.push({
        filePath: file.path,
        severity: 'warning',
        code: 'CONTAINS_STUBS',
        message: `File contains stub or placeholder comments that should be fully implemented.`,
        autoFixAvailable: false,
      });
    }
  }

  /**
   * Hosted `package:X/` imports used across Dart files that are neither SDK
   * bundled nor declared in the pubspec.
   */
  private static findUndeclaredImports(files: AgentFileArtifact[], pubspecContent: string): string[] {
    const sdkBundled = new Set([
      'flutter', 'flutter_test', 'flutter_driver', 'integration_test',
      'flutter_localizations', 'flutter_web_plugins', 'flutter_gpu',
    ]);
    // A package never declares itself: `package:<ownName>/` self-imports are
    // always valid. Without this exclusion the fixer is told to "add" the app
    // itself as a dependency — manufacturing the unresolvable self-dep.
    const ownName = (pubspecContent.match(/^name\s*:\s*([A-Za-z0-9_]+)/m)?.[1] || '').trim();
    const used = new Set<string>();
    for (const f of files) {
      if (!(f.language === 'dart' || f.path.endsWith('.dart'))) continue;
      const re = /import\s+['"]package:([^/'"]+)\//g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(f.content)) !== null) used.add(m[1]);
    }
    return [...used].filter(
      (pkg) => pkg !== ownName && !sdkBundled.has(pkg) && !new RegExp(`^ {2}${pkg}\\s*:`, 'm').test(pubspecContent),
    );
  }

  /**
   * Every `import 'package:X/...'` used by Dart files must be a declared
   * dependency (or Flutter SDK bundle). Otherwise compilation fails on the
   * import even though `pub get` succeeded.
   */
  private static validatePackageImports(
    files: AgentFileArtifact[],
    pubspec: AgentFileArtifact,
    issues: ValidationIssue[],
  ) {
    const ownName = (pubspec.content.match(/^name\s*:\s*([A-Za-z0-9_]+)/m)?.[1] || '').trim();
    for (const pkg of this.findUndeclaredImports(files, pubspec.content)) {
      // Self-stem imports (`package:apex/...` in package `apex_3e9d1a`) must
      // be rewritten to the real package name — telling the fixer to "add
      // the dependency" is exactly what produced unresolvable `apex: ^1.0.0`
      // pins that broke real preview builds.
      if (ownName && ownName.startsWith(`${pkg}_`)) {
        issues.push({
          filePath: 'pubspec.yaml',
          severity: 'error',
          code: 'SELF_IMPORT_MISMATCH',
          message: `Dart code imports 'package:${pkg}/' but the package name is '${ownName}' — rewrite those imports to 'package:${ownName}/' and do NOT add any '${pkg}' dependency.`,
          suggestion: `Replace package:${pkg}/ with package:${ownName}/ in Dart imports`,
          autoFixAvailable: true,
        });
        continue;
      }
      issues.push({
        filePath: 'pubspec.yaml',
        severity: 'error',
        code: 'MISSING_DECLARED_DEP',
        message: `Dart code imports 'package:${pkg}/' but '${pkg}' is not declared in pubspec.yaml — compilation would fail on the import.`,
        suggestion: `Add ${pkg} under dependencies`,
        autoFixAvailable: true,
      });
    }
  }

  private static validateSqlFile(file: AgentFileArtifact, issues: ValidationIssue[]) {
    if (!file.content.includes('ENABLE ROW LEVEL SECURITY')) {
      issues.push({
        filePath: file.path,
        severity: 'warning',
        code: 'MISSING_RLS_ENABLE',
        message: 'SQL migration does not enable Row Level Security (RLS) on tables.',
        suggestion: 'Add ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;',
        autoFixAvailable: true,
      });
    }
  }
}
