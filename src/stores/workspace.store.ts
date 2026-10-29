import { create } from 'zustand';

type WorkspaceView = 'ai-builder' | 'preview' | 'files' | 'dependencies' | 'code' | 'terminal' | 'versions' | 'settings' | 'export';

interface WorkspaceState {
  activeView: WorkspaceView;
  bottomPanelOpen: boolean;
  bottomPanelTab: 'terminal' | 'problems' | 'ai-activity' | 'build';
  activeFile: string | null;
  openTabs: string[];
  previewDevice: string;
  previewOrientation: 'portrait' | 'landscape';
  commandPaletteOpen: boolean;

  setActiveView: (view: WorkspaceView) => void;
  setBottomPanelOpen: (open: boolean) => void;
  setBottomPanelTab: (tab: WorkspaceState['bottomPanelTab']) => void;
  openFile: (path: string) => void;
  closeTab: (path: string) => void;
  setPreviewDevice: (device: string) => void;
  setPreviewOrientation: (orientation: 'portrait' | 'landscape') => void;
  setCommandPaletteOpen: (open: boolean) => void;
  /** Clear per-project UI state (open tabs, active file/view) on project switch. */
  resetWorkspace: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeView: 'ai-builder',
  bottomPanelOpen: false,
  bottomPanelTab: 'terminal',
  activeFile: null,
  openTabs: [],
  previewDevice: 'iPhone 15 Pro',
  previewOrientation: 'portrait',
  commandPaletteOpen: false,

  setActiveView: (view) => set({ activeView: view }),
  setBottomPanelOpen: (open) => set({ bottomPanelOpen: open }),
  setBottomPanelTab: (tab) => set({ bottomPanelTab: tab, bottomPanelOpen: true }),
  openFile: (path) => set((s) => ({
    activeFile: path,
    openTabs: s.openTabs.includes(path) ? s.openTabs : [...s.openTabs, path],
    activeView: 'code',
  })),
  closeTab: (path) => set((s) => {
    const tabs = s.openTabs.filter((t) => t !== path);
    return {
      openTabs: tabs,
      activeFile: s.activeFile === path ? tabs[tabs.length - 1] ?? null : s.activeFile,
    };
  }),
  setPreviewDevice: (device) => set({ previewDevice: device }),
  setPreviewOrientation: (orientation) => set({ previewOrientation: orientation }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  resetWorkspace: () => set({ activeFile: null, openTabs: [], activeView: 'ai-builder' }),
}));
