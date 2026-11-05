import { promises as fs } from 'node:fs';
import path from 'node:path';

const DESIGN_FILE = '.flutterforge/design.json';
const HEX = /^#[0-9A-Fa-f]{6}$/;

const CURVES = new Set([
  'linear', 'ease', 'easeIn', 'easeOut', 'easeInOut', 'fastOutSlowIn',
  'easeInQuad', 'easeOutQuad', 'easeInOutQuad',
  'easeInCubic', 'easeOutCubic', 'easeInOutCubic',
  'easeInQuart', 'easeOutQuart', 'easeInOutQuart',
  'easeInExpo', 'easeOutExpo', 'easeInOutExpo',
  'easeInBack', 'easeOutBack', 'easeInOutBack',
]);

export interface DesignBrief {
  direction: string;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    ink: string;
    muted: string;
    backgroundDark: string;
    surfaceDark: string;
    inkDark: string;
  };
  typography: {
    display: string;
    body: string;
    mono: string;
    displayWeight: number;
    bodyWeight: number;
  };
  spacing: {
    unit: number;
    scale: number[];
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
    pill: number;
  };
  motion: {
    fastMs: number;
    baseMs: number;
    slowMs: number;
    curve: string;
    style: string;
  };
  voice: {
    tone: string;
    rule: string;
  };
}

function text(value: unknown, fallback: string, max = 240): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.replace(/[\u0000-\u001f\u007f`]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, max) : fallback;
}

function hex(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX.test(value.trim()) ? value.trim().toUpperCase() : fallback;
}

function font(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.replace(/[^A-Za-z0-9 ]/g, '').trim();
  return cleaned || fallback;
}

function number(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

/**
 * Validate an incoming design brief.
 */
export function sanitizeDesignBrief(input: any): DesignBrief | null {
  if (!input || typeof input !== 'object') return null;
  const palette = input.palette ?? {};
  const typography = input.typography ?? {};
  const spacing = input.spacing ?? {};
  const radius = input.radius ?? {};
  const motion = input.motion ?? {};
  const voice = input.voice ?? {};

  const scale = Array.isArray(spacing.scale)
    ? Array.from(new Set<number>(
        spacing.scale
          .map(Number)
          .filter((n: number) => Number.isFinite(n) && n >= 1 && n <= 200)
          .map((n: number) => Math.round(n))
      )).sort((a, b) => a - b)
    : [4, 8, 12, 16, 24, 32, 48];

  return {
    direction: text(input.direction, 'A coherent, professional product direction.'),
    palette: {
      primary: hex(palette.primary, '#02AFB9'),
      secondary: hex(palette.secondary, '#F07067'),
      accent: hex(palette.accent, '#FACC15'),
      background: hex(palette.background, '#FBFADD'),
      surface: hex(palette.surface, '#FFFFFF'),
      ink: hex(palette.ink, '#0B3542'),
      muted: hex(palette.muted, '#5A7178'),
      backgroundDark: hex(palette.backgroundDark, '#0A3542'),
      surfaceDark: hex(palette.surfaceDark, '#124551'),
      inkDark: hex(palette.inkDark, '#F2FAFB'),
    },
    typography: {
      display: font(typography.display, 'Sora'),
      body: font(typography.body, 'Inter'),
      mono: font(typography.mono, 'JetBrains Mono'),
      displayWeight: number(typography.displayWeight, 700, 100, 900),
      bodyWeight: number(typography.bodyWeight, 400, 100, 900),
    },
    spacing: {
      unit: number(spacing.unit, 4, 2, 16),
      scale: scale.length > 0 ? scale : [4, 8, 12, 16, 24, 32, 48],
    },
    radius: {
      sm: number(radius.sm, 8, 0, 40),
      md: number(radius.md, 14, 0, 48),
      lg: number(radius.lg, 24, 0, 64),
      pill: number(radius.pill, 999, 0, 999),
    },
    motion: {
      fastMs: number(motion.fastMs, 120, 50, 400),
      baseMs: number(motion.baseMs, 200, 60, 600),
      slowMs: number(motion.slowMs, 340, 80, 900),
      curve: CURVES.has(motion.curve) ? motion.curve : 'easeOutCubic',
      style: text(motion.style, 'composed', 60),
    },
    voice: {
      tone: text(voice.tone, 'clear, practical', 120),
      rule: text(voice.rule, 'Say what the product does in plain words; skip superlatives.', 240),
    },
  };
}

export async function loadDesignBrief(workspace: string): Promise<DesignBrief | null> {
  try {
    const raw = await fs.readFile(path.join(workspace, DESIGN_FILE), 'utf8');
    return sanitizeDesignBrief(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function saveDesignBrief(workspace: string, brief: DesignBrief): Promise<void> {
  const dir = path.join(workspace, '.flutterforge');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'design.json'), JSON.stringify(brief, null, 2), 'utf8');
}

/** Render the brief as stable instructions for the coding engine. */
export function renderDesignBrief(brief: DesignBrief): string {
  if (!brief) return '';
  const p = brief.palette;
  const t = brief.typography;
  const r = brief.radius;
  const m = brief.motion;
  return `DESIGN CONTRACT (commit to this before writing any screen):
- Direction: ${brief.direction}
- Palette (light): primary ${p.primary}, secondary ${p.secondary}, accent ${p.accent},
  page ${p.background}, surface ${p.surface}, ink ${p.ink}, muted ${p.muted}
- Palette (dark): page ${p.backgroundDark}, surface ${p.surfaceDark}, ink ${p.inkDark}
- Typography: display ${t.display} at weight ${t.displayWeight}, body ${t.body} at
  weight ${t.bodyWeight}, mono ${t.mono}. Use google_fonts.
- Spacing: ${brief.spacing.unit}pt base, scale [${brief.spacing.scale.join(', ')}].
- Radius: sm ${r.sm}, md ${r.md}, lg ${r.lg}, pill ${r.pill}.
- Motion: fast ${m.fastMs}ms, base ${m.baseMs}ms, slow ${m.slowMs}ms, curve ${m.curve} (${m.style}).
- Voice: ${brief.voice.tone}. ${brief.voice.rule}

DESIGN IMPLEMENTATION RULES:
1. Create lib/core/theme/app_theme.dart with an AppTokens class (spacing, radii,
   durations, curve) and light + dark ThemeData built from the palette above.
   Enable Material 3, add Type text styles using GoogleFonts.getTextTheme for the
   display and body families. Card, button and input themes use the radius tokens.
2. Screens read colors from Theme.of(context).colorScheme, type from
   Theme.of(context).textTheme, and spacing from AppTokens. NEVER hardcode a
   Color(0xFF...) or hex value inside a screen or widget.
3. Every screen ships loading (layout-matched shimmer), empty (explanation plus
   the action that fills it) and error (what failed plus retry) states.
4. Use real content from the user's request. No Lorem Ipsum, no "Item 1", no
   placeholder copy.
5. One primary action per screen. Avoid generic AI styling: no purple gradients
   everywhere, no glass cards on every surface, no emoji as icons, no three
   identical icon-and-paragraph cards.`;
}

