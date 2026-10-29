import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const IS_WINDOWS = process.platform === 'win32';

/**
 * Resolve the Flutter SDK executable. GUI-launched desktop apps do not inherit
 * a login-shell PATH on macOS/Windows, so common install locations are checked
 * before falling back to a PATH lookup.
 * @param {{ env?: NodeJS.ProcessEnv, home?: string }} [options]
 * @returns {string}
 */
export function findFlutter(options = {}) {
  const env = options.env ?? process.env;
  if (env.FLUTTER_BIN) return env.FLUTTER_BIN;

  const home = options.home ?? os.homedir();
  const binary = IS_WINDOWS ? 'flutter.bat' : 'flutter';
  const candidates = [];

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
