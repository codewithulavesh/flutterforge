/*
# FlutterForge - Complete Database Schema

Creates the full database schema for FlutterForge, an AI-powered Flutter app generation platform.

## New Tables
- `profiles` - User profile data (extends Supabase auth.users)
- `projects` - Flutter projects owned by users
- `project_files` - Individual files within a project (Dart source, pubspec.yaml, etc.)
- `project_versions` - Version checkpoints for project history
- `ai_conversations` - AI chat conversations per project
- `ai_messages` - Individual messages within conversations
- `generation_tasks` - Background generation/build tasks
- `builds` - Flutter build records
- `dependencies` - Pub package dependencies per project
- `deployments` - Web deployment records

## Security
- RLS enabled on all tables
- Owner-scoped policies: users can only CRUD their own data
- All owner columns default to auth.uid()
- Child tables scoped through parent ownership checks
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  plan text NOT NULL DEFAULT 'free',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
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
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_projects" ON projects;
CREATE POLICY "select_own_projects" ON projects FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_projects" ON projects;
CREATE POLICY "insert_own_projects" ON projects FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_projects" ON projects;
CREATE POLICY "update_own_projects" ON projects FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_projects" ON projects;
CREATE POLICY "delete_own_projects" ON projects FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);

-- Project files table
CREATE TABLE IF NOT EXISTS project_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path text NOT NULL,
  content text NOT NULL DEFAULT '',
  file_type text,
  is_directory boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id, path)
);

ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_project_files" ON project_files;
CREATE POLICY "select_own_project_files" ON project_files FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_project_files" ON project_files;
CREATE POLICY "insert_own_project_files" ON project_files FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_project_files" ON project_files;
CREATE POLICY "update_own_project_files" ON project_files FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_project_files" ON project_files;
CREATE POLICY "delete_own_project_files" ON project_files FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files(project_id);

-- Project versions table
CREATE TABLE IF NOT EXISTS project_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  label text,
  description text,
  file_snapshot jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE project_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_project_versions" ON project_versions;
CREATE POLICY "select_own_project_versions" ON project_versions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_versions.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_project_versions" ON project_versions;
CREATE POLICY "insert_own_project_versions" ON project_versions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_versions.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_project_versions" ON project_versions;
CREATE POLICY "delete_own_project_versions" ON project_versions FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_versions.project_id AND projects.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_project_versions_project_id ON project_versions(project_id);

-- AI conversations table
CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New Conversation',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_conversations" ON ai_conversations;
CREATE POLICY "select_own_conversations" ON ai_conversations FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = ai_conversations.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_conversations" ON ai_conversations;
CREATE POLICY "insert_own_conversations" ON ai_conversations FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = ai_conversations.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_conversations" ON ai_conversations;
CREATE POLICY "update_own_conversations" ON ai_conversations FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = ai_conversations.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_conversations" ON ai_conversations;
CREATE POLICY "delete_own_conversations" ON ai_conversations FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = ai_conversations.project_id AND projects.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_ai_conversations_project_id ON ai_conversations(project_id);

-- AI messages table
CREATE TABLE IF NOT EXISTS ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL DEFAULT '',
  tool_calls jsonb,
  changed_files jsonb,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_messages" ON ai_messages;
CREATE POLICY "select_own_messages" ON ai_messages FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM ai_conversations ac
      JOIN projects p ON p.id = ac.project_id
      WHERE ac.id = ai_messages.conversation_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_messages" ON ai_messages;
CREATE POLICY "insert_own_messages" ON ai_messages FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_conversations ac
      JOIN projects p ON p.id = ac.project_id
      WHERE ac.id = ai_messages.conversation_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_messages" ON ai_messages;
CREATE POLICY "delete_own_messages" ON ai_messages FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM ai_conversations ac
      JOIN projects p ON p.id = ac.project_id
      WHERE ac.id = ai_messages.conversation_id AND p.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai_messages(conversation_id);

-- Generation tasks table
CREATE TABLE IF NOT EXISTS generation_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES ai_conversations(id) ON DELETE SET NULL,
  task_type text NOT NULL DEFAULT 'generate',
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'planning', 'generating', 'analyzing', 'fixing', 'building', 'ready', 'failed', 'deploying', 'deployed')),
  progress integer DEFAULT 0,
  steps jsonb DEFAULT '[]',
  result jsonb,
  error text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE generation_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_tasks" ON generation_tasks;
CREATE POLICY "select_own_tasks" ON generation_tasks FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = generation_tasks.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_tasks" ON generation_tasks;
CREATE POLICY "insert_own_tasks" ON generation_tasks FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = generation_tasks.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_tasks" ON generation_tasks;
CREATE POLICY "update_own_tasks" ON generation_tasks FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = generation_tasks.project_id AND projects.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_generation_tasks_project_id ON generation_tasks(project_id);

-- Builds table
CREATE TABLE IF NOT EXISTS builds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  build_type text NOT NULL DEFAULT 'web',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed')),
  logs text DEFAULT '',
  output_url text,
  duration_ms integer,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE builds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_builds" ON builds;
CREATE POLICY "select_own_builds" ON builds FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = builds.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_builds" ON builds;
CREATE POLICY "insert_own_builds" ON builds FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = builds.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_builds" ON builds;
CREATE POLICY "update_own_builds" ON builds FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = builds.project_id AND projects.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_builds_project_id ON builds(project_id);

-- Dependencies table
CREATE TABLE IF NOT EXISTS dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  package_name text NOT NULL,
  version text NOT NULL,
  package_type text NOT NULL DEFAULT 'direct' CHECK (package_type IN ('direct', 'dev', 'transitive')),
  status text NOT NULL DEFAULT 'installed' CHECK (status IN ('installed', 'installing', 'failed', 'available')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, package_name)
);

ALTER TABLE dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_dependencies" ON dependencies;
CREATE POLICY "select_own_dependencies" ON dependencies FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = dependencies.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_dependencies" ON dependencies;
CREATE POLICY "insert_own_dependencies" ON dependencies FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = dependencies.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_dependencies" ON dependencies;
CREATE POLICY "update_own_dependencies" ON dependencies FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = dependencies.project_id AND projects.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = dependencies.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_dependencies" ON dependencies;
CREATE POLICY "delete_own_dependencies" ON dependencies FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = dependencies.project_id AND projects.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_dependencies_project_id ON dependencies(project_id);

-- Deployments table
CREATE TABLE IF NOT EXISTS deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  build_id uuid REFERENCES builds(id) ON DELETE SET NULL,
  url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'deploying', 'deployed', 'failed')),
  provider text NOT NULL DEFAULT 'internal',
  logs text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_deployments" ON deployments;
CREATE POLICY "select_own_deployments" ON deployments FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = deployments.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_deployments" ON deployments;
CREATE POLICY "insert_own_deployments" ON deployments FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = deployments.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_deployments" ON deployments;
CREATE POLICY "update_own_deployments" ON deployments FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = deployments.project_id AND projects.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_deployments_project_id ON deployments(project_id);

-- Auto-update updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON profiles;
CREATE TRIGGER trigger_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_projects_updated_at ON projects;
CREATE TRIGGER trigger_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_project_files_updated_at ON project_files;
CREATE TRIGGER trigger_project_files_updated_at BEFORE UPDATE ON project_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_ai_conversations_updated_at ON ai_conversations;
CREATE TRIGGER trigger_ai_conversations_updated_at BEFORE UPDATE ON ai_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();