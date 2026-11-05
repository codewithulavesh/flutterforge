import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalizeProjectPackage, pruneSupabaseArtifacts } from '../harness/normalize.js';

test('normalizeProjectPackage aligns pubspec and self-imports', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'flutterforge-normalize-'));
  try {
    await fs.mkdir(path.join(root, 'lib'), { recursive: true });
    await fs.writeFile(path.join(root, 'pubspec.yaml'), 'name: calc\ndescription: demo\n', 'utf8');
    await fs.writeFile(path.join(root, 'lib', 'main.dart'), "import 'package:calc/app.dart';\nvoid main() {}\n", 'utf8');
    await fs.writeFile(path.join(root, 'lib', 'app.dart'), "import 'package:calc_old/theme.dart';\n", 'utf8');

    const result = await normalizeProjectPackage(root, 'calc_ab12cd');
    assert.equal(result.oldName, 'calc');
    assert.deepEqual(result.changed.sort(), ['lib/app.dart', 'lib/main.dart', 'pubspec.yaml']);

    assert.match(await fs.readFile(path.join(root, 'pubspec.yaml'), 'utf8'), /^name: calc_ab12cd$/m);
    assert.match(await fs.readFile(path.join(root, 'lib', 'main.dart'), 'utf8'), /package:calc_ab12cd\/app\.dart/);
    assert.match(await fs.readFile(path.join(root, 'lib', 'app.dart'), 'utf8'), /package:calc_ab12cd\/theme\.dart/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('pruneSupabaseArtifacts removes the backend folder for local-only apps', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'flutterforge-prune-'));
  try {
    await fs.mkdir(path.join(root, 'supabase', 'migrations'), { recursive: true });
    await fs.writeFile(path.join(root, 'supabase', 'migrations', '001.sql'), 'select 1;', 'utf8');
    const removed = await pruneSupabaseArtifacts(root);
    assert.deepEqual(removed, ['supabase/']);
    await assert.rejects(fs.access(path.join(root, 'supabase')));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

