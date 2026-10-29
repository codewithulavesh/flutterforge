/**
 * Chat intent classification for the AI Builder.
 *
 * Every message used to run the full Flutter generation pipeline — so a
 * simple "what is Supabase?" triggered file generation, version checkpoints
 * and preview rebuilds instead of an answer. This classifier routes
 * conversational messages to a lightweight chat reply and keeps code
 * generation for actual build/edit requests.
 *
 * Bias is deliberately conservative: anything that smells like a change to
 * the app is a `build`. Only clearly conversational messages are `chat`.
 */

export type ChatIntent = 'chat' | 'build';

/** Whole-message conversational patterns — never code changes. */
const CHAT_ONLY_PATTERNS: RegExp[] = [
  /^(hi|hii+|hello|hey|yo|hola|namaste|good\s?(morning|afternoon|evening|day))\b[.!?]*$/i,
  /^(thanks?|thank\s?you|thx|dhanyavaad|shukriya)[.!?]*$/i,
  /^(bye|goodbye|see\s?you|good\s?night)[.!?]*$/i,
  /^(ok|okay|cool|nice|great|awesome|perfect|got\s?it|understood|sure|haan|haanji)\b[.!?]*$/i,
  /^(who\sare\syou|what\sare\syou|what\scan\syou\sdo|how\sdo\syou\swork|help|help\sme|what\sis\sthis(\sapp)?)\??$/i,
];

/** "How do I...?" — how-to questions are answered, not generated. */
const HOW_TO_PATTERN: RegExp =
  /\bhow\s+(do\s+i|do|can\s+i|to|should\s+i|would\s+i|do\s+you)\b/i;

/** Strong verbs/mutations — almost always a change to the app. */
const STRONG_BUILD: RegExp = new RegExp(
  [
    'add', 'creat', 'generat', 'implement', 'scaffold', 'change', 'updat',
    'modif', 'edit', 'adjust', 'tweak', 'improv', 'enhanc', 'remov', 'delet',
    'fix', 'repair', 'refactor', 'renam', 'redesign', 'restyl', 'rework',
    'replac', 'revert', 'restor', 'migrat', 'deploy', 'publish', 'releas',
    'resolv', 'check', 'examin', 'review', 'inspect', 'verif', 'verifi',
    'try',
    'not\\sworking', 'doesn.?t\\swork', 'isn.?t\\sworking',
    'won.?t\\swork', 'doesn.?t\\sload',
  ].join('|'),
  'i',
);

/** App-domain nouns/trouble words — a change when stated, not when asked. */
const WEAK_BUILD: RegExp = new RegExp(
  [
    'make', 'build', 'design', 'screen', 'page', 'widget', 'button', 'layout',
    'feature', 'auth', 'login', 'logout', 'signup', 'sign\\s?up', 'sign\\s?in',
    'onboard', 'splash', 'profil', 'setting', 'theme', 'dark', 'light',
    'chart', 'graph', 'list', 'grid', 'form', 'navigat', 'rout', 'drawer',
    'tab', 'dialog', 'modal', 'sheet', 'snackbar', 'toast', 'appbar',
    'search', 'filter', 'sort', 'cart', 'checkout', 'payment', 'stripe',
    'order', 'product', 'categor', 'notif', 'upload', 'image', 'photo',
    'avatar', 'map', 'location', 'chat', 'message', 'comment', 'post',
    'feed', 'color', 'colour', 'font', 'icon', 'logo', 'card', 'badge',
    'animat', 'transition', 'gradient', 'dashboard', 'supabase', 'firebase',
    'database', 'sql', 'table', 'schema', 'rls', 'realtime', 'stream',
    'api', 'backend', 'model', 'service', 'provider', 'riverpod', 'bloc',
    'dependenc', 'package', 'pubspec', 'error', 'bug', 'crash', 'broken',
    'fail', 'issue', 'problem', 'wrong', 'debug', 'test',
  ].join('|'),
  'i',
);

/** Question openers — conversational unless a strong verb is present. */
const QUESTION_OPENER: RegExp =
  /^(what|why|how|when|where|which|who|whom|whose|explain|tell|describe|define|is|are|was|were|do|does|did|can|could|would|should|will)\b/i;

/**
 * Trouble signals — the app is broken/stuck/blank. Even phrased as a
 * question ("why is login broken?", "white screen in preview?") the user
 * wants the agent to investigate and fix, not to chit-chat. Checked before
 * the question-opener rule so bug reports always reach the pipeline.
 */
const TROUBLE: RegExp = new RegExp(
  [
    'fail', 'error', 'bug', 'crash', 'broken', 'wrong', 'issue', 'problem',
    'not\\sworking', 'doesn.?t\\swork', 'isn.?t\\sworking', 'won.?t\\swork',
    'doesn.?t\\sload', 'stuck', 'blank', 'white\\sscreen', 'empty\\sscreen',
    'nothing\\s(shows|renders|loads|works|happens)', 'debug',
  ].join('|'),
  'i',
);

export function classifyChatIntent(rawContent: string): ChatIntent {
  const content = (rawContent || '').trim();
  if (!content) return 'chat';
  if (content.length > 600) return 'build'; // pasted spec / long brief

  const lower = content
    .toLowerCase()
    .replace(/\s+/g, ' ')
    // Leading pleasantries don't change intent ("hi, add login" is a build).
    .replace(/^(please[, ]+|hi[, ]+|hello[, ]+|hey[, ]+|thanks?[, ]+)+/, '')
    .trim();

  if (CHAT_ONLY_PATTERNS.some((re) => re.test(lower))) return 'chat';
  if (HOW_TO_PATTERN.test(lower)) return 'chat';
  if (STRONG_BUILD.test(lower)) return 'build';
  // "How about dark mode?" proposes a change — build it.
  if (/^how\s+about\b/i.test(lower) && WEAK_BUILD.test(lower)) return 'build';
  // Broken app reports ("why is login failing?", "white screen?") want a fix,
  // even when phrased as questions.
  if (TROUBLE.test(lower)) return 'build';
  if (lower.endsWith('?') || QUESTION_OPENER.test(lower)) return 'chat';
  if (WEAK_BUILD.test(lower)) return 'build';

  // Plain statement with no build signals ("looks good", "hmm", "nope"):
  // acknowledge conversationally instead of regenerating the whole app.
  return 'chat';
}
