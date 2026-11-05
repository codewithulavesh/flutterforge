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
  vault: {
    status: () => Promise<VaultBridgeStatus>;
    setKey: (provider: 'openrouter' | 'deepseek', key: string) => Promise<VaultBridgeStatus>;
    removeKey: (provider: 'openrouter' | 'deepseek') => Promise<VaultBridgeStatus>;
  };
  qa: {
    capture: (payload: { url: string; projectId?: string }) => Promise<QACaptureResult>;
  };
  onMenuAction: (callback: (action: string) => void) => () => void;
}

interface QAPixelReport {
  width: number;
  height: number;
  meanLuminance: number;
  contrast: number;
  dominantShare: number;
  yellowShare: number;
  issues: string[];
}

interface QACapture {
  label: string;
  width: number;
  height: number;
  ready: boolean;
  path: string | null;
  dataUrl: string | null;
  pixels: QAPixelReport | null;
  issues: string[];
}

interface QASemanticsNode {
  role: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface QACaptureResult {
  ok: boolean;
  error?: string;
  url?: string;
  capturedAt?: string;
  captures?: QACapture[];
  semantics?: QASemanticsNode[];
}

interface VaultCredentialStatus {
  configured: boolean;
  masked: string | null;
  updatedAt: string | null;
  source: string | null;
}

interface VaultBridgeStatus {
  ok: boolean;
  error?: string;
  storage?: 'os-encrypted' | 'plaintext-file';
  synced?: boolean;
  credentials?: {
    openrouter: VaultCredentialStatus;
    deepseek: VaultCredentialStatus;
  };
}

interface Window {
  flutterforgeDesktop?: FlutterForgeDesktopBridge;
}
