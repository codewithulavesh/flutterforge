import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Project-scoped skills for the harness agent.
 *
 * DSH discovers skills in `<workspace>/.dsh/skills/<name>/SKILL.md`. We write
 * a small, curated set into every project workspace. They are instructions,
 * not app files, so the workspace snapshot ignores `.dsh` and they never leak
 * into the generated project or the export ZIP.
 */

const MODERN_UI = `---
name: modern-flutter-ui
description: Build a current, professional Flutter interface with Material 3, a real type/spacing system, responsive layouts, and complete screen states.
whenToUse: Use for every screen, theme, navigation shell, form, list, dashboard, or visual polish task.
---

# Modern Flutter UI

## Design system
- Start from one seed color and derive surfaces with \`ColorScheme.fromSeed\`. One accent, neutral surfaces, semantic error/success colors.
- Use a 4/8pt spacing scale. Common values: 4, 8, 12, 16, 24, 32. No random 7/13/19 pixel gaps.
- Type scale: display 32-40, headline 24-28, title 18-20, body 14-16, label 11-12. Use \`Theme.of(context).textTheme\`.
- Radii: 10-16 for cards/inputs, 999 for pills. Keep one radius language.
- Elevation: subtle. Prefer a 1px border + small shadow over heavy blurred shadows.
- Avoid the default Flutter purple counter look, stock gradients, emoji as icons, and oversized shadows.

## Every data screen
Include all four states explicitly:
1. Loading — skeleton/shimmer or centered progress, never a blank white screen.
2. Empty — icon, short explanation, primary action.
3. Error — plain-language message, retry button, no raw exception text.
4. Content — responsive list/grid with sensible max width.

## Layout
- Use \`LayoutBuilder\`/\`MediaQuery\` with breakpoints around 600 (tablet) and 900-1200 (desktop).
- On desktop, center content with a max width (e.g. 1200) and use multi-column layouts; do not stretch a phone layout.
- Respect safe areas and keyboard insets. Text fields must not be hidden by the keyboard.
- Use \`Expanded\`/\`Flexible\` instead of fixed heights where content can grow.

## Interaction and accessibility
- Minimum 48x48 touch targets; visible focus/hover states on desktop.
- Add \`Semantics\` labels to icon-only buttons.
- Support text scaling; avoid hard-coded heights around text.
- Use \`const\` constructors and \`Key\`s for list items.
`;

const ARCHITECTURE = `---
name: flutter-architecture
description: Organize a Flutter app so it stays readable and testable — feature-first folders, clear state ownership, routing, and error boundaries.
whenToUse: Use when creating the project structure, adding a feature, wiring state management, or fixing tangled widget logic.
---

# Flutter Architecture

## Structure
- Feature-first: \`lib/features/<feature>/screens|widgets|models|providers|services\`.
- Shared core: \`lib/core/theme\`, \`lib/core/router\`, \`lib/core/widgets\`, \`lib/core/utils\`.
- One screen per file. One primary public widget per file.
- Keep business logic out of \`build()\`. Put calculations/state transitions in a provider/service/model.

## State
- Use the requested state management consistently (Provider/ChangeNotifier by default).
- One provider per feature; expose immutable state and intention-revealing methods.
- Call \`notifyListeners()\` after state changes, dispose controllers/timers/streams.
- Async work: set loading, catch errors into a user-facing error state, clear loading in \`finally\`.

## Routing
- Use GoRouter for multi-screen apps. Define routes in one file, pass typed parameters, and use \`context.go\`/\`push\` correctly.
- Keep route paths and screen names consistent.

## Correctness
- No \`// TODO\`, no stubs, no dead buttons, no fake analytics, no lorem ipsum.
- Handle null/empty/error paths, not just the happy path.
- Use \`const\` where possible; avoid rebuilding large trees unnecessarily.
- Add at least one widget test for the primary flow when tests are requested or feasible.
`;

const SUPABASE = `---
name: supabase-production
description: Wire Supabase safely for production Flutter apps — auth, RLS, migrations, realtime, storage, and client boundaries.
whenToUse: Use only when the app needs accounts, shared/persisted cloud data, realtime, file storage, or the user explicitly asks for Supabase.
---

# Supabase production rules

- Initialize once in \`main.dart\` with the project URL and anon/publishable key. Never embed a service-role key in Flutter.
- Keep secrets in \`--dart-define\`/AppConstants, not in source or logs.
- Enable RLS on every table that is exposed. Write explicit policies per operation:
  \`select\`, \`insert\`, \`update\`, \`delete\` for \`authenticated\` where appropriate.
- Migrations are idempotent ( \`create table if not exists\`, \`drop policy if exists\` ) and live in \`supabase/migrations/\`.
- Realtime only on tables the UI actually streams; unsubscribe on dispose.
- Storage: separate buckets, policy per bucket, validate MIME/size, do not make private user data public.
- Auth: handle signed-out, session-expired, and unauthenticated states. Never assume a user exists.
- Queries: select only needed columns, handle \`PostgrestException\`, and surface a retry action.
- Do not put SQL/service logic in widgets; use a typed service class.
`;

const DESKTOP = `---
name: desktop-web-parity
description: Keep one Flutter codebase working on macOS, Windows, and web without mobile-only assumptions.
whenToUse: Use when the target includes desktop or web, or when adding platform-specific features, shortcuts, files, or window behavior.
---

# Desktop and web parity

- Guard platform code with \`kIsWeb\`, \`defaultTargetPlatform\`, or \`Platform.isMacOS/isWindows\`.
- Never import \`dart:io\` in code that runs on web without a guarded conditional import.
- Avoid mobile-only plugins for core flows; choose desktop/web-capable packages or provide a fallback.
- Desktop: design for wide windows, hover/focus states, keyboard shortcuts, and a minimum content width. Do not assume touch.
- Web: expect CORS, no local filesystem, and browser storage limits. Use \`shared_preferences\` for small state.
- Use \`Shortcuts\`/\`Actions\` or \`Focus\` for keyboard support in editors/calculators/forms.
- Window sizing: test at 1280x800 and 1024x700; avoid overflow at 800px width.
- Dropdowns/dialogs must fit small and large windows; use scrollable content.
`;

const SKILLS = {
  'modern-flutter-ui': MODERN_UI,
  'flutter-architecture': ARCHITECTURE,
  'desktop-web-parity': DESKTOP,
};

/**
 * Write the project-scoped skill files. Supabase guidance is only installed
 * when the app actually uses a backend.
 * @param {string} workspace
 * @param {boolean} usesSupabase
 * @returns {Promise<string[]>} names written
 */
export async function ensureSkills(workspace, usesSupabase) {
  const skills = usesSupabase ? { ...SKILLS, 'supabase-production': SUPABASE } : SKILLS;
  const written = [];
  for (const [name, body] of Object.entries(skills)) {
    const directory = path.join(workspace, '.dsh', 'skills', name);
    const file = path.join(directory, 'SKILL.md');
    try {
      const current = await fs.readFile(file, 'utf8');
      if (current === body) {
        written.push(name);
        continue;
      }
    } catch {
      // missing
    }
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(file, body, 'utf8');
    written.push(name);
  }
  return Object.keys(skills);
}

/** Names advertised to the model in the task prompt. */
export function skillNames(usesSupabase) {
  return Object.keys(usesSupabase ? { ...SKILLS, 'supabase-production': SUPABASE } : SKILLS);
}

/**
 * Skill guidance with frontmatter stripped, ready to inline into a task
 * prompt. Inlining saves the agent one `skill` tool round-trip per skill,
 * which is often minutes on free-tier models.
 * @param {boolean} usesSupabase
 * @returns {string}
 */
export function inlineSkillGuidance(usesSupabase) {
  const skills = usesSupabase ? { ...SKILLS, 'supabase-production': SUPABASE } : SKILLS;
  return Object.entries(skills)
    .map(([name, body]) => {
      const stripped = body.replace(/^---\n[\s\S]*?\n---\n*/, '').trim();
      return `### ${name}\n\n${stripped}`;
    })
    .join('\n\n');
}
