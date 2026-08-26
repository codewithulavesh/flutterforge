import { useEffect, useRef } from 'react';
import { useTerminalStore } from '@/stores/terminal.store';
import { cn } from '@/utils/cn';

export function TerminalPanel() {
  const { lines, addLine, clearLines } = useTerminalStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  function handleCommand(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const target = e.target as HTMLInputElement;
      const cmd = target.value.trim();
      if (!cmd) return;
      addLine({ type: 'command', content: `$ ${cmd}` });
      target.value = '';

      const lower = cmd.toLowerCase();
      if (lower === 'clear' || lower === 'cls') {
        clearLines();
        return;
      }
      if (lower.startsWith('flutter')) {
        addLine({ type: 'output', content: `Running ${cmd}...` });
        setTimeout(() => addLine({ type: 'output', content: 'Flutter SDK not available in browser preview.' }), 300);
      } else if (lower.startsWith('dart')) {
        addLine({ type: 'output', content: 'Dart SDK not available in browser preview.' });
      } else if (lower === 'help') {
        addLine({ type: 'output', content: 'Available: flutter analyze, flutter build web, clear, help' });
      } else {
        addLine({ type: 'output', content: `Command not found: ${cmd}` });
      }
    }
  }

  return (
    <div className="flex flex-col h-full bg-[var(--ff-bg)] font-mono text-xs">
      <div ref={scrollRef} className="flex-1 overflow-y-auto ff-scrollbar px-3 py-2 space-y-0.5">
        {lines.length === 0 && (
          <div className="text-[var(--ff-text-dim)]">FlutterForge Terminal — type "help" for commands</div>
        )}
        {lines.map((line) => (
          <div
            key={line.id}
            className={cn(
              'whitespace-pre-wrap',
              line.type === 'command' && 'text-[var(--ff-primary)]',
              line.type === 'output' && 'text-[var(--ff-text-muted)]',
              line.type === 'error' && 'text-red-400',
              line.type === 'success' && 'text-emerald-400'
            )}
          >
            {line.content}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1 px-3 py-1.5 border-t border-[var(--ff-border)]">
        <span className="text-[var(--ff-primary)]">$</span>
        <input
          onKeyDown={handleCommand}
          placeholder="Type a command..."
          className="flex-1 bg-transparent outline-none text-[var(--ff-text)] placeholder:text-[var(--ff-text-dim)] font-mono text-xs"
        />
      </div>
    </div>
  );
}
