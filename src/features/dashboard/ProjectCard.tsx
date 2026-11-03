import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { MoreVertical, FolderOpen, Copy, Trash2, Download, Pencil, ArrowUpRight } from 'lucide-react';
import type { Project } from '@/types';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { useProjectStore } from '@/stores/project.store';
import { toast } from '@/components/ui/Toast';
import { downloadProjectById, formatBytes } from '@/utils/exportProject';
import { timeAgo } from '@/utils/time';
import { TEMPLATES } from '@/utils/constants';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/utils/cn';

const STATUS_DOTS: Record<string, string> = {
  created: 'bg-[var(--fb-dim)]',
  generating: 'bg-amber-400',
  ready: 'bg-[var(--fb-lime)]',
  building: 'bg-[var(--fb-cyan)]',
  built: 'bg-[var(--fb-lime)]',
  failed: 'bg-red-500',
  deployed: 'bg-[var(--fb-lime)]',
};

const FOLD_GRADIENTS = ['ffb-fold-0', 'ffb-fold-1', 'ffb-fold-2', 'ffb-fold-3', 'ffb-fold-4', 'ffb-fold-5'];

function foldGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return FOLD_GRADIENTS[hash % FOLD_GRADIENTS.length];
}

export function ProjectCard({ project, index }: { project: Project; index: number }) {
  const navigate = useNavigate();
  const { deleteProject, duplicateProject, updateProject } = useProjectStore();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [newName, setNewName] = useState(project.name);

  async function handleRename() {
    if (!newName.trim()) return;
    const renamed = await updateProject(project.id, { name: newName.trim() });
    if (renamed) {
      setRenameOpen(false);
      toast('success', 'Project renamed');
    } else {
      toast('error', useProjectStore.getState().error ?? 'Could not rename the project.');
    }
  }

  async function handleDelete() {
    const deleted = await deleteProject(project.id);
    if (deleted) {
      setDeleteOpen(false);
      toast('success', 'Project deleted');
    } else {
      toast('error', useProjectStore.getState().error ?? 'Could not delete the project.');
    }
  }

  async function handleDuplicate() {
    const duplicated = await duplicateProject(project.id);
    if (duplicated) toast('success', 'Project duplicated');
    else toast('error', useProjectStore.getState().error ?? 'Could not duplicate the project.');
  }

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    toast('info', `Preparing ${project.name} for download...`);
    try {
      const built = await downloadProjectById(project);
      toast('success', `Downloaded ${built.filename} (${built.fileCount} files, ${formatBytes(built.bytes)})`);
    } catch (err) {
      toast('error', err instanceof Error ? `Export failed: ${err.message}` : 'Export failed');
    }
    setExporting(false);
  }

  const templateLabel = TEMPLATES.find((t) => t.id === project.template)?.name ?? project.template;
  const numeral = String(index + 1).padStart(3, '0');

  return (
    <>
      <article className="ffb-folder ffb-project-card group relative">
        <div className="ffb-folder-inner">
          <div aria-hidden className={cn('ffb-folder-art', foldGradient(project.id))} />
          <span aria-hidden className="ffb-folder-front" />
          <span aria-hidden className="ffb-folder-tab" />
          <span aria-hidden className="ffb-folder-fillet" />

          <div className="relative z-10 flex h-full flex-col">
            <div aria-hidden className="ffb-folder-label-space shrink-0" />

            <div className="min-w-0 px-[15px]">
              <h3
                className="ffb-folder-title truncate font-mono text-[12px] font-semibold uppercase leading-tight tracking-[0.07em] text-white"
                title={project.name}
              >
                <button
                  className="text-left after:absolute after:inset-0 after:rounded-[20px]"
                  onClick={() => navigate(`/project/${project.id}`)}
                  type="button"
                >
                  {project.name}
                  <span className="sr-only"> — open project</span>
                </button>
              </h3>
              <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[9px] uppercase leading-none tracking-[0.14em] text-white/60">
                <span
                  aria-hidden
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    STATUS_DOTS[project.status] ?? 'bg-[var(--fb-dim)]',
                    project.status === 'generating' && 'animate-pulse',
                  )}
                />
                <span className="truncate">{project.status} · {templateLabel}</span>
              </p>
            </div>

            <div className="mt-auto flex items-end justify-between gap-3 px-[15px] pb-3.5">
              <span aria-hidden className="ffb-folder-numeral">{numeral}</span>
              <span className="inline-flex items-center gap-1 pb-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-white/60">
                Updated {timeAgo(project.updated_at)}
                <ArrowUpRight size={11} className="opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
              </span>
            </div>
          </div>
        </div>

        <div className="absolute right-2.5 top-2.5 z-20" onClick={(e) => e.stopPropagation()}>
          <Dropdown
            trigger={
              <button
                aria-label={`Project actions for ${project.name}`}
                className="ffb-folder-actions flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75 sm:h-9 sm:w-9"
                type="button"
              >
                <MoreVertical size={16} />
              </button>
            }
          >
            <DropdownItem icon={<FolderOpen size={14} />} onClick={() => navigate(`/project/${project.id}`)}>Open</DropdownItem>
            <DropdownItem icon={<Pencil size={14} />} onClick={() => { setNewName(project.name); setRenameOpen(true); }}>Rename</DropdownItem>
            <DropdownItem icon={<Copy size={14} />} onClick={() => void handleDuplicate()}>Duplicate</DropdownItem>
            <DropdownItem icon={<Download size={14} />} onClick={handleExport}>{exporting ? 'Exporting...' : 'Export as ZIP'}</DropdownItem>
            <DropdownItem icon={<Trash2 size={14} />} danger onClick={() => setDeleteOpen(true)}>Delete</DropdownItem>
          </Dropdown>
        </div>
      </article>

      {/* Rename modal */}
      <Modal open={renameOpen} onClose={() => setRenameOpen(false)} title="Rename Project" size="sm">
        <Input label="New Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRenameOpen(false)}>Cancel</Button>
          <Button onClick={handleRename}>Save</Button>
        </div>
      </Modal>

      {/* Delete modal */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Project" size="sm">
        <p className="mb-4 break-words text-sm text-[var(--ff-text-muted)]">
          Are you sure you want to delete "{project.name}"? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </>
  );
}
