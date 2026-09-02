import { FlutterSupabaseAgent, AgentContextBuilder } from './index';

async function generateAndShow() {
  const prompt = `
Build a production-ready E-Commerce Marketplace app called "ApexStore" with:
- Supabase Authentication (Email, Password, Session management)
- Product catalog with categories, search, ratings, and stock count
- Shopping cart with item quantity updates and total calculation
- Orders management with order placement and status tracking
- Supabase PostgreSQL schema with Row Level Security (RLS) policies and realtime inventory
- Material 3 Design with clean modern UI, dark theme support, and GoRouter navigation
`.trim();

  const context = AgentContextBuilder.buildContext({
    projectId: 'apex-store-001',
    projectName: 'ApexStore',
    files: [],
    supabaseUrl: 'https://apexstore.supabase.co',
    supabaseAnonKey: 'sb_anon_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  });

  console.log('='.repeat(80));
  console.log('🤖 FLUTTERFORGE LOVABLE AGENT - LIVE GENERATION RUN');
  console.log('='.repeat(80));
  console.log(`Prompt: "${prompt}"\n`);

  const result = await FlutterSupabaseAgent.execute(prompt, context, {
    onEvent: (event) => {
      console.log(`[${event.phase.toUpperCase()}] ${event.message}`);
    },
  });

  console.log('\n' + '='.repeat(80));
  console.log(`📁 GENERATED ${result.files.length} PRODUCTION CODE FILES`);
  console.log('='.repeat(80));

  result.files.forEach((f, idx) => {
    console.log(`  ${idx + 1}. [${f.language.toUpperCase()}] ${f.path}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('📄 SAMPLE GENERATED SOURCE CODE FILES');
  console.log('='.repeat(80));

  const samplePaths = [
    'supabase/migrations/001_initial_schema.sql',
    'lib/main.dart',
    'lib/services/supabase_service.dart',
    'lib/services/product_service.dart',
    'lib/models/product.dart',
    'lib/core/router/app_router.dart',
    'lib/screens/home/home_screen.dart',
    'lib/screens/auth/auth_screen.dart',
  ];

  for (const path of samplePaths) {
    const file = result.files.find((f) => f.path === path);
    if (file) {
      console.log(`\n--------------------------------------------------------------------------------`);
      console.log(`FILE: ${file.path}`);
      console.log(`--------------------------------------------------------------------------------`);
      console.log(file.content);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ GENERATION COMPLETE & VALIDATED');
  console.log('='.repeat(80));
}

void generateAndShow();
