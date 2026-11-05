/**
 * In-memory provider credentials for the local engine.
 */

const PROVIDERS = new Set(['openrouter', 'deepseek']);
const MAX_KEY_LENGTH = 300;

export type Provider = 'openrouter' | 'deepseek';

interface CredentialEntry {
  key: string;
  source: string;
  updatedAt: string;
}

const credentials: Record<Provider, CredentialEntry | null> = { openrouter: null, deepseek: null };

export function isProvider(value: unknown): value is Provider {
  return typeof value === 'string' && PROVIDERS.has(value);
}

function normalizeKey(key: string): string {
  const trimmed = String(key ?? '').trim();
  if (trimmed.length < 8 || trimmed.length > MAX_KEY_LENGTH) {
    throw Object.assign(new Error('API keys must be 8–300 characters.'), { statusCode: 400 });
  }
  if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) {
    throw Object.assign(new Error('API keys may only contain letters, digits, dots, dashes, and underscores.'), { statusCode: 400 });
  }
  return trimmed;
}

function maskKey(key: string): string {
  if (key.length <= 12) return '••••••••';
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

export function setCredential(provider: Provider, key: string, source: 'env' | 'vault' | 'session' = 'session') {
  if (!isProvider(provider)) {
    throw Object.assign(new Error('Unknown credential provider.'), { statusCode: 400 });
  }
  credentials[provider] = {
    key: normalizeKey(key),
    source,
    updatedAt: new Date().toISOString(),
  };
  return credentialSnapshot()[provider];
}

export function removeCredential(provider: Provider): void {
  if (!isProvider(provider)) {
    throw Object.assign(new Error('Unknown credential provider.'), { statusCode: 400 });
  }
  credentials[provider] = null;
}

export function getCredential(provider: Provider): string {
  return credentials[provider]?.key ?? '';
}

/** Raw keys for the router only. Never serialized to a response. */
export function getCredentialBundle(): { openrouter: string; deepseek: string } {
  return { openrouter: getCredential('openrouter'), deepseek: getCredential('deepseek') };
}

export function credentialSnapshot() {
  const describe = (provider: Provider) => {
    const entry = credentials[provider];
    return entry
      ? { configured: true, masked: maskKey(entry.key), source: entry.source, updatedAt: entry.updatedAt }
      : { configured: false, masked: null, source: null, updatedAt: null };
  };
  return { openrouter: describe('openrouter'), deepseek: describe('deepseek') };
}

/** Seed from the environment once at startup. Env keys are deployment-owned. */
export function seedCredentialsFromEnv(env: NodeJS.ProcessEnv = process.env): void {
  for (const provider of PROVIDERS as Set<Provider>) {
    const key = provider === 'openrouter'
      ? (env.OPENROUTER_API_KEY || env.VITE_OPENROUTER_API_KEY || (env.VITE_OPENROUTER_API_KEYS ? env.VITE_OPENROUTER_API_KEYS.split(',')[0].trim() : ''))
      : (env.DEEPSEEK_API_KEY || env.VITE_DEEPSEEK_API_KEY);
    if (key && !credentials[provider]) {
      try {
        setCredential(provider, key, 'env');
      } catch {
        // A malformed env key should not prevent the engine from booting.
      }
    }
  }
}

