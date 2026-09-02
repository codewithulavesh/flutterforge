import { useState, useEffect, useRef } from 'react';
import {
  Smartphone,
  Tablet,
  Monitor,
  RotateCw,
  Play,
  Square,
  Maximize2,
  RefreshCw,
  Loader2,
  FileCode2,
  Layers,
  Info,
  Sparkles,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { useProjectStore } from '@/stores/project.store';
import { useTerminalStore } from '@/stores/terminal.store';
import { usePreviewStore } from '@/stores/preview.store';
import { DEVICE_PRESETS } from '@/utils/constants';
import { PreviewCanvas } from './preview/PreviewCanvas';
import Grainient from '@/components/Grainient';
import { cn } from '@/utils/cn';

function useGyro() {
  const [gyro, setGyro] = useState({ x: 0, y: 0, enabled: false });
  const requestPermission = async () => {
    try {
      const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission === 'function') {
        const res = await DOE.requestPermission();
        if (res !== 'granted') return;
      }
      setGyro((g) => ({ ...g, enabled: true }));
    } catch {
      setGyro((g) => ({ ...g, enabled: true }));
    }
  };
  // mousemove always active for Mac/desktop - no permission needed
  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      setGyro((g) => ({ ...g, x: x * 0.5, y: y * 0.5, enabled: g.enabled || true }));
    };
    window.addEventListener('mousemove', handleMouse);
    return () => window.removeEventListener('mousemove', handleMouse);
  }, []);
  // deviceorientation only when enabled (iOS)
  useEffect(() => {
    if (!gyro.enabled) return;
    const handle = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma ?? 0;
      const beta = e.beta ?? 0;
      const x = Math.max(-1, Math.min(1, gamma / 30));
      const y = Math.max(-1, Math.min(1, beta / 30));
      setGyro((g) => ({ ...g, x, y }));
    };
    window.addEventListener('deviceorientation', handle, true);
    return () => window.removeEventListener('deviceorientation', handle);
  }, [gyro.enabled]);
  return { ...gyro, requestPermission };
}

const DEVICE_TABS = [
  { label: 'Mobile', device: 'iPhone 15 Pro', icon: Smartphone },
  { label: 'Tablet', device: 'iPad Pro', icon: Tablet },
  { label: 'Desktop', device: 'Desktop', icon: Monitor },
];

export function PreviewPanel() {
  const { previewDevice, setPreviewDevice, previewOrientation, setPreviewOrientation } = useWorkspaceStore();
  const { files, currentProject } = useProjectStore();
  const { isBuilding, addBuildLog, setBuilding, clearBuildLogs } = useTerminalStore();
  const preview = usePreviewStore();
  const [zoom, setZoom] = useState(100);
  const [fullscreen, setFullscreen] = useState(false);
  const [inspectMode, setInspectMode] = useState(false);
  const [selectedScreen, setSelectedScreen] = useState<string>('Home');
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const gyro = useGyro();

  const projectId = currentProject?.id || '';
  const session = projectId ? preview.getSession(projectId) : null;
  const status = session?.status || 'idle';
  const isPreviewBuilding = status === 'queued' || status === 'building';
  const isRunning = status === 'running' && !!session?.url;
  const previewUrl = session?.url || null;
  const previewError = preview.error;

  // Sync preview logs -> terminal store BuildOutputPanel
  useEffect(() => {
    if (!session?.logs) return;
    // push new logs to terminal
    const last = session.logs[session.logs.length - 1];
    if (last) addBuildLog(last);
  }, [session?.logs?.length]);

  const handleRun = async () => {
    if (!projectId) return;
    if (isRunning) {
      if (session) await preview.stop(session.sessionId);
      return;
    }
    clearBuildLogs();
    setBuilding(true);
    try {
      await preview.build(projectId, files as any);
    } catch (e) {
      // error already in store
    } finally {
      setBuilding(false);
    }
  };

  const handleRefresh = () => {
    if (iframeRef.current) iframeRef.current.src = iframeRef.current.src;
    if (isRunning && projectId) {
      // rebuild
      handleRun();
    }
  };

  const device = DEVICE_PRESETS.find((d) => d.name === previewDevice) ?? DEVICE_PRESETS[0];
  const isPortrait = previewOrientation === 'portrait';
  const rawW = isPortrait ? device.width : device.height;
  const rawH = isPortrait ? device.height : device.width;

  // Dynamically compute scale to fit the container
  const [containerSize, setContainerSize] = useState({ w: 700, h: 600 });
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: width, h: height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const autoScale = Math.min(
    (containerSize.w - 64) / rawW,
    (containerSize.h - 64) / rawH,
    1,
  );
  const scale = (autoScale * zoom) / 100;
  const displayW = Math.round(rawW * scale);
  const displayH = Math.round(rawH * scale);

  // Flutter/Dart project files from the store
  const dartFiles = files.filter((f) => !f.is_directory && f.path.endsWith('.dart'));
  const hasProject = dartFiles.length > 0;
  const mainFile = files.find((f) => f.path === 'lib/main.dart');
  const screens = dartFiles.filter((f) => f.path.includes('/screens/') || f.path.includes('/pages/'));
  const pubspec = files.find((f) => f.path === 'pubspec.yaml');

  return (
    <div className={cn('flex flex-col bg-[var(--ff-bg)]', fullscreen ? 'fixed inset-0 z-50' : 'h-full')}>

      {/* ── Toolbar ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 sm:px-3 py-2 border-b border-[var(--ff-border)] bg-[var(--ff-surface)] shrink-0 gap-2">
        {/* Device tabs */}
        <div className="flex items-center gap-0.5 overflow-x-auto ff-scrollbar max-w-full">
          {DEVICE_TABS.map(({ label, device: d, icon: Icon }) => {
            const active = previewDevice === d;
            return (
              <button
                key={d}
                onClick={() => setPreviewDevice(d)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all',
                  active
                    ? 'bg-[var(--ff-primary)]/15 text-[var(--ff-primary)] border border-[var(--ff-primary)]/30'
                    : 'text-[var(--ff-text-dim)] hover:text-white hover:bg-[var(--ff-surface-2)]'
                )}
              >
                <Icon size={13} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Zoom controls */}
        <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--ff-bg)] border border-[var(--ff-border)]">
          <button
            onClick={() => setZoom((z) => Math.max(25, z - 25))}
            className="text-[var(--ff-text-dim)] hover:text-white transition-colors p-0.5"
          >
            <ZoomOut size={12} />
          </button>
          <span className="text-[10px] font-mono text-[var(--ff-text-muted)] w-8 text-center select-none">{zoom}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(200, z + 25))}
            className="text-[var(--ff-text-dim)] hover:text-white transition-colors p-0.5"
          >
            <ZoomIn size={12} />
          </button>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPreviewOrientation(isPortrait ? 'landscape' : 'portrait')}
            className="p-1.5 rounded-md text-[var(--ff-text-dim)] hover:text-white hover:bg-[var(--ff-surface-2)] transition-all"
            title="Rotate"
          >
            <RotateCw size={13} />
          </button>
          <button
            onClick={() => setInspectMode(!inspectMode)}
            className={cn(
              'flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all',
              inspectMode
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                : 'text-[var(--ff-text-dim)] hover:text-white hover:bg-[var(--ff-surface-2)]'
            )}
            title="Toggle Inspect Widget Tree mode"
          >
            <span>🔍</span>
            <span className="hidden lg:inline">Inspect</span>
          </button>
          <button
            onClick={handleRun}
            disabled={isPreviewBuilding || isBuilding}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all disabled:opacity-50',
              isRunning
                ? 'bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25'
                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25'
            )}
            title={isRunning ? 'Stop preview' : 'Build & run Flutter web in Docker'}
          >
            {isPreviewBuilding ? <Loader2 size={12} className="animate-spin" /> : isRunning ? <Square size={12} /> : <Play size={12} />}
            <span className="hidden sm:inline">{isPreviewBuilding ? 'Building...' : isRunning ? 'Stop' : 'Run'}</span>
          </button>
          <button
            onClick={handleRefresh}
            className="p-1.5 rounded-md text-[var(--ff-text-dim)] hover:text-white hover:bg-[var(--ff-surface-2)] transition-all"
            title="Reload iframe / Rebuild"
          >
            <RefreshCw size={13} />
          </button>
          {isRunning && previewUrl && (
            <a href={previewUrl} target="_blank" rel="noreferrer" className="p-1.5 rounded-md text-[var(--ff-text-dim)] hover:text-white hover:bg-[var(--ff-surface-2)] transition-all" title="Open in new tab">
              <ExternalLink size={13} />
            </a>
          )}
          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="p-1.5 rounded-md text-[var(--ff-text-dim)] hover:text-white hover:bg-[var(--ff-surface-2)] transition-all"
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      {/* ── Preview canvas ──────────────────────────────────────── */}
      <div ref={containerRef} className="flex-1 flex items-center justify-center overflow-hidden bg-[#0d0d10] relative p-4">
        {/* Grainient Background - responsive */}
        {/* Gyro-reactive Grainient background */}
        <div className="absolute inset-0 overflow-hidden bg-[#0a0a0f]">
          <div
            className="absolute inset-0 w-full h-full transition-transform duration-300 ease-out will-change-transform"
            style={{
              transform: `translate3d(${gyro.x * 18}px, ${gyro.y * 18}px, 0) scale(1.05)`,
            }}
          >
            <Grainient
              color1="#FF9FFC"
              color2="#5227FF"
              color3="#B497CF"
              timeSpeed={0.25}
              colorBalance={-0.15 + gyro.x * 0.08}
              warpStrength={3.6}
              warpFrequency={7.8}
              warpSpeed={5.9}
              warpAmplitude={48 + gyro.y * 10}
              blendAngle={145 + gyro.x * 18}
              blendSoftness={0}
              rotationAmount={700 + gyro.x * 80}
              noiseScale={3.3}
              grainAmount={0.36}
              grainScale={2}
              grainAnimated={false}
              contrast={1.5}
              gamma={1}
              saturation={1}
              centerX={gyro.x * 0.35}
              centerY={gyro.y * 0.35}
              zoom={0.9}
              className="w-full h-full"
            />
          </div>
          <div className="absolute inset-0 bg-black/20 pointer-events-none" />
          {!gyro.enabled && 'ontouchstart' in window && (
            <button
              onClick={gyro.requestPermission}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[10px] font-medium text-white hover:bg-white/15 transition-colors flex items-center gap-1.5"
            >
              <span>📱</span> Enable Gyro
            </button>
          )}
        </div>
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(90deg, #3b82f6 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />



        {isPreviewBuilding || isBuilding ? (
          <div className="flex flex-col items-center gap-4 z-10 max-w-[80%]">
            <div className="relative w-14 h-14">
              <div className="w-14 h-14 rounded-2xl bg-[var(--ff-primary)]/10 flex items-center justify-center">
                <Sparkles size={24} className="text-[var(--ff-primary)]" />
              </div>
              <div className="absolute inset-0 rounded-2xl border-2 border-[var(--ff-primary)] border-t-transparent ff-spin" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-white">Building Flutter Web in Docker...</p>
              <p className="text-xs text-[var(--ff-text-dim)] mt-1">
                {session?.logs?.[session.logs.length - 1] || 'Compiling Dart & resolving assets (60-90s first build)'}
              </p>
              {previewError && <p className="text-xs text-red-400 mt-2 flex items-center justify-center gap-1"><AlertCircle size={12} />{previewError}</p>}
            </div>
            {session?.logs && session.logs.length > 1 && (
              <div className="w-full max-h-32 overflow-y-auto bg-black/50 rounded-lg p-2 font-mono text-[10px] text-white/60 text-left">
                {session.logs.slice(-8).map((l, i) => <div key={i} className="truncate">{l}</div>)}
              </div>
            )}
          </div>
        ) : (
          /* Device frame */
          <div
            className="relative z-10 transition-all duration-300"
            style={{ width: displayW, height: displayH }}
          >
            {/* Outer device shell */}
            <div
              className="absolute inset-0 rounded-[2rem] bg-[#1a1a1a] shadow-2xl shadow-black/70"
              style={{ boxShadow: '0 0 0 3px #333, 0 30px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)' }}
            />

            {/* Notch / Dynamic Island (phones only) */}
            {previewDevice === 'iPhone 15 Pro' && isPortrait && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-20 flex items-center justify-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#222]" />
                <div className="w-3 h-3 rounded-full bg-[#222] border border-white/5" />
              </div>
            )}

            {/* Screen */}
            <div
              className="absolute rounded-[1.6rem] overflow-hidden bg-white"
              style={{ inset: 4 }}
            >
              {isRunning && previewUrl ? (
                <iframe
                  ref={iframeRef}
                  src={previewUrl}
                  title="Flutter Web Preview"
                  className="w-full h-full border-0 bg-white"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
                  allow="clipboard-write"
                />
              ) : status === 'failed' ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-white text-center p-4 gap-3">
                  <AlertCircle size={24} className="text-red-400" />
                  <div>
                    <p className="text-xs font-semibold text-red-600">Docker Build Failed</p>
                    <p className="text-[10px] text-red-400 mt-1 line-clamp-3 font-mono bg-red-50 p-2 rounded">{session?.logs?.slice(-5).join('\n') || previewError || 'Check Build output panel'}</p>
                    <p className="text-[9px] text-gray-400 mt-2">Docker overloaded on 8GB - prune and retry</p>
                  </div>
                  <button onClick={handleRun} className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white text-xs font-semibold flex items-center gap-1.5">
                    <RefreshCw size={12} /> Retry Docker Build
                  </button>
                </div>
              ) : hasProject ? (
                <div className="relative w-full h-full">
                  <PreviewCanvas
                    files={files}
                    projectName={currentProject?.name}
                    activeScreen={selectedScreen}
                    onScreenChange={(s) => setSelectedScreen(s)}
                    inspectMode={inspectMode}
                  />
                  {/* Quick Docker Run Pill Overlay */}
                  <div className="absolute top-2 right-2 z-30">
                    <button
                      onClick={handleRun}
                      className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 backdrop-blur-md hover:bg-black/80 text-[9px] font-bold text-emerald-400 border border-white/10 transition-all shadow-sm"
                      title="Compile real Flutter Web with Docker"
                    >
                      <Play size={8} />
                      <span>Docker</span>
                    </button>
                  </div>
                </div>
              ) : (
                <NoProjectPreview onGoToAI={() => {}} />
              )}
            </div>

            {/* Bottom home bar (phones) */}
            {previewDevice === 'iPhone 15 Pro' && isPortrait && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-28 h-1 rounded-full bg-white/30 z-20" />
            )}
          </div>
        )}

        {/* Dims label */}
        <div className="absolute bottom-3 right-3 text-[9px] font-mono text-white/20">
          {rawW}×{rawH} · {Math.round(scale * 100)}%
        </div>
      </div>

      {/* ── Status bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-[var(--ff-border)] bg-[var(--ff-surface)] shrink-0 text-[10px] text-[var(--ff-text-dim)]">
        <div className="flex items-center gap-3">
          <span>{device.name}</span>
          <span className="opacity-40">·</span>
          <span>{rawW}×{rawH}</span>
          {hasProject && (
            <>
              <span className="opacity-40">·</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <FileCode2 size={9} />
                {dartFiles.length} files
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'flex items-center gap-1 font-medium',
            isRunning ? 'text-emerald-400' : isPreviewBuilding ? 'text-amber-400' : status === 'failed' ? 'text-red-400' : 'text-[var(--ff-text-dim)]'
          )}>
            <span className={cn('w-1.5 h-1.5 rounded-full', isRunning ? 'bg-emerald-400 animate-pulse' : isPreviewBuilding ? 'bg-amber-400 animate-pulse' : status === 'failed' ? 'bg-red-400' : 'bg-white/20')} />
            {isPreviewBuilding ? 'Building' : isRunning ? 'Running' : status === 'failed' ? 'Failed' : 'Stopped'}
          </span>
          {previewUrl && <span className="hidden md:inline opacity-40 truncate max-w-[160px]">{previewUrl}</span>}
        </div>
      </div>
    </div>
  );
}

/* ── Idle / not-running screen ─────────────────────────────────── */
function IdleScreen({
  onRun,
  hasProject,
  fileCount,
  projectName,
}: {
  onRun: () => void;
  hasProject: boolean;
  fileCount: number;
  projectName?: string;
}) {
  const apiOk = typeof window !== 'undefined' && (import.meta.env.VITE_PREVIEW_API_URL || 'http://localhost:3001');
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#0f1117] to-[#1a1a2e] text-white select-none">
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        {hasProject ? (
          <>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#3b82f6]/20 to-purple-500/20 flex items-center justify-center border border-white/10">
              <Layers size={24} className="text-[#3b82f6]" />
            </div>
            <div>
              <p className="text-xs font-bold text-white mb-0.5">{projectName ?? 'Flutter App'}</p>
              <p className="text-[10px] text-white/40">{fileCount} Dart file{fileCount !== 1 ? 's' : ''} ready</p>
            </div>
            <button
              onClick={onRun}
              className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-emerald-500/30"
            >
              <Play size={12} />
              Run in Docker
            </button>
            <p className="text-[9px] text-white/20 mt-1">Free Docker 8GB · 15m TTL · auto-cleanup</p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
              <Sparkles size={24} className="text-white/30" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white/60 mb-1">No app generated yet</p>
              <p className="text-[10px] text-white/30 leading-relaxed">
                Use the AI Builder panel to generate your Flutter app, then run the preview.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function NoProjectPreview({ onGoToAI }: { onGoToAI: () => void }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-center p-4 gap-3">
      <Info size={20} className="text-gray-300" />
      <div>
        <p className="text-xs font-semibold text-gray-500">No code generated</p>
        <p className="text-[9px] text-gray-400 mt-1 leading-relaxed">
          Use the AI Builder to generate your Flutter app first.
        </p>
      </div>
    </div>
  );
}
