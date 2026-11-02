import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertCircle,
  ChevronDown,
  Copy,
  FileCode2,
  FolderOpen,
  MessageSquare,
  Plus,
  RotateCcw,
  Wrench,
  X,
} from 'lucide-react';
import { useProjectStore, type SendMessageOptions } from '@/stores/project.store';
import { usePreviewStore } from '@/stores/preview.store';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { useTerminalStore } from '@/stores/terminal.store';
import { useActivityStore } from '@/stores/activity.store';
import { classifyChatIntent } from '@/agent/chatIntent';
import { HarnessClient } from '@/agent/harnessClient';
import { ChatContextHandler } from '@/agent/chatContext';
import { toast } from '@/components/ui/Toast';
import { BrandLogo } from '@/components/BrandLogo';
import { RunActivity } from '@/features/workspace/RunActivity';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
  MessageToolbar,
} from '@/components/ai-elements/message';
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/ai-elements/reasoning';
import { Suggestion } from '@/components/ai-elements/suggestion';
import {
  PromptInput,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input';
import {
  Confirmation,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRequest,
  ConfirmationTitle,
} from '@/components/ai-elements/confirmation';
import { Sources, SourcesContent, SourcesTrigger } from '@/components/ai-elements/sources';
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationSource,
  InlineCitationText,
} from '@/components/ai-elements/inline-citation';
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

function buildStatusMessage(status: string): string {
  if (status === 'queued' || status === 'building') return 'Preview build started';
  if (status === 'running') return 'Preview is live';
  if (status === 'failed') return 'Preview build failed';
  if (status === 'stopped') return 'Preview build stopped';
  return 'Preview status changed';
}

function ChangedFiles({ files, onOpen }: { files: FileChange[]; onOpen: (path: string) => void }) {
  const unique = files.filter((file, index, list) => (
    list.findIndex((item) => item.path === file.path) === index
  ));
  if (unique.length === 0) return null;

  return (
    <Sources>
      <SourcesTrigger count={unique.length}>
        <InlineCitation>
          <InlineCitationText>Used {unique.length} project sources</InlineCitationText>
        </InlineCitation>
        <ChevronDown className="size-4" />
      </SourcesTrigger>
      <SourcesContent>
        {unique.map((file) => (
          <InlineCitation key={file.path}>
            <InlineCitationCard>
              <InlineCitationCardTrigger
                onClick={() => file.action !== 'deleted' && onOpen(file.path)}
                sources={[file.path]}
                title={file.path}
              />
              <InlineCitationCardBody>
                <div className="space-y-2 p-3">
                  <InlineCitationSource
                    description={`${file.action} by FlutterForge`}
                    title={file.path}
                  />
                  {file.action !== 'deleted' && (
                    <button
                      className="text-xs font-medium text-primary hover:underline"
                      onClick={() => onOpen(file.path)}
                      type="button"
                    >
                      Open file
                    </button>
                  )}
                </div>
              </InlineCitationCardBody>
            </InlineCitationCard>
          </InlineCitation>
        ))}
      </SourcesContent>
    </Sources>
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

  return (
    <Message className={cn(page ? 'max-w-full' : 'max-w-[94%]')} from={message.role}>
      {!isUser && (
        <div className="flex items-center gap-2 px-0.5 text-[11px]">
          <span className="grid size-6 place-items-center rounded-lg border border-[var(--ff-border)] bg-[var(--ff-surface-2)]">
            <MessageSquare className="size-3.5 text-[var(--ff-primary)]" />
          </span>
          <span className="font-semibold text-foreground">FlutterForge</span>
          <span className="text-muted-foreground">{timeLabel(message.created_at)}</span>
        </div>
      )}
      <MessageContent className={cn(
        page && !isUser && 'w-full',
        isUser && 'rounded-2xl border border-[var(--ff-border)] bg-[var(--ff-surface-2)] px-4 py-3 shadow-sm',
      )}>
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        ) : (
          <MessageResponse>{message.content}</MessageResponse>
        )}
        {!isUser && changedFiles.length > 0 && <ChangedFiles files={changedFiles} onOpen={onOpen} />}
      </MessageContent>
      {!isUser && (
        <MessageToolbar className="mt-1">
          <MessageActions>
            <MessageAction
              label="Copy response"
              onClick={() => void copyText(message.content)}
              tooltip="Copy"
            >
              <Copy className="size-3.5" />
            </MessageAction>
            {canRetry && (
              <MessageAction label="Retry" onClick={onRetry} tooltip="Retry">
                <RotateCcw className="size-3.5" />
              </MessageAction>
            )}
          </MessageActions>
        </MessageToolbar>
      )}
    </Message>
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
    isGenerating,
    isAnswering,
    generationError,
    setGenerating,
    setAnswering,
    setCurrentPhase,
    setGenerationError,
    addLine,
    addLiveFile,
    clearLiveFiles,
  } = useTerminalStore();
  const activity = useActivityStore();

  const page = variant === 'page';
  const [input, setInput] = useState('');
  const [streamingReply, setStreamingReply] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const [isEngineConnected, setIsEngineConnected] = useState<boolean | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [dismissedRepair, setDismissedRepair] = useState<string | null>(null);
  const [modelPreference, setModelPreference] = useState<'fast' | 'quality'>(() => {
    try {
      return localStorage.getItem('ff-model-preference') === 'quality' ? 'quality' : 'fast';
    } catch {
      return 'fast';
    }
  });

  const busy = isGenerating || isAnswering || generatingIn === currentProject?.id;

  const composerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const autoStarted = useRef(false);
  const autoTimer = useRef<number | null>(null);
  const buildCursor = useRef<{ sessionId: string | null; logs: number; status: string | null }>({
    sessionId: null,
    logs: 0,
    status: null,
  });
  const location = useLocation();
  const navState = location.state as { initialPrompt?: string; richPrompt?: string } | null;

  const hasMessages = messages.length > 0;
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';
  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
  const userMessageCount = messages.filter((message) => message.role === 'user').length;
  const lastAssistantIndex = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index--) {
      if (messages[index].role === 'assistant') return index;
    }
    return -1;
  }, [messages]);
  const showActivity = Boolean(activity.run) || activity.events.length > 0;
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
    if (currentProject?.id) useActivityStore.getState().load(currentProject.id);
  }, [currentProject?.id]);

  useEffect(() => {
    if (!busy) {
      startedAtRef.current = null;
      setElapsed(0);
      return;
    }
    if (startedAtRef.current === null) startedAtRef.current = Date.now();
    const timer = window.setInterval(() => {
      if (startedAtRef.current !== null) {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [busy]);

  const buildSession = currentProject ? preview.getSession(currentProject.id) : null;

  useEffect(() => {
    if (!buildSession) return;
    const store = useActivityStore.getState();
    if (buildCursor.current.sessionId !== buildSession.sessionId) {
      buildCursor.current = { sessionId: buildSession.sessionId, logs: 0, status: null };
    }
    const cursor = buildCursor.current;
    for (let index = cursor.logs; index < buildSession.logs.length; index++) {
      store.ingestBuildLog(buildSession.logs[index]);
    }
    cursor.logs = buildSession.logs.length;
    if (cursor.status !== buildSession.status) {
      cursor.status = buildSession.status;
      const errors = buildSession.logs.filter((line) => (
        /error|exception|failed to|because|not found|invalid|undefined/i.test(line)
      ));
      store.ingestBuildStatus(buildSession.status, buildStatusMessage(buildSession.status), errors);
    }
  }, [buildSession?.sessionId, buildSession?.status, buildSession?.logs]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const focusComposer = () => {
    composerRef.current?.querySelector('textarea')?.focus();
  };

  function handleNewChat() {
    if (!currentProject) return;
    autoStarted.current = true;
    void newConversation(currentProject.id).then(() => {
      useActivityStore.getState().clear();
      setGenerationError(null);
      setInput('');
      setStreamingReply('');
      focusComposer();
    }).catch((error) => {
      toast('error', error instanceof Error ? error.message : 'Could not start a new chat.');
    });
  }

  function handleStop() {
    if (!abortRef.current && generatingIn === currentProject?.id) {
      stopRepair();
      addLine({ type: 'error', content: '⏹ Repair stopped by user' });
      const store = useActivityStore.getState();
      if (store.run?.status === 'running') store.end('stopped', 'Repair stopped by user');
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
    const store = useActivityStore.getState();
    if (store.run?.status === 'running') store.end('stopped', 'Generation stopped by user');
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
    clearLiveFiles();

    const isNewApp = opts?.isInitialGeneration === true || messages.length === 0;
    const intent = opts?.isInitialGeneration || opts?.isRepair ? 'build' : classifyChatIntent(text);
    let runId: string | null = null;
    let ended = false;

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
          onRetry: (message) => {
            setStreamingReply('');
            setCurrentPhase(message);
          },
        });
        if (result.mode === 'duplicate') {
          setGenerationError('A response is already in progress for this chat.');
          return;
        }
        setStreamingReply('');
        addLine({ type: 'success', content: '✓ Answered — project files untouched' });
        return;
      }

      const store = useActivityStore.getState();
      store.begin(currentProject.id, text, isNewApp, modelLabel);
      runId = useActivityStore.getState().run?.id ?? null;

      setGenerating(true);
      setCurrentPhase(isNewApp ? 'Starting the harness engine…' : 'Applying your changes…');
      addLine({ type: 'output', content: `▶ ${text.slice(0, 140)}` });

      const result = await sendMessage(
        currentProject.id,
        text,
        (message) => {
          setCurrentPhase(message);
          useActivityStore.getState().ingestProgress(message);
        },
        {
          ...opts,
          modelPreference: opts?.modelPreference ?? modelPreference,
          attachedFiles: attachments,
          signal,
          onEvent: (event) => {
            useActivityStore.getState().ingestAgent(event);
            if (event.generatedFiles) {
              for (const file of event.generatedFiles) {
                if (file.path) addLiveFile(file.path);
              }
            }
            if (event.message) {
              setCurrentPhase(event.message);
              addLine({ type: 'output', content: event.message });
              if (event.message.startsWith('✓ ')) {
                const file = event.message.replace(/^✓\s*/, '').trim();
                if (file) addLiveFile(file);
              }
            }
          },
          onFile: (file) => {
            useActivityStore.getState().ingestFile(file);
            addLiveFile(file.path);
          },
        },
      );

      if (result.mode === 'duplicate') {
        setGenerationError('A generation is already running for this chat.');
        useActivityStore.getState().end('error', 'Generation already running');
        ended = true;
        return;
      }
      if (result.mode === 'chat') return;

      const count = result.fileCount ?? result.files?.length ?? 0;
      if (count === 0) {
        setGenerationError('The engine returned no files. Your project was not changed — please retry.');
        useActivityStore.getState().end('error', 'The engine returned no files');
        ended = true;
        return;
      }

      toast('success', isNewApp ? `App generated (${count} files)` : `Updated ${count} files`);
      useActivityStore.getState().end('success', isNewApp ? `Generated ${count} files` : `Updated ${count} files`);
      ended = true;
    } catch (error) {
      if (signal.aborted) {
        setGenerationError('Generation stopped.');
        useActivityStore.getState().end('stopped', 'Generation stopped by user');
        ended = true;
        return;
      }
      const message = error instanceof Error ? error.message : 'Generation failed.';
      setGenerationError(message);
      addLine({ type: 'error', content: `✗ ${message}` });
      useActivityStore.getState().end('error', message);
      ended = true;
    } finally {
      sendingRef.current = false;
      abortRef.current = null;
      setGenerating(false);
      setAnswering(false);
      setCurrentPhase(null);
      if (runId && !ended) {
        const store = useActivityStore.getState();
        if (store.run?.id === runId && store.run.status === 'running') {
          store.end(signal.aborted ? 'stopped' : 'success');
        }
      }
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      void handleSend();
    }
  }

  // Wizard hand-off: fire the first prompt once per project/conversation.
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
    const focus = () => focusComposer();
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
    const newChat = () => handleNewChat();
    const prefill = (event: Event) => {
      const text = (event as CustomEvent<{ text?: string }>).detail?.text;
      if (!text) return;
      setInput((previous) => (previous.trim() ? previous : text));
      window.requestAnimationFrame(focusComposer);
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

  const projectFiles = files.filter((file) => !file.is_directory);

  const panelHeader = (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--ff-border)] bg-[var(--ff-bg)] px-3 py-2.5 sm:px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface-2)] text-[var(--ff-primary)] shadow-sm">
          <MessageSquare className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold tracking-tight text-foreground">
            {currentProject?.name || 'FlutterForge'}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className={cn(
              'size-1.5 rounded-full',
              busy ? 'animate-pulse bg-amber-400' : isEngineConnected ? 'bg-emerald-500' : isEngineConnected === false ? 'bg-muted-foreground/50' : 'animate-pulse bg-amber-400',
            )} />
            <span className="truncate">
              {busy ? `Working · ${elapsed}s` : isEngineConnected ? 'Local engine ready' : isEngineConnected === false ? 'Fallback mode' : 'Connecting to engine'}
            </span>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <label className="sr-only" htmlFor="ff-model-preference">Generation model</label>
        <select
          aria-label="Generation model"
          className="h-7 max-w-[88px] rounded-lg border border-[var(--ff-border)] bg-[var(--ff-surface)] px-2 text-[10px] font-medium text-foreground outline-none transition-colors hover:border-[var(--ff-border-hover)] focus-visible:ring-2 focus-visible:ring-[var(--ff-primary)]/30 sm:max-w-[104px]"
          id="ff-model-preference"
          onChange={(event) => setModelPreference(event.target.value === 'quality' ? 'quality' : 'fast')}
          title="Choose a faster response or a more capable model"
          value={modelPreference}
        >
          <option value="fast">Fast</option>
          <option value="quality">Quality</option>
        </select>
        <button
          aria-label="New chat"
          className="grid size-7 place-items-center rounded-lg border border-transparent text-muted-foreground transition-colors hover:border-[var(--ff-border)] hover:bg-[var(--ff-surface-2)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ff-primary)]/40"
          onClick={handleNewChat}
          title="Start a new chat"
          type="button"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </header>
  );

  const composer = (
    <div className="w-full" ref={composerRef}>
      <PromptInput
        className={cn(
          '[&_[data-slot=input-group]]:border-[var(--ff-border)] [&_[data-slot=input-group]]:bg-[var(--ff-surface)] [&_[data-slot=input-group]]:shadow-sm [&_[data-slot=input-group]]:focus-within:border-[var(--ff-primary)] [&_[data-slot=input-group]]:focus-within:ring-2 [&_[data-slot=input-group]]:focus-within:ring-[var(--ff-primary)]/20',
          page && 'text-[15px]',
        )}
        onSubmit={({ text }) => {
          void handleSend(text);
        }}
      >
        <PromptInputBody>
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pt-2">
              {attachedFiles.map((path) => (
                <span
                  className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-xs text-foreground"
                  key={path}
                >
                  <FileCode2 className="size-3 text-muted-foreground" />
                  {path.split('/').pop()}
                  <button
                    aria-label={`Remove ${path}`}
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setAttachedFiles((current) => current.filter((item) => item !== path))}
                    type="button"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <PromptInputTextarea
            className={cn('min-h-[64px] resize-none text-[13px] leading-relaxed placeholder:text-muted-foreground/70', page && 'text-[15px]')}
            disabled={busy}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={busy
              ? 'Working…'
              : page
                ? 'Ask about the project, or describe what to build next…'
                : 'Describe a change or ask a question…'}
            value={input}
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger tooltip="Attach a project file" />
              <PromptInputActionMenuContent className="max-h-64 overflow-y-auto">
                {projectFiles.slice(0, 40).map((file) => (
                  <PromptInputActionMenuItem
                    key={file.path}
                    onSelect={() => setAttachedFiles((current) => (
                      current.includes(file.path) ? current : [...current, file.path].slice(0, 4)
                    ))}
                  >
                    <FileCode2 className="mr-2 size-3.5" />
                    <span className="truncate font-mono text-[11px]">{file.path}</span>
                  </PromptInputActionMenuItem>
                ))}
                {projectFiles.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No project files yet.</div>
                )}
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
          </PromptInputTools>
          <div className="flex items-center gap-1.5">
            {currentProject && files.some((file) => file.path === 'pubspec.yaml') && (
              <PromptInputButton
                className="hidden sm:inline-flex"
                onClick={() => openFile('pubspec.yaml')}
                tooltip="Open pubspec.yaml"
              >
                <FolderOpen className="size-3.5" />
              </PromptInputButton>
            )}
            <PromptInputSubmit
              disabled={!busy && (!input.trim() || !currentProject)}
              onStop={handleStop}
              status={busy ? 'streaming' : undefined}
            />
          </div>
        </PromptInputFooter>
      </PromptInput>
      <div className="mt-1.5 flex items-center justify-between gap-2 px-0.5">
        <span className="hidden text-[9px] text-muted-foreground sm:block">
          {busy ? 'Stop cancels the run — files are kept' : '⌘↵ to send · project context included'}
        </span>
        <div className="ml-auto flex items-center gap-2.5">
          <div
            className="flex items-center gap-1.5"
            title={`Estimated context: ~${contextInfo.tokenEstimate.toLocaleString()} of ${tokenBudget.toLocaleString()} tokens`}
          >
            <span className="font-mono text-[8px] uppercase tracking-wide text-muted-foreground">ctx</span>
            <div className="h-1 w-12 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn('h-full rounded-full transition-all', tokenPct >= 90 ? 'bg-red-400' : tokenPct >= 70 ? 'bg-amber-400' : 'bg-primary')}
                style={{ width: `${tokenPct}%` }}
              />
            </div>
            <span className="font-mono text-[9px] tabular-nums text-muted-foreground">{tokenLabel}/{Math.round(tokenBudget / 1000)}k</span>
          </div>
        </div>
      </div>
    </div>
  );

  const body = (
    <Conversation className="flex-1">
      <ConversationContent
        className={cn(
          'mx-auto w-full',
          page ? 'max-w-[860px] gap-6 px-5 py-6 sm:px-10' : 'max-w-2xl gap-4 px-3 py-4',
        )}
      >
        {!hasMessages && !busy && (
          <ConversationEmptyState className={cn(page ? 'min-h-[48vh]' : 'min-h-[320px]')}>
            <div className="flex w-full max-w-xl flex-col items-center">
              <div className={cn('mb-4 grid place-items-center rounded-2xl border border-[var(--ff-border)] bg-[var(--ff-surface)] shadow-sm', page ? 'size-14' : 'size-11')}>
                <BrandLogo size={page ? 34 : 28} />
              </div>
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--ff-primary)]">
                FlutterForge coding assistant
              </p>
              <h2 className={cn('font-semibold tracking-tight text-foreground', page ? 'text-xl sm:text-2xl' : 'text-base')}>
                Build with your project context.
              </h2>
              <p className={cn('mt-2 text-pretty leading-relaxed text-muted-foreground', page ? 'max-w-xl text-sm' : 'max-w-sm text-[11px]')}>
                Ask a question, request a code change, or build a Flutter feature. The agent works in your files and can validate the live preview.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <Suggestion
                    key={suggestion.label}
                    onClick={(prompt) => {
                      setInput(prompt);
                      focusComposer();
                    }}
                    suggestion={suggestion.prompt}
                  >
                    {suggestion.label}
                  </Suggestion>
                ))}
              </div>
            </div>
          </ConversationEmptyState>
        )}

        {messages.map((message, index) => {
          const isLastAssistant = lastAssistant?.id === message.id && index === messages.length - 1;
          return (
            <Fragment key={message.id}>
              {index === lastAssistantIndex && showActivity && (
                <RunActivity onOpen={openFile} page={page} />
              )}
              <MessageBubble
                canRetry={isLastAssistant && Boolean(lastUserMessage) && !busy}
                message={message}
                onOpen={openFile}
                onRetry={() => void handleSend(lastUserMessage, {
                  isInitialGeneration: userMessageCount <= 1 && classifyChatIntent(lastUserMessage) === 'build',
                })}
                page={page}
              />
            </Fragment>
          );
        })}

        {showActivity && lastAssistantIndex === -1 && (
          <RunActivity onOpen={openFile} page={page} />
        )}

        {isAnswering && (
          <Message className={page ? 'max-w-full' : undefined} from="assistant">
            <MessageContent className={cn(page && 'w-full')}>
              {streamingReply ? (
                <MessageResponse>{streamingReply}</MessageResponse>
              ) : (
                <Reasoning defaultOpen isStreaming>
                  <ReasoningTrigger />
                  <ReasoningContent>Preparing a reply…</ReasoningContent>
                </Reasoning>
              )}
            </MessageContent>
          </Message>
        )}

        {generationError && !busy && (
          <div className="rounded-xl border border-red-500/25 bg-red-500/5 px-3.5 py-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-red-400" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-red-500">Request failed</p>
                <p className="mt-0.5 break-words text-[11px] text-red-500/80">{generationError}</p>
                {lastUserMessage && (
                  <button
                    className="mt-2 rounded-md bg-red-500/15 px-2.5 py-1 text-[10px] font-medium text-red-500 hover:bg-red-500/25"
                    onClick={() => void handleSend(lastUserMessage, {
                      isInitialGeneration: userMessageCount <= 1 && classifyChatIntent(lastUserMessage) === 'build',
                    })}
                    type="button"
                  >
                    Retry
                  </button>
                )}
              </div>
              <button
                aria-label="Dismiss error"
                className="p-0.5 text-red-400/60 hover:text-red-400"
                onClick={() => setGenerationError(null)}
                type="button"
              >
                <X className="size-3" />
              </button>
            </div>
          </div>
        )}

        {showRepair && currentProject && buildSession && (
          <Confirmation
            approval={{ id: buildSession.sessionId }}
            className="border-amber-500/30 bg-amber-500/5"
            state="approval-requested"
          >
            <ConfirmationTitle className="flex items-center gap-2 text-amber-600">
              <Wrench className="size-3.5" /> Preview build failed
            </ConfirmationTitle>
            <ConfirmationRequest>
              <div className="space-y-2">
                <p className="text-xs text-amber-600/80">
                  The preview build failed. Let the agent read the compiler errors and repair the project?
                </p>
                {repairHint.length > 0 && (
                  <pre className="max-h-24 overflow-auto rounded-md bg-amber-500/10 p-2 font-mono text-[10px] text-amber-700 dark:text-amber-400">
                    {repairHint.join('\n')}
                  </pre>
                )}
              </div>
            </ConfirmationRequest>
            <ConfirmationActions>
              <ConfirmationAction onClick={() => void repairBuild(currentProject.id)}>
                Fix automatically
              </ConfirmationAction>
              <ConfirmationAction
                onClick={() => setDismissedRepair(buildSession.sessionId)}
                variant="outline"
              >
                Dismiss
              </ConfirmationAction>
            </ConfirmationActions>
          </Confirmation>
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );

  if (page) {
    return (
      <div className="flex h-full flex-col bg-background">
        {panelHeader}
        {body}
        <div className="shrink-0 border-t border-[var(--ff-border)] bg-[var(--ff-bg)]/95 px-5 pb-4 pt-3 backdrop-blur sm:px-10">
          <div className="mx-auto w-full max-w-[860px]">{composer}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {panelHeader}
      {body}
      <div className="shrink-0 border-t border-border bg-card/40 px-3 py-2.5">
        <div className="mx-auto w-full max-w-2xl">{composer}</div>
      </div>
    </div>
  );
}
