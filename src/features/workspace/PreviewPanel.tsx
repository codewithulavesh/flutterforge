import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Smartphone,
  Tablet,
  Monitor,
  RotateCw,
  Maximize2,
  RefreshCw,
  Sparkles,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  Hammer,
  AlertCircle,
  Loader2,
  Globe,
  ScanEye,
  Zap,
} from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { useProjectStore } from '@/stores/project.store';
import { useTerminalStore } from '@/stores/terminal.store';
import { usePreviewStore } from '@/stores/preview.store';
import { DEVICE_PRESETS } from '@/utils/constants';
import { cn } from '@/utils/cn';
import { toast } from '@/components/ui/Toast';
import { VisualQAPanel } from './VisualQAPanel';

const DEVICE_TABS = [
  { label: 'Mobile', device: 'iPhone 15 Pro', icon: Smartphone },
  { label: 'Tablet', device: 'iPad Pro', icon: Tablet },
  { label: 'Desktop', device: 'Desktop', icon: Monitor },
];

export function PreviewPanel() {
  const { previewDevice, setPreviewDevice, previewOrientation, setPreviewOrientation } = useWorkspaceStore();
  const { files, currentProject, messages } = useProjectStore();
  const { isGenerating, currentPhase, addBuildLog } = useTerminalStore();
  const preview = usePreviewStore();

  const [zoom, setZoom] = useState(100);
  const [fullscreen, setFullscreen] = useState(false);
  const [autoBuildAttempted, setAutoBuildAttempted] = useState(false);
  const [qaOpen, setQaOpen] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const previewMode = 'web' as const;
  const serverOnline = preview.serverOnline;

  // Ping harness server health on mount
  useEffect(() => {
    preview.pingServer();
    // Re-check every 30s while the panel is mounted
    const interval = setInterval(() => preview.pingServer(), 30_000);
    return () => clearInterval(interval);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const terminalLogRef = useRef<HTMLDivElement>(null);

  const projectId = currentProject?.id || '';
  const session = projectId ? preview.getSession(projectId) : null;
  const status = session?.status || 'idle';
  const isBuilding = status === 'queued' || status === 'building';
  const isRunning = status === 'running' && !!session?.url;
  const previewUrl = session?.url || null;
  const previewError = preview.error;

  const device = DEVICE_PRESETS.find((d) => d.name === previewDevice) ?? DEVICE_PRESETS[0];
  const isPortrait = previewOrientation === 'portrait';
  const rawW = isPortrait ? device.width : device.height;
  const rawH = isPortrait ? device.height : device.width;

  // Auto-scroll build logs
  useEffect(() => {
    if (terminalLogRef.current) {
      terminalLogRef.current.scrollTop = terminalLogRef.current.scrollHeight;
    }
  }, [session?.logs?.length]);

  // Sync session logs to workspace BuildOutputPanel
  useEffect(() => {
    if (!session?.logs) return;
    const last = session.logs[session.logs.length - 1];
    if (last) addBuildLog(last);
  }, [session?.logs?.length, addBuildLog]);

  // Dynamic scale-to-fit
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

  const autoScale = Math.min((containerSize.w - 64) / rawW, (containerSize.h - 64) / rawH, 1);
  const scale = (autoScale * zoom) / 100;
  const displayW = Math.round(rawW * scale);
  const displayH = Math.round(rawH * scale);

  const dartFiles = useMemo(() => files.filter((f) => !f.is_directory && f.path.endsWith('.dart')), [files]);
  const hasProject = dartFiles.length > 0;

  // A fresh project only contains the identical starter-template files until
  // the AI generates the real app (messages appear). Auto-building those
  // boilerplate files would pin the preview to the same generic app for
  // every new project — the generation pipeline triggers the real build.
  const hasGeneratedApp = messages.length > 0;

  // Reset per-project so switching projects re-arms the auto-build for the
  // newly opened project instead of inheriting the previous project's flag.
  useEffect(() => {
    setAutoBuildAttempted(false);
    if (projectId) {
      preview.checkProjectStatus(projectId);
    }
  }, [projectId]);

  // Trigger real build
  const handleCompileWeb = async () => {
    if (!projectId || files.length === 0 || isBuilding) return;
    try {
      const compilableFiles = files
        .filter((file) => !file.is_directory)
        .map((file) => ({ path: file.path, content: file.content }));
      await preview.build(projectId, compilableFiles, {
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
        supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      });
    } catch (e) {
      console.error('Failed to trigger Flutter Web build:', e);
    }
  };

  // Auto-trigger build once the REAL generated app exists (not the starter
  // template) if no live preview is running yet. Fresh projects with zero AI
  // messages are skipped here — sendMessage() builds the fresh files itself
  // the moment generation completes.
  useEffect(() => {
    if (hasProject && hasGeneratedApp && !autoBuildAttempted && status === 'idle' && !isGenerating) {
      setAutoBuildAttempted(true);
      handleCompileWeb();
    }
  }, [hasProject, hasGeneratedApp, autoBuildAttempted, status, isGenerating]);

  const handleRefresh = () => {
    if (iframeRef.current && isRunning && previewUrl) {
      // The warm preview is a different loopback origin, so reload by setting
      // a cache-busted src rather than reaching into contentWindow.
      const url = new URL(previewUrl, window.location.href);
      url.searchParams.set('r', String(Date.now()));
      iframeRef.current.src = url.toString();
    } else {
      handleCompileWeb();
    }
  };

  const handleHotReload = async () => {
    if (!projectId || isReloading) return;
    setIsReloading(true);
    try {
      await preview.reload(projectId);
      toast('success', 'Hot reload sent to the warm preview');
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Hot reload failed');
    } finally {
      setIsReloading(false);
    }
  };

  /* ── What to show inside the device screen ─── */
  const renderScreenContent = () => {
    // 1. AI is actively synthesizing code
    if (isGenerating) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#070b12] text-center px-6">
          <Loader2 size={22} className="text-[#02AFB9] animate-spin mb-3" />
          <p className="text-[12px] font-semibold text-slate-100">Building your app…</p>
          <p className="text-[10px] text-slate-400 mt-1 max-w-[220px] truncate">
            {currentPhase || 'Writing Flutter files'}
          </p>
        </div>
      );
    }

    // 2. Web mode: Real Flutter Web Build in Progress — live compiler terminal
    if (previewMode === 'web' && isBuilding) {
      return (
        <div className="w-full h-full flex flex-col bg-slate-950 p-4 select-none font-sans overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative w-7 h-7 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <Loader2 size={14} className="text-indigo-400 animate-spin" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Compiling Flutter Web</h4>
                <p className="text-[9px] text-slate-400">flutter build web --release</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[9px] font-mono animate-pulse">
                Building...
              </span>
            </div>
          </div>

          {/* Terminal log output */}
          <div
            ref={terminalLogRef}
            className="flex-1 my-3 bg-black/60 rounded-xl p-3 border border-white/5 font-mono text-[9.5px] text-slate-300 overflow-y-auto ff-scrollbar space-y-1"
          >
            {session?.logs && session.logs.length > 0 ? (
              session.logs.map((log, i) => (
                <div key={i} className="leading-relaxed font-mono break-all">
                  <span className="text-indigo-400 mr-1.5">›</span>
                  <span className={log.includes('error') || log.includes('Error') ? 'text-red-400 font-bold' : log.includes('success') ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                    {log}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-slate-500 italic">Initializing build container and resolving dependencies...</div>
            )}
          </div>

          {/* Footer note */}
          <div className="shrink-0 text-center text-[9px] text-slate-500">
            Real Flutter engine build · Serving to iframe upon completion
          </div>
        </div>
      );
    }

    // 3. Web mode: Real Flutter Web Compiled & Running — serve via iframe.
    if (previewMode === 'web' && isRunning && previewUrl) {
      return (
        <div className="relative w-full h-full bg-slate-950">
          <iframe
            key={session?.sessionId}
            ref={iframeRef}
            src={previewUrl}
            title="Real Flutter Web Preview"
            className="w-full h-full border-0 bg-slate-950"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals"
          />
          {/* Live badge */}
          <div className="absolute top-2.5 right-2.5 z-30 pointer-events-none">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 border border-emerald-500/30 text-emerald-300 text-[9px] font-bold backdrop-blur-md shadow-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Real Flutter Web</span>
            </div>
          </div>
        </div>
      );
    }

    // 4. Web mode: Build failed state
    if (previewMode === 'web' && (status === 'failed' || previewError)) {
      const isServerOffline = previewError?.includes('offline') || serverOnline === false;
      const logs = session?.logs ?? [];
      const causeLines = logs.filter((l) =>
        /error|exception|because|depends on|version solving|failed to|not found|no such|invalid/i.test(l),
      );
      const lastLine = logs[logs.length - 1];
      const shown = [...causeLines.slice(0, 8)];
      if (lastLine && !shown.includes(lastLine)) shown.push(lastLine);
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-950 text-center select-none overflow-y-auto ff-scrollbar">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-3 shrink-0">
            <AlertCircle size={24} className="text-red-400" />
          </div>
          <h3 className="text-sm font-bold text-white mb-1">Flutter Web Build Failed</h3>
          <p className="text-[10px] text-slate-400 max-w-[280px] mb-3 leading-relaxed">
            {previewError || 'The Flutter web compiler reported errors. Fix the code or retry the build.'}
          </p>
          {isServerOffline && (
            <div className="w-full max-w-[380px] mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-left">
              <p className="text-[10px] text-amber-300 font-semibold mb-1">⚠ Harness server appears offline</p>
              <p className="text-[9px] text-slate-400 mb-2">Open a terminal in the project folder and run:</p>
              <code className="block text-[10px] font-mono bg-black/60 rounded-lg px-3 py-2 text-emerald-300 select-all">npm run server</code>
              <p className="text-[9px] text-slate-500 mt-2">Then restart the dev server: <code className="text-emerald-400">npm run dev</code></p>
            </div>
          )}
          {!isServerOffline && shown.length > 0 && (
            <div className="w-full max-w-[420px] max-h-40 overflow-y-auto ff-scrollbar text-left font-mono text-[9px] leading-relaxed bg-black/60 border border-red-500/20 rounded-xl p-3 mb-4 space-y-1">
              {shown.map((l, i) => (
                <div key={i} className="text-red-300/90 break-all">{l}</div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCompileWeb}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 active:scale-95 transition-all flex items-center gap-2 shrink-0"
            >
              <Hammer size={12} />
              <span>Retry Web Build</span>
            </button>
          </div>
        </div>
      );
    }



    // 7. Web mode with no build yet — trigger one automatically if files exist
    if (previewMode === 'web' && hasProject && !isBuilding) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-[var(--fb-bg)] text-center select-none">
          <div className="w-14 h-14 rounded-[18px] border-[6px] border-[#0a0a0a] bg-[var(--fb-card)] flex items-center justify-center mb-4 shadow-[0_18px_36px_-28px_rgba(0,0,0,0.6)]">
            <Globe size={22} className="text-[var(--fb-ink)]" />
          </div>
          <p className="font-mono text-[8.5px] font-semibold uppercase tracking-[0.15em] text-[var(--fb-muted)]">
            Flutter web engine
          </p>
          <h3 className="ffb-display ffb-caps mt-2 text-[20px] leading-[0.95] text-[var(--fb-ink)]">Compile the preview</h3>
          <p className="mt-2 max-w-[250px] text-[10.5px] leading-relaxed text-[var(--fb-muted)]">
            {hasProject
              ? 'Compile your generated Flutter app with the real Web engine for a pixel-perfect preview.'
              : 'Generate a Flutter app first, then compile it with the Web engine.'}
          </p>
          <div className="flex items-center gap-2 mt-4">
            {hasProject && (
              <button
                onClick={handleCompileWeb}
                className="px-4 py-2 rounded-full bg-[var(--fb-ink)] text-[var(--fb-bg)] font-semibold text-[11px] transition-transform hover:-translate-y-px active:scale-95 flex items-center gap-2"
              >
                <Hammer size={12} />
                <span>Compile Web</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    // 7. Standby state (no files generated yet)
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-[var(--fb-bg)] text-center select-none">
        <div className="w-12 h-12 rounded-[16px] border-[6px] border-[#0a0a0a] bg-[var(--fb-card)] flex items-center justify-center mb-3">
          <Sparkles size={20} className="text-[var(--fb-ink)]" />
        </div>
        <h3 className="ffb-display ffb-caps text-[17px] leading-[0.95] text-[var(--fb-ink)]">Instant preview</h3>
        <p className="mt-2 text-[10.5px] text-[var(--fb-muted)] max-w-[250px] leading-relaxed">
          Describe your application in the AI Builder to synthesize full production Flutter code with real-time interactive preview.
        </p>
      </div>
    );
  };

  // If AI generation is in progress and there is no previous build, show a
  // compact placeholder instead of replacing the whole workspace with a
  // multi-stage progress dashboard. The chat panel owns the live activity.
  if (isGenerating) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--ff-bg)] text-center px-6">
        <Loader2 size={22} className="text-[var(--ff-primary)] animate-spin mb-3" />
        <p className="text-[12px] font-semibold text-[var(--ff-text)]">Building your app…</p>
        <p className="text-[10px] text-[var(--ff-text-dim)] mt-1 max-w-[240px] truncate">
          {currentPhase || 'Writing Flutter files'}
        </p>
      </div>
    );
  }

  // If fresh project has not yet completed initial generation, keep preview locked
  if (!hasGeneratedApp && files.length <= 6) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-[var(--fb-bg)] text-center select-none">
        <div className="w-14 h-14 rounded-[18px] border-[6px] border-[#0a0a0a] bg-[var(--fb-card)] flex items-center justify-center mb-4 shadow-[0_18px_36px_-28px_rgba(0,0,0,0.6)]">
          <Sparkles size={22} className="text-[var(--fb-ink)]" />
        </div>
        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--fb-muted)]">
          Awaiting the first build
        </p>
        <h3 className="ffb-display ffb-caps mt-2 text-[clamp(24px,3.4vw,34px)] leading-[0.95] text-[var(--fb-ink)]">
          Preview ready when you are
        </h3>
        <p className="mt-3 max-w-sm text-[12.5px] leading-relaxed text-[var(--fb-muted)]">
          Describe the app in the AI Builder. The real Flutter web preview appears here as soon as the first build is ready.
        </p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--fb-lime)] px-3 py-1.5 text-[10px] font-bold text-black">
          <span className="h-1.5 w-1.5 rounded-full bg-black animate-pulse" />
          <span>Awaiting generation</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col bg-[var(--ff-bg)]', fullscreen ? 'fixed inset-0 z-50' : 'h-full')}>
      {/* ── Unified toolbar: status, devices, tools and compile ─── */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--fb-line)] bg-[var(--fb-card)] px-2 py-1.5 shrink-0 sm:gap-2">
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="rounded-full border border-[var(--fb-line)] bg-[var(--fb-soft)] px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--fb-muted)]">
            Preview
          </div>
          <span className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em]',
            isRunning
              ? 'bg-[var(--fb-lime)] text-black'
              : isBuilding
                ? 'bg-[var(--fb-cyan)] text-black'
                : status === 'failed'
                  ? 'border border-[var(--fb-danger)] text-[var(--fb-danger)]'
                  : 'bg-[var(--fb-soft)] text-[var(--fb-muted)]'
          )}>
            <span className={cn('h-1.5 w-1.5 rounded-full', isRunning ? 'bg-black animate-pulse' : isBuilding ? 'bg-black animate-pulse' : status === 'failed' ? 'bg-[var(--fb-danger)]' : 'bg-[var(--fb-dim)]')} />
            {isRunning ? 'Live' : isBuilding ? 'Building' : status === 'failed' ? 'Failed' : 'Ready'}
          </span>
          {/* Server health indicator */}
          {serverOnline !== null && (
            <span
              title={serverOnline ? 'Harness server online' : 'Harness server offline — run: npm run server'}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-semibold',
                serverOnline
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', serverOnline ? 'bg-emerald-400' : 'bg-red-400 animate-pulse')} />
              {serverOnline ? 'Server' : 'Server offline'}
            </span>
          )}
        </div>

        <div className="h-4 w-px shrink-0 bg-[var(--fb-line)]" />

        {/* Device tabs */}
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto ff-scrollbar sm:flex-none">
          {DEVICE_TABS.map(({ label, device: d, icon: Icon }) => {
            const active = previewDevice === d;
            return (
              <button
                key={d}
                onClick={() => setPreviewDevice(d)}
                title={label}
                aria-label={`${label} preview`}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-colors',
                  active
                    ? 'bg-[var(--fb-ink)] text-[var(--fb-bg)]'
                    : 'text-[var(--fb-muted)] hover:bg-[var(--fb-soft)] hover:text-[var(--fb-ink)]'
                )}
              >
                <Icon size={13} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Right controls */}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {hasProject && (
            <span className="hidden xl:inline font-mono text-[9px] uppercase tracking-[0.1em] tabular-nums text-[var(--fb-dim)]">
              {dartFiles.length} Dart files
            </span>
          )}
          <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--fb-card)] border border-[var(--fb-line)]">
            <button
              onClick={() => setZoom((z) => Math.max(25, z - 25))}
              className="text-[var(--fb-dim)] hover:text-[var(--fb-ink)] transition-colors p-0.5"
              title="Zoom Out"
              aria-label="Zoom out"
            >
              <ZoomOut size={12} />
            </button>
            <span className="font-mono text-[10px] text-[var(--fb-muted)] w-8 text-center select-none">{zoom}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(200, z + 25))}
              className="text-[var(--fb-dim)] hover:text-[var(--fb-ink)] transition-colors p-0.5"
              title="Zoom In"
              aria-label="Zoom in"
            >
              <ZoomIn size={12} />
            </button>
          </div>
          <button
            onClick={() => setPreviewOrientation(isPortrait ? 'landscape' : 'portrait')}
            className="p-1.5 rounded-full text-[var(--fb-muted)] hover:text-[var(--fb-ink)] hover:bg-[var(--fb-soft)] transition-colors"
            title="Rotate Orientation"
            aria-label="Rotate orientation"
          >
            <RotateCw size={13} />
          </button>
          {isRunning && (
            <button
              onClick={() => void handleHotReload()}
              disabled={isReloading}
              className="p-1.5 rounded-full text-[var(--fb-muted)] hover:text-[var(--fb-ink)] hover:bg-[var(--fb-soft)] transition-colors disabled:opacity-50"
              title="Hot reload the warm Flutter engine"
              aria-label="Hot reload preview"
            >
              {isReloading ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
            </button>
          )}
          <button
            onClick={() => setQaOpen(true)}
            disabled={!isRunning}
            className="p-1.5 rounded-full text-[var(--fb-muted)] hover:text-[var(--fb-ink)] hover:bg-[var(--fb-soft)] transition-colors disabled:opacity-40"
            title="Visual QA — capture mobile, tablet, and desktop"
            aria-label="Open visual QA"
          >
            <ScanEye size={13} />
          </button>
          <button
            onClick={handleRefresh}
            className="p-1.5 rounded-full text-[var(--fb-muted)] hover:text-[var(--fb-ink)] hover:bg-[var(--fb-soft)] transition-colors"
            title="Reload Preview"
            aria-label="Reload preview"
          >
            <RefreshCw size={13} />
          </button>
          {isRunning && previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-full text-[var(--fb-muted)] hover:text-[var(--fb-ink)] hover:bg-[var(--fb-soft)] transition-colors"
              title="Open in new tab"
              aria-label="Open preview in new tab"
            >
              <ExternalLink size={13} />
            </a>
          )}
          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="p-1.5 rounded-full text-[var(--fb-muted)] hover:text-[var(--fb-ink)] hover:bg-[var(--fb-soft)] transition-colors"
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            <Maximize2 size={13} />
          </button>
          {hasProject && (
            <button
              onClick={handleCompileWeb}
              disabled={isBuilding}
              title={isBuilding ? 'Compiling Flutter Web' : 'Compile Flutter Web'}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold transition-colors disabled:opacity-50',
                isRunning
                  ? 'bg-[var(--fb-lime)] text-black'
                  : isBuilding
                    ? 'bg-[var(--fb-cyan)] text-black'
                    : 'bg-[var(--fb-ink)] text-[var(--fb-bg)]'
              )}
            >
              {isBuilding ? <Loader2 size={11} className="animate-spin" /> : <Hammer size={11} />}
              <span className="hidden sm:inline">{isBuilding ? 'Compiling…' : 'Compile'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Preview canvas ──────────────────────────────────────── */}
      <div ref={containerRef} className="flex-1 flex items-center justify-center overflow-hidden relative p-4">
        {/* Paper canvas: no synthetic mock — the real Flutter build lives in the device. */}
        <div className="absolute inset-0 bg-[var(--fb-bg)] ffb-workspace-grid" />

        {/* ── Device frame ── */}
        <div
          className="relative z-10 transition-all duration-300"
          style={{ width: displayW, height: displayH }}
        >
          {/* Outer device shell (Titanium bezel with ambient studio lighting - no harsh neon shadows) */}
          <div
            className={cn(
              'absolute inset-0 bg-gradient-to-b from-[#22242c] via-[#16171d] to-[#101116]',
              previewDevice === 'iPhone 15 Pro'
                ? 'rounded-[44px]'
                : previewDevice === 'iPad Pro'
                ? 'rounded-[32px]'
                : 'rounded-[16px]',
            )}
            style={{
              boxShadow:
                previewDevice === 'iPhone 15 Pro'
                  ? '0 0 0 1px rgba(255, 255, 255, 0.14), 0 0 0 4px #1c1d24, 0 0 0 6px #0d0e12, 0 30px 70px -15px rgba(0, 0, 0, 0.75), 0 0 30px rgba(0, 0, 0, 0.35)'
                  : previewDevice === 'iPad Pro'
                  ? '0 0 0 1px rgba(255, 255, 255, 0.12), 0 0 0 4px #1c1d24, 0 0 0 6px #0d0e12, 0 35px 80px -20px rgba(0, 0, 0, 0.75)'
                  : '0 0 0 1px rgba(255, 255, 255, 0.1), 0 0 0 3px #1c1d24, 0 25px 60px -15px rgba(0, 0, 0, 0.65)',
            }}
          />

          {/* Physical Side Buttons (iPhone only) */}
          {previewDevice === 'iPhone 15 Pro' && isPortrait && (
            <>
              {/* Action Button */}
              <div className="w-[3px] h-7 bg-[#2e303a] absolute -left-[5px] top-24 rounded-l-sm border-r border-black/40 pointer-events-none" />
              {/* Volume Up */}
              <div className="w-[3px] h-12 bg-[#2e303a] absolute -left-[5px] top-36 rounded-l-sm border-r border-black/40 pointer-events-none" />
              {/* Volume Down */}
              <div className="w-[3px] h-12 bg-[#2e303a] absolute -left-[5px] top-52 rounded-l-sm border-r border-black/40 pointer-events-none" />
              {/* Power / Side Button */}
              <div className="w-[3px] h-16 bg-[#2e303a] absolute -right-[5px] top-40 rounded-r-sm border-l border-black/40 pointer-events-none" />
            </>
          )}

          {/* Dynamic Island (iPhone portrait) */}
          {previewDevice === 'iPhone 15 Pro' && isPortrait && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-full z-20 flex items-center justify-between px-3 pointer-events-none select-none shadow-[0_1px_4px_rgba(0,0,0,0.8),inset_0_0_1px_rgba(255,255,255,0.2)]">
              {/* Front Camera with optical lens reflection */}
              <div className="w-2.5 h-2.5 rounded-full bg-[#08080f] border border-[#1e202e] flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-[#1b2640]/90" />
              </div>
              {/* Sensor */}
              <div className="w-2 h-2 rounded-full bg-[#0a0a0e]" />
            </div>
          )}

          {/* Screen Content */}
          <div
            className={cn(
              'absolute overflow-hidden bg-slate-950',
              previewDevice === 'iPhone 15 Pro'
                ? 'rounded-[38px]'
                : previewDevice === 'iPad Pro'
                ? 'rounded-[26px]'
                : 'rounded-[12px]',
            )}
            style={{
              inset: previewDevice === 'iPhone 15 Pro' ? 6 : previewDevice === 'iPad Pro' ? 8 : 4,
            }}
          >
            {renderScreenContent()}
          </div>

          {/* Home indicator bar (phones) */}
          {previewDevice === 'iPhone 15 Pro' && isPortrait && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 rounded-full bg-white/40 backdrop-blur-sm z-20 pointer-events-none select-none" />
          )}
        </div>

        {/* Dims label */}
        <div className="absolute bottom-3 right-3 text-[9px] font-mono text-white/20">
          {rawW}×{rawH} · {Math.round(scale * 100)}%
        </div>
      </div>

      <VisualQAPanel
        open={qaOpen}
        onClose={() => setQaOpen(false)}
        projectId={projectId}
        previewUrl={previewUrl}
      />

    </div>
  );
}
