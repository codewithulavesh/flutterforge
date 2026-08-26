import { useState, useMemo } from 'react';
import * as Icons from 'lucide-react';
import { ChevronRight, ChevronDown, FileCode2, FileText, Settings, Braces, File, Folder, FolderOpen, Plus, Search } from 'lucide-react';
import { useProjectStore } from '@/stores/project.store';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { buildFileTree, getFileExtension } from '@/utils/fileTree';
import type { TreeNode } from '@/types';
import { cn } from '@/utils/cn';
import { toast } from '@/components/ui/Toast';

function getFileIcon(path: string) {
  const ext = getFileExtension(path);
  if (ext === 'dart') return <FileCode2 size={14} className="text-blue-400" />;
  if (ext === 'yaml' || ext === 'yml') return <Settings size={14} className="text-purple-400" />;
  if (ext === 'md') return <FileText size={14} className="text-gray-400" />;
  if (ext === 'json') return <Braces size={14} className="text-amber-400" />;
  return <File size={14} className="text-gray-400" />;
}

export function FileExplorer() {
  const { files, currentProject, createFile, deleteFile } = useProjectStore();
  const { openFile, activeFile } = useWorkspaceStore();
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['lib', 'lib/screens', 'lib/core', 'lib/core/theme', 'lib/core/router']));
  const [search, setSearch] = useState('');
  const [contextMenu, setContextMenu] = useState<string | null>(null);

  const tree = useMemo(() => buildFileTree(files), [files]);

  const filteredFiles = useMemo(() => {
    if (!search) return null;
    return files.filter((f) => f.path.toLowerCase().includes(search.toLowerCase()) && !f.is_directory);
  }, [files, search]);

  function toggleExpand(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  async function handleNewFile() {
    if (!currentProject) return;
    const name = prompt('File path (e.g. lib/screens/profile/profile_screen.dart):');
    if (!name) return;
    await createFile(currentProject.id, name, '');
    toast('success', `Created ${name}`);
  }

  async function handleDelete(path: string) {
    if (!currentProject) return;
    if (!confirm(`Delete ${path}?`)) return;
    await deleteFile(currentProject.id, path);
    toast('success', `Deleted ${path}`);
  }

  function renderNode(node: TreeNode, depth: number): React.ReactNode {
    if (node.type === 'directory') {
      const isExpanded = expanded.has(node.path);
      return (
        <div key={node.path}>
          <div
            className="flex items-center gap-1 px-1 py-1 rounded hover:bg-[var(--ff-surface-2)] cursor-pointer text-xs group"
            style={{ paddingLeft: `${depth * 12 + 4}px` }}
            onClick={() => toggleExpand(node.path)}
          >
            {isExpanded ? <ChevronDown size={12} className="text-[var(--ff-text-dim)]" /> : <ChevronRight size={12} className="text-[var(--ff-text-dim)]" />}
            {isExpanded ? <FolderOpen size={14} className="text-amber-400" /> : <Folder size={14} className="text-amber-400" />}
            <span className="text-[var(--ff-text-muted)] truncate">{node.name}</span>
          </div>
          {isExpanded && node.children?.map((child) => renderNode(child, depth + 1))}
        </div>
      );
    }

    const isActive = activeFile === node.path;
    return (
      <div
        key={node.path}
        className="flex items-center gap-1 px-1 py-1 rounded cursor-pointer text-xs group relative"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => openFile(node.path)}
        onContextMenu={(e) => { e.preventDefault(); setContextMenu(contextMenu === node.path ? null : node.path); }}
      >
        <span className="w-3" />
        {getFileIcon(node.path)}
        <span className={cn('truncate', isActive ? 'text-[var(--ff-primary)]' : 'text-[var(--ff-text-muted)] group-hover:text-white')}>
          {node.name}
        </span>
        {contextMenu === node.path && (
          <div className="absolute right-0 top-0 z-50 ff-card py-1 min-w-[120px]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => { handleDelete(node.path); setContextMenu(null); }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--ff-surface)]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--ff-border)] shrink-0">
        <span className="text-xs font-semibold text-[var(--ff-text-muted)] uppercase tracking-wider">Files</span>
        <button
          onClick={handleNewFile}
          className="p-1 rounded text-[var(--ff-text-dim)] hover:text-white hover:bg-[var(--ff-surface-2)] transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="px-2 py-2 border-b border-[var(--ff-border)]">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--ff-text-dim)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files..."
            className="ff-input w-full pl-7 pr-2 py-1 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto ff-scrollbar px-1 py-1" onClick={() => setContextMenu(null)}>
        {filteredFiles ? (
          <div className="space-y-0.5">
            {filteredFiles.map((f) => (
              <div
                key={f.id}
                onClick={() => openFile(f.path)}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-xs',
                  activeFile === f.path ? 'bg-[var(--ff-primary)]/10 text-[var(--ff-primary)]' : 'text-[var(--ff-text-muted)] hover:bg-[var(--ff-surface-2)] hover:text-white'
                )}
              >
                {getFileIcon(f.path)}
                <span className="truncate">{f.path}</span>
              </div>
            ))}
          </div>
        ) : (
          tree.children?.map((child) => renderNode(child, 0))
        )}
      </div>
    </div>
  );
}
