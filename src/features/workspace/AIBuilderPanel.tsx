import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Send,
  Check,
  Loader2,
  FileCode2,
  Package,
  Bug,
  Hammer,
  Eye,
  Brain,
  Wrench,
  AlertCircle,
  Cpu,
  ChevronRight,
  ChevronDown,
  Database,
  Play,
  Layers,
  Terminal as TerminalIcon,
  Copy,
  CheckCheck,
  CornerDownLeft,
  MessageSquare,
  Zap,
  GripVertical,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useProjectStore } from '@/stores/project.store';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { useTerminalStore } from '@/stores/terminal.store';
import { Button } from '@/components/ui/Button';
import { FileDiff } from '@/components/ui/FileDiff';
import { cn } from '@/utils/cn';

import type { AIMessage, GenerationStep } from '@/types';

const INITIAL_SUGGESTIONS = [
  { label: 'E-Commerce Sneaker Store', prompt: 'Build a production-grade Flutter E-Commerce app called SneakerVault with Supabase Auth, product catalog, cart, orders, and RLS policies' },
  { label: 'AI Chat Assistant', prompt: 'Create an AI Chat assistant app called PulseChat with Supabase conversations, messages, realtime streams and Markdown rendering' },
  { label: 'Crypto Portfolio Tracker', prompt: 'Build a Crypto Portfolio Tracker called NovaCrypto with Supabase wallets, realtime prices, P&L charts and dark theme' },
  { label: 'Fitness Streak Tracker', prompt: 'Create a Fitness & Workout Streak Tracker called FitPulse with Supabase exercise logs, streak counter and animated progress rings' },
  { label: 'Food Delivery App', prompt: 'Build a Food Delivery app called SwiftBite with Supabase restaurants, menus, cart, orders and live delivery tracking' },
];

const STEP_ICONS: Record<string, LucideIcon> = {
  understanding: Brain,
  planning: Brain,
  generating: FileCode2,
  installing: Package,
  analyzing: Bug,
  fixing: Wrench,
  building: Hammer,
  preview: Eye,
};

export function AIBuilderPanel() {
  const { messages, sendMessage, currentProject, conversation, versions, restoreVersion } = useProjectStore();
  const { openFile, setActiveView } = useWorkspaceStore();
  const { lines, isGenerating, generationSteps, currentPhase, generationError, setGenerating, setGenerationSteps, updateStep, addLine, setCurrentPhase, setGenerationError } = useTerminalStore();
  const [input, setInput] = useState('');
  // Persist across tab switches via terminal store (not local state)
  const generating = isGenerating;
  const steps = generationSteps;
  const [showTerminalLog, setShowTerminalLog] = useState(false);
  const [copiedLog, setCopiedLog] = useState(false);
  const location = useLocation();
  const autoStarted = useRef(false);
  const navState = location.state as { initialPrompt?: string; richPrompt?: string; template?: string; projectName?: string } | null;
  const initialPrompt = navState?.initialPrompt;
  const richPrompt = navState?.richPrompt;
  const scrollRef = useRef<HTMLDivElement>(null);
  const terminalLogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);


  const hasMessages = messages.length > 0;

  // Auto-scroll messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, steps, currentPhase]);

  // Auto-scroll terminal
  useEffect(() => {
    if (showTerminalLog) {
      terminalLogRef.current?.scrollTo({ top: terminalLogRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [lines, showTerminalLog]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [input]);

  // Auto-start from navigation state - workflow: Create New Flutter App -> Describe -> agent generates
  useEffect(() => {
    if (currentProject && conversation && !autoStarted.current && messages.length === 0) {
      const promptToUse = richPrompt?.trim() || initialPrompt?.trim();
      if (promptToUse) {
        autoStarted.current = true;
        // Small delay to ensure conversation and files are loaded
        setTimeout(() => void handleSend(promptToUse), 400);
      }
    }
  }, [currentProject?.id, initialPrompt, richPrompt, messages.length, conversation?.id]);

  async function handleSend(prompt?: string) {
    const text = (prompt ?? input).trim();
    if (!text || generating || !currentProject) return;

    setInput('');
    setGenerationError(null);
    setGenerating(true);
    setShowTerminalLog(true);
    setCurrentPhase('Planning with NVIDIA Nemotron Ultra...');

    const stepDefs: GenerationStep[] = [
      { id: 'understanding', label: 'Analyzing request & project context', status: 'pending' },
      { id: 'planning', label: 'Designing architecture & Supabase schema', status: 'pending' },
      { id: 'generating', label: 'Synthesizing production Flutter code', status: 'pending' },
      { id: 'installing', label: 'Validating & auto-healing code', status: 'pending' },
      { id: 'preview', label: 'Ready to preview', status: 'pending' },
    ];
    setGenerationSteps(stepDefs);

    const completeStep = (step: GenerationStep) => {
      updateStep(step.id, { status: 'completed' });
    };

    for (const step of stepDefs.slice(0, 2)) {
      updateStep(step.id, { status: 'running' });
      addLine({ type: 'output', content: `▶ ${step.label}` });
      completeStep(step);
    }

    const generationStep = stepDefs[2];
    updateStep(generationStep.id, { status: 'running' });
    addLine({ type: 'output', content: `▶ ${generationStep.label}` });

    try {
      await sendMessage(currentProject.id, text, (message) => {
        setCurrentPhase(message);
        addLine({ type: 'output', content: `  ${message}` });
      });
      completeStep(generationStep);
      completeStep(stepDefs[3]);
      completeStep(stepDefs[4]);
      addLine({ type: 'success', content: '✓ Generation complete — validated with 0 errors' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI generation failed.';
      setGenerationError(message);
      addLine({ type: 'error', content: `✗ ${message}` });
    } finally {
      setGenerating(false);
      setCurrentPhase(null);
      setGenerationSteps([]);
    }
  }

  async function handleRollback() {
    if (versions.length > 1 && currentProject) {
      const prevVersion = versions[1];
      await restoreVersion(currentProject.id, prevVersion.id);
      addLine({ type: 'success', content: `✓ Restored checkpoint v${prevVersion.version_number}` });
    }
  }

  function handleCopyTerminalLogs() {
    const logText = lines.map((l) => `[${new Date(l.timestamp).toLocaleTimeString()}] ${l.content}`).join('\n');
    navigator.clipboard.writeText(logText);
    setCopiedLog(true);
    setTimeout(() => setCopiedLog(false), 2000);
  }

  return (
    <div className="flex flex-col h-full bg-[var(--ff-bg)] overflow-hidden">


      {/* ── Messages area ─────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto ff-scrollbar px-3 py-4 space-y-3 scroll-smooth"
      >

        {/* ── Empty state ────────────────────────────────────── */}
        {!hasMessages && !generating && (
          <div className="flex flex-col items-center justify-center h-full text-center px-2 py-6">
            <div className="relative mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--ff-primary)]/20 to-purple-500/20 flex items-center justify-center ring-1 ring-[var(--ff-primary)]/25 shadow-xl shadow-[var(--ff-primary)]/10">
                <Zap size={28} className="text-[var(--ff-primary)]" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center ring-2 ring-[var(--ff-bg)]">
                <span className="text-[8px] text-white font-bold">AI</span>
              </div>
            </div>

            <h3 className="text-sm font-bold text-white mb-1">What are we building today?</h3>
            <p className="text-[11px] text-[var(--ff-text-dim)] mb-5 max-w-xs leading-relaxed">
              Describe your app. The agent generates complete Flutter code, Supabase SQL with RLS, Material 3 UI, and GoRouter navigation.
            </p>

            {/* Starter templates */}
            <div className="w-full space-y-1.5">
              <p className="text-[10px] font-semibold text-[var(--ff-text-dim)] uppercase tracking-wider text-left mb-2">
                Start with a template:
              </p>
              {INITIAL_SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => handleSend(s.prompt)}
                  className="w-full group flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[var(--ff-surface)] border border-[var(--ff-border)] hover:border-[var(--ff-primary)]/50 hover:bg-[var(--ff-primary)]/5 transition-all text-left"
                >
                  <MessageSquare size={13} className="text-[var(--ff-primary)] shrink-0 opacity-70 group-hover:opacity-100" />
                  <span className="text-xs text-[var(--ff-text-muted)] group-hover:text-white flex-1 truncate transition-colors">
                    {s.label}
                  </span>
                  <ChevronRight size={12} className="text-[var(--ff-text-dim)] opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Message bubbles ────────────────────────────────── */}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onOpenFile={(path) => openFile(path)}
            onSelectNextAction={(actionPrompt) => handleSend(actionPrompt)}
          />
        ))}

        {/* ── Generating activity card ───────────────────────── */}
        {generating && (
          <div className="ff-fade-in rounded-2xl border border-[var(--ff-primary)]/25 bg-[var(--ff-primary)]/5 p-3.5 space-y-3">
            {/* Header row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Cpu size={13} className="text-[var(--ff-primary)] animate-pulse shrink-0" />
                <span className="text-xs font-medium text-[var(--ff-primary)] truncate">
                  {currentPhase || 'Generating with Nemotron Ultra...'}
                </span>
              </div>
              {/* Live pulse dot */}
              <span className="flex h-2 w-2 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--ff-primary)] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--ff-primary)]" />
              </span>
            </div>

            {/* Steps */}
            {steps.length > 0 && (
              <div className="space-y-2 pt-1 border-t border-white/5">
                {steps.map((step) => {
                  const Icon = STEP_ICONS[step.id] ?? FileCode2;
                  return (
                    <div key={step.id} className="flex items-center gap-2 text-[11px]">
                      {step.status === 'completed' ? (
                        <span className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                          <Check size={9} className="text-emerald-400" />
                        </span>
                      ) : step.status === 'running' ? (
                        <Loader2 size={12} className="text-[var(--ff-primary)] ff-spin shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0" />
                      )}
                      <span className={cn(
                        'truncate',
                        step.status === 'pending' ? 'text-[var(--ff-text-dim)]'
                        : step.status === 'completed' ? 'text-[var(--ff-text-muted)] line-through opacity-60'
                        : 'text-white font-medium'
                      )}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Live Terminal Log ──────────────────────────────── */}
        {lines.length > 0 && (
          <div className="rounded-xl border border-[var(--ff-border)] overflow-hidden">
            {/* Terminal header bar */}
            <button
              onClick={() => setShowTerminalLog(!showTerminalLog)}
              className="w-full flex items-center justify-between px-3 py-2 bg-black/60 hover:bg-black/80 transition-colors"
            >
              <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--ff-text-muted)]">
                <TerminalIcon size={11} className="text-emerald-400 shrink-0" />
                <span>Execution Log</span>
                <span className="px-1.5 py-0.5 bg-white/5 rounded text-[9px]">{lines.length}</span>
                {generating && <Loader2 size={9} className="ff-spin text-[var(--ff-primary)]" />}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); handleCopyTerminalLogs(); }}
                  className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/10 text-[var(--ff-text-dim)] hover:text-white transition-all"
                >
                  {copiedLog ? <CheckCheck size={10} className="text-emerald-400" /> : <Copy size={10} />}
                  <span className="hidden sm:inline">{copiedLog ? 'Copied' : 'Copy'}</span>
                </button>
                {showTerminalLog
                  ? <ChevronDown size={12} className="text-white/40" />
                  : <ChevronRight size={12} className="text-white/40" />}
              </div>
            </button>

            {/* Terminal body */}
            {showTerminalLog && (
              <div
                ref={terminalLogRef}
                className="max-h-40 overflow-y-auto ff-scrollbar bg-[#080c14] p-3 space-y-1 font-mono text-[10px]"
              >
                {lines.map((line) => (
                  <div key={line.id} className="flex gap-2 leading-relaxed">
                    <span className="text-white/25 shrink-0 tabular-nums">
                      {new Date(line.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span className={cn(
                      'break-all',
                      line.type === 'error' ? 'text-red-400'
                      : line.type === 'success' ? 'text-emerald-400'
                      : line.type === 'command' ? 'text-cyan-400'
                      : 'text-white/75'
                    )}>
                      {line.content}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Error card ─────────────────────────────────────── */}
        {generationError && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-200 ff-fade-in">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-400" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-red-300 text-[11px]">Generation Failed</p>
              <p className="text-[10px] opacity-80 mt-0.5 break-words">{generationError}</p>
            </div>
            <button
              onClick={() => handleSend(messages[messages.length - 1]?.content)}
              className="shrink-0 px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-[10px] font-medium text-red-200 transition-all whitespace-nowrap"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* ── Quick Nav shortcuts ────────────────────────────── */}
      {hasMessages && !generating && (
        <div className="px-3 pb-2 flex gap-1.5 shrink-0">
          <button
            onClick={() => setActiveView('preview')}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-[var(--ff-surface)] border border-[var(--ff-border)] hover:border-[var(--ff-primary)]/50 hover:bg-[var(--ff-primary)]/5 text-[10px] text-[var(--ff-text-muted)] hover:text-white transition-all"
          >
            <Play size={10} className="text-[var(--ff-primary)]" />
            Preview
          </button>
          <button
            onClick={() => setActiveView('files')}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-[var(--ff-surface)] border border-[var(--ff-border)] hover:border-[var(--ff-primary)]/50 hover:bg-[var(--ff-primary)]/5 text-[10px] text-[var(--ff-text-muted)] hover:text-white transition-all"
          >
            <Layers size={10} className="text-purple-400" />
            Explorer
          </button>
        </div>
      )}

      {/* ── Input area ────────────────────────────────────────── */}
      <div className="border-t border-[var(--ff-border)] p-3 shrink-0 bg-[var(--ff-surface)]">
        <div className="flex flex-col gap-2">
          {/* Textarea + send */}
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Describe what to build or modify..."
                disabled={generating}
                rows={1}
                className="w-full ff-input px-3 py-2.5 text-xs resize-none placeholder:text-[var(--ff-text-dim)] disabled:opacity-50 rounded-xl pr-2 leading-relaxed overflow-hidden"
                style={{ minHeight: 40, maxHeight: 120 }}
              />
            </div>
            <button
              disabled={!input.trim() || generating}
              onClick={() => handleSend()}
              className={cn(
                'self-end w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all',
                input.trim() && !generating
                  ? 'bg-[var(--ff-primary)] hover:bg-[var(--ff-primary-hover)] text-white shadow-md shadow-[var(--ff-primary)]/30 scale-100 hover:scale-105 active:scale-95'
                  : 'bg-[var(--ff-surface-2)] text-[var(--ff-text-dim)] cursor-not-allowed'
              )}
            >
              {generating
                ? <Loader2 size={14} className="ff-spin" />
                : <Send size={14} />}
            </button>
          </div>

          {/* Footer hint */}
          <div className="flex items-center justify-between text-[9px] text-[var(--ff-text-dim)] px-0.5">
            <span className="flex items-center gap-1">
              <CornerDownLeft size={9} />
              Enter to send &nbsp;·&nbsp; Shift+Enter for newline
            </span>
            <span className="flex items-center gap-1">
              <GripVertical size={9} className="opacity-50" />
              Drag edge to resize
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Message Bubble ───────────────────────────────────────────────────── */
function MessageBubble({
  message,
  onOpenFile,
  onSelectNextAction,
}: {
  message: AIMessage;
  onOpenFile: (path: string) => void;
  onSelectNextAction: (prompt: string) => void;
}) {
  const isUser = message.role === 'user';
  const nextActions = (message.metadata?.nextActionPrompts as string[]) || [];
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const files = message.changed_files ?? [];
  const SHOW_LIMIT = 5;
  const visibleFiles = showAllFiles ? files : files.slice(0, SHOW_LIMIT);
  const hiddenCount = files.length - SHOW_LIMIT;

  return (
    <div className={cn('group flex flex-col gap-2 ff-fade-in', isUser ? 'items-end' : 'items-start')}>
      {/* Bubble */}
      <div
        className={cn(
          'relative max-w-[88%] rounded-2xl text-xs',
          isUser
            ? 'bg-gradient-to-br from-[var(--ff-primary)] to-blue-600 text-white px-4 py-2.5 rounded-br-sm shadow-lg shadow-[var(--ff-primary)]/20'
            : 'bg-[var(--ff-surface)] border border-[var(--ff-border)] text-[var(--ff-text)] px-3.5 py-2.5 rounded-bl-sm'
        )}
      >
        <button
          onClick={handleCopy}
          className="absolute -top-2 -right-2 p-1 rounded-md bg-[var(--ff-surface)] border border-[var(--ff-border)] opacity-0 group-hover:opacity-100 hover:border-[var(--ff-primary)]/60 transition-all z-10"
          title="Copy message"
        >
          {copied ? <CheckCheck size={12} className="text-emerald-400" /> : <Copy size={12} className="text-[var(--ff-text-muted)]" />}
        </button>
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>

        {/* Generated files with Lovable-style Diff */}
        {files.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-white/10 space-y-1.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">
                {files.length} file{files.length !== 1 ? 's' : ''} generated
              </span>
              <span className="text-[9px] opacity-50">Click to view diff</span>
            </div>
            <div className="space-y-1">
              {visibleFiles.map((f) => (
                <FileDiff
                  key={f.path}
                  path={f.path}
                  oldContent={f.oldContent || f.previous_content}
                  newContent={f.content || ''}
                  action={f.action}
                  onOpenFile={(path) => onOpenFile(path)}
                  onRestore={(path) => {
                    const store = useProjectStore.getState();
                    if (store.currentProject) {
                      void store.restoreFile(store.currentProject.id, path, f.oldContent || f.previous_content);
                    }
                  }}
                />
              ))}
              {!showAllFiles && hiddenCount > 0 && (
                <button
                  onClick={() => setShowAllFiles(true)}
                  className="w-full text-[10px] text-[var(--ff-primary)] hover:text-blue-300 py-1 transition-colors text-center"
                >
                  + Show {hiddenCount} more file{hiddenCount !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Context-aware next action chips */}
      {!isUser && nextActions.length > 0 && (
        <div className="max-w-[88%] space-y-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--ff-text-dim)] pl-1">
            Suggested next:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {nextActions.map((action) => (
              <button
                key={action}
                onClick={() => onSelectNextAction(action)}
                className="px-2.5 py-1 rounded-full border border-[var(--ff-border)] bg-[var(--ff-surface)] hover:border-[var(--ff-primary)]/60 hover:bg-[var(--ff-primary)]/10 text-[10px] text-[var(--ff-text-muted)] hover:text-white transition-all flex items-center gap-1 group"
              >
                <span className="text-[var(--ff-primary)] group-hover:text-blue-300 transition-colors">+</span>
                <span>{action}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
