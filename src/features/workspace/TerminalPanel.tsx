import { useEffect, useRef, useState } from 'react';
import { useTerminalStore } from '@/stores/terminal.store';
import { useProjectStore } from '@/stores/project.store';
import { cn } from '@/utils/cn';

export function TerminalPanel() {
  const { lines, addLine, clearLines } = useTerminalStore();
  const { currentProject } = useProjectStore();
  const [running, setRunning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  async function handleCommand(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const target = e.target as HTMLInputElement;
    const cmd = target.value.trim();
    if (!cmd || running) return;
    addLine({ type: 'command', content: `$ ${cmd}` });
    target.value = '';

    const lower = cmd.toLowerCase();
    if (lower === 'clear' || lower === 'cls') {
      clearLines();
      return;
    }
    if (lower === 'help') {
      addLine({
        type: 'output',
        content: 'Real commands: flutter analyze · flutter pub get · dart analyze · ls · pwd · cat <file> · git status · clear',
      });
      return;
    }
    if (!currentProject) {
      addLine({ type: 'error', content: 'Open a project first.' });
      return;
    }

    setRunning(true);
    addLine({ type: 'output', content: `Running ${cmd} in the project workspace…` });
    try {
      const response = await fetch('/api/terminal/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: currentProject.id, command: cmd }),
      });
      const bodyText = await response.text();
      let body: { output?: string; error?: string; code?: number } = {};
      if (bodyText.trim()) {
        try {
          body = JSON.parse(bodyText) as typeof body;
        } catch {
          throw new Error(`Terminal returned an unreadable response (HTTP ${response.status}). Is the local engine running?`);
        }
      } else if (!response.ok) {
        throw new Error('The terminal service is offline. Start the local harness server with: npm run server');
      }
      if (!response.ok) throw new Error(body.error || `Command failed (${response.status})`);
      const output = (body.output || '').trimEnd();
      if (output) {
        for (const line of output.split('\n')) addLine({ type: 'output', content: line });
      }
      addLine({
        type: body.code === 0 ? 'success' : 'error',
        content: body.code === 0 ? '✓ Command finished' : `✗ Exited with code ${body.code ?? 1}`,
      });
    } catch (error) {
      addLine({ type: 'error', content: error instanceof Error ? error.message : 'Command failed.' });
    } finally {
      setRunning(false);
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
          placeholder={running ? 'Running…' : 'Type a command… (help)'}
          disabled={running}
          className="flex-1 bg-transparent outline-none text-[var(--ff-text)] placeholder:text-[var(--ff-text-dim)] font-mono text-xs disabled:opacity-60"
        />
      </div>
    </div>
  );
}
