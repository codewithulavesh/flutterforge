import { useMemo, useState } from 'react';
import { Package, Plus, Trash2, Search, CheckCircle2 } from 'lucide-react';
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
  const { files, currentProject, saveFile } = useProjectStore();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newPackage, setNewPackage] = useState('');
  const [newVersion, setNewVersion] = useState('');

  const pubspec = files.find((file) => file.path === 'pubspec.yaml');
  const dependencies = useMemo(() => parsePubspecDependencies(pubspec?.content ?? ''), [pubspec?.content]);

  const filtered = POPULAR_PACKAGES.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAdd(name: string, version: string) {
    if (!currentProject || !pubspec) {
      toast('error', 'Generate the project first.');
      return;
    }
    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!cleanName) return;
    if (parsePubspecDependencies(pubspec.content).some((dependency) => dependency.name === cleanName)) {
      toast('info', `${cleanName} is already in pubspec.yaml`);
      return;
    }
    const next = pubspec.content.replace(
      /^dependencies:\s*$/m,
      `dependencies:\n  ${cleanName}: ${version || '^1.0.0'}`,
    );
    const saved = await saveFile(currentProject.id, 'pubspec.yaml', next);
    if (saved) toast('success', `Added ${cleanName} ${version}`);
    else toast('warning', `Added ${cleanName} locally — changes may not persist.`);
    setAddOpen(false);
    setNewPackage('');
    setNewVersion('');
  }

  async function handleRemove(name: string) {
    if (!currentProject || !pubspec) return;
    const next = pubspec.content
      .split('\n')
      .filter((line) => !new RegExp(`^\\s{2}${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`).test(line))
      .join('\n');
    const saved = await saveFile(currentProject.id, 'pubspec.yaml', next);
    if (saved) toast('success', `Removed ${name}`);
    else toast('warning', `Removed ${name} locally — changes may not persist.`);
  }

  return (
    <div className="flex flex-col h-full bg-[var(--ff-bg)] overflow-y-auto ff-scrollbar">
      <div className="max-w-4xl mx-auto w-full p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package size={18} className="text-[var(--ff-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--ff-text)]">Dependencies</h2>
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
                <div key={dep.name} className="ff-card p-3 flex items-center justify-between gap-2 group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[var(--ff-primary)]/10 flex items-center justify-center shrink-0">
                      <Package size={16} className="text-[var(--ff-primary)]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--ff-text)] truncate">{dep.name}</p>
                      <p className="text-xs text-[var(--ff-text-dim)] font-mono">{dep.version}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="success">
                      <CheckCircle2 size={10} />
                      pubspec
                    </Badge>
                    <button
                      onClick={() => handleRemove(dep.name)}
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 rounded text-red-400 hover:bg-red-500/10 transition-all"
                      title={`Remove ${dep.name}`}
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
              const isInstalled = dependencies.some((d) => d.name === pkg.name);
              return (
                <div key={pkg.name} className="ff-card p-3 flex items-center justify-between group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[var(--ff-text)]">{pkg.name}</p>
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


/** Read the direct dependencies from a pubspec.yaml string. */
function parsePubspecDependencies(content: string): Array<{ name: string; version: string }> {
  const lines = String(content ?? '').split('\n');
  const dependencies: Array<{ name: string; version: string }> = [];
  let inDependencies = false;
  for (const line of lines) {
    if (/^dependencies:\s*$/.test(line)) {
      inDependencies = true;
      continue;
    }
    if (!inDependencies) continue;
    if (/^\S/.test(line)) break;
    const match = line.match(/^ {2}([a-z][a-z0-9_]*):\s*(.*)$/);
    if (match && match[1] !== 'flutter') {
      dependencies.push({ name: match[1], version: match[2] || 'any' });
    }
  }
  return dependencies;
}
