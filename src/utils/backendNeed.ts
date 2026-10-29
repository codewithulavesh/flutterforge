/**
 * Decide whether a request actually needs Supabase.
 *
 * The product default is local-first: a calculator, timer, drawing app or
 * offline tracker should not inherit auth screens, SQL migrations or a
 * service layer. Supabase is added only when the user asks for it or the app
 * fundamentally needs accounts, shared/persisted cloud data, or realtime.
 */
const EXPLICIT_NO = /\b(?:no|without|don't|dont|skip|avoid|remove)\s+(?:a\s+|any\s+)?(?:supabase|backend|database|auth|login|server|cloud)\b/i;

const EXPLICIT_YES = /\b(?:supabase|auth|authentication|login|sign[\s-]?up|sign[\s-]?in|register|user\s+accounts?|accounts?|database|backend|cloud|sync|realtime|row\s+level\s+security|rls|multi[\s-]?user|profiles?|orders?|cart|checkout|payments?|subscriptions?|inventory|catalog|products?|booking|reservation|messages?|chat|conversations?|posts?|comments?|feed|social|friends?|followers?|leaderboard|notifications?|upload|file\s+storage|e[\s-]?commerce|marketplace|storefront|shop|store)\b/i;

const LOCAL_OVERRIDE = /\b(?:offline|local[\s-]?only|no\s+backend|without\s+backend|device[\s-]?only)\b/i;

/**
 * @param {string} text user prompt + project description
 * @returns {boolean}
 */
export function isExplicitLocalOnly(text: string): boolean {
  const value = String(text ?? '');
  return EXPLICIT_NO.test(value) || LOCAL_OVERRIDE.test(value);
}

export function detectSupabaseNeed(text: string): boolean {
  const value = String(text ?? '');
  if (!value.trim()) return false;
  if (isExplicitLocalOnly(value)) return false;
  return EXPLICIT_YES.test(value);
}
