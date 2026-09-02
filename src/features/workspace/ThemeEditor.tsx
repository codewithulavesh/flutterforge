import { useState } from 'react';
import { Palette, Sun, Moon, Monitor, Check } from 'lucide-react';
import { useProjectStore } from '@/stores/project.store';
import { toast } from '@/components/ui/Toast';
import { DEFAULT_THEME } from '@/utils/flutterTemplates';
import type { ThemeConfig } from '@/types';
import { cn } from '@/utils/cn';

export function ThemeEditor() {
  const { currentProject, updateProject } = useProjectStore();
  const [theme, setTheme] = useState<ThemeConfig>(DEFAULT_THEME);
  const [mode, setMode] = useState<'light' | 'dark' | 'system'>(
    (currentProject?.theme_mode as 'light' | 'dark' | 'system') ?? 'light'
  );

  function updateColor(key: keyof ThemeConfig['colors'], value: string) {
    setTheme((prev) => ({ ...prev, colors: { ...prev.colors, [key]: value } }));
  }

  function applyTheme() {
    if (!currentProject) return;
    updateProject(currentProject.id, { theme_mode: mode });
    toast('success', 'Theme updated');
  }

  const colorFields: { key: keyof ThemeConfig['colors']; label: string }[] = [
    { key: 'primary', label: 'Primary' },
    { key: 'secondary', label: 'Secondary' },
    { key: 'background', label: 'Background' },
    { key: 'surface', label: 'Surface' },
    { key: 'error', label: 'Error' },
    { key: 'success', label: 'Success' },
    { key: 'warning', label: 'Warning' },
    { key: 'text', label: 'Text' },
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--ff-bg)] overflow-y-auto ff-scrollbar">
      <div className="max-w-2xl mx-auto w-full p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Palette size={18} className="text-[var(--ff-primary)]" />
          <h2 className="text-lg font-semibold text-white">Theme Editor</h2>
        </div>

        {/* Mode selector */}
        <div>
          <label className="block text-sm font-medium text-[var(--ff-text-muted)] mb-2">Theme Mode</label>
          <div className="grid grid-cols-1 xs:grid-cols-3 gap-2">
            {[
              { value: 'light', icon: Sun, label: 'Light' },
              { value: 'dark', icon: Moon, label: 'Dark' },
              { value: 'system', icon: Monitor, label: 'System' },
            ].map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => setMode(opt.value as typeof mode)}
                  className={cn(
                    'flex flex-col items-center gap-2 py-4 rounded-lg border transition-all',
                    mode === opt.value
                      ? 'border-[var(--ff-primary)] bg-[var(--ff-primary)]/10 text-[var(--ff-primary)]'
                      : 'border-[var(--ff-border)] text-[var(--ff-text-muted)] hover:border-[var(--ff-border-hover)]'
                  )}
                >
                  <Icon size={18} />
                  <span className="text-xs">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Colors */}
        <div>
          <label className="block text-sm font-medium text-[var(--ff-text-muted)] mb-2">Colors</label>
          <div className="grid grid-cols-2 gap-3">
            {colorFields.map((field) => (
              <div key={field.key} className="flex items-center gap-2 ff-card p-2.5">
                <input
                  type="color"
                  value={theme.colors[field.key]}
                  onChange={(e) => updateColor(field.key, e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border border-[var(--ff-border)]"
                />
                <div className="flex-1">
                  <p className="text-xs font-medium text-white">{field.label}</p>
                  <p className="text-[10px] text-[var(--ff-text-dim)] font-mono">{theme.colors[field.key]}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Typography */}
        <div>
          <label className="block text-sm font-medium text-[var(--ff-text-muted)] mb-2">Typography (font sizes in px)</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(Object.keys(theme.typography) as Array<keyof ThemeConfig['typography']>).map((key) => (
              <div key={key} className="ff-card p-2.5">
                <p className="text-[10px] text-[var(--ff-text-dim)] mb-1 capitalize">{key}</p>
                <input
                  type="number"
                  value={theme.typography[key]}
                  onChange={(e) => setTheme((prev) => ({ ...prev, typography: { ...prev.typography, [key]: e.target.value } }))}
                  className="ff-input w-full px-2 py-1 text-xs"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Shape & elevation */}
        <div className="grid grid-cols-2 gap-3">
          <div className="ff-card p-3">
            <p className="text-xs font-medium text-white mb-2">Border Radius</p>
            <input
              type="number"
              value={theme.radius}
              onChange={(e) => setTheme((prev) => ({ ...prev, radius: e.target.value }))}
              className="ff-input w-full px-2 py-1.5 text-sm"
            />
          </div>
          <div className="ff-card p-3">
            <p className="text-xs font-medium text-white mb-2">Elevation</p>
            <input
              type="number"
              value={theme.elevation}
              onChange={(e) => setTheme((prev) => ({ ...prev, elevation: e.target.value }))}
              className="ff-input w-full px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        {/* Preview */}
        <div>
          <label className="block text-sm font-medium text-[var(--ff-text-muted)] mb-2">Preview</label>
          <div
            className="rounded-xl p-6 border"
            style={{
              backgroundColor: mode === 'dark' ? '#111827' : theme.colors.background,
              borderColor: mode === 'dark' ? '#27272a' : '#e5e7eb',
            }}
          >
            <div
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-medium"
              style={{ backgroundColor: theme.colors.primary }}
            >
              <Check size={16} />
              Primary Button
            </div>
            <div
              className="mt-4 p-4 rounded-lg border"
              style={{
                backgroundColor: mode === 'dark' ? '#1f2937' : theme.colors.surface,
                borderColor: mode === 'dark' ? '#374151' : '#e5e7eb',
              }}
            >
              <p style={{ color: mode === 'dark' ? '#f9fafb' : theme.colors.text }} className="text-sm font-semibold mb-1">Card Title</p>
              <p style={{ color: mode === 'dark' ? '#9ca3af' : '#6b7280' }} className="text-xs">This is how your cards will look.</p>
            </div>
          </div>
        </div>

        <button
          onClick={applyTheme}
          className="ff-btn-primary px-4 py-2.5 rounded-lg text-sm font-medium w-full"
        >
          Apply Theme
        </button>
      </div>
    </div>
  );
}
