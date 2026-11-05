import { create } from 'zustand';

export type PublishTarget = 'web' | 'pwa' | 'android' | 'macos' | 'windows';

interface PublishArtifact {
  kind: 'file' | 'directory';
  name: string;
  bytes: number;
  entries: number;
}

export interface PublishReport {
  target: PublishTarget;
  label: string;
  status: 'succeeded' | 'failed';
  startedAt: string;
  durationMs: number;
  fileCount: number;
  analyzer?: { skipped: boolean; summary: string; errors: number; warnings: number };
  artifact?: PublishArtifact;
  publicPath?: string | null;
  notes: string[];
  error?: string;
}

export interface PublishStatus {
  status: 'none' | 'building' | 'succeeded' | 'failed';
  target?: PublishTarget;
  label?: string;
  startedAt?: number;
  durationMs?: number | null;
  error?: string | null;
  report?: PublishReport | null;
  logs?: string[];
}

interface PublishState {
  jobs: Record<string, PublishStatus>;
  starting: boolean;
  publish: (
    projectId: string,
    files: Array<{ path: string; content: string | null; is_directory?: boolean }>,
    target: PublishTarget,
    opts?: { supabaseUrl?: string; supabaseAnonKey?: string },
  ) => Promise<void>;
  refresh: (projectId: string) => Promise<PublishStatus | null>;
  reset: (projectId: string) => void;
}

const API_BASE = (typeof window !== 'undefined' && window.flutterforgeDesktop?.isDesktop
  ? ''
  : import.meta.env.VITE_PREVIEW_API_URL || '').replace(/\/+$/, '');

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error('The local engine did not respond. Start it with npm run server.');
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`The local engine returned an unreadable response (HTTP ${res.status}).`);
  }
}

export const usePublishStore = create<PublishState>((set, get) => ({
  jobs: {},
  starting: false,

  publish: async (projectId, files, target, opts) => {
    set({ starting: true });
    try {
      const filtered = files
        .filter((file) => !file.is_directory && !file.path.endsWith('/') && file.content !== null)
        .map((file) => ({ path: file.path, content: file.content || '' }));
      const res = await fetch(`${API_BASE}/api/publish/${projectId}/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: filtered,
          target,
          supabaseUrl: opts?.supabaseUrl || import.meta.env.VITE_SUPABASE_URL,
          supabaseAnonKey: opts?.supabaseAnonKey || import.meta.env.VITE_SUPABASE_ANON_KEY,
        }),
      });
      const data = await readJson<{ error?: string; status?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Publish failed to start.');
      set((state) => ({
        starting: false,
        jobs: { ...state.jobs, [projectId]: { status: 'building', target, logs: ['Reading the project…'] } },
      }));

      let failures = 0;
      const poll = async () => {
        try {
          const next = await get().refresh(projectId);
          failures = 0;
          if (next?.status === 'building') {
            setTimeout(poll, 1200);
          }
        } catch {
          failures += 1;
          if (failures < 15) setTimeout(poll, 1800);
        }
      };
      setTimeout(poll, 800);
    } catch (error) {
      set((state) => ({
        starting: false,
        jobs: {
          ...state.jobs,
          [projectId]: {
            status: 'failed',
            target,
            error: error instanceof Error ? error.message : String(error),
            logs: [],
          },
        },
      }));
    }
  },

  refresh: async (projectId) => {
    const res = await fetch(`${API_BASE}/api/publish/project/${projectId}/status`);
    if (!res.ok) throw new Error(`Publish status failed (HTTP ${res.status}).`);
    const data = await readJson<PublishStatus>(res);
    if (!data || data.status === 'none') return null;
    set((state) => ({ jobs: { ...state.jobs, [projectId]: data } }));
    return data;
  },

  reset: (projectId) =>
    set((state) => {
      const jobs = { ...state.jobs };
      delete jobs[projectId];
      return { jobs };
    }),
}));
