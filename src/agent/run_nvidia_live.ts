import { OpenRouterClient } from './llmClient';
import { FLUTTER_SUPABASE_SYSTEM_PROMPT } from './prompts';
import { MultiFileCodeGenerator } from './codeGenerator';

async function generateWithNvidiaNemotron() {
  const apiKey = (typeof process !== 'undefined' && (process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY)) || (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_OPENROUTER_API_KEY) || '';
  const model = 'nvidia/nemotron-3-ultra-550b-a55b';
  const client = new OpenRouterClient({ apiKey, model });

  const prompt = `
Generate a complete, production-ready Flutter and Supabase mobile app for a "CryptoPortfolio & Trade Tracker" with:
1. A Supabase SQL migration (with tables 'wallets', 'transactions', 'crypto_assets' and Row Level Security RLS policies)
2. Flutter Dart model 'lib/models/crypto_asset.dart' with fromJson/toJson
3. Flutter Supabase service 'lib/services/crypto_service.dart' with realtime price stream
4. Flutter main dashboard screen 'lib/screens/portfolio_screen.dart' with Material 3 design and price charts

Return each file using this format:
\`\`\`dart filepath="lib/models/crypto_asset.dart"
// full code
\`\`\`
\`\`\`sql filepath="supabase/migrations/001_crypto_schema.sql"
-- full SQL
\`\`\`
`.trim();

  console.log('='.repeat(80));
  console.log(`🌐 CALLING NVIDIA NEMOTRON ULTRA (${model}) LIVE ON OPENROUTER`);
  console.log('='.repeat(80));
  console.log(`Prompt: "${prompt}"\n`);
  console.log('⏳ Waiting for NVIDIA Nemotron Ultra to generate code...');

  const startTime = performance.now();
  const rawResponse = await client.chat(
    [
      { role: 'system', content: FLUTTER_SUPABASE_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    {
      temperature: 0.2,
      maxTokens: 3500,
    }
  );

  const durationMs = Math.round(performance.now() - startTime);

  console.log('\n' + '='.repeat(80));
  console.log(`✅ RAW LIVE RESPONSE RETURNED FROM NVIDIA NEMOTRON ULTRA (${durationMs}ms)`);
  console.log('='.repeat(80));

  console.log(rawResponse);

  console.log('\n' + '='.repeat(80));
  console.log('📦 PARSED FILES EXTRACTED FROM NVIDIA RESPONSE:');
  console.log('='.repeat(80));

  const parsed = MultiFileCodeGenerator.parseLLMCodeArtifacts(rawResponse);
  parsed.forEach((file, idx) => {
    console.log(`  ${idx + 1}. [${file.language.toUpperCase()}] ${file.path} (${file.content.length} chars)`);
  });
}

void generateWithNvidiaNemotron();
