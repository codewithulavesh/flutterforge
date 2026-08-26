-- Add is_shared column to projects for public sharing
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS share_slug text;

-- Allow public read access to shared projects
CREATE POLICY "select_shared_projects" ON projects FOR SELECT
  TO anon, authenticated USING (is_shared = true);

-- Allow public read access to files of shared projects
CREATE POLICY "select_shared_project_files" ON project_files FOR SELECT
  TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_files.project_id AND projects.is_shared = true)
  );

-- Allow public read access to dependencies of shared projects
CREATE POLICY "select_shared_dependencies" ON dependencies FOR SELECT
  TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = dependencies.project_id AND projects.is_shared = true)
  );

-- Allow public read access to AI messages of shared projects
CREATE POLICY "select_shared_messages" ON ai_messages FOR SELECT
  TO anon, authenticated USING (
    EXISTS (
      SELECT 1 FROM ai_conversations ac
      JOIN projects p ON p.id = ac.project_id
      WHERE ac.id = ai_messages.conversation_id AND p.is_shared = true
    )
  );

-- Allow public read access to ai_conversations of shared projects
CREATE POLICY "select_shared_conversations" ON ai_conversations FOR SELECT
  TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = ai_conversations.project_id AND projects.is_shared = true)
  );
