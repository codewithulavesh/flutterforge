import { motion } from 'motion/react';
import { GitCommit, History, RotateCcw, Check, Sparkles, FileCode } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface CheckpointItem {
  id: string;
  label: string;
  timestamp: string;
  filesChangedCount?: number;
  additions?: number;
  deletions?: number;
  isActive?: boolean;
}

interface CheckpointProps {
  checkpoints: CheckpointItem[];
  currentCheckpointId?: string;
  onRestore?: (checkpointId: string) => void;
  className?: string;
}

export function CheckpointView({
  checkpoints,
  currentCheckpointId,
  onRestore,
  className,
}: CheckpointProps) {
  if (!checkpoints || checkpoints.length === 0) return null;

  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface-1)] p-3 text-xs shadow-sm',
        className
      )}
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--ff-border)]">
        <div className="flex items-center gap-2 font-medium text-[var(--ff-text)]">
          <History className="w-3.5 h-3.5 text-[var(--ff-primary)]" />
          <span>Version Checkpoints</span>
          <span className="px-1.5 py-0.2 bg-[var(--ff-primary)]/10 text-[var(--ff-primary)] rounded-full text-[10px] font-mono">
            {checkpoints.length}
          </span>
        </div>
      </div>

      <div className="relative pl-3 space-y-2.5 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-[1.5px] before:bg-[var(--ff-border)]">
        {checkpoints.map((cp, idx) => {
          const isCurrent = currentCheckpointId ? cp.id === currentCheckpointId : idx === checkpoints.length - 1;

          return (
            <motion.div
              key={cp.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="relative flex items-center justify-between group"
            >
              <div
                className={cn(
                  'absolute -left-[15px] top-1.5 w-2 h-2 rounded-full border-2 transition-all',
                  isCurrent
                    ? 'border-[var(--ff-primary)] bg-[var(--ff-primary)] ring-2 ring-[var(--ff-primary)]/20'
                    : 'border-[var(--ff-border-strong)] bg-[var(--ff-surface-1)] group-hover:border-[var(--ff-primary)]'
                )}
              />

              <div className="flex-1 min-w-0 pr-3">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-[var(--ff-text)] truncate">{cp.label}</span>
                  {isCurrent && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-500/15 text-emerald-400 flex items-center gap-0.5">
                      <Check className="w-2.5 h-2.5" /> current
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[var(--ff-text-muted)] font-mono">
                  <span>{cp.timestamp}</span>
                  {cp.filesChangedCount !== undefined && (
                    <span className="flex items-center gap-0.5">
                      <FileCode className="w-2.5 h-2.5" />
                      {cp.filesChangedCount} files
                    </span>
                  )}
                  {cp.additions !== undefined && (
                    <span className="text-emerald-400">+{cp.additions}</span>
                  )}
                  {cp.deletions !== undefined && (
                    <span className="text-rose-400">-{cp.deletions}</span>
                  )}
                </div>
              </div>

              {!isCurrent && onRestore && (
                <button
                  type="button"
                  onClick={() => onRestore(cp.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-2 py-1 rounded bg-[var(--ff-surface-2)] hover:bg-[var(--ff-surface-3)] text-[var(--ff-text)] text-[10px] font-medium border border-[var(--ff-border)]"
                >
                  <RotateCcw className="w-2.5 h-2.5 text-[var(--ff-primary)]" />
                  Restore
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
