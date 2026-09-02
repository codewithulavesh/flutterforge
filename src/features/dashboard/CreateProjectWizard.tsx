import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useProjectStore } from '@/stores/project.store';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { TEMPLATES } from '@/utils/constants';
import { toast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';
import type { Template } from '@/types';

export function CreateProjectWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { createProject } = useProjectStore();
  const [step, setStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [flutterVersion, setFlutterVersion] = useState('3.24.0');
  const [stateManagement, setStateManagement] = useState('provider');
  const [themeMode, setThemeMode] = useState('light');
  const [platform, setPlatform] = useState('web');
  const [loading, setLoading] = useState(false);

  function reset() {
    setStep(0);
    setSelectedTemplate(null);
    setName('');
    setDescription('');
    setFlutterVersion('3.24.0');
    setStateManagement('provider');
    setThemeMode('light');
    setPlatform('web');
  }

  async function handleCreate() {
    if (!selectedTemplate || !name.trim()) return;
    setLoading(true);
    const project = await createProject({
      name: name.trim(),
      description: description.trim(),
      template: selectedTemplate.id,
      flutter_version: flutterVersion,
      state_management: stateManagement,
      theme_mode: themeMode,
      platform,
    });
    setLoading(false);
    if (project) {
      // Build rich agent prompt from wizard Describe + Configure + Template
      const richPrompt = `Build a production-grade Flutter ${selectedTemplate.name} app called "${name.trim()}" with Supabase backend.\n\n` +
        `Project: ${name.trim()}\n` +
        `Template: ${selectedTemplate.id} - ${selectedTemplate.description}\n` +
        `Description: ${description.trim()}\n` +
        `Platform: ${platform}\n` +
        `State Management: ${stateManagement}\n` +
        `Theme Mode: ${themeMode}\n` +
        `Flutter Version: ${flutterVersion}\n\n` +
        `Requirements: Generate complete Flutter code (lib/main.dart with Supabase.initialize, pubspec.yaml, Material 3 theme, GoRouter, models, services with RLS, screens) + supabase/migrations SQL with Row Level Security. Make it runnable and validated.`;
      const promptToSend = description.trim();
      reset();
      onClose();
      toast('success', 'Project created! Generating app from your description...');
      navigate(`/project/${project.id}`, {
        state: {
          initialPrompt: promptToSend,
          richPrompt,
          template: selectedTemplate.id,
          projectName: name.trim(),
          platform,
          stateManagement,
          themeMode,
        },
      });
    }
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Create New Flutter App" size="xl">
      {/* Step indicator */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {['Template', 'Describe', 'Configure'].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors',
              i <= step ? 'bg-[var(--ff-primary)] text-white' : 'bg-[var(--ff-surface-2)] text-[var(--ff-text-dim)]'
            )}>
              {i + 1}
            </div>
            <span className={cn('text-xs', i <= step ? 'text-[var(--ff-text)]' : 'text-[var(--ff-text-dim)]')}>{label}</span>
            {i < 2 && <div className="w-8 h-px bg-[var(--ff-border)]" />}
          </div>
        ))}
      </div>

      {/* Step 0: Template */}
      {step === 0 && (
        <div className="ff-fade-in">
          <p className="text-sm text-[var(--ff-text-muted)] mb-4">Choose a template to start from:</p>
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {TEMPLATES.map((template) => {
              const Icon = (Icons as unknown as Record<string, LucideIcon>)[template.icon] ?? Icons.FileCode2;
              const isSelected = selectedTemplate?.id === template.id;
              return (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  className={cn(
                    'ff-card p-4 text-left transition-all hover:border-[var(--ff-border-hover)]',
                    isSelected && 'border-[var(--ff-primary)] ring-1 ring-[var(--ff-primary)]'
                  )}
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: `${template.color}15` }}>
                    <Icon size={20} style={{ color: template.color }} />
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-1">{template.name}</h4>
                  <p className="text-xs text-[var(--ff-text-muted)] leading-relaxed">{template.description}</p>
                </button>
              );
            })}
          </div>
          <div className="flex justify-end mt-6">
            <Button disabled={!selectedTemplate} onClick={() => setStep(1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Step 1: Describe */}
      {step === 1 && (
        <div className="ff-fade-in space-y-4">
          <div>
            <Input
              label="Project Name"
              placeholder="My Flutter App"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--ff-text-muted)] mb-1.5">
              What do you want to build?
            </label>
            <textarea
              className="ff-input w-full px-3 py-2.5 text-sm placeholder:text-[var(--ff-text-dim)] min-h-[120px] resize-none"
              placeholder="Create a modern food delivery application with login, restaurant listing, food details, cart, checkout and profile."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(0)}>Back</Button>
            <Button disabled={!name.trim() || !description.trim()} onClick={() => setStep(2)}>Next</Button>
          </div>
        </div>
      )}

      {/* Step 2: Configure */}
      {step === 2 && (
        <div className="ff-fade-in space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--ff-text-muted)] mb-1.5">Flutter Version</label>
              <select className="ff-input w-full px-3 py-2.5 text-sm" value={flutterVersion} onChange={(e) => setFlutterVersion(e.target.value)}>
                <option value="3.24.0">3.24.0 (Stable)</option>
                <option value="3.22.0">3.22.0</option>
                <option value="3.19.0">3.19.0</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--ff-text-muted)] mb-1.5">State Management</label>
              <select className="ff-input w-full px-3 py-2.5 text-sm" value={stateManagement} onChange={(e) => setStateManagement(e.target.value)}>
                <option value="provider">Provider</option>
                <option value="riverpod">Riverpod</option>
                <option value="bloc">Bloc</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--ff-text-muted)] mb-1.5">Theme Mode</label>
              <select className="ff-input w-full px-3 py-2.5 text-sm" value={themeMode} onChange={(e) => setThemeMode(e.target.value)}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--ff-text-muted)] mb-1.5">Platform</label>
              <select className="ff-input w-full px-3 py-2.5 text-sm" value={platform} onChange={(e) => setPlatform(e.target.value)}>
                <option value="web">Web</option>
                <option value="mobile">Mobile</option>
                <option value="desktop">Desktop</option>
              </select>
            </div>
          </div>
          <div className="flex justify-between pt-4">
            <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
            <Button loading={loading} onClick={handleCreate}>Create Project</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
