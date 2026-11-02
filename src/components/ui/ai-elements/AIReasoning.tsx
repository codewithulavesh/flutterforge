import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain,
  ChevronDown,
  Clock,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/utils/cn';

interface ReasoningStep {
  text: string;
  timestamp?: string;
}

interface AIReasoningProps {
  steps: ReasoningStep[];
  isThinking?: boolean;
  elapsed?: number;
  label?: string;
  className?: string;
}

export function AIReasoning({
  steps,
  isThinking = false,
  elapsed = 0,
  label,
  className,
}: AIReasoningProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const formatDuration = (secs: number) => {
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'rounded-xl border overflow-hidden',
        isThinking
          ? 'border-indigo-500/25 bg-indigo-500/[0.03]'
          : 'border-[var(--ff-border)] bg-[var(--ff-surface)]',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[var(--ff-surface-2)]/30 transition-colors"
      >
        <div className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
          isThinking
            ? 'bg-indigo-500/15 text-indigo-400'
            : 'bg-[var(--ff-primary)]/10 text-[var(--ff-primary)]',
        )}>
          {isThinking ? (
            <Sparkles size={12} className="animate-pulse" />
          ) : (
            <Brain size={12} />
          )}
        </div>

        <span className={cn(
          'text-[12px] font-semibold',
          isThinking ? 'text-indigo-400' : 'text-[var(--ff-text-muted)]',
        )}>
          {label || (isThinking ? 'Reasoning…' : 'Reasoning')}
        </span>

        {elapsed > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-[var(--ff-text-dim)] font-mono">
            <Clock size={9} />
            {formatDuration(elapsed)}
          </span>
        )}

        {isThinking && (
          <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" />
            LIVE
          </span>
        )}

        <ChevronDown
          size={12}
          className={cn(
            'text-[var(--ff-text-dim)] transition-transform shrink-0',
            isThinking ? '' : 'ml-auto',
            isExpanded && 'rotate-180',
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && steps.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[var(--ff-border)]/60 px-3 py-2 space-y-1.5 max-h-48 overflow-y-auto ff-scrollbar">
              {steps.map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(index * 0.05, 0.3) }}
                  className="flex items-start gap-2 text-[11px]"
                >
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-[var(--ff-text-dim)] shrink-0" />
                  <span className="text-[var(--ff-text-muted)] leading-relaxed min-w-0">
                    {step.text}
                  </span>
                </motion.div>
              ))}
              {isThinking && (
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" />
                  <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" style={{ animationDelay: '0.15s' }} />
                  <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" style={{ animationDelay: '0.3s' }} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
