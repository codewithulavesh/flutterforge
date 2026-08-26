import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, Sparkles, Check, Loader2, FileCode2, Package, Bug, Hammer, Eye, Brain, Wrench, AlertCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useProjectStore } from '@/stores/project.store';
import { useTerminalStore } from '@/stores/terminal.store';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import type { AIMessage, GenerationStep } from '@/types';

const SUGGESTIONS = [
  'Add a dark mode toggle to the app',
  'Create a login screen with email and password fields',
  'Add a bottom navigation bar with 4 tabs',
  'Create a product list with cards and images',
  'Add a search bar to the home screen',
  'Create a settings page with theme options',
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
  const { messages, sendMessage, currentProject, conversation } = useProjectStore();
  const { setGenerating, setGenerationSteps, updateStep, addLine } = useTerminalStore();
  const [input, setInput] = useState('');
  const [generating, setLocalGenerating] = useState(false);
  const [steps, setLocalSteps] = useState<GenerationStep[]>([]);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const location = useLocation();
  const autoStarted = useRef(false);
  const initialPrompt = (location.state as { initialPrompt?: string } | null)?.initialPrompt;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, steps]);

  useEffect(() => {
    if (currentProject && conversation && initialPrompt?.trim() && !autoStarted.current && messages.length === 0) {
      autoStarted.current = true;
      void handleSend(initialPrompt);
    }
  }, [currentProject?.id, initialPrompt, messages.length]);

  async function handleSend(prompt?: string) {
    const text = prompt ?? input;
    if (!text.trim() || generating || !currentProject) return;

    setInput('');
    setGenerationError(null);
    setLocalGenerating(true);
    setGenerating(true);

    const stepDefs: GenerationStep[] = [
      { id: 'understanding', label: 'Preparing your request', status: 'pending' },
      { id: 'planning', label: 'Planning project files', status: 'pending' },
      { id: 'generating', label: 'Generating fresh Flutter code', status: 'pending' },
      { id: 'installing', label: 'Saving generated files', status: 'pending' },
      { id: 'preview', label: 'Ready to preview', status: 'pending' },
    ];
    setLocalSteps(stepDefs);
    setGenerationSteps(stepDefs);

    const completeStep = (step: GenerationStep) => {
      setLocalSteps((prev) => prev.map((item) => item.id === step.id ? { ...item, status: 'completed' } : item));
      updateStep(step.id, { status: 'completed' });
    };

    for (const step of stepDefs.slice(0, 2)) {
      setLocalSteps((prev) => prev.map((item) => item.id === step.id ? { ...item, status: 'running' } : item));
      updateStep(step.id, { status: 'running' });
      addLine({ type: 'output', content: `[${step.label}...]` });
      completeStep(step);
    }

    const generationStep = stepDefs[2];
    setLocalSteps((prev) => prev.map((item) => item.id === generationStep.id ? { ...item, status: 'running' } : item));
    updateStep(generationStep.id, { status: 'running' });
    addLine({ type: 'output', content: `[${generationStep.label}...]` });

    try {
      await sendMessage(currentProject.id, text, (message) => {
        addLine({ type: 'output', content: `[AI] ${message}` });
      });
      completeStep(generationStep);
      completeStep(stepDefs[3]);
      completeStep(stepDefs[4]);
      addLine({ type: 'output', content: '[Generation complete]' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI generation failed.';
      setGenerationError(message);
      addLine({ type: 'error', content: message });
    } finally {
      setLocalGenerating(false);
      setGenerating(false);
      setLocalSteps([]);
    }
  }

  return (
    <div className="flex flex-col h-full bg-[var(--ff-surface)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--ff-border)] shrink-0">
        <Sparkles size={16} className="text-[var(--ff-primary)]" />
        <span className="text-sm font-semibold text-white">AI Builder</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto ff-scrollbar px-4 py-4 space-y-4">
        {messages.length === 0 && !generating && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-14 h-14 rounded-2xl bg-[var(--ff-primary)]/10 flex items-center justify-center mb-4">
              <Sparkles size={28} className="text-[var(--ff-primary)]" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Describe your Flutter app</h3>
            <p className="text-xs text-[var(--ff-text-muted)] mb-6 max-w-xs">
              Tell the AI what you want to build. It will generate screens, routing, theme, and dependencies.
            </p>
            <div className="space-y-2 w-full max-w-sm">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="w-full text-left px-3 py-2 rounded-lg ff-card hover:border-[var(--ff-border-hover)] transition-all text-xs text-[var(--ff-text-muted)] hover:text-white"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Generation steps */}
        {generating && steps.length > 0 && (
          <div className="ff-card p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-[var(--ff-text-dim)] mb-2">
              <Sparkles size={12} className="text-[var(--ff-primary)]" />
              AI Agent Activity
            </div>
            {steps.map((step) => {
              const Icon = STEP_ICONS[step.id] ?? FileCode2;
              return (
                <div key={step.id} className="flex items-center gap-2 text-xs">
                  {step.status === 'completed' ? (
                    <span className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                      <Check size={10} className="text-emerald-400" />
                    </span>
                  ) : step.status === 'running' ? (
                    <Loader2 size={14} className="text-[var(--ff-primary)] ff-spin shrink-0" />
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-[var(--ff-border)] shrink-0" />
                  )}
                  <span className={cn(
                    step.status === 'pending' ? 'text-[var(--ff-text-dim)]' :
                    step.status === 'completed' ? 'text-[var(--ff-text-muted)]' :
                    'text-[var(--ff-text)]'
                  )}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {generationError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{generationError}</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-[var(--ff-border)] p-3 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Describe what you want to build..."
            disabled={generating}
            rows={2}
            className="ff-input flex-1 px-3 py-2 text-sm resize-none placeholder:text-[var(--ff-text-dim)] disabled:opacity-50"
          />
          <Button
            size="sm"
            disabled={!input.trim() || generating}
            loading={generating}
            onClick={() => handleSend()}
            icon={!generating ? <Send size={14} /> : undefined}
            className="self-end"
          >
            Send
          </Button>
        </div>
        <p className="text-[10px] text-[var(--ff-text-dim)] mt-1.5">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: AIMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'max-w-[85%] rounded-lg px-3 py-2 text-sm',
        isUser
          ? 'bg-[var(--ff-primary)] text-white'
          : 'ff-card text-[var(--ff-text)]'
      )}>
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        {message.changed_files && message.changed_files.length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/10 space-y-0.5">
            <p className="text-[10px] opacity-70 mb-1">Files changed:</p>
            {message.changed_files.map((f) => (
              <div key={f.path} className="flex items-center gap-1.5 text-[11px] opacity-80">
                <span className={cn(
                  'w-3 text-center font-mono',
                  f.action === 'created' ? 'text-emerald-300' :
                  f.action === 'modified' ? 'text-amber-300' :
                  'text-red-300'
                )}>
                  {f.action === 'created' ? 'A' : f.action === 'modified' ? 'M' : 'D'}
                </span>
                <span className="font-mono">{f.path}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
