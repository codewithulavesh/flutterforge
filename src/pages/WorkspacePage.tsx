import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjectStore } from '@/stores/project.store';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { useTerminalStore } from '@/stores/terminal.store';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { WorkspaceToolbar } from '@/features/workspace/WorkspaceToolbar';
import { AIBuilderPanel } from '@/features/workspace/AIBuilderPanel';
import { FileExplorer } from '@/features/workspace/FileExplorer';
import { CodeEditor } from '@/features/workspace/CodeEditor';
import { PreviewPanel } from '@/features/workspace/PreviewPanel';
import { TerminalPanel } from '@/features/workspace/TerminalPanel';
import { ProblemsPanel } from '@/features/workspace/ProblemsPanel';
import { BuildOutputPanel } from '@/features/workspace/BuildOutputPanel';
import { ThemeEditor } from '@/features/workspace/ThemeEditor';
import { ComponentsView } from '@/features/workspace/ComponentsView';
import { DependenciesView } from '@/features/workspace/DependenciesView';
import { VersionsView } from '@/features/workspace/VersionsView';
import { GitView } from '@/features/workspace/GitView';
import { SettingsView } from '@/features/workspace/SettingsView';
import { DeployView } from '@/features/workspace/DeployView';
import { ExportView } from '@/features/workspace/ExportView';
import { ConnectorsView } from '@/features/workspace/ConnectorsView';
import { CommandPalette } from '@/features/workspace/CommandPalette';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { Terminal as TerminalIcon, AlertTriangle, Hammer, Sparkles } from 'lucide-react';
import { cn } from '@/utils/cn';

const AI_PANEL_MIN = 300;
const AI_PANEL_MAX = 600;
const AI_PANEL_DEFAULT = 360;

export function WorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { currentProject, loading, loadProject, clearCurrent } = useProjectStore();
  const {
    activeView,
    bottomPanelOpen,
    bottomPanelTab,
    setBottomPanelTab,
    setBottomPanelOpen,
  } = useWorkspaceStore();
  const { isGenerating } = useTerminalStore();

  const [aiPanelWidth, setAiPanelWidth] = useState(AI_PANEL_DEFAULT);
  const [isDragging, setIsDragging] = useState(false);

  useKeyboardShortcuts();

  useEffect(() => {
    if (projectId) {
      loadProject(projectId);
    }
    return () => clearCurrent();
  }, [projectId]);

  // Resizable divider drag logic
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const startX = e.clientX;
    const startWidth = aiPanelWidth;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const next = Math.min(AI_PANEL_MAX, Math.max(AI_PANEL_MIN, startWidth + delta));
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

  if (loading && !currentProject) return <FullPageSpinner label="Loading project..." />;
  if (!currentProject) {
    navigate('/dashboard');
    return null;
  }

  const showAiPanel = true; // persistent AI chat across Preview/Files/Code/Terminal/More (user request)
  const showFileExplorer = activeView === 'code' || activeView === 'files';

  return (
    <div className={cn('flex h-screen overflow-hidden bg-[var(--ff-bg)]', isDragging && 'select-none cursor-col-resize')}>
      <CommandPalette />

      <div className="flex-1 flex flex-col min-w-0">
        <WorkspaceToolbar />

        {/* Main content area - responsive: column on mobile, row on desktop */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">

          {/* AI Builder Panel - responsive drawer on mobile */}
          {showAiPanel && (
            <>
              <div
                style={{ width: isDragging ? aiPanelWidth : undefined }}
                className="shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r border-[var(--ff-border)] bg-[var(--ff-surface)] transition-none overflow-hidden w-full lg:w-auto h-[45vh] sm:h-[50vh] lg:h-auto lg:shrink-0"
              >
                <div
                  style={{ width: aiPanelWidth, minWidth: AI_PANEL_MIN, maxWidth: AI_PANEL_MAX }}
                  className="hidden lg:flex flex-col w-full h-full overflow-hidden shrink-0"
                >
                  <AIBuilderPanel />
                </div>
                <div className="flex lg:hidden flex-col w-full h-full overflow-hidden">
                  <AIBuilderPanel />
                </div>
              </div>
              {/* Drag handle - hidden on mobile */}
              <div
                onMouseDown={handleMouseDown}
                className="hidden lg:flex w-1 shrink-0 cursor-col-resize hover:bg-[var(--ff-primary)]/50 active:bg-[var(--ff-primary)] transition-colors group relative"
                title="Drag to resize AI panel"
              >
                <div className="absolute inset-y-0 -left-1 -right-1" />
              </div>
            </>
          )}

          {/* File Explorer - hidden on mobile, drawer on tablet */}
          {showFileExplorer && (
            <div className="w-full sm:w-60 lg:w-60 shrink-0 border-b lg:border-b-0 lg:border-r border-[var(--ff-border)] h-[30vh] sm:h-[35vh] lg:h-auto overflow-hidden">
              <FileExplorer />
            </div>
          )}

          {/* Center: main view - AI Builder shows Preview (not Files) */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 min-h-0 overflow-hidden">
              {isGenerating && activeView === 'ai-builder' ? <PreviewPanel /> : renderMainView(activeView)}
            </div>

            {/* Bottom panel */}
            {bottomPanelOpen && (
              <div className="h-40 sm:h-48 border-t border-[var(--ff-border)] flex flex-col shrink-0">
                <div className="flex items-center gap-1 px-2 py-1 border-b overflow-x-auto ff-scrollbar flex-nowrap border-[var(--ff-border)] bg-[var(--ff-surface)] shrink-0">
                  <BottomTab id="terminal" icon={<TerminalIcon size={12} />} label="Terminal" active={bottomPanelTab === 'terminal'} onClick={(id) => setBottomPanelTab(id as typeof bottomPanelTab)} />
                  <BottomTab id="problems" icon={<AlertTriangle size={12} />} label="Problems" active={bottomPanelTab === 'problems'} onClick={(id) => setBottomPanelTab(id as typeof bottomPanelTab)} />
                  <BottomTab id="build" icon={<Hammer size={12} />} label="Build" active={bottomPanelTab === 'build'} onClick={(id) => setBottomPanelTab(id as typeof bottomPanelTab)} />
                  <BottomTab id="ai-activity" icon={<Sparkles size={12} />} label="AI Activity" active={bottomPanelTab === 'ai-activity'} onClick={(id) => setBottomPanelTab(id as typeof bottomPanelTab)} />
                  <button
                    onClick={() => setBottomPanelOpen(false)}
                    className="ml-auto px-2 py-1 text-xs text-[var(--ff-text-dim)] hover:text-white"
                  >
                    ✕ Close
                  </button>
                </div>
                <div className="flex-1 min-h-0">
                  {bottomPanelTab === 'terminal' && <TerminalPanel />}
                  {bottomPanelTab === 'problems' && <ProblemsPanel />}
                  {bottomPanelTab === 'build' && <BuildOutputPanel />}
                  {bottomPanelTab === 'ai-activity' && <AIActivityPanel />}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function renderMainView(view: string) {
  switch (view) {
    case 'ai-builder':
      return <PreviewPanel />;
    case 'code':
    case 'files':
      return <CodeEditor />;
    case 'preview':
      return <PreviewPanel />;
    case 'theme':
      return <ThemeEditor />;
    case 'components':
      return <ComponentsView />;
    case 'dependencies':
      return <DependenciesView />;
    case 'versions':
      return <VersionsView />;
    case 'git':
      return <GitView />;
    case 'settings':
      return <SettingsView />;
    case 'deploy':
      return <DeployView />;
    case 'export':
      return <ExportView />;
    case 'connectors':
      return <ConnectorsView />;
    case 'terminal':
      return <TerminalPanel />;
    case 'problems':
      return <ProblemsPanel />;
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
  return (
    <div className="flex flex-col h-full bg-[var(--ff-bg)] p-3 overflow-y-auto ff-scrollbar">
      <p className="text-xs text-[var(--ff-text-muted)]">AI agent activity will appear here during generation.</p>
    </div>
  );
}
