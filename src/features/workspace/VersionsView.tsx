import { History, Plus, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useProjectStore } from '@/stores/project.store';
import { toast } from '@/components/ui/Toast';
import { timeAgo } from '@/utils/time';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';

export function VersionsView() {
  const { versions, currentProject, createVersion, restoreVersion } = useProjectStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');

  async function handleCreate() {
    if (!currentProject || !label.trim()) return;
    const created = await createVersion(currentProject.id, label.trim(), description.trim());
    if (!created) {
      toast('error', useProjectStore.getState().error ?? 'Could not create the checkpoint.');
      return;
    }
    toast('success', 'Version checkpoint created');
    setCreateOpen(false);
    setLabel('');
    setDescription('');
  }

  async function handleRestore(versionId: string) {
    if (!currentProject) return;
    if (!confirm('Restore this version? Current changes will be replaced.')) return;
    const restored = await restoreVersion(currentProject.id, versionId);
    if (restored) toast('success', 'Version restored');
    else toast('error', 'Could not restore this version.');
  }

  return (
    <div className="flex flex-col h-full bg-[var(--ff-bg)] overflow-y-auto ff-scrollbar">
      <div className="max-w-3xl mx-auto w-full p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={18} className="text-[var(--ff-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--ff-text)]">Version History</h2>
          </div>
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>New Checkpoint</Button>
        </div>

        {versions.length === 0 ? (
          <div className="ff-card p-8 text-center">
            <History size={28} className="text-[var(--ff-text-dim)] mx-auto mb-2" />
            <p className="text-sm text-[var(--ff-text-muted)]">No version checkpoints yet</p>
            <p className="text-xs text-[var(--ff-text-dim)] mt-1">Create a checkpoint to save your project state</p>
          </div>
        ) : (
          <div className="space-y-2">
            {versions.map((version, i) => (
              <div key={version.id} className="ff-card p-4 group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-[var(--ff-primary)]/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-[var(--ff-primary)]">v{version.version_number}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[var(--ff-text)] truncate">{version.label ?? `Version ${version.version_number}`}</p>
                        {i === 0 && <Badge variant="info">Latest</Badge>}
                      </div>
                      {version.description && (
                        <p className="text-xs text-[var(--ff-text-muted)] mt-1 break-words">{version.description}</p>
                      )}
                      <p className="text-[10px] text-[var(--ff-text-dim)] mt-1">
                        {timeAgo(version.created_at)} · {Object.keys(version.file_snapshot).length} files
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRestore(version.id)}
                    className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-[var(--ff-text-muted)] hover:text-[var(--ff-primary)] hover:bg-[var(--ff-primary)]/10 transition-all shrink-0">
                    <RotateCcw size={12} />
                    Restore
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Checkpoint" size="sm">
        <div className="space-y-4">
          <Input label="Label" placeholder="e.g. Added login screen" value={label} onChange={(e) => setLabel(e.target.value)} />
          <div>
            <label className="block text-sm font-medium text-[var(--ff-text-muted)] mb-1.5">Description (optional)</label>
            <textarea
              className="ff-input w-full px-3 py-2 text-sm resize-none"
              rows={3}
              placeholder="What changed in this version?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button disabled={!label.trim()} onClick={handleCreate}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
