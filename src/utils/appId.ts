/**
 * Unique Flutter application identity utilities.
 *
 * Every new app MUST get a different id, even when two apps share the same
 * display name. The `name:` field in pubspec.yaml must be a valid,
 * globally-unique Dart package name, and the Android applicationId / iOS
 * bundle id derived from it must also be unique.
 *
 * Format: `<sanitized_name>_<6-char-suffix>` e.g. `food_delivery_a1b2c3`
 * Suffix is derived deterministically from the Supabase project UUID when
 * available, otherwise random — so retries never collide.
 */

function sanitizeSegment(input: string): string {
  const lower = input
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  const stripped = lower.replace(/^[0-9_]+/, '');
  return stripped || 'app';
}

export function toUniqueSlug(appName: string): string {
  const slug = sanitizeSegment(appName).slice(0, 40) || 'app';
  // Dart package names must start with a letter.
  return /^[a-z]/.test(slug) ? slug : `app_${slug}`;
}

function suffixFromSeed(seed?: string): string {
  if (seed) {
    const hex = seed.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (hex.length >= 6) return hex.slice(0, 6);
    if (hex.length > 0) return (hex + '000000').slice(0, 6);
  }
  // crypto.randomUUID is available in all modern browsers + node 19+.
  try {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 6).toLowerCase();
  } catch {
    return Math.random().toString(36).slice(2, 8).toLowerCase().padEnd(6, '0');
  }
}

/** Deterministic unique Dart package name for a project. */
export function generateUniqueAppId(appName: string, projectIdOrSeed?: string): string {
  const slug = toUniqueSlug(appName);
  const suffix = suffixFromSeed(projectIdOrSeed);
  const candidate = `${slug}_${suffix}`;
  // Pub package names: lowercase + underscores, start with letter.
  return sanitizeSegment(candidate).slice(0, 60) || `app_${suffix}`;
}

/** Android applicationId derived from the unique app id. */
export function getAndroidApplicationId(appId: string): string {
  const segment = sanitizeSegment(appId).replace(/^_+/, '') || 'app';
  return `com.flutterforge.${segment}`;
}

/** iOS / macOS bundle identifier derived from the unique app id. */
export function getIosBundleId(appId: string): string {
  const segment = sanitizeSegment(appId).replace(/_/g, '').toLowerCase() || 'app';
  return `com.flutterforge.${segment}`;
}

/**
 * Rewrite (or insert) the `name:` field of a pubspec.yaml with the unique id.
 * Keeps every other line untouched.
 */
export function applyAppIdToPubspec(pubspecContent: string, appId: string): string {
  if (/^name\s*:/m.test(pubspecContent)) {
    return pubspecContent.replace(/^name\s*:.*$/m, `name: ${appId}`);
  }
  return `name: ${appId}\n${pubspecContent}`;
}
