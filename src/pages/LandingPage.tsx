import { useEffect, useRef, useState, type AnchorHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Lenis from 'lenis';
import { ArrowRight, ArrowUp, ArrowUpRight, Check, Github, GraduationCap, Moon, Plus, Sun } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import CardNav, { type CardNavItem } from '@/components/CardNav';
import { DesktopArtifact, PreviewArtifact, RepairArtifact, SourceArtifact } from '@/components/landing/WorkbenchPanels';
import { useAuthStore } from '@/stores/auth.store';
import { useThemeStore } from '@/stores/theme.store';
import { HERO_PROMPT_KEY } from '@/utils/landing';
import { cn } from '@/utils/cn';

/* ════════════════════════════════════════════════════════════════════
   SMOOTH SCROLL ENGINE (Lenis)
   ════════════════════════════════════════════════════════════════════ */

type ScrollInfo = { scroll: number; progress: number; velocity: number };
type ScrollListener = (info: ScrollInfo) => void;

let lenisInstance: Lenis | null = null;
const scrollListeners = new Set<ScrollListener>();

const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

function subscribeScroll(fn: ScrollListener) {
  scrollListeners.add(fn);
  return () => {
    scrollListeners.delete(fn);
  };
}

function emitScroll(velocity = 0) {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const scroll = window.scrollY;
  const progress = max > 0 ? Math.min(1, Math.max(0, scroll / max)) : 0;
  scrollListeners.forEach((fn) => fn({ scroll, progress, velocity }));
}

/** Glide to a selector / element / pixel offset. Falls back to native smooth scroll. */
function scrollToTarget(target: string | HTMLElement | number, offset = -16) {
  if (lenisInstance) {
    // Short hops settle fast; long jumps never drag past ~1.1s.
    const distance =
      typeof target === 'number'
        ? Math.abs(target - window.scrollY)
        : Math.abs((typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target)?.getBoundingClientRect().top ?? 0);
    const duration = Math.min(1.1, 0.55 + distance / 4000);
    lenisInstance.scrollTo(target, { offset, duration, easing: easeOutExpo });
    return;
  }
  if (typeof target === 'number') {
    window.scrollTo({ top: target, behavior: 'smooth' });
    return;
  }
  const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target;
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + offset, behavior: 'smooth' });
}

function useSmoothScroll() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      const onScroll = () => emitScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      emitScroll();
      return () => window.removeEventListener('scroll', onScroll);
    }

    const lenis = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.15,
      anchors: false,
    });
    lenisInstance = lenis;
    lenis.on('scroll', (e: { velocity: number }) => {
      emitScroll(e.velocity);
    });

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // Route in-page #hash links through Lenis so they glide too.
    const onClick = (event: MouseEvent) => {
      const a = (event.target as HTMLElement).closest?.('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const hash = a.getAttribute('href');
      if (!hash || hash === '#') return;
      const el = document.querySelector<HTMLElement>(hash);
      if (!el) return;
      event.preventDefault();
      scrollToTarget(el, window.innerWidth < 1024 ? -72 : -16);
      history.replaceState(null, '', hash);
    };
    document.addEventListener('click', onClick);

    // Re-measure when content height changes; coalesce bursts into one frame.
    let measure = 0;
    const ro = new ResizeObserver(() => {
      if (measure) return;
      measure = requestAnimationFrame(() => {
        measure = 0;
        lenis.resize();
      });
    });
    ro.observe(document.body);
    emitScroll();

    return () => {
      document.removeEventListener('click', onClick);
      ro.disconnect();
      if (measure) cancelAnimationFrame(measure);
      cancelAnimationFrame(raf);
      lenis.destroy();
      lenisInstance = null;
    };
  }, []);
}

const SCROLL_CSS = `
html.lenis, html.lenis body { height: auto; }
.lenis.lenis-smooth { scroll-behavior: auto !important; }
.lenis.lenis-smooth [data-lenis-prevent] { overscroll-behavior: contain; }
.lenis.lenis-stopped { overflow: clip; }

.ff-totop {
  opacity: 0;
  transform: translateY(10px);
  pointer-events: none;
  transition: opacity .3s ease, transform .3s cubic-bezier(0.16, 1, 0.3, 1);
}
.ff-totop.is-shown { opacity: 1; transform: none; pointer-events: auto; }

@media (prefers-reduced-motion: reduce) {
  .ff-totop { transition: none; }
}
`;

function ScrollStyles() {
  return <style>{SCROLL_CSS}</style>;
}

/** Thin ink bar pinned to the top that tracks page scroll progress. */
function ScrollProgress() {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      subscribeScroll(({ progress }) => {
        if (bar.current) bar.current.style.transform = `scaleX(${progress})`;
      }),
    [],
  );
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[2px]" aria-hidden>
      <div
        ref={bar}
        className="h-full origin-left bg-[var(--ff-accent-ink)] will-change-transform"
        style={{ transform: 'scaleX(0)' }}
      />
    </div>
  );
}

function useScrolledPast(px = 760) {
  const [past, setPast] = useState(false);
  const pastRef = useRef(false);
  useEffect(() => {
    const update = ({ scroll }: ScrollInfo) => {
      const next = scroll > px;
      if (next === pastRef.current) return;
      pastRef.current = next;
      setPast(next);
    };
    update({ scroll: window.scrollY, progress: 0, velocity: 0 });
    return subscribeScroll(update);
  }, [px]);
  return past;
}

/** Publishes normalized pointer position as --pt-x / --pt-y, eased per frame. */
function usePointerField<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!fine.matches || reduced.matches) return;

    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;

    const tick = () => {
      x += (targetX - x) * 0.16;
      y += (targetY - y) * 0.16;
      el.style.setProperty('--pt-x', x.toFixed(4));
      el.style.setProperty('--pt-y', y.toFixed(4));
      if (Math.abs(targetX - x) > 0.0005 || Math.abs(targetY - y) > 0.0005) {
        frame = requestAnimationFrame(tick);
      } else {
        frame = 0;
      }
    };
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const move = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      targetX = (event.clientX - rect.left) / rect.width - 0.5;
      targetY = (event.clientY - rect.top) / rect.height - 0.5;
      kick();
    };
    const reset = () => {
      targetX = 0;
      targetY = 0;
      kick();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', reset);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', reset);
    };
  }, []);
  return ref;
}

/** Fade-up when the element first scrolls into view. */
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    // Already on screen (e.g. above the fold) — show immediately.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn('ff-reveal', visible && 'is-visible', className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   PAGE DATA
   ════════════════════════════════════════════════════════════════════ */

const H2 =
  'ff-display mt-5 text-[32px] font-semibold leading-[1.02] tracking-[-0.045em] text-[var(--ff-text)] sm:text-[40px] lg:text-[46px]';

const SPECS = [
  ['01', 'Real files on disk', 'pubspec · Dart · SQL'],
  ['02', 'Local preview', 'flutter run -d web-server'],
  ['03', 'Two-round repair', 'analyze → patch → rebuild'],
  ['04', 'Desktop targets', 'macOS · Windows'],
] as const;

const STEPS = [
  {
    number: '01',
    title: 'Describe the app',
    copy: 'A sentence or a full brief. Pick web, mobile or desktop, and add Supabase only if the app truly needs shared data.',
    file: 'build.intent',
    log: [
      '$ ff brief "habit tracker, weekly goals"',
      'targets    web · mobile',
      'backend    none required',
      'plan       screens, state, theme',
    ],
  },
  {
    number: '02',
    title: 'Generate the project',
    copy: 'FlutterForge writes an editable project: Dart screens, supporting files, and backend pieces only when the brief calls for them.',
    file: 'lib/main.dart',
    log: [
      '$ ff scaffold habit_tracker',
      'created    pubspec.yaml',
      'created    lib/main.dart',
      'created    lib/screens/home_screen.dart',
      '+ 9 more files',
    ],
  },
  {
    number: '03',
    title: 'Compile and repair',
    copy: 'Flutter compiles the project. Compiler errors are fed back to the agent, patched and rebuilt twice before you are asked to look.',
    file: 'flutter analyze',
    log: [
      '$ flutter analyze',
      'error • home_screen.dart:42',
      'repair pass 1/2 applied',
      '✓ patched · rebuilding',
    ],
  },
  {
    number: '04',
    title: 'Preview, edit, export',
    copy: 'Use the live preview, the editor and the terminal. Export a runnable ZIP or add macOS and Windows runners when you are ready.',
    file: 'export/',
    log: [
      '$ ff export --target web',
      'bundling 12 source files',
      '✓ preview ready · 2.1s',
      '✓ project exported',
    ],
  },
];

const CHAPTERS = [
  {
    index: '01',
    kicker: 'Source',
    title: 'The source is the deliverable.',
    copy: 'Every screen is a Dart file you can open, edit and version. No locked canvas, no proprietary project format.',
    bullets: ['Readable widget tree', 'Plain pubspec and assets', 'Git-friendly from day one'],
    Artifact: SourceArtifact,
  },
  {
    index: '02',
    kicker: 'Preview',
    title: 'A preview you can actually use.',
    copy: 'The running web build sits beside the code. Change a layout, rebuild, and check the same screen without leaving the workspace.',
    bullets: ['Live Flutter web preview', 'Desktop and phone viewport checks', 'State stays local'],
    Artifact: PreviewArtifact,
  },
  {
    index: '03',
    kicker: 'Repair',
    title: 'Errors come back to the builder.',
    copy: 'Compiler output is not dumped in a log you have to interpret. It returns to the agent with the active file and project context, then the build is repaired.',
    bullets: ['Two automatic repair rounds', 'Patches applied to real files', 'Clean analyze before you review'],
    Artifact: RepairArtifact,
  },
] as const;

const TARGETS = [
  { target: 'Web preview', detail: 'flutter run -d web-server', state: 'Ready' },
  { target: 'macOS', detail: 'Runner folder prepared', state: 'Export' },
  { target: 'Windows', detail: 'Runner folder prepared', state: 'Export' },
] as const;

const FAQS = [
  {
    q: 'Do I need Flutter installed?',
    a: 'No manual install is needed for web preview. FlutterForge reuses a compatible SDK if you have one, or downloads the official stable SDK on first preview. That first setup needs internet access and disk space. Android and iOS builds still need their platform toolchains.',
  },
  {
    q: 'Where does the AI run?',
    a: 'The workspace and Flutter preview run on your computer. Prompts and relevant project context are sent to the AI provider configured for your account or deployment.',
  },
  {
    q: 'Is Supabase required?',
    a: 'No. Auto mode checks whether the request needs accounts, shared data, realtime or commerce. A calculator or timer is generated as a local-only app.',
  },
  {
    q: 'What happens when code does not compile?',
    a: 'The preview compiler reports the errors, the agent receives them with the active file and build context, and it repairs the project. Two automatic repair rounds are attempted.',
  },
  {
    q: 'Can I ship the generated app?',
    a: 'Export the editable Flutter project and build it with the toolchain for your target. FlutterForge can prepare macOS and Windows runner folders; signing and store submission remain part of your release process.',
  },
];

const TEAM = [
  { name: 'Shradha Takkekar', role: 'Full-stack & UX architecture', focus: 'Flutter UI · design system' },
  { name: 'Srushti Churamari', role: 'Compiler & runtime pipeline', focus: 'Build diagnostics · web runner' },
  { name: 'Vijeta Kotnikallamath', role: 'AI agent & context synthesis', focus: 'Prompts · project memory' },
  { name: 'Ulavayya Karaguppi', role: 'Core engine & desktop bridge', focus: 'Harness · export targets' },
];

const EXAMPLE_PROMPTS = [
  {
    label: 'Personal finance',
    prompt: 'Build a personal finance app with category budgets, a monthly spending chart, and recurring bills.',
  },
  {
    label: 'Recipe planner',
    prompt: 'Create a recipe planner with a weekly meal calendar, grocery list, and dietary filters.',
  },
  {
    label: 'Fitness tracker',
    prompt: 'Design a fitness habit tracker with weekly progress, workout cards, and streaks.',
  },
];

const HERO_TABS = [
  { id: 'preview', label: 'Preview' },
  { id: 'source', label: 'Source' },
  { id: 'build', label: 'Build log' },
] as const;

const PROCESS_TAPE = ['Brief', 'Scaffold', 'Analyze', 'Repair', 'Preview', 'Export'] as const;

type HeroTab = (typeof HERO_TABS)[number]['id'];

function SectionLabel({
  index,
  children,
  className,
}: {
  index: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="ff-kicker text-[var(--ff-accent-ink)]">{index}</span>
      <span aria-hidden className="ff-rule-draw h-px w-8 bg-[var(--ff-rule-strong)]" />
      <span className="ff-kicker">{children}</span>
    </div>
  );
}

function FooterCol({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="ff-kicker flex items-center gap-2">
        <span aria-hidden className="h-[3px] w-[3px] rounded-full bg-[var(--ff-accent-ink)]" />
        {title}
      </p>
      <ul className="mt-3 flex flex-col gap-0.5 sm:mt-4 sm:gap-2.5">{children}</ul>
    </div>
  );
}

/** Footer rows keep a 44px tap target on phones, then tighten to a text line. */
function footerLinkClass(extra?: string) {
  return cn('ff-text-link inline-flex min-h-11 items-center text-left text-[12px] sm:min-h-0', extra);
}

/** Routes in-app links through the router while keeping hash anchors native. */
function NavAnchor({ href, children, ...props }: { href?: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (!href || href.startsWith('#')) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  }
  return (
    <Link to={href} {...props}>
      {children}
    </Link>
  );
}

/* ════════════════════════════════════════════════════════════════════
   LANDING PAGE
   ════════════════════════════════════════════════════════════════════ */

/** Gridded work surface behind the hero; plates sit on top of it. */
function MatBackdrop() {
  return (
    <div className="ff-mat" aria-hidden>
      <div className="ff-mat-plane" />
      <span className="ff-mat-cross bottom-[19%] left-[5%]" />
      <span className="ff-mat-cross bottom-[36%] right-[7%] hidden sm:block" />
      <span className="ff-mat-cross bottom-[8%] left-[41%] hidden md:block" />
    </div>
  );
}

export function LandingPage() {
  const navigate = useNavigate();
  const session = useAuthStore((s) => s.session);
  const { theme, toggle } = useThemeStore();
  const isDark = theme === 'dark';
  const [prompt, setPrompt] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [heroTab, setHeroTab] = useState<HeroTab>('preview');
  const [forging, setForging] = useState(false);
  const [forgeLines, setForgeLines] = useState<HeroLogLine[]>([]);
  const forgeTimers = useRef<number[]>([]);
  const matRef = usePointerField<HTMLElement>();
  const plateRef = usePointerField<HTMLElement>();

  useSmoothScroll();
  const showTop = useScrolledPast();
  const stuck = useScrolledPast(8);

  useEffect(() => {
    return () => {
      forgeTimers.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  function submitPrompt() {
    const text = prompt.trim();
    if (!text || forging) return;
    try {
      sessionStorage.setItem(HERO_PROMPT_KEY, text);
    } catch {
      // storage unavailable — navigation state still carries the prompt
    }

    const target = session ? '/dashboard' : '/signup';
    const navigateToWorkspace = () => navigate(target, { state: { heroPrompt: text } });

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      navigateToWorkspace();
      return;
    }

    const short = text.length > 54 ? `${text.slice(0, 51)}…` : text;
    const sequence: HeroLogLine[] = [
      { tone: 'prompt', text: `$ ff brief "${short}"` },
      { tone: 'dim', text: 'planning screens, state, theme' },
      { tone: 'ok', text: '✓ wrote lib/main.dart' },
      { tone: 'ok', text: '✓ wrote lib/screens/home_screen.dart' },
      { tone: 'prompt', text: '$ flutter analyze' },
      { tone: 'ok', text: '✓ no issues · preview ready' },
    ];

    setForging(true);
    setHeroTab('build');
    setForgeLines([]);

    sequence.forEach((line, index) => {
      forgeTimers.current.push(
        window.setTimeout(() => setForgeLines((previous) => [...previous, line]), 240 + index * 240),
      );
    });
    forgeTimers.current.push(
      window.setTimeout(navigateToWorkspace, 240 + sequence.length * 240 + 620),
    );
  }

  function scrollToSection(id: string) {
    scrollToTarget(`#${id}`, window.innerWidth < 1024 ? -72 : -16);
  }

  const authLabel = session ? 'Dashboard' : 'Sign in';
  const workspaceHref = session ? '/dashboard' : '/signup';

  const navStyle = {
    '--cn-solid': isDark ? '#142126' : '#f7f2e4',
    '--cn-panel': isDark ? '#142126' : '#f7f2e4',
    '--cn-edge': isDark ? 'rgba(242,246,243,0.14)' : 'rgba(16,36,31,0.16)',
    '--cn-highlight': isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.85)',
    '--cn-shadow': isDark ? '0 8px 32px -20px rgba(0,0,0,0.8)' : '0 8px 32px -24px rgba(16,36,31,0.4)',
    '--cn-text': isDark ? '#f2f6f3' : '#10241f',
    '--cn-muted': isDark ? 'rgba(242,246,243,0.62)' : 'rgba(16,36,31,0.62)',
    '--cn-hover': isDark ? 'rgba(255,255,255,0.06)' : 'rgba(16,36,31,0.05)',
    '--cn-ring': isDark ? 'rgba(95,214,214,0.7)' : 'rgba(8,102,109,0.6)',
    '--cn-tile': isDark ? '#1a2a2f' : '#fffdf6',
    '--cn-tile-rim': isDark
      ? 'inset 0 0 0 1px rgba(255,255,255,0.06), 0 2px 8px -4px rgba(0,0,0,0.5)'
      : 'inset 0 0 0 1px rgba(16,36,31,0.12)',
    '--cn-cta': isDark ? '#f2f6f3' : '#10241f',
    '--cn-cta-ink': isDark ? '#0b1416' : '#f7f2e4',
    '--cn-cta-shadow': 'none',
    '--cn-cta-hover': isDark ? 'brightness(0.92)' : 'brightness(1.18)',
    '--cn-radius': '10px',
  } as CSSProperties;

  const navItems: CardNavItem[] = [
    {
      label: 'Build',
      description: 'From a prompt to a running Flutter app.',
      links: [
        { label: 'How it works', href: '#workflow' },
        { label: 'Workbench', href: '#product' },
        { label: 'Live preview', href: '#hero' },
      ],
    },
    {
      label: 'Ship',
      description: 'Real Flutter files, desktop targets, honest answers.',
      links: [
        { label: 'Desktop export', href: '#desktop' },
        { label: 'FAQ', href: '#faq' },
        { label: 'Project team', href: '#team' },
      ],
    },
    {
      label: 'Account',
      description: session ? 'Jump back into your workspace.' : 'Sign in to keep projects in sync.',
      links: [{ label: authLabel, href: session ? '/dashboard' : '/login' }],
    },
  ];

  const active = STEPS[activeStep];

  return (
    <div className="ff-brand ff-studio ff-landing min-h-screen bg-[var(--ff-bg)] text-[var(--ff-text)]">
      <ScrollStyles />
      <ScrollProgress />

      {/* ── Masthead ─────────────────────────────────────────────────── */}
      <header
        className={cn(
          'sticky top-0 z-40 border-b border-[var(--ff-rule)] bg-[var(--ff-bg)] px-3 py-2.5 transition-[box-shadow,border-color] duration-300 sm:px-6',
          stuck && 'border-[var(--ff-rule-strong)] shadow-[0_18px_36px_-32px_rgba(16,36,31,0.55)]',
        )}
      >
        <div className="mx-auto flex max-w-[1440px] items-center gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <CardNav
              logo={
                <span className="flex h-6 items-center gap-2.5">
                  <BrandLogo size={24} />
                  <span className="ff-display whitespace-nowrap text-[15px] font-semibold tracking-tight">FlutterForge</span>
                </span>
              }
              logoAlt="FlutterForge home"
              logoHref="/"
              items={navItems}
              cta={{
                label: session ? 'Open dashboard' : 'Start building',
                href: workspaceHref,
              }}
              theme={isDark ? 'dark' : 'light'}
              surface="solid"
              openOn="click"
              cardEffect="rise"
              cardHeight={150}
              maxWidth={1280}
              linkComponent={NavAnchor}
              ariaLabel="Main navigation"
              style={navStyle}
            />
          </div>
          <button
            type="button"
            onClick={toggle}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] border border-[var(--ff-rule-strong)] bg-transparent text-[var(--ff-text-muted)] transition-colors hover:border-[var(--ff-accent-ink)] hover:text-[var(--ff-accent-ink)] sm:h-10 sm:w-10"
            aria-label={isDark ? 'Switch to light appearance' : 'Switch to dark appearance'}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      <main>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section
          id="hero"
          ref={matRef}
          className="relative scroll-mt-20 overflow-hidden border-b border-[var(--ff-rule)]"
        >
          <div className="ff-draft-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden />
          <MatBackdrop />

          <div className="relative mx-auto max-w-[1440px] px-4 pb-14 pt-8 sm:px-6 sm:pt-10 lg:px-10 lg:pb-20 lg:pt-12">
            <div className="grid items-start gap-12 lg:grid-cols-12 lg:gap-12">
              <div className="lg:col-span-5">
                <div className="flex items-center justify-between gap-4 border-b border-[var(--ff-rule)] pb-3">
                  <SectionLabel index="01">A local Flutter studio</SectionLabel>
                  <span className="ff-kicker hidden sm:block">Vol. 01 · 2026</span>
                </div>

                <h1 className="ff-display mt-8 text-[clamp(40px,12.6vw,50px)] font-semibold leading-[0.92] tracking-[-0.05em] text-[var(--ff-text)] sm:text-[68px] lg:text-[clamp(56px,5.1vw,82px)]">
                  <span className="ff-line-clip">
                    <span className="ff-line">Make the idea.</span>
                  </span>
                  <span className="ff-line-clip">
                    <span className="ff-line" style={{ animationDelay: '120ms' }}>
                      <span className="ff-serif italic text-[var(--ff-accent-ink)]">Run the app.</span>
                    </span>
                  </span>
                </h1>

                <p
                  className="ff-enter mt-6 max-w-[35rem] text-[15px] leading-[1.75] text-[var(--ff-text-muted)] sm:text-[15.5px]"
                  style={{ animationDelay: '90ms' }}
                >
                  A Flutter studio with an AI pair builder, readable source files and a live preview in one workspace. Shape the
                  idea, inspect every change, and keep the project on your own machine.
                </p>

                <div className="ff-enter mt-7 flex flex-wrap items-center gap-3" style={{ animationDelay: '150ms' }}>
                  <Link to={workspaceHref} className="ff-ink-button group h-11 px-5 text-[12.5px]">
                    {session ? 'Open dashboard' : 'Start building'}
                    <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-0.5" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => scrollToSection('workflow')}
                    className="ff-outline-button h-11 px-5 text-[12.5px]"
                  >
                    See the build loop
                  </button>
                </div>

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitPrompt();
                  }}
                  className="ff-enter mt-9 max-w-xl"
                  style={{ animationDelay: '210ms' }}
                >
                  <div className="flex items-baseline justify-between gap-4 border-b border-[var(--ff-rule)] pb-2">
                    <label htmlFor="hero-prompt" className="ff-kicker text-[var(--ff-text-muted)]">
                      Or start from a brief
                    </label>
                    <span className="ff-kicker" aria-hidden>
                      {prompt.length} / 2000
                    </span>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 border border-[var(--ff-rule-strong)] bg-[var(--ff-surface)] p-2 transition-colors focus-within:border-[var(--ff-accent-ink)] sm:flex-row sm:items-center sm:p-1.5 sm:pl-3">
                    <input
                      id="hero-prompt"
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      maxLength={2000}
                      placeholder="A habit tracker with weekly goals"
                      className="min-w-0 flex-1 bg-transparent px-1 py-2 text-[13px] text-[var(--ff-text)] outline-none placeholder:text-[var(--ff-text-dim)] sm:px-0"
                    />
                    <button
                      type="submit"
                      disabled={!prompt.trim() || forging}
                      aria-busy={forging}
                      className={cn(
                        'ff-ink-button h-11 w-full shrink-0 px-3.5 text-[11.5px] sm:h-10 sm:w-auto lg:h-9',
                        forging ? 'cursor-progress' : 'disabled:pointer-events-none disabled:opacity-35',
                      )}
                      aria-label="Generate a project from this brief"
                    >
                      {forging ? (
                        <>
                          Forging
                          <span className="ff-spinner" aria-hidden />
                        </>
                      ) : (
                        <>
                          Generate
                          <ArrowRight size={13} />
                        </>
                      )}
                    </button>
                  </div>
                  <p className="ff-kicker mt-2 min-h-[14px] text-[var(--ff-accent-ink)]" aria-live="polite">
                    {forging ? 'Writing Dart files and running flutter analyze…' : ''}
                  </p>
                </form>

                <div className="ff-enter mt-2 flex flex-wrap items-center gap-2" style={{ animationDelay: '250ms' }}>
                  <span className="ff-kicker basis-full sm:mr-1 sm:basis-auto">Try an idea</span>
                  {EXAMPLE_PROMPTS.map((example) => {
                    const selected = prompt === example.prompt;
                    return (
                      <button
                        key={example.label}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setPrompt(example.prompt);
                          requestAnimationFrame(() => document.getElementById('hero-prompt')?.focus());
                        }}
                        className={cn(
                          'relative h-10 rounded-full border px-3.5 text-[11px] transition-colors after:absolute after:-inset-y-1',
                          selected
                            ? 'border-[var(--ff-accent-ink)] bg-[var(--ff-accent-ink)] text-white'
                            : 'border-[var(--ff-rule-strong)] text-[var(--ff-text-muted)] hover:border-[var(--ff-text)] hover:text-[var(--ff-text)]',
                        )}
                      >
                        {example.label}
                      </button>
                    );
                  })}
                </div>

                <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--ff-rule)] pt-4 text-[11px] text-[var(--ff-text-dim)]">
                  {['No Flutter install for web preview', 'Source stays on your machine', 'Export any time'].map((item) => (
                    <li key={item} className="flex items-center gap-1.5">
                      <Check size={11} className="text-[var(--ff-accent-ink)]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Plate 01 — workspace */}
              <figure ref={plateRef} className="ff-settle min-w-0 lg:col-span-7">
                <div className="mb-2 flex items-end justify-between gap-4">
                  <span className="ff-kicker">Plate 01 — the workspace</span>
                  <span className="ff-kicker hidden sm:block">build 042 · local</span>
                </div>

                <div className="ff-plate-stage">
                  <div className="ff-plate-tilt">
                    <div className="ff-plate-stack">
                      <span className="ff-sheet ff-sheet-1" aria-hidden />
                      <span className="ff-sheet ff-sheet-2" aria-hidden />
                      <div className="ff-plate overflow-hidden">
                        <div className="flex items-center gap-3 border-b border-[var(--ff-rule)] px-3 py-2 sm:px-4">
                          <div className="hidden items-center gap-1.5 sm:flex" aria-hidden>
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--ff-rule-strong)]" />
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--ff-rule-strong)]" />
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--ff-rule-strong)]" />
                          </div>
                          <span className="hidden font-mono text-[9.5px] text-[var(--ff-text-dim)] sm:inline">habit.local</span>
                          <div className="ml-auto flex items-center" role="tablist" aria-label="Workspace view">
                            {HERO_TABS.map((tab) => (
                              <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                id={`hero-tab-${tab.id}`}
                                aria-selected={heroTab === tab.id}
                                aria-controls={`hero-panel-${tab.id}`}
                                onClick={() => setHeroTab(tab.id)}
                                className={cn(
                                  'border-b-2 px-2.5 py-1.5 font-mono text-[8.5px] uppercase tracking-[0.12em] transition-colors',
                                  heroTab === tab.id
                                    ? 'border-[var(--ff-accent-ink)] text-[var(--ff-text)]'
                                    : 'border-transparent text-[var(--ff-text-dim)] hover:text-[var(--ff-text)]',
                                )}
                              >
                                {tab.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div
                          key={heroTab}
                          id={`hero-panel-${heroTab}`}
                          role="tabpanel"
                          aria-labelledby={`hero-tab-${heroTab}`}
                          className="ff-swap min-h-[400px] sm:min-h-[440px]"
                        >
                          {heroTab === 'preview' ? <ProductWindow /> : null}
                          {heroTab === 'source' ? <HeroSource /> : null}
                          {heroTab === 'build' ? <HeroBuildLog lines={forging ? forgeLines : HERO_LOG} running={forging} /> : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <figcaption className="mt-3 flex items-start justify-between gap-4 border-t border-[var(--ff-rule)] pt-2.5">
                  <span className="text-[11.5px] leading-relaxed text-[var(--ff-text-muted)]">
                    Three views of one project — switch tabs to inspect the source, preview and build log.
                  </span>
                  <span className="ff-kicker shrink-0">Fig. 1</span>
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        {/* ── Spec strip ───────────────────────────────────────────────── */}
        <section aria-label="At a glance" className="border-b border-[var(--ff-rule)]">
          <dl className="mx-auto grid max-w-[1440px] grid-cols-1 gap-px bg-[var(--ff-rule)] sm:grid-cols-2 lg:grid-cols-4">
            {SPECS.map(([index, title, meta]) => (
              <div
                key={index}
                className="flex items-baseline gap-4 bg-[var(--ff-bg)] px-5 py-5 transition-colors duration-200 hover:bg-[var(--ff-surface)] sm:px-6 lg:px-8 lg:py-6"
              >
                <span className="ff-kicker text-[var(--ff-accent-ink)]">{index}</span>
                <div className="min-w-0">
                  <dt className="text-[12.5px] font-semibold text-[var(--ff-text)]">{title}</dt>
                  <dd className="mt-1 truncate font-mono text-[10px] text-[var(--ff-text-dim)]">{meta}</dd>
                </div>
              </div>
            ))}
          </dl>
        </section>

        {/* ── Process tape ─────────────────────────────────────────────── */}
        <div aria-hidden className="ff-tape select-none overflow-hidden border-b border-[var(--ff-rule)] bg-[var(--ff-bg)]">
          <div className="ff-tape-track flex w-max items-center py-2.5">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex min-w-[100vw] shrink-0 items-center justify-around">
                {[0, 1, 2, 3].map((pass) => (
                  <div key={pass} className="flex shrink-0 items-center">
                    {PROCESS_TAPE.map((word) => (
                      <span key={word} className="flex items-center">
                        <span className="ff-kicker px-4 text-[var(--ff-text-dim)]">{word}</span>
                        <span className="h-1 w-1 rounded-full bg-[var(--ff-accent-ink)]" />
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── Build ledger ─────────────────────────────────────────────── */}
        <section id="workflow" className="scroll-mt-24 border-b border-[var(--ff-rule)]">
          <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
              <Reveal className="lg:col-span-5">
                <SectionLabel index="02">The build</SectionLabel>
                <h2 className={H2}>
                  Four stages.
                  <br />
                  <span className="ff-serif italic text-[var(--ff-accent-ink)]">No hidden steps.</span>
                </h2>
                <p className="mt-5 max-w-md text-[14px] leading-relaxed text-[var(--ff-text-muted)]">
                  The loop is visible on purpose. Every compiler error is captured, patched and rebuilt before the preview asks
                  for your attention.
                </p>

                <div className="mt-8 border border-[var(--ff-rule)] bg-[var(--ff-surface)] p-4">
                  <p className="ff-kicker text-[var(--ff-accent-ink)]">Note on repair</p>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--ff-text-muted)]">
                    Two automatic rounds. If the project still does not analyze cleanly, the workspace stops and shows you the
                    exact file and error instead of guessing again.
                  </p>
                </div>
              </Reveal>

              <Reveal delay={80} className="lg:col-span-7">
                <ol className="border-t border-[var(--ff-rule)]">
                  {STEPS.map((step, index) => {
                    const isActive = index === activeStep;
                    return (
                      <li key={step.number}>
                        <button
                          type="button"
                          onClick={() => setActiveStep(index)}
                          aria-expanded={isActive}
                          className={cn(
                            'group relative flex w-full items-center gap-4 border-b border-[var(--ff-rule)] px-3 py-4 text-left transition-colors',
                            isActive ? 'bg-[var(--ff-surface-2)]' : 'hover:bg-[var(--ff-surface)]',
                          )}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              'absolute inset-y-0 left-0 w-[2px] origin-top bg-[var(--ff-accent-ink)] transition-transform duration-300',
                              isActive ? 'scale-y-100' : 'scale-y-0',
                            )}
                          />
                          <span
                            className={cn(
                              'ff-kicker w-6 shrink-0',
                              isActive ? 'text-[var(--ff-accent-ink)]' : 'text-[var(--ff-text-dim)]',
                            )}
                          >
                            {step.number}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                'block text-[15px] font-semibold',
                                isActive ? 'text-[var(--ff-text)]' : 'text-[var(--ff-text-muted)]',
                              )}
                            >
                              {step.title}
                            </span>
                          </span>
                          <span className="ff-kicker hidden shrink-0 sm:block">{step.file}</span>
                          <ArrowRight
                            size={14}
                            className={cn(
                              'shrink-0 transition-transform',
                              isActive
                                ? 'translate-x-0 text-[var(--ff-accent-ink)]'
                                : '-translate-x-1 text-[var(--ff-text-dim)] group-hover:translate-x-0',
                            )}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ol>

                <div className="mt-5 border border-[var(--ff-rule)]">
                  <div className="flex items-center justify-between gap-4 border-b border-[var(--ff-rule)] bg-[var(--ff-surface)] px-4 py-2.5">
                    <span className="font-mono text-[10px] text-[var(--ff-text-muted)]">{active.file}</span>
                    <span className="ff-kicker">stage {active.number} / 04</span>
                  </div>
                  <div className="ff-code-surface min-h-[124px] p-4" aria-live="polite">
                    <div key={active.number} className="space-y-1.5 font-mono text-[10.5px] leading-relaxed">
                      {active.log.map((line, index) => (
                        <p
                          key={index}
                          className={cn(
                            'ff-log-line',
                            line.startsWith('$')
                              ? 'text-white/85'
                              : line.startsWith('error')
                                ? 'text-[var(--ff-code-error)]'
                                : line.startsWith('✓') || line.startsWith('+')
                                  ? 'text-[var(--ff-code-ok)]'
                                  : 'text-white/45',
                          )}
                          style={{ animationDelay: `${index * 55}ms` }}
                        >
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                  <p className="border-t border-[var(--ff-rule)] bg-[var(--ff-surface)] px-4 py-3 text-[12px] leading-relaxed text-[var(--ff-text-muted)]">
                    {active.copy}
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── Workbench ────────────────────────────────────────────────── */}
        <section id="product" className="scroll-mt-24 border-b border-[var(--ff-rule)]">
          <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
            <Reveal>
              <div className="grid gap-6 border-b border-[var(--ff-rule)] pb-8 lg:grid-cols-[1fr_0.8fr] lg:items-end">
                <div>
                  <SectionLabel index="03">The workbench</SectionLabel>
                  <h2 className={H2}>
                    Everything the app needs,
                    <br />
                    <span className="ff-serif italic text-[var(--ff-accent-ink)]">in one place.</span>
                  </h2>
                </div>
                <p className="max-w-md text-[14px] leading-relaxed text-[var(--ff-text-muted)] lg:justify-self-end lg:pb-2">
                  The brief, the Dart source, the running preview and the build log share one workspace. Nothing important is
                  hidden behind a chat bubble.
                </p>
              </div>
            </Reveal>

            <div>
              {CHAPTERS.map(({ index, kicker, title, copy, bullets, Artifact }, chapterIndex) => {
                const reversed = chapterIndex % 2 === 1;
                return (
                  <article
                    key={index}
                    className="grid gap-8 border-b border-[var(--ff-rule)] py-12 last:border-b-0 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-16"
                  >
                    <Reveal className={cn(reversed && 'lg:order-2')}>
                      <div className="flex items-center gap-3">
                        <span className="ff-kicker text-[var(--ff-accent-ink)]">{index}</span>
                        <span aria-hidden className="ff-rule-draw h-px w-6 bg-[var(--ff-rule-strong)]" />
                        <span className="ff-kicker">{kicker}</span>
                      </div>
                      <h3 className="ff-display mt-4 text-[26px] font-semibold leading-[1.05] tracking-[-0.04em] text-[var(--ff-text)] sm:text-[32px]">
                        {title}
                      </h3>
                      <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-[var(--ff-text-muted)]">{copy}</p>
                      <ul className="mt-5 space-y-2">
                        {bullets.map((bullet) => (
                          <li key={bullet} className="flex items-start gap-2 text-[12px] text-[var(--ff-text-muted)]">
                            <Check size={12} className="mt-0.5 shrink-0 text-[var(--ff-accent-ink)]" />
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    </Reveal>

                    <Reveal delay={80} className={cn('min-w-0', reversed && 'lg:order-1')}>
                      <Artifact />
                    </Reveal>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Desktop targets ──────────────────────────────────────────── */}
        <section id="desktop" className="scroll-mt-24 border-b border-[var(--ff-rule)]">
          <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
            <div className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-16">
              <Reveal className="lg:col-span-5">
                <SectionLabel index="04">Ship it</SectionLabel>
                <h2 className={H2}>
                  One project.
                  <br />
                  <span className="ff-serif italic text-[var(--ff-accent-ink)]">Three canvases.</span>
                </h2>
                <p className="mt-5 max-w-md text-[14px] leading-relaxed text-[var(--ff-text-muted)]">
                  Start in the browser, then take the same Flutter project to desktop. Runner folders are prepared for you;
                  signing and store submission stay in your release process.
                </p>

                <div className="mt-8 border-t border-[var(--ff-rule)]">
                  {TARGETS.map((target) => (
                    <div
                      key={target.target}
                      className="flex items-center justify-between gap-4 border-b border-[var(--ff-rule)] py-3.5"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-[var(--ff-text)]">{target.target}</p>
                        <p className="mt-0.5 truncate font-mono text-[10px] text-[var(--ff-text-dim)]">{target.detail}</p>
                      </div>
                      <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--ff-accent-ink)]">
                        {target.state}
                      </span>
                    </div>
                  ))}
                </div>

                <Link
                  to={workspaceHref}
                  className="ff-text-link group mt-6 inline-flex items-center gap-2 text-[12px] font-medium"
                >
                  Open the workspace
                  <ArrowRight size={13} className="transition-transform duration-300 group-hover:translate-x-0.5" />
                </Link>
              </Reveal>

              <Reveal delay={80} className="min-w-0 lg:col-span-7">
                <figure>
                  <div className="mb-2 flex items-end justify-between gap-4">
                    <span className="ff-kicker">Plate 02 — the desktop runner</span>
                    <span className="ff-kicker">fig. 2</span>
                  </div>
                  <div className="ff-plate-stack">
                    <span className="ff-sheet ff-sheet-1" aria-hidden />
                    <span className="ff-sheet ff-sheet-2" aria-hidden />
                    <DesktopArtifact />
                  </div>
                  <figcaption className="mt-3 border-t border-[var(--ff-rule)] pt-2.5 text-[11.5px] leading-relaxed text-[var(--ff-text-muted)]">
                    The same source tree compiles to a web preview and portable desktop runners.
                  </figcaption>
                </figure>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <section id="faq" className="scroll-mt-24 border-b border-[var(--ff-rule)]">
          <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
              <Reveal className="lg:col-span-4">
                <SectionLabel index="05">Questions</SectionLabel>
                <h2 className={H2}>
                  Plain answers,
                  <br />
                  <span className="ff-serif italic text-[var(--ff-accent-ink)]">including limits.</span>
                </h2>
                <p className="mt-5 max-w-sm text-[14px] leading-relaxed text-[var(--ff-text-muted)]">
                  What runs locally, what needs an internet connection, and what stays your responsibility before release.
                </p>
              </Reveal>

              <Reveal delay={80} className="lg:col-span-8">
                <div>
                  {FAQS.map((item, index) => (
                    <details key={item.q} className="ff-index-row group">
                      <summary className="flex cursor-pointer list-none items-center gap-4 px-1 py-4 [&::-webkit-details-marker]:hidden">
                        <span className="ff-kicker w-6 shrink-0 text-[var(--ff-text-dim)]">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="min-w-0 flex-1 text-[14px] font-semibold text-[var(--ff-text)]">{item.q}</span>
                        <Plus
                          size={15}
                          className="shrink-0 text-[var(--ff-text-dim)] transition-transform duration-200 group-open:rotate-45"
                        />
                      </summary>
                      <p className="ff-faq-answer max-w-2xl pb-5 pl-[40px] pr-6 text-[12.5px] leading-relaxed text-[var(--ff-text-muted)]">
                        {item.a}
                      </p>
                    </details>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── Team ─────────────────────────────────────────────────────── */}
        <section id="team" className="scroll-mt-24 border-b border-[var(--ff-rule)]">
          <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
            <Reveal>
              <div className="flex flex-col justify-between gap-4 border-b border-[var(--ff-rule)] pb-8 sm:flex-row sm:items-end">
                <div>
                  <SectionLabel index="06">Project team</SectionLabel>
                  <h2 className={H2}>
                    Built by a
                    <span className="ff-serif italic text-[var(--ff-accent-ink)]"> capstone team.</span>
                  </h2>
                </div>
                <p className="max-w-sm text-[12.5px] leading-relaxed text-[var(--ff-text-muted)] sm:text-right">
                  Four engineers, one academic year, a working studio rather than a slide deck.
                </p>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <ul className="mt-8 grid grid-cols-1 gap-px bg-[var(--ff-rule)] sm:grid-cols-2 lg:grid-cols-4">
                {TEAM.map((member) => (
                  <li
                    key={member.name}
                    className="group bg-[var(--ff-bg)] px-5 py-6 transition-colors duration-200 hover:bg-[var(--ff-surface)] sm:px-6"
                  >
                    <span className="ff-kicker inline-block text-[var(--ff-accent-ink)] transition-transform duration-300 group-hover:-translate-y-0.5">
                      {member.name
                        .split(' ')
                        .map((part) => part[0])
                        .join('')}
                    </span>
                    <p className="ff-display mt-4 text-[15px] font-semibold tracking-tight text-[var(--ff-text)]">
                      {member.name}
                    </p>
                    <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--ff-text-muted)]">{member.role}</p>
                    <p className="mt-3 border-t border-[var(--ff-rule)] pt-2.5 font-mono text-[9px] text-[var(--ff-text-dim)]">
                      {member.focus}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex flex-col gap-3 border border-[var(--ff-rule)] bg-[var(--ff-surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <GraduationCap size={16} className="mt-0.5 shrink-0 text-[var(--ff-accent-ink)]" />
                  <div>
                    <p className="text-[12px] font-semibold text-[var(--ff-text)]">Academic capstone · Phase 2</p>
                    <p className="mt-0.5 text-[11.5px] text-[var(--ff-text-muted)]">
                      S. G. Balekundri Institute of Technology, Belagavi · VTU
                    </p>
                  </div>
                </div>
                <span className="ff-kicker shrink-0">2026–2027</span>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────────── */}
        <section className="border-b border-[var(--ff-rule)]">
          <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:px-10 lg:py-20">
            <Reveal>
              <div className="relative overflow-hidden bg-[var(--ff-panel-bg)] px-6 py-12 text-[var(--ff-panel-text)] sm:px-10 lg:px-14 lg:py-16">
                <div
                  className="ff-cta-field pointer-events-none absolute inset-0 opacity-60"
                  aria-hidden
                  style={{
                    maskImage: 'linear-gradient(to bottom right, black, transparent 78%)',
                    WebkitMaskImage: 'linear-gradient(to bottom right, black, transparent 78%)',
                  }}
                >
                  <div
                    className="ff-cta-grid"
                    style={{
                      backgroundImage: 'radial-gradient(rgba(251,250,221,0.12) 1px, transparent 1.2px)',
                      backgroundSize: '26px 26px',
                    }}
                  />
                </div>
                <div className="relative grid gap-8 lg:grid-cols-[1.2fr_auto] lg:items-end">
                  <div>
                    <p className="ff-kicker text-[var(--ff-panel-muted)]">Start here</p>
                    <h2 className="ff-display mt-4 max-w-2xl text-[34px] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[42px] lg:text-[48px]">
                      The next app is
                      <span className="ff-serif italic"> one brief </span>
                      away.
                    </h2>
                    <p className="mt-4 max-w-lg text-[13px] leading-relaxed text-[var(--ff-panel-muted)] sm:text-[13.5px]">
                      Describe what you want, watch the files appear, and keep the project when you leave. No lock-in, no
                      hidden build step.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 lg:justify-end lg:pb-1">
                    <Link
                      to={workspaceHref}
                      className="group inline-flex h-11 items-center gap-2 rounded-[6px] bg-[var(--ff-panel-text)] px-5 text-[12.5px] font-semibold text-[var(--ff-panel-bg)] transition-colors hover:bg-white"
                    >
                      {session ? 'Open dashboard' : 'Start building'}
                      <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-0.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => scrollToSection('workflow')}
                      className="inline-flex h-11 items-center gap-2 rounded-[6px] border border-[var(--ff-panel-text)]/25 px-5 text-[12.5px] font-semibold text-[var(--ff-panel-text)] transition-colors hover:border-[var(--ff-panel-text)]/60"
                    >
                      See the build loop
                    </button>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="relative border-t border-[var(--ff-rule-strong)]">
        <div className="mx-auto max-w-[1440px] px-4 pb-24 pt-14 sm:px-6 sm:pb-8 sm:pt-16 lg:px-10">
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 border-b border-[var(--ff-rule)] pb-12 sm:grid-cols-3 xl:grid-cols-[minmax(0,1.7fr)_repeat(5,minmax(0,1fr))] xl:gap-x-6 2xl:gap-x-8">
            <div className="col-span-2 sm:col-span-3 xl:col-span-1 xl:pr-8">
              <div className="flex items-center gap-2.5">
                <BrandLogo size={26} />
                <span className="ff-display text-[17px] font-semibold tracking-tight">FlutterForge</span>
              </div>
              <p className="mt-4 max-w-[32ch] text-[12.5px] leading-relaxed text-[var(--ff-text-muted)]">
                A local-first Flutter studio: brief, build, preview and repair in one workspace.
              </p>
              <a
                href="https://github.com/codewithulavesh/flutterforge"
                target="_blank"
                rel="noreferrer"
                className="group mt-6 inline-flex min-h-11 items-center gap-2.5 rounded-[6px] border border-[var(--ff-rule-strong)] px-3.5 text-[11.5px] font-medium text-[var(--ff-text-muted)] transition-colors hover:border-[var(--ff-accent-ink)] hover:text-[var(--ff-text)] sm:min-h-10"
              >
                <Github size={14} />
                Source on GitHub
                <ArrowUpRight
                  size={12}
                  className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </a>
              <p className="ff-kicker mt-6">Engineered by OnUs Devs</p>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-[var(--ff-text-dim)]">
                S. G. Balekundri Institute of Technology, Belagavi · VTU
              </p>
            </div>

            <FooterCol title="Product">
              {[
                { label: 'Overview', id: 'hero' },
                { label: 'How it works', id: 'workflow' },
                { label: 'Workbench', id: 'product' },
                { label: 'Desktop export', id: 'desktop' },
              ].map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => scrollToSection(item.id)} className={footerLinkClass()}>
                    {item.label}
                  </button>
                </li>
              ))}
            </FooterCol>

            <FooterCol title="Get started">
              <li>
                <Link to={workspaceHref} className={footerLinkClass()}>
                  {session ? 'Open dashboard' : 'Start a build'}
                </Link>
              </li>
              {!session && (
                <li>
                  <Link to="/login" className={footerLinkClass()}>
                    Sign in
                  </Link>
                </li>
              )}
              {!session && (
                <li>
                  <Link to="/forgot-password" className={footerLinkClass()}>
                    Forgot password
                  </Link>
                </li>
              )}
              <li>
                <button type="button" onClick={() => scrollToSection('workflow')} className={footerLinkClass()}>
                  See the build loop
                </button>
              </li>
            </FooterCol>

            <FooterCol title="Use cases">
              {EXAMPLE_PROMPTS.map((example) => (
                <li key={example.label}>
                  <button
                    type="button"
                    onClick={() => {
                      setPrompt(example.prompt);
                      scrollToSection('hero');
                      requestAnimationFrame(() =>
                        document.getElementById('hero-prompt')?.focus({ preventScroll: true }),
                      );
                    }}
                    className={footerLinkClass()}
                  >
                    {example.label}
                  </button>
                </li>
              ))}
            </FooterCol>

            <FooterCol title="Resources">
              <li>
                <button type="button" onClick={() => scrollToSection('faq')} className={footerLinkClass()}>
                  FAQ
                </button>
              </li>
              <li>
                <button type="button" onClick={() => scrollToSection('team')} className={footerLinkClass()}>
                  Project team
                </button>
              </li>
              <li>
                <a
                  href="https://github.com/codewithulavesh/flutterforge"
                  target="_blank"
                  rel="noreferrer"
                  className={footerLinkClass('group gap-1.5')}
                >
                  Repository
                  <ArrowUpRight
                    size={11}
                    className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  />
                </a>
              </li>
              <li>
                <button type="button" onClick={() => scrollToTarget(0, 0)} className={footerLinkClass()}>
                  Back to top
                </button>
              </li>
            </FooterCol>

            <FooterCol title="Legal">
              <li>
                <Link to="/legal/terms" className={footerLinkClass()}>
                  Terms of use
                </Link>
              </li>
              <li>
                <Link to="/legal/privacy" className={footerLinkClass()}>
                  Privacy notice
                </Link>
              </li>
              <li>
                <Link to="/legal/permissions" className={footerLinkClass()}>
                  Permissions
                </Link>
              </li>
            </FooterCol>
          </div>

          <div className="flex flex-col gap-5 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10.5px] leading-relaxed text-[var(--ff-text-dim)]">
              © {new Date().getFullYear()} FlutterForge. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="ff-kicker mr-1 hidden sm:inline">Settings</span>
              <button
                type="button"
                onClick={toggle}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                className="inline-flex h-11 items-center gap-2 rounded-[6px] border border-[var(--ff-rule-strong)] px-3.5 text-[11.5px] text-[var(--ff-text-muted)] transition-colors hover:border-[var(--ff-accent-ink)] hover:text-[var(--ff-text)] sm:h-9"
              >
                {isDark ? <Sun size={13} /> : <Moon size={13} />}
                {isDark ? 'Light mode' : 'Dark mode'}
              </button>
              <button
                type="button"
                onClick={() => scrollToTarget(0, 0)}
                className="inline-flex h-11 items-center gap-2 rounded-[6px] border border-[var(--ff-rule-strong)] px-3.5 text-[11.5px] text-[var(--ff-text-muted)] transition-colors hover:border-[var(--ff-accent-ink)] hover:text-[var(--ff-text)] sm:h-9"
              >
                Back to top
                <ArrowUp size={13} />
              </button>
              <a
                href="https://github.com/codewithulavesh/flutterforge"
                target="_blank"
                rel="noreferrer"
                aria-label="FlutterForge on GitHub"
                className="inline-flex h-11 w-11 items-center justify-center rounded-[6px] border border-[var(--ff-rule-strong)] text-[var(--ff-text-muted)] transition-colors hover:border-[var(--ff-accent-ink)] hover:text-[var(--ff-text)] sm:h-9 sm:w-9"
              >
                <Github size={14} />
              </a>
            </div>
          </div>
        </div>

        <div aria-hidden className="pointer-events-none select-none overflow-hidden pb-3 sm:pb-5">
          <p className="ff-serif mx-auto max-w-[1440px] px-4 pb-[0.18em] pt-[0.1em] text-[clamp(48px,12.4vw,178px)] leading-[1.15] tracking-[-0.035em] text-[var(--ff-text)] opacity-[0.055] sm:px-6 lg:px-10">
            FlutterForge
          </p>
        </div>
      </footer>

      <button
        type="button"
        aria-label="Back to top"
        onClick={() => scrollToTarget(0, 0)}
        className={cn(
          'ff-totop fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center border border-[var(--ff-rule-strong)] bg-[var(--ff-bg)] text-[var(--ff-text-muted)] transition-colors hover:border-[var(--ff-accent-ink)] hover:text-[var(--ff-accent-ink)] lg:h-10 lg:w-10',
          showTop && 'is-shown',
        )}
      >
        <ArrowUp size={15} />
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   HERO PANELS
   ════════════════════════════════════════════════════════════════════ */

function HeroSource() {
  return (
    <div className="ff-code-surface flex h-[400px] flex-col overflow-hidden sm:h-[440px]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
        <span className="font-mono text-[10px] text-white/70">lib/screens/home_screen.dart</span>
        <span className="font-mono text-[9px] text-white/35">Dart</span>
      </div>
      <pre className="min-h-0 flex-1 overflow-auto p-4 font-mono text-[10.5px] leading-[1.9] sm:text-[11px]">
        <code>
          <span className="ff-code-key">class</span> HomeScreen <span className="ff-code-key">extends</span> StatelessWidget {'{\n'}
          {'  '}<span className="ff-code-key">const</span> HomeScreen({'{'}super.key, <span className="ff-code-key">required</span>{' '}
          <span className="ff-code-key">this</span>.goals{'}'});{'\n\n'}
          {'  '}<span className="ff-code-key">final</span> List&lt;Goal&gt; goals;{'\n\n'}
          {'  '}<span className="ff-code-dim">{'// The list is derived, never duplicated.'}</span>{'\n'}
          {'  '}@override{'\n'}
          {'  '}Widget build(BuildContext context) {'{\n'}
          {'    '}<span className="ff-code-key">return</span> Scaffold({'\n'}
          {'      '}backgroundColor: ForgeTheme.paper,{'\n'}
          {'      '}body: SafeArea({'\n'}
          {'        '}child: GoalList(goals: goals),{'\n'}
          {'      '}),{'\n'}
          {'    '});{'\n'}
          {'  }'}{'\n'}
          {'}'}
        </code>
      </pre>
      <div className="flex items-center gap-2 border-t border-white/10 px-4 py-2.5">
        <Check size={11} className="text-[var(--ff-code-ok)]" />
        <span className="font-mono text-[9px] text-white/50">flutter analyze · no issues</span>
      </div>
    </div>
  );
}

type HeroLogLine = { tone: 'prompt' | 'dim' | 'ok' | 'error'; text: string };

const HERO_LOG: readonly HeroLogLine[] = [
  { tone: 'prompt', text: '$ flutter run -d web-server' },
  { tone: 'dim', text: 'Launching lib/main.dart on web-server…' },
  { tone: 'ok', text: '✓ pub get · 1.4s' },
  { tone: 'ok', text: '✓ compiled · 2.1s' },
  { tone: 'error', text: 'error • home_screen.dart:42 • title is not defined' },
  { tone: 'prompt', text: '$ ff repair --from analyze' },
  { tone: 'ok', text: 'patch 1/2 applied · rebuilding' },
  { tone: 'ok', text: '✓ analyze clean · preview ready' },
  { tone: 'dim', text: 'local • http://localhost:8080' },
];

function HeroBuildLog({ lines = HERO_LOG, running = false }: { lines?: readonly HeroLogLine[]; running?: boolean }) {
  return (
    <div className="ff-code-surface flex h-[400px] flex-col sm:h-[440px]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
        <span className="font-mono text-[10px] text-white/70">build log</span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[9px] text-white/35">
          {running ? <span className="ff-live-dot h-1.5 w-1.5 rounded-full bg-[var(--ff-code-ok)]" /> : null}
          {running ? 'forging…' : 'local runner'}
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-auto p-4 font-mono text-[10.5px] leading-relaxed sm:text-[11px]">
        {lines.map((line, index) => (
          <p
            key={index}
            className={
              line.tone === 'error'
                ? 'text-[var(--ff-code-error)]'
                : line.tone === 'ok'
                  ? 'text-[var(--ff-code-ok)]'
                  : line.tone === 'prompt'
                    ? 'text-white/85'
                    : 'text-white/40'
            }
          >
            {line.text}
          </p>
        ))}
        {running ? <span className="ff-cursor" aria-hidden /> : null}
      </div>
      <div className="flex items-center gap-2 border-t border-white/10 px-4 py-2.5">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--ff-code-ok)]" />
        <span className="font-mono text-[9px] text-white/45">
          {running ? 'writing files · analyze queued' : 'compiler loop closed · no manual step'}
        </span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   INTERACTIVE SAMPLE PROJECT
   ════════════════════════════════════════════════════════════════════ */

function ProductWindow() {
  const [display, setDisplay] = useState('1,248');
  const [expression, setExpression] = useState('');
  const accumulator = useRef<number | null>(null);
  const operation = useRef<string | null>(null);
  const replaceNext = useRef(true);

  const currentValue = () => Number(display.replaceAll(',', '')) || 0;
  const formatNumber = (value: number) =>
    Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 8 }) : 'Error';
  const calculate = (left: number, right: number, op: string) => {
    if (op === '+') return left + right;
    if (op === '−') return left - right;
    if (op === '×') return left * right;
    return right === 0 ? Number.NaN : left / right;
  };

  function pressCalculatorKey(key: string) {
    if (key === 'AC') {
      setDisplay('0');
      setExpression('');
      accumulator.current = null;
      operation.current = null;
      replaceNext.current = true;
      return;
    }
    if (key === '±') {
      setDisplay(formatNumber(-currentValue()));
      return;
    }
    if (key === '%') {
      setDisplay(formatNumber(currentValue() / 100));
      return;
    }
    if (/^\d$/.test(key) || key === '.') {
      const current = display.replaceAll(',', '');
      const base = replaceNext.current ? (key === '.' ? '0.' : key) : current;
      const updated =
        key === '.'
          ? replaceNext.current || base.includes('.')
            ? base
            : `${base}.`
          : replaceNext.current || current === '0'
            ? key
            : `${base}${key}`;
      setDisplay(updated.length > 12 ? updated.slice(0, 12) : updated);
      replaceNext.current = false;
      return;
    }
    if (['÷', '×', '−', '+'].includes(key)) {
      const value = currentValue();
      const result =
        accumulator.current !== null && operation.current && !replaceNext.current
          ? calculate(accumulator.current, value, operation.current)
          : value;
      accumulator.current = result;
      operation.current = key;
      setDisplay(formatNumber(result));
      setExpression(`${formatNumber(result)} ${key}`);
      replaceNext.current = true;
      return;
    }
    if (key === '=' && accumulator.current !== null && operation.current) {
      const left = accumulator.current;
      const right = currentValue();
      const result = calculate(left, right, operation.current);
      setExpression(`${formatNumber(left)} ${operation.current} ${formatNumber(right)} =`);
      setDisplay(formatNumber(result));
      accumulator.current = null;
      operation.current = null;
      replaceNext.current = true;
    }
  }

  return (
    <div className="grid h-[400px] grid-cols-12 sm:h-[440px]">
      {/* Chat column */}
      <div className="col-span-5 flex min-w-0 flex-col border-r border-[var(--ff-rule)] bg-[var(--ff-bg)] p-3">
        <div className="flex items-center gap-1.5 border-b border-[var(--ff-rule)] pb-2">
          <BrandLogo size={16} />
          <span className="text-[9px] font-semibold text-[var(--ff-text)]">AI Builder</span>
          <span className="ml-auto font-mono text-[8px] text-[var(--ff-text-dim)]">Context</span>
        </div>
        <div className="mt-2.5 border border-[var(--ff-rule)] bg-[var(--ff-surface)] p-2">
          <p className="font-mono text-[7px] uppercase tracking-[0.12em] text-[var(--ff-text-dim)]">You</p>
          <p className="mt-1 text-[9px] leading-relaxed text-[var(--ff-text)]">
            Build a polished calculator with history and keyboard support. No backend needed.
          </p>
        </div>
        <div className="mt-2 border border-[var(--ff-rule)] bg-[var(--ff-surface)] p-2">
          <div className="flex items-center gap-1">
            <BrandLogo size={12} />
            <p className="text-[8px] font-semibold text-[var(--ff-text)]">FlutterForge</p>
          </div>
          <p className="mt-1 text-[8px] leading-relaxed text-[var(--ff-text-muted)]">
            Built the Flutter files. Preview is live and ready to try.
          </p>
          <div className="mt-1.5 space-y-1">
            {['lib/main.dart', 'lib/screens/calculator_screen.dart', 'pubspec.yaml'].map((file) => (
              <div
                key={file}
                className="flex items-center gap-1 border border-[var(--ff-rule)] bg-[var(--ff-bg)] px-1.5 py-0.5"
              >
                <span className="font-mono text-[7px] text-[var(--ff-text-dim)]">·</span>
                <span className="truncate font-mono text-[7px] text-[var(--ff-text-muted)]">{file}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-auto border border-[var(--ff-rule)] bg-[var(--ff-surface)] px-2 py-1.5">
          <p className="text-[8px] text-[var(--ff-text-dim)]">Ask about the project or describe a change…</p>
        </div>
      </div>

      {/* Code column */}
      <div className="col-span-4 hidden min-w-0 flex-col border-r border-[var(--ff-rule)] bg-[var(--ff-code-bg)] sm:flex">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-2.5 py-2">
          <span className="truncate font-mono text-[8px] text-white/45">calculator_screen.dart</span>
          <span className="font-mono text-[7px] text-white/30">Dart</span>
        </div>
        <pre className="overflow-hidden p-2.5 font-mono text-[7px] leading-[1.7] text-[#c9c3b5]">
          {`class CalculatorScreen
    extends StatelessWidget {
  const CalculatorScreen({
    super.key,
  });

  @override
  Widget build(
    BuildContext context,
  ) {
    return Scaffold(
      backgroundColor:
        const Color(
          0xFF0B0D11,
        ),
      body: Column(
        children: [
          Display(value: '1,248'),
          Keypad(
            onTap: controller.press,
          ),
        ],
      ),
    );
  }
}`}
        </pre>
      </div>

      {/* Preview column */}
      <div className="col-span-7 flex items-center justify-center bg-[var(--ff-surface-2)] p-2 sm:col-span-3 sm:p-3">
        <div className="w-full max-w-[150px] rounded-[20px] border border-[var(--ff-rule-strong)] bg-[var(--ff-code-bg)] p-1 sm:max-w-[132px]">
          <div className="rounded-[16px] bg-black p-2">
            <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-white/20" />
            <p className="h-3 truncate text-right font-mono text-[7px] text-white/45">{expression}</p>
            <p aria-live="polite" className="truncate text-right font-mono text-[17px] font-light text-white">
              {display}
            </p>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {['AC', '±', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '='].map(
                (key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => pressCalculatorKey(key)}
                    aria-label={`Calculator ${key}`}
                    className={cn(
                      'flex h-6 items-center justify-center rounded-full text-[7px] font-medium transition-transform hover:scale-105 active:scale-95',
                      ['÷', '×', '−', '+', '='].includes(key)
                        ? 'bg-[var(--ff-brand-coral)] text-white'
                        : ['AC', '±', '%'].includes(key)
                          ? 'bg-[#3a3a3c] text-white'
                          : 'bg-[#1c1c1e] text-white',
                      key === '0' && 'col-span-2',
                    )}
                  >
                    {key}
                  </button>
                ),
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
