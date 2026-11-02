import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Terminal as TerminalIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

interface TerminalLine {
  text: string;
  type?: 'stdout' | 'stderr' | 'info' | 'success' | 'warning' | 'command';
  timestamp?: string;
}

interface AITerminalProps {
  lines: TerminalLine[];
  title?: string;
  isRunning?: boolean;
  maxHeight?: string;
  className?: string;
}

const lineColors: Record<string, string> = {
  stdout: 'text-[var(--ff-text-muted)]',
  stderr: 'text-red-400',
  info: 'text-cyan-400',
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  command: 'text-indigo-400',
};

const linePrefix: Record<string, string> = {
  stderr: '✗',
  info: 'ℹ',
  success: '✓',
  warning: '⚠',
  command: '$',
};

export function AITerminal({
  lines,
  title = 'Terminal',
  isRunning = false,
  maxHeight = '200px',
  className,
}: AITerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines.length]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-xl border border-[var(--ff-border)] overflow-hidden',
        'bg-[#0d1117]',
        className,
      )}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--ff-border)] bg-[#161b22]">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
        </div>
        <div className="flex items-center gap-1.5 ml-2">
          <TerminalIcon size={11} className="text-gray-500" />
          <span className="text-[11px] font-medium text-gray-400">{title}</span>
        </div>
        {isRunning && (
          <span className="ml-auto inline-flex items-center gap-1 text-[9px] text-emerald-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            RUNNING
          </span>
        )}
      </div>

      {/* Terminal body */}
      <div
        ref={scrollRef}
        className="overflow-y-auto ff-scrollbar p-3 space-y-0.5 font-mono text-[11px] leading-relaxed"
        style={{ maxHeight }}
      >
        {lines.length === 0 ? (
          <span className="text-gray-600">Waiting for output…</span>
        ) : (
          lines.map((line, index) => {
            const type = line.type || 'stdout';
            const prefix = linePrefix[type] || '';
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.1, delay: Math.min(index * 0.02, 0.5) }}
                className={cn('flex gap-2', lineColors[type])}
              >
                {line.timestamp && (
                  <span className="text-gray-600 shrink-0 tabular-nums">
                    {line.timestamp}
                  </span>
                )}
                {prefix && (
                  <span className="shrink-0 w-3 text-center">{prefix}</span>
                )}
                <span className="break-all min-w-0">{line.text}</span>
              </motion.div>
            );
          })
        )}
        {isRunning && (
          <div className="flex items-center gap-1 text-gray-500">
            <span className="animate-pulse">▊</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
