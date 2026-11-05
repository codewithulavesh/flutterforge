import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getProjectDataRoot } from '../paths.js';

const IS_WINDOWS = process.platform === 'win32';

export function managedFlutterPath(options: { platform?: string; arch?: string; root?: string; env?: NodeJS.ProcessEnv } = {}): string {
  const platform = options.platform || (process.platform === 'darwin' ? 'macos' : process.platform === 'win32' ? 'windows' : 'linux');
  const arch = options.arch || process.arch;
  const root = options.root || path.join(getProjectDataRoot(), 'toolchains', 'flutter', `${platform}-${arch}`);
  return path.join(root, 'flutter', 'bin', IS_WINDOWS ? 'flutter.bat' : 'flutter');
}

/**
 * Resolve the Flutter SDK executable. GUI-launched desktop apps do not inherit
 * a login-shell PATH on macOS/Windows, so common install locations are checked
 * before falling back to a PATH lookup.
 */
export function findFlutter(options: { env?: NodeJS.ProcessEnv; home?: string } = {}): string {
  const env = options.env ?? process.env;
  if (env.FLUTTER_BIN) return env.FLUTTER_BIN;

  const home = options.home ?? os.homedir();
  const binary = IS_WINDOWS ? 'flutter.bat' : 'flutter';
  const candidates: string[] = [];

  const managed = managedFlutterPath({ env });
  if (existsSync(managed)) candidates.push(managed);

  if (process.platform === 'darwin') {
    candidates.push(
      '/opt/homebrew/bin/flutter',
      '/usr/local/bin/flutter',
      path.join(home, 'development', 'flutter', 'bin', 'flutter'),
      path.join(home, 'flutter', 'bin', 'flutter'),
      path.join(home, 'fvm', 'default', 'bin', 'flutter'),
      path.join(home, 'Applications', 'flutter', 'bin', 'flutter'),
    );
  } else if (IS_WINDOWS) {
    const localAppData = env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const programFiles = env.ProgramFiles || 'C:\\Program Files';
    candidates.push(
      path.join(localAppData, 'flutter', 'bin', binary),
      path.join(programFiles, 'flutter', 'bin', binary),
      'C:\\src\\flutter\\bin\\flutter.bat',
      'C:\\flutter\\bin\\flutter.bat',
      path.join(home, 'flutter', 'bin', binary),
    );
  } else {
    candidates.push(
      path.join(home, 'development', 'flutter', 'bin', 'flutter'),
      path.join(home, 'flutter', 'bin', 'flutter'),
      '/usr/local/bin/flutter',
      '/usr/bin/flutter',
    );
  }

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return 'flutter';
}

export function findDart(options: { env?: NodeJS.ProcessEnv; home?: string } = {}): string {
  const env = options.env ?? process.env;
  if (env.DART_BIN) return env.DART_BIN;
  const flutter = findFlutter(options);
  if (path.isAbsolute(flutter) || flutter.includes(path.sep)) {
    const binary = IS_WINDOWS ? 'dart.exe' : 'dart';
    const bundledDart = path.join(path.dirname(flutter), 'cache', 'dart-sdk', 'bin', binary);
    if (existsSync(bundledDart)) return bundledDart;
  }
  return 'dart';
}

