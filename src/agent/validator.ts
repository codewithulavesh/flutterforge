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
        autoFixAvailable: true,
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
        autoFixAvailable: true,
      });
    } else {
      this.validateMainDart(mainDart, issues);
    }

    // 3. Validate each Dart file
    for (const file of files.filter((f) => f.language === 'dart' || f.path.endsWith('.dart'))) {
      this.validateDartFile(file, issues);
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

    // Auto-fix missing pubspec dependencies
    const pubspecIdx = healed.findIndex((f) => f.path === 'pubspec.yaml');
    if (pubspecIdx >= 0) {
      let pubspecContent = healed[pubspecIdx].content;
      const requiredDeps: Record<string, string> = {
        supabase_flutter: '^2.8.0',
        go_router: '^14.6.2',
        provider: '^6.1.2',
        google_fonts: '^6.2.1',
        flutter_animate: '^4.5.0',
        cached_network_image: '^3.4.1',
      };

      let changed = false;
      for (const [dep, version] of Object.entries(requiredDeps)) {
        if (!pubspecContent.includes(dep)) {
          pubspecContent = pubspecContent.replace('dependencies:\n', `dependencies:\n  ${dep}: ${version}\n`);
          changed = true;
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

      if (changed) {
        healed[pubspecIdx] = { ...healed[pubspecIdx], content: pubspecContent };
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

        // Missing provider
        if ((content.includes('Provider.of') || content.includes('context.watch<') || content.includes('context.read<')) && !content.includes('package:provider')) {
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
    const requiredPackages = ['supabase_flutter', 'go_router', 'provider', 'flutter_animate'];
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
    // Check balanced braces
    const openBraces = (file.content.match(/{/g) || []).length;
    const closeBraces = (file.content.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      issues.push({
        filePath: file.path,
        severity: 'error',
        code: 'UNBALANCED_BRACES',
        message: `Syntax error: Unbalanced curly braces (${openBraces} open vs ${closeBraces} close).`,
        autoFixAvailable: false,
      });
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
