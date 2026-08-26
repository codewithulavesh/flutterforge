import { useState } from 'react';
import { Package, Plus, Trash2, Search, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { useProjectStore } from '@/stores/project.store';
import { toast } from '@/components/ui/Toast';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

const POPULAR_PACKAGES = [
  { name: 'http', version: '^1.2.0', description: 'A composable, Future-based library for making HTTP requests' },
  { name: 'provider', version: '^6.1.1', description: 'InheritedWidget, but simple' },
  { name: 'go_router', version: '^14.2.0', description: 'Declarative routing for Flutter' },
  { name: 'flutter_riverpod', version: '^2.5.1', description: 'A reactive caching and state-management library' },
  { name: 'shared_preferences', version: '^2.2.3', description: 'Wraps NSUserDefaults and SharedPreferences' },
  { name: 'cached_network_image', version: '^3.3.1', description: 'Flutter library to load and cache network images' },
  { name: 'google_fonts', version: '^6.2.1', description: 'Functions to easily use Google Fonts' },
  { name: 'flutter_bloc', version: '^8.1.6', description: 'State management using the BLoC pattern' },
  { name: 'supabase_flutter', version: '^2.6.0', description: 'Supabase Flutter SDK' },
  { name: 'image_picker', version: '^1.1.2', description: 'Pick images from device gallery or camera' },
];

export function DependenciesView() {
  const { dependencies, currentProject, addDependency, removeDependency } = useProjectStore();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newPackage, setNewPackage] = useState('');
  const [newVersion, setNewVersion] = useState('');

  const filtered = POPULAR_PACKAGES.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAdd(name: string, version: string) {
    if (!currentProject) return;
    await addDependency(currentProject.id, name, version);
    toast('success', `Added ${name} ${version}`);
    setAddOpen(false);
    setNewPackage('');
    setNewVersion('');
  }

  async function handleRemove(id: string, name: string) {
    if (!currentProject) return;
    await removeDependency(currentProject.id, id);
    toast('success', `Removed ${name}`);
  }

  return (
    <div className="flex flex-col h-full bg-[var(--ff-bg)] overflow-y-auto ff-scrollbar">
      <div className="max-w-4xl mx-auto w-full p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package size={18} className="text-[var(--ff-primary)]" />
            <h2 className="text-lg font-semibold text-white">Dependencies</h2>
          </div>
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>Add Package</Button>
        </div>

        {/* Installed */}
        <div>
          <h3 className="text-xs font-semibold text-[var(--ff-text-dim)] uppercase tracking-wider mb-3">Installed ({dependencies.length})</h3>
          {dependencies.length === 0 ? (
            <div className="ff-card p-8 text-center">
              <Package size={28} className="text-[var(--ff-text-dim)] mx-auto mb-2" />
              <p className="text-sm text-[var(--ff-text-muted)]">No dependencies installed yet</p>
              <p className="text-xs text-[var(--ff-text-dim)] mt-1">Add packages from the library below or via AI</p>
            </div>
          ) : (
            <div className="space-y-2">
              {dependencies.map((dep) => (
                <div key={dep.id} className="ff-card p-3 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--ff-primary)]/10 flex items-center justify-center">
                      <Package size={16} className="text-[var(--ff-primary)]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{dep.package_name}</p>
                      <p className="text-xs text-[var(--ff-text-dim)] font-mono">{dep.version}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={dep.status === 'installed' ? 'success' : dep.status === 'installing' ? 'warning' : 'error'}>
                      {dep.status === 'installed' && <CheckCircle2 size={10} />}
                      {dep.status === 'installing' && <Loader2 size={10} className="ff-spin" />}
                      {dep.status === 'failed' && <AlertCircle size={10} />}
                      {dep.status}
                    </Badge>
                    <button
                      onClick={() => handleRemove(dep.id, dep.package_name)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Popular packages */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[var(--ff-text-dim)] uppercase tracking-wider">Popular Packages</h3>
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--ff-text-dim)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="ff-input pl-7 pr-2 py-1 text-xs w-40"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filtered.map((pkg) => {
              const isInstalled = dependencies.some((d) => d.package_name === pkg.name);
              return (
                <div key={pkg.name} className="ff-card p-3 flex items-center justify-between group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">{pkg.name}</p>
                      <span className="text-[10px] text-[var(--ff-text-dim)] font-mono">{pkg.version}</span>
                    </div>
                    <p className="text-xs text-[var(--ff-text-muted)] truncate">{pkg.description}</p>
                  </div>
                  {isInstalled ? (
                    <Badge variant="success">Installed</Badge>
                  ) : (
                    <Button variant="ghost" size="sm" icon={<Plus size={12} />} onClick={() => handleAdd(pkg.name, pkg.version)}>
                      Add
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add custom package modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Package" size="sm">
        <div className="space-y-4">
          <Input label="Package Name" placeholder="e.g. http" value={newPackage} onChange={(e) => setNewPackage(e.target.value)} />
          <Input label="Version" placeholder="e.g. ^1.2.0" value={newVersion} onChange={(e) => setNewVersion(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button disabled={!newPackage.trim()} onClick={() => handleAdd(newPackage.trim(), newVersion.trim() || '^1.0.0')}>Add</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
