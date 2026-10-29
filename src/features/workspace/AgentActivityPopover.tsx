import { useMemo } from 'react';
import {
  Activity,
  Check,
  Circle,
  Code2,
  Loader2,
  Terminal,
  X,
} from 'lucide-react';
import { Dropdown } from '@/components/ui/Dropdown';
import { useTerminalStore } from '@/stores/terminal.store';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { cn } from '@/utils/cn';

/**
 * A compact, real Agent Activity panel for the chat header.
 * It reads the same terminal/agent events that drive the run, so it is not a
 * decorative mock: phases, files and tool output are live.
 */
export function AgentActivityPopover({ busy, elapsed }: { busy: boolean; elapsed: number }) {
  const {
    lines,
    liveFiles,
    currentPhase,
    agentEvents,
    generationSteps,
  } = useTerminalStore();
  const { openFile, setBottomPanelOpen, setBottomPanelTab } = useWorkspaceStore();

  const recent = useMemo(() => lines.slice(-14), [lines]);
  const doneSteps = generationSteps.filter((step) => step.status === 'completed').length;
  const totalSteps = generationSteps.length;

  const status = busy
    ? 'running'
    : recent.length > 0
      ? 'idle'
      : 'ready';

  const trigger = (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-full border border-[var(--ff-border)] bg-[var(--ff-surface-2)] px-2 py-1 text-[9px] font-mono text-[var(--ff-text-muted)] transition-colors hover:text-[var(--ff-text)]"
      title="Live agent activity"
    >
      {busy ? <Loader2 size={9} className="animate-spin text-[var(--ff-primary)]" /> : <Activity size={9} />}
      Activity
      {busy && liveFiles.length > 0 && (
        <span className="rounded-full bg-[var(--ff-primary)]/15 px-1 text-[8px] text-[var(--ff-primary)]">
          {liveFiles.length}
        </span>
      )}
    </button>
  );

  return (
    <Dropdown align="right" trigger={trigger} className="w-[330px] max-w-[calc(100vw-1.5rem)] p-0 overflow-hidden">
      <div className="border-b border-[var(--ff-border)] px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="ff-label text-[8px] text-[var(--ff-text-dim)]">Agent activity</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-[var(--ff-text)]">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  status === 'running' ? 'animate-pulse bg-emerald-400' : 'bg-[var(--ff-text-dim)]',
                )}
              />
              {busy ? (currentPhase ? 'Working' : 'Starting') : 'Idle'}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[13px] tabular-nums text-[var(--ff-text)]">
              {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
            </p>
            {totalSteps > 0 && (
              <p className="font-mono text-[8px] text-[var(--ff-text-dim)]">{doneSteps}/{totalSteps} steps</p>
            )}
          </div>
        </div>
        {currentPhase && (
          <p className="mt-2 truncate rounded-md border border-[var(--ff-border)] bg-[var(--ff-bg)] px-2 py-1 font-mono text-[9px] text-[var(--ff-text-muted)]">
            {currentPhase}
          </p>
        )}
      </div>

      {liveFiles.length > 0 && (
        <div className="border-b border-[var(--ff-border)] px-3 py-2">
          <p className="ff-label text-[8px] text-[var(--ff-text-dim)]">Files written · {liveFiles.length}</p>
          <div className="mt-1.5 space-y-0.5">
            {liveFiles.slice(-5).reverse().map((file) => (
              <button
                key={file}
                type="button"
                onClick={() => openFile(file)}
                className="flex w-full items-center gap-1.5 rounded px-0.5 py-0.5 text-left font-mono text-[9px] text-[var(--ff-text-muted)] hover:text-[var(--ff-text)]"
                title={file}
              >
                <Code2 size={8} className="shrink-0 text-[var(--ff-primary)]" />
                <span className="truncate">{file}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="max-h-52 overflow-y-auto ff-scrollbar px-3 py-2">
        <p className="ff-label text-[8px] text-[var(--ff-text-dim)]">Recent events</p>
        {recent.length === 0 ? (
          <p className="mt-2 text-[10px] leading-relaxed text-[var(--ff-text-dim)]">
            Activity appears here while the agent reads, writes and validates files.
          </p>
        ) : (
          <div className="mt-1.5 space-y-1.5">
            {recent.map((line) => (
              <div key={line.id} className="flex gap-1.5">
                <span className="mt-0.5 shrink-0">
                  {line.type === 'success' ? (
                    <Check size={8} className="text-emerald-400" />
                  ) : line.type === 'error' ? (
                    <X size={8} className="text-red-400" />
                  ) : (
                    <Circle size={6} className="text-[var(--ff-text-dim)]" />
                  )}
                </span>
                <div className="min-w-0">
                  <p
                    className={cn(
                      'break-words font-mono text-[9px] leading-relaxed',
                      line.type === 'error' ? 'text-red-400/90' : line.type === 'success' ? 'text-emerald-400/90' : 'text-[var(--ff-text-muted)]',
                    )}
                  >
                    {line.content}
                  </p>
                  <p className="font-mono text-[7px] text-[var(--ff-text-dim)]">
                    {new Date(line.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
        {agentEvents.length > 0 && (
          <p className="mt-2 font-mono text-[8px] text-[var(--ff-text-dim)]">
            {agentEvents.length} agent event{agentEvents.length === 1 ? '' : 's'} captured
          </p>
        )}
      </div>

      <div className="border-t border-[var(--ff-border)] p-2">
        <button
          type="button"
          onClick={() => {
            setBottomPanelTab('terminal');
            setBottomPanelOpen(true);
          }}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-[var(--ff-border)] bg-[var(--ff-bg)] px-2 py-1.5 text-[10px] text-[var(--ff-text-muted)] hover:text-[var(--ff-text)]"
        >
          <Terminal size={10} /> Open terminal
        </button>
      </div>
    </Dropdown>
  );
}
