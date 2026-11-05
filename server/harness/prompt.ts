/**
 * Instructions and task prompt for the DeepSeek Harness engine.
 */

import { inlineSkillGuidance } from './skills.js';
import { renderDesignBrief, type DesignBrief } from './design.js';

export function buildAgentsMd(usesSupabase: boolean, designBrief: DesignBrief | null = null): string {
  const backendSection = usesSupabase
    ? `5. Backend is Supabase: initialize it safely in \`lib/main.dart\`, use \`supabase_flutter\`, and never embed a service-role key in the client.
6. Include SQL migrations under \`supabase/migrations/\` with RLS enabled on every table and realtime where it helps.`
    : `5. This app is LOCAL ONLY. Do NOT add Supabase, authentication, a database, SQL migrations, RLS, or any network service.
6. Do not create a \`supabase/\` directory. The only dependency is Flutter (plus packages that have no backend requirement).`;

  return `# FlutterForge generated project

This workspace is generated and edited by the FlutterForge harness engine.

## Contract

1. Write every source file with the \`write\` tool (or \`edit\` for a targeted change). Never answer with only a code block.
2. Use project-relative POSIX paths (\`lib/main.dart\`, \`lib/features/...\`). Never pass an absolute path.
3. Generate complete, compilable files. No \`// TODO\`, no stubs, no truncated output. Every import must resolve.
4. Keep \`pubspec.yaml\` \`name:\` exactly as specified in the task. Pin dependencies to real pub.dev versions with ^ ranges.
${backendSection}
7. \`lib/main.dart\` must run the app; \`lib/app.dart\` owns Material 3 theming. Include loading, error, and empty states.
8. During initial generation, do NOT run shell commands. Write the files directly.
9. Project skills are installed under .dsh/skills for reference only.
10. Finish with a short plain-text summary of the files you changed.

## Desktop targets

The same Flutter codebase targets macOS and Windows. Prefer packages with desktop support.

\`\`\`bash
flutter create --platforms=macos,windows .
\`\`\`
${designBrief ? `\n## Design contract\n\n${renderDesignBrief(designBrief)}\n` : ''}
`;
}

interface TaskPromptInput {
  prompt: string;
  projectName: string;
  appId?: string;
  projectDescription?: string;
  platform?: string;
  stateManagement?: string;
  usesSupabase?: boolean;
  activeFile?: string;
  buildErrors?: string[];
  files?: Array<{ path: string; content?: string }>;
  conversationHistory?: Array<{ role: string; content: string }>;
  isIncremental?: boolean;
  includeSqlMigrations?: boolean;
  designBrief?: DesignBrief | null;
}

export function buildTaskPrompt(input: TaskPromptInput): string {
  const {
    prompt, projectName, appId = '', projectDescription,
    platform = 'web', stateManagement = 'provider', usesSupabase = false,
    activeFile = '', buildErrors = [], files = [], conversationHistory = [],
    isIncremental = false, includeSqlMigrations = true, designBrief = null,
  } = input;

  const fileList = files.slice(0, 160).map((f) => `- ${f.path}`).join('\n');
  const history = conversationHistory.slice(-8)
    .map((m) => `${m.role.toUpperCase()}: ${String(m.content).slice(0, 1200)}`).join('\n\n');

  const backendRules = usesSupabase
    ? `- Supabase is REQUIRED. Initialize it safely in main.dart, use supabase_flutter, never embed a service-role key.
- ${includeSqlMigrations ? 'Include Supabase SQL migrations under `supabase/migrations/` with RLS policies.' : 'Do not create SQL migration files.'}`
    : `- This app is LOCAL ONLY. Do NOT add Supabase, auth, a database, SQL, RLS, or any backend service. Do not create a \`supabase/\` directory.`;

  return `You are the FlutterForge generation engine. Work only inside the current workspace and produce a complete Flutter application.

PROJECT
- Name: ${projectName}
- Dart package name (pubspec.yaml \`name:\`): ${appId || '(derive a unique snake_case name)'}
- Description: ${projectDescription || '(not provided)'}
- Platform target: ${platform}
- State management: ${stateManagement}
- Backend: ${usesSupabase ? 'Supabase' : 'none (local only)'}
- Mode: ${isIncremental ? 'incremental edit of the existing project' : 'new project generation'}

${designBrief ? `${renderDesignBrief(designBrief)}\n` : ''}
USER REQUEST
${prompt}

EXISTING FILES (${files.length})
${fileList || '(empty workspace)'}
${activeFile ? `\nACTIVE FILE (user is viewing): ${activeFile}` : ''}
${buildErrors.length > 0 ? `\nLATEST PREVIEW/BUILD ERRORS (fix these):\n${buildErrors.slice(-8).map((l) => `- ${l}`).join('\n')}` : ''}

${history ? `RECENT CONVERSATION\n${history}\n` : ''}
REQUIREMENTS
0. ${isIncremental ? 'Read the relevant existing files first.' : 'Write `pubspec.yaml`, `lib/main.dart`, and `lib/app.dart` FIRST, then the screens.'}
1. Create a runnable, analyzer-clean Flutter app: \`pubspec.yaml\`, \`lib/main.dart\`, \`lib/app.dart\`, theme, screens, widgets, models, and state.
2. Use Material 3, a coherent color system, and responsive layouts.
3. Set \`pubspec.yaml\` \`name:\` to exactly \`${appId || projectName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}\`.
4. ${backendRules}
5. Write files with the \`write\` tool using project-relative paths.
6. Every visible control must work. No dead buttons, no "coming soon", no lorem ipsum.

SKILL GUIDELINES (pre-loaded — follow these; do not call the skill tool)

${inlineSkillGuidance(usesSupabase)}

Start now.`;
}

