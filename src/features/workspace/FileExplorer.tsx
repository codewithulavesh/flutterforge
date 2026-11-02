import { useState, useMemo, useEffect, useRef } from 'react';
import {
  ChevronRight,
  ChevronDown,
  FileCode2,
  FileText,
  Settings,
  Braces,
  File,
  Folder,
  FolderOpen,
  FolderTree,
  FilePlus2,
  ChevronsDownUp,
  MoreHorizontal,
  Search,
  SearchX,
  Trash2,
  X,
} from 'lucide-react';
import { useProjectStore } from '@/stores/project.store';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { buildFileTree, getFileExtension } from '@/utils/fileTree';
import type { TreeNode } from '@/types';
import { cn } from '@/utils/cn';
import { toast } from '@/components/ui/Toast';

function getFileIcon(path: string) {
  const ext = getFileExtension(path);
  if (ext === 'dart') return <FileCode2 size={14} className="shrink-0 text-blue-400" />;
  if (ext === 'yaml' || ext === 'yml') return <Settings size={14} className="shrink-0 text-purple-400" />;
  if (ext === 'md') return <FileText size={14} className="shrink-0 text-gray-400" />;
  if (ext === 'json') return <Braces size={14} className="shrink-0 text-amber-400" />;
  return <File size={14} className="shrink-0 text-gray-400" />;
}

/** Wrap the matching part of `text` in a <mark>. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const index = text.toLowerCase().indexOf(q.toLowerCase());
  if (index === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-sm bg-[var(--ff-primary)]/20 px-px text-inherit">
        {text.slice(index, index + q.length)}
      </mark>
      {text.slice(index + q.length)}
    </>
  );
}

function normalizeNewPath(raw: string): { path?: string; error?: string } {
  const path = raw.trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/{2,}/g, '/');
  if (!path) return { error: 'Enter a file path.' };
  if (path.endsWith('/')) return { error: 'A file name is required (path ends with “/”).' };
  if (path.split('/').some((segment) => segment === '..' || segment === '.')) {
    return { error: 'Paths cannot contain “.” or “..” segments.' };
  }
  return { path };
}

export function FileExplorer() {
  const { files, currentProject, createFile, deleteFile } = useProjectStore();
  const { openFile, activeFile } = useWorkspaceStore();
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(['lib', 'lib/screens', 'lib/core', 'lib/core/theme', 'lib/core/router']),
  );
  const [search, setSearch] = useState('');
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const [confirmPath, setConfirmPath] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newPath, setNewPath] = useState('');
  const [newError, setNewError] = useState<string | null>(null);
  const [busyPath, setBusyPath] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const newFileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const seenPaths = useRef<Set<string>>(new Set());

  useEffect(() => {
    const focusSearch = () => searchRef.current?.focus();
    window.addEventListener('ff:focus-file-search', focusSearch);
    return () => window.removeEventListener('ff:focus-file-search', focusSearch);
  }, []);

  // Expand parent folders — only for files we haven't seen yet, so a folder the
  // user collapsed stays collapsed when unrelated files change.
  useEffect(() => {
    if (!files.length) return;
    const fresh = files.filter((file) => !seenPaths.current.has(file.path));
    if (fresh.length === 0) return;
    fresh.forEach((file) => seenPaths.current.add(file.path));

    setExpanded((prev) => {
      const next = new Set(prev);
      fresh.forEach((file) => {
        const parent = file.path.split('/').slice(0, -1).join('/');
        if (!parent) return;
        let current = '';
        parent.split('/').forEach((segment) => {
          if (!segment) return;
          current = current ? `${current}/${segment}` : segment;
          next.add(current);
        });
      });
      return next;
    });
  }, [files]);

  useEffect(() => {
    if (!activeFile && files[0]) openFile(files[0].path);
  }, [files, activeFile, openFile]);

  // Keep the active file visible in long trees.
  useEffect(() => {
    if (!activeFile || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-path="${CSS.escape(activeFile)}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeFile, expanded]);

  // Escape closes menu / new-file row.
  useEffect(() => {
    if (!menuPath && !creating) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuPath(null);
      setConfirmPath(null);
      setCreating(false);
      setNewError(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuPath, creating]);

  const tree = useMemo(() => buildFileTree(files), [files]);
  const fileCount = useMemo(() => files.filter((f) => !f.is_directory).length, [files]);

  const filteredFiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return files.filter((f) => !f.is_directory && f.path.toLowerCase().includes(q));
  }, [files, search]);

  function toggleExpand(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function startCreating() {
    setSearch('');
    setCreating(true);
    setNewPath('');
    setNewError(null);
    window.requestAnimationFrame(() => newFileRef.current?.focus());
  }

  async function submitNewFile() {
    if (!currentProject) return;
    const { path, error } = normalizeNewPath(newPath);
    if (!path) {
      setNewError(error ?? 'Invalid path.');
      return;
    }
    if (files.some((f) => f.path === path)) {
      setNewError('A file with this path already exists.');
      return;
    }
    setBusyPath(path);
    try {
      const persisted = await createFile(currentProject.id, path, '');
      if (persisted) toast('success', `Created ${path}`);
      else toast('warning', `Created ${path} locally — it may not persist after a reload.`);
      setCreating(false);
      setNewPath('');
      setNewError(null);
      openFile(path);
    } finally {
      setBusyPath(null);
    }
  }

  async function handleDelete(path: string) {
    if (!currentProject) return;
    setBusyPath(path);
    try {
      const removed = await deleteFile(currentProject.id, path);
      if (removed) toast('success', `Deleted ${path}`);
      else toast('error', useProjectStore.getState().error ?? `Could not delete ${path}.`);
    } finally {
      setBusyPath(null);
      setMenuPath(null);
      setConfirmPath(null);
    }
  }

  function renderMenu(path: string, name: string) {
    const confirming = confirmPath === path;
    return (
      <div
        className="ff-card absolute right-1 top-full z-50 mt-0.5 min-w-[168px] max-w-[calc(100vw-2rem)] py-1 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="menu"
      >
        {confirming ? (
          <div className="px-3 py-2">
            <p className="mb-2 text-xs text-[var(--ff-text)]">
              Delete <span className="font-mono">{name}</span>?
            </p>
            <div className="flex gap-1.5">
              <button
                className="flex-1 rounded-md bg-red-500/15 px-2 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/25 disabled:opacity-50"
                disabled={busyPath === path}
                onClick={() => void handleDelete(path)}
                type="button"
              >
                {busyPath === path ? 'Deleting…' : 'Delete'}
              </button>
              <button
                className="flex-1 rounded-md bg-[var(--ff-surface-2)] px-2 py-1.5 text-xs text-[var(--ff-text-muted)] transition-colors hover:text-[var(--ff-text)]"
                onClick={() => setConfirmPath(null)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-400 transition-colors hover:bg-red-500/10 sm:py-1.5"
            onClick={() => setConfirmPath(path)}
            role="menuitem"
            type="button"
          >
            <Trash2 size={13} /> Delete
          </button>
        )}
      </div>
    );
  }

  function renderNode(node: TreeNode, depth: number): React.ReactNode {
    const indent = { paddingLeft: `${depth * 14 + 6}px` };

    if (node.type === 'directory') {
      const isExpanded = expanded.has(node.path);
      return (
        <div key={node.path} role="none">
          <button
            aria-expanded={isExpanded}
            className="group flex w-full items-center gap-1.5 rounded-md py-2 pr-2 text-left text-[13px] transition-colors hover:bg-[var(--ff-surface-2)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ff-primary)]/60 sm:py-1 sm:text-xs"
            onClick={() => toggleExpand(node.path)}
            role="treeitem"
            style={indent}
            type="button"
          >
            {isExpanded
              ? <ChevronDown size={12} className="shrink-0 text-[var(--ff-text-dim)]" />
              : <ChevronRight size={12} className="shrink-0 text-[var(--ff-text-dim)]" />}
            {isExpanded
              ? <FolderOpen size={14} className="shrink-0 text-amber-400" />
              : <Folder size={14} className="shrink-0 text-amber-400" />}
            <span className="truncate text-[var(--ff-text-muted)] group-hover:text-[var(--ff-text)]">{node.name}</span>
          </button>
          {isExpanded && (
            <div role="group">
              {node.children?.map((child) => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    const isActive = activeFile === node.path;
    const menuOpen = menuPath === node.path;
    return (
      <div
        className={cn(
          'group relative flex items-center rounded-md transition-colors',
          isActive ? 'bg-[var(--ff-primary)]/10' : 'hover:bg-[var(--ff-surface-2)]',
          busyPath === node.path && 'opacity-50',
        )}
        data-path={node.path}
        key={node.path}
        onContextMenu={(e) => {
          e.preventDefault();
          setConfirmPath(null);
          setMenuPath(menuOpen ? null : node.path);
        }}
        role="none"
      >
        <button
          aria-current={isActive ? 'true' : undefined}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md py-2 pr-1 text-left text-[13px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ff-primary)]/60 sm:py-1 sm:text-xs"
          onClick={() => openFile(node.path)}
          role="treeitem"
          style={{ paddingLeft: `${depth * 14 + 6 + 14}px` }}
          title={node.path}
          type="button"
        >
          {getFileIcon(node.path)}
          <span
            className={cn(
              'truncate',
              isActive
                ? 'font-medium text-[var(--ff-primary)]'
                : 'text-[var(--ff-text-muted)] group-hover:text-[var(--ff-text)]',
            )}
          >
            {node.name}
          </span>
        </button>
        {/* Visible on hover/focus, always visible on touch (no right-click there). */}
        <button
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={`Actions for ${node.name}`}
          className={cn(
            'mr-1 shrink-0 rounded-md p-1.5 text-[var(--ff-text-dim)] transition-opacity hover:bg-[var(--ff-surface)] hover:text-[var(--ff-text)] focus-visible:opacity-100',
            menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100',
          )}
          onClick={(e) => {
            e.stopPropagation();
            setConfirmPath(null);
            setMenuPath(menuOpen ? null : node.path);
          }}
          type="button"
        >
          <MoreHorizontal size={14} />
        </button>
        {menuOpen && renderMenu(node.path, node.name)}
      </div>
    );
  }

  const hasFiles = fileCount > 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--ff-surface)]">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--ff-border)] px-3 py-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ff-text-dim)]">Files</div>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-[var(--ff-text-muted)]">
            <span className="rounded-full bg-[var(--ff-surface-2)] px-1.5 py-0.5 font-mono tabular-nums">{fileCount}</span>
            <span>{fileCount === 1 ? 'file' : 'files'}</span>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            aria-label="Collapse all folders"
            className="rounded-md p-2 text-[var(--ff-text-dim)] transition-colors hover:bg-[var(--ff-surface-2)] hover:text-[var(--ff-text)] sm:p-1.5"
            onClick={() => setExpanded(new Set())}
            title="Collapse all"
            type="button"
          >
            <ChevronsDownUp size={14} />
          </button>
          <button
            aria-label="Create new file"
            className="rounded-md p-2 text-[var(--ff-text-dim)] transition-colors hover:bg-[var(--ff-surface-2)] hover:text-[var(--ff-text)] disabled:opacity-40 sm:p-1.5"
            disabled={!currentProject}
            onClick={startCreating}
            title="Create new file"
            type="button"
          >
            <FilePlus2 size={14} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="shrink-0 border-b border-[var(--ff-border)] px-2 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ff-text-dim)]" size={12} />
          {/* 16px on mobile prevents iOS zoom-on-focus */}
          <input
            aria-label="Search files"
            className="ff-input w-full py-2 pl-8 pr-8 text-base sm:py-1 sm:text-xs"
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSearch('');
            }}
            placeholder="Search files…"
            ref={searchRef}
            value={search}
          />
          {search && (
            <button
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--ff-text-dim)] transition-colors hover:bg-[var(--ff-surface-2)] hover:text-[var(--ff-text)]"
              onClick={() => setSearch('')}
              type="button"
            >
              <X size={12} />
            </button>
          )}
        </div>
        {filteredFiles && (
          <p aria-live="polite" className="mt-1.5 px-0.5 text-[10px] text-[var(--ff-text-dim)]">
            {filteredFiles.length} match{filteredFiles.length === 1 ? '' : 'es'}
          </p>
        )}
      </div>

      {/* New file row */}
      {creating && (
        <div className="ff-fade-in shrink-0 border-b border-[var(--ff-border)] bg-[var(--ff-surface-2)]/50 px-2 py-2">
          <label className="mb-1 block text-[10px] font-medium text-[var(--ff-text-muted)]" htmlFor="ff-new-file">
            New file path
          </label>
          <input
            aria-invalid={Boolean(newError)}
            className={cn(
              'ff-input w-full py-2 text-base sm:py-1 sm:text-xs',
              newError && 'border-red-400/60',
            )}
            disabled={busyPath !== null}
            id="ff-new-file"
            onChange={(e) => {
              setNewPath(e.target.value);
              setNewError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void submitNewFile();
              }
            }}
            placeholder="lib/screens/profile_screen.dart"
            ref={newFileRef}
            value={newPath}
          />
          {newError && <p className="mt-1 text-[10px] text-red-400" role="alert">{newError}</p>}
          <div className="mt-2 flex gap-1.5">
            <button
              className="flex-1 rounded-md bg-[var(--ff-primary)]/15 px-2 py-2 text-xs font-medium text-[var(--ff-primary)] transition-colors hover:bg-[var(--ff-primary)]/25 disabled:opacity-50 sm:py-1"
              disabled={busyPath !== null || !newPath.trim()}
              onClick={() => void submitNewFile()}
              type="button"
            >
              {busyPath ? 'Creating…' : 'Create'}
            </button>
            <button
              className="flex-1 rounded-md bg-[var(--ff-surface-2)] px-2 py-2 text-xs text-[var(--ff-text-muted)] transition-colors hover:text-[var(--ff-text)] sm:py-1"
              onClick={() => {
                setCreating(false);
                setNewError(null);
              }}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div
        aria-label="Project files"
        className="ff-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 py-1"
        onClick={() => {
          setMenuPath(null);
          setConfirmPath(null);
        }}
        ref={listRef}
        role="tree"
      >
        {!hasFiles ? (
          <div className="flex flex-col items-center px-4 py-12 text-center">
            <FolderTree className="mb-2 size-8 text-[var(--ff-text-dim)] opacity-50" />
            <p className="text-xs font-medium text-[var(--ff-text)]">No files yet</p>
            <p className="mt-1 text-[11px] text-[var(--ff-text-dim)]">
              Generated files appear here, or create one with the + button.
            </p>
          </div>
        ) : filteredFiles ? (
          filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-10 text-center">
              <SearchX className="mb-2 size-7 text-[var(--ff-text-dim)] opacity-60" />
              <p className="text-xs text-[var(--ff-text-muted)]">No files match “{search.trim()}”</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredFiles.map((f) => {
                const name = f.path.split('/').pop() ?? f.path;
                const dir = f.path.split('/').slice(0, -1).join('/');
                const isActive = activeFile === f.path;
                return (
                  <button
                    aria-current={isActive ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ff-primary)]/60 sm:py-1.5',
                      isActive
                        ? 'bg-[var(--ff-primary)]/10 text-[var(--ff-primary)]'
                        : 'text-[var(--ff-text-muted)] hover:bg-[var(--ff-surface-2)] hover:text-[var(--ff-text)]',
                    )}
                    key={f.id}
                    onClick={() => openFile(f.path)}
                    role="treeitem"
                    title={f.path}
                    type="button"
                  >
                    {getFileIcon(f.path)}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] sm:text-xs">
                        <Highlight query={search} text={name} />
                      </span>
                      {dir && (
                        <span className="block truncate font-mono text-[10px] text-[var(--ff-text-dim)]">
                          <Highlight query={search} text={dir} />
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )
        ) : (
          tree.children?.map((child) => renderNode(child, 0))
        )}
      </div>
    </div>
  );
}