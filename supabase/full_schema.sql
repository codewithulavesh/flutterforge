-- ====================================================================
-- FlutterForge — Full Complete Database Schema
-- Run this in Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ====================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- 2. Tables
-- ====================================================================

-- Profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  plan text NOT NULL DEFAULT 'free',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Projects
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  template text NOT NULL DEFAULT 'blank',
  status text NOT NULL DEFAULT 'created',
  flutter_version text DEFAULT '3.24.0',
  state_management text DEFAULT 'provider',
  theme_mode text DEFAULT 'light',
  platform text DEFAULT 'web',
  config jsonb DEFAULT '{}',
  preview_url text,
  deployment_url text,
  is_shared boolean NOT NULL DEFAULT false,
  share_slug text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Project Files
CREATE TABLE IF NOT EXISTS public.project_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  path text NOT NULL,
  content text NOT NULL DEFAULT '',
  file_type text,
  is_directory boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id, path)
);

-- Project Versions
CREATE TABLE IF NOT EXISTS public.project_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  label text,
  description text,
  file_snapshot jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- AI Conversations
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New Conversation',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- AI Messages
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL DEFAULT '',
  tool_calls jsonb,
  changed_files jsonb,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Generation Tasks
CREATE TABLE IF NOT EXISTS public.generation_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  task_type text NOT NULL DEFAULT 'generate',
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'planning', 'generating', 'analyzing', 'fixing', 'building', 'ready', 'failed', 'deploying', 'deployed')),
  progress integer DEFAULT 0,
  steps jsonb DEFAULT '[]',
  result jsonb,
  error text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Builds
CREATE TABLE IF NOT EXISTS public.builds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  build_type text NOT NULL DEFAULT 'web',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed')),
  logs text DEFAULT '',
  output_url text,
  duration_ms integer,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Dependencies
CREATE TABLE IF NOT EXISTS public.dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  package_name text NOT NULL,
  version text NOT NULL,
  package_type text NOT NULL DEFAULT 'direct' CHECK (package_type IN ('direct', 'dev', 'transitive')),
  status text NOT NULL DEFAULT 'installed' CHECK (status IN ('installed', 'installing', 'failed', 'available')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, package_name)
);

-- Deployments
CREATE TABLE IF NOT EXISTS public.deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  build_id uuid REFERENCES public.builds(id) ON DELETE SET NULL,
  url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'deploying', 'deployed', 'failed')),
  provider text NOT NULL DEFAULT 'internal',
  logs text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Code Patterns Library (Vector Store)
CREATE TABLE IF NOT EXISTS public.code_patterns (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  domain        text        NOT NULL,
  category      text        NOT NULL,
  name          text        NOT NULL UNIQUE,
  description   text        NOT NULL,
  code          text        NOT NULL,
  language      text        NOT NULL DEFAULT 'dart',
  tags          text[]      NOT NULL DEFAULT '{}',
  embedding     vector(768),
  quality_score float       NOT NULL DEFAULT 0.9,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Project File Embeddings (Vector Store)
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

-- ====================================================================
-- 3. Indexes
-- ====================================================================

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON public.project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_versions_project_id ON public.project_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_project_id ON public.ai_conversations(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON public.ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_generation_tasks_project_id ON public.generation_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_builds_project_id ON public.builds(project_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_project_id ON public.dependencies(project_id);
CREATE INDEX IF NOT EXISTS idx_deployments_project_id ON public.deployments(project_id);
CREATE INDEX IF NOT EXISTS idx_code_patterns_domain_category ON public.code_patterns(domain, category);
CREATE INDEX IF NOT EXISTS idx_project_file_embeddings_project_id ON public.project_file_embeddings(project_id);

-- ====================================================================
-- 4. Triggers & Functions
-- ====================================================================

-- Auto-update updated_at timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trigger_projects_updated_at ON public.projects;
CREATE TRIGGER trigger_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trigger_project_files_updated_at ON public.project_files;
CREATE TRIGGER trigger_project_files_updated_at BEFORE UPDATE ON public.project_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trigger_ai_conversations_updated_at ON public.ai_conversations;
CREATE TRIGGER trigger_ai_conversations_updated_at BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-create profile when a user signs up in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    NULLIF(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Vector similarity search functions
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

-- ====================================================================
-- 5. Row Level Security (RLS)
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.builds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_file_embeddings ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
CREATE POLICY "select_own_profile" ON public.profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
CREATE POLICY "insert_own_profile" ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile" ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Projects Policies
DROP POLICY IF EXISTS "select_own_projects" ON public.projects;
CREATE POLICY "select_own_projects" ON public.projects FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_shared_projects" ON public.projects;
CREATE POLICY "select_shared_projects" ON public.projects FOR SELECT
  TO anon, authenticated USING (is_shared = true);

DROP POLICY IF EXISTS "insert_own_projects" ON public.projects;
CREATE POLICY "insert_own_projects" ON public.projects FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_projects" ON public.projects;
CREATE POLICY "update_own_projects" ON public.projects FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_projects" ON public.projects;
CREATE POLICY "delete_own_projects" ON public.projects FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Project Files Policies
DROP POLICY IF EXISTS "select_own_project_files" ON public.project_files;
CREATE POLICY "select_own_project_files" ON public.project_files FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "select_shared_project_files" ON public.project_files;
CREATE POLICY "select_shared_project_files" ON public.project_files FOR SELECT
  TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_files.project_id AND projects.is_shared = true)
  );

DROP POLICY IF EXISTS "insert_own_project_files" ON public.project_files;
CREATE POLICY "insert_own_project_files" ON public.project_files FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_project_files" ON public.project_files;
CREATE POLICY "update_own_project_files" ON public.project_files FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_project_files" ON public.project_files;
CREATE POLICY "delete_own_project_files" ON public.project_files FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid())
  );

-- Project Versions Policies
DROP POLICY IF EXISTS "select_own_project_versions" ON public.project_versions;
CREATE POLICY "select_own_project_versions" ON public.project_versions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_versions.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_project_versions" ON public.project_versions;
CREATE POLICY "insert_own_project_versions" ON public.project_versions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_versions.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_project_versions" ON public.project_versions;
CREATE POLICY "delete_own_project_versions" ON public.project_versions FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_versions.project_id AND projects.user_id = auth.uid())
  );

-- AI Conversations Policies
DROP POLICY IF EXISTS "select_own_conversations" ON public.ai_conversations;
CREATE POLICY "select_own_conversations" ON public.ai_conversations FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = ai_conversations.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "select_shared_conversations" ON public.ai_conversations;
CREATE POLICY "select_shared_conversations" ON public.ai_conversations FOR SELECT
  TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = ai_conversations.project_id AND projects.is_shared = true)
  );

DROP POLICY IF EXISTS "insert_own_conversations" ON public.ai_conversations;
CREATE POLICY "insert_own_conversations" ON public.ai_conversations FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = ai_conversations.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_conversations" ON public.ai_conversations;
CREATE POLICY "update_own_conversations" ON public.ai_conversations FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = ai_conversations.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_conversations" ON public.ai_conversations;
CREATE POLICY "delete_own_conversations" ON public.ai_conversations FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = ai_conversations.project_id AND projects.user_id = auth.uid())
  );

-- AI Messages Policies
DROP POLICY IF EXISTS "select_own_messages" ON public.ai_messages;
CREATE POLICY "select_own_messages" ON public.ai_messages FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.ai_conversations ac
      JOIN public.projects p ON p.id = ac.project_id
      WHERE ac.id = ai_messages.conversation_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "select_shared_messages" ON public.ai_messages;
CREATE POLICY "select_shared_messages" ON public.ai_messages FOR SELECT
  TO anon, authenticated USING (
    EXISTS (
      SELECT 1 FROM public.ai_conversations ac
      JOIN public.projects p ON p.id = ac.project_id
      WHERE ac.id = ai_messages.conversation_id AND p.is_shared = true
    )
  );

DROP POLICY IF EXISTS "insert_own_messages" ON public.ai_messages;
CREATE POLICY "insert_own_messages" ON public.ai_messages FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ai_conversations ac
      JOIN public.projects p ON p.id = ac.project_id
      WHERE ac.id = ai_messages.conversation_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_messages" ON public.ai_messages;
CREATE POLICY "delete_own_messages" ON public.ai_messages FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.ai_conversations ac
      JOIN public.projects p ON p.id = ac.project_id
      WHERE ac.id = ai_messages.conversation_id AND p.user_id = auth.uid()
    )
  );

-- Generation Tasks Policies
DROP POLICY IF EXISTS "select_own_tasks" ON public.generation_tasks;
CREATE POLICY "select_own_tasks" ON public.generation_tasks FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = generation_tasks.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_tasks" ON public.generation_tasks;
CREATE POLICY "insert_own_tasks" ON public.generation_tasks FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = generation_tasks.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_tasks" ON public.generation_tasks;
CREATE POLICY "update_own_tasks" ON public.generation_tasks FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = generation_tasks.project_id AND projects.user_id = auth.uid())
  );

-- Builds Policies
DROP POLICY IF EXISTS "select_own_builds" ON public.builds;
CREATE POLICY "select_own_builds" ON public.builds FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = builds.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_builds" ON public.builds;
CREATE POLICY "insert_own_builds" ON public.builds FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = builds.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_builds" ON public.builds;
CREATE POLICY "update_own_builds" ON public.builds FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = builds.project_id AND projects.user_id = auth.uid())
  );

-- Dependencies Policies
DROP POLICY IF EXISTS "select_own_dependencies" ON public.dependencies;
CREATE POLICY "select_own_dependencies" ON public.dependencies FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = dependencies.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "select_shared_dependencies" ON public.dependencies;
CREATE POLICY "select_shared_dependencies" ON public.dependencies FOR SELECT
  TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = dependencies.project_id AND projects.is_shared = true)
  );

DROP POLICY IF EXISTS "insert_own_dependencies" ON public.dependencies;
CREATE POLICY "insert_own_dependencies" ON public.dependencies FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = dependencies.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_dependencies" ON public.dependencies;
CREATE POLICY "update_own_dependencies" ON public.dependencies FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = dependencies.project_id AND projects.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = dependencies.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_dependencies" ON public.dependencies;
CREATE POLICY "delete_own_dependencies" ON public.dependencies FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = dependencies.project_id AND projects.user_id = auth.uid())
  );

-- Deployments Policies
DROP POLICY IF EXISTS "select_own_deployments" ON public.deployments;
CREATE POLICY "select_own_deployments" ON public.deployments FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = deployments.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_deployments" ON public.deployments;
CREATE POLICY "insert_own_deployments" ON public.deployments FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = deployments.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_deployments" ON public.deployments;
CREATE POLICY "update_own_deployments" ON public.deployments FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = deployments.project_id AND projects.user_id = auth.uid())
  );

-- Code Patterns Policies
DROP POLICY IF EXISTS "Public read code patterns" ON public.code_patterns;
CREATE POLICY "Public read code patterns" ON public.code_patterns
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated insert code patterns" ON public.code_patterns;
CREATE POLICY "Authenticated insert code patterns" ON public.code_patterns
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Project File Embeddings Policies
DROP POLICY IF EXISTS "Owner access file embeddings" ON public.project_file_embeddings;
CREATE POLICY "Owner access file embeddings" ON public.project_file_embeddings
  FOR ALL USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );
