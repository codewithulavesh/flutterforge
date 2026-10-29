import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileCode2,
  Layers,
} from 'lucide-react';
import { useProjectStore } from '@/stores/project.store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { TEMPLATES } from '@/utils/constants';
import { detectSupabaseNeed } from '@/utils/backendNeed';
import { toast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';
import type { Template } from '@/types';

export function CreateProjectWizard({
  open,
  onClose,
  initialDescription = '',
}: {
  open: boolean;
  onClose: () => void;
  initialDescription?: string;
}) {
  const navigate = useNavigate();
  const { createProject } = useProjectStore();

  const [prompt, setPrompt] = useState(initialDescription);
  const [name, setName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template>(TEMPLATES[0]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Advanced options (sensible defaults)
  const [flutterVersion, setFlutterVersion] = useState('3.24.0');
  const [stateManagement, setStateManagement] = useState('provider');
  const [themeMode, setThemeMode] = useState('dark');
  const [platform, setPlatform] = useState('web');
  const [backendMode, setBackendMode] = useState<'auto' | 'supabase' | 'local'>('auto');
  const [loading, setLoading] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync initial description from Hero or dashboard
  const prevOpen = useRef(open);
  useEffect(() => {
    if (open && !prevOpen.current) {
      if (initialDescription) {
        setPrompt(initialDescription);
        if (!name) {
          const words = initialDescription.trim().split(/\s+/).slice(0, 3).join(' ');
          setName(words.length > 20 ? 'My Flutter App' : words);
        }
      }
      setTimeout(() => textareaRef.current?.focus(), 60);
    }
    prevOpen.current = open;
  }, [open, initialDescription, name]);

  function reset() {
    setPrompt('');
    setName('');
    setSelectedTemplate(TEMPLATES[0]);
    setShowAdvanced(false);
    setFlutterVersion('3.24.0');
    setStateManagement('provider');
    setThemeMode('dark');
    setPlatform('web');
    setBackendMode('auto');
  }

  function handleSelectTemplate(tpl: Template) {
    setSelectedTemplate(tpl);
    if (!prompt.trim() || TEMPLATES.some((t) => t.defaultPrompt === prompt)) {
      setPrompt(tpl.defaultPrompt || tpl.description);
    }
    if (!name.trim() || TEMPLATES.some((t) => t.suggestedName === name)) {
      setName(tpl.suggestedName || tpl.name);
    }
  }

  async function handleCreate() {
    if (loading) return;
    const finalPrompt = prompt.trim();
    if (!finalPrompt) {
      textareaRef.current?.focus();
      return;
    }

    const finalName = name.trim() || selectedTemplate.suggestedName || 'My Flutter App';
    const usesSupabase = backendMode === 'supabase'
      ? true
      : backendMode === 'local'
        ? false
        : detectSupabaseNeed(`${finalPrompt} ${finalName} ${selectedTemplate.description}`);
    setLoading(true);

    let project;
    try {
      project = await createProject({
        name: finalName,
        description: finalPrompt,
        template: selectedTemplate.id,
        flutter_version: flutterVersion,
        state_management: stateManagement,
        theme_mode: themeMode,
        platform,
      });
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Could not create the project. Check your connection and try again.');
      return;
    } finally {
      setLoading(false);
    }

    if (project) {
      const backendLine = usesSupabase
        ? 'Supabase (auth where useful, database, RLS)'
        : 'None — local only (no auth, no database, no SQL)';
      const backendRequirements = usesSupabase
        ? 'Include Supabase initialization, auth where useful, RLS SQL migrations, complete services and screens.'
        : 'Do NOT use Supabase or any backend. Keep state local (shared_preferences/Hive if persistence is needed). No SQL, no auth screens, no service layer.';

      const richPrompt =
        `Build a production-grade Flutter ${selectedTemplate.name} app called "${finalName}".\n\n` +
        `Project: ${finalName}\n` +
        `Template: ${selectedTemplate.id} - ${selectedTemplate.description}\n` +
        `Description: ${finalPrompt}\n` +
        `Platform: ${platform}\n` +
        `Backend: ${backendLine}\n` +
        `State Management: ${stateManagement}\n` +
        `Theme Mode: ${themeMode}\n` +
        `Flutter Version: ${flutterVersion}\n\n` +
        `Requirements: Generate complete, runnable Flutter code with Material 3, a coherent theme, responsive layouts and every requested feature. ${backendRequirements}`;

      reset();
      onClose();
      toast('success', `Created ${finalName}! Generating app...`);
      navigate(`/project/${project.id}`, {
        state: {
          initialPrompt: finalPrompt,
          richPrompt,
          template: selectedTemplate.id,
          projectName: finalName,
          platform,
          usesSupabase,
          stateManagement,
          themeMode,
        },
      });
    } else {
      toast('error', useProjectStore.getState().error ?? 'Could not create the project. Check your connection and try again.');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleCreate();
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Create Flutter App"
      size="md"
      className="p-4 sm:p-5"
    >
      <div className="ff-fade-in space-y-3">
        {/* Compact App Name */}
        <div>
          <Input
            placeholder="App Name (e.g. ShopFlow, HabitPulse)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-xs sm:text-sm py-1.5"
          />
        </div>

        {/* Prompt Input — Main Focus */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-semibold text-[var(--ff-text-muted)] uppercase tracking-wider">
              What do you want to build?
            </label>
            <span className="text-[10px] text-[var(--ff-text-dim)] hidden xs:inline">
              ⌘ + Enter
            </span>
          </div>

          <textarea
            ref={textareaRef}
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your Flutter app... e.g. E-commerce store with catalog, cart, Stripe checkout, and Supabase auth."
            className="ff-input w-full p-2.5 text-xs sm:text-sm placeholder:text-[var(--ff-text-dim)] leading-relaxed resize-none rounded-lg min-h-[85px]"
          />
        </div>

        {/* Compact Archetype Pills */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-[var(--ff-text-muted)]">
              Archetypes:
            </span>
            {selectedTemplate.id !== 'blank' && (
              <span className="text-[10px] text-[var(--ff-primary)] font-medium">
                {selectedTemplate.name}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1 py-0.5">
            {TEMPLATES.map((tpl) => {
              const Icon =
                (Icons as unknown as Record<string, LucideIcon>)[tpl.icon] ?? FileCode2;
              const isSelected = selectedTemplate.id === tpl.id;

              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleSelectTemplate(tpl)}
                  className={cn(
                    'px-2 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 border',
                    isSelected
                      ? 'border-[var(--ff-primary)] bg-[var(--ff-primary)]/10 text-[var(--ff-primary)]'
                      : 'bg-[var(--ff-surface-2)] text-[var(--ff-text-muted)] hover:text-[var(--ff-text)] border-[var(--ff-border)]'
                  )}
                >
                  <Icon size={12} style={{ color: isSelected ? 'var(--ff-primary)' : tpl.color }} />
                  <span>{tpl.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Compact Collapsible Advanced Settings */}
        <div className="border-t border-[var(--ff-border)] pt-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full text-left text-[11px] font-medium text-[var(--ff-text-dim)] hover:text-[var(--ff-text-muted)] transition-colors py-0.5"
          >
            <span className="flex items-center gap-1.5">
              <Layers size={12} />
              Settings (Provider, Dark, Web)
            </span>
            {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 pt-2 ff-fade-in">
              <div>
                <label className="block text-[10px] text-[var(--ff-text-muted)] mb-0.5">
                  State Management
                </label>
                <select
                  className="ff-input w-full px-2 py-1 text-xs"
                  value={stateManagement}
                  onChange={(e) => setStateManagement(e.target.value)}
                >
                  <option value="provider">Provider</option>
                  <option value="riverpod">Riverpod</option>
                  <option value="bloc">BLoC</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-[var(--ff-text-muted)] mb-0.5">
                  Theme Preset
                </label>
                <select
                  className="ff-input w-full px-2 py-1 text-xs"
                  value={themeMode}
                  onChange={(e) => setThemeMode(e.target.value)}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="system">System</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-[var(--ff-text-muted)] mb-0.5">
                  Backend
                </label>
                <select
                  className="ff-input w-full px-2 py-1 text-xs"
                  value={backendMode}
                  onChange={(e) => setBackendMode(e.target.value as 'auto' | 'supabase' | 'local')}
                >
                  <option value="auto">Auto (only if needed)</option>
                  <option value="supabase">Supabase</option>
                  <option value="local">Local only</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-[var(--ff-text-muted)] mb-0.5">
                  Platform
                </label>
                <select
                  className="ff-input w-full px-2 py-1 text-xs"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                >
                  <option value="web">Web</option>
                  <option value="mobile">Mobile (iOS + Android)</option>
                  <option value="desktop">Desktop (macOS + Windows)</option>
                  <option value="macos">macOS only</option>
                  <option value="windows">Windows only</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-[var(--ff-text-muted)] mb-0.5">
                  Flutter
                </label>
                <select
                  className="ff-input w-full px-2 py-1 text-xs"
                  value={flutterVersion}
                  onChange={(e) => setFlutterVersion(e.target.value)}
                >
                  <option value="3.24.0">3.24.0 (Stable)</option>
                  <option value="3.22.0">3.22.0</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Compact Footer */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--ff-border)]">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            loading={loading}
            disabled={!prompt.trim()}
            onClick={handleCreate}
            icon={<Sparkles size={14} />}
            className="px-4"
          >
            Generate App
          </Button>
        </div>
      </div>
    </Modal>
  );
}
