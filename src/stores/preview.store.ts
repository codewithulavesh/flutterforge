import { create } from 'zustand';

type PreviewStatus = 'idle' | 'queued' | 'building' | 'running' | 'failed' | 'stopped';

interface PreviewSession {
  sessionId: string;
  projectId: string;
  status: PreviewStatus;
  url: string | null;
  publicUrl: string | null;
  port: number | null;
  logs: string[];
  createdAt: number;
}

interface PreviewState {
  sessions: Record<string, PreviewSession>; // projectId -> session
  currentSessionId: string | null;
  isLoading: boolean;
  error: string | null;

  // Derived
  getSession: (projectId: string) => PreviewSession | null;
  getStatus: (projectId: string) => PreviewStatus;

  // Actions
  build: (projectId: string, files: Array<{ path: string; content: string | null }>, opts?: { supabaseUrl?: string; supabaseAnonKey?: string; }) => Promise<string>;
  pollStatus: (sessionId: string) => Promise<PreviewSession | null>;
  stop: (sessionId: string) => Promise<void>;
  clearError: () => void;
}

const API_BASE = import.meta.env.VITE_PREVIEW_API_URL || 'http://localhost:3001';

export const usePreviewStore = create<PreviewState>((set, get) => ({
  sessions: {},
  currentSessionId: null,
  isLoading: false,
  error: null,

  getSession: (projectId) => get().sessions[projectId] || null,
  getStatus: (projectId) => get().sessions[projectId]?.status || 'idle',

  build: async (projectId, files, opts) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/preview/${projectId}/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: files.filter(f => !f.path.endsWith('/')).map(f => ({ path: f.path, content: f.content || '' })),
          userId: projectId, // replace with auth user id when available
          supabaseUrl: opts?.supabaseUrl || import.meta.env.VITE_SUPABASE_URL,
          supabaseAnonKey: opts?.supabaseAnonKey || import.meta.env.VITE_SUPABASE_ANON_KEY,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Build failed to queue');

      const sessionId: string = data.sessionId;
      const session: PreviewSession = {
        sessionId,
        projectId,
        status: 'queued',
        url: null,
        publicUrl: null,
        port: null,
        logs: ['Queued...'],
        createdAt: Date.now(),
      };
      set((s) => ({ sessions: { ...s.sessions, [projectId]: session }, currentSessionId: sessionId, isLoading: false }));

      // Start polling
      const poll = async () => {
        const status = await get().pollStatus(sessionId);
        if (status && (status.status === 'queued' || status.status === 'building')) {
          setTimeout(poll, 1500);
        }
      };
      setTimeout(poll, 1000);

      return sessionId;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ error: msg, isLoading: false });
      throw e;
    }
  },

  pollStatus: async (sessionId) => {
    try {
      const res = await fetch(`${API_BASE}/api/preview/${sessionId}/status`);
      if (!res.ok) return null;
      const data = await res.json();
      // Find projectId for this session
      const state = get();
      let projectId: string | null = null;
      for (const [pid, sess] of Object.entries(state.sessions)) {
        if (sess.sessionId === sessionId) { projectId = pid; break; }
      }
      if (!projectId) return null;

      const updated: PreviewSession = {
        sessionId: data.sessionId,
        projectId,
        status: data.status,
        url: data.url ? `${API_BASE}${data.url}` : null,
        publicUrl: data.publicUrl ? `${API_BASE}${data.publicUrl}` : null,
        port: data.port,
        logs: data.logs || [],
        createdAt: data.createdAt,
      };
      set((s) => ({ sessions: { ...s.sessions, [projectId!]: updated } }));
      return updated;
    } catch {
      return null;
    }
  },

  stop: async (sessionId) => {
    try {
      await fetch(`${API_BASE}/api/preview/${sessionId}/stop`, { method: 'POST' });
      const state = get();
      for (const [pid, sess] of Object.entries(state.sessions)) {
        if (sess.sessionId === sessionId) {
          const next = { ...sess, status: 'stopped' as const, url: null };
          set((s) => ({ sessions: { ...s.sessions, [pid]: next } }));
          break;
        }
      }
    } catch {}
  },

  clearError: () => set({ error: null }),
}));

// Hook for WS log streaming (used by TerminalPanel / BuildOutputPanel)
export function connectPreviewLogs(sessionId: string, onLog: (line: string) => void, onHistory?: (logs: string[]) => void) {
  const base = API_BASE.replace(/^http/, 'ws');
  const ws = new WebSocket(`${base}/api/preview/${sessionId}/logs`);
  ws.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      if (data.type === 'history' && onHistory) onHistory(data.logs);
      else onLog(ev.data);
    } catch {
      onLog(ev.data);
    }
  };
  return () => ws.close();
}
