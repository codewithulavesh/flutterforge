/// <reference types="vite/client" />

/** Preload bridge exposed by the Electron desktop shell. */
interface FlutterForgeDesktopBridge {
  isDesktop: true;
  platform: string;
  arch: string;
  getInfo: () => Promise<{
    isDesktop: boolean;
    platform: string;
    arch: string;
    version: string;
    isDev: boolean;
    serverUrl: string | null;
    engine: string;
  }>;
  pickFolder: () => Promise<string | null>;
  openPath: (target: string) => Promise<{ ok: boolean; error?: string }>;
  showItemInFolder: (target: string) => Promise<boolean>;
  harnessHealth: () => Promise<{ ok: boolean; status?: number; body?: unknown; error?: string }>;
  onMenuAction: (callback: (action: string) => void) => () => void;
}

interface Window {
  flutterforgeDesktop?: FlutterForgeDesktopBridge;
}
