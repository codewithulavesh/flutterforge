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
  build: (projectId: string, files: Array<{ path: string; content: string | null; is_directory?: boolean }>, opts?: { supabaseUrl?: string; supabaseAnonKey?: string; }) => Promise<string>;
  pollStatus: (sessionId: string) => Promise<PreviewSession | null>;
  checkProjectStatus: (projectId: string) => Promise<PreviewSession | null>;
  stop: (sessionId: string) => Promise<void>;
  resetSession: (projectId: string) => void;
  clearError: () => void;
}

// Desktop builds always use the embedded preview compiler on the app origin.
// Web builds may point at a separate preview host via VITE_PREVIEW_API_URL.
const API_BASE = (typeof window !== 'undefined' && window.flutterforgeDesktop?.isDesktop
  ? ''
  : import.meta.env.VITE_PREVIEW_API_URL || '').replace(/\/+$/, '');

/** Warm preview URLs are absolute (loopback `flutter run`); static builds are relative. */
function previewUrl(url: string | null | undefined, version: string): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) {
    return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`;
  }
  return `${API_BASE}${url}?v=${version}`;
}

/** Parse a response body safely — an empty or non-JSON body (e.g. a proxy 404
 *  when the local engine is offline) must not surface as a cryptic
 *  "Unexpected end of JSON input". */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function parseJsonResponse(res: Response): Promise<any> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error('The preview compiler did not respond. Start the local harness server with: npm run server');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`The preview compiler returned an invalid response (HTTP ${res.status}).`);
  }
}

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
      const filteredFiles = files
        .filter((file) => !file.is_directory && !file.path.endsWith('/') && file.content !== null)
        .map((f) => ({ path: f.path, content: f.content || '' }));

      const res = await fetch(`${API_BASE}/api/preview/${projectId}/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: filteredFiles,
          userId: projectId,
          supabaseUrl: opts?.supabaseUrl || import.meta.env.VITE_SUPABASE_URL,
          supabaseAnonKey: opts?.supabaseAnonKey || import.meta.env.VITE_SUPABASE_ANON_KEY,
        }),
      });
      // The dev proxy answers an offline compiler with an EMPTY 500 body —
      // res.json() on that throws the cryptic "Unexpected end of JSON input".
      // Parse defensively and translate offline responses into guidance.
      const bodyText = await res.text();
      let data: { sessionId?: string; error?: string } = {};
      if (bodyText.trim()) {
        try {
          data = JSON.parse(bodyText) as typeof data;
        } catch {
          data = { error: `Build server returned an unreadable response (HTTP ${res.status}).` };
        }
      } else if (!res.ok) {
        data = { error: 'Preview compiler is offline. Start the local harness server with: npm run server' };
      }
      if (!res.ok) throw new Error(data.error || 'Build failed to queue');
      if (!data.sessionId) throw new Error('Build server accepted the job but returned no session id.');

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

      // Start polling (survives transient network/server blips: only after
      // 20 consecutive failed polls is the session marked failed).
      let pollFailures = 0;
      const poll = async () => {
        const status = await get().pollStatus(sessionId);
        if (!status) {
          pollFailures++;
          if (pollFailures < 20) {
            setTimeout(poll, 1500);
            return;
          }
          const state = get();
          for (const [pid, sess] of Object.entries(state.sessions)) {
            if (sess.sessionId === sessionId && (sess.status === 'queued' || sess.status === 'building')) {
              set((s) => ({
                sessions: {
                  ...s.sessions,
                  [pid]: { ...sess, status: 'failed', logs: [...sess.logs, '[preview] Lost contact with build server.'] },
                },
              }));
              break;
            }
          }
          return;
        }
        pollFailures = 0;
        if (status && (status.status === 'queued' || status.status === 'building')) {
          setTimeout(poll, 1500);
        }
      };
      setTimeout(poll, 1000);

      return sessionId;
    } catch (e) {
      let msg = e instanceof Error ? e.message : String(e);
      if (/failed to fetch|networkerror|econnrefused/i.test(msg)) {
        msg = 'Preview compiler is offline. Start the local harness server with: npm run server';
      }
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  checkProjectStatus: async (projectId) => {
    try {
      const res = await fetch(`${API_BASE}/api/preview/project/${projectId}/status`);
      if (!res.ok) return null;
      const data = await parseJsonResponse(res);
      if (!data || !data.status) return null;

      const session: PreviewSession = {
        sessionId: data.sessionId,
        projectId,
        status: data.status,
        url: previewUrl(data.url, data.sessionId),
        publicUrl: data.publicUrl ? `${API_BASE}${data.publicUrl}` : null,
        port: data.port ?? null,
        logs: data.logs || [],
        createdAt: data.createdAt,
      };

      set((s) => ({
        sessions: { ...s.sessions, [projectId]: session },
        currentSessionId: data.sessionId,
      }));

      // If in progress, continue polling
      if (session.status === 'queued' || session.status === 'building') {
        const poll = async () => {
          const current = await get().pollStatus(data.sessionId);
          if (current && (current.status === 'queued' || current.status === 'building')) {
            setTimeout(poll, 1500);
          }
        };
        setTimeout(poll, 1500);
      }

      return session;
    } catch {
      return null;
    }
  },

  pollStatus: async (sessionId) => {
    try {
      const res = await fetch(`${API_BASE}/api/preview/${sessionId}/status`);
      if (!res.ok) return null;
      const data = await parseJsonResponse(res);
      if (!data || !data.status) return null;
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
        // Versioned per build session so the iframe never renders a stale
        // cached shell from a previous (or starter-template) build.
        url: previewUrl(data.url, data.sessionId),
        publicUrl: data.publicUrl ? `${API_BASE}${data.publicUrl}` : null,
        port: data.port ?? null,
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
    } catch {
      // ignore network errors if backend is offline
    }
    const state = get();
    for (const [pid, sess] of Object.entries(state.sessions)) {
      if (sess.sessionId === sessionId) {
        const next = { ...sess, status: 'stopped' as const, url: null };
        set((s) => ({ sessions: { ...s.sessions, [pid]: next } }));
        break;
      }
    }
  },

  resetSession: (projectId) => {
    const state = get();
    const sess = state.sessions[projectId];
    if (sess) {
      set((s) => ({
        sessions: {
          ...s.sessions,
          [projectId]: { ...sess, status: 'idle', url: null, logs: [] },
        },
        error: null,
      }));
    } else {
      set({ error: null });
    }
  },

  clearError: () => set({ error: null }),
}));
