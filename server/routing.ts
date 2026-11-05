/**
 * Server-authoritative generation routing.
 *
 * The renderer proposes a role (frontier for first-pass work, economy for
 * routine edits) and a plan; this module decides the provider and model from
 * the credentials that actually exist on this machine. A spoofed preference
 * can request the frontier model but cannot conjure a key for it.
 */

export const FRONTIER_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';
export const ECONOMY_MODEL = 'nvidia/nemotron-3.5-lightning:free';
export const MANAGED_MODEL = 'deepseek-flash';

const ENTITLED_PLANS = new Set<string>(['pro', 'team']);

export type GenerationRole = 'frontier' | 'economy';
export type ProviderType = 'openrouter' | 'deepseek-official' | 'deepseek-account';
export type KeySource = 'request' | 'stored' | 'managed';

export interface RouteGenerationInput {
  role?: string;
  plan?: string;
  requestedModel?: string;
  requestKey?: string;
  credentials?: { openrouter?: string; deepseek?: string };
}

export interface GenerationRoute {
  requestedRole: GenerationRole;
  role: GenerationRole;
  entitled: boolean;
  provider: ProviderType;
  model: string;
  apiKey: string;
  keySource: KeySource;
  downgraded: boolean;
  reason: string;
}

export interface PublicRoute {
  requestedRole: GenerationRole;
  role: GenerationRole;
  entitled: boolean;
  provider: ProviderType;
  model: string;
  keySource: KeySource;
  downgraded: boolean;
  reason: string;
}

export function normalizeRole(role: unknown): GenerationRole {
  return role === 'frontier' ? 'frontier' : 'economy';
}

function sanitizeModel(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 160) return '';
  if (!/^[A-Za-z0-9._:/+-]+$/.test(trimmed)) return '';
  return trimmed;
}

export function routeGeneration(input: RouteGenerationInput = {}): GenerationRoute {
  const requestedRole = normalizeRole(input.role);
  const plan = typeof input.plan === 'string' ? input.plan.toLowerCase() : 'free';
  const requestKey = typeof input.requestKey === 'string' ? input.requestKey.trim() : '';
  const requestedModel = sanitizeModel(input.requestedModel);
  const openrouterKey = typeof input.credentials?.openrouter === 'string' ? input.credentials.openrouter.trim() : '';
  const deepseekKey = typeof input.credentials?.deepseek === 'string' ? input.credentials.deepseek.trim() : '';

  const requestIsOpenRouter = requestKey.startsWith('sk-or-');
  const entitled = ENTITLED_PLANS.has(plan) || requestIsOpenRouter || Boolean(openrouterKey);
  const role: GenerationRole = requestedRole === 'frontier' && !entitled ? 'economy' : requestedRole;

  const finish = (provider: ProviderType, model: string, apiKey: string, keySource: KeySource): GenerationRoute => {
    const downgraded = role !== requestedRole;
    return {
      requestedRole,
      role,
      entitled,
      provider,
      model,
      apiKey,
      keySource,
      downgraded,
      reason: downgraded
        ? 'Frontier models need Pro or your own OpenRouter key — using the fast model.'
        : role === 'frontier'
          ? 'Frontier model for planning, design, and the first code pass.'
          : 'Fast model for routine edits and repairs.',
    };
  };

  if (requestKey) {
    if (requestIsOpenRouter) {
      return finish('openrouter', requestedModel || (role === 'frontier' ? FRONTIER_MODEL : ECONOMY_MODEL), requestKey, 'request');
    }
    return finish('deepseek-official', requestedModel || MANAGED_MODEL, requestKey, 'request');
  }

  if (openrouterKey) {
    return finish('openrouter', requestedModel || (role === 'frontier' ? FRONTIER_MODEL : ECONOMY_MODEL), openrouterKey, 'stored');
  }

  if (deepseekKey) {
    // The native DeepSeek route has one usable model here, so frontier work is
    // downgraded honestly instead of pretending the model changed.
    return {
      requestedRole,
      role: 'economy',
      entitled: false,
      provider: 'deepseek-official',
      model: requestedModel && !requestedModel.includes('/') ? requestedModel : MANAGED_MODEL,
      apiKey: deepseekKey,
      keySource: 'stored',
      downgraded: requestedRole === 'frontier',
      reason: requestedRole === 'frontier'
        ? 'Frontier models need Pro or your own OpenRouter key — using the DeepSeek account model.'
        : 'Fast model for routine edits and repairs.',
    };
  }

  return {
    requestedRole,
    role: 'economy',
    entitled: false,
    provider: 'deepseek-account',
    model: MANAGED_MODEL,
    apiKey: '',
    keySource: 'managed',
    downgraded: requestedRole === 'frontier',
    reason: requestedRole === 'frontier'
      ? 'No frontier key is configured — using the signed-in DeepSeek account. Add an OpenRouter key or upgrade to Pro for frontier models.'
      : 'Fast model for routine edits and repairs.',
  };
}

/** Strip the secret before sending a route to the renderer or logs. */
export function publicRoute(route: GenerationRoute): PublicRoute {
  return {
    requestedRole: route.requestedRole,
    role: route.role,
    entitled: route.entitled,
    provider: route.provider,
    model: route.model,
    keySource: route.keySource,
    downgraded: route.downgraded,
    reason: route.reason,
  };
}
