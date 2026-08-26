import { useState, useEffect, useRef } from 'react';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Search } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { COMMAND_PALETTE_COMMANDS } from '@/utils/constants';
import { toast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, setActiveView } = useWorkspaceStore();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen]);

  const filtered = COMMAND_PALETTE_COMMANDS.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  function handleSelect(id: string) {
    const cmd = COMMAND_PALETTE_COMMANDS.find((c) => c.id === id);
    if (!cmd) return;

    switch (id) {
      case 'open-file':
        setActiveView('files');
        break;
      case 'open-preview':
        setActiveView('preview');
        break;
      case 'open-ai-builder':
        setActiveView('ai-builder');
        break;
      case 'open-terminal':
        setActiveView('terminal');
        break;
      case 'run-analyze':
        toast('info', 'Running Flutter analyze...');
        break;
      case 'build-preview':
        toast('info', 'Building preview...');
        break;
      case 'add-dependency':
        setActiveView('dependencies');
        break;
      case 'create-screen':
        setActiveView('ai-builder');
        toast('info', 'Ask the AI to create a screen');
        break;
      case 'create-component':
        setActiveView('components');
        break;
      case 'change-theme':
        setActiveView('theme');
        break;
      case 'export-project':
        setActiveView('export');
        break;
    }
    setCommandPaletteOpen(false);
  }

  if (!commandPaletteOpen) return null;

  const grouped = filtered.reduce((acc, cmd) => {
    if (!acc[cmd.section]) acc[cmd.section] = [];
    acc[cmd.section].push(cmd);
    return acc;
  }, {} as Record<string, typeof COMMAND_PALETTE_COMMANDS[number][]>);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCommandPaletteOpen(false)} />
      <div className="relative ff-card w-full max-w-xl overflow-hidden ff-fade-in">
        <div className="flex items-center gap-2 px-3 py-3 border-b border-[var(--ff-border)]">
          <Search size={16} className="text-[var(--ff-text-dim)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
              if (e.key === 'Enter' && filtered[selected]) { handleSelect(filtered[selected].id); }
              if (e.key === 'Escape') setCommandPaletteOpen(false);
            }}
            placeholder="Type a command..."
            className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-[var(--ff-text-dim)]"
          />
          <kbd className="text-[10px] text-[var(--ff-text-dim)] px-1.5 py-0.5 rounded bg-[var(--ff-surface-2)] border border-[var(--ff-border)]">ESC</kbd>
        </div>

        <div className="max-h-[400px] overflow-y-auto ff-scrollbar py-1">
          {Object.entries(grouped).map(([section, commands]) => (
            <div key={section}>
              <p className="px-3 py-1 text-[10px] font-semibold text-[var(--ff-text-dim)] uppercase tracking-wider">{section}</p>
              {commands.map((cmd) => {
                const Icon = (Icons as unknown as Record<string, LucideIcon>)[cmd.icon] ?? Icons.Circle;
                const idx = filtered.indexOf(cmd);
                return (
                  <button
                    key={cmd.id}
                    onClick={() => handleSelect(cmd.id)}
                    className={cn(
                      'flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors',
                      idx === selected ? 'bg-[var(--ff-primary)]/10 text-[var(--ff-primary)]' : 'text-[var(--ff-text-muted)] hover:bg-[var(--ff-surface-2)]'
                    )}
                  >
                    <Icon size={14} />
                    {cmd.label}
                  </button>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-[var(--ff-text-dim)]">No commands found</div>
          )}
        </div>
      </div>
    </div>
  );
}
