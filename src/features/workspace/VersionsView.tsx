import { useMemo, useState } from 'react';
import { History, Plus, RotateCcw, GitCompare } from 'lucide-react';
import { useProjectStore } from '@/stores/project.store';
import { toast } from '@/components/ui/Toast';
import { timeAgo } from '@/utils/time';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { snapshotDiff, type SnapshotDiff } from '@/utils/versionDiff';
import type { ProjectVersion } from '@/types';

const STATUS_LABEL: Record<'added' | 'removed' | 'modified', string> = {
  added: 'A',
  removed: 'D',
  modified: 'M',
};

const STATUS_CLASS: Record<'added' | 'removed' | 'modified', string> = {
  added: 'text-emerald-400',
  removed: 'text-rose-400',
  modified: 'text-amber-400',
};

export function VersionsView() {
  const { versions, currentProject, createVersion, restoreVersion } = useProjectStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [diffFor, setDiffFor] = useState<ProjectVersion | null>(null);
  const [activeDiffPath, setActiveDiffPath] = useState<string | null>(null);

  const diffs = useMemo(() => {
    const map = new Map<string, SnapshotDiff>();
    versions.forEach((version, index) => {
      const before = versions[index + 1]?.file_snapshot ?? {};
      map.set(version.id, snapshotDiff(before, version.file_snapshot ?? {}));
    });
    return map;
  }, [versions]);

  const activeDiff = diffFor ? diffs.get(diffFor.id) : undefined;
  const activeFile = activeDiff?.files.find((file) => file.path === activeDiffPath)
    ?? activeDiff?.files[0];

  function openDiff(version: ProjectVersion) {
    setDiffFor(version);
    setActiveDiffPath(diffs.get(version.id)?.files[0]?.path ?? null);
  }

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
            <p className="text-xs text-[var(--ff-text-dim)] mt-1">Checkpoints are created automatically after every run, repair, and saved edit</p>
          </div>
        ) : (
          <div className="space-y-2">
            {versions.map((version, i) => {
              const diff = diffs.get(version.id);
              return (
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
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-[var(--ff-text-dim)]">
                          <span>{timeAgo(version.created_at)}</span>
                          <span aria-hidden>·</span>
                          <span>{Object.keys(version.file_snapshot).length} files</span>
                          {diff && diff.files.length > 0 && (
                            <>
                              <span aria-hidden>·</span>
                              <span>{diff.files.length} changed</span>
                              <span className="text-emerald-400">+{diff.additions}</span>
                              <span className="text-rose-400">−{diff.deletions}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openDiff(version)}
                        disabled={!diff || diff.files.length === 0}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-[var(--ff-text-muted)] hover:text-[var(--ff-primary)] hover:bg-[var(--ff-primary)]/10 transition-all disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--ff-text-muted)]">
                        <GitCompare size={12} />
                        Changes
                      </button>
                      <button
                        onClick={() => handleRestore(version.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-[var(--ff-text-muted)] hover:text-[var(--ff-primary)] hover:bg-[var(--ff-primary)]/10 transition-all">
                        <RotateCcw size={12} />
                        Restore
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
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

      <Modal
        open={Boolean(diffFor)}
        onClose={() => { setDiffFor(null); setActiveDiffPath(null); }}
        title={diffFor ? `v${diffFor.version_number} · ${diffFor.label ?? 'Changes'}` : 'Changes'}
        size="xl"
      >
        {!activeDiff || activeDiff.files.length === 0 ? (
          <p className="text-sm text-[var(--ff-text-muted)]">This checkpoint has no recorded file changes.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
            <div className="max-h-64 overflow-y-auto ff-scrollbar space-y-1 sm:max-h-[60vh]">
              {activeDiff.files.map((file) => (
                <button
                  key={file.path}
                  onClick={() => setActiveDiffPath(file.path)}
                  className={cn(
                    'w-full text-left px-2.5 py-2 rounded-md transition-colors',
                    activeFile?.path === file.path
                      ? 'bg-[var(--ff-primary)]/10 text-[var(--ff-text)]'
                      : 'text-[var(--ff-text-muted)] hover:bg-[var(--ff-surface-2)]',
                  )}
                >
                  <span className={cn('mr-1.5 font-mono text-[10px] font-bold', STATUS_CLASS[file.status])}>
                    {STATUS_LABEL[file.status]}
                  </span>
                  <span className="text-xs break-all">{file.path}</span>
                  <span className="ml-1.5 font-mono text-[10px] text-emerald-400">+{file.additions}</span>
                  <span className="ml-1 font-mono text-[10px] text-rose-400">−{file.deletions}</span>
                </button>
              ))}
            </div>
            <div className="min-w-0 rounded-md border border-[var(--ff-border)] bg-[var(--ff-surface-1)] overflow-auto ff-scrollbar max-h-[60vh]">
              {activeFile ? (
                <div className="font-mono text-[11px] leading-relaxed py-2 min-w-max">
                  {activeFile.lines.map((line, index) => (
                    <div
                      key={`${index}-${line.type}`}
                      className={cn(
                        'flex gap-2 px-2 whitespace-pre',
                        line.type === 'add' && 'bg-emerald-500/10 text-emerald-300',
                        line.type === 'remove' && 'bg-rose-500/10 text-rose-300',
                        line.type === 'gap' && 'text-[var(--ff-text-dim)] italic py-1',
                        line.type === 'context' && 'text-[var(--ff-text-muted)]',
                      )}
                    >
                      {line.type === 'gap' ? (
                        <span className="px-2">{line.text}</span>
                      ) : (
                        <>
                          <span className="w-8 shrink-0 select-none text-right text-[var(--ff-text-dim)]">{line.oldLine ?? ''}</span>
                          <span className="w-8 shrink-0 select-none text-right text-[var(--ff-text-dim)]">{line.newLine ?? ''}</span>
                          <span className="w-3 shrink-0 select-none text-center">
                            {line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' '}
                          </span>
                          <span>{line.text || ' '}</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="p-4 text-sm text-[var(--ff-text-muted)]">Select a file to see its diff.</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
