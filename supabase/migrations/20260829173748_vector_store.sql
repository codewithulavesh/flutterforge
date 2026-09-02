/*
# FlutterForge — Vector Store Schema (pgvector)

Adds semantic search capabilities to the agent pipeline via Supabase pgvector.

## New Tables
- `code_patterns`           — Pre-seeded Flutter/Supabase code patterns (widgets, services, SQL)
- `project_file_embeddings` — Per-project file embeddings for smart context retrieval

## New Functions
- `match_code_patterns()`   — Semantic search over the pattern library
- `match_project_files()`   — Semantic search over a project's existing files
*/

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- code_patterns: Pre-seeded Flutter/Supabase code pattern library
CREATE TABLE IF NOT EXISTS public.code_patterns (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  domain        text        NOT NULL,
  category      text        NOT NULL,
  name          text        NOT NULL,
  description   text        NOT NULL,
  code          text        NOT NULL,
  language      text        NOT NULL DEFAULT 'dart',
  tags          text[]      NOT NULL DEFAULT '{}',
  embedding     vector(768),
  quality_score float       NOT NULL DEFAULT 0.9,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS code_patterns_embedding_idx
  ON public.code_patterns
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS code_patterns_domain_category_idx
  ON public.code_patterns (domain, category);

-- project_file_embeddings: Per-project file context
CREATE TABLE IF NOT EXISTS public.project_file_embeddings (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_path   text        NOT NULL,
  summary     text        NOT NULL,
  embedding   vector(768),
  token_count int,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, file_path)
);

CREATE INDEX IF NOT EXISTS project_file_embeddings_embedding_idx
  ON public.project_file_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

CREATE INDEX IF NOT EXISTS project_file_embeddings_project_idx
  ON public.project_file_embeddings (project_id);

-- RLS
ALTER TABLE public.code_patterns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read code patterns" ON public.code_patterns;
CREATE POLICY "Public read code patterns" ON public.code_patterns
  FOR SELECT USING (true);

ALTER TABLE public.project_file_embeddings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner access file embeddings" ON public.project_file_embeddings;
CREATE POLICY "Owner access file embeddings" ON public.project_file_embeddings
  FOR ALL USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

-- match_code_patterns(): semantic search over pattern library
CREATE OR REPLACE FUNCTION public.match_code_patterns(
  query_embedding  vector(768),
  domain_filter    text    DEFAULT NULL,
  category_filter  text    DEFAULT NULL,
  match_count      int     DEFAULT 5,
  min_similarity   float   DEFAULT 0.3
)
RETURNS TABLE (
  id uuid, name text, description text, code text,
  language text, category text, domain text, similarity float
)
LANGUAGE sql STABLE AS $$
  SELECT
    id, name, description, code, language, category, domain,
    1 - (embedding <=> query_embedding) AS similarity
  FROM public.code_patterns
  WHERE embedding IS NOT NULL
    AND (domain_filter IS NULL OR domain = domain_filter OR domain = 'general')
    AND (category_filter IS NULL OR category = category_filter)
    AND 1 - (embedding <=> query_embedding) >= min_similarity
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- match_project_files(): semantic search over a project's existing files
CREATE OR REPLACE FUNCTION public.match_project_files(
  query_embedding  vector(768),
  p_project_id     uuid,
  match_count      int   DEFAULT 8,
  min_similarity   float DEFAULT 0.2
)
RETURNS TABLE (file_path text, summary text, similarity float)
LANGUAGE sql STABLE AS $$
  SELECT
    file_path, summary,
    1 - (embedding <=> query_embedding) AS similarity
  FROM public.project_file_embeddings
  WHERE project_id = p_project_id
    AND embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) >= min_similarity
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
