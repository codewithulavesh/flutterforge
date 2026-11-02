import { motion } from 'motion/react';
import {
  Check,
  Loader2,
  Circle,
  AlertTriangle,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/utils/cn';

export type TaskStatus = 'pending' | 'running' | 'done' | 'error' | 'warning';

export interface TaskItem {
  id: string;
  label: string;
  detail?: string;
  status: TaskStatus;
  /** 0-100 */
  progress?: number;
}

interface TaskListProps {
  tasks: TaskItem[];
  title?: string;
  className?: string;
}

function StatusDot({ status }: { status: TaskStatus }) {
  switch (status) {
    case 'done':
      return (
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
          <Check size={10} className="text-white" strokeWidth={3} />
        </span>
      );
    case 'running':
      return (
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
          className="flex h-4 w-4 items-center justify-center"
        >
          <Loader2 size={14} className="text-indigo-400" />
        </motion.span>
      );
    case 'error':
      return <XCircle size={14} className="text-red-400" />;
    case 'warning':
      return <AlertTriangle size={14} className="text-amber-400" />;
    default:
      return <Circle size={14} className="text-[var(--ff-text-dim)]/40" />;
  }
}

export function TaskList({ tasks, title, className }: TaskListProps) {
  const completed = tasks.filter((t) => t.status === 'done').length;
  const total = tasks.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface)] overflow-hidden',
        className,
      )}
    >
      {title && (
        <div className="px-3 py-2 border-b border-[var(--ff-border)] flex items-center gap-2">
          <span className="text-[11px] font-semibold text-[var(--ff-text)]">{title}</span>
          <span className="ml-auto text-[10px] font-mono text-[var(--ff-text-dim)]">
            {completed}/{total}
          </span>
        </div>
      )}

      {/* Progress bar */}
      {total > 0 && (
        <div className="h-0.5 bg-[var(--ff-surface-2)]">
          <motion.div
            className="h-full bg-[var(--ff-primary)]"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}

      <div className="px-3 py-2 space-y-1">
        {tasks.map((task, index) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15, delay: Math.min(index * 0.04, 0.3) }}
            className="flex items-start gap-2 py-1"
          >
            <div className="mt-0.5 shrink-0">
              <StatusDot status={task.status} />
            </div>
            <div className="min-w-0 flex-1">
              <span className={cn(
                'text-[12px] block truncate',
                task.status === 'done' ? 'text-[var(--ff-text-dim)]' : 'text-[var(--ff-text)]',
                task.status === 'running' && 'font-medium',
                task.status === 'error' && 'text-red-400',
              )}>
                {task.label}
              </span>
              {task.detail && (
                <span className="text-[10px] text-[var(--ff-text-dim)] block truncate mt-0.5">
                  {task.detail}
                </span>
              )}
              {task.status === 'running' && task.progress !== undefined && (
                <div className="mt-1 h-1 w-full rounded-full bg-[var(--ff-surface-2)] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-indigo-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${task.progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* ---------- Subagent (nested task executor) ---------- */

export interface SubagentStep {
  id: string;
  name: string;
  status: TaskStatus;
  detail?: string;
}

interface SubagentProps {
  name: string;
  status: TaskStatus;
  steps: SubagentStep[];
  className?: string;
}

export function Subagent({ name, status, steps, className }: SubagentProps) {
  const completed = steps.filter((s) => s.status === 'done').length;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-xl border overflow-hidden',
        status === 'running'
          ? 'border-cyan-500/25 bg-cyan-500/[0.03]'
          : status === 'error'
            ? 'border-red-500/25 bg-red-500/[0.03]'
            : 'border-[var(--ff-border)] bg-[var(--ff-surface)]',
        className,
      )}
    >
      <div className="px-3 py-2.5 flex items-center gap-2.5 border-b border-[var(--ff-border)]/60">
        <StatusDot status={status} />
        <div className="min-w-0 flex-1">
          <span className="text-[12px] font-semibold text-[var(--ff-text)] truncate block">
            {name}
          </span>
          <span className="text-[10px] text-[var(--ff-text-dim)]">
            {completed}/{steps.length} steps
          </span>
        </div>
        {status === 'running' && (
          <span className="inline-flex items-center gap-1 text-[9px] text-cyan-400 font-mono">
            <span className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
            ACTIVE
          </span>
        )}
      </div>

      <div className="px-3 py-2 space-y-1">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center gap-2 text-[11px]">
            <span className={cn(
              'w-3 flex items-center justify-center shrink-0',
              step.status === 'done' && 'text-emerald-400',
              step.status === 'running' && 'text-cyan-400',
              step.status === 'error' && 'text-red-400',
              step.status === 'pending' && 'text-[var(--ff-text-dim)]/40',
            )}>
              {step.status === 'done' ? (
                <Check size={10} strokeWidth={3} />
              ) : step.status === 'running' ? (
                <ArrowRight size={10} />
              ) : step.status === 'error' ? (
                <XCircle size={10} />
              ) : (
                <Circle size={8} />
              )}
            </span>
            <span className={cn(
              'truncate',
              step.status === 'done' ? 'text-[var(--ff-text-dim)]' : 'text-[var(--ff-text-muted)]',
              step.status === 'running' && 'text-[var(--ff-text)] font-medium',
            )}>
              {step.name}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ---------- Queue ---------- */

export interface QueueItem {
  id: string;
  label: string;
  position: number;
  status: 'waiting' | 'processing' | 'done';
}

interface QueueViewProps {
  items: QueueItem[];
  className?: string;
}

export function QueueView({ items, className }: QueueViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface)] overflow-hidden',
        className,
      )}
    >
      <div className="px-3 py-2 border-b border-[var(--ff-border)] text-[11px] font-semibold text-[var(--ff-text)]">
        Queue ({items.filter((i) => i.status === 'waiting').length} pending)
      </div>
      <div className="px-3 py-2 space-y-1">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 py-1 text-[11px]"
          >
            <span className={cn(
              'w-5 text-center font-mono text-[10px] shrink-0',
              item.status === 'processing' ? 'text-indigo-400 font-bold' : 'text-[var(--ff-text-dim)]',
            )}>
              {item.status === 'done' ? '✓' : `#${item.position}`}
            </span>
            <span className={cn(
              'truncate',
              item.status === 'done' ? 'text-[var(--ff-text-dim)] line-through' : 'text-[var(--ff-text-muted)]',
              item.status === 'processing' && 'text-[var(--ff-text)] font-medium',
            )}>
              {item.label}
            </span>
            {item.status === 'processing' && (
              <Loader2 size={10} className="ml-auto text-indigo-400 animate-spin shrink-0" />
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
