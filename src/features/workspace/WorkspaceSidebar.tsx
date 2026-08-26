import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { useProjectStore } from '@/stores/project.store';
import { SIDEBAR_SECTIONS } from '@/utils/constants';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/utils/cn';

export function WorkspaceSidebar() {
  const navigate = useNavigate();
  const { activeView, setActiveView, sidebarCollapsed, toggleSidebar } = useWorkspaceStore();
  const { currentProject } = useProjectStore();

  return (
    <aside
      className={cn(
        'flex flex-col bg-[var(--ff-surface)] border-r border-[var(--ff-border)] transition-all duration-200 shrink-0',
        sidebarCollapsed ? 'w-14' : 'w-56'
      )}
    >
      {/* Logo / collapse */}
      <div className="flex items-center justify-between h-12 px-3 border-b border-[var(--ff-border)]">
        {!sidebarCollapsed && (
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-sm font-bold text-white truncate"
          >
            <Icons.Sparkles size={16} className="text-[var(--ff-primary)] shrink-0" />
            <span className="truncate">{currentProject?.name ?? 'FlutterForge'}</span>
          </button>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-md text-[var(--ff-text-dim)] hover:text-white hover:bg-[var(--ff-surface-2)] transition-colors shrink-0"
        >
          {sidebarCollapsed ? <Icons.ChevronRight size={16} /> : <Icons.ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto ff-scrollbar py-2 px-2 space-y-4">
        {SIDEBAR_SECTIONS.map((section) => (
          <div key={section.label}>
            {!sidebarCollapsed && (
              <p className="text-[10px] font-semibold text-[var(--ff-text-dim)] uppercase tracking-wider px-2 mb-1">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = (Icons as unknown as Record<string, LucideIcon>)[item.icon] ?? Icons.Circle;
                const isActive = activeView === item.id;
                const button = (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id as typeof activeView)}
                    className={cn(
                      'flex items-center gap-2.5 w-full px-2 py-1.5 rounded-md text-xs font-medium transition-colors',
                      sidebarCollapsed && 'justify-center',
                      isActive
                        ? 'bg-[var(--ff-primary)]/10 text-[var(--ff-primary)]'
                        : 'text-[var(--ff-text-muted)] hover:text-white hover:bg-[var(--ff-surface-2)]'
                    )}
                  >
                    <Icon size={16} className="shrink-0" />
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
                return sidebarCollapsed ? (
                  <Tooltip key={item.id} label={item.label} side="right">
                    {button}
                  </Tooltip>
                ) : (
                  button
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: back to dashboard */}
      <div className="border-t border-[var(--ff-border)] p-2">
        <Tooltip label="Dashboard" side="right">
          <button
            onClick={() => navigate('/dashboard')}
            className={cn(
              'flex items-center gap-2.5 w-full px-2 py-1.5 rounded-md text-xs font-medium text-[var(--ff-text-muted)] hover:text-white hover:bg-[var(--ff-surface-2)] transition-colors',
              sidebarCollapsed && 'justify-center'
            )}
          >
            <Icons.LayoutGrid size={16} className="shrink-0" />
            {!sidebarCollapsed && <span>Dashboard</span>}
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}
