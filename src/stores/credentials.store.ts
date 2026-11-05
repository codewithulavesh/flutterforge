import { create } from 'zustand';
import { keyPool } from '@/agent/keyPool';

export type CredentialProvider = 'openrouter' | 'deepseek';

export interface ProviderCredentialStatus {
  configured: boolean;
  masked: string | null;
  updatedAt: string | null;
  source: string | null;
}

export interface CredentialsStatus {
  storage: 'os-encrypted' | 'plaintext-file' | 'session';
  credentials: Record<CredentialProvider, ProviderCredentialStatus>;
}

const EMPTY: ProviderCredentialStatus = { configured: false, masked: null, updatedAt: null, source: null };

interface CredentialsState {
  status: CredentialsStatus | null;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  saveKey: (provider: CredentialProvider, key: string) => Promise<boolean>;
  removeKey: (provider: CredentialProvider) => Promise<boolean>;
  hasOpenRouterKey: () => boolean;
  clearError: () => void;
}

function normalize(status: {
  storage?: CredentialsStatus['storage'];
  credentials?: Partial<Record<CredentialProvider, ProviderCredentialStatus>>;
}): CredentialsStatus {
  return {
    storage: status.storage ?? 'session',
    credentials: {
      openrouter: status.credentials?.openrouter ?? EMPTY,
      deepseek: status.credentials?.deepseek ?? EMPTY,
    },
  };
}

async function engineStatus(): Promise<CredentialsStatus> {
  const response = await fetch('/api/credentials', { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`The local engine returned HTTP ${response.status}.`);
  const payload = await response.json() as { credentials?: Partial<Record<CredentialProvider, ProviderCredentialStatus>> };
  return normalize({ credentials: payload.credentials, storage: 'session' });
}

export const useCredentialsStore = create<CredentialsState>((set, get) => ({
  status: null,
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const engine = await engineStatus();
      let storage: CredentialsStatus['storage'] = engine.storage;
      const credentials = { ...engine.credentials };
      const bridge = typeof window !== 'undefined' ? window.flutterforgeDesktop : undefined;
      if (bridge?.isDesktop) {
        const vault = await bridge.vault.status();
        if (vault.ok) {
          storage = vault.storage ?? storage;
          for (const provider of ['openrouter', 'deepseek'] as const) {
            const vaultEntry = vault.credentials?.[provider];
            if (vaultEntry?.configured) credentials[provider] = vaultEntry;
          }
        }
      }
      set({ status: { storage, credentials }, loading: false });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Could not read the key configuration.',
      });
    }
  },

  saveKey: async (provider, key) => {
    set({ loading: true, error: null });
    try {
      if (provider === 'openrouter') {
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('openrouter_api_key', key);
          }
          keyPool.addKey(key);
        } catch {
          // ignore storage error
        }
      }
      const bridge = typeof window !== 'undefined' ? window.flutterforgeDesktop : undefined;
      if (bridge?.isDesktop) {
        const result = await bridge.vault.setKey(provider, key);
        if (!result.ok) throw new Error(result.error ?? 'Could not store the key.');
        await get().load();
        return true;
      }
      const response = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, key }),
        signal: AbortSignal.timeout(5000),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? `Could not store the key (HTTP ${response.status}).`);
      await get().load();
      return true;
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'Could not store the key.' });
      return false;
    }
  },

  removeKey: async (provider) => {
    set({ loading: true, error: null });
    try {
      if (provider === 'openrouter') {
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('openrouter_api_key');
            localStorage.removeItem('openrouter_key');
            localStorage.removeItem('ff_openrouter_key');
          }
        } catch {
          // ignore
        }
      }
      const bridge = typeof window !== 'undefined' ? window.flutterforgeDesktop : undefined;
      if (bridge?.isDesktop) {
        const result = await bridge.vault.removeKey(provider);
        if (!result.ok) throw new Error(result.error ?? 'Could not remove the key.');
        await get().load();
        return true;
      }
      const response = await fetch(`/api/credentials/${provider}`, { method: 'DELETE', signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`Could not remove the key (HTTP ${response.status}).`);
      await get().load();
      return true;
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'Could not remove the key.' });
      return false;
    }
  },

  hasOpenRouterKey: () => Boolean(get().status?.credentials.openrouter.configured),

  clearError: () => set({ error: null }),
}));
