import { describe, expect, it } from 'vitest';
import { snapshotDiff, snapshotHash, type FileSnapshot } from './versionDiff';

const snapshot = (files: Record<string, string>): FileSnapshot =>
  Object.fromEntries(Object.entries(files).map(([path, content]) => [path, { content }]));

describe('snapshotDiff', () => {
  it('reports added, removed, and modified files with line counts', () => {
    const before = snapshot({
      'lib/main.dart': 'line one\nline two\n',
      'lib/old.dart': 'gone\n',
    });
    const after = snapshot({
      'lib/main.dart': 'line one\nline two changed\nline three\n',
      'lib/new.dart': 'fresh\n',
    });

    const diff = snapshotDiff(before, after);
    const byPath = new Map(diff.files.map((file) => [file.path, file]));

    expect(diff.files).toHaveLength(3);
    expect(byPath.get('lib/main.dart')?.status).toBe('modified');
    expect(byPath.get('lib/old.dart')?.status).toBe('removed');
    expect(byPath.get('lib/new.dart')?.status).toBe('added');
    expect(diff.additions).toBe(4);
    expect(diff.deletions).toBe(3);
  });

  it('keeps only changed regions plus context in large files', () => {
    const beforeLines = Array.from({ length: 80 }, (_, index) => `const line${index} = ${index};`);
    const afterLines = [...beforeLines];
    afterLines[40] = 'const line40 = 999;';

    const diff = snapshotDiff(
      snapshot({ 'lib/big.dart': beforeLines.join('\n') }),
      snapshot({ 'lib/big.dart': afterLines.join('\n') }),
    );

    const lines = diff.files[0].lines;
    expect(lines.some((line) => line.type === 'gap')).toBe(true);
    expect(lines.filter((line) => line.type === 'add')).toHaveLength(1);
    expect(lines.filter((line) => line.type === 'remove')).toHaveLength(1);
    expect(lines.length).toBeLessThan(beforeLines.length);
  });

  it('returns no files when the snapshots match', () => {
    const value = snapshot({ 'pubspec.yaml': 'name: app\n' });
    expect(snapshotDiff(value, value).files).toHaveLength(0);
  });
});

describe('snapshotHash', () => {
  it('is stable regardless of insertion order and changes with content', () => {
    const first = snapshot({ 'a.dart': 'one', 'b.dart': 'two' });
    const reordered = { 'b.dart': { content: 'two' }, 'a.dart': { content: 'one' } };
    expect(snapshotHash(first)).toBe(snapshotHash(reordered));
    expect(snapshotHash(first)).not.toBe(snapshotHash(snapshot({ 'a.dart': 'one', 'b.dart': 'three' })));
  });
});
