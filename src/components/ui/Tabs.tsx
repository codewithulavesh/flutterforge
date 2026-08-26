import { type ReactNode, useState } from 'react';
import { cn } from '@/utils/cn';

interface TabsProps {
  tabs: { id: string; label: string; icon?: ReactNode; content: ReactNode }[];
  className?: string;
  activeId?: string;
  onChange?: (id: string) => void;
}

export function Tabs({ tabs, className, activeId: controlledActive, onChange }: TabsProps) {
  const [internalActive, setInternalActive] = useState(tabs[0]?.id ?? '');
  const activeId = controlledActive ?? internalActive;
  const activeTab = tabs.find((t) => t.id === activeId);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="flex items-center gap-1 border-b border-[var(--ff-border)] px-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              if (onChange) onChange(tab.id);
              else setInternalActive(tab.id);
            }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors',
              activeId === tab.id
                ? 'border-[var(--ff-primary)] text-[var(--ff-text)]'
                : 'border-transparent text-[var(--ff-text-dim)] hover:text-[var(--ff-text-muted)]'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">{activeTab?.content}</div>
    </div>
  );
}
