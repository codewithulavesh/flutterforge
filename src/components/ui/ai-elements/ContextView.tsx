import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cpu, FileCode2, Layers, ChevronDown, Sparkles, HardDrive, Zap } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface ContextItem {
  id: string;
  name: string;
  type: 'file' | 'package' | 'memory' | 'schema' | 'rule';
  path?: string;
  sizeTokens?: number;
}

interface ContextViewProps {
  items: ContextItem[];
  modelName?: string;
  usedTokens?: number;
  maxTokens?: number;
  className?: string;
}

export function ContextView({
  items,
  modelName = 'DeepSeek R1 / Claude 3.5',
  usedTokens = 0,
  maxTokens = 128000,
  className,
}: ContextViewProps) {
  const [expanded, setExpanded] = useState(false);

  const tokenPercent = maxTokens > 0 ? Math.min(100, Math.round((usedTokens / maxTokens) * 100)) : 0;

  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface-1)] text-xs overflow-hidden transition-all',
        className
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-[var(--ff-surface-2)]/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-[var(--ff-primary)]/10 text-[var(--ff-primary)]">
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-1.5 font-medium text-[var(--ff-text)]">
            <span>Context & Knowledge</span>
            <span className="text-[10px] text-[var(--ff-text-muted)] font-mono">({items.length} items)</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {usedTokens > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 bg-[var(--ff-surface-2)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--ff-primary)] rounded-full transition-all"
                  style={{ width: `${tokenPercent}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-[var(--ff-text-muted)]">
                {Math.round(usedTokens / 1000)}k / {Math.round(maxTokens / 1000)}k
              </span>
            </div>
          )}
          <ChevronDown
            className={cn('w-3.5 h-3.5 text-[var(--ff-text-muted)] transition-transform', expanded && 'rotate-180')}
          />
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-[var(--ff-border)] p-3 space-y-2 bg-[var(--ff-surface-1)]"
          >
            <div className="flex items-center justify-between text-[11px] text-[var(--ff-text-muted)]">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" /> Active Model
              </span>
              <span className="font-mono text-[var(--ff-text)]">{modelName}</span>
            </div>

            <div className="pt-2 border-t border-[var(--ff-border)]/50 space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ff-text-muted)]">
                Included in prompt
              </div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--ff-surface-2)] border border-[var(--ff-border)] text-[11px] text-[var(--ff-text)]"
                  >
                    {item.type === 'file' ? (
                      <FileCode2 className="w-3 h-3 text-cyan-400" />
                    ) : item.type === 'package' ? (
                      <HardDrive className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Layers className="w-3 h-3 text-indigo-400" />
                    )}
                    <span className="font-mono">{item.name}</span>
                    {item.sizeTokens && (
                      <span className="text-[9px] text-[var(--ff-text-muted)] font-mono">
                        {Math.round(item.sizeTokens)} tokens
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
