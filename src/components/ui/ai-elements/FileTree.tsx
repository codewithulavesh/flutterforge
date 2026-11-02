import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight,
  FolderOpen,
  File,
  FileCode2,
  FileJson,
  FileText,
  Database,
} from 'lucide-react';
import { cn } from '@/utils/cn';

export interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileTreeNode[];
  status?: 'created' | 'modified' | 'deleted' | 'unchanged';
  language?: string;
}

interface FileTreeProps {
  nodes: FileTreeNode[];
  onFileClick?: (path: string) => void;
  className?: string;
  maxHeight?: string;
}

function getFileIcon(name: string, isDirectory: boolean) {
  if (isDirectory) return <FolderOpen size={13} className="text-amber-400" />;
  if (name.endsWith('.dart')) return <FileCode2 size={13} className="text-cyan-400" />;
  if (name.endsWith('.yaml') || name.endsWith('.yml')) return <FileText size={13} className="text-rose-400" />;
  if (name.endsWith('.json')) return <FileJson size={13} className="text-amber-400" />;
  if (name.endsWith('.sql')) return <Database size={13} className="text-emerald-400" />;
  if (name.endsWith('.md')) return <FileText size={13} className="text-[var(--ff-text-dim)]" />;
  return <File size={13} className="text-[var(--ff-text-dim)]" />;
}

const statusColors: Record<string, string> = {
  created: 'text-emerald-400',
  modified: 'text-amber-400',
  deleted: 'text-red-400 line-through',
  unchanged: 'text-[var(--ff-text-muted)]',
};

const statusBadge: Record<string, { bg: string; text: string; label: string }> = {
  created: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'NEW' },
  modified: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'MOD' },
  deleted: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'DEL' },
};

export function buildFileTree(filePaths: { path: string; status?: string }[]): FileTreeNode[] {
  const root: Record<string, FileTreeNode> = {};

  for (const file of filePaths) {
    const parts = file.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const fullPath = parts.slice(0, i + 1).join('/');
      const isLast = i === parts.length - 1;

      if (!current[part]) {
        current[part] = {
          name: part,
          path: fullPath,
          isDirectory: !isLast,
          children: isLast ? undefined : [],
          status: isLast ? (file.status as FileTreeNode['status']) : undefined,
        };
      }

      if (!isLast) {
        if (!current[part].children) current[part].children = [];
        const childMap: Record<string, FileTreeNode> = {};
        for (const child of current[part].children!) {
          childMap[child.name] = child;
        }
        current = childMap;
        // Ensure child is in parent's array
        const parentChildren = Object.values(root).find(
          (n) => n.path === parts.slice(0, i + 1).join('/'),
        )?.children;
        if (parentChildren && !parentChildren.find((c) => c.path === fullPath)) {
          // This is handled by the next iteration
        }
      }
    }
  }

  // Simpler flat-to-tree approach
  return buildTreeFromPaths(filePaths);
}

function buildTreeFromPaths(files: { path: string; status?: string }[]): FileTreeNode[] {
  const rootNodes: FileTreeNode[] = [];
  const dirMap = new Map<string, FileTreeNode>();

  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));

  for (const file of sorted) {
    const parts = file.path.split('/');

    for (let i = 0; i < parts.length; i++) {
      const fullPath = parts.slice(0, i + 1).join('/');
      const isLast = i === parts.length - 1;

      if (isLast) {
        const node: FileTreeNode = {
          name: parts[i],
          path: fullPath,
          isDirectory: false,
          status: (file.status as FileTreeNode['status']) || 'created',
        };

        if (i === 0) {
          if (!rootNodes.find((n) => n.path === fullPath)) rootNodes.push(node);
        } else {
          const parentPath = parts.slice(0, i).join('/');
          const parent = dirMap.get(parentPath);
          if (parent?.children && !parent.children.find((c) => c.path === fullPath)) {
            parent.children.push(node);
          }
        }
      } else {
        if (!dirMap.has(fullPath)) {
          const dirNode: FileTreeNode = {
            name: parts[i],
            path: fullPath,
            isDirectory: true,
            children: [],
          };
          dirMap.set(fullPath, dirNode);

          if (i === 0) {
            if (!rootNodes.find((n) => n.path === fullPath)) rootNodes.push(dirNode);
          } else {
            const parentPath = parts.slice(0, i).join('/');
            const parent = dirMap.get(parentPath);
            if (parent?.children && !parent.children.find((c) => c.path === fullPath)) {
              parent.children.push(dirNode);
            }
          }
        }
      }
    }
  }

  return rootNodes;
}

export function FileTree({ nodes, onFileClick, className, maxHeight = '280px' }: FileTreeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface)] overflow-hidden',
        className,
      )}
    >
      <div className="px-3 py-2 border-b border-[var(--ff-border)] flex items-center gap-2">
        <FolderOpen size={13} className="text-[var(--ff-primary)]" />
        <span className="text-[11px] font-semibold text-[var(--ff-text)]">
          Project Files
        </span>
        <span className="text-[10px] text-[var(--ff-text-dim)] ml-auto font-mono">
          {countFiles(nodes)} files
        </span>
      </div>
      <div
        className="overflow-y-auto ff-scrollbar px-1 py-1"
        style={{ maxHeight }}
      >
        {nodes.map((node) => (
          <TreeNodeItem
            key={node.path}
            node={node}
            depth={0}
            onFileClick={onFileClick}
          />
        ))}
      </div>
    </motion.div>
  );
}

function countFiles(nodes: FileTreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.isDirectory && node.children) {
      count += countFiles(node.children);
    } else if (!node.isDirectory) {
      count++;
    }
  }
  return count;
}

function TreeNodeItem({
  node,
  depth,
  onFileClick,
}: {
  node: FileTreeNode;
  depth: number;
  onFileClick?: (path: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(depth < 2);

  if (node.isDirectory) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="w-full flex items-center gap-1.5 px-2 py-1 text-[11px] text-[var(--ff-text-muted)] hover:bg-[var(--ff-surface-2)] rounded transition-colors"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <ChevronRight
            size={10}
            className={cn(
              'text-[var(--ff-text-dim)] transition-transform shrink-0',
              isOpen && 'rotate-90',
            )}
          />
          {getFileIcon(node.name, true)}
          <span className="truncate font-medium">{node.name}</span>
        </button>
        <AnimatePresence initial={false}>
          {isOpen && node.children && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              {node.children.map((child) => (
                <TreeNodeItem
                  key={child.path}
                  node={child}
                  depth={depth + 1}
                  onFileClick={onFileClick}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const badge = node.status ? statusBadge[node.status] : null;

  return (
    <button
      type="button"
      onClick={() => onFileClick?.(node.path)}
      className={cn(
        'w-full flex items-center gap-1.5 px-2 py-1 text-[11px] rounded transition-colors',
        'hover:bg-[var(--ff-surface-2)]',
        node.status ? statusColors[node.status] : 'text-[var(--ff-text-muted)]',
      )}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
      title={node.path}
    >
      {getFileIcon(node.name, false)}
      <span className="truncate flex-1 text-left font-mono">{node.name}</span>
      {badge && (
        <span className={cn('text-[8px] px-1 py-0.5 rounded font-semibold tracking-wider shrink-0', badge.bg, badge.text)}>
          {badge.label}
        </span>
      )}
    </button>
  );
}
