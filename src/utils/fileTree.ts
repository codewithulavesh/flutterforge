import type { ProjectFile, TreeNode } from '@/types';

export function buildFileTree(files: ProjectFile[]): TreeNode {
  const root: TreeNode = { name: 'root', path: '', type: 'directory', children: [] };

  const sorted = [...files].sort((a, b) => {
    if (a.is_directory && !b.is_directory) return -1;
    if (!a.is_directory && b.is_directory) return 1;
    return a.path.localeCompare(b.path);
  });

  for (const file of sorted) {
    const parts = file.path.split('/').filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const fullPath = parts.slice(0, i + 1).join('/');

      let child = current.children?.find((c) => c.name === part);
      if (!child) {
        child = {
          name: part,
          path: fullPath,
          type: isLast ? (file.is_directory ? 'directory' : 'file') : 'directory',
          children: file.is_directory || !isLast ? [] : undefined,
          file: isLast && !file.is_directory ? file : undefined,
        };
        current.children?.push(child);
      }
      current = child;
    }
  }

  sortTree(root);
  return root;
}

function sortTree(node: TreeNode): void {
  if (!node.children) return;
  node.children.sort((a, b) => {
    if (a.type === 'directory' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });
  node.children.forEach(sortTree);
}

export function getFileExtension(path: string): string {
  const parts = path.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

export function getFileIcon(type: string): string {
  const ext = type.toLowerCase();
  if (ext === 'dart') return 'FileCode2';
  if (ext === 'yaml' || ext === 'yml') return 'Settings';
  if (ext === 'md') return 'FileText';
  if (ext === 'json') return 'Braces';
  return 'File';
}

export function flattenTree(node: TreeNode): TreeNode[] {
  const result: TreeNode[] = [];
  if (node.type === 'file') result.push(node);
  if (node.children) {
    for (const child of node.children) {
      result.push(...flattenTree(child));
    }
  }
  return result;
}

export function findNodeByPath(node: TreeNode, path: string): TreeNode | null {
  if (node.path === path) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeByPath(child, path);
      if (found) return found;
    }
  }
  return null;
}
