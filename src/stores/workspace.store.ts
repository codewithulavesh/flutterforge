import { create } from 'zustand';

type WorkspaceView = 'ai-builder' | 'preview' | 'files' | 'components' | 'theme' | 'dependencies' | 'connectors' | 'code' | 'terminal' | 'problems' | 'git' | 'versions' | 'settings' | 'deploy' | 'export';

interface WorkspaceState {
  activeView: WorkspaceView;
  sidebarCollapsed: boolean;
  bottomPanelOpen: boolean;
  bottomPanelTab: 'terminal' | 'problems' | 'ai-activity' | 'build';
  activeFile: string | null;
  openTabs: string[];
  previewDevice: string;
  previewOrientation: 'portrait' | 'landscape';
  commandPaletteOpen: boolean;
  inspectorOpen: boolean;
  selectedWidget: string | null;

  setActiveView: (view: WorkspaceView) => void;
  toggleSidebar: () => void;
  setBottomPanelOpen: (open: boolean) => void;
  setBottomPanelTab: (tab: WorkspaceState['bottomPanelTab']) => void;
  openFile: (path: string) => void;
  closeTab: (path: string) => void;
  setPreviewDevice: (device: string) => void;
  setPreviewOrientation: (orientation: 'portrait' | 'landscape') => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setInspectorOpen: (open: boolean) => void;
  setSelectedWidget: (widget: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeView: 'ai-builder',
  sidebarCollapsed: false,
  bottomPanelOpen: true,
  bottomPanelTab: 'terminal',
  activeFile: null,
  openTabs: [],
  previewDevice: 'iPhone 15 Pro',
  previewOrientation: 'portrait',
  commandPaletteOpen: false,
  inspectorOpen: true,
  selectedWidget: null,

  setActiveView: (view) => set({ activeView: view }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
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
  setInspectorOpen: (open) => set({ inspectorOpen: open }),
  setSelectedWidget: (widget) => set({ selectedWidget: widget }),
}));
