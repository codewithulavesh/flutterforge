import { useTerminalStore } from '@/stores/terminal.store';
import { cn } from '@/utils/cn';

export function BuildOutputPanel() {
  const { buildLogs, isBuilding } = useTerminalStore();

  return (
    <div className="flex flex-col h-full bg-[var(--ff-bg)] font-mono text-xs">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--ff-border)] shrink-0">
        {isBuilding && <span className="w-3 h-3 border-2 border-[var(--ff-primary)] border-t-transparent rounded-full ff-spin" />}
        <span className="text-[var(--ff-text-muted)]">Build Output</span>
        {isBuilding && <span className="text-[var(--ff-primary)] text-[10px]">building...</span>}
      </div>
      <div className="flex-1 overflow-y-auto ff-scrollbar px-3 py-2 space-y-0.5">
        {buildLogs.length === 0 ? (
          <div className="text-[var(--ff-text-dim)]">No build output yet. Click "Run" to build your Flutter app.</div>
        ) : (
          buildLogs.map((log, i) => (
            <div
              key={i}
              className={cn(
                'whitespace-pre-wrap',
                log.startsWith('$') && 'text-[var(--ff-primary)]',
                log.startsWith('✓') && 'text-emerald-400',
                log.includes('error') || log.includes('Error') ? 'text-red-400' : 'text-[var(--ff-text-muted)]'
              )}
            >
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
