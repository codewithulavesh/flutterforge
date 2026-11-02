import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ExternalLink, BookOpen, Layers, Sparkles, ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface SourceItem {
  id: string;
  title: string;
  url: string;
  domain?: string;
  snippet?: string;
  type?: 'docs' | 'package' | 'github' | 'guide';
}

interface InlineCitationProps {
  index: number;
  source: SourceItem;
  className?: string;
}

export function InlineCitation({ index, source, className }: InlineCitationProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <span
      className="relative inline-block mx-0.5"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <a
        href={source.url}
        target="_blank"
        rel="noreferrer"
        className={cn(
          'inline-flex items-center justify-center px-1.5 py-0.2 rounded-md text-[10px] font-mono font-medium',
          'bg-[var(--ff-primary)]/15 text-[var(--ff-primary)] hover:bg-[var(--ff-primary)]/25 transition-colors cursor-pointer align-baseline',
          className
        )}
      >
        [{index}]
      </a>

      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-64 p-2.5 rounded-lg border border-[var(--ff-border)] bg-[var(--ff-surface-1)] shadow-xl text-left pointer-events-none"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--ff-text)]">
              <BookOpen className="w-3 h-3 text-[var(--ff-primary)] shrink-0" />
              <span className="truncate">{source.title}</span>
            </div>
            {source.snippet && (
              <p className="mt-1 text-[10px] text-[var(--ff-text-muted)] line-clamp-2 leading-relaxed">
                {source.snippet}
              </p>
            )}
            <div className="mt-1.5 flex items-center justify-between text-[9px] text-[var(--ff-text-muted)] font-mono">
              <span>{source.domain || 'flutter.dev'}</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

interface SourcesListProps {
  sources: SourceItem[];
  className?: string;
}

export function SourcesList({ sources, className }: SourcesListProps) {
  const [expanded, setExpanded] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface-1)] text-xs overflow-hidden',
        className
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-[var(--ff-surface-2)]/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-[var(--ff-primary)]" />
          <span className="font-medium text-[var(--ff-text)]">Referenced Sources</span>
          <span className="px-1.5 py-0.2 rounded-full bg-[var(--ff-surface-2)] text-[10px] font-mono text-[var(--ff-text-muted)]">
            {sources.length}
          </span>
        </div>
        <ChevronDown
          className={cn('w-3.5 h-3.5 text-[var(--ff-text-muted)] transition-transform', expanded && 'rotate-180')}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-[var(--ff-border)] p-2 space-y-1.5 bg-[var(--ff-surface-1)]"
          >
            {sources.map((src, i) => (
              <a
                key={src.id || i}
                href={src.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--ff-surface-2)] text-[var(--ff-text)] transition-colors group"
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <span className="w-4 h-4 rounded bg-[var(--ff-primary)]/10 text-[var(--ff-primary)] flex items-center justify-center font-mono text-[10px] shrink-0 font-bold">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium text-[11px] truncate group-hover:text-[var(--ff-primary)] transition-colors">
                      {src.title}
                    </div>
                    {src.snippet && (
                      <div className="text-[10px] text-[var(--ff-text-muted)] truncate">{src.snippet}</div>
                    )}
                  </div>
                </div>
                <ExternalLink className="w-3 h-3 text-[var(--ff-text-muted)] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
