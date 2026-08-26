import { Blocks, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { useProjectStore } from '@/stores/project.store';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { toast } from '@/components/ui/Toast';

const COMPONENT_LIBRARY = [
  { name: 'AppCard', description: 'A reusable card widget with padding, elevation, and tap callback', icon: 'CreditCard' },
  { name: 'AppButton', description: 'Primary action button with loading state', icon: 'MousePointerClick' },
  { name: 'AppTextField', description: 'Styled text input with label and error state', icon: 'TextCursorInput' },
  { name: 'AppListTile', description: 'List item with leading icon, title, subtitle, trailing', icon: 'List' },
  { name: 'AppAvatar', description: 'Circular avatar with image or initials fallback', icon: 'CircleUser' },
  { name: 'AppChip', description: 'Filter chip with selectable state', icon: 'Tag' },
  { name: 'AppBottomNav', description: 'Bottom navigation bar with configurable tabs', icon: 'PanelBottom' },
  { name: 'AppLoader', description: 'Loading indicator with optional message', icon: 'LoaderCircle' },
  { name: 'AppEmptyState', description: 'Empty state placeholder with icon and message', icon: 'PackageOpen' },
  { name: 'AppErrorWidget', description: 'Error display with retry callback', icon: 'AlertCircle' },
];

export function ComponentsView() {
  const { files } = useProjectStore();
  const { openFile } = useWorkspaceStore();
  const [search, setSearch] = useState('');

  const existingComponents = files.filter((f) => f.path.startsWith('lib/widgets/') && !f.is_directory);

  const filtered = COMPONENT_LIBRARY.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[var(--ff-bg)] overflow-y-auto ff-scrollbar">
      <div className="max-w-4xl mx-auto w-full p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Blocks size={18} className="text-[var(--ff-primary)]" />
          <h2 className="text-lg font-semibold text-white">Components</h2>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ff-text-dim)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search components..."
            className="ff-input w-full pl-9 pr-3 py-2 text-sm"
          />
        </div>

        {/* Existing components */}
        {existingComponents.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-[var(--ff-text-dim)] uppercase tracking-wider mb-3">In Your Project</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {existingComponents.map((file) => (
                <div
                  key={file.id}
                  onClick={() => openFile(file.path)}
                  className="ff-card p-4 hover:border-[var(--ff-border-hover)] cursor-pointer transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[var(--ff-primary)]/10 flex items-center justify-center mb-2">
                    <Blocks size={16} className="text-[var(--ff-primary)]" />
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-1">{file.path.split('/').pop()?.replace('.dart', '')}</h4>
                  <p className="text-xs text-[var(--ff-text-dim)] font-mono">{file.path}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Component library */}
        <div>
          <h3 className="text-xs font-semibold text-[var(--ff-text-dim)] uppercase tracking-wider mb-3">Component Library</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((comp) => (
              <div key={comp.name} className="ff-card p-4 hover:border-[var(--ff-border-hover)] transition-all group">
                <div className="flex items-start justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-[var(--ff-surface-2)] flex items-center justify-center">
                    <Blocks size={16} className="text-[var(--ff-text-muted)]" />
                  </div>
                  <button
                    onClick={() => toast('info', `Add ${comp.name} via AI Builder`)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--ff-text-dim)] hover:text-[var(--ff-primary)] transition-all"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <h4 className="text-sm font-semibold text-white mb-1">{comp.name}</h4>
                <p className="text-xs text-[var(--ff-text-muted)] leading-relaxed">{comp.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
