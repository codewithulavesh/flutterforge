import { keyPool, DEFAULT_OPENROUTER_KEYS } from './keyPool';
import { OpenRouterClient } from './llmClient';

async function testAllKeys() {
  console.log('='.repeat(80));
  console.log('🔑 TESTING OPENROUTER MULTI-KEY POOL (8 KEYS) WITH NVIDIA NEMOTRON ULTRA');
  console.log('='.repeat(80));

  const model = 'nvidia/nemotron-3-ultra-550b-a55b';
  console.log(`Model: ${model}`);
  console.log(`Total Keys in Pool: ${DEFAULT_OPENROUTER_KEYS.length}\n`);

  const results: Array<{ index: number; masked: string; status: 'SUCCESS' | 'FAILED'; latencyMs: number; error?: string }> = [];

  for (let i = 0; i < DEFAULT_OPENROUTER_KEYS.length; i++) {
    const key = DEFAULT_OPENROUTER_KEYS[i];
    const client = new OpenRouterClient({ apiKey: key, model });
    const masked = `${key.substring(0, 12)}...${key.substring(key.length - 6)}`;
    process.stdout.write(`[${i + 1}/${DEFAULT_OPENROUTER_KEYS.length}] Testing Key #${i + 1} (${masked})... `);

    const start = performance.now();
    try {
      const reply = await client.chat([
        { role: 'user', content: 'Reply with "OK"' }
      ], { maxTokens: 10 });
      const latency = Math.round(performance.now() - start);
      console.log(`✅ SUCCESS (${latency}ms) -> "${reply.trim()}"`);
      results.push({ index: i + 1, masked, status: 'SUCCESS', latencyMs: latency });
      keyPool.markSuccess(key);
    } catch (err) {
      const latency = Math.round(performance.now() - start);
      const msg = (err as Error).message;
      console.log(`❌ FAILED (${latency}ms) -> ${msg}`);
      results.push({ index: i + 1, masked, status: 'FAILED', latencyMs: latency, error: msg });
      keyPool.markFailure(key, msg);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 MULTI-KEY POOL SUMMARY MATRIX:');
  console.log('='.repeat(80));
  console.table(results);

  const healthyCount = results.filter((r) => r.status === 'SUCCESS').length;
  console.log(`\nActive Healthy Keys: ${healthyCount}/${results.length}`);
  console.log(`Load Balancer & Auto-Failover: ACTIVE`);
  console.log('='.repeat(80));
}

void testAllKeys();
