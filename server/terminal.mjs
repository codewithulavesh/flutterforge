import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getProjectWorkspace } from './harness/run.mjs';
import { findFlutter } from './harness/flutter.mjs';
import { runCommand } from './harness/dsh.mjs';
import { resolveInside } from './harness/workspace.mjs';
import { fixInvalidPlainScalars, sanitizeSdkConstraint, sanitizeFlutterConstraint, getToolchainVersions } from './harness/pubspecFix.mjs';

const ALLOWED = new Set(['flutter', 'dart', 'ls', 'pwd', 'cat', 'git', 'help', 'clear']);
const MAX_OUTPUT = 32_000;

/** Split a user command into argv without invoking a shell. */
function tokenize(command) {
  const tokens = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match;
  while ((match = pattern.exec(command)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3] ?? '');
  }
  return tokens;
}

function tail(text, max = MAX_OUTPUT) {
  return text.length > max ? `…${text.slice(-max)}` : text;
}

/**
 * Run a real, allow-listed command inside a project's harness workspace.
 * This is a local desktop tool, but it still never invokes a shell and every
 * file path is confined to the workspace.
 *
 * @param {string} projectId
 * @param {string} command
 * @returns {Promise<{ statusCode: number, body: Record<string, any> }>}
 */
export async function runTerminalCommand(projectId, command) {
  const raw = String(command ?? '').trim();
  if (!raw) return { statusCode: 400, body: { error: 'command is required' } };

  const tokens = tokenize(raw);
  const executable = tokens[0]?.toLowerCase();
  if (!executable || !ALLOWED.has(executable)) {
    return {
      statusCode: 400,
      body: { error: `Command not allowed. Try: flutter analyze, flutter pub get, flutter build web, ls, pwd, cat <file>` },
    };
  }
  if (executable === 'help' || executable === 'clear') {
    return { statusCode: 200, body: { output: '', kind: executable } };
  }

  const workspace = getProjectWorkspace(projectId);
  await fs.mkdir(workspace, { recursive: true });

  // Self-heal an LLM-written pubspec before any command that would fail on
  // invalid YAML (analyze/pub get): quote plain scalars containing ": " and
  // clamp impossible toolchain constraints — same rules as the preview build.
  if (executable === 'flutter' || executable === 'dart') {
    try {
      const pubspecPath = path.join(workspace, 'pubspec.yaml');
      const content = await fs.readFile(pubspecPath, 'utf8');
      const scalarFix = fixInvalidPlainScalars(content);
      let healed = scalarFix.content;
      let notes = [scalarFix.note];
      if (healed !== content) {
        const versions = await getToolchainVersions();
        const sdkFix = sanitizeSdkConstraint(healed, { dartVersion: versions.dartVersion });
        if (sdkFix.changed) healed = sdkFix.content;
        const flutterFix = sanitizeFlutterConstraint(healed, { flutterVersion: versions.flutterVersion });
        if (flutterFix.changed) healed = flutterFix.content;
        notes = [scalarFix.note, sdkFix.note, flutterFix.note];
        await fs.writeFile(pubspecPath, healed, 'utf8');
      }
      for (const note of notes) {
        if (note) console.log(`[terminal] ${note}`);
      }
    } catch {
      // No pubspec (or unreadable) — nothing to heal.
    }
  }

  if (executable === 'pwd') {
    return { statusCode: 200, body: { output: `${workspace}\n`, code: 0 } };
  }
  if (executable === 'ls') {
    const target = tokens[1] && !tokens[1].startsWith('-') ? resolveInside(workspace, tokens[1]) : workspace;
    try {
      const entries = await fs.readdir(target, { withFileTypes: true });
      const output = entries
        .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
        .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
        .join('\n');
      return { statusCode: 200, body: { output: `${output}\n`, code: 0 } };
    } catch (error) {
      return { statusCode: 200, body: { output: `ls: ${error instanceof Error ? error.message : String(error)}\n`, code: 1 } };
    }
  }
  if (executable === 'cat') {
    if (!tokens[1]) return { statusCode: 400, body: { error: 'cat requires a file path' } };
    try {
      const absolute = resolveInside(workspace, tokens[1]);
      const content = await fs.readFile(absolute, 'utf8');
      return { statusCode: 200, body: { output: tail(content), code: 0 } };
    } catch (error) {
      return { statusCode: 200, body: { output: `cat: ${error instanceof Error ? error.message : String(error)}\n`, code: 1 } };
    }
  }

  const binary = executable === 'flutter' ? findFlutter() : executable;
  const args = tokens.slice(1);
  // `flutter build web` is expensive; the preview service owns the warm build.
  if (executable === 'flutter' && args[0] === 'build' && args[1] === 'web') {
    return {
      statusCode: 200,
      body: {
        output: 'Use the Preview tab to build Flutter web (warm runner). Running `flutter analyze` or `flutter pub get` here is supported.\n',
        code: 0,
      },
    };
  }

  const result = await runCommand(binary, args, { cwd: workspace, timeoutMs: 180_000 });
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
  return {
    statusCode: 200,
    body: {
      output: tail(`${output || (result.ok ? '✓ done' : 'Command failed')}\n`),
      code: result.code ?? (result.ok ? 0 : 1),
      timedOut: result.timedOut ?? false,
    },
  };
}
