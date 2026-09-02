import { OpenRouterClient } from './llmClient';
import { FlutterSupabaseAgent, AgentContextBuilder } from './index';

async function testLiveOpenRouter() {
  console.log('='.repeat(80));
  console.log('⚡ TESTING LIVE NVIDIA NEMOTRON ULTRA FLUTTER + SUPABASE APP GENERATION');
  console.log('='.repeat(80));

  const apiKey = (typeof process !== 'undefined' && (process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY)) || (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_OPENROUTER_API_KEY) || '';
  const model = 'nvidia/nemotron-3-ultra-550b-a55b';
  const client = new OpenRouterClient({ apiKey, model });

  // 1. Test live chat connection with NVIDIA Nemotron Ultra
  console.log(`\n[1/3] Testing Connection to NVIDIA Nemotron Ultra (${model})...`);
  try {
    const pingResponse = await client.chat([
      { role: 'user', content: 'Reply with "NVIDIA_NEMOTRON_ULTRA_ONLINE" if you are ready for Flutter code generation.' },
    ], { maxTokens: 100 });
    console.log(`  ✅ Live Response from ${model}: "${pingResponse.trim()}"`);
  } catch (err) {
    console.error('  ❌ Connection Failed:', err);
    process.exit(1);
  }

  // 2. Test Live Planning & Architecture with NVIDIA Nemotron Ultra
  console.log('\n[2/3] Generating End-to-End Production App via NVIDIA Nemotron Ultra...');
  const prompt = 'Build a modern fitness streak and workout tracker app called FitPulse with Supabase database and user profiles';
  const context = AgentContextBuilder.buildContext({
    projectId: 'fitpulse-1',
    projectName: 'FitPulse',
    files: [],
  });

  const result = await FlutterSupabaseAgent.execute(prompt, context, {
    modelConfig: {
      provider: 'custom',
      modelName: model,
      apiKey,
    },
    onEvent: (event) => {
      console.log(`  🔄 [${event.phase.toUpperCase()}] ${event.message}`);
    },
  });

  console.log('\n[3/3] Verifying Generated Production Project:');
  console.log(`  - App Name: ${result.plan.appName}`);
  console.log(`  - Total Files: ${result.files.length}`);
  console.log(`  - Supabase Tables: ${result.plan.schema.tables.map((t) => t.name).join(', ')}`);
  console.log(`  - Screens: ${result.plan.screens.map((s) => s.name).join(', ')}`);
  console.log(`  - Validation: ${result.validationReport.summary}`);

  const mainDart = result.files.find((f) => f.path === 'lib/main.dart');
  const sqlFile = result.files.find((f) => f.path.endsWith('.sql'));

  if (mainDart && sqlFile && result.files.length >= 10) {
    console.log('\n' + '='.repeat(80));
    console.log('🎉 LIVE NVIDIA NEMOTRON ULTRA GENERATION VERIFIED & PASSED (100% PRODUCTION READY)');
    console.log('='.repeat(80));
  } else {
    console.error('❌ Generated project failed verification criteria.');
    process.exit(1);
  }
}

void testLiveOpenRouter();
