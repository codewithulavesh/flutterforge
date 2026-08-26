import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Play, Square, RotateCw, Hammer, Download, Rocket, Sparkles, ChevronDown, Command } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { useProjectStore } from '@/stores/project.store';
import { useTerminalStore } from '@/stores/terminal.store';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { toast } from '@/components/ui/Toast';
import { SIDEBAR_SECTIONS } from '@/utils/constants';
import { cn } from '@/utils/cn';

const PRIMARY_NAV_ITEMS = new Set(['dashboard', 'ai-builder', 'preview', 'files', 'code', 'terminal']);
const WORKSPACE_NAV_ITEMS = SIDEBAR_SECTIONS.reduce<Array<{ id: string; label: string; icon: string }>>(
  (items, section) => [...items, ...section.items],
  [],
);

export function WorkspaceToolbar() {
  const navigate = useNavigate();
  const { currentProject } = useProjectStore();
  const { activeView, setActiveView, setCommandPaletteOpen, setBottomPanelOpen, setBottomPanelTab } = useWorkspaceStore();
  const { setBuilding, addBuildLog, clearBuildLogs, isBuilding } = useTerminalStore();
  const hasSecondaryActiveView = WORKSPACE_NAV_ITEMS.some(
    (item) => item.id === activeView && !PRIMARY_NAV_ITEMS.has(item.id),
  );

  async function handleBuild() {
    if (!currentProject) return;
    setBuilding(true);
    setBottomPanelOpen(true);
    setBottomPanelTab('build');
    clearBuildLogs();
    addBuildLog('$ flutter build web --release');
    addBuildLog('Resolving dependencies...');
    await new Promise((r) => setTimeout(r, 800));
    addBuildLog('  + go_router 14.2.0');
    addBuildLog('  + provider 6.1.1');
    addBuildLog('Downloading Flutter SDK...');
    await new Promise((r) => setTimeout(r, 1000));
    addBuildLog('Compiling lib/main.dart...');
    await new Promise((r) => setTimeout(r, 1200));
    addBuildLog('Compiling lib/app.dart...');
    addBuildLog('Compiling lib/core/router/app_router.dart...');
    addBuildLog('Compiling lib/core/theme/app_theme.dart...');
    await new Promise((r) => setTimeout(r, 800));
    addBuildLog('Compiling lib/screens/home/home_screen.dart...');
    await new Promise((r) => setTimeout(r, 600));
    addBuildLog('');
    addBuildLog('Font asset "MaterialIcons" was not found');
    addBuildLog('Generating JavaScript bundle...');
    await new Promise((r) => setTimeout(r, 1000));
    addBuildLog('');
    addBuildLog('✓ Built build/web');
    addBuildLog('Build completed in 4.2s');
    setBuilding(false);
    toast('success', 'Build completed! Preview is ready.');
  }

  return (
    <header className="bg-[var(--ff-surface)] border-b border-[var(--ff-border)] shrink-0">
      <div className="flex items-center gap-3 min-h-12 px-3 py-1.5">
        {/* Left: project name + status */}
        <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => navigate('/dashboard')}
          className="group flex items-center gap-2 text-sm text-[var(--ff-text-muted)] hover:text-white transition-colors"
        >
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/20">
            <Sparkles size={14} className="text-white" />
          </span>
          <span className="max-w-32 truncate font-semibold text-white group-hover:text-blue-200">{currentProject?.name ?? 'Project'}</span>
          <ChevronDown size={14} />
        </button>
        <Badge variant={currentProject?.status === 'ready' ? 'success' : 'default'}>
          {currentProject?.status ?? 'created'}
        </Badge>
        </div>

        {/* Primary workspace navigation */}
        <nav className="flex items-center gap-1 min-w-0 flex-1 overflow-x-auto ff-scrollbar" aria-label="Workspace navigation">
          {WORKSPACE_NAV_ITEMS
            .filter((item) => PRIMARY_NAV_ITEMS.has(item.id))
            .map((item) => {
              const Icon = (Icons as unknown as Record<string, LucideIcon>)[item.icon] ?? Icons.Circle;
              const isActive = item.id === activeView;
              return (
                <button
                  key={item.id}
                  onClick={() => item.id === 'dashboard' ? navigate('/dashboard') : setActiveView(item.id as typeof activeView)}
                  className={cn(
                    'relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors shrink-0',
                    isActive
                      ? 'bg-[var(--ff-primary)]/10 text-[var(--ff-primary)] after:absolute after:inset-x-2 after:-bottom-1.5 after:h-0.5 after:rounded-full after:bg-[var(--ff-primary)]'
                      : 'text-[var(--ff-text-muted)] hover:text-white hover:bg-[var(--ff-surface-2)]'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={14} className="shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          <Dropdown
            trigger={
              <button
                aria-label="More workspace tools"
                className={cn(
                  'relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors shrink-0',
                  hasSecondaryActiveView
                    ? 'bg-[var(--ff-primary)]/10 text-[var(--ff-primary)] after:absolute after:inset-x-2 after:-bottom-1.5 after:h-0.5 after:rounded-full after:bg-[var(--ff-primary)]'
                    : 'text-[var(--ff-text-muted)] hover:text-white hover:bg-[var(--ff-surface-2)]',
                )}
              >
                <Icons.MoreHorizontal size={14} />
                <span>More</span>
              </button>
            }
          >
            {WORKSPACE_NAV_ITEMS
              .filter((item) => !PRIMARY_NAV_ITEMS.has(item.id))
              .map((item) => {
                const Icon = (Icons as unknown as Record<string, LucideIcon>)[item.icon] ?? Icons.Circle;
                return (
                  <DropdownItem key={item.id} icon={<Icon size={14} />} onClick={() => setActiveView(item.id as typeof activeView)}>
                    {item.label}
                  </DropdownItem>
                );
              })}
          </Dropdown>
        </nav>

        {/* Command bar */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="hidden lg:flex items-center gap-2 ml-auto px-3 py-1.5 rounded-lg bg-[var(--ff-bg)] border border-[var(--ff-border)] text-xs text-[var(--ff-text-dim)] hover:text-[var(--ff-text-muted)] hover:border-[var(--ff-border-hover)] transition-colors w-56 shrink-0"
        >
          <Command size={12} />
          <span className="flex-1 text-left">Search or run a command...</span>
          <kbd className="px-1.5 py-0.5 rounded border border-[var(--ff-border)] text-[10px]">⌘K</kbd>
        </button>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="ghost" size="sm" icon={<RotateCw size={14} />} onClick={() => toast('info', 'Reloading preview...')}>
            <span className="hidden sm:inline">Reload</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={isBuilding ? <Square size={14} /> : <Play size={14} />}
            loading={isBuilding}
            onClick={handleBuild}
          >
            <span className="hidden sm:inline">{isBuilding ? 'Building...' : 'Run'}</span>
          </Button>
          <Dropdown
            trigger={
              <button aria-label="More build actions" className="p-2 rounded-md text-[var(--ff-text-muted)] hover:text-white hover:bg-[var(--ff-surface-2)] transition-colors">
                <Hammer size={14} />
              </button>
            }
          >
            <DropdownItem icon={<Hammer size={14} />} onClick={handleBuild}>Build Web</DropdownItem>
            <DropdownItem icon={<Download size={14} />} onClick={() => toast('info', 'Export coming soon')}>Export ZIP</DropdownItem>
            <DropdownItem icon={<Rocket size={14} />} onClick={() => toast('info', 'Deploy coming soon')}>Deploy</DropdownItem>
          </Dropdown>
        </div>
      </div>

    </header>
  );
}
