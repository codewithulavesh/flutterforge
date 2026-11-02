import { motion } from 'motion/react';
import { AlertCircle, AlertTriangle, Check, X, ShieldAlert, Sparkles, Terminal } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface ConfirmationRequest {
  id: string;
  title: string;
  description: string;
  variant?: 'default' | 'warning' | 'destructive' | 'info';
  details?: string[];
  commandPreview?: string;
  acceptLabel?: string;
  rejectLabel?: string;
}

interface ConfirmationProps {
  request: ConfirmationRequest;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  isLoading?: boolean;
  className?: string;
}

export function ConfirmationView({
  request,
  onAccept,
  onReject,
  isLoading = false,
  className,
}: ConfirmationProps) {
  const isDestructive = request.variant === 'destructive' || request.variant === 'warning';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className={cn(
        'rounded-xl border p-4 shadow-md text-xs transition-all',
        isDestructive
          ? 'border-amber-500/30 bg-amber-500/5'
          : 'border-[var(--ff-primary)]/30 bg-[var(--ff-surface-1)]',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'p-2 rounded-lg shrink-0',
            isDestructive ? 'bg-amber-500/15 text-amber-400' : 'bg-[var(--ff-primary)]/15 text-[var(--ff-primary)]'
          )}
        >
          {isDestructive ? (
            <ShieldAlert className="w-4 h-4" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm text-[var(--ff-text)]">{request.title}</h4>
          <p className="mt-1 text-[var(--ff-text-muted)] leading-relaxed">{request.description}</p>

          {request.commandPreview && (
            <div className="mt-2.5 p-2 rounded-lg bg-[var(--ff-surface-2)] border border-[var(--ff-border)] font-mono text-[11px] text-[var(--ff-text)] flex items-center gap-2 overflow-x-auto">
              <Terminal className="w-3.5 h-3.5 text-[var(--ff-primary)] shrink-0" />
              <code>{request.commandPreview}</code>
            </div>
          )}

          {request.details && request.details.length > 0 && (
            <ul className="mt-2 space-y-1 pl-4 list-disc text-[11px] text-[var(--ff-text-muted)]">
              {request.details.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          )}

          <div className="mt-3.5 flex items-center gap-2">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => onAccept(request.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all shadow-sm',
                isDestructive
                  ? 'bg-amber-500 text-black hover:bg-amber-400 font-semibold'
                  : 'bg-[var(--ff-primary)] text-[var(--ff-primary-foreground)] hover:brightness-110'
              )}
            >
              <Check className="w-3.5 h-3.5" />
              <span>{request.acceptLabel || 'Confirm & Continue'}</span>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => onReject(request.id)}
              className="px-3 py-1.5 rounded-lg font-medium text-xs text-[var(--ff-text-muted)] hover:text-[var(--ff-text)] bg-[var(--ff-surface-2)] hover:bg-[var(--ff-surface-3)] border border-[var(--ff-border)] transition-all flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              <span>{request.rejectLabel || 'Cancel'}</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
