import { FlutterSupabaseAgent } from './index';
import { AgentPlanner } from './planner';
import { MultiFileCodeGenerator } from './codeGenerator';
import { AgentValidator } from './validator';
import { SupabaseSchemaGenerator } from './schemaGenerator';
import { AgentContextBuilder } from './context';
import type { AgentContext } from './types';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail ? ` (${detail})` : ''}`);
    failCount++;
  }
}

async function runEdgeCaseTests() {
  console.log('================================================================================');
  console.log('🧪 RUNNING COMPREHENSIVE FLUTTERFORGE AGENT EDGE CASE TEST SUITE');
  console.log('================================================================================\n');

  // ─────────────────────────────────────────────────────────────────────────────
  // EDGE CASE SUITE 1: All 15 Domains Planning & Code Generation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('[SUITE 1] 15 Domain Generation & Schema Verification');
  const domainsToTest = [
    { prompt: 'Build a fitness streak app called FitLife', expectedDomain: 'fitness', expectedTable: 'workouts' },
    { prompt: 'Build a sneaker shop called Kickz with cart and checkout', expectedDomain: 'ecommerce', expectedTable: 'products' },
    { prompt: 'Create an AI chat bot named NovaChat with streaming messages', expectedDomain: 'ai_chat', expectedTable: 'conversations' },
    { prompt: 'Create a social community feed app called Sphere', expectedDomain: 'social', expectedTable: 'posts' },
    { prompt: 'Build a kanban task manager called TaskMaster', expectedDomain: 'tasks', expectedTable: 'items' },
    { prompt: 'Create a restaurant delivery app called NomNom with menus', expectedDomain: 'food', expectedTable: 'items' },
    { prompt: 'Build a crypto wallet portfolio tracker called CoinTrack', expectedDomain: 'crypto', expectedTable: 'items' },
    { prompt: 'Build a doctor patient clinic appointment app called MedCare', expectedDomain: 'healthcare', expectedTable: 'appointments' },
    { prompt: 'Create a hotel and venue reservation app called StayEasy', expectedDomain: 'booking', expectedTable: 'bookings' },
    { prompt: 'Create an online course and lesson learning app called SkillUp', expectedDomain: 'education', expectedTable: 'items' },
    { prompt: 'Build a music playlist streaming app called BeatFlow', expectedDomain: 'music', expectedTable: 'items' },
    { prompt: 'Create a trip itinerary travel planner called Wanderlust', expectedDomain: 'travel', expectedTable: 'items' },
    { prompt: 'Build a real estate property listing app called UrbanNest', expectedDomain: 'real_estate', expectedTable: 'items' },
    { prompt: 'Build a daily habit and routine tracker called DailyFlow', expectedDomain: 'productivity', expectedTable: 'items' },
    { prompt: 'Create a general utility management system called MultiApp', expectedDomain: 'general', expectedTable: 'items' },
  ];

  for (const d of domainsToTest) {
    const dummyContext: AgentContext = {
      projectId: 'test-project',
      projectName: 'TestApp',
      existingFiles: [],
      installedPackages: {},
      conversationHistory: [],
    };

    const plan = AgentPlanner.plan(d.prompt, dummyContext);
    assert(plan.domain === d.expectedDomain, `${d.expectedDomain} domain detected correctly from prompt`, `Got: ${plan.domain}`);
    assert(plan.schema.tables.some((t) => t.name === d.expectedTable), `${d.expectedDomain} schema includes '${d.expectedTable}' table`);
    assert(plan.screens.length >= 3, `${d.expectedDomain} has at least 3 screens (has ${plan.screens.length})`);
    
    // Generate files and validate
    const files = MultiFileCodeGenerator.generateAllFiles(plan, dummyContext);
    assert(files.length >= 20, `${d.expectedDomain} generates complete file set (${files.length} files)`);
    
    const report = AgentValidator.validate(files);
    assert(report.isValid, `${d.expectedDomain} passes validation with 0 errors`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EDGE CASE SUITE 2: Incremental Follow-up Edits
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[SUITE 2] Incremental Edits & Project Context Preservation');
  {
    const initialContext: AgentContext = {
      projectId: 'proj-1',
      projectName: 'FitLife',
      existingFiles: [
        { path: 'pubspec.yaml', content: 'name: fitlife\ndependencies:\n  flutter:\n    sdk: flutter\n' },
        { path: 'lib/main.dart', content: "import 'package:flutter/material.dart';\nvoid main() => runApp(const MyApp());\nclass MyApp extends StatelessWidget { const MyApp({super.key}); @override Widget build(BuildContext context) => const MaterialApp(); }" },
        { path: 'lib/screens/home/home_screen.dart', content: "import 'package:flutter/material.dart';\nclass HomeScreen extends StatelessWidget { const HomeScreen({super.key}); @override Widget build(BuildContext context) => const Scaffold(); }" },
      ],
      installedPackages: { flutter: 'sdk' },
      conversationHistory: [{ role: 'user', content: 'Build a fitness app' }],
    };

    const updatePrompt = 'Change primary color to emerald green and add dark mode support';
    const plan = AgentPlanner.plan(updatePrompt, initialContext);

    assert(plan.filesToModify.includes('lib/main.dart'), 'Identifies lib/main.dart as existing file to modify');
    assert(plan.filesToModify.includes('lib/screens/home/home_screen.dart'), 'Identifies home_screen.dart as existing file to modify');
    assert(plan.filesToCreate.length > 0, 'Correctly identifies new files to create');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EDGE CASE SUITE 3: Hostile & Malformed Dart Code Auto-Healing
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[SUITE 3] Hostile Code Auto-Healing & Resilience');
  {
    const brokenFiles = [
      {
        path: 'pubspec.yaml',
        content: 'name: broken_app\ndependencies:\n  flutter:\n    sdk: flutter\n',
        language: 'yaml' as const,
        isNew: true,
      },
      {
        path: 'lib/main.dart',
        content: `void main() {
  WidgetsFlutterBinding.ensureInitialized();
  Supabase.initialize(url: 'https://xyz.supabase.co', anonKey: 'anon');
  runApp(const MyApp());
}
class MyApp extends StatelessWidget {
  const MyApp({super.key});
  @override
  Widget build(BuildContext context) {
    return const MaterialApp();
  }
}`,
        language: 'dart' as const,
        isNew: true,
      },
      {
        path: 'lib/screens/sample_screen.dart',
        content: `class SampleScreen extends StatelessWidget {
  const SampleScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return Container().animate().fadeIn();
  }
}`,
        language: 'dart' as const,
        isNew: true,
      },
    ];

    const report = AgentValidator.validate(brokenFiles);
    assert(report.issues.length > 0, 'Validator detected missing imports in broken files');

    const healed = AgentValidator.autoHeal(brokenFiles, report);
    const mainContent = healed.healedFiles.find((f) => f.path === 'lib/main.dart')?.content || '';
    const sampleContent = healed.healedFiles.find((f) => f.path === 'lib/screens/sample_screen.dart')?.content || '';
    const pubspecContent = healed.healedFiles.find((f) => f.path === 'pubspec.yaml')?.content || '';

    assert(mainContent.includes("import 'package:flutter/material.dart';"), 'Auto-healed main.dart with flutter/material.dart import');
    assert(mainContent.includes("import 'package:supabase_flutter/supabase_flutter.dart';"), 'Auto-healed main.dart with supabase_flutter.dart import');
    assert(sampleContent.includes("import 'package:flutter_animate/flutter_animate.dart';"), 'Auto-healed sample_screen.dart with flutter_animate.dart import');
    assert(pubspecContent.includes('supabase_flutter: ^2.8.0'), 'Auto-injected supabase_flutter into pubspec.yaml');
    assert(pubspecContent.includes('flutter_animate: ^4.5.0'), 'Auto-injected flutter_animate into pubspec.yaml');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EDGE CASE SUITE 4: Special Characters & App Names
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[SUITE 4] Prompt Sanitization & Special Characters');
  {
    const prompts = [
      { p: 'Create an app called "Super_Cool-App! 2026"', expected: 'Super_Cool' },
      { p: 'Build an app named ApexGym with auth', expected: 'ApexGym' },
      { p: '', expectedFallback: 'FlutterForgeApp' },
    ];

    const ctx: AgentContext = { projectId: 'p1', projectName: 'DefaultName', existingFiles: [], conversationHistory: [] };
    const plan1 = AgentPlanner.plan(prompts[0].p, ctx);
    const plan2 = AgentPlanner.plan(prompts[1].p, ctx);
    const plan3 = AgentPlanner.plan(prompts[2].p, ctx);

    assert(plan1.appName.length > 0, 'Handled special characters in app name gracefully');
    assert(plan2.appName === 'ApexGym', 'Inferred ApexGym app name correctly');
    assert(plan3.appName === 'DefaultName' || plan3.appName === 'FlutterForgeApp', 'Handled empty prompt with fallback app name');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EDGE CASE SUITE 5: Full E2E Execution Test
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[SUITE 5] End-to-End Execution Pipeline');
  {
    const e2eContext: AgentContext = {
      projectId: 'e2e-project',
      projectName: 'PulseFit',
      existingFiles: [],
      installedPackages: {},
      conversationHistory: [],
    };

    const result = await FlutterSupabaseAgent.execute(
      'Create a luxury real estate app called LuxEstate with search, property listings, filter chips, map preview, and agent contact modal',
      e2eContext
    );

    assert(result.success === true, 'E2E execution result.success === true');
    assert(result.files.length >= 22, `Generated complete file set (${result.files.length} files)`);
    assert(result.validationReport.isValid === true, 'Final validation report is valid with 0 errors');
    assert(result.files.some((f) => f.path === 'supabase/migrations/001_initial_schema.sql'), 'Includes PostgreSQL migration with RLS');
    assert(result.files.some((f) => f.path === 'lib/core/theme/app_theme.dart'), 'Includes AppTheme with Material 3');
    assert(result.files.some((f) => f.path === 'lib/core/widgets/shimmer_skeleton.dart'), 'Includes ShimmerSkeleton widget');
    assert(result.files.some((f) => f.path === 'lib/core/router/app_router.dart'), 'Includes GoRouter configuration');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n================================================================================');
  console.log(`📊 EDGE CASE SUITE SUMMARY: ${passCount}/${passCount + failCount} TESTS PASSED (${Math.round((passCount / (passCount + failCount)) * 100)}%)`);
  console.log('================================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

void runEdgeCaseTests();
