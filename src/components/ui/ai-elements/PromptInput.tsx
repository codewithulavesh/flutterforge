import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowUp,
  Square,
  Paperclip,
  Sparkles,
  Command,
  FileCode2,
  X,
  ChevronDown,
  Layers,
  Wrench,
} from 'lucide-react';
import { cn } from '@/utils/cn';

export interface PromptInputAttachment {
  id: string;
  name: string;
  type: 'image' | 'file' | 'widget';
  previewUrl?: string;
}

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  isGenerating?: boolean;
  placeholder?: string;
  disabled?: boolean;
  models?: Array<{ id: string; name: string }>;
  selectedModel?: string;
  onSelectModel?: (modelId: string) => void;
  attachments?: PromptInputAttachment[];
  onRemoveAttachment?: (id: string) => void;
  onAddAttachment?: () => void;
  className?: string;
}

export function PromptInput({
  value,
  onChange,
  onSubmit,
  onStop,
  isGenerating = false,
  placeholder = 'Describe your Flutter app or request changes...',
  disabled = false,
  models,
  selectedModel,
  onSelectModel,
  attachments = [],
  onRemoveAttachment,
  onAddAttachment,
  className,
}: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isGenerating && value.trim()) {
        onSubmit();
      }
    }
  };

  const estimatedTokens = Math.ceil(value.length / 4);

  return (
    <div
      className={cn(
        'relative rounded-2xl border border-[var(--ff-border)] bg-[var(--ff-surface-1)] shadow-lg transition-all focus-within:border-[var(--ff-primary)] focus-within:ring-2 focus-within:ring-[var(--ff-primary)]/20',
        disabled && 'opacity-60 cursor-not-allowed',
        className
      )}
    >
      {/* Attachments & Context Pills */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2.5 pb-0">
          {attachments.map((att) => (
            <span
              key={att.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--ff-surface-2)] border border-[var(--ff-border)] text-xs text-[var(--ff-text)]"
            >
              {att.type === 'file' ? (
                <FileCode2 className="w-3 h-3 text-cyan-400" />
              ) : (
                <Sparkles className="w-3 h-3 text-amber-400" />
              )}
              <span className="truncate max-w-[120px]">{att.name}</span>
              {onRemoveAttachment && (
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(att.id)}
                  className="hover:text-rose-400 ml-0.5"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Main Textarea */}
      <div className="p-3">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="w-full resize-none bg-transparent text-sm text-[var(--ff-text)] placeholder-[var(--ff-text-muted)] focus:outline-none max-h-[180px] leading-relaxed"
        />
      </div>

      {/* Footer Controls */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--ff-border)]/60 bg-[var(--ff-surface-1)]/50 rounded-b-2xl">
        <div className="flex items-center gap-2">
          {/* Model Selector */}
          {models && models.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-[var(--ff-surface-2)] text-[var(--ff-text-muted)] hover:text-[var(--ff-text)] border border-[var(--ff-border)] transition-colors"
              >
                <Sparkles className="w-3 h-3 text-[var(--ff-primary)]" />
                <span className="max-w-[100px] truncate">
                  {models.find((m) => m.id === selectedModel)?.name || 'Model'}
                </span>
                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
              </button>

              <AnimatePresence>
                {modelDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute z-50 bottom-full left-0 mb-1.5 w-48 rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface-1)] p-1 shadow-xl text-xs"
                  >
                    {models.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          onSelectModel?.(m.id);
                          setModelDropdownOpen(false);
                        }}
                        className={cn(
                          'w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors',
                          selectedModel === m.id
                            ? 'bg-[var(--ff-primary)] text-[var(--ff-primary-foreground)]'
                            : 'hover:bg-[var(--ff-surface-2)] text-[var(--ff-text)]'
                        )}
                      >
                        <span className="truncate">{m.name}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {onAddAttachment && (
            <button
              type="button"
              onClick={onAddAttachment}
              className="p-1.5 rounded-lg text-[var(--ff-text-muted)] hover:text-[var(--ff-text)] hover:bg-[var(--ff-surface-2)] transition-colors"
              title="Attach context or file"
            >
              <Paperclip className="w-3.5 h-3.5" />
            </button>
          )}

          {value.length > 0 && (
            <span className="text-[10px] text-[var(--ff-text-muted)] font-mono">
              ~{estimatedTokens} tokens
            </span>
          )}
        </div>

        {/* Action Button: Submit / Stop */}
        <div className="flex items-center gap-2">
          {isGenerating ? (
            <button
              type="button"
              onClick={onStop}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-medium transition-all"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={disabled || !value.trim()}
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-xl transition-all',
                value.trim() && !disabled
                  ? 'bg-[var(--ff-primary)] text-[var(--ff-primary-foreground)] shadow-md hover:scale-105 active:scale-95'
                  : 'bg-[var(--ff-surface-2)] text-[var(--ff-text-muted)] cursor-not-allowed'
              )}
              title="Send (Enter)"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
