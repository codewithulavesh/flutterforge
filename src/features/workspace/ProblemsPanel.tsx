import { AlertTriangle, AlertCircle, Info, XCircle, ChevronRight, Wrench } from 'lucide-react';
import { useTerminalStore } from '@/stores/terminal.store';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { cn } from '@/utils/cn';

export function ProblemsPanel() {
  const { problems } = useTerminalStore();
  const { openFile } = useWorkspaceStore();

  const errors = problems.filter((p) => p.severity === 'error');
  const warnings = problems.filter((p) => p.severity === 'warning');
  const infos = problems.filter((p) => p.severity === 'info');

  return (
    <div className="flex flex-col h-full bg-[var(--ff-bg)]">
      <div className="flex items-center gap-4 px-3 py-2 border-b border-[var(--ff-border)] shrink-0">
        <span className="flex items-center gap-1.5 text-xs">
          <XCircle size={14} className="text-red-400" />
          <span className="text-[var(--ff-text-muted)]">{errors.length} Errors</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          <AlertTriangle size={14} className="text-amber-400" />
          <span className="text-[var(--ff-text-muted)]">{warnings.length} Warnings</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          <Info size={14} className="text-blue-400" />
          <span className="text-[var(--ff-text-muted)]">{infos.length} Info</span>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto ff-scrollbar px-2 py-1">
        {problems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2">
              <span className="text-emerald-400 text-lg">✓</span>
            </div>
            <p className="text-xs text-[var(--ff-text-muted)]">No problems detected</p>
            <p className="text-[10px] text-[var(--ff-text-dim)] mt-1">Run the analyzer to check for issues</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {problems.map((problem) => {
              const Icon = problem.severity === 'error' ? XCircle : problem.severity === 'warning' ? AlertTriangle : Info;
              const color = problem.severity === 'error' ? 'text-red-400' : problem.severity === 'warning' ? 'text-amber-400' : 'text-blue-400';
              return (
                <div
                  key={problem.id}
                  onClick={() => openFile(problem.file)}
                  className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-[var(--ff-surface-2)] cursor-pointer group"
                >
                  <Icon size={14} className={cn(color, 'mt-0.5 shrink-0')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--ff-text-muted)] truncate">{problem.message}</p>
                    <p className="text-[10px] text-[var(--ff-text-dim)] font-mono">{problem.file}:{problem.line}:{problem.column}</p>
                  </div>
                  <button className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--ff-text-dim)] hover:text-[var(--ff-primary)] transition-all">
                    <Wrench size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
