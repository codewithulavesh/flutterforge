import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { MoreVertical, FolderOpen, Copy, Trash2, Download, Pencil } from 'lucide-react';
import type { Project } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { useProjectStore } from '@/stores/project.store';
import { toast } from '@/components/ui/Toast';
import { downloadProjectById, formatBytes } from '@/utils/exportProject';
import { timeAgo } from '@/utils/time';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const STATUS_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  created: 'default',
  generating: 'warning',
  ready: 'success',
  building: 'info',
  built: 'success',
  failed: 'error',
  deployed: 'success',
};

export function ProjectCard({ project }: { project: Project }) {
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

  return (
    <>
      <div
        className="ff-card ff-card-hover p-3 sm:p-4 group cursor-pointer transition-all"
        onClick={() => navigate(`/project/${project.id}`)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--ff-studio-yellow)]/60 border border-[var(--ff-border)] flex items-center justify-center">
            <FolderOpen size={20} className="text-[var(--ff-primary)]" />
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <Dropdown
              trigger={
                <button className="p-1.5 rounded-md text-[var(--ff-text-dim)] hover:text-[var(--ff-text)] hover:bg-[var(--ff-surface-2)] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
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
        </div>

        <h3 className="ff-display text-[15px] font-semibold text-[var(--ff-text)] mb-1 truncate">{project.name}</h3>
        <p className="text-xs text-[var(--ff-text-muted)] mb-3 line-clamp-2">{project.description || 'No description'}</p>

        <div className="flex items-center justify-between">
          <Badge variant={STATUS_VARIANTS[project.status] ?? 'default'}>{project.status}</Badge>
          <span className="text-xs text-[var(--ff-text-dim)]">{timeAgo(project.updated_at)}</span>
        </div>
      </div>

      {/* Rename modal */}
      <Modal open={renameOpen} onClose={() => setRenameOpen(false)} title="Rename Project" size="sm">
        <Input label="New Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => setRenameOpen(false)}>Cancel</Button>
          <Button onClick={handleRename}>Save</Button>
        </div>
      </Modal>

      {/* Delete modal */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Project" size="sm">
        <p className="text-sm text-[var(--ff-text-muted)] mb-4 break-words">
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
