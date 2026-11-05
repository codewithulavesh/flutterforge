/**
 * Model routing policy shared by the renderer.
 *
 * Planning, design, and the first code pass get the frontier model; routine
 * edits, repairs, and chat use the cheaper fast model. Frontier access needs
 * a Pro/Team plan or the user's own OpenRouter key. The local engine applies
 * the same policy server-side, so a spoofed preference cannot bypass it.
 */

export type ModelPreference = 'auto' | 'fast' | 'quality';
export type ModelRole = 'frontier' | 'economy';

export const FRONTIER_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';
export const ECONOMY_MODEL = 'nvidia/nemotron-3.5-lightning:free';
export const MANAGED_MODEL = 'deepseek-flash';

const ENTITLED_PLANS = new Set(['pro', 'team']);

export function isFrontierEntitled(plan: string | null | undefined, hasByok: boolean): boolean {
  return hasByok || ENTITLED_PLANS.has((plan ?? 'free').toLowerCase());
}

export function roleForTask(input: {
  preference: ModelPreference;
  isInitialGeneration: boolean;
  isRepair?: boolean;
}): ModelRole {
  if (input.preference === 'quality') return 'frontier';
  if (input.preference === 'fast') return 'economy';
  return input.isInitialGeneration && !input.isRepair ? 'frontier' : 'economy';
}

export interface ModelChoiceInput {
  preference: ModelPreference;
  isInitialGeneration: boolean;
  isRepair?: boolean;
  plan?: string | null;
  hasByok: boolean;
}

export interface ModelChoice {
  role: ModelRole;
  requestedRole: ModelRole;
  model: string;
  entitled: boolean;
  downgraded: boolean;
  reason: string;
}

export function resolveModelChoice(input: ModelChoiceInput): ModelChoice {
  const requestedRole = roleForTask(input);
  const entitled = isFrontierEntitled(input.plan, input.hasByok);
  const downgraded = requestedRole === 'frontier' && !entitled;
  const role = downgraded ? 'economy' : requestedRole;
  const reason = downgraded
    ? 'Frontier models need Pro or your own key — using the fast model.'
    : role === 'frontier'
      ? 'Frontier model for planning, design, and the first code pass.'
      : 'Fast model for routine edits and repairs.';
  return {
    role,
    requestedRole,
    model: role === 'frontier' ? FRONTIER_MODEL : ECONOMY_MODEL,
    entitled,
    downgraded,
    reason,
  };
}
