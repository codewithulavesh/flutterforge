import {
  FlutterSupabaseAgent,
  AgentContextBuilder,
  AgentPlanner,
  MultiFileCodeGenerator,
  SupabaseSchemaGenerator,
  AgentValidator,
  type AgentFileArtifact,
} from './index';

async function runTestSuite() {
  console.log('='.repeat(80));
  console.log('🚀 RUNNING FLUTTER + SUPABASE LOVABLE AGENT INPUT/OUTPUT TEST SUITE');
  console.log('='.repeat(80));

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${testName}${detail ? ` -> ${detail}` : ''}`);
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: E-Commerce Store Generation (Input -> Plan -> Schema -> Files -> Summary)
  // --------------------------------------------------------------------------
  console.log('\n[TEST 1] E-Commerce Store Generation (Input -> Output Pipeline)');
  const ecommercePrompt =
    'Create a modern Nike sneaker store app called SneakerVault with dark mode, product catalog, cart, real-time Supabase stock, and auth';
  console.log(`  Input Prompt: "${ecommercePrompt}"`);

  const initialFiles: Array<{ path: string; content: string; isDirectory: boolean }> = [];
  const context1 = AgentContextBuilder.buildContext({
    projectId: 'test-project-1',
    projectName: 'SneakerVault',
    files: initialFiles,
    supabaseUrl: 'https://test-project.supabase.co',
    supabaseAnonKey: 'test-anon-key-12345',
  });

  const result1 = await FlutterSupabaseAgent.execute(ecommercePrompt, context1, {
    enableAutoHealing: true,
  });

  assert(result1.success === true, 'Agent execution completed successfully');
  assert(result1.plan.appName === 'SneakerVault', `App name inferred correctly (${result1.plan.appName})`);
  assert(result1.plan.theme.isDarkPreferred === true, 'Dark mode detected from prompt');
  assert(result1.files.length >= 15, `Generated complete multi-file project (${result1.files.length} files)`);

  const tableNames = result1.plan.schema.tables.map((t) => t.name);
  assert(tableNames.includes('profiles'), 'Schema includes profiles table');
  assert(tableNames.includes('products'), 'Schema includes products table');
  assert(tableNames.includes('orders'), 'Schema includes orders table');

  const pubspec = result1.files.find((f) => f.path === 'pubspec.yaml');
  assert(!!pubspec && pubspec.content.includes('supabase_flutter: ^2.8.0'), 'pubspec.yaml contains supabase_flutter ^2.8.0');
  assert(!!pubspec && pubspec.content.includes('go_router: ^14.6.2'), 'pubspec.yaml contains go_router ^14.6.2');

  const mainDart = result1.files.find((f) => f.path === 'lib/main.dart');
  assert(!!mainDart && mainDart.content.includes('Supabase.initialize'), 'lib/main.dart initializes Supabase client');
  assert(!!mainDart && mainDart.content.includes('WidgetsFlutterBinding.ensureInitialized()'), 'lib/main.dart ensures Flutter binding');

  const migrationSql = result1.files.find((f) => f.path.endsWith('.sql'));
  assert(!!migrationSql && migrationSql.content.includes('ENABLE ROW LEVEL SECURITY'), 'SQL migration enables RLS on tables');
  assert(!!migrationSql && migrationSql.content.includes('supabase_realtime'), 'SQL migration enables realtime publication');

  assert(result1.validationReport.isValid === true, `Validation report passes (${result1.validationReport.summary})`);

  // --------------------------------------------------------------------------
  // TEST 2: AI Chat App Architecture & Database Schema
  // --------------------------------------------------------------------------
  console.log('\n[TEST 2] AI Chat Assistant (Input -> Output Pipeline)');
  const chatPrompt = 'Build an AI Chat assistant app with Supabase called NovaChat with streaming messages and conversations';
  console.log(`  Input Prompt: "${chatPrompt}"`);

  const context2 = AgentContextBuilder.buildContext({
    projectId: 'test-project-2',
    projectName: 'NovaChat',
    files: initialFiles,
  });

  const result2 = await FlutterSupabaseAgent.execute(chatPrompt, context2);
  assert(result2.plan.appName === 'NovaChat', `App name inferred correctly (${result2.plan.appName})`);
  const chatTables = result2.plan.schema.tables.map((t) => t.name);
  assert(chatTables.includes('conversations'), 'Schema includes conversations table');
  assert(chatTables.includes('messages'), 'Schema includes messages table');

  const messageModel = result2.files.find((f) => f.path === 'lib/models/message.dart');
  assert(!!messageModel && messageModel.content.includes('class Message'), 'Generated Message model with fromJson/toJson');

  // --------------------------------------------------------------------------
  // TEST 3: Validator & Auto-Healer Test (Handling Broken Inputs)
  // --------------------------------------------------------------------------
  console.log('\n[TEST 3] Validator & Self-Healing Engine');
  const brokenFiles: AgentFileArtifact[] = [
    {
      path: 'pubspec.yaml',
      content: 'name: broken_app\ndependencies:\n  flutter:\n    sdk: flutter\n',
      language: 'yaml',
      isNew: true,
    },
    {
      path: 'lib/screens/sample_screen.dart',
      // Missing import for Flutter Material
      content: `class SampleScreen extends StatelessWidget {\n  const SampleScreen({super.key});\n  @override\n  Widget build(BuildContext context) => Container();\n}`,
      language: 'dart',
      isNew: true,
    },
    {
      path: 'lib/main.dart',
      // Missing Supabase init and binding
      content: `import 'package:flutter/material.dart';\nvoid main() => runApp(const MyApp());\nclass MyApp extends StatelessWidget { const MyApp({super.key}); @override Widget build(BuildContext context) => Container(); }`,
      language: 'dart',
      isNew: true,
    },
  ];

  const preValidation = AgentValidator.validate(brokenFiles);
  assert(preValidation.issues.length > 0, `Validator correctly detected issues (${preValidation.issues.length} detected)`);

  const healedResult = AgentValidator.autoHeal(brokenFiles, preValidation);
  assert(healedResult.report.fixedIssues.length > 0, `Auto-healer fixed issues (${healedResult.report.fixedIssues.length} fixed)`);

  const healedDart = healedResult.healedFiles.find((f) => f.path === 'lib/screens/sample_screen.dart');
  assert(
    !!healedDart && healedDart.content.includes("import 'package:flutter/material.dart';"),
    'Auto-healer injected missing package:flutter/material.dart import'
  );

  const healedPubspec = healedResult.healedFiles.find((f) => f.path === 'pubspec.yaml');
  assert(
    !!healedPubspec && healedPubspec.content.includes('supabase_flutter: ^2.8.0'),
    'Auto-healer injected missing supabase_flutter into pubspec.yaml'
  );

  // --------------------------------------------------------------------------
  // TEST 4: LLM Stream / Artifact Code Block Parser
  // --------------------------------------------------------------------------
  console.log('\n[TEST 4] LLM Artifact Codeblock Parser');
  const rawLLMOutput = `
Here is your generated code:

\`\`\`dart filepath="lib/core/constants.dart"
class AppConstants {
  static const String appName = 'TestApp';
}
\`\`\`

\`\`\`sql filepath="supabase/migrations/001_init.sql"
CREATE TABLE test_items (id uuid PRIMARY KEY);
\`\`\`
`;

  const parsedArtifacts = MultiFileCodeGenerator.parseLLMCodeArtifacts(rawLLMOutput);
  assert(parsedArtifacts.length === 2, `Parsed exactly 2 code blocks (${parsedArtifacts.length} parsed)`);
  assert(parsedArtifacts[0].path === 'lib/core/constants.dart', 'Parsed Dart file path correctly');
  assert(parsedArtifacts[1].path === 'supabase/migrations/001_init.sql', 'Parsed SQL migration path correctly');

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n' + '='.repeat(80));
  console.log(`📊 TEST SUITE SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('='.repeat(80));

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

void runTestSuite();
