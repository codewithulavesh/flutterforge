import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjectStore } from '@/stores/project.store';
import { useWorkspaceStore } from '@/stores/workspace.store';
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
import { CommandPalette } from '@/features/workspace/CommandPalette';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { Terminal as TerminalIcon, AlertTriangle, Hammer, Sparkles } from 'lucide-react';
import { cn } from '@/utils/cn';

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

  useKeyboardShortcuts();

  useEffect(() => {
    if (projectId) {
      loadProject(projectId);
    }
    return () => clearCurrent();
  }, [projectId]);

  if (loading && !currentProject) return <FullPageSpinner label="Loading project..." />;
  if (!currentProject) {
    navigate('/dashboard');
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--ff-bg)]">
      <CommandPalette />

      <div className="flex-1 flex flex-col min-w-0">
        <WorkspaceToolbar />

        {/* Main content area */}
        <div className="flex-1 flex min-h-0">
          {/* Left panel: file explorer or AI builder */}
          {(activeView === 'ai-builder' || activeView === 'code' || activeView === 'files') && (
            <div className="w-64 border-r border-[var(--ff-border)] shrink-0">
              {activeView === 'ai-builder' ? <AIBuilderPanel /> : <FileExplorer />}
            </div>
          )}

          {/* Center: main view */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 min-h-0 overflow-hidden">
              {renderMainView(activeView)}
            </div>

            {/* Bottom panel */}
            {bottomPanelOpen && (
              <div className="h-48 border-t border-[var(--ff-border)] flex flex-col shrink-0">
                <div className="flex items-center gap-1 px-2 py-1 border-b border-[var(--ff-border)] bg-[var(--ff-surface)] shrink-0">
                  <BottomTab id="terminal" icon={<TerminalIcon size={12} />} label="Terminal" active={bottomPanelTab === 'terminal'} onClick={(id) => setBottomPanelTab(id as typeof bottomPanelTab)} />
                  <BottomTab id="problems" icon={<AlertTriangle size={12} />} label="Problems" active={bottomPanelTab === 'problems'} onClick={(id) => setBottomPanelTab(id as typeof bottomPanelTab)} />
                  <BottomTab id="build" icon={<Hammer size={12} />} label="Build" active={bottomPanelTab === 'build'} onClick={(id) => setBottomPanelTab(id as typeof bottomPanelTab)} />
                  <BottomTab id="ai-activity" icon={<Sparkles size={12} />} label="AI Activity" active={bottomPanelTab === 'ai-activity'} onClick={(id) => setBottomPanelTab(id as typeof bottomPanelTab)} />
                  <button
                    onClick={() => setBottomPanelOpen(false)}
                    className="ml-auto px-2 py-1 text-xs text-[var(--ff-text-dim)] hover:text-white"
                  >
                    Close
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
    case 'code':
      return <CodeEditor />;
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
