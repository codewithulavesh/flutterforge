import test from 'node:test';
import assert from 'node:assert/strict';
import { diffSnapshots, parseCodeBlocks, safeRelativePath, UnsafePathError } from '../harness/workspace.mjs';
import { validateProject } from '../harness/events.mjs';

test('safeRelativePath accepts project paths', () => {
  assert.equal(safeRelativePath('lib/main.dart'), 'lib/main.dart');
  assert.equal(safeRelativePath('./supabase/migrations/001.sql'), 'supabase/migrations/001.sql');
  assert.equal(safeRelativePath('macos\\Runner\\AppDelegate.swift'), 'macos/Runner/AppDelegate.swift');
});

test('safeRelativePath rejects escapes and bookkeeping', () => {
  for (const bad of ['../secret', 'lib/../../escape', '/etc/passwd', 'C:/Windows/system32', 'C:\\Windows', '.flutterforge/session.json', '']) {
    assert.throws(() => safeRelativePath(bad), UnsafePathError, bad);
  }
});

test('diffSnapshots reports created, modified and deleted files', () => {
  const before = new Map([
    ['a.dart', { content: 'a', hash: '1' }],
    ['b.dart', { content: 'b', hash: '2' }],
  ]);
  const after = new Map([
    ['a.dart', { content: 'a2', hash: '3' }],
    ['c.dart', { content: 'c', hash: '4' }],
  ]);
  const changes = diffSnapshots(before, after);
  assert.deepEqual(changes.map((change) => [change.path, change.action]), [
    ['a.dart', 'modified'],
    ['b.dart', 'deleted'],
    ['c.dart', 'created'],
  ]);
});

test('parseCodeBlocks recovers fenced file answers and ignores unsafe paths', () => {
  const text = [
    '```dart filepath="lib/main.dart"',
    "void main() {}",
    '```',
    '```yaml path="pubspec.yaml"',
    'name: demo',
    '```',
    '```dart filepath="../escape.dart"',
    'bad',
    '```',
  ].join('\n');
  const files = parseCodeBlocks(text);
  assert.equal(files.length, 2);
  assert.equal(files[0].path, 'lib/main.dart');
  assert.equal(files[1].path, 'pubspec.yaml');
});

test('validateProject flags missing entry files and stubs', () => {
  const report = validateProject([
    { path: 'lib/main.dart', content: 'void main() {}' },
    { path: 'lib/stub.dart', content: '// TODO: implement' },
  ]);
  assert.equal(report.isValid, false);
  assert.ok(report.issues.some((issue) => issue.code === 'MISSING_PUBSPEC'));
  assert.ok(report.issues.some((issue) => issue.code === 'STUB_CODE'));

  const clean = validateProject([
    { path: 'pubspec.yaml', content: 'name: demo\n' },
    { path: 'lib/main.dart', content: 'void main() {}\n' },
  ]);
  assert.equal(clean.isValid, true);
});
