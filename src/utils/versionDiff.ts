export type FileSnapshot = Record<string, { content: string }>;

export type DiffStatus = 'added' | 'removed' | 'modified';

export interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'gap';
  text: string;
  oldLine?: number;
  newLine?: number;
}

export interface FileDiff {
  path: string;
  status: DiffStatus;
  additions: number;
  deletions: number;
  lines: DiffLine[];
}

export interface SnapshotDiff {
  files: FileDiff[];
  additions: number;
  deletions: number;
}

// Above this size an LCS table costs more than the diff is worth; the whole
// file is then reported as replaced so the UI still shows every changed line.
const MAX_LCS_LINES = 1200;
const CONTEXT_LINES = 3;

function splitLines(content: string): string[] {
  if (content === '') return [];
  return content.replace(/\r\n/g, '\n').split('\n');
}

function fullReplace(a: string[], b: string[]): DiffLine[] {
  return [
    ...a.map((text, index) => ({ type: 'remove' as const, text, oldLine: index + 1 })),
    ...b.map((text, index) => ({ type: 'add' as const, text, newLine: index + 1 })),
  ];
}

function condense(lines: DiffLine[]): DiffLine[] {
  const keep = new Array<boolean>(lines.length).fill(false);
  lines.forEach((line, index) => {
    if (line.type === 'context') return;
    for (let offset = -CONTEXT_LINES; offset <= CONTEXT_LINES; offset += 1) {
      const target = index + offset;
      if (target >= 0 && target < lines.length) keep[target] = true;
    }
  });

  const condensed: DiffLine[] = [];
  let skipped = 0;
  lines.forEach((line, index) => {
    if (keep[index]) {
      if (skipped > 0) {
        condensed.push({ type: 'gap', text: `… ${skipped} unchanged ${skipped === 1 ? 'line' : 'lines'}` });
        skipped = 0;
      }
      condensed.push(line);
    } else {
      skipped += 1;
    }
  });
  return condensed;
}

function diffLines(before: string, after: string): DiffLine[] {
  const a = splitLines(before);
  const b = splitLines(after);
  if (a.length > MAX_LCS_LINES || b.length > MAX_LCS_LINES) return fullReplace(a, b);

  const width = b.length + 1;
  const lcs = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lcs[i * width + j] = a[i] === b[j]
        ? lcs[(i + 1) * width + j + 1] + 1
        : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1]);
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      lines.push({ type: 'context', text: a[i], oldLine: i + 1, newLine: j + 1 });
      i += 1;
      j += 1;
    } else if (lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) {
      lines.push({ type: 'remove', text: a[i], oldLine: i + 1 });
      i += 1;
    } else {
      lines.push({ type: 'add', text: b[j], newLine: j + 1 });
      j += 1;
    }
  }
  while (i < a.length) {
    lines.push({ type: 'remove', text: a[i], oldLine: i + 1 });
    i += 1;
  }
  while (j < b.length) {
    lines.push({ type: 'add', text: b[j], newLine: j + 1 });
    j += 1;
  }
  return condense(lines);
}

export function snapshotDiff(before: FileSnapshot, after: FileSnapshot): SnapshotDiff {
  const paths = new Set([...Object.keys(before), ...Object.keys(after)]);
  const files: FileDiff[] = [];
  let additions = 0;
  let deletions = 0;

  for (const path of [...paths].sort()) {
    const beforeContent = before[path]?.content;
    const afterContent = after[path]?.content;
    if (beforeContent === afterContent) continue;

    const status: DiffStatus = beforeContent === undefined
      ? 'added'
      : afterContent === undefined
        ? 'removed'
        : 'modified';
    const lines = diffLines(beforeContent ?? '', afterContent ?? '');
    const fileAdditions = lines.filter((line) => line.type === 'add').length;
    const fileDeletions = lines.filter((line) => line.type === 'remove').length;
    additions += fileAdditions;
    deletions += fileDeletions;
    files.push({ path, status, additions: fileAdditions, deletions: fileDeletions, lines });
  }

  return { files, additions, deletions };
}

/** Stable FNV-1a over paths and contents, used to skip no-op auto-checkpoints. */
export function snapshotHash(snapshot: FileSnapshot): string {
  let hash = 2166136261;
  const feed = (value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
  };
  for (const path of [...Object.keys(snapshot)].sort()) {
    feed(path);
    feed('\u0000');
    feed(snapshot[path].content);
    feed('\u0000');
  }
  return (hash >>> 0).toString(36);
}
