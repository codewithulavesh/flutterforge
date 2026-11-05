import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureSkills, skillNames } from '../harness/skills.js';
import { snapshotFiles } from '../harness/workspace.js';

test('installs three local skills and adds Supabase only when needed', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'flutterforge-skills-'));
  try {
    const local = await ensureSkills(root, false);
    assert.deepEqual(local.sort(), ['desktop-web-parity', 'flutter-architecture', 'modern-flutter-ui']);
    assert.deepEqual(skillNames(false).sort(), local.sort());

    const withBackend = await ensureSkills(root, true);
    assert.equal(withBackend.length, 4);
    assert.ok(withBackend.includes('supabase-production'));

    const skill = await fs.readFile(path.join(root, '.dsh', 'skills', 'modern-flutter-ui', 'SKILL.md'), 'utf8');
    assert.match(skill, /^---\nname: modern-flutter-ui/m);
    assert.match(skill, /## Every data screen/);

    const snapshot = await snapshotFiles(root);
    assert.equal(snapshot.size, 0);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

