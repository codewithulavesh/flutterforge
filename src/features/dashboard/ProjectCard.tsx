import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { MoreVertical, FolderOpen, Copy, Trash2, Download, Pencil } from 'lucide-react';
import type { Project } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { useProjectStore } from '@/stores/project.store';
import { toast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  const mins = Math.floor(diff / 60000);
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
}

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
  const [newName, setNewName] = useState(project.name);

  function handleRename() {
    if (newName.trim()) {
      updateProject(project.id, { name: newName.trim() });
      setRenameOpen(false);
      toast('success', 'Project renamed');
    }
  }

  function handleDelete() {
    deleteProject(project.id);
    setDeleteOpen(false);
    toast('success', 'Project deleted');
  }

  return (
    <>
      <div
        className="ff-card p-3 sm:p-4 group cursor-pointer hover:border-[var(--ff-border-hover)] transition-all"
        onClick={() => navigate(`/project/${project.id}`)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--ff-primary)]/10 flex items-center justify-center">
            <FolderOpen size={20} className="text-[var(--ff-primary)]" />
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <Dropdown
              trigger={
                <button className="p-1.5 rounded-md text-[var(--ff-text-dim)] hover:text-white hover:bg-[var(--ff-surface-2)] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <MoreVertical size={16} />
                </button>
              }
            >
              <DropdownItem icon={<FolderOpen size={14} />} onClick={() => navigate(`/project/${project.id}`)}>Open</DropdownItem>
              <DropdownItem icon={<Pencil size={14} />} onClick={() => { setNewName(project.name); setRenameOpen(true); }}>Rename</DropdownItem>
              <DropdownItem icon={<Copy size={14} />} onClick={() => { duplicateProject(project.id); toast('success', 'Project duplicated'); }}>Duplicate</DropdownItem>
              <DropdownItem icon={<Download size={14} />} onClick={() => toast('info', 'Export coming soon')}>Export</DropdownItem>
              <DropdownItem icon={<Trash2 size={14} />} danger onClick={() => setDeleteOpen(true)}>Delete</DropdownItem>
            </Dropdown>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-white mb-1 truncate">{project.name}</h3>
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
        <p className="text-sm text-[var(--ff-text-muted)] mb-4">
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
