import { FlutterSupabaseAgent } from '../src/agent/index';
import { AgentValidator } from '../src/agent/validator';

async function main() {
  const cases = [
    { name: 'Admin Dashboard (local-only)', usesSupabase: false, prompt: 'Build a comprehensive admin dashboard with user management, role-based access control, system health monitors, audit logs, and analytics.', extra: { platform: 'web' } },
    { name: 'Food Delivery App (Supabase)', usesSupabase: true, prompt: 'Build a food delivery app with restaurants, menu items, orders, cart, and user profiles.', extra: {} },
    { name: 'Calculator (local)', usesSupabase: false, prompt: 'Build a colorful Apple-style calculator.', extra: {} },
  ];

  let allPassed = true;

  for (const c of cases) {
    const result = await FlutterSupabaseAgent.execute(c.prompt, {
      projectId: 'test-' + Date.now(),
      projectName: 'TestApp',
      existingFiles: [],
      usesSupabase: c.usesSupabase,
      conversationHistory: [],
      ...c.extra,
    } as any);
    const v = AgentValidator.validate(result.files, { usesSupabase: c.usesSupabase });
    const pubspec = result.files.find((f) => f.path === 'pubspec.yaml');
    const hasSupabaseDep = pubspec?.content.includes('supabase_flutter') ?? false;
    const errors = v.issues.filter((i) => i.severity === 'error').length;

    const supOk = hasSupabaseDep === c.usesSupabase;
    const pass = v.isValid && errors === 0 && supOk;
    if (!pass) allPassed = false;

    console.log(`${pass ? '✅' : '❌'} ${c.name}`);
    console.log(`   domain: ${result.plan.domain} | files: ${result.files.length} | valid: ${v.isValid} | errors: ${errors}`);
    console.log(`   supabase_flutter: ${hasSupabaseDep} (expected: ${c.usesSupabase}) ${supOk ? '✓' : '✗'}`);
    if (!pass) {
      v.issues.filter((i) => i.severity === 'error').forEach((i) => console.log(`   ERR: ${i.message}`));
    }
    console.log();
  }

  if (!allPassed) process.exit(1);
  console.log('All smoke tests passed!');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

