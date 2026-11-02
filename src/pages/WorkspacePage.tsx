import { lazy, Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useProjectStore } from '@/stores/project.store';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { useTerminalStore } from '@/stores/terminal.store';
import { usePreviewStore } from '@/stores/preview.store';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
const WorkspaceToolbar = lazy(() => import('@/features/workspace/WorkspaceToolbar').then((module) => ({ default: module.WorkspaceToolbar })));
const AIBuilderPanel = lazy(() => import('@/features/workspace/AIBuilderPanel').then((module) => ({ default: module.AIBuilderPanel })));
const FileExplorer = lazy(() => import('@/features/workspace/FileExplorer').then((module) => ({ default: module.FileExplorer })));
const CodeEditor = lazy(() => import('@/features/workspace/CodeEditor').then((module) => ({ default: module.CodeEditor })));
const PreviewPanel = lazy(() => import('@/features/workspace/PreviewPanel').then((module) => ({ default: module.PreviewPanel })));
const TerminalPanel = lazy(() => import('@/features/workspace/TerminalPanel').then((module) => ({ default: module.TerminalPanel })));
const DependenciesView = lazy(() => import('@/features/workspace/DependenciesView').then((module) => ({ default: module.DependenciesView })));
const VersionsView = lazy(() => import('@/features/workspace/VersionsView').then((module) => ({ default: module.VersionsView })));
const SettingsView = lazy(() => import('@/features/workspace/SettingsView').then((module) => ({ default: module.SettingsView })));
const ExportView = lazy(() => import('@/features/workspace/ExportView').then((module) => ({ default: module.ExportView })));
const CommandPalette = lazy(() => import('@/features/workspace/CommandPalette').then((module) => ({ default: module.CommandPalette })));
import { FullPageSpinner } from '@/components/ui/Spinner';
import { Terminal as TerminalIcon, Hammer, Sparkles } from 'lucide-react';
import { cn } from '@/utils/cn';

const AI_PANEL_MIN = 300;
const AI_PANEL_MAX = 600;
const AI_PANEL_DEFAULT = 360;

export function WorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { currentProject, loadProject, clearCurrent } = useProjectStore();
  const {
    activeView,
    bottomPanelOpen,
    bottomPanelTab,
    setBottomPanelTab,
    setBottomPanelOpen,
  } = useWorkspaceStore();

  const [aiPanelWidth, setAiPanelWidth] = useState(AI_PANEL_DEFAULT);
  const [isDragging, setIsDragging] = useState(false);
  // 'pending' until the loadProject promise for the current projectId settles.
  // The store's `loading` flag starts false on a fresh page load (before the
  // effect below ever runs), so relying on it made the guard below redirect to
  // /dashboard on first render — hard reloads of /project/:id bounced straight
  // back to the dashboard even though the fetch was about to succeed.
  const [projectLoadState, setProjectLoadState] = useState<'pending' | 'settled'>('pending');
  const loadSeq = useRef(0);

  useKeyboardShortcuts();

  useEffect(() => {
    if (!projectId) return;
    const seq = ++loadSeq.current;
    setProjectLoadState('pending');
    // Hydrate the preview-build session (status/logs) from the local harness
    // so build state and the "Fix automatically" repair card survive a page
    // reload. Fire-and-forget: a missing/offline harness is not an error.
    void usePreviewStore.getState().checkProjectStatus(projectId).catch(() => {});
    Promise.resolve(loadProject(projectId)).then(() => {
      // Ignore stale loads (e.g. StrictMode's double effect run).
      if (loadSeq.current === seq) setProjectLoadState('settled');
    });
    return () => {
      loadSeq.current++;
      clearCurrent();
    };
  }, [projectId, loadProject, clearCurrent]);

  // Resizable divider drag logic
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const startX = e.clientX;
    const startWidth = aiPanelWidth;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      // Never let the AI panel eat the explorer + main view on narrower windows.
      const viewportMax = Math.max(AI_PANEL_MIN, Math.min(AI_PANEL_MAX, window.innerWidth - 480));
      const next = Math.min(viewportMax, Math.max(AI_PANEL_MIN, startWidth + delta));
      setAiPanelWidth(next);
    };
    const onMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [aiPanelWidth]);

  if (currentProject) {
    // fall through to the workspace UI
  } else if (!projectId || projectLoadState === 'pending') {
    return <FullPageSpinner label="Loading project..." />;
  } else {
    return <Navigate to="/dashboard" replace />;
  }

  // On narrow screens the AI Builder is reached from the workspace navigation
  // as a full-page view. Keeping a second chat pane here would squeeze the
  // editor and preview below a useful size.
  const showAiPanel = activeView !== 'ai-builder';
  const showFileExplorer = activeView === 'code' || activeView === 'files';

  return (
    <div className={cn('flex h-dvh overflow-hidden bg-[var(--ff-bg)] ff-studio', isDragging && 'select-none cursor-col-resize')}>
      <div className="flex-1 flex flex-col min-w-0 mx-auto w-full max-w-[1800px]">
        <Suspense fallback={<div className="h-[60px] shrink-0 border-b border-[var(--ff-border)] bg-[var(--ff-surface)]" />}>
          <WorkspaceToolbar />
        </Suspense>
        <Suspense fallback={null}>
          <CommandPalette />
        </Suspense>

        {/* Keep the work surface usable on phones and tablets. Side panels join
            the canvas only when there is enough horizontal room. */}
        <div className="flex-1 flex flex-col xl:flex-row min-h-0 bg-[var(--ff-bg)]">

          {/* AI Builder Panel - responsive drawer on mobile */}
          {showAiPanel && (
            <>
              <div
                style={{ width: aiPanelWidth, minWidth: AI_PANEL_MIN, maxWidth: AI_PANEL_MAX }}
                className="hidden xl:flex shrink-0 flex-col border-r border-[var(--ff-border)] bg-[var(--ff-surface)] transition-none overflow-hidden h-full"
              >
                <Suspense fallback={<div className="h-full" />}><AIBuilderPanel /></Suspense>
              </div>
              {/* Drag handle - hidden on mobile */}
              <div
                onMouseDown={handleMouseDown}
                className="hidden xl:flex w-1 shrink-0 cursor-col-resize hover:bg-[var(--ff-primary)]/50 active:bg-[var(--ff-primary)] transition-colors group relative"
                title="Drag to resize AI panel"
              >
                <div className="absolute inset-y-0 -left-1 -right-1" />
              </div>
            </>
          )}

          {/* On phones the file list becomes a short top panel; on wide screens
              it sits beside the editor as a conventional explorer sidebar. */}
          {showFileExplorer && (
            <div className="w-full xl:w-60 shrink-0 border-b xl:border-b-0 xl:border-r border-[var(--ff-border)] h-[min(24vh,220px)] xl:h-auto overflow-hidden">
              <Suspense fallback={<div className="h-full" />}><FileExplorer /></Suspense>
            </div>
          )}

          {/* Center: main view — preview is hidden until generation completes */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 min-h-0 overflow-hidden">
              <Suspense fallback={<FullPageSpinner label="Loading workspace view..." />}>
                {renderMainView(activeView)}
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderMainView(view: string) {
  switch (view) {
    case 'ai-builder':
      return <AIBuilderPanel variant="page" />;
    case 'code':
    case 'files':
      return <CodeEditor />;
    case 'preview':
      return <PreviewPanel />;
    case 'dependencies':
      return <DependenciesView />;
    case 'versions':
      return <VersionsView />;
    case 'settings':
      return <SettingsView />;
    case 'export':
      return <ExportView />;
    case 'terminal':
      return <TerminalPanel />;
    default:
      return <PreviewPanel />;
  }
}

function BottomTab({ id, icon, label, active, onClick }: {
  id: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onClick(id)}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-t transition-colors',
        active ? 'text-[var(--ff-primary)] border-b-2 border-[var(--ff-primary)]' : 'text-[var(--ff-text-dim)] hover:text-[var(--ff-text-muted)]'
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function AIActivityPanel() {
  const events = useTerminalStore((s) => s.agentEvents);
  const clearEvents = useTerminalStore((s) => s.clearAgentEvents);
  const isGenerating = useTerminalStore((s) => s.isGenerating);
  const currentPhase = useTerminalStore((s) => s.currentPhase);

  const getPhaseBadgeColor = (phase?: string) => {
    switch (phase) {
      case 'completed':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'failed':
      case 'auto_healing':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'code_generation':
      case 'batch_generation':
      case 'incremental_edit':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'planning':
      case 'schema_design':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'validation':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default:
        return 'bg-[var(--ff-surface-2)] text-[var(--ff-text-muted)] border-[var(--ff-border)]';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--ff-bg)] text-xs font-mono">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-[var(--ff-border)] bg-[var(--ff-surface)] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-[var(--ff-text)] truncate">Harness Agent Stream</span>
          {isGenerating ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 animate-pulse shrink-0">
              ● Engine Active
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--ff-surface-2)] text-[var(--ff-text-dim)] shrink-0">
              Idle
            </span>
          )}
          {currentPhase && (
            <span className="text-[11px] text-[var(--ff-text-muted)] truncate max-w-[120px] sm:max-w-[280px]">
              {currentPhase}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-[var(--ff-text-dim)]">{events.length} event{events.length === 1 ? '' : 's'}</span>
          {events.length > 0 && (
            <button
              onClick={clearEvents}
              className="px-2 py-0.5 rounded text-[10px] text-[var(--ff-text-dim)] hover:text-[var(--ff-text)] hover:bg-[var(--ff-surface-2)] transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto ff-scrollbar p-2 space-y-1.5">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4 text-[var(--ff-text-dim)]">
            <p>No agent events recorded yet.</p>
            <p className="text-[11px] text-[var(--ff-text-dim)]/70 mt-1">
              Events from the DeepSeek Harness engine (planning, file writes, Dart analysis, and validation) stream here in real time.
            </p>
          </div>
        ) : (
          events.map((ev, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 p-1.5 rounded border border-[var(--ff-border)] bg-[var(--ff-surface)]/60 hover:bg-[var(--ff-surface)] transition-colors"
            >
              <span className="text-[10px] text-[var(--ff-text-dim)] shrink-0 pt-0.5">
                {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : `#${idx + 1}`}
              </span>
              {ev.node && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--ff-primary)]/10 text-[var(--ff-primary)] shrink-0 border border-[var(--ff-border)] uppercase tracking-wider">
                  {ev.node}
                </span>
              )}
              {ev.phase && (
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[10px] border shrink-0',
                    getPhaseBadgeColor(ev.phase)
                  )}
                >
                  {ev.phase}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <span className="text-[var(--ff-text)]">{ev.message}</span>
                {ev.activeFile && (
                  <span className="ml-2 text-indigo-400 font-mono text-[11px]">
                    📄 {ev.activeFile}
                  </span>
                )}
                {ev.detail && (
                  <p className="text-[11px] text-[var(--ff-text-muted)] mt-0.5 break-words">
                    {ev.detail}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
