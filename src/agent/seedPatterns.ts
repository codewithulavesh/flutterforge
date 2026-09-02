import { supabase } from '../services/supabase';
import { BUILTIN_CODE_PATTERNS, VectorStore } from './vectorStore';

/**
 * Script to seed the code_patterns table with embeddings
 * Run with: npx tsx src/agent/seedPatterns.ts
 */
export async function seedCodePatterns(): Promise<void> {
  console.log(`Starting to seed ${BUILTIN_CODE_PATTERNS.length} built-in Flutter/Supabase patterns...`);

  let count = 0;
  for (const pattern of BUILTIN_CODE_PATTERNS) {
    try {
      const summary = `${pattern.name} (${pattern.domain}/${pattern.category}): ${pattern.description}`;
      const embedding = await VectorStore.embed(summary);

      const payload: Record<string, unknown> = {
        domain: pattern.domain,
        category: pattern.category,
        name: pattern.name,
        description: pattern.description,
        code: pattern.code,
        language: pattern.language,
        tags: pattern.tags || [],
        quality_score: 0.95,
      };

      if (embedding) {
        payload.embedding = embedding;
      }

      if (supabase) {
        const { error } = await supabase.from('code_patterns').upsert(payload, {
          onConflict: 'name',
        });
        if (!error) count++;
      }
      console.log(`✓ Seeded pattern: ${pattern.name} (${pattern.domain})`);
    } catch (err) {
      console.warn(`! Skipped ${pattern.name}:`, err);
    }
  }

  console.log(`Successfully seeded ${count}/${BUILTIN_CODE_PATTERNS.length} patterns into Supabase pgvector.`);
}

if (typeof require !== 'undefined' && require.main === module) {
  void seedCodePatterns();
}
