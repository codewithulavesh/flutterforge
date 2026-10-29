/**
 * Instructions and task prompt for the DeepSeek Harness engine.
 *
 * The engine is a coding agent, not a chat model: the contract is that it
 * writes a complete Flutter project into the workspace with its file tools.
 * The prompt is explicit about that contract because a plain "build an app"
 * request otherwise produces code in the answer instead of files on disk.
 */

import { inlineSkillGuidance } from './skills.mjs';

/**
 * @param {boolean} usesSupabase
 * @returns {string}
 */
export function buildAgentsMd(usesSupabase) {
  const backendSection = usesSupabase
    ? `5. Backend is Supabase: initialize it safely in \`lib/main.dart\`, use
   \`supabase_flutter\`, and never embed a service-role key in the client.
6. Include SQL migrations under \`supabase/migrations/\` with RLS enabled on
   every table and realtime where it helps.`
    : `5. This app is LOCAL ONLY. Do NOT add Supabase, authentication, a
   database, SQL migrations, RLS, or any network service. Persist with
   \`shared_preferences\` (or Hive) only if the app needs saved state.
6. Do not create a \`supabase/\` directory. The only dependency is Flutter (plus
   packages that have no backend requirement).`;

  return `# FlutterForge generated project

This workspace is generated and edited by the FlutterForge harness engine.

## Contract

1. Write every source file with the \`write\` tool (or \`edit\` for a targeted
   change). Never answer with only a code block — the app is assembled from
   files on disk. Minimize round-trips: batch several independent \`write\`
   calls together in a single response instead of one file per response.
2. Use project-relative POSIX paths (\`lib/main.dart\`, \`lib/features/...\`).
   Never pass an absolute path.
3. Generate complete, compilable files. No \`// TODO\`, no stubs, no truncated
   output. Every import must resolve.
4. Keep \`pubspec.yaml\` \`name:\` exactly as specified in the task. Never add a
   dependency named after the app itself. The \`flutter:\` section may contain
   ONLY \`uses-material-design: true\` and \`assets:\` — never \`uses-material3\`
   (Material 3 is enabled from Dart via \`ThemeData(useMaterial3: true)\`),
   \`fonts:\`, or any other invented key. Pin dependencies to real pub.dev
   versions with ^ ranges you are certain exist.
${backendSection}
7. \`lib/main.dart\` must run the app; \`lib/app.dart\` owns Material 3 theming.
   Include loading, error, and empty states for every screen that fetches data.
8. During initial generation, do NOT run shell commands (flutter create, pub get,
   flutter analyze, ls). Write the files directly; the preview compiler and
   repair loop validate them. On a repair turn, use the supplied errors and run
   analysis only when it is genuinely needed.
9. Project skills are installed under .dsh/skills (modern-flutter-ui,
   flutter-architecture, desktop-web-parity, and supabase-production when the
   app uses Supabase) for reference only — every task prompt already inlines
   their guidance, so there is no need to load them with the skill tool.
10. Finish with a short plain-text summary of the files you changed. Do not
   paste entire files into the final answer.

## Desktop targets

The same Flutter codebase targets macOS and Windows. Prefer packages with
desktop support, avoid mobile-only plugins without a documented fallback, and
keep platform-specific code behind \`Platform.isMacOS\` / \`Platform.isWindows\`
guards. Runner folders are added on export with:

\`\`\`bash
flutter create --platforms=macos,windows .
\`\`\`
`;
}

/**
 * Build the one-shot task prompt.
 *
 * @param {object} input
 * @param {string} input.prompt user request
 * @param {string} input.projectName
 * @param {string} [input.appId] exact Dart package name
 * @param {string} [input.projectDescription]
 * @param {string} [input.platform] web | mobile | desktop | macos | windows
 * @param {string} [input.stateManagement]
 * @param {boolean} [input.usesSupabase]
 * @param {string} [input.activeFile]
 * @param {string[]} [input.buildErrors]
 * @param {Array<{ path: string, content?: string }>} [input.files] existing files
 * @param {Array<{ role: string, content: string }>} [input.conversationHistory]
 * @param {boolean} [input.isIncremental]
 * @param {boolean} [input.includeSqlMigrations]
 * @returns {string}
 */
export function buildTaskPrompt(input) {
  const {
    prompt,
    projectName,
    appId = '',
    projectDescription,
    platform = 'web',
    stateManagement = 'provider',
    usesSupabase = false,
    activeFile = '',
    buildErrors = [],
    files = [],
    conversationHistory = [],
    isIncremental = false,
    includeSqlMigrations = true,
  } = input;

  const fileList = files
    .slice(0, 160)
    .map((file) => `- ${file.path}`)
    .join('\n');

  const history = conversationHistory
    .slice(-8)
    .map((message) => `${message.role.toUpperCase()}: ${String(message.content).slice(0, 1200)}`)
    .join('\n\n');

  const backendRules = usesSupabase
    ? `- Supabase is REQUIRED for this app. Initialize it safely in main.dart,
  use supabase_flutter, and never embed a service-role key.
- ${includeSqlMigrations ? 'Include Supabase SQL migrations under `supabase/migrations/` with RLS policies.' : 'Do not create SQL migration files.'}`
    : `- This app is LOCAL ONLY. Do NOT add Supabase, auth, a database, SQL,
  RLS, or any backend service. Persist only with shared_preferences/Hive if
  needed. Do not create a \`supabase/\` directory.`;

  return `You are the FlutterForge generation engine. Work only inside the current workspace and produce a complete Flutter application.

PROJECT
- Name: ${projectName}
- Dart package name (pubspec.yaml \`name:\`): ${appId || '(derive a unique snake_case name)'}
- Description: ${projectDescription || '(not provided)'}
- Platform target: ${platform}
- State management: ${stateManagement}
- Backend: ${usesSupabase ? 'Supabase' : 'none (local only)'}
- Mode: ${isIncremental ? 'incremental edit of the existing project' : 'new project generation'}

USER REQUEST
${prompt}

EXISTING FILES (${files.length})
${fileList || '(empty workspace)'}
${activeFile ? `\nACTIVE FILE (user is viewing): ${activeFile}` : ''}
${buildErrors.length > 0 ? `\nLATEST PREVIEW/BUILD ERRORS (fix these):\n${buildErrors.slice(-8).map((line) => `- ${line}`).join('\n')}` : ''}

${history ? `RECENT CONVERSATION\n${history}\n` : ''}
REQUIREMENTS
0. ${isIncremental ? 'Read the relevant existing files first.' : 'Write `pubspec.yaml`, `lib/main.dart`, and `lib/app.dart` FIRST, then the screens. A complete app is more important than polish.'}
1. This is a ${isIncremental ? 'targeted edit' : 'NEW project'}. ${isIncremental ? 'Preserve working code and change only what the request needs.' : 'Replace the starter with a complete app; delete starter screens that are no longer used.'}
2. Create a runnable, analyzer-clean Flutter app: \`pubspec.yaml\`, \`lib/main.dart\`, \`lib/app.dart\`, theme, screens, widgets, models, and state.
3. Use Material 3, a coherent color system, and responsive layouts. Desktop windows must not look like stretched phones.
4. The app must actually implement the requested features — no placeholder buttons, no "coming soon", no fake data unless the user asked for sample data.
5. Set \`pubspec.yaml\` \`name:\` to exactly \`${appId || projectName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}\`. Every \`package:\` import must use that name.
6. ${backendRules}
7. Write files with the \`write\` tool using project-relative paths. ${isIncremental ? 'Use `edit` for small changes.' : 'Do not run `flutter create`; write the project files directly.'}
8. Do not ask questions and do not wait for approval. Make reasonable decisions and finish the app.
9. Do not delete files unless the request explicitly asks for it (the starter cleanup is handled by the product). Never run rm -rf lib or remove the feature directory you are building.
10. Design like a senior product designer: an 8pt spacing grid, one clear accent, consistent radii, accessible contrast, and responsive breakpoints. Do not ship the default Flutter purple counter look.
11. Every visible control must work. No dead buttons, no "coming soon", no fake analytics, no lorem ipsum.
12. Minimize round-trips: batch multiple independent \`write\` calls into a single response whenever the files do not depend on each other; never spend one response per file when several are ready. On an incremental edit, read only the 1-3 files you must change — do not re-read files you already know.
13. Final answer: a 3-6 line summary of what changed. No code blocks.

SKILL GUIDELINES (pre-loaded — follow these; do not call the skill tool)

${inlineSkillGuidance(usesSupabase)}

Start now.`;
}
