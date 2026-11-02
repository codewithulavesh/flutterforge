import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Lenis from 'lenis';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  CircleHelp,
  Code2,
  Cpu,
  GraduationCap,
  Layers,
  LayoutDashboard,
  Monitor,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sun,
  Terminal,
  User,
  type LucideIcon,
} from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { SvgFollowScroll } from '@/components/ui/svg-follow-scroll';
import { useAuthStore } from '@/stores/auth.store';
import { useThemeStore } from '@/stores/theme.store';
import { HERO_PROMPT_KEY } from '@/utils/landing';
import { cn } from '@/utils/cn';

/* ════════════════════════════════════════════════════════════════════
   SMOOTH SCROLL ENGINE (Lenis) — everything lives in this one file
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
    lenisInstance.scrollTo(target, { offset, duration: 1.4, easing: easeOutExpo });
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
      duration: 1.15,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.4,
      anchors: false,
    });
    lenisInstance = lenis;
    lenis.on('scroll', (e: { velocity: number }) => {
      ScrollTrigger.update();
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

    // Re-measure when content height changes (FAQ <details>, fonts, images).
    const ro = new ResizeObserver(() => {
      lenis.resize();
      ScrollTrigger.refresh();
    });
    ro.observe(document.body);

    emitScroll();

    return () => {
      document.removeEventListener('click', onClick);
      ro.disconnect();
      cancelAnimationFrame(raf);
      lenis.destroy();
      lenisInstance = null;
    };
  }, []);
}

/** CSS needed by the scroll effects, injected by <ScrollStyles /> so no extra file is required. */
const SCROLL_CSS = `
html.lenis, html.lenis body { height: auto; }
.lenis.lenis-smooth { scroll-behavior: auto !important; }
.lenis.lenis-smooth [data-lenis-prevent] { overscroll-behavior: contain; }
.lenis.lenis-stopped { overflow: clip; }

.ff-landing .ff-reveal {
  opacity: 0;
  transform: translate3d(0, 28px, 0) scale(0.985);
  filter: blur(6px);
  transition:
    opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.9s cubic-bezier(0.16, 1, 0.3, 1),
    filter 0.9s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: opacity, transform, filter;
}
.ff-landing .ff-reveal.is-visible { opacity: 1; transform: none; filter: none; }

.ff-landing nav button { transition: background-color .25s ease, color .25s ease, transform .25s ease; }
.ff-landing nav button:hover { transform: translateX(2px); }

.ff-totop {
  opacity: 0;
  transform: translateY(12px) scale(0.9);
  pointer-events: none;
  transition: opacity .35s ease, transform .35s cubic-bezier(0.16, 1, 0.3, 1);
}
.ff-totop.is-shown { opacity: 1; transform: none; pointer-events: auto; }

@media (prefers-reduced-motion: reduce) {
  .ff-landing .ff-reveal { opacity: 1; transform: none; filter: none; transition: none; }
  .ff-totop { transition: none; }
}
`;

function ScrollStyles() {
  return <style>{SCROLL_CSS}</style>;
}

/** Thin gradient bar pinned to the top that tracks page scroll progress. */
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
        className="h-full origin-left will-change-transform"
        style={{
          transform: 'scaleX(0)',
          background: 'linear-gradient(90deg, var(--ff-brand-teal), #F07067)',
          boxShadow: '0 0 12px rgba(2,175,185,0.55)',
        }}
      />
    </div>
  );
}

/** Moves children at a fraction of scroll speed for depth. Negative speed drifts the other way. */
function Parallax({
  children,
  speed = 0.12,
  className,
}: {
  children: ReactNode;
  speed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
      const offset = (r.top + r.height / 2 - window.innerHeight / 2) * -speed;
      el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
    };
    update();
    return subscribeScroll(update);
  }, [speed]);
  return (
    <div ref={ref} className={className} style={{ willChange: 'transform' }}>
      {children}
    </div>
  );
}

function useScrolledPast(px = 700) {
  const [past, setPast] = useState(false);
  useEffect(() => subscribeScroll(({ scroll }) => setPast(scroll > px)), [px]);
  return past;
}

/* ════════════════════════════════════════════════════════════════════
   PAGE DATA
   ════════════════════════════════════════════════════════════════════ */

const PRODUCT_STORIES = [
  {
    image: '/assets/landing/ai-studio.webp',
    alt: 'Illustration of an AI builder, code editor, and mobile app preview in one studio',
    label: '01 / AI + SOURCE',
    title: 'Build beside real code.',
    copy: 'FlutterForge turns a clear brief into editable Dart files and a project structure you can inspect.',
    span: 'lg:col-span-7',
    imageClass: 'aspect-[1.7]',
  },
  {
    image: '/assets/landing/developer-workspace.webp',
    alt: 'Illustrated developer workspace with a Flutter project, laptop, and phone preview',
    label: '02 / LOCAL WORKSPACE',
    title: 'Keep the project yours.',
    copy: 'Source, terminal work, and preview stay in your local workspace.',
    span: 'lg:col-span-5',
    imageClass: 'aspect-[1.7]',
  },
  {
    image: '/assets/landing/responsive-preview.webp',
    alt: 'Flutter app dashboard displayed across a laptop and phone',
    label: '03 / RESPONSIVE PREVIEW',
    title: 'See it across screens.',
    copy: 'Shape responsive Flutter layouts and review the running web preview as the app evolves.',
    span: 'lg:col-span-5',
    imageClass: 'aspect-[1.55]',
  },
  {
    image: '/assets/landing/idea-to-app.webp',
    alt: 'Illustrated sequence from an app idea through project files to a running app',
    label: '04 / BUILD TO RELEASE',
    title: 'A visible path to a runnable app.',
    copy: 'Follow the project from the first idea through real files and into a working preview.',
    span: 'lg:col-span-7',
    imageClass: 'aspect-[1.7]',
  },
];

const STEPS = [
  {
    number: '01',
    title: 'Describe the app',
    copy: 'A sentence or a detailed brief. Pick web, mobile or desktop and choose Supabase only if the app needs it.',
  },
  {
    number: '02',
    title: 'Generate the project',
    copy: 'FlutterForge creates an editable project structure with Dart screens, supporting files, and backend pieces only when your app needs them.',
  },
  {
    number: '03',
    title: 'Compile and repair',
    copy: 'Flutter compiles the project. Compile errors are fed back to the agent, fixed and rebuilt before you are asked to look.',
  },
  {
    number: '04',
    title: 'Preview, edit, export',
    copy: 'Use the live preview, the editor and the terminal. Export a runnable ZIP or add macOS/Windows runners when you are ready.',
  },
];

const PIPELINE_ARTIFACTS = [
  { title: 'Product brief', file: 'build.intent', meta: 'requirements · constraints · targets' },
  { title: 'Flutter source', file: 'lib/main.dart', meta: 'screens · widgets · project config' },
  { title: 'Build diagnostics', file: 'flutter analyze', meta: 'compiler output · repair pass · diff' },
  { title: 'Runnable app', file: 'preview / export', meta: 'live web preview · portable project' },
];

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

const PROOF = [
  ['Real files on disk', 'pubspec, Dart, SQL'],
  ['Warm Flutter preview', 'flutter run -d web-server'],
  ['Two-round repair loop', 'compile errors → patch'],
  ['Desktop targets', 'macOS · Windows'],
] as const;

const EXAMPLE_PROMPTS = [
  { label: 'Personal finance', prompt: 'Build a personal finance app with category budgets, a monthly spending chart, and recurring bills.' },
  { label: 'Recipe planner', prompt: 'Create a recipe planner with a weekly meal calendar, grocery list, and dietary filters.' },
  { label: 'Fitness tracker', prompt: 'Design a fitness habit tracker with weekly progress, workout cards, and streaks.' },
];

const LANDING_SECTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'hero', label: 'Overview', icon: LayoutDashboard },
  { id: 'workflow', label: 'Workflow', icon: RefreshCw },
  { id: 'product', label: 'Product', icon: Layers },
  { id: 'desktop', label: 'Desktop export', icon: Monitor },
  { id: 'faq', label: 'FAQ', icon: CircleHelp },
  { id: 'team', label: 'Project team', icon: User },
];

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
      { threshold: 0.12, rootMargin: '0px 0px -48px 0px' },
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
   LANDING PAGE
   ════════════════════════════════════════════════════════════════════ */

export function LandingPage() {
  const navigate = useNavigate();
  const session = useAuthStore((s) => s.session);
  const { theme, toggle } = useThemeStore();
  const isDark = theme === 'dark';
  const [prompt, setPrompt] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [heroVisual, setHeroVisual] = useState<'concept' | 'workspace' | 'preview'>('concept');

  useSmoothScroll();
  const showTop = useScrolledPast(700);

  function submitPrompt() {
    const text = prompt.trim();
    if (!text) return;
    try {
      sessionStorage.setItem(HERO_PROMPT_KEY, text);
    } catch {
      // storage unavailable — navigation state still carries the prompt
    }
    navigate(session ? '/dashboard' : '/signup', { state: { heroPrompt: text } });
  }

  function scrollToSection(id: string) {
    scrollToTarget(`#${id}`, window.innerWidth < 1024 ? -72 : -16);
  }

  const authLabel = session ? 'Dashboard' : 'Sign in';
  const goAuth = () => navigate(session ? '/dashboard' : '/login');
  const goStart = () => navigate(session ? '/dashboard' : '/signup');

  return (
    <div className="min-h-screen bg-[var(--ff-bg)] ff-brand ff-studio ff-landing">
      <ScrollStyles />
      <ScrollProgress />

      <header className="sticky top-0 z-40 border-b border-[var(--ff-border)] bg-[var(--ff-bg)]/90 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="FlutterForge home">
            <BrandLogo size={30} />
            <span className="ff-display text-[15px] font-semibold tracking-tight text-[var(--ff-text)]">FlutterForge</span>
          </Link>
          <nav className="hidden items-center gap-7 md:flex" aria-label="Main navigation">
            {[['workflow', 'How it works'], ['product', 'Features'], ['desktop', 'For desktop'], ['faq', 'FAQ']].map(([id, label]) => (
              <a key={id} href={`#${id}`} className="text-[12px] text-[var(--ff-text-muted)] transition-colors hover:text-[var(--ff-text)]">{label}</a>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-[var(--ff-border)] bg-[var(--ff-surface)] px-2.5 py-1 font-mono text-[9px] text-[var(--ff-text-muted)] lg:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-[#7dd8b5]" /> LOCAL WORKSPACE</span>
            <button type="button" onClick={toggle} className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--ff-text-muted)] transition-colors hover:bg-[var(--ff-surface-2)] hover:text-[var(--ff-text)]" aria-label={isDark ? 'Switch to light appearance' : 'Switch to dark appearance'}>
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button type="button" onClick={goAuth} className="hidden rounded-lg px-3 py-2 text-[12px] font-medium text-[var(--ff-text-muted)] transition-colors hover:text-[var(--ff-text)] sm:inline-flex">{authLabel}</button>
            <button type="button" onClick={goStart} className="ff-cta inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-[11px] font-semibold sm:px-4 sm:text-[12px]">
              <span className="hidden sm:inline">Start building</span><span className="sm:hidden">Start</span><ArrowRight size={13} />
            </button>
          </div>
        </div>
      </header>

        <main>
          {/* ── Hero ───────────────────────────────────────────────────── */}
          <section id="hero" className="relative scroll-mt-20 overflow-hidden border-b border-[var(--ff-border)]">
            {/* Restrained grid texture keeps the product preview as the focal point. */}
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              <Parallax speed={0.05} className="absolute inset-0">
                <div className="ff-studio-grid absolute inset-0 opacity-30 [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
              </Parallax>
            </div>

            <div className="relative mx-auto grid max-w-[1440px] grid-cols-1 gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-20 lg:grid-cols-12 lg:gap-8 lg:px-10 lg:pb-24 lg:pt-24">
              <div className="flex flex-col justify-center lg:col-span-5">
                <div className="ff-enter ff-eyebrow inline-flex w-fit items-center gap-2 rounded-full border border-[var(--ff-brand-teal)]/25 bg-[var(--ff-brand-teal)]/5 px-3 py-1.5 shadow-[var(--ff-soft-shadow)] backdrop-blur">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--ff-brand-teal)] opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--ff-brand-teal)]" />
                  </span>
                  <span className="ff-label text-[9px] text-[var(--ff-text-muted)]">Your local Flutter creation environment</span>
                </div>

                <h1
                    className="ff-enter ff-display mt-6 text-[48px] font-semibold leading-[0.98] tracking-[-0.065em] text-[var(--ff-text)] sm:text-[66px] lg:text-[clamp(58px,6vw,88px)]"
                  style={{ animationDelay: '90ms' }}
                >
                  Make the idea.
                  <br />
                  <span className="ff-gradient-text">Run the app.</span>
                </h1>

                <p
                  className="ff-enter mt-5 max-w-lg text-[15px] leading-relaxed text-[var(--ff-text-muted)]"
                  style={{ animationDelay: '180ms' }}
                >
                  A Flutter app studio with an AI pair builder, real source files, and a live preview in one focused workspace.
                  Shape the idea, inspect every change, and keep the project on your machine.
                </p>

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitPrompt();
                  }}
                  className="ff-enter mt-8 w-full max-w-xl"
                  style={{ animationDelay: '270ms' }}
                >
                  <div className="ff-prompt group flex items-center gap-2 rounded-2xl border border-[var(--ff-border)] bg-[var(--ff-surface)] p-1.5 pl-3.5 shadow-[var(--ff-soft-shadow-lg)] transition-all duration-300 focus-within:border-[var(--ff-brand-teal)]/50 focus-within:shadow-[var(--ff-glow-teal)]">
                    <Sparkles size={15} className="shrink-0 text-[var(--ff-text-dim)] transition-colors group-focus-within:text-[var(--ff-brand-teal)]" />
                    <input
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      maxLength={2000}
                      placeholder="A habit tracker with weekly goals and a calm, minimal design…"
                      className="min-w-0 flex-1 bg-transparent py-2.5 text-[13px] text-[var(--ff-text)] outline-none placeholder:text-[var(--ff-text-dim)]"
                    />
                    <button
                      type="submit"
                      disabled={!prompt.trim()}
                      className="ff-cta flex h-9 w-9 shrink-0 items-center justify-center rounded-xl disabled:pointer-events-none disabled:opacity-30"
                      aria-label="Start with this prompt"
                    >
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </form>

                <div className="ff-enter mt-3 flex flex-wrap items-center gap-2" style={{ animationDelay: '320ms' }}>
                  <span className="mr-1 text-[10px] text-[var(--ff-text-dim)]">Try an idea</span>
                  {EXAMPLE_PROMPTS.map((example) => (
                    <button
                      key={example.label}
                      type="button"
                      onClick={() => setPrompt(example.prompt)}
                      className="rounded-full border border-[var(--ff-border)] bg-[var(--ff-surface)] px-2.5 py-1.5 text-[10px] text-[var(--ff-text-muted)] transition-all hover:-translate-y-0.5 hover:border-[var(--ff-brand-teal)]/40 hover:text-[var(--ff-brand-teal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ff-brand-teal)]"
                    >
                      {example.label}
                    </button>
                  ))}
                </div>

                <div className="ff-enter mt-6 flex flex-wrap items-center gap-3" style={{ animationDelay: '360ms' }}>
                  <Link
                    to={session ? '/dashboard' : '/signup'}
                    className="ff-cta inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-[13px] font-medium"
                  >
                    Start building <ArrowRight size={14} />
                  </Link>
                  <a
                    href="#workflow"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ff-border)] bg-[var(--ff-surface)] px-5 py-2.5 text-[13px] font-medium text-[var(--ff-text)] shadow-[var(--ff-soft-shadow)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--ff-brand-teal)]/50"
                  >
                    See how it works
                  </a>
                </div>

                <div
                  className="ff-enter mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] text-[var(--ff-text-dim)]"
                  style={{ animationDelay: '440ms' }}
                >
                  <span className="inline-flex items-center gap-1.5"><Monitor size={11} /> macOS · Windows</span>
                  <span className="inline-flex items-center gap-1.5"><Code2 size={11} /> SDK setup handled</span>
                  <span className="inline-flex items-center gap-1.5"><ShieldCheck size={11} /> Supabase optional</span>
                </div>
              </div>

              <div className="lg:col-span-7 lg:pl-4">
                <Parallax speed={0.08}>
                  <div className="ff-enter relative" style={{ animationDelay: '220ms' }}>
                    <div className="ff-window-glow absolute -inset-8 rounded-[36px]" aria-hidden />
                    <div className="relative overflow-hidden rounded-[22px] border border-[var(--ff-border)] bg-[var(--ff-surface)] shadow-[var(--ff-soft-shadow-lg)]">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ff-border)] bg-[var(--ff-surface)] px-3 py-2.5 sm:px-4">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-[#f07067]" />
                          <span className="h-2 w-2 rounded-full bg-[#f2d45c]" />
                          <span className="h-2 w-2 rounded-full bg-[#7dd8b5]" />
                          <span className="ml-1 font-mono text-[8px] tracking-wide text-[var(--ff-text-dim)] sm:text-[9px]">FLUTTERFORGE / STUDIO</span>
                        </div>
                        <div role="group" aria-label="Hero visual" className="inline-flex rounded-lg border border-[var(--ff-border)] bg-[var(--ff-bg)] p-0.5">
                          <button type="button" aria-pressed={heroVisual === 'concept'} onClick={() => setHeroVisual('concept')} className={cn('rounded-md px-2 py-1.5 text-[9px] font-medium transition-colors sm:px-2.5', heroVisual === 'concept' ? 'bg-[var(--ff-surface)] text-[var(--ff-text)] shadow-sm' : 'text-[var(--ff-text-dim)] hover:text-[var(--ff-text)]')}>Sketch</button>
                          <button type="button" aria-pressed={heroVisual === 'workspace'} onClick={() => setHeroVisual('workspace')} className={cn('rounded-md px-2 py-1.5 text-[9px] font-medium transition-colors sm:px-2.5', heroVisual === 'workspace' ? 'bg-[var(--ff-surface)] text-[var(--ff-text)] shadow-sm' : 'text-[var(--ff-text-dim)] hover:text-[var(--ff-text)]')}>Workspace</button>
                          <button type="button" aria-pressed={heroVisual === 'preview'} onClick={() => setHeroVisual('preview')} className={cn('rounded-md px-2 py-1.5 text-[9px] font-medium transition-colors sm:px-2.5', heroVisual === 'preview' ? 'bg-[var(--ff-surface)] text-[var(--ff-text)] shadow-sm' : 'text-[var(--ff-text-dim)] hover:text-[var(--ff-text)]')}>Live app</button>
                        </div>
                      </div>
                      {heroVisual !== 'preview' ? (
                        <figure className="relative">
                          <img src={heroVisual === 'concept' ? '/assets/landing/hero-workspace.webp' : '/assets/landing/studio-overview.webp'} alt={heroVisual === 'concept' ? 'Illustrated app creator shaping a mobile interface in a FlutterForge-inspired studio' : 'Illustrated creative workspace showing Flutter screens, source code, and a developer at work'} fetchPriority="high" className="ff-hero-art block aspect-[1.48] w-full object-cover object-[62%_center] sm:aspect-[1.65]" />
                          <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-[#183e40]/75 to-transparent px-4 pb-3 pt-10 text-white sm:px-5 sm:pb-4">
                            <span className="text-[10px] font-medium sm:text-[11px]">{heroVisual === 'concept' ? 'From a first sketch to a real app.' : 'A focused space for building Flutter.'}</span>
                            <span className="font-mono text-[8px] tracking-wide text-white/75">{heroVisual === 'concept' ? '01 — CREATE' : '02 — SHAPE'}</span>
                          </figcaption>
                        </figure>
                      ) : (
                        <div className="p-2 sm:p-3"><ProductWindow /></div>
                      )}
                    </div>
                    <p className="mt-3 text-center text-[9px] text-[var(--ff-text-dim)]">A local-first Flutter studio · explore the sketches or try the interactive preview</p>
                  </div>
                </Parallax>
              </div>
            </div>
          </section>

          {/* ── Proof strip ────────────────────────────────────────────── */}
          <section className="ff-proof border-b border-[var(--ff-border)] bg-[var(--ff-surface)]">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-7 gap-y-3 px-4 py-5 sm:px-6 lg:justify-between lg:px-8">
              {PROOF.map(([title, detail]) => (
                <div key={title} className="group flex items-center gap-2 transition-colors">
                  <Check size={12} className="shrink-0 text-[var(--ff-brand-teal)]" />
                  <p className="text-[10px] font-medium text-[var(--ff-text)]">
                    {title}
                  </p>
                  <span className="hidden font-mono text-[8px] text-[var(--ff-text-dim)] xl:inline">{detail}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Workflow ───────────────────────────────────────────────── */}
          <section id="workflow" className="mx-auto max-w-7xl scroll-mt-6 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-4">
                <Reveal>
                  <p className="ff-label flex items-center gap-2 text-[9px] text-[var(--ff-brand-teal)]"><span className="h-px w-5 bg-[var(--ff-brand-teal)]"/>Build system <span className="text-[var(--ff-text-dim)]">/ 04 stages</span></p>
                  <h2 className="ff-display mt-5 text-4xl font-semibold leading-[1.02] text-[var(--ff-text)] sm:text-[52px]">
                    A clear path from idea to app.
                  </h2>
                  <p className="mt-4 max-w-md text-[14px] leading-relaxed text-[var(--ff-text-muted)]">
                    Follow the work as it happens. Every stage leaves something concrete you can inspect, change, and keep.
                  </p>
                  <div className="mt-8 grid max-w-sm grid-cols-2 gap-3 border-t border-[var(--ff-border)] pt-4">
                    <div><p className="font-mono text-[9px] text-[var(--ff-text-dim)]">WORKSPACE</p><p className="mt-1 text-[11px] font-medium text-[var(--ff-text)]">Local files</p></div>
                    <div><p className="font-mono text-[9px] text-[var(--ff-text-dim)]">FEEDBACK</p><p className="mt-1 text-[11px] font-medium text-[var(--ff-text)]">Visible changes</p></div>
                  </div>
                </Reveal>
              </div>

              <div className="lg:col-span-8">
                <Reveal delay={100}>
                  <div className="ff-build-console overflow-hidden rounded-[20px] border border-[var(--ff-border)] bg-[var(--ff-surface)] shadow-[var(--ff-soft-shadow-lg)]">
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--ff-border)] px-4 py-3.5 sm:px-5">
                      <div className="flex items-center gap-2.5"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#55b992] opacity-40"/><span className="relative h-2 w-2 rounded-full bg-[#55b992]"/></span><span className="font-mono text-[9px] font-medium tracking-[0.12em] text-[var(--ff-text)]">BUILD PIPELINE</span></div>
                      <span className="rounded-md border border-[var(--ff-border)] px-2 py-1 font-mono text-[8px] tracking-wide text-[var(--ff-text-dim)]">LOCAL · INSPECTABLE</span>
                    </div>
                    <div className="grid md:grid-cols-[200px_minmax(0,1fr)]">
                      <div className="grid grid-cols-2 gap-1 border-b border-[var(--ff-border)] p-2 md:block md:border-b-0 md:border-r">
                        {STEPS.map((step, index) => <button key={step.number} type="button" aria-pressed={activeStep === index} onClick={() => setActiveStep(index)} className={cn('group flex min-h-[52px] w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-left transition-colors md:gap-3 md:px-3', activeStep === index ? 'bg-[var(--ff-brand-teal)]/10 text-[var(--ff-text)]' : 'text-[var(--ff-text-muted)] hover:bg-[var(--ff-surface-2)]')}><span className={cn('font-mono text-[9px]', activeStep === index ? 'text-[var(--ff-brand-teal)]' : 'text-[var(--ff-text-dim)]')}>{step.number}</span><span className="text-[10px] font-medium leading-tight md:text-[11px]">{step.title}</span><span className={cn('ml-auto hidden h-1.5 w-1.5 shrink-0 rounded-full md:block', activeStep === index ? 'bg-[var(--ff-brand-teal)]' : 'bg-[var(--ff-border)]')}/></button>)}
                      </div>
                      <div aria-live="polite" className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_220px]">
                        <div className="min-w-0 p-5 sm:p-7">
                          <p className="ff-label text-[9px] text-[var(--ff-brand-teal)]">Stage {STEPS[activeStep].number} <span className="px-1 text-[var(--ff-text-dim)]">/</span> 04</p>
                          <h3 className="ff-display mt-3 text-[22px] font-semibold leading-tight text-[var(--ff-text)] sm:text-[27px]">{STEPS[activeStep].title}</h3>
                          <p className="mt-3 max-w-md text-[12px] leading-[1.75] text-[var(--ff-text-muted)] sm:text-[13px]">{STEPS[activeStep].copy}</p>
                          <p className="ff-label mt-6 text-[8px] text-[var(--ff-text-dim)]">YOU CAN INSPECT</p>
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            {['Source files', 'Build output', 'Project on disk'].slice(0, activeStep === 0 ? 1 : activeStep === 1 ? 2 : 3).map((tag) => <span key={tag} className="inline-flex min-h-7 items-center rounded-md border border-[var(--ff-border)] bg-[var(--ff-bg)] px-2.5 text-[9px] font-medium text-[var(--ff-text-muted)]">{tag}</span>)}
                          </div>
                        </div>
                        <div className="ff-artifact-well hidden items-center justify-center overflow-hidden border-l border-[var(--ff-border)] p-5 lg:flex">
                          <div className="ff-artifact-scene" aria-label={`Artifact preview: ${PIPELINE_ARTIFACTS[activeStep].title}`}>
                            <div className="ff-artifact-shadow"/>
                            <div className="ff-artifact-card ff-artifact-card-back"><span className="ff-artifact-dot"/><span className="ff-artifact-line w-2/3"/><span className="ff-artifact-line w-1/2"/></div>
                            <div className="ff-artifact-card ff-artifact-card-mid"><span className="ff-artifact-folder">/ lib</span><span className="ff-artifact-line w-full"/><span className="ff-artifact-line w-4/5"/><span className="ff-artifact-line w-3/5"/></div>
                            <div className="ff-artifact-card ff-artifact-card-front"><div className="flex items-center gap-1.5"><Code2 size={11}/><span>{PIPELINE_ARTIFACTS[activeStep].file}</span></div><p>{PIPELINE_ARTIFACTS[activeStep].title}</p><small>{PIPELINE_ARTIFACTS[activeStep].meta}</small><div className="ff-artifact-progress"><i/></div></div>
                          </div>
                          <p className="ff-label absolute bottom-4 text-[7px] text-[var(--ff-text-dim)]">ARTIFACT VIEW · {PIPELINE_ARTIFACTS[activeStep].file}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Reveal>
              </div>
            </div>
          </section>

          <SvgFollowScroll />

          {/* ── Features ───────────────────────────────────────────────── */}
          <section id="product" className="relative scroll-mt-20 border-y border-[var(--ff-border)] bg-[var(--ff-surface)]">
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <Reveal>
                  <p className="ff-label text-[9px] text-[var(--ff-brand-teal)]">Product</p>
                  <h2 className="ff-display mt-3 max-w-xl text-3xl font-semibold leading-tight text-[var(--ff-text)] sm:text-4xl">
                    From first sketch to a running Flutter app.
                  </h2>
                </Reveal>
                <Reveal delay={100}>
                  <p className="max-w-sm text-[13px] leading-relaxed text-[var(--ff-text-muted)]">
                    A visual tour of the studio, the source it creates, and the devices you can target.
                  </p>
                </Reveal>
              </div>

              <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-12">
                {PRODUCT_STORIES.map((story, index) => (
                  <Reveal key={story.title} delay={index * 70} className={story.span}>
                    <article className="group h-full overflow-hidden rounded-[18px] border border-[var(--ff-border)] bg-[var(--ff-bg)] shadow-[var(--ff-soft-shadow)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--ff-soft-shadow-lg)]">
                      <div className={cn('overflow-hidden bg-[#f8d7bb]', story.imageClass)}>
                        <img src={story.image} alt={story.alt} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.035]" />
                      </div>
                      <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-end sm:p-5">
                        <div>
                          <p className="ff-label text-[8px] text-[var(--ff-brand-teal)]">{story.label}</p>
                          <h3 className="ff-display mt-2 text-lg font-semibold text-[var(--ff-text)] sm:text-xl">{story.title}</h3>
                          <p className="mt-2 max-w-lg text-[11px] leading-relaxed text-[var(--ff-text-muted)] sm:text-[12px]">{story.copy}</p>
                        </div>
                        <span className="hidden h-8 w-8 items-center justify-center rounded-full border border-[var(--ff-border)] text-[var(--ff-brand-teal)] transition-all group-hover:border-[var(--ff-brand-teal)] group-hover:bg-[var(--ff-brand-teal)] group-hover:text-white sm:flex" aria-hidden="true"><ArrowRight size={14} /></span>
                      </div>
                    </article>
                  </Reveal>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-2 border-t border-[var(--ff-border)] pt-5">
                {['Compile repair loop', 'Supabase when needed', 'Desktop-ready export', 'Editable Flutter source'].map((item) => <span key={item} className="rounded-full border border-[var(--ff-border)] bg-[var(--ff-bg)] px-3 py-1.5 text-[9px] font-medium text-[var(--ff-text-muted)]">{item}</span>)}
              </div>
            </div>
          </section>

          {/* ── Desktop / export ──────────────────────────────────────── */}
          <section id="desktop" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <Reveal>
                <p className="ff-label text-[9px] text-[var(--ff-brand-teal)]">Desktop</p>
                <h2 className="ff-display mt-3 text-3xl font-semibold leading-tight text-[var(--ff-text)] sm:text-4xl">
                  Web preview today. Native macOS and Windows when you ship.
                </h2>
                <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-[var(--ff-text-muted)]">
                  The same Flutter project runs on desktop. Choose the target in the wizard, keep
                  platform-specific code guarded, and add the runner folders on export.
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    'Desktop-safe widgets and responsive breakpoints',
                    'Keyboard shortcuts and hover states, not touch-only assumptions',
                    'One-command macOS/Windows runner setup',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[13px] text-[var(--ff-text-muted)]">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--ff-brand-teal)]/10">
                        <Check size={10} className="text-[var(--ff-brand-teal)]" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </Reveal>

              <Reveal delay={120}>
                <Parallax speed={0.05}>
                  <div className="overflow-hidden rounded-2xl border border-[var(--ff-border)] bg-[var(--ff-surface)] shadow-[var(--ff-soft-shadow-lg)] transition-transform duration-500 hover:-translate-y-1">
                    <div className="flex items-center gap-1.5 border-b border-[var(--ff-border)] bg-[var(--ff-surface-2)] px-3 py-2">
                      <span className="h-2 w-2 rounded-full bg-[#f07067]" />
                      <span className="h-2 w-2 rounded-full bg-[#f2d45c]" />
                      <span className="h-2 w-2 rounded-full bg-[#7dd8b5]" />
                      <span className="ml-2 font-mono text-[9px] text-[var(--ff-text-dim)]">FLUTTER TARGETS / RESPONSIVE</span>
                    </div>
                    <figure>
                      <img src="/assets/landing/from-sketch-dashboard.webp" alt="App dashboard concepts moving from a sketch to phone and laptop layouts" loading="lazy" className="block aspect-[1.5] w-full object-cover" />
                      <figcaption className="flex items-center justify-between gap-3 border-t border-[var(--ff-border)] bg-[var(--ff-surface)] px-4 py-3">
                        <span className="text-[10px] font-medium text-[var(--ff-text)]">One Flutter project. Multiple screen sizes.</span>
                        <span className="font-mono text-[8px] text-[var(--ff-text-dim)]">WEB · MOBILE · DESKTOP</span>
                      </figcaption>
                    </figure>
                  </div>
                </Parallax>
              </Reveal>
            </div>
          </section>

          {/* ── FAQ ────────────────────────────────────────────────────── */}
          <section id="faq" className="scroll-mt-6 border-t border-[var(--ff-border)] bg-[var(--ff-surface)]">
            <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-12 lg:px-8">
              <div className="lg:col-span-4">
                <Reveal>
                  <p className="ff-label text-[9px] text-[var(--ff-brand-teal)]">FAQ</p>
                  <h2 className="ff-display mt-3 text-3xl font-semibold text-[var(--ff-text)] sm:text-4xl">Questions, answered plainly.</h2>
                </Reveal>
              </div>
              <div className="lg:col-span-8">
                <div className="divide-y divide-[var(--ff-border)] border-y border-[var(--ff-border)]">
                  {FAQS.map((item, index) => (
                    <Reveal key={item.q} delay={index * 50}>
                      <details className="group py-5">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
                          <span className="text-[14px] font-medium text-[var(--ff-text)] transition-colors group-hover:text-[var(--ff-brand-teal)]">{item.q}</span>
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--ff-border)] transition-all duration-300 group-open:rotate-180 group-open:border-[var(--ff-brand-teal)]/40 group-open:bg-[var(--ff-brand-teal)]/10">
                            <ChevronDown size={13} className="text-[var(--ff-text-dim)] transition-colors group-open:text-[var(--ff-brand-teal)]" />
                          </span>
                        </summary>
                        <p className="mt-3 max-w-3xl animate-[ff-rise_0.35s_cubic-bezier(0.16,1,0.3,1)] text-[13px] leading-relaxed text-[var(--ff-text-muted)]">{item.a}</p>
                      </details>
                    </Reveal>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── Project Team ────────────────────────────────────────────── */}
          <section id="team" className="scroll-mt-6 border-t border-[var(--ff-border)] bg-[var(--ff-surface)]">
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
              <Reveal>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-[var(--ff-border)] bg-[var(--ff-bg)] px-3 py-1 text-[11px] text-[var(--ff-brand-teal)] shadow-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--ff-brand-teal)]" />
                      <span className="font-medium">OnUs Devs · Engineering Team</span>
                    </div>
                    <h2 className="ff-display mt-4 text-3xl font-semibold tracking-tight text-[var(--ff-text)] sm:text-4xl">
                      Engineered by students. <span className="ff-gradient-text">Guided by research.</span>
                    </h2>
                    <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[var(--ff-text-muted)]">
                      FlutterForge was created as a final-year academic capstone initiative exploring local agentic synthesis, automated compiler repair loops, and native multiplatform Flutter app generation.
                    </p>
                  </div>
                  <div className="shrink-0 font-mono text-[11px] text-[var(--ff-text-dim)]">
                    Capstone Phase 2 · 2026–2027
                  </div>
                </div>
              </Reveal>

              {/* Team Members Grid */}
              <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    name: 'Shradha Takkekar',
                    role: 'Full-Stack & UX Architecture',
                    initials: 'ST',
                    desc: 'Crafted the workspace interface, Monaco code integration, and responsive layout systems.',
                  },
                  {
                    name: 'Srushti Churamari',
                    role: 'Compiler & Runtime Pipeline',
                    initials: 'SC',
                    desc: 'Engineered the hot-reload web preview server, Dart compiler bridge, and repair telemetry.',
                  },
                  {
                    name: 'Vijeta Kotnikallamath',
                    role: 'AI Agent & Context Synthesis',
                    initials: 'VK',
                    desc: 'Developed prompt schema, context pruning, and automated error-feedback repair loops.',
                  },
                  {
                    name: 'Ulavayya Karaguppi',
                    role: 'Core Engine & Desktop Bridge',
                    initials: 'UK',
                    desc: 'Built the local-first Node harness, Electron desktop bridge, and native export pipeline.',
                  },
                ].map((member, i) => (
                  <Reveal key={member.name} delay={i * 80}>
                    <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-[var(--ff-border)] bg-[var(--ff-bg)] p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[var(--ff-brand-teal)]/40 hover:shadow-[var(--ff-soft-shadow)]">
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface-2)] font-mono text-sm font-semibold text-[var(--ff-brand-teal)] shadow-sm group-hover:border-[var(--ff-brand-teal)]/50 group-hover:bg-[var(--ff-brand-teal)]/10">
                            {member.initials}
                          </div>
                          <span className="rounded-md border border-[var(--ff-border)] bg-[var(--ff-surface)] px-2 py-0.5 font-mono text-[10px] text-[var(--ff-text-dim)]">
                            Contributor
                          </span>
                        </div>
                        <h3 className="mt-5 text-[15px] font-semibold text-[var(--ff-text)] group-hover:text-[var(--ff-brand-teal)] transition-colors">
                          {member.name}
                        </h3>
                        <p className="mt-1 text-[11px] font-medium text-[var(--ff-brand-teal)]">
                          {member.role}
                        </p>
                        <p className="mt-3 text-[12px] leading-relaxed text-[var(--ff-text-muted)]">
                          {member.desc}
                        </p>
                      </div>
                      <div className="mt-5 border-t border-[var(--ff-border)]/60 pt-3 text-[10px] text-[var(--ff-text-dim)]">
                        Dept. of Computer Science &amp; Engineering
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>

              {/* Academic Guidance & Institutional Affiliation Banner */}
              <Reveal delay={200}>
                <div className="mt-8 relative overflow-hidden rounded-2xl border border-[var(--ff-border)] bg-[var(--ff-bg)] p-6 sm:p-8">
                  <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--ff-brand-teal)]/10 text-[var(--ff-brand-teal)] border border-[var(--ff-brand-teal)]/30">
                        <GraduationCap size={24} />
                      </div>
                      <div>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--ff-brand-teal)]">
                          Academic Mentorship &amp; Project Guide
                        </span>
                        <h3 className="mt-1 text-base font-semibold text-[var(--ff-text)]">
                          Mrs. Sahana Bisalapur
                          <span className="ml-2 font-normal text-[13px] text-[var(--ff-text-muted)]">· Assistant Professor</span>
                        </h3>
                        <p className="mt-2 text-[12px] leading-relaxed text-[var(--ff-text-muted)]">
                          Guided under the Department of Computer Science &amp; Engineering, providing key architectural feedback on compiler orchestration, sandboxing constraints, and evaluation methodologies.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface-2)]/60 p-4 text-[11px] leading-relaxed text-[var(--ff-text-muted)]">
                      <p className="font-semibold text-[var(--ff-text)]">
                        S. G. Balekundri Institute of Technology, Belagavi
                      </p>
                      <p className="mt-1 text-[var(--ff-text-dim)]">
                        Affiliated to Visvesvaraya Technological University (VTU)
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[10px]">
                        <span className="rounded bg-[var(--ff-surface)] px-2 py-0.5 border border-[var(--ff-border)] text-[var(--ff-text)]">
                          Major Project
                        </span>
                        <span className="rounded bg-[var(--ff-surface)] px-2 py-0.5 border border-[var(--ff-border)] text-[var(--ff-brand-teal)]">
                          Capstone Phase 2
                        </span>
                        <span className="rounded bg-[var(--ff-surface)] px-2 py-0.5 border border-[var(--ff-border)] text-[var(--ff-text-dim)]">
                          2026–2027
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </section>

          {/* ── CTA ────────────────────────────────────────────────────── */}
          <section id="start" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <Reveal>
              <div className="ff-cta-panel relative overflow-hidden rounded-3xl border border-[var(--ff-border)] bg-[var(--ff-surface)] shadow-[var(--ff-soft-shadow-lg)]">
                <div className="pointer-events-none absolute inset-0" aria-hidden>
                  <div className="ff-studio-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_60%_80%_at_80%_50%,black,transparent)]" />
                  <Parallax speed={0.15} className="absolute -left-20 bottom-0 h-56 w-56">
                    <div className="ff-orb ff-orb-lavender h-full w-full" />
                  </Parallax>
                  <div className="ff-hero-glow absolute -right-24 -top-24 h-[300px] w-[420px]" />
                </div>
                <div className="relative grid gap-8 p-8 sm:p-12 lg:grid-cols-[minmax(0,1fr)_180px_auto] lg:items-center">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <BrandLogo size={30} />
                      <span className="ff-display text-sm font-semibold text-[var(--ff-text)]">FlutterForge</span>
                    </div>
                    <h2 className="ff-display mt-5 max-w-xl text-3xl font-semibold leading-tight text-[var(--ff-text)] sm:text-4xl">
                      Start with an idea. <span className="ff-gradient-text">Leave with a project.</span>
                    </h2>
                    <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-[var(--ff-text-muted)]">
                      Local project files, a live Flutter preview, and code you can take with you.
                    </p>
                  </div>
                  <img src="/assets/landing/app-workbench.webp" alt="Illustrated Flutter app development workbench with phone, desktop, and code preview" loading="lazy" className="hidden aspect-square w-[180px] rounded-2xl border border-[var(--ff-border)] object-cover shadow-[var(--ff-soft-shadow)] lg:block" />
                  <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                    <Link
                      to={session ? '/dashboard' : '/signup'}
                      className="ff-cta inline-flex items-center gap-1.5 rounded-lg px-5 py-3 text-[13px] font-medium"
                    >
                      Start building <ArrowRight size={14} />
                    </Link>
                    <a
                      href="#workflow"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ff-border)] bg-[var(--ff-bg)] px-5 py-3 text-[13px] font-medium text-[var(--ff-text)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--ff-brand-teal)]/50"
                    >
                      How it works
                    </a>
                  </div>
                </div>
              </div>
            </Reveal>
          </section>
        </main>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        {/* ── Footer panel — uses the same ff-brand surface tokens as the page ── */}
          <footer
            className="relative overflow-hidden border-t border-[var(--ff-border)] bg-[var(--ff-surface)]"
            aria-label="Site footer"
          >
            {/* Gradient accent line along top edge */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, var(--ff-primary) 35%, #F07067 65%, transparent 100%)',
                opacity: 0.6,
              }}
              aria-hidden
            />

            {/* Soft ambient glow — visible in dark landing mode, invisible on cream */}
            <div className="ff-hero-glow pointer-events-none absolute -top-24 left-1/4 h-64 w-96 opacity-50" aria-hidden />

            <div className="mx-auto max-w-[1400px] px-4 pt-14 pb-8 sm:px-6 lg:px-10">

              {/* ── 5-column grid ─────────────────────────────────────── */}
              <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1.1fr_1fr_1fr]">

                {/* ── Col 1: Brand ──────────────────────────────────────── */}
                <div className="flex flex-col gap-5">
                  <Link
                    to="/"
                    aria-label="FlutterForge home"
                    className="inline-flex w-fit items-center gap-3 rounded-lg transition-opacity hover:opacity-80"
                  >
                    <BrandLogo size={30} />
                    <div className="flex flex-col leading-tight">
                      <span className="ff-display text-[14px] font-semibold tracking-tight text-[var(--ff-text)]">
                        FlutterForge
                      </span>
                      <span className="ff-label text-[8px] tracking-[0.14em] text-[var(--ff-primary)]">
                        Local-First · Flutter IDE
                      </span>
                    </div>
                  </Link>

                  <p className="max-w-[260px] text-[12px] leading-relaxed text-[var(--ff-text-muted)]">
                    Describe an app. Get editable Flutter source and a live web preview, with your project files kept in a local workspace.
                  </p>

                  <div className="flex flex-col gap-2.5">
                    <Link
                      to={session ? '/dashboard' : '/signup'}
                      className="ff-cta inline-flex w-fit items-center gap-2 rounded-lg px-4 py-2 text-[12px] font-semibold"
                    >
                      {session ? 'Open Dashboard' : 'Start Building'}
                      <ArrowRight size={13} />
                    </Link>
                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--ff-text-dim)]">
                      <ShieldCheck size={12} className="shrink-0 text-[var(--ff-primary)]" />
                      <span>Local workspace · provider-powered AI</span>
                    </div>
                  </div>

                  {/* Engine status pill */}
                  <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--ff-border)] bg-[var(--ff-surface-2)] px-3 py-1.5 text-[10px] text-[var(--ff-text-muted)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--ff-brand-teal)]" />
                    <span>Flutter web · desktop export</span>
                  </div>
                </div>

                {/* ── Col 2: Product ────────────────────────────────────── */}
                <div>
                  <p className="ff-label mb-4 text-[9px] tracking-[0.14em] text-[var(--ff-text-dim)]">
                    Product
                  </p>
                  <ul className="flex flex-col gap-2.5">
                    {[
                      { href: '#workflow', label: 'How it works' },
                      { href: '#product', label: 'Feature overview' },
                      { href: '#desktop', label: 'Desktop export' },
                      { href: '#faq', label: 'Technical FAQ' },
                      { href: '#team', label: 'Project team' },
                    ].map(({ href, label }) => (
                      <li key={href}>
                        <a
                          href={href}
                          className="group inline-flex items-center gap-2 text-[12px] text-[var(--ff-text-muted)] transition-all duration-150 hover:text-[var(--ff-text)]"
                        >
                          <span className="h-px w-3 rounded-full bg-[var(--ff-border)] transition-all duration-200 group-hover:w-5 group-hover:bg-[var(--ff-primary)]" />
                          {label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* ── Col 3: Stack ──────────────────────────────────────── */}
                <div>
                  <p className="ff-label mb-4 text-[9px] tracking-[0.14em] text-[var(--ff-text-dim)]">
                    Stack
                  </p>
                  <ul className="flex flex-col gap-3.5">
                    {[
                      { Icon: Terminal, label: 'Node.js 20+', sub: 'Harness bridge' },
                      { Icon: Code2, label: 'Flutter SDK', sub: 'Managed on first preview' },
                      { Icon: Cpu, label: 'AI provider', sub: 'Configured for your account' },
                      { Icon: Layers, label: 'Supabase', sub: 'Auth & sync' },
                    ].map(({ Icon, label, sub }) => (
                      <li key={label} className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--ff-border)] bg-[var(--ff-surface-2)]">
                          <Icon size={13} className="text-[var(--ff-primary)]" />
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-[var(--ff-text)]">{label}</p>
                          <p className="text-[10px] text-[var(--ff-text-dim)]">{sub}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* ── Col 4: Legal ──────────────────────────────────────── */}
                <div>
                  <p className="ff-label mb-4 text-[9px] tracking-[0.14em] text-[var(--ff-text-dim)]">
                    Legal
                  </p>
                  <ul className="flex flex-col gap-2.5 mb-5">
                    {[
                      { to: '/legal/terms', label: 'Terms of use' },
                      { to: '/legal/privacy', label: 'Privacy notice' },
                      { to: '/legal/permissions', label: 'Permissions' },
                    ].map(({ to, label }) => (
                      <li key={to}>
                        <Link
                          to={to}
                          className="group inline-flex items-center gap-2 text-[12px] text-[var(--ff-text-muted)] transition-all duration-150 hover:text-[var(--ff-text)]"
                        >
                          <span className="h-px w-3 rounded-full bg-[var(--ff-border)] transition-all duration-200 group-hover:w-5 group-hover:bg-[var(--ff-accent)]" />
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <div className="rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface-2)] p-3 text-[10px] leading-relaxed text-[var(--ff-text-dim)]">
                    <p className="font-semibold text-[var(--ff-text-muted)]">Academic Capstone</p>
                    <p className="mt-1">Phase 2 · 2026–2027<br />SGBIT Belagavi · VTU</p>
                  </div>
                </div>

                {/* ── Col 5: Navigate ───────────────────────────────────── */}
                <div className="flex flex-col justify-between gap-8">
                  <div>
                    <p className="ff-label mb-4 text-[9px] tracking-[0.14em] text-[var(--ff-text-dim)]">
                      Navigate
                    </p>
                    <ul className="flex flex-col gap-2">
                      {LANDING_SECTIONS.map(({ id, label }) => (
                        <li key={id}>
                          <button
                            type="button"
                            onClick={() => scrollToSection(id)}
                            className="group inline-flex items-center gap-2 text-[12px] text-[var(--ff-text-muted)] transition-colors hover:text-[var(--ff-text)]"
                          >
                            <span className="h-px w-3 rounded-full bg-[var(--ff-border)] transition-all duration-200 group-hover:w-4 group-hover:bg-[var(--ff-primary)]" />
                            {label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => scrollToTarget(0, 0)}
                    className="inline-flex w-fit items-center gap-2 rounded-lg border border-[var(--ff-border)] bg-[var(--ff-surface-2)] px-3.5 py-2 text-[11px] font-medium text-[var(--ff-text-muted)] transition-all hover:border-[var(--ff-primary)]/50 hover:text-[var(--ff-text)] hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <ArrowUp size={12} className="text-[var(--ff-primary)]" />
                    Back to top
                  </button>
                </div>
              </div>

              {/* ── Bottom bar ──────────────────────────────────────────── */}
              <div className="mt-10 flex flex-col gap-3 border-t border-[var(--ff-border)] pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--ff-text-dim)]">
                  <span>© {new Date().getFullYear()} FlutterForge</span>
                  <span className="text-[var(--ff-border)]">·</span>
                  <span>
                    Engineered by{' '}
                    <span className="font-medium text-[var(--ff-text-muted)]">OnUs Devs</span>
                  </span>
                  <span className="text-[var(--ff-border)]">·</span>
                  <span>S. G. Balekundri Institute of Technology, Belagavi · VTU</span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {['Local workspace', 'Flutter Web', 'Desktop export'].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border border-[var(--ff-border)] bg-[var(--ff-surface-2)] px-2 py-0.5 font-mono text-[9px] text-[var(--ff-text-dim)]"
                    >
                      {tag}
                    </span>
                  ))}
                  <span className="rounded-md border border-[var(--ff-primary)]/30 bg-[var(--ff-primary)]/10 px-2 py-0.5 font-mono text-[9px] text-[var(--ff-primary)]">
                    Phase 2
                  </span>
                </div>
              </div>
            </div>
          </footer>

      {/* Floating back-to-top */}
      <button
        type="button"
        aria-label="Back to top"
        onClick={() => scrollToTarget(0, 0)}
        className={cn(
          'ff-totop fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--ff-border)] bg-[var(--ff-surface)] text-[var(--ff-brand-teal)] shadow-[var(--ff-soft-shadow-lg)] hover:border-[var(--ff-brand-teal)]/50',
          showTop && 'is-shown',
        )}
      >
        <ArrowUp size={16} />
      </button>
    </div>
  );
}

function ProductWindow() {
  const [display, setDisplay] = useState('1,248');
  const [expression, setExpression] = useState('');
  const accumulator = useRef<number | null>(null);
  const operation = useRef<string | null>(null);
  const replaceNext = useRef(true);

  const currentValue = () => Number(display.replaceAll(',', '')) || 0;
  const formatNumber = (value: number) => Number.isFinite(value)
    ? value.toLocaleString('en-US', { maximumFractionDigits: 8 })
    : 'Error';
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
      const updated = key === '.'
        ? (replaceNext.current || base.includes('.') ? base : `${base}.`)
        : (replaceNext.current || current === '0' ? key : `${base}${key}`);
      setDisplay(updated.length > 12 ? updated.slice(0, 12) : updated);
      replaceNext.current = false;
      return;
    }
    if (['÷', '×', '−', '+'].includes(key)) {
      const value = currentValue();
      const result = accumulator.current !== null && operation.current && !replaceNext.current
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
    <div className="relative">
      <div className="ff-window overflow-hidden rounded-2xl border border-[var(--ff-border)] bg-[var(--ff-surface)] shadow-[var(--ff-soft-shadow-lg)]">
        <div className="flex items-center gap-2 border-b border-[var(--ff-border)] bg-[var(--ff-surface-2)] px-3 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#f07067]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#f2d45c]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#7dd8b5]" />
          <span className="ml-2 truncate font-mono text-[9px] text-[var(--ff-text-dim)]">calcyic — FlutterForge</span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[#7dd8b5]/40 bg-[#7dd8b5]/10 px-2 py-0.5 text-[8px] font-medium text-[#2f7d61]">
            <span className="h-1 w-1 rounded-full bg-[#2f7d61]" />
            interactive demo
          </span>
        </div>

        <div className="grid h-[360px] grid-cols-12 sm:h-[400px]">
          {/* Chat column */}
          <div className="col-span-5 flex min-w-0 flex-col border-r border-[var(--ff-border)] bg-[var(--ff-bg)] p-3">
            <div className="flex items-center gap-1.5 border-b border-[var(--ff-border)] pb-2">
              <BrandLogo size={16} />
              <span className="text-[9px] font-semibold text-[var(--ff-text)]">AI Builder</span>
              <span className="ml-auto font-mono text-[8px] text-[var(--ff-text-dim)]">Context</span>
            </div>
            <div className="mt-2.5 rounded-lg border border-[var(--ff-border)] bg-[var(--ff-surface)] p-2">
              <p className="font-mono text-[7px] uppercase tracking-wide text-[var(--ff-text-dim)]">You</p>
              <p className="mt-1 text-[9px] leading-relaxed text-[var(--ff-text)]">
                Build a polished calculator with history and keyboard support. No backend needed.
              </p>
            </div>
            <div className="mt-2 rounded-lg border border-[var(--ff-border)] bg-[var(--ff-surface)] p-2">
              <div className="flex items-center gap-1">
                <BrandLogo size={12} />
                <p className="text-[8px] font-semibold text-[var(--ff-text)]">FlutterForge</p>
              </div>
              <p className="mt-1 text-[8px] leading-relaxed text-[var(--ff-text-muted)]">
                Built the Flutter files. Preview is live and ready to try.
              </p>
              <div className="mt-1.5 space-y-1">
                {['lib/main.dart', 'lib/screens/calculator_screen.dart', 'pubspec.yaml'].map((file) => (
                  <div key={file} className="flex items-center gap-1 rounded border border-[var(--ff-border)] bg-[var(--ff-bg)] px-1.5 py-0.5">
                    <Code2 size={7} className="text-[var(--ff-text-dim)]" />
                    <span className="truncate font-mono text-[7px] text-[var(--ff-text-muted)]">{file}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-auto rounded-lg border border-[var(--ff-border)] bg-[var(--ff-surface)] px-2 py-1.5">
              <p className="text-[8px] text-[var(--ff-text-dim)]">Ask about the project or describe a change…</p>
            </div>
          </div>

          {/* Code column */}
          <div className="col-span-4 hidden min-w-0 flex-col border-r border-[var(--ff-border)] bg-[#0f1115] sm:flex">
            <div className="flex items-center justify-between border-b border-white/10 px-2.5 py-2">
              <span className="font-mono text-[8px] text-[#8b8578]">calculator_screen.dart</span>
              <span className="font-mono text-[7px] text-[#8b8578]">Dart</span>
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
          <div className="col-span-7 flex items-center justify-center bg-[var(--ff-surface-2)] p-3 sm:col-span-3">
            <div className="w-full max-w-[140px] rounded-[22px] border border-[var(--ff-border)] bg-[#0f1115] p-1 shadow-[var(--ff-soft-shadow)]">
              <div className="rounded-[18px] bg-black p-2">
                <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-white/20" />
                <p className="h-3 truncate text-right font-mono text-[7px] text-white/45">{expression}</p>
                <p aria-live="polite" className="truncate text-right font-mono text-[18px] font-light text-white">{display}</p>
                <div className="mt-2 grid grid-cols-4 gap-1">
                  {['AC', '±', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '='].map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => pressCalculatorKey(key)}
                      aria-label={`Calculator ${key}`}
                      className={cn(
                        'flex h-6 items-center justify-center rounded-full text-[7px] font-medium transition-transform hover:scale-105 active:scale-95',
                        ['÷', '×', '−', '+', '='].includes(key)
                          ? 'bg-[#f2a03d] text-white'
                          : ['AC', '±', '%'].includes(key)
                            ? 'bg-[#3a3a3c] text-white'
                            : 'bg-[#1c1c1e] text-white',
                        key === '0' && 'col-span-2',
                      )}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="ff-compile-badge ff-float absolute -bottom-4 -left-3 inline-flex items-center gap-1.5 rounded-lg border border-[var(--ff-border)] bg-[var(--ff-studio-yellow)] px-2.5 py-1.5 shadow-[var(--ff-soft-shadow)]">
        <Check size={11} className="text-[#141414]" />
        <span className="font-mono text-[8px] font-medium text-[#141414]">sample project · preview ready</span>
      </div>
    </div>
  );
}
