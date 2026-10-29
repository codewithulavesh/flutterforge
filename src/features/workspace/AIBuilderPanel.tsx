import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertCircle,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  Cpu,
  FileCode2,
  FolderOpen,
  Layers,
  Loader2,
  Plus,
  RotateCcw,
  Send,
  Square,
  Terminal as TerminalIcon,
  Wrench,
  X,
} from 'lucide-react';
import { useProjectStore, type SendMessageOptions } from '@/stores/project.store';
import { usePreviewStore } from '@/stores/preview.store';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { useTerminalStore } from '@/stores/terminal.store';
import { classifyChatIntent } from '@/agent/chatIntent';
import { HarnessClient } from '@/agent/harnessClient';
import { ChatContextHandler } from '@/agent/chatContext';
import { toast } from '@/components/ui/Toast';
import { BrandLogo } from '@/components/BrandLogo';
import ThoughtLine from '@/components/ui/ThoughtLine';
import {
  ThoughtChain,
  ThoughtChainStep,
  ThoughtChainTrigger,
  ThoughtChainContent,
  ThoughtChainItem,
} from '@/components/ui/components-ai-thought-chain';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { AgentActivityPopover } from '@/features/workspace/AgentActivityPopover';
import { cn } from '@/utils/cn';
import type { AIMessage, FileChange } from '@/types';

const SUGGESTIONS = [
  {
    label: 'Apple-style calculator',
    prompt: 'Build a colorful calculator app like the Apple Calculator with all basic and scientific functions, a history panel, and keyboard support. Local only — no backend.',
  },
  {
    label: 'Habit tracker',
    prompt: 'Build a habit streak tracker with daily check-ins, weekly progress rings, reminders, and local persistence. No backend.',
  },
  {
    label: 'Food delivery app',
    prompt: 'Build a food delivery app with restaurants, menus, cart, checkout, and Supabase auth, orders, and RLS policies.',
  },
  {
    label: 'AI chat assistant',
    prompt: 'Build an AI chat assistant with conversations, streaming replies, Markdown rendering, and Supabase auth and message history.',
  },
];

type PanelVariant = 'sidebar' | 'page';

function shortModel(modelId: string | undefined): string {
  if (!modelId) return 'DeepSeek Harness';
  const base = modelId.split('/').pop() || modelId;
  return base.replace(/:free$/, '').replace(/-/g, ' ');
}

function humanizePhase(phase: string | null): string {
  if (!phase) return 'Working…';
  const value = phase.toLowerCase();
  if (/planning|architect|design|schema/.test(value)) return 'Designing the app architecture';
  if (/writing|creating|generat|batch|file/.test(value)) return 'Writing Flutter files';
  if (/valid|analyz|fix|heal|test/.test(value)) return 'Validating Dart code';
  if (/build|preview|compil|saving/.test(value)) return 'Building the preview';
  if (/connect|model|openrouter|harness|route/.test(value)) return 'Connecting to the model';
  return phase.replace(/^\[[^\]]*\]\s*/, '').slice(0, 90);
}

function timeLabel(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast('success', 'Copied to clipboard');
  } catch {
    toast('error', 'Could not copy to clipboard');
  }
}

function inlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-semibold text-[var(--ff-text)]">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index} className="px-1 py-0.5 rounded bg-[var(--ff-surface-2)] font-mono text-[0.92em] text-[var(--ff-text)]">{part.slice(1, -1)}</code>;
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      return (
        <a key={index} href={link[2]} target="_blank" rel="noreferrer" className="text-[var(--ff-primary)] underline underline-offset-2">
          {link[1]}
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

type MarkdownBlock =
  | { kind: 'p'; text: string }
  | { kind: 'h'; level: number; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'code'; language: string; code: string };

function parseMarkdown(text: string): MarkdownBlock[] {
  const lines = String(text ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const fence = line.match(/^```([A-Za-z0-9_+-]*)\s*$/);
    if (fence) {
      const language = fence[1] || 'text';
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push({ kind: 'code', language, code: code.join('\n') });
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: 'h', level: heading[1].length, text: heading[2] });
      index += 1;
      continue;
    }

    if (/^[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*•]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^[-*•]\s+/, ''));
        index += 1;
      }
      blocks.push({ kind: 'ul', items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s+/, ''));
        index += 1;
      }
      blocks.push({ kind: 'ol', items });
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push({ kind: 'quote', text: quote.join(' ') });
      continue;
    }

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length
      && lines[index].trim()
      && !/^```/.test(lines[index])
      && !/^#{1,4}\s+/.test(lines[index])
      && !/^[-*•]\s+/.test(lines[index])
      && !/^\d+\.\s+/.test(lines[index])
      && !/^>\s?/.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push({ kind: 'p', text: paragraph.join(' ') });
  }

  return blocks;
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="my-2.5 rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface-2)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--ff-border)]">
        <span className="ff-label text-[9px] text-[var(--ff-text-dim)]">{language || 'code'}</span>
        <button
          type="button"
          onClick={async () => {
            await copyText(code);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
          className="inline-flex items-center gap-1 text-[10px] text-[var(--ff-text-dim)] hover:text-[var(--ff-text)]"
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto ff-scrollbar text-[12px] leading-relaxed font-mono text-[var(--ff-text)]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  return (
    <div className={cn('space-y-2 text-[13px] leading-relaxed text-[var(--ff-text-muted)]', className)}>
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'code':
            return <CodeBlock key={index} code={block.code} language={block.language} />;
          case 'h': {
            const sizes = ['text-lg', 'text-base', 'text-sm', 'text-sm'];
            return (
              <p key={index} className={cn('ff-display font-semibold text-[var(--ff-text)] pt-2', sizes[Math.min(block.level - 1, 3)])}>
                {inlineMarkdown(block.text)}
              </p>
            );
          }
          case 'ul':
            return (
              <ul key={index} className="space-y-1">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex gap-2">
                    <span className="text-[var(--ff-primary)] shrink-0">•</span>
                    <span>{inlineMarkdown(item)}</span>
                  </li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={index} className="space-y-1 list-none">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex gap-2">
                    <span className="text-[var(--ff-text-dim)] font-mono text-[11px] shrink-0 w-4">{itemIndex + 1}.</span>
                    <span>{inlineMarkdown(item)}</span>
                  </li>
                ))}
              </ol>
            );
          case 'quote':
            return (
              <blockquote key={index} className="border-l-2 border-[var(--ff-primary)] pl-3 text-[var(--ff-text-muted)] italic">
                {inlineMarkdown(block.text)}
              </blockquote>
            );
          default:
            return <p key={index}>{inlineMarkdown(block.text)}</p>;
        }
      })}
    </div>
  );
}

function ChangedFiles({ files, onOpen, page }: { files: FileChange[]; onOpen: (path: string) => void; page: boolean }) {
  const [expanded, setExpanded] = useState(page);
  const visible = expanded ? files : files.slice(0, page ? 12 : 6);
  if (!files.length) return null;

  return (
    <div className="mt-3 rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface)] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] text-[var(--ff-text-muted)] hover:bg-[var(--ff-surface-2)] transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <FileCode2 size={12} className="text-[var(--ff-primary)]" />
          {files.length} file{files.length === 1 ? '' : 's'} changed
        </span>
        <ChevronDown size={12} className={cn('transition-transform', expanded && 'rotate-180')} />
      </button>
      {expanded && (
        <div className="border-t border-[var(--ff-border)]">
          {visible.map((file) => (
            <button
              key={file.path}
              type="button"
              onClick={() => file.action !== 'deleted' && onOpen(file.path)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] font-mono border-b border-[var(--ff-border)]/60 last:border-b-0',
                file.action === 'deleted'
                  ? 'text-[var(--ff-text-dim)] line-through cursor-default'
                  : 'text-[var(--ff-text-muted)] hover:bg-[var(--ff-surface-2)] hover:text-[var(--ff-text)] transition-colors',
              )}
              title={file.path}
            >
              <FileCode2 size={10} className="text-[var(--ff-text-dim)] shrink-0" />
              <span className="truncate flex-1">{file.path}</span>
              <span className="text-[9px] uppercase tracking-wide text-[var(--ff-text-dim)]">{file.action}</span>
            </button>
          ))}
          {files.length > visible.length && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="w-full px-3 py-1.5 text-[10px] text-[var(--ff-text-dim)] hover:text-[var(--ff-text)] text-left"
            >
              Show all {files.length} files
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Sources({ files, onOpen }: { files: FileChange[]; onOpen: (path: string) => void }) {
  const unique = files.filter((file, index, list) => (
    file.action !== 'deleted' && list.findIndex((item) => item.path === file.path) === index
  ));
  if (unique.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 text-[11px] text-[var(--ff-text-dim)]">Sources</span>
      {unique.slice(0, 5).map((file) => (
        <button
          key={file.path}
          type="button"
          onClick={() => onOpen(file.path)}
          className="rounded-md bg-[var(--ff-surface-2)] px-2 py-1 text-[11px] text-[var(--ff-text-muted)] transition-colors hover:text-[var(--ff-text)]"
          title={file.path}
        >
          {file.path.split('/').pop()}
        </button>
      ))}
      {unique.length > 5 && (
        <span className="text-[10px] text-[var(--ff-text-dim)]">+{unique.length - 5}</span>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  page,
  onOpen,
  onRetry,
  canRetry,
}: {
  message: AIMessage;
  page: boolean;
  onOpen: (path: string) => void;
  onRetry: () => void;
  canRetry: boolean;
}) {
  const isUser = message.role === 'user';
  const changedFiles = Array.isArray(message.changed_files) ? message.changed_files : [];

  if (isUser) {
    if (page) {
      return (
        <div className="flex justify-end">
          <div className="max-w-[78%] whitespace-pre-wrap break-words rounded-2xl bg-[var(--ff-surface-2)] px-4 py-2.5 text-[14px] leading-relaxed text-[var(--ff-text)]">
            {message.content}
          </div>
        </div>
      );
    }
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[var(--ff-primary)] px-3.5 py-2.5">
          <div className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[var(--ff-bg)]">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  if (page) {
    return (
      <div className="group/response">
        <Markdown text={message.content} className="text-[15px] leading-[1.8] text-[var(--ff-text)] [&_p]:text-[var(--ff-text)] [&_li]:text-[var(--ff-text)]" />
        <Sources files={changedFiles} onOpen={onOpen} />
        <div className="mt-2 flex items-center gap-3 opacity-0 transition-opacity group-hover/response:opacity-100">
          <button
            type="button"
            onClick={() => void copyText(message.content)}
            className="inline-flex items-center gap-1 text-[11px] text-[var(--ff-text-dim)] hover:text-[var(--ff-text)]"
          >
            <Copy size={10} /> Copy
          </button>
          {canRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 text-[11px] text-[var(--ff-text-dim)] hover:text-[var(--ff-text)]"
            >
              <RotateCcw size={10} /> Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <BrandLogo size={22} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="ff-display text-[11px] font-semibold text-[var(--ff-text)]">FlutterForge</span>
          <span className="text-[10px] text-[var(--ff-text-dim)]">{timeLabel(message.created_at)}</span>
        </div>
        <Markdown text={message.content} className="mt-1.5" />
        <ChangedFiles files={changedFiles} onOpen={onOpen} page={false} />
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

const PIPELINE_STAGES = [
  {
    label: 'Understanding the brief',
    detail: 'Reading your brief and project context before choosing an approach.',
  },
  {
    label: 'Designing the app architecture',
    detail: 'Shaping the app structure and deciding how its screens fit together.',
  },
  {
    label: 'Writing Flutter files',
    detail: 'Writing project files as the model completes each part.',
  },
  {
    label: 'Validating Dart code',
    detail: 'Checking the generated code and resolving any issues.',
  },
  {
    label: 'Building the preview',
    detail: 'Preparing the live preview from the latest project files.',
  },
];

function AgentTrace({
  thought,
  phase,
  files,
  elapsed,
  busy,
  onOpen,
}: {
  thought: string | null;
  phase: string | null;
  files: string[];
  elapsed: number;
  busy: boolean;
  onOpen: (path: string) => void;
}) {
  const phaseText = `${phase ?? ''} ${thought ?? ''}`.toLowerCase();
  const activeStage = files.length > 0
    ? phaseText.match(/valid|analyz|repair|build|preview|compil/)
      ? phaseText.match(/build|preview|compil/) ? 4 : 3
      : 2
    : phaseText.match(/build|preview|compil/) ? 4
      : phaseText.match(/valid|analyz|repair|test/) ? 3
        : phaseText.match(/generat|writ|creat|file/) ? 2
          : phaseText.match(/design|architect|plan|schema/) ? 1
            : 0;
  const detail = thought || PIPELINE_STAGES[activeStage].detail;
  const shownFiles = files.slice(-6);

  return (
    <div className="py-2" aria-live="polite">
      <div className="overflow-hidden rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface)]">
        <div className="flex items-start gap-3 px-4 pb-3 pt-4">
          <div className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--ff-primary)]/25 bg-[var(--ff-primary)]/10">
            {busy ? <Loader2 size={17} className="animate-spin text-[var(--ff-primary)]" /> : <Check size={17} className="text-emerald-400" />}
            {busy && <span className="absolute inset-0 animate-ping rounded-lg border border-[var(--ff-primary)]/20" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="ff-display text-[15px] font-semibold text-[var(--ff-text)]">
                {busy ? humanizePhase(phase) : `Thought for ${formatDuration(elapsed)}`}
              </h3>
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[9px]',
                busy
                  ? 'border-[var(--ff-primary)]/25 bg-[var(--ff-primary)]/10 text-[var(--ff-primary)]'
                  : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
              )}>
                {busy && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
                {busy ? `LIVE · ${formatDuration(elapsed)}` : 'COMPLETE'}
              </span>
            </div>
            <p className="mt-1 max-w-[680px] whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--ff-text-muted)]">
              {busy ? detail : thought || 'Generation finished. Your latest project files are ready.'}
            </p>
          </div>
        </div>

        <div className="px-4 pb-4">
          <ThoughtChain>
            {PIPELINE_STAGES.map((stage, index) => {
              const status = !busy
                ? 'done'
                : index < activeStage
                  ? 'done'
                  : index === activeStage
                    ? 'active'
                    : 'pending';
              const isFileStage = index === 2;
              const hasFiles = shownFiles.length > 0;
              return (
                <ThoughtChainStep key={stage.label} status={status}>
                  <ThoughtChainTrigger>{stage.label}</ThoughtChainTrigger>
                  {status !== 'pending' && (
                    <ThoughtChainContent>
                      {isFileStage && hasFiles ? (
                        <>
                          <ThoughtChainItem>
                            {files.length} file{files.length === 1 ? '' : 's'} written
                          </ThoughtChainItem>
                          {shownFiles.map((file) => (
                            <ThoughtChainItem key={file}>
                              <button
                                type="button"
                                onClick={() => onOpen(file)}
                                className="block max-w-full text-left font-mono transition-colors hover:text-[var(--ff-text)]"
                                title={file}
                              >
                                <span className="block max-w-full truncate">{file}</span>
                              </button>
                            </ThoughtChainItem>
                          ))}
                          {files.length > shownFiles.length && (
                            <ThoughtChainItem>
                              +{files.length - shownFiles.length} more file{files.length - shownFiles.length === 1 ? '' : 's'}
                            </ThoughtChainItem>
                          )}
                        </>
                      ) : (
                        <ThoughtChainItem>
                          {status === 'active' ? detail : stage.detail}
                        </ThoughtChainItem>
                      )}
                    </ThoughtChainContent>
                  )}
                </ThoughtChainStep>
              );
            })}
          </ThoughtChain>
        </div>
      </div>
    </div>
  );
}

function ActivityCard({
  phase,
  thought,
  liveFiles,
  logs,
  elapsed,
  onOpen,
  page,
}: {
  phase: string | null;
  thought: string | null;
  liveFiles: string[];
  logs: { type: string; content: string }[];
  elapsed: number;
  onOpen: (path: string) => void;
  page: boolean;
}) {
  const [showFiles, setShowFiles] = useState(true);
  const [showLogs, setShowLogs] = useState(false);
  const recentLogs = logs.slice(-10);
  const thoughtSteps = useMemo(() => {
    const source = thought
      ? thought.split(/\n+|(?<=[.!?])\s+/)
      : logs.slice(-4).map((line) => line.content);
    return source
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-6)
      .map((line) => {
        const max = page ? 110 : 64;
        return line.length > max ? `${line.slice(0, max - 3)}…` : line;
      });
  }, [thought, logs, page]);

  return (
    <div className="flex gap-3">
      <div className={cn('relative shrink-0', page ? 'w-[30px] h-[30px]' : 'w-[22px] h-[22px] mt-0.5')}>
        <BrandLogo size={page ? 30 : 22} />
        <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-[var(--ff-surface)] border border-[var(--ff-border)] flex items-center justify-center">
          <Loader2 size={8} className="text-[var(--ff-primary)] animate-spin" />
        </span>
      </div>
      <div className="min-w-0 flex-1 rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface)] overflow-hidden">
        <div className="px-3 py-2.5">
          <ThoughtLine
            label={humanizePhase(phase)}
            steps={thoughtSteps}
            working
            elapsed={elapsed}
            fontSize={page ? 13 : 12}
            showTimer
            color="var(--ff-text)"
            glyphColor="var(--ff-primary)"
            collapseOnSettle={false}
            style={{ '--tl-timer': 0.65, '--tl-done': 0.8 } as React.CSSProperties}
          />
        </div>

        {liveFiles.length > 0 && (
          <div className="border-t border-[var(--ff-border)]">
            <button
              type="button"
              onClick={() => setShowFiles((value) => !value)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] uppercase tracking-wide text-[var(--ff-text-dim)] hover:text-[var(--ff-text-muted)]"
            >
              {liveFiles.length} file{liveFiles.length === 1 ? '' : 's'} written
              <ChevronDown size={11} className={cn('transition-transform', showFiles && 'rotate-180')} />
            </button>
            {showFiles && (
              <div className="max-h-40 overflow-y-auto ff-scrollbar pb-1">
                {liveFiles.slice(-40).map((file) => (
                  <button
                    key={file}
                    type="button"
                    onClick={() => onOpen(file)}
                    className="w-full flex items-center gap-1.5 px-3 py-1 text-left text-[10px] font-mono text-[var(--ff-text-muted)] hover:text-[var(--ff-text)] hover:bg-[var(--ff-surface-2)]"
                    title={file}
                  >
                    <FileCode2 size={10} className="text-[var(--ff-primary)] shrink-0" />
                    <span className="truncate">{file}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {recentLogs.length > 0 && (
          <div className="border-t border-[var(--ff-border)]">
            <button
              type="button"
              onClick={() => setShowLogs((value) => !value)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] uppercase tracking-wide text-[var(--ff-text-dim)] hover:text-[var(--ff-text-muted)]"
            >
              <span className="flex items-center gap-1.5"><TerminalIcon size={10} /> Activity</span>
              <ChevronDown size={11} className={cn('transition-transform', showLogs && 'rotate-180')} />
            </button>
            {showLogs && (
              <div className="max-h-32 overflow-y-auto ff-scrollbar px-3 pb-2 space-y-0.5">
                {recentLogs.map((line, index) => (
                  <p
                    key={index}
                    className={cn(
                      'text-[10px] font-mono leading-relaxed break-all',
                      line.type === 'error' ? 'text-red-400' : line.type === 'success' ? 'text-emerald-400' : 'text-[var(--ff-text-dim)]',
                    )}
                  >
                    {line.content}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function AIBuilderPanel({ variant = 'sidebar' }: { variant?: PanelVariant }) {
  const {
    messages,
    sendMessage,
    currentProject,
    conversation,
    repairBuild,
    stopRepair,
    files,
    newConversation,
    generatingIn,
  } = useProjectStore();
  const preview = usePreviewStore();
  const { openFile, activeFile } = useWorkspaceStore();
  const {
    lines,
    isGenerating,
    isAnswering,
    currentPhase,
    generationError,
    setGenerating,
    setAnswering,
    setCurrentPhase,
    setGenerationError,
    addLine,
    liveFiles,
    addLiveFile,
    clearLiveFiles,
  } = useTerminalStore();

  const page = variant === 'page';
  const [input, setInput] = useState('');
  const [streamingReply, setStreamingReply] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const [latestThought, setLatestThought] = useState<string | null>(null);
  const [isEngineConnected, setIsEngineConnected] = useState<boolean | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [dismissedRepair, setDismissedRepair] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);
  const [lastTrace, setLastTrace] = useState<{ thought: string | null; files: string[]; elapsed: number } | null>(null);
  const [modelPreference, setModelPreference] = useState<'fast' | 'quality'>(() => {
    try {
      return localStorage.getItem('ff-model-preference') === 'quality' ? 'quality' : 'fast';
    } catch {
      return 'fast';
    }
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const autoStarted = useRef(false);
  const autoTimer = useRef<number | null>(null);
  const location = useLocation();
  const navState = location.state as { initialPrompt?: string; richPrompt?: string } | null;

  // Store-driven runs (auto-repair, wizard auto-start) are invisible to the
  // panel's own streaming state — OR them in so the LIVE badge, timer and
  // disabled composer reflect every in-flight generation, not just panel ones.
  const busy = isGenerating || isAnswering || generatingIn === currentProject?.id;
  const hasMessages = messages.length > 0;
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';
  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
  const userMessageCount = messages.filter((message) => message.role === 'user').length;
  const modelLabel = shortModel(
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AGENT_MODEL) || undefined,
  );

  useEffect(() => {
    try {
      localStorage.setItem('ff-model-preference', modelPreference);
    } catch {
      // private mode / storage unavailable
    }
  }, [modelPreference]);

  useEffect(() => {
    let mounted = true;
    new HarnessClient().isHealthy().then((healthy) => {
      if (mounted) setIsEngineConnected(healthy);
    }).catch(() => {
      if (mounted) setIsEngineConnected(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, currentPhase, liveFiles.length, streamingReply, busy]);

  useEffect(() => {
    if (!busy) {
      startedAtRef.current = null;
      setElapsed(0);
      return;
    }
    if (startedAtRef.current === null) startedAtRef.current = Date.now();
    const timer = window.setInterval(() => {
      if (startedAtRef.current !== null) {
        const next = Math.floor((Date.now() - startedAtRef.current) / 1000);
        elapsedRef.current = next;
        setElapsed(next);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    if (busy) {
      setLastTrace(null);
      return;
    }
    const files = useTerminalStore.getState().liveFiles;
    if (files.length === 0 && !latestThought) return;
    setLastTrace({
      thought: latestThought,
      files: [...files],
      elapsed: elapsedRef.current,
    });
  }, [busy]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, page ? 180 : 140)}px`;
  }, [input, page]);

  // Wizard hand-off: fire the first prompt once per project/conversation.
  // The timer is cancelled by a dep change (e.g. a second loadConversation
  // settling) — unlatch so the next run can reschedule, or the wizard
  // hand-off would silently never fire.
  useEffect(() => {
    if (!currentProject || !conversation || autoStarted.current || messages.length > 0) return;
    const prompt = navState?.richPrompt?.trim() || navState?.initialPrompt?.trim();
    if (!prompt) return;
    autoTimer.current = window.setTimeout(() => {
      autoTimer.current = null;
      autoStarted.current = true;
      void handleSend(prompt, { isInitialGeneration: true });
    }, 350);
    return () => {
      if (autoTimer.current !== null) {
        window.clearTimeout(autoTimer.current);
        autoTimer.current = null;
        autoStarted.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id, conversation?.id, messages.length]);

  // Native menu bridge + toolbar events.
  useEffect(() => {
    const focus = () => textareaRef.current?.focus();
    const stop = () => handleStop();
    const retry = () => {
      if (lastUserMessage) {
        void handleSend(lastUserMessage, {
          isInitialGeneration: userMessageCount <= 1 && classifyChatIntent(lastUserMessage) === 'build',
        });
      }
    };
    const copyLast = () => {
      if (lastAssistant) void copyText(lastAssistant.content);
    };
    const newChat = () => {
      if (!currentProject) return;
      autoStarted.current = true;
      void newConversation(currentProject.id).then(focus).catch((error) => {
        toast('error', error instanceof Error ? error.message : 'Could not start a new chat.');
      });
    };
    const prefill = (event: Event) => {
      const text = (event as CustomEvent<{ text?: string }>).detail?.text;
      if (!text) return;
      setInput((prev) => (prev.trim() ? prev : text));
      textareaRef.current?.focus();
    };
    window.addEventListener('ff:focus-composer', focus);
    window.addEventListener('ff:stop-generation', stop);
    window.addEventListener('ff:retry-last', retry);
    window.addEventListener('ff:copy-last', copyLast);
    window.addEventListener('ff:new-chat', newChat);
    window.addEventListener('ff:prefill-composer', prefill);
    return () => {
      window.removeEventListener('ff:focus-composer', focus);
      window.removeEventListener('ff:stop-generation', stop);
      window.removeEventListener('ff:retry-last', retry);
      window.removeEventListener('ff:copy-last', copyLast);
      window.removeEventListener('ff:new-chat', newChat);
      window.removeEventListener('ff:prefill-composer', prefill);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUserMessage, lastAssistant?.id, userMessageCount, currentProject?.id]);

  const buildSession = currentProject ? preview.getSession(currentProject.id) : null;
  const showRepair = Boolean(
    buildSession
    && buildSession.status === 'failed'
    && dismissedRepair !== buildSession.sessionId
    && !busy,
  );
  const repairHint = (buildSession?.logs ?? [])
    .filter((line) => /error|exception|because|failed to|not found|invalid/i.test(line))
    .slice(0, 2);

  const contextInfo = useMemo(() => ChatContextHandler.build({
    projectName: currentProject?.name ?? 'Project',
    projectDescription: currentProject?.description ?? '',
    files,
    messages,
    activeFile,
    buildErrors: buildSession?.logs ?? [],
    question: input || lastUserMessage,
  }), [currentProject?.name, currentProject?.description, files, messages, activeFile, buildSession?.logs, input, lastUserMessage]);

  const tokenBudget = 12000;
  const tokenPct = Math.min(100, Math.round((contextInfo.tokenEstimate / tokenBudget) * 100));
  const tokenLabel = contextInfo.tokenEstimate >= 1000
    ? `${(contextInfo.tokenEstimate / 1000).toFixed(1)}k`
    : String(contextInfo.tokenEstimate);

  function handleStop() {
    // Store-driven runs (auto-repair) don't belong to this panel's controller —
    // route their Stop through the store's repair abort instead.
    if (!abortRef.current && generatingIn === currentProject?.id) {
      stopRepair();
      addLine({ type: 'error', content: '⏹ Repair stopped by user' });
      return;
    }
    abortRef.current?.abort();
    abortRef.current = null;
    sendingRef.current = false;
    setGenerating(false);
    setAnswering(false);
    setCurrentPhase(null);
    setGenerationError('Generation stopped.');
    addLine({ type: 'error', content: '⏹ Generation stopped by user' });
  }

  async function handleSend(prompt?: string, opts?: SendMessageOptions) {
    const text = (prompt ?? input).trim();
    if (!text || busy || sendingRef.current || !currentProject) return;
    const attachments = opts?.attachedFiles ?? attachedFiles;

    sendingRef.current = true;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    setInput('');
    setAttachedFiles([]);
    setStreamingReply('');
    setGenerationError(null);
    setLatestThought(null);
    setLastTrace(null);
    clearLiveFiles();

    const isNewApp = opts?.isInitialGeneration === true || messages.length === 0;
    const intent = opts?.isInitialGeneration || opts?.isRepair ? 'build' : classifyChatIntent(text);

    try {
      if (intent === 'chat') {
        setAnswering(true);
        setCurrentPhase('Thinking…');
        const result = await sendMessage(currentProject.id, text, (message) => setCurrentPhase(message), {
          ...opts,
          modelPreference: opts?.modelPreference ?? modelPreference,
          attachedFiles: attachments,
          signal,
          onToken: (token) => setStreamingReply((reply) => reply + token),
        });
        if (result.mode === 'duplicate') {
          setGenerationError('A response is already in progress for this chat.');
          return;
        }
        setStreamingReply('');
        addLine({ type: 'success', content: '✓ Answered — project files untouched' });
        return;
      }

      setGenerating(true);
      setCurrentPhase(isNewApp ? 'Starting the harness engine…' : 'Applying your changes…');
      addLine({ type: 'output', content: `▶ ${text.slice(0, 140)}` });

      const result = await sendMessage(currentProject.id, text, (message) => setCurrentPhase(message), {
        ...opts,
        modelPreference: opts?.modelPreference ?? modelPreference,
        attachedFiles: attachments,
        signal,
        onEvent: (event) => {
          if (event.thought) setLatestThought(event.thought);
          if (event.message) {
            setCurrentPhase(event.message);
            addLine({ type: 'output', content: event.message });
            if (event.message.startsWith('✓ ')) {
              const file = event.message.replace(/^✓\s*/, '').trim();
              if (file) addLiveFile(file);
            }
          }
        },
      });

      if (result.mode === 'duplicate') {
        setGenerationError('A generation is already running for this chat.');
        return;
      }
      if (result.mode === 'chat') return;

      const count = result.fileCount ?? result.files?.length ?? 0;
      if (count === 0) {
        setGenerationError('The engine returned no files. Your project was not changed — please retry.');
        return;
      }
      toast('success', isNewApp ? `App generated (${count} files)` : `Updated ${count} files`);
    } catch (error) {
      if (signal.aborted) {
        setGenerationError('Generation stopped.');
        return;
      }
      const message = error instanceof Error ? error.message : 'Generation failed.';
      setGenerationError(message);
      addLine({ type: 'error', content: `✗ ${message}` });
    } finally {
      sendingRef.current = false;
      abortRef.current = null;
      setGenerating(false);
      setAnswering(false);
      setCurrentPhase(null);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      void handleSend();
    }
  }

  const activityLogs = useMemo(
    () => lines.map((line) => ({ type: line.type, content: line.content })),
    [lines],
  );

  const sidebarComposer = (
    <div className="w-full">
      <div className="flex items-end gap-2 rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface)] px-3 py-2 focus-within:border-[var(--ff-primary)]/60 transition-colors">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={busy ? 'Generating…' : page ? 'Ask about the project, or describe what to build next…' : 'Describe a change or ask a question…'}
          disabled={busy}
          className="flex-1 resize-none bg-transparent outline-none text-[13px] leading-relaxed text-[var(--ff-text)] placeholder:text-[var(--ff-text-dim)] py-1 max-h-[180px] ff-scrollbar disabled:opacity-60"
        />
        {busy ? (
          <button
            type="button"
            onClick={handleStop}
            className="shrink-0 w-8 h-8 rounded-lg bg-red-500/15 text-red-400 border border-red-500/25 flex items-center justify-center hover:bg-red-500/25 transition-colors"
            aria-label="Stop generation"
            title="Stop generation"
          >
            <Square size={12} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!input.trim() || !currentProject}
            className="shrink-0 w-8 h-8 rounded-lg bg-[var(--ff-primary)] text-[var(--ff-bg)] flex items-center justify-center disabled:opacity-35 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            aria-label="Send message"
            title="Send (⌘↵)"
          >
            <Send size={13} />
          </button>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 px-0.5">
        <span className="hidden text-[9px] text-[var(--ff-text-dim)] sm:block">
          {busy ? 'Stop cancels the run — files are kept' : '⌘↵ to send · project context included'}
        </span>
        <div className="ml-auto flex items-center gap-2.5">
          <div
            className="flex items-center gap-1.5"
            title={`Estimated context: ~${contextInfo.tokenEstimate.toLocaleString()} of ${tokenBudget.toLocaleString()} tokens`}
          >
            <span className="font-mono text-[8px] uppercase tracking-wide text-[var(--ff-text-dim)]">ctx</span>
            <div className="h-1 w-12 overflow-hidden rounded-full bg-[var(--ff-surface-2)]">
              <div
                className={cn('h-full rounded-full transition-all', tokenPct >= 90 ? 'bg-red-400' : tokenPct >= 70 ? 'bg-amber-400' : 'bg-[var(--ff-primary)]')}
                style={{ width: `${tokenPct}%` }}
              />
            </div>
            <span className="font-mono text-[9px] tabular-nums text-[var(--ff-text-dim)]">{tokenLabel}/{Math.round(tokenBudget / 1000)}k</span>
          </div>
          {currentProject && files.some((file) => file.path === 'pubspec.yaml') && (
            <button
              type="button"
              onClick={() => openFile('pubspec.yaml')}
              className="hidden items-center gap-1 text-[9px] text-[var(--ff-text-dim)] hover:text-[var(--ff-text-muted)] sm:flex"
              title="Open pubspec.yaml"
            >
              <FolderOpen size={9} /> pubspec.yaml
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const pageComposer = (
    <div className="w-full">
      <div className="rounded-2xl border border-[var(--ff-border)] bg-[var(--ff-surface)] p-3 focus-within:border-[var(--ff-text-dim)]/60 transition-colors">
        {attachedFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {attachedFiles.map((path) => (
              <span
                key={path}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--ff-surface-2)] px-2 py-1 text-[12px] text-[var(--ff-text-muted)]"
              >
                <FileCode2 size={11} className="text-[var(--ff-text-dim)]" />
                {path.split('/').pop()}
                <button
                  type="button"
                  onClick={() => setAttachedFiles((current) => current.filter((item) => item !== path))}
                  className="text-[var(--ff-text-dim)] hover:text-[var(--ff-text)]"
                  aria-label={`Remove ${path}`}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={busy ? 'Working…' : 'Ask anything'}
          disabled={busy}
          className="min-h-[44px] w-full resize-none bg-transparent px-0.5 py-1 text-[15px] leading-relaxed text-[var(--ff-text)] outline-none placeholder:text-[var(--ff-text-dim)] max-h-[180px] ff-scrollbar disabled:opacity-60"
        />
        <div className="mt-1 flex items-center justify-between">
          <Dropdown
            align="left"
            trigger={(
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ff-text-muted)] transition-colors hover:bg-[var(--ff-surface-2)] hover:text-[var(--ff-text)]"
                title="Attach a project file"
                aria-label="Attach a project file"
              >
                <Plus size={17} />
              </button>
            )}
          >
            <div className="max-h-64 overflow-y-auto ff-scrollbar">
              {files.filter((file) => !file.is_directory).slice(0, 40).map((file) => (
                <DropdownItem
                  key={file.path}
                  icon={<FileCode2 size={13} />}
                  onClick={() => setAttachedFiles((current) => (
                    current.includes(file.path) ? current : [...current, file.path].slice(0, 4)
                  ))}
                >
                  <span className="truncate font-mono text-[11px]">{file.path}</span>
                </DropdownItem>
              ))}
              {files.filter((file) => !file.is_directory).length === 0 && (
                <div className="px-3 py-2 text-[11px] text-[var(--ff-text-dim)]">No project files yet.</div>
              )}
            </div>
          </Dropdown>

          <div className="flex items-center gap-2">
            <span className="hidden font-mono text-[9px] text-[var(--ff-text-dim)] sm:inline" title="Estimated context tokens">
              ctx {tokenLabel}/{Math.round(tokenBudget / 1000)}k
            </span>
            {busy ? (
              <button
                type="button"
                onClick={handleStop}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/15 text-red-400 transition-colors hover:bg-red-500/25"
                aria-label="Stop generation"
                title="Stop generation"
              >
                <Square size={13} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={!input.trim() || !currentProject}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ff-text)] text-[var(--ff-bg)] transition-opacity disabled:opacity-25"
                aria-label="Send message"
                title="Send (⌘↵)"
              >
                <ArrowUp size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[10px] text-[var(--ff-text-dim)]">
        {busy ? 'Stop cancels the run — files are kept' : 'FlutterForge can make mistakes. Review generated code before shipping.'}
      </p>
    </div>
  );

  const composer = page ? pageComposer : sidebarComposer;

  const header = (
    <div className={cn(
      'flex items-center justify-between gap-3 shrink-0',
      page ? 'px-5 sm:px-10 py-4' : 'px-3 py-2 border-b border-[var(--ff-border)]',
    )}>
      <div className="flex items-center gap-2 min-w-0">
        {!page && (
          <>
            <BrandLogo size={18} />
            <span className="ff-display text-sm font-semibold text-[var(--ff-text)]">AI Builder</span>
            <span className="text-[10px] text-[var(--ff-text-dim)] truncate hidden sm:inline">{modelLabel}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-1.5 min-w-0 flex-wrap justify-end relative">
        <AgentActivityPopover busy={busy} elapsed={elapsed} />
        <Dropdown
          align="right"
          trigger={(
            <button
              type="button"
              className={cn(
                'inline-flex items-center gap-1 font-mono text-[var(--ff-text-muted)] transition-colors hover:text-[var(--ff-text)]',
                page
                  ? 'px-1 py-1 text-[12px]'
                  : 'rounded-full border border-[var(--ff-border)] bg-[var(--ff-surface-2)] px-2 py-1 text-[9px]',
              )}
              title={modelPreference === 'quality' ? 'Quality model: Nemotron Ultra (slower, stronger)' : 'Fast model: Nemotron Lightning'}
            >
              <Cpu size={9} />
              {modelPreference === 'fast' ? 'Fast' : 'Quality'}
              <ChevronDown size={8} />
            </button>
          )}
        >
          <DropdownItem onClick={() => setModelPreference('fast')}>
            <div className="flex w-full items-center justify-between gap-3">
              <span>Fast · Lightning</span>
              <span className="font-mono text-[9px] text-[var(--ff-text-dim)]">~1 min</span>
            </div>
          </DropdownItem>
          <DropdownItem onClick={() => setModelPreference('quality')}>
            <div className="flex w-full items-center justify-between gap-3">
              <span>Quality · Ultra</span>
              <span className="font-mono text-[9px] text-[var(--ff-text-dim)]">slower</span>
            </div>
          </DropdownItem>
        </Dropdown>
        <button
          type="button"
          onClick={() => setShowContext((value) => !value)}
          className={cn(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono border transition-colors',
            showContext
              ? 'bg-[var(--ff-primary)] text-[var(--ff-bg)] border-[var(--ff-border)]'
              : 'bg-[var(--ff-surface-2)] text-[var(--ff-text-muted)] border-[var(--ff-border)] hover:text-[var(--ff-text)]',
          )}
          title="Show what the chat knows about this project"
        >
          <Layers size={9} /> Context
        </button>
        {showContext && (
          <div className="absolute right-0 top-7 z-30 w-64 max-w-[calc(100vw-1.5rem)] rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface)] shadow-[4px_4px_0_var(--ff-border)] p-3 text-left">
            <div className="flex items-center justify-between mb-2">
              <p className="ff-label text-[9px] text-[var(--ff-text-dim)]">Chat context</p>
              <button type="button" onClick={() => setShowContext(false)} className="text-[var(--ff-text-dim)] hover:text-[var(--ff-text)]" aria-label="Close context">
                <X size={11} />
              </button>
            </div>
            <dl className="space-y-1.5 text-[10px]">
              <div className="flex justify-between gap-2"><dt className="text-[var(--ff-text-dim)]">Files</dt><dd className="text-[var(--ff-text-muted)] font-mono">{contextInfo.fileCount}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-[var(--ff-text-dim)]">Screens</dt><dd className="text-[var(--ff-text-muted)] font-mono">{contextInfo.screenCount}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-[var(--ff-text-dim)]">Backend</dt><dd className="text-[var(--ff-text-muted)] font-mono">{contextInfo.backend}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-[var(--ff-text-dim)]">History</dt><dd className="text-[var(--ff-text-muted)] font-mono">{contextInfo.history.length} turns</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-[var(--ff-text-dim)]">Est. tokens</dt><dd className="text-[var(--ff-text-muted)] font-mono">{contextInfo.tokenEstimate}</dd></div>
              <div className="pt-1 border-t border-[var(--ff-border)]">
                <dt className="text-[var(--ff-text-dim)]">Active file</dt>
                <dd className="text-[var(--ff-text-muted)] font-mono truncate" title={contextInfo.activeFile ?? 'none'}>{contextInfo.activeFile ?? 'none'}</dd>
              </div>
              <div>
                <dt className="text-[var(--ff-text-dim)]">Build errors</dt>
                <dd className={cn('font-mono', (buildSession?.logs?.length ?? 0) > 0 ? 'text-amber-500' : 'text-[var(--ff-text-muted)]')}>
                  {(buildSession?.logs?.length ?? 0) > 0 ? 'included in context' : 'none'}
                </dd>
              </div>
            </dl>
            <p className="text-[9px] text-[var(--ff-text-dim)] mt-2 leading-relaxed">
              Project tree, active-file excerpt, dependencies and build errors are sent with your next request. Keys are never included.
            </p>
          </div>
        )}
        <span
          className={cn(
            page ? 'hidden' : 'hidden sm:inline-flex',
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono border',
            isEngineConnected === null
              ? 'bg-[var(--ff-surface-2)] text-[var(--ff-text-dim)] border-[var(--ff-border)]'
              : isEngineConnected
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-500 border-amber-500/20',
          )}
          title={isEngineConnected
            ? 'Local DeepSeek Harness engine connected'
            : 'Harness engine offline — using the in-browser agent'}
        >
          <span className={cn('w-1 h-1 rounded-full', isEngineConnected === false ? 'bg-amber-400' : 'bg-emerald-400', isEngineConnected === null && 'bg-[var(--ff-text-dim)]')} />
          {isEngineConnected === null ? 'Checking' : isEngineConnected ? 'Harness' : 'Local'}
        </span>
      </div>
    </div>
  );

  const body = (
    <div ref={scrollRef} className="flex-1 overflow-y-auto ff-scrollbar">
      <div className={cn('mx-auto w-full', page ? 'max-w-[860px] px-5 sm:px-10 py-6 space-y-8' : 'max-w-2xl px-3 py-4 space-y-4')}>
        {!hasMessages && !busy && (
          <div className={cn('flex flex-col justify-center', page ? 'min-h-[48vh]' : 'min-h-[320px]')}>
            <div className={cn('mb-3', page ? 'w-14 h-14' : 'w-11 h-11')}>
              <BrandLogo size={page ? 56 : 44} />
            </div>
            <h2 className={cn('ff-display font-semibold text-[var(--ff-text)]', page ? 'text-2xl sm:text-3xl' : 'text-lg')}>
              What are we building?
            </h2>
            <p className={cn('text-[var(--ff-text-muted)] mt-1.5', page ? 'text-sm max-w-xl' : 'text-xs')}>
              Describe the app. FlutterForge writes the project, validates it, builds a live preview, and repairs compile errors.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-5">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion.label}
                  type="button"
                  onClick={() => {
                    setInput(suggestion.prompt);
                    textareaRef.current?.focus();
                  }}
                  className="text-left rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface)] px-3.5 py-3 hover:border-[var(--ff-primary)]/50 hover:bg-[var(--ff-surface-2)] transition-colors"
                >
                  <span className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--ff-text)]">
                    <Plus size={11} className="text-[var(--ff-primary)]" />
                    {suggestion.label}
                  </span>
                  <span className="block text-[10px] text-[var(--ff-text-dim)] mt-1 line-clamp-2">{suggestion.prompt}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => {
          const isLastAssistant = lastAssistant?.id === message.id && index === messages.length - 1;
          return (
            <div key={message.id}>
              {page && isLastAssistant && !busy && lastTrace && (
                <AgentTrace
                  thought={lastTrace.thought}
                  phase={null}
                  files={lastTrace.files}
                  elapsed={lastTrace.elapsed}
                  busy={false}
                  onOpen={openFile}
                />
              )}
              <MessageBubble
                message={message}
                page={page}
                onOpen={openFile}
                canRetry={isLastAssistant && Boolean(lastUserMessage) && !busy}
                onRetry={() => void handleSend(lastUserMessage, {
                  isInitialGeneration: userMessageCount <= 1 && classifyChatIntent(lastUserMessage) === 'build',
                })}
              />
            </div>
          );
        })}

        {isAnswering && (
          <div className="flex items-start gap-2.5" aria-live="polite" aria-label="Assistant response">
            <BrandLogo size={22} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="ff-display text-[11px] font-semibold text-[var(--ff-text)]">FlutterForge</span>
                <span className="text-[10px] text-[var(--ff-primary)]">{streamingReply ? 'Responding…' : 'Thinking…'}</span>
              </div>
              {streamingReply ? (
                <Markdown text={streamingReply} className="mt-1.5" />
              ) : (
                <p className="mt-1.5 text-[12px] text-[var(--ff-text-dim)]">Preparing a reply…</p>
              )}
            </div>
          </div>
        )}

        {busy && (page && isGenerating ? (
          <AgentTrace
            thought={latestThought}
            phase={currentPhase}
            files={liveFiles}
            elapsed={elapsed}
            busy
            onOpen={openFile}
          />
        ) : (
          <ActivityCard
            phase={currentPhase}
            thought={latestThought}
            liveFiles={liveFiles}
            logs={activityLogs}
            elapsed={elapsed}
            onOpen={openFile}
            page={false}
          />
        ))}

        {generationError && !busy && (
          <div className="rounded-xl border border-red-500/25 bg-red-500/5 px-3.5 py-3">
            <div className="flex items-start gap-2">
              <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium text-red-500">Request failed</p>
                <p className="text-[11px] text-red-500/80 mt-0.5 break-words">{generationError}</p>
                {lastUserMessage && (
                  <button
                    type="button"
                    onClick={() => void handleSend(lastUserMessage, {
                      isInitialGeneration: userMessageCount <= 1 && classifyChatIntent(lastUserMessage) === 'build',
                    })}
                    className="mt-2 px-2.5 py-1 rounded-md bg-red-500/15 text-red-500 text-[10px] font-medium hover:bg-red-500/25"
                  >
                    Retry
                  </button>
                )}
              </div>
              <button type="button" onClick={() => setGenerationError(null)} className="p-0.5 text-red-400/60 hover:text-red-400" aria-label="Dismiss error">
                <X size={12} />
              </button>
            </div>
          </div>
        )}

        {showRepair && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3.5 py-3">
            <div className="flex items-start gap-2">
              <Wrench size={14} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium text-amber-600">Preview build failed</p>
                {repairHint.length > 0 && (
                  <p className="text-[10px] font-mono text-amber-600/80 mt-0.5 line-clamp-2">{repairHint.join(' · ')}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => void repairBuild(currentProject!.id)}
                    className="px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-600 text-[10px] font-medium hover:bg-amber-500/25"
                  >
                    Fix automatically
                  </button>
                  <button
                    type="button"
                    onClick={() => setDismissedRepair(buildSession?.sessionId ?? null)}
                    className="text-[10px] text-amber-600/70 hover:text-amber-600"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (page) {
    return (
      <div className="flex flex-col h-full bg-[var(--ff-bg)]">
        {header}
        {body}
        <div className="shrink-0 bg-transparent px-5 pb-6 pt-2 sm:px-10">
          <div className="mx-auto w-full max-w-[860px]">{composer}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--ff-bg)]">
      {header}
      {body}
      <div className="border-t border-[var(--ff-border)] bg-[var(--ff-surface)]/40 px-3 py-2.5 shrink-0">
        <div className="mx-auto w-full max-w-2xl">{composer}</div>
      </div>
    </div>
  );
}
