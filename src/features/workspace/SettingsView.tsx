import { Settings as SettingsIcon, Save } from 'lucide-react';
import { useState } from 'react';
import { useProjectStore } from '@/stores/project.store';
import { toast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';

export function SettingsView() {
  const { currentProject, updateProject } = useProjectStore();
  const [name, setName] = useState(currentProject?.name ?? '');
  const [description, setDescription] = useState(currentProject?.description ?? '');
  const [flutterVersion, setFlutterVersion] = useState(currentProject?.flutter_version ?? '3.24.0');
  const [stateManagement, setStateManagement] = useState(currentProject?.state_management ?? 'provider');
  const [themeMode, setThemeMode] = useState(currentProject?.theme_mode ?? 'light');
  const [platform, setPlatform] = useState(currentProject?.platform ?? 'web');

  if (!currentProject) return null;

  async function handleSave() {
    await updateProject(currentProject!.id, {
      name,
      description,
      flutter_version: flutterVersion,
      state_management: stateManagement,
      theme_mode: themeMode,
      platform,
    });
    toast('success', 'Settings saved');
  }

  return (
    <div className="flex flex-col h-full bg-[var(--ff-bg)] overflow-y-auto ff-scrollbar">
      <div className="max-w-2xl mx-auto w-full p-6 space-y-6">
        <div className="flex items-center gap-2">
          <SettingsIcon size={18} className="text-[var(--ff-primary)]" />
          <h2 className="text-lg font-semibold text-white">Project Settings</h2>
        </div>

        <div className="space-y-4">
          <Input label="Project Name" value={name} onChange={(e) => setName(e.target.value)} />
          <div>
            <label className="block text-sm font-medium text-[var(--ff-text-muted)] mb-1.5">Description</label>
            <textarea
              className="ff-input w-full px-3 py-2 text-sm resize-none"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

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

          <div className="ff-card p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--ff-text-dim)]">Project ID</p>
              <p className="text-xs text-[var(--ff-text-muted)] font-mono">{currentProject.id}</p>
            </div>
            <Badge variant="info">{currentProject.template}</Badge>
          </div>

          <Button icon={<Save size={14} />} onClick={handleSave}>Save Settings</Button>
        </div>
      </div>
    </div>
  );
}
