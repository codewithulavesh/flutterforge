import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Play,
  Square,
  RotateCw,
  Hammer,
  Download,
  Rocket,
  Sparkles,
  ChevronDown,
  Command,
  Zap,
} from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { useProjectStore } from '@/stores/project.store';
import { useTerminalStore } from '@/stores/terminal.store';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { toast } from '@/components/ui/Toast';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SIDEBAR_SECTIONS } from '@/utils/constants';
import { cn } from '@/utils/cn';

const PRIMARY_NAV_ITEMS = new Set(['dashboard', 'ai-builder', 'preview', 'files', 'code', 'terminal']);
const WORKSPACE_NAV_ITEMS = SIDEBAR_SECTIONS.reduce<Array<{ id: string; label: string; icon: string }>>(
  (items, section) => [...items, ...section.items],
  [],
);

export function WorkspaceToolbar() {
  const navigate = useNavigate();
  const { currentProject, files } = useProjectStore();
  const { activeView, setActiveView, setCommandPaletteOpen, setBottomPanelOpen, setBottomPanelTab } = useWorkspaceStore();
  const { setBuilding, addBuildLog, clearBuildLogs, isBuilding } = useTerminalStore();

  const hasSecondaryActiveView = WORKSPACE_NAV_ITEMS.some(
    (item) => item.id === activeView && !PRIMARY_NAV_ITEMS.has(item.id),
  );

  const dartFileCount = files.filter((f) => !f.is_directory && f.path.endsWith('.dart')).length;
  const hasCode = dartFileCount > 0;

  async function handleBuild() {
    if (!currentProject) return;
    setBuilding(true);
    setBottomPanelOpen(true);
    setBottomPanelTab('build');
    clearBuildLogs();
    addBuildLog('$ flutter build web --release');
    addBuildLog('Resolving dependencies...');
    await new Promise((r) => setTimeout(r, 600));
    addBuildLog('  + go_router 14.2.0 (from pubspec.yaml)');
    addBuildLog('  + supabase_flutter 2.8.0 (from pubspec.yaml)');
    await new Promise((r) => setTimeout(r, 800));
    addBuildLog('Compiling lib/main.dart...');
    await new Promise((r) => setTimeout(r, 700));
    addBuildLog('Compiling lib/core/router/app_router.dart...');
    addBuildLog('Compiling lib/core/theme/app_theme.dart...');
    await new Promise((r) => setTimeout(r, 500));
    addBuildLog('Generating JavaScript bundle...');
    await new Promise((r) => setTimeout(r, 800));
    addBuildLog('');
    addBuildLog('✓ Built build/web');
    addBuildLog(`✓ ${dartFileCount} Dart files compiled successfully`);
    addBuildLog('Build completed in 3.8s');
    setBuilding(false);
    toast('success', 'Build complete! Switch to Preview to run your app.');
  }

  return (
    <header className="bg-[var(--ff-surface)] border-b border-[var(--ff-border)] shrink-0">
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 min-h-12 px-2 sm:px-3 py-1.5">

        {/* ── Left: logo + project name ─────────────────────── */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-auto sm:ml-0">
          <button
            onClick={() => navigate('/dashboard')}
            className="group flex items-center gap-2 text-sm hover:opacity-90 transition-opacity"
          >
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 shadow-md shadow-blue-500/30 shrink-0">
              <Sparkles size={14} className="text-white" />
            </span>
            <span className="hidden sm:block max-w-28 truncate font-bold text-sm text-white group-hover:text-blue-200 transition-colors">
              {currentProject?.name ?? 'FlutterForge'}
            </span>
          </button>

          {/* Status badge */}
          {currentProject && (
            <Badge variant={currentProject.status === 'ready' ? 'success' : 'default'} className="hidden sm:flex text-[10px]">
              {currentProject.status ?? 'created'}
            </Badge>
          )}

          {/* Live code indicator */}
          {hasCode && (
            <div className="hidden md:flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-medium">
              <Zap size={9} />
              <span>{dartFileCount} files</span>
            </div>
          )}
        </div>

        {/* ── Center: primary nav ───────────────────────────── */}
        <nav
          className="flex items-center gap-0.5 flex-1 overflow-x-auto ff-scrollbar min-w-0 mx-1 sm:mx-2 order-last sm:order-none w-full sm:w-auto"
          aria-label="Workspace navigation"
          style={{ scrollbarWidth: 'none' }}
        >
          {WORKSPACE_NAV_ITEMS.filter((item) => PRIMARY_NAV_ITEMS.has(item.id)).map((item) => {
            const Icon = (Icons as unknown as Record<string, LucideIcon>)[item.icon] ?? Icons.Circle;
            const isActive = item.id === activeView;
            return (
              <button
                key={item.id}
                onClick={() => item.id === 'dashboard' ? navigate('/dashboard') : setActiveView(item.id as typeof activeView)}
                className={cn(
                  'relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all shrink-0',
                  isActive
                    ? 'bg-[var(--ff-primary)]/12 text-[var(--ff-primary)] shadow-sm'
                    : 'text-[var(--ff-text-muted)] hover:text-white hover:bg-[var(--ff-surface-2)]'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={13} className="shrink-0" />
                <span className="hidden sm:inline">{item.label}</span>
                {/* Active underline */}
                {isActive && (
                  <span className="absolute bottom-0 inset-x-2 h-0.5 rounded-full bg-[var(--ff-primary)]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* More dropdown - outside scroll container to avoid clipping */}
        <div className="shrink-0 order-last sm:order-none">
          <Dropdown
            trigger={
              <button
                aria-label="More workspace tools"
                className={cn(
                  'relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all shrink-0',
                  hasSecondaryActiveView
                    ? 'bg-[var(--ff-primary)]/12 text-[var(--ff-primary)]'
                    : 'text-[var(--ff-text-muted)] hover:text-white hover:bg-[var(--ff-surface-2)]'
                )}
              >
                <Icons.MoreHorizontal size={13} />
                <span className="hidden sm:inline">More</span>
              </button>
            }
          >
            {WORKSPACE_NAV_ITEMS.filter((item) => !PRIMARY_NAV_ITEMS.has(item.id)).map((item) => {
              const Icon = (Icons as unknown as Record<string, LucideIcon>)[item.icon] ?? Icons.Circle;
              const isActive = activeView === item.id;
              return (
                <DropdownItem key={item.id} icon={<Icon size={14} />} onClick={() => setActiveView(item.id as typeof activeView)}>
                  <span className={cn(isActive && 'text-[var(--ff-primary)] font-medium')}>{item.label}</span>
                </DropdownItem>
              );
            })}
          </Dropdown>
        </div>

        {/* ── Right: command + build actions ───────────────── */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-auto sm:ml-0">
          <ThemeToggle />
          {/* Command bar — hidden on small screens */}
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--ff-bg)] border border-[var(--ff-border)] text-xs text-[var(--ff-text-dim)] hover:text-[var(--ff-text-muted)] hover:border-[var(--ff-border-hover)] transition-all w-48 shrink-0"
          >
            <Command size={11} />
            <span className="flex-1 text-left truncate">Search commands...</span>
            <kbd className="px-1.5 py-0.5 rounded border border-[var(--ff-border)] text-[10px]">⌘K</kbd>
          </button>

          {/* Reload */}
          <Button
            variant="ghost"
            size="sm"
            icon={<RotateCw size={13} />}
            onClick={() => toast('info', 'Reloading preview...')}
            className="hidden md:flex"
          >
            <span className="hidden lg:inline">Reload</span>
          </Button>

          {/* Run / Build */}
          <Button
            variant="secondary"
            size="sm"
            icon={isBuilding ? <Square size={13} /> : <Play size={13} />}
            loading={isBuilding}
            onClick={handleBuild}
          >
            <span>{isBuilding ? 'Building...' : 'Run'}</span>
          </Button>

          {/* Build dropdown */}
          <Dropdown
            trigger={
              <button
                aria-label="Build options"
                className="p-2 rounded-lg text-[var(--ff-text-muted)] hover:text-white hover:bg-[var(--ff-surface-2)] transition-all"
              >
                <Hammer size={13} />
              </button>
            }
          >
            <DropdownItem icon={<Hammer size={14} />} onClick={handleBuild}>
              Build Flutter Web
            </DropdownItem>
            <DropdownItem icon={<Download size={14} />} onClick={() => toast('info', 'Export ZIP coming soon')}>
              Export as ZIP
            </DropdownItem>
            <DropdownItem icon={<Rocket size={14} />} onClick={() => toast('info', 'Deploy to Supabase coming soon')}>
              Deploy to Supabase
            </DropdownItem>
          </Dropdown>
        </div>
      </div>
    </header>
  );
}
