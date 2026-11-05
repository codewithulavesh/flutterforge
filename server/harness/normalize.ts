import { promises as fs } from 'node:fs';
import path from 'node:path';
import { snapshotFiles } from './workspace.js';

export interface NormalizeResult {
  changed: string[];
  oldName: string;
}

/**
 * Keep the generated package identity stable.
 *
 * A model can pick a different `name:` than the project's unique app id and
 * leave starter imports pointing at the old package. That combination is
 * unbuildable (`package:<other>/...` cannot resolve), so rewrite the pubspec
 * and the known self-import spellings in one pass.
 */
export async function normalizeProjectPackage(root: string, appId: string): Promise<NormalizeResult> {
  const safeAppId = /^[a-z][a-z0-9_]{1,63}$/.test(String(appId ?? '')) ? String(appId) : '';
  if (!safeAppId) return { changed: [], oldName: '' };

  const snapshot = await snapshotFiles(root);
  const pubspec = snapshot.get('pubspec.yaml');
  const oldName = pubspec?.content.match(/^name\s*:\s*([A-Za-z0-9_]+)/m)?.[1] ?? '';
  const baseSlug = safeAppId.replace(/_[a-z0-9]{6}$/i, '');
  // Dependency names are legitimate external packages and must not be
  // rewritten (e.g. `package:provider/`). Everything else that looks like the
  // app's own package — including the starter's older suffixed id — is a
  // self-import that has to follow the pinned pubspec name.
  const dependencies = new Set(
    [...(pubspec?.content ?? '').matchAll(/^ {2}([a-z][a-z0-9_]*):/gm)].map((match) => match[1]),
  );

  const changed: string[] = [];
  for (const [relativePath, entry] of snapshot) {
    let next = entry.content;

    if (relativePath === 'pubspec.yaml') {
      next = entry.content.replace(/^name\s*:.*$/m, `name: ${safeAppId}`);
    } else if (relativePath.endsWith('.dart')) {
      next = next.replace(/package:([A-Za-z0-9_]+)\//g, (full, name) => {
        if (name === safeAppId || dependencies.has(name)) return full;
        if (name === oldName || name === baseSlug || name.startsWith(`${baseSlug}_`)) {
          return `package:${safeAppId}/`;
        }
        return full;
      });
    }

    if (next !== entry.content) {
      const absolute = path.resolve(root, relativePath);
      if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) continue;
      await fs.writeFile(absolute, next, 'utf8');
      changed.push(relativePath);
    }
  }

  return { changed, oldName };
}

/**
 * Remove backend artefacts when the user asked for a local-only app.
 * The prompt already forbids them; this is the deterministic backstop for a
 * model that scaffolds the starter's Supabase folder anyway.
 */
export async function pruneSupabaseArtifacts(root: string): Promise<string[]> {
  const removed: string[] = [];
  const supabaseDir = path.join(root, 'supabase');
  try {
    await fs.access(supabaseDir);
    await fs.rm(supabaseDir, { recursive: true, force: true });
    removed.push('supabase/');
  } catch {
    // no Supabase directory
  }
  return removed;
}
