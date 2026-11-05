import { create } from 'zustand';

interface VisualQAState {
  running: boolean;
  error: string | null;
  result: QACaptureResult | null;
  run: (projectId: string, url: string | null) => Promise<void>;
  reset: () => void;
}

/**
 * Visual QA captures happen in the desktop shell because Flutter web paints
 * into a canvas the renderer iframe cannot inspect. The store only holds the
 * returned screenshots and findings.
 */
export const useVisualQAStore = create<VisualQAState>((set, get) => ({
  running: false,
  error: null,
  result: null,

  run: async (projectId, url) => {
    if (get().running) return;
    const bridge = typeof window !== 'undefined' ? window.flutterforgeDesktop : undefined;
    if (!bridge?.qa) {
      set({ error: 'Visual QA runs in the desktop app. Open FlutterForge with npm run dev:desktop to capture screenshots.' });
      return;
    }
    if (!url) {
      set({ error: 'Compile the preview first, then run Visual QA.' });
      return;
    }
    set({ running: true, error: null });
    try {
      const result = await bridge.qa.capture({ url, projectId });
      if (!result.ok) {
        set({ running: false, error: result.error || 'Visual QA could not capture the preview.' });
        return;
      }
      set({ running: false, result });
    } catch (error) {
      set({ running: false, error: error instanceof Error ? error.message : String(error) });
    }
  },

  reset: () => set({ running: false, error: null, result: null }),
}));
