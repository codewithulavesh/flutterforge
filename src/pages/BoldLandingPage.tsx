import {
  useEffect,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Lenis from 'lenis';
import {
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  AppWindow,
  BatteryFull,
  Check,
  Github,
  Globe2,
  Monitor,
  Moon,
  Plus,
  Signal,
  Sun,
  Wifi,
} from 'lucide-react';
import CardNav, { type CardNavItem } from '@/components/CardNav';
import { BrandLogo } from '@/components/BrandLogo';
import { useAuthStore } from '@/stores/auth.store';
import { useThemeStore } from '@/stores/theme.store';
import { HERO_PROMPT_KEY } from '@/utils/landing';
import { cn } from '@/utils/cn';

const REPO = 'https://github.com/codewithulavesh/flutterforge';

const EXAMPLE_PROMPTS = [
  {
    label: 'Personal finance',
    prompt: 'Build a personal finance app with category budgets, a monthly spending chart, and recurring bills.',
    kind: 'finance',
  },
  {
    label: 'Recipe planner',
    prompt: 'Create a recipe planner with a weekly meal calendar, grocery list, and dietary filters.',
    kind: 'recipe',
  },
  {
    label: 'Fitness tracker',
    prompt: 'Design a fitness habit tracker with weekly progress, workout cards, and streaks.',
    kind: 'fitness',
  },
] as const;

const TARGETS = [
  { label: 'Web preview', detail: 'flutter run -d web-server', state: 'Live', icon: Globe2 },
  { label: 'macOS', detail: 'Runner folder prepared', state: 'Export', icon: Monitor },
  { label: 'Windows', detail: 'Runner folder prepared', state: 'Export', icon: AppWindow },
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
  { name: 'Shradha Takkekar', role: 'Full-stack & UX architecture' },
  { name: 'Srushti Churamari', role: 'Compiler & runtime pipeline' },
  { name: 'Vijeta Kotnikallamath', role: 'AI agent & context synthesis' },
  { name: 'Ulavayya Karaguppi', role: 'Core engine & desktop bridge' },
] as const;

const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
let lenis: Lenis | null = null;

function scrollToTarget(target: string | number, offset = -92) {
  if (lenis) {
    lenis.scrollTo(target, { offset, duration: 1.05, easing: easeOutExpo });
    return;
  }
  if (typeof target === 'number') {
    window.scrollTo({ top: target, behavior: 'smooth' });
    return;
  }
  const el = document.querySelector<HTMLElement>(target);
  if (el) {
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + offset, behavior: 'smooth' });
  }
}

function useSmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const instance = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.1, anchors: false });
    lenis = instance;
    let raf = 0;
    const loop = (time: number) => {
      instance.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      instance.destroy();
      lenis = null;
    };
  }, []);
}

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-visible');
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={cn('ffb-reveal min-w-0', className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function Eyebrow({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <p
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em]',
        light
          ? 'border-white/20 text-white/55'
          : 'border-[var(--fb-line)] bg-[var(--fb-card)] text-[var(--fb-muted)]',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', light ? 'bg-[var(--fb-lime)]' : 'bg-[var(--fb-magenta)]')} />
      {children}
    </p>
  );
}

function Sticker({
  children,
  tone,
  className,
}: {
  children: ReactNode;
  tone: 'lime' | 'magenta' | 'cyan';
  className?: string;
}) {
  const background = tone === 'lime' ? 'var(--fb-lime)' : tone === 'magenta' ? 'var(--fb-magenta)' : 'var(--fb-cyan)';
  return (
    <span
      aria-hidden
      style={{ background }}
      className={cn(
        'ffb-float pointer-events-none absolute z-10 rounded-[8px] border-2 border-black px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-black shadow-[3px_3px_0_#000]',
        className,
      )}
    >
      {children}
    </span>
  );
}

function PhoneMock({ className }: { className?: string }) {
  return (
    <div className={cn('ffb-phone relative w-full', className)} aria-hidden>
      <div className="relative overflow-hidden rounded-[30px] bg-[#fbfaf8] text-black">
        <div className="relative flex items-center justify-between px-4 pb-1 pt-3 text-[10px] font-semibold">
          <span>9:41</span>
          <span className="absolute left-1/2 top-2 h-[16px] w-[30%] max-w-[68px] -translate-x-1/2 rounded-full bg-black" />
          <span className="flex items-center gap-1 text-black/80">
            <Signal size={9} strokeWidth={3} />
            <Wifi size={9} strokeWidth={3} />
            <BatteryFull size={11} />
          </span>
        </div>
        <div className="px-4 pt-5 sm:px-5">
          <div className="flex items-center justify-between">
            <span className="ffb-display text-[18px]">habit</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-[10px] font-semibold text-white">
              A
            </span>
          </div>
          <div className="relative mt-4 overflow-hidden rounded-[20px] bg-white p-4 ring-1 ring-black/5">
            <div
              aria-hidden
              className="absolute -right-10 -top-12 h-28 w-28 rounded-full bg-[var(--fb-magenta)] opacity-30 blur-2xl"
            />
            <div className="relative">
              <p className="text-[10px] font-medium text-black/55">This week</p>
              <p className="mt-1 flex items-baseline gap-1">
                <span className="ffb-display text-[34px] leading-none">4</span>
                <span className="text-[12px] font-semibold leading-none text-black/45">/ 7</span>
              </p>
              <p className="mt-1 text-[10px] text-black/55">days on track</p>
              <div className="mt-3 flex h-12 items-end gap-1.5">
                {[34, 52, 40, 66, 58, 24, 18].map((height, index) => (
                  <span
                    key={index}
                    className={cn('flex-1 rounded-full', index === 3 ? 'bg-[var(--fb-magenta)]' : 'bg-black/10')}
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3 flex h-10 w-full items-center justify-center rounded-full bg-black text-[11px] font-semibold text-white">
            + Add habit
          </div>
          <ul className="space-y-2 pb-5 pt-4">
            {['Morning run', 'Read 20 pages', 'Stretch'].map((label, index) => (
              <li key={label} className="flex items-center gap-3 rounded-[14px] bg-white px-3 py-2.5 ring-1 ring-black/5">
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                    index < 2 ? 'bg-[var(--fb-lime)]' : 'border border-black/15',
                  )}
                >
                  {index < 2 ? <Check size={11} strokeWidth={3} /> : null}
                </span>
                <span
                  className={cn(
                    'min-w-0 truncate text-[11px] font-medium',
                    index < 2 && 'text-black/50 line-through',
                  )}
                >
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function CodeCard({ full = false }: { full?: boolean }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-[16px] bg-[#0b0b0b] text-[#d9e4df] shadow-[0_20px_50px_-30px_rgba(0,0,0,0.9)]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2 font-mono text-[9px] text-white/45">
        <span>lib/screens/home_screen.dart</span>
        <span>Dart</span>
      </div>
      <pre
        className={cn(
          'ffb-scrollbar overflow-auto p-4 font-mono text-[10.5px] leading-[1.85]',
          full ? 'h-[420px]' : 'ffb-code-fade h-[178px]',
        )}
      >
        <code>
          <span className="text-[#7ad3d1]">class</span> HomeScreen <span className="text-[#7ad3d1]">extends</span> StatelessWidget {'{\n'}
          {'  '}<span className="text-[#7ad3d1]">const</span> HomeScreen({'{'}super.key, <span className="text-[#7ad3d1]">required</span>{' '}
          <span className="text-[#7ad3d1]">this</span>.goals{'}'});{'\n\n'}
          {'  '}<span className="text-[#7ad3d1]">final</span> List&lt;Goal&gt; goals;{'\n\n'}
          {'  '}<span className="text-[#78908d]">{'// The list is derived, never duplicated.'}</span>{'\n'}
          {'  '}@override{'\n'}
          {'  '}Widget build(BuildContext context) {'{\n'}
          {'    '}<span className="text-[#7ad3d1]">return</span> Scaffold({'\n'}
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
        <Check size={11} className="text-[#8ad9b8]" />
        <span className="font-mono text-[9px] text-white/45">flutter analyze · no issues</span>
      </div>
    </div>
  );
}

const LOG_LINES = [
  { tone: 'ok', text: '✓ wrote lib/main.dart' },
  { tone: 'ok', text: '✓ wrote lib/screens/home_screen.dart' },
  { tone: 'prompt', text: '$ flutter analyze' },
  { tone: 'error', text: 'error • home_screen.dart:42 • title is not defined' },
  { tone: 'prompt', text: '$ ff repair --from analyze' },
  { tone: 'ok', text: 'patch 1/2 applied · rebuilding' },
  { tone: 'ok', text: '✓ analyze clean · preview ready' },
] as const;

function LogCard({ full = false }: { full?: boolean }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-[16px] bg-[#0b0b0b] shadow-[0_20px_50px_-30px_rgba(0,0,0,0.9)]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
        <span className="font-mono text-[10px] text-white/65">build log</span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[9px] text-white/40">
          <span className="h-1.5 w-1.5 rounded-full bg-[#8ad9b8]" />
          local runner
        </span>
      </div>
      <div
        className={cn(
          'ffb-scrollbar space-y-2 overflow-auto p-4 font-mono text-[10.5px] leading-relaxed',
          full ? 'h-[420px]' : 'ffb-code-fade h-[178px]',
        )}
      >
        {LOG_LINES.map((line) => (
          <p
            key={line.text}
            className={
              line.tone === 'error' ? 'text-[#f08a80]' : line.tone === 'ok' ? 'text-[#8ad9b8]' : 'text-white/80'
            }
          >
            {line.text}
          </p>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-white/10 px-4 py-2.5">
        <span className="h-1.5 w-1.5 rounded-full bg-[#8ad9b8]" />
        <span className="font-mono text-[9px] text-white/45">compiler loop closed · no manual step</span>
      </div>
    </div>
  );
}

function UseCaseVisual({ kind }: { kind: 'finance' | 'recipe' | 'fitness' }) {
  if (kind === 'finance') {
    return (
      <div className="rounded-[16px] bg-white p-4 text-black ring-1 ring-black/10">
        <p className="text-[9px] font-medium text-black/55">Spending this month</p>
        <p className="ffb-display mt-1 text-[30px] leading-none">$4,280</p>
        <div className="mt-3 flex h-16 items-end gap-1.5">
          {[42, 68, 34, 88, 56, 74, 48].map((height, index) => (
            <span
              key={index}
              className={cn('flex-1 rounded-full', index === 3 ? 'bg-[var(--fb-magenta)]' : 'bg-black/10')}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {['Groceries', 'Rent', 'Travel'].map((label) => (
            <span key={label} className="rounded-full bg-black/5 px-2 py-1 text-[9px] font-medium">
              {label}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (kind === 'recipe') {
    return (
      <div className="rounded-[16px] bg-white p-4 text-black ring-1 ring-black/10">
        <p className="text-[9px] font-medium text-black/55">This week</p>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
            <span
              key={`${day}-${index}`}
              className={cn(
                'flex h-7 items-center justify-center rounded-[7px] text-[9px] font-semibold',
                index === 2 ? 'bg-[var(--fb-lime)] text-black' : 'bg-black/5',
              )}
            >
              {day}
            </span>
          ))}
        </div>
        <div className="mt-3 space-y-1.5">
          {['Oats + berries', 'Lentil bowl', 'Roast chicken'].map((meal, index) => (
            <div key={meal} className="flex items-center gap-2 rounded-[9px] bg-black/[0.03] px-2 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--fb-magenta)]" />
              <span className={cn('text-[10px] font-medium', index === 2 && 'text-black/55')}>{meal}</span>
              {index < 2 ? <Check size={10} className="ml-auto text-black/50" /> : null}
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-[16px] bg-white p-4 text-black ring-1 ring-black/10">
      <p className="text-[9px] font-medium text-black/55">Current streak</p>
      <p className="ffb-display mt-1 text-[30px] leading-none">
        12<span className="text-[13px]"> days</span>
      </p>
      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {Array.from({ length: 21 }).map((_, index) => (
          <span
            key={index}
            className={cn(
              'aspect-square rounded-[5px]',
              index > 15 ? 'bg-[var(--fb-lime)]' : index > 9 ? 'bg-black/25' : 'bg-black/[0.08]',
            )}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-[10px] bg-black px-2.5 py-2 text-white">
        <span className="text-[9px] font-semibold">Weekly goal</span>
        <span className="ml-auto text-[9px] font-semibold">4 / 5</span>
      </div>
    </div>
  );
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--fb-dim)]">{title}</p>
      <ul className="mt-3 flex flex-col gap-0.5">{children}</ul>
    </div>
  );
}

const footerLink = 'inline-flex min-h-11 items-center text-left text-[12px] text-[var(--fb-muted)] transition-colors hover:text-[var(--fb-ink)] xl:min-h-0';

function NavAnchor({ href, children, ...props }: { href?: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const handleClick = props.onClick;
  if (!href || href.startsWith('#')) {
    return (
      <a
        href={href}
        {...props}
        onClick={(event) => {
          handleClick?.(event);
          if (!href || href.startsWith('#')) {
            event.preventDefault();
            if (href) scrollToTarget(href);
          }
        }}
      >
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

export function BoldLandingPage() {
  const navigate = useNavigate();
  const session = useAuthStore((state) => state.session);
  const { theme, toggle } = useThemeStore();
  const isDark = theme === 'dark';
  const [prompt, setPrompt] = useState('');
  const [tab, setTab] = useState<'preview' | 'source' | 'build'>('preview');

  useSmoothScroll();

  const workspaceHref = session ? '/dashboard' : '/signup';

  function submitPrompt() {
    const text = prompt.trim();
    if (!text) return;
    try {
      sessionStorage.setItem(HERO_PROMPT_KEY, text);
    } catch {
      // storage unavailable — navigation state still carries the prompt
    }
    navigate(workspaceHref, { state: { heroPrompt: text } });
  }

  function useExample(text: string) {
    setPrompt(text);
    scrollToTarget('#hero');
    requestAnimationFrame(() => document.getElementById('hero-prompt')?.focus({ preventScroll: true }));
  }

  function go(id: string) {
    scrollToTarget(`#${id}`);
  }

  const workbenchTabs = ['preview', 'source', 'build'] as const;

  function onWorkbenchTabKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const current = workbenchTabs.indexOf(tab);
    const last = workbenchTabs.length - 1;
    let next = current;
    if (event.key === 'ArrowRight') next = current === last ? 0 : current + 1;
    else if (event.key === 'ArrowLeft') next = current === 0 ? last : current - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    else return;
    event.preventDefault();
    setTab(workbenchTabs[next]);
    document.getElementById(`workbench-tab-${workbenchTabs[next]}`)?.focus();
  }

  const navStyle = {
    '--cn-solid': isDark ? '#17141b' : '#f2f2f2',
    '--cn-panel': isDark ? '#17141b' : '#f2f2f2',
    '--cn-edge': isDark ? 'rgba(255,255,255,0.12)' : 'rgba(5,5,5,0.14)',
    '--cn-highlight': isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.9)',
    '--cn-shadow': isDark ? '0 10px 32px -26px rgba(0,0,0,0.9)' : '0 10px 32px -28px rgba(5,5,5,0.45)',
    '--cn-text': isDark ? '#f7f5ef' : '#050505',
    '--cn-muted': isDark ? 'rgba(247,245,239,0.62)' : 'rgba(5,5,5,0.58)',
    '--cn-hover': isDark ? 'rgba(255,255,255,0.06)' : 'rgba(5,5,5,0.05)',
    '--cn-ring': isDark ? 'rgba(173,255,2,0.7)' : 'rgba(250,0,255,0.55)',
    '--cn-tile': isDark ? '#1e1a22' : '#ffffff',
    '--cn-tile-rim': isDark
      ? 'inset 0 0 0 1px rgba(255,255,255,0.08), 0 2px 8px -4px rgba(0,0,0,0.6)'
      : 'inset 0 0 0 1px rgba(5,5,5,0.1), 0 2px 8px -4px rgba(5,5,5,0.14)',
    '--cn-cta': isDark ? '#f7f5ef' : '#050505',
    '--cn-cta-ink': isDark ? '#0e0b0f' : '#f2f2f2',
    '--cn-cta-shadow': 'none',
    '--cn-cta-hover': isDark ? 'brightness(0.94)' : 'brightness(1.18)',
    '--cn-radius': '14px',
  } as CSSProperties;

  const navItems: CardNavItem[] = [
    {
      label: 'Build',
      description: 'From a prompt to a running Flutter app.',
      links: [
        { label: 'How it works', href: '#workflow' },
        { label: 'Workbench', href: '#workbench' },
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
      links: [{ label: session ? 'Dashboard' : 'Sign in', href: session ? '/dashboard' : '/login' }],
    },
  ];

  return (
    <div className="ff-bold min-h-screen">
      {/* ── Masthead ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-[var(--fb-line)] bg-[var(--fb-bg)] px-3 py-2.5 sm:px-6">
        <div className="mx-auto flex max-w-[1440px] items-center gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <CardNav
              logo={
                <span className="flex h-6 items-center gap-2.5">
                  <BrandLogo size={24} />
                  <span className="ffb-display whitespace-nowrap text-[15px] tracking-[-0.02em]">FlutterForge</span>
                </span>
              }
              logoAlt="FlutterForge home"
              logoHref="/"
              items={navItems}
              cta={{ label: session ? 'Open dashboard' : 'Start building', href: workspaceHref }}
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
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-[var(--fb-line)] bg-transparent text-[var(--fb-muted)] transition-colors hover:border-[var(--fb-ink)] hover:text-[var(--fb-ink)]"
            aria-label={isDark ? 'Switch to light appearance' : 'Switch to dark appearance'}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      <main>
        {/* ── Hero ───────────────────────────────────────────────────── */}
        <section id="hero" className="relative overflow-hidden px-4 pb-16 pt-12 scroll-mt-28 sm:pt-16">
          <div className="mx-auto max-w-[1440px]">
            <Reveal className="text-center">
              <Eyebrow>A local Flutter studio</Eyebrow>
              <h1 className="ffb-display ffb-caps mx-auto mt-6 max-w-[1200px] text-[clamp(40px,12.2vw,164px)] leading-[0.82] tracking-[-0.045em]">
                Your IDE
                <br />
                won't do this
              </h1>
              <p className="mx-auto mt-6 max-w-[38rem] text-[14.5px] leading-relaxed text-[var(--fb-muted)] sm:text-[16px]">
                Brief an app in plain language. FlutterForge writes real Dart files, runs a live preview, repairs compile
                errors, and leaves the project on your machine.
              </p>
            </Reveal>

            <Reveal delay={90} className="mx-auto mt-8 max-w-[720px]">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submitPrompt();
                }}
              >
                <label htmlFor="hero-prompt" className="sr-only">
                  Describe the app you want to build
                </label>
                <div className="flex flex-col gap-2 rounded-[24px] border border-[var(--fb-line)] bg-[var(--fb-card)] p-2 transition-colors focus-within:border-[var(--fb-ink)] sm:flex-row sm:items-center sm:rounded-full sm:pl-5">
                  <input
                    id="hero-prompt"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    maxLength={2000}
                    placeholder="A habit tracker with weekly goals"
                    className="min-h-11 min-w-0 flex-1 bg-transparent px-2 text-[13px] text-[var(--fb-ink)] outline-none placeholder:text-[var(--fb-dim)]"
                  />
                  <button
                    type="submit"
                    disabled={!prompt.trim()}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--fb-ink)] px-5 text-[12px] font-semibold text-[var(--fb-bg)] transition-transform hover:-translate-y-px disabled:pointer-events-none disabled:bg-[var(--fb-soft)] disabled:text-[var(--fb-muted)]"
                  >
                    Generate
                    <ArrowRight size={14} />
                  </button>
                </div>
              </form>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                <span className="mr-1 text-[11px] text-[var(--fb-dim)]">Try an idea</span>
                {EXAMPLE_PROMPTS.map((example) => (
                  <button
                    key={example.label}
                    type="button"
                    onClick={() => setPrompt(example.prompt)}
                    className={cn(
                      'h-11 rounded-full border px-3.5 text-[11px] font-medium transition-colors',
                      prompt === example.prompt
                        ? 'border-[var(--fb-ink)] bg-[var(--fb-ink)] text-[var(--fb-bg)]'
                        : 'border-[var(--fb-line)] bg-[var(--fb-card)] text-[var(--fb-muted)] hover:border-[var(--fb-ink)] hover:text-[var(--fb-ink)]',
                    )}
                  >
                    {example.label}
                  </button>
                ))}
              </div>
            </Reveal>

            <Reveal delay={160} className="relative mx-auto mt-14 max-w-[1040px]">
              <Sticker tone="lime" className="-left-3 top-8 hidden lg:inline-flex">
                Dart 3
              </Sticker>
              <Sticker tone="magenta" className="ffb-float-late -right-2 top-24 hidden lg:inline-flex">
                Live preview
              </Sticker>
              <Sticker tone="cyan" className="-bottom-4 right-8 hidden lg:inline-flex">
                No lock-in
              </Sticker>

              <div className="overflow-hidden rounded-[28px] border-[8px] border-[#0a0a0a] bg-white shadow-[0_50px_100px_-52px_rgba(0,0,0,0.7)] sm:rounded-[36px] sm:border-[10px]">
                <div className="flex items-center gap-2 border-b border-black/10 px-4 py-2.5">
                  <span className="flex gap-1.5" aria-hidden>
                    <span className="h-2 w-2 rounded-full bg-black/15" />
                    <span className="h-2 w-2 rounded-full bg-black/15" />
                    <span className="h-2 w-2 rounded-full bg-black/15" />
                  </span>
                  <span className="ml-2 rounded-full bg-black/5 px-2.5 py-1 font-mono text-[9px] text-black/60">
                    habit.local
                  </span>
                  <span className="ml-auto hidden items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-black/55 sm:flex">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--fb-lime)]" />
                    Preview ready
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="p-4 sm:p-6">
                    <div className="rounded-[18px] bg-[#f4f4f4] p-4">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-black/55">You</p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-black">
                        Build a habit tracker with weekly goals, streaks and a clean daily check-in.
                      </p>
                    </div>

                    <div className="mt-3 rounded-[18px] border border-black/10 p-4">
                      <div className="flex items-center gap-2">
                        <BrandLogo size={16} />
                        <span className="text-[11px] font-semibold text-black">FlutterForge</span>
                        <span className="ml-auto rounded-full bg-[var(--fb-lime)] px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.08em] text-black">
                          Ready
                        </span>
                      </div>
                      <ul className="mt-3 space-y-1.5 font-mono text-[10px] text-black/55">
                        <li>✓ lib/main.dart</li>
                        <li>✓ lib/screens/home_screen.dart</li>
                        <li>✓ flutter analyze · no issues</li>
                      </ul>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {['Dart 3', 'Web preview', '2 repair rounds', 'Local source'].map((chip) => (
                        <span
                          key={chip}
                          className="rounded-full border border-black/10 px-2.5 py-1 text-[9.5px] font-medium text-black/55"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-center border-t border-black/10 bg-[#ededed] p-5 md:border-l md:border-t-0">
                    <PhoneMock className="max-w-[260px]" />
                  </div>
                </div>
              </div>

              <p className="mt-4 text-center text-[11px] text-[var(--fb-muted)]">
                One brief. Real source. A running preview.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ── How it works ───────────────────────────────────────────── */}
        <section id="workflow" className="scroll-mt-28 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-[1440px]">
            <Reveal className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Eyebrow>01 — The loop</Eyebrow>
                <h2 className="ffb-display mt-4 max-w-[760px] text-[clamp(40px,5.6vw,64px)]">
                  How FlutterForge works
                </h2>
              </div>
              <p className="max-w-sm text-[13.5px] leading-relaxed text-[var(--fb-muted)]">
                A visible loop: brief, build, repair, preview. No hidden hand-off between the idea and the files.
              </p>
            </Reveal>

            <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
              <Reveal>
                <article className="flex h-full flex-col rounded-[24px] bg-[var(--fb-card)] p-5 text-[var(--fb-ink)] ring-1 ring-[var(--fb-line)]">
                  <div className="flex-1 rounded-[18px] bg-[#f4f4f4] p-4">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-black/55">Your brief</p>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-black">
                      A fitness tracker with weekly progress, workout cards and streaks.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {['Screens', 'State', 'Theme'].map((chip) => (
                        <span key={chip} className="rounded-full bg-white px-2 py-1 text-[9px] font-medium text-black/55">
                          {chip}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="mt-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--fb-dim)]">01</p>
                    <h3 className="mt-1 text-[16px] font-semibold">Describe the app</h3>
                    <p className="mt-1 text-[12px] leading-relaxed text-[var(--fb-muted)]">
                      One sentence is enough. The builder plans screens, state and theme before it writes a file.
                    </p>
                  </div>
                </article>
              </Reveal>

              <Reveal delay={80}>
                <article className="relative flex h-full flex-col overflow-hidden rounded-[24px] bg-[var(--fb-lime)] p-5 text-black">
                  <div aria-hidden className="ffb-dots pointer-events-none absolute inset-0 opacity-25" />
                  <div className="relative flex-1">
                    <CodeCard />
                  </div>
                  <div className="relative mt-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-black/55">02</p>
                    <h3 className="mt-1 text-[16px] font-semibold">Build the project</h3>
                    <p className="mt-1 text-[12px] leading-relaxed text-black/65">
                      Real Dart files in lib/, screens/ and theme/. Readable, editable, Git-friendly from day one.
                    </p>
                  </div>
                </article>
              </Reveal>

              <Reveal delay={160}>
                <article className="relative flex h-full flex-col overflow-hidden rounded-[24px] bg-[var(--fb-cyan)] p-5 text-black">
                  <div aria-hidden className="ffb-dots pointer-events-none absolute inset-0 opacity-25" />
                  <div className="relative flex-1">
                    <LogCard />
                  </div>
                  <div className="relative mt-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-black/55">03</p>
                    <h3 className="mt-1 text-[16px] font-semibold">Repair and preview</h3>
                    <p className="mt-1 text-[12px] leading-relaxed text-black/65">
                      Compiler errors return to the agent with context. Two repair rounds, then the exact file and error.
                    </p>
                  </div>
                </article>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── What it enables ────────────────────────────────────────── */}
        <section className="px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-[1440px]">
            <Reveal>
              <Eyebrow>02 — The surface</Eyebrow>
              <h2 className="ffb-display mt-4 text-[clamp(40px,5.6vw,64px)]">What FlutterForge enables</h2>
            </Reveal>

            <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Reveal>
                <article className="relative flex h-full flex-col overflow-hidden rounded-[24px] bg-[var(--fb-lime)] p-5 text-black sm:p-6">
                  <div aria-hidden className="ffb-dots pointer-events-none absolute inset-0 opacity-20" />
                  <div className="relative rounded-[18px] bg-white p-3 ring-1 ring-black/10">
                    <div className="flex items-center gap-2 border-b border-black/10 pb-2">
                      <span className="flex gap-1" aria-hidden>
                        <span className="h-1.5 w-1.5 rounded-full bg-black/15" />
                        <span className="h-1.5 w-1.5 rounded-full bg-black/15" />
                        <span className="h-1.5 w-1.5 rounded-full bg-black/15" />
                      </span>
                      <span className="rounded-full bg-black/5 px-2 py-0.5 font-mono text-[8px] text-black/55">
                        habit.local
                      </span>
                      <span className="ml-auto flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.1em] text-black/55">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--fb-lime)]" /> Ready
                      </span>
                    </div>
                    <div className="relative grid place-items-center overflow-hidden rounded-[12px] bg-[#f4f4f4] px-4 py-7 sm:px-6 sm:py-9">
                      <div aria-hidden className="ffb-dots pointer-events-none absolute inset-0 opacity-25" />
                      <PhoneMock className="relative max-w-[236px] sm:max-w-[250px]" />
                    </div>
                  </div>
                  <div className="relative mt-5">
                    <h3 className="text-[18px] font-semibold">Local preview</h3>
                    <p className="mt-1 max-w-md text-[12.5px] leading-relaxed text-black/65">
                      The running web build can sit beside the source. Change a layout, repair it, rebuild it — the preview is
                      the same project.
                    </p>
                  </div>
                </article>
              </Reveal>

              <Reveal delay={80}>
                <article className="flex h-full flex-col rounded-[24px] bg-[var(--fb-card)] p-5 text-[var(--fb-ink)] ring-1 ring-[var(--fb-line)] sm:p-6">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--fb-dim)]">Targets</p>
                    <span className="rounded-full bg-[var(--fb-soft)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--fb-muted)]">
                      One project
                    </span>
                  </div>
                  <ul className="mt-4 flex flex-1 flex-col gap-2">
                    {TARGETS.map((target) => (
                      <li key={target.label} className="flex-1">
                        <Link
                          to={workspaceHref}
                          className="group flex h-full items-center gap-3 rounded-[16px] border border-[var(--fb-line)] p-3 transition-colors hover:bg-[var(--fb-soft)]"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--fb-soft)]">
                            <target.icon size={15} />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[12.5px] font-semibold">{target.label}</span>
                            <span className="block truncate font-mono text-[9.5px] text-[var(--fb-dim)]">
                              {target.detail}
                            </span>
                          </span>
                          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-[var(--fb-line)] px-2.5 py-1 text-[9.5px] font-semibold">
                            {target.state}
                            <ArrowUpRight size={10} />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex flex-col overflow-hidden rounded-[16px] bg-[#0b0b0b]">
                    <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 font-mono text-[9px] text-white/40">
                      <span className="flex gap-1" aria-hidden>
                        <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                        <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                        <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                      </span>
                      <span>zsh — habit</span>
                    </div>
                    <div className="ffb-scrollbar flex flex-col gap-2 overflow-x-auto px-4 py-4 font-mono text-[10px] leading-relaxed text-white/65">
                      <p className="whitespace-nowrap">
                        <span className="text-[#8ad9b8]">$</span> flutter create . --platforms=web,macos,windows
                      </p>
                      <p className="whitespace-nowrap pl-3 text-white/40">web/ · macos/ · windows/</p>
                      <p className="mt-1 whitespace-nowrap">
                        <span className="text-[#8ad9b8]">$</span> flutter run -d web-server
                      </p>
                      <p className="whitespace-nowrap pl-3 text-white/40">
                        lib/main.dart is being served at http://localhost:8080
                      </p>
                      <p className="mt-1 whitespace-nowrap">
                        <span className="text-[#8ad9b8]">$</span> flutter build macos --release
                      </p>
                      <p className="whitespace-nowrap pl-3 text-white/40">
                        build/macos/Build/Products/Release/habit.app
                      </p>
                    </div>
                  </div>
                  <h3 className="mt-auto pt-5 text-[18px] font-semibold">Export the whole project</h3>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--fb-muted)]">
                    Web preview for the loop, macOS and Windows runner folders for the hand-off. No proprietary project
                    format.
                  </p>
                </article>
              </Reveal>

              <Reveal>
                <article className="flex h-full flex-col rounded-[24px] bg-[var(--fb-card)] p-5 text-[var(--fb-ink)] ring-1 ring-[var(--fb-line)] sm:p-6">
                  <CodeCard />
                  <h3 className="mt-5 text-[18px] font-semibold">Source is the deliverable</h3>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--fb-muted)]">
                    Every screen is a Dart file you can open, edit and version. The AI is a collaborator, not a runtime
                    dependency.
                  </p>
                </article>
              </Reveal>

              <Reveal delay={80}>
                <article className="relative flex h-full flex-col overflow-hidden rounded-[24px] bg-[var(--fb-magenta)] p-5 text-black sm:p-6">
                  <div aria-hidden className="ffb-dots pointer-events-none absolute inset-0 opacity-20" />
                  <div className="relative rounded-[18px] bg-white p-4 ring-1 ring-black/10">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-black/55">Backend mode</span>
                      <span className="rounded-full bg-black px-2.5 py-1 text-[8.5px] font-bold uppercase tracking-[0.08em] text-white">
                        Auto
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {['Accounts', 'Shared data', 'Realtime', 'Payments'].map((feature, index) => (
                        <span
                          key={feature}
                          className={cn(
                            'flex items-center gap-1.5 rounded-[10px] px-2.5 py-2 text-[10px] font-medium',
                            index < 2 ? 'bg-[var(--fb-lime)] text-black' : 'bg-black/5 text-black/55',
                          )}
                        >
                          <Check size={10} strokeWidth={3} className={index < 2 ? 'opacity-100' : 'opacity-30'} />
                          {feature}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-[9.5px] leading-relaxed text-black/55">
                      A calculator stays local. A shared planner gets Supabase.
                    </p>
                  </div>
                  <h3 className="relative mt-5 text-[18px] font-semibold">Supabase only when needed</h3>
                  <p className="relative mt-1 text-[12.5px] leading-relaxed text-black/65">
                    Auto mode decides whether the brief needs accounts, shared data or commerce. No backend is added to a
                    simple utility app.
                  </p>
                </article>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── Statement ──────────────────────────────────────────────── */}
        <section className="px-4 py-16 sm:px-6 sm:py-24">
          <Reveal className="mx-auto max-w-[1240px] text-center">
            <h2 className="ffb-display ffb-caps text-[clamp(44px,8.8vw,118px)] leading-[0.86] tracking-[-0.04em]">
              One brief.
              <br />
              A real Flutter project.
            </h2>
            <p className="mx-auto mt-6 max-w-md text-[13.5px] leading-relaxed text-[var(--fb-muted)]">
              Your source stays on your machine. Export it whenever you want, with no runtime to depend on.
            </p>
          </Reveal>
        </section>

        {/* ── Workbench ──────────────────────────────────────────────── */}
        <section id="workbench" className="scroll-mt-28 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-[1440px]">
            <Reveal className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Eyebrow>03 — The workspace</Eyebrow>
                <h2 className="ffb-display mt-4 text-[clamp(40px,5.6vw,64px)]">Inside the workbench</h2>
              </div>
              <Link
                to={workspaceHref}
                className="inline-flex h-11 w-fit items-center gap-2 rounded-full bg-[var(--fb-ink)] px-5 text-[12px] font-semibold text-[var(--fb-bg)] transition-transform hover:-translate-y-px"
              >
                {session ? 'Open dashboard' : 'Open the workbench'}
                <ArrowUpRight size={14} />
              </Link>
            </Reveal>

            <Reveal delay={80} className="mt-8">
              <div className="overflow-hidden rounded-[26px] border border-[var(--fb-line)] bg-[var(--fb-card)]">
                <div className="flex flex-wrap items-center gap-3 border-b border-[var(--fb-line)] px-4 py-3 sm:px-5">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[var(--fb-line)]" />
                    <span className="h-2 w-2 rounded-full bg-[var(--fb-line)]" />
                    <span className="h-2 w-2 rounded-full bg-[var(--fb-line)]" />
                  </div>
                  <span className="font-mono text-[9.5px] text-[var(--fb-muted)]">habit.local</span>
                  <div
                    className="ml-auto flex items-center gap-1 rounded-full bg-[var(--fb-soft)] p-1"
                    role="tablist"
                    aria-label="Workbench view"
                    onKeyDown={onWorkbenchTabKeyDown}
                  >
                    {[
                      { id: 'preview', label: 'Preview' },
                      { id: 'source', label: 'Source' },
                      { id: 'build', label: 'Build log' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        id={`workbench-tab-${item.id}`}
                        type="button"
                        role="tab"
                        aria-selected={tab === item.id}
                        aria-controls="workbench-panel"
                        tabIndex={tab === item.id ? 0 : -1}
                        onClick={() => setTab(item.id as 'preview' | 'source' | 'build')}
                        className={cn(
                          'inline-flex min-h-11 items-center rounded-full px-3.5 text-[10.5px] font-semibold transition-colors lg:min-h-9',
                          tab === item.id
                            ? 'bg-[var(--fb-ink)] text-[var(--fb-bg)]'
                            : 'text-[var(--fb-muted)] hover:text-[var(--fb-ink)]',
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  id="workbench-panel"
                  role="tabpanel"
                  aria-labelledby={`workbench-tab-${tab}`}
                  tabIndex={0}
                  className="min-h-[520px] focus-visible:outline-2 focus-visible:outline-offset-[-4px]"
                >
                  {tab === 'preview' ? (
                    <div className="relative grid min-h-[520px] place-items-center overflow-hidden bg-[#f3f3f3] p-6">
                      <div aria-hidden className="ffb-dots absolute inset-0 opacity-40" />
                      <PhoneMock className="relative max-w-[268px]" />
                    </div>
                  ) : null}

                  {tab === 'source' ? (
                    <div className="min-h-[520px] bg-[#0b0b0b] p-4 sm:p-6">
                      <CodeCard full />
                    </div>
                  ) : null}

                  {tab === 'build' ? (
                    <div className="min-h-[520px] bg-[#0b0b0b] p-4 sm:p-6">
                      <LogCard full />
                    </div>
                  ) : null}
                </div>
              </div>
              <p className="mt-3 text-[11px] text-[var(--fb-muted)]">
                Three views of one project — switch tabs to inspect the source, preview and build log.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ── Use cases ──────────────────────────────────────────────── */}
        <section className="px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-[1440px]">
            <Reveal className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Eyebrow>04 — Start here</Eyebrow>
                <h2 className="ffb-display mt-4 text-[clamp(40px,5.6vw,64px)]">What will you forge?</h2>
              </div>
              <p className="max-w-xs text-[13px] leading-relaxed text-[var(--fb-muted)]">
                Pick a brief, edit it in the hero, then start building. These are real prompts, not templates.
              </p>
            </Reveal>

            <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
              {EXAMPLE_PROMPTS.map((example, index) => {
                const tones = ['bg-[var(--fb-magenta)]', 'bg-[var(--fb-lime)]', 'bg-[var(--fb-cyan)]'];
                return (
                  <Reveal key={example.label} delay={index * 70}>
                    <button
                      type="button"
                      onClick={() => useExample(example.prompt)}
                      className={cn(
                        'group relative flex h-full min-h-[360px] w-full flex-col justify-between overflow-hidden rounded-[24px] p-5 text-left text-black transition-transform duration-300 hover:-translate-y-1 sm:min-h-[400px]',
                        tones[index],
                      )}
                    >
                      <div aria-hidden className="ffb-dots pointer-events-none absolute inset-0 opacity-20" />
                      <div aria-hidden className="relative">
                        <UseCaseVisual kind={example.kind} />
                      </div>
                      <div className="relative mt-5">
                        <h3 className="text-[18px] font-semibold">{example.label}</h3>
                        <p className="mt-1 text-[11.5px] leading-relaxed text-black/75">{example.prompt}</p>
                        <span className="mt-4 inline-flex items-center gap-1.5 text-[11.5px] font-semibold">
                          Try this brief
                          <ArrowRight size={13} className="transition-transform duration-300 group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </button>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Export + team ──────────────────────────────────────────── */}
        <section id="desktop" className="scroll-mt-28 px-4 py-20 sm:px-6">
          <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-4 lg:grid-cols-[1.35fr_1fr]">
            <Reveal>
              <div className="flex h-full flex-col rounded-[28px] bg-[var(--fb-card)] p-6 text-[var(--fb-ink)] ring-1 ring-[var(--fb-line)] sm:p-10">
                <Eyebrow>05 — Export</Eyebrow>
                <h2 className="ffb-display mt-4 text-[clamp(36px,4.6vw,60px)]">
                  Web, macOS,
                  <br />
                  Windows.
                </h2>
                <p className="mt-4 max-w-lg text-[13px] leading-relaxed text-[var(--fb-muted)]">
                  Preview on the web, prepare desktop runner folders, then build with the toolchain for your target. The
                  exported project is ordinary Flutter.
                </p>
                <ul className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {TARGETS.map((target) => (
                    <li key={target.label} className="rounded-[16px] border border-[var(--fb-line)] p-3">
                      <target.icon size={16} className="text-[var(--fb-muted)]" />
                      <p className="mt-2 text-[11.5px] font-semibold">{target.label}</p>
                      <p className="mt-0.5 text-[9.5px] text-[var(--fb-dim)]">{target.state}</p>
                    </li>
                  ))}
                </ul>
                <Link
                  to={workspaceHref}
                  className="mt-6 inline-flex h-11 w-fit items-center gap-2 rounded-full bg-[var(--fb-ink)] px-5 text-[12px] font-semibold text-[var(--fb-bg)] transition-transform hover:-translate-y-px"
                >
                  {session ? 'Open dashboard' : 'Start building'}
                  <ArrowRight size={14} />
                </Link>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <div id="team" className="flex h-full flex-col rounded-[28px] bg-[var(--fb-card)] p-6 text-[var(--fb-ink)] ring-1 ring-[var(--fb-line)] scroll-mt-28 sm:p-10">
                <Eyebrow>06 — The team</Eyebrow>
                <h2 className="ffb-display mt-4 text-[clamp(34px,3.8vw,48px)]">Built in Belagavi.</h2>
                <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--fb-muted)]">
                  A Phase 2 project by OnUs Devs at S. G. Balekundri Institute of Technology, VTU.
                </p>
                <ul className="mt-5 grid flex-1 content-start gap-2 sm:grid-cols-2">
                  {TEAM.map((member) => (
                    <li key={member.name} className="rounded-[14px] bg-[var(--fb-soft)] p-3">
                      <p className="text-[11.5px] font-semibold">{member.name}</p>
                      <p className="mt-0.5 text-[9.5px] leading-relaxed text-[var(--fb-muted)]">{member.role}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────────── */}
        <section id="faq" className="scroll-mt-28 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-[1100px]">
            <Reveal>
              <Eyebrow>07 — Answers</Eyebrow>
              <h2 className="ffb-display mt-4 text-[clamp(40px,5.6vw,64px)]">Common questions</h2>
            </Reveal>
            <div className="ffb-faq mt-8 space-y-2">
              {FAQS.map((item, index) => (
                <Reveal key={item.q} delay={index * 40}>
                  <details className="group rounded-[20px] border border-[var(--fb-line)] bg-[var(--fb-card)] px-5 text-[var(--fb-ink)]">
                    <summary className="flex cursor-pointer items-center gap-4 py-5 text-[13.5px] font-semibold">
                      <span className="text-[10px] font-medium text-[var(--fb-dim)]">0{index + 1}</span>
                      <span className="min-w-0 flex-1">{item.q}</span>
                      <Plus size={16} className="shrink-0 transition-transform duration-300 group-open:rotate-45" />
                    </summary>
                    <p className="pb-5 pl-8 pr-8 text-[12.5px] leading-relaxed text-[var(--fb-muted)]">{item.a}</p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ────────────────────────────────────────────────────── */}
        <section className="px-4 pb-20 sm:px-6">
          <Reveal className="mx-auto max-w-[1440px]">
            <div className="ffb-dark relative overflow-hidden rounded-[32px] border border-white/10 bg-[#0a0a0a] px-6 py-14 text-white sm:px-12 sm:py-20">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[var(--fb-magenta)] opacity-30 blur-3xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-[var(--fb-lime)] opacity-20 blur-3xl"
              />
              <div className="relative">
                <Eyebrow light>Start here</Eyebrow>
                <h2 className="ffb-display ffb-caps mt-5 max-w-[900px] text-[clamp(42px,7vw,104px)] leading-[0.86] tracking-[-0.04em]">
                  The next app is one brief away.
                </h2>
                <p className="mt-5 max-w-md text-[13px] leading-relaxed text-white/60">
                  Describe the app you want. Keep the project when you leave. No lock-in, no hidden build step.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    to={workspaceHref}
                    className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[12.5px] font-semibold text-black transition-transform hover:-translate-y-px"
                  >
                    {session ? 'Open dashboard' : 'Start building'}
                    <ArrowRight size={15} />
                  </Link>
                  <button
                    type="button"
                    onClick={() => scrollToTarget('#workflow')}
                    className="inline-flex h-12 items-center rounded-full border border-white/25 px-6 text-[12.5px] font-semibold text-white transition-colors hover:border-white/60"
                  >
                    See the build loop
                  </button>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="px-3 pb-3">
        <div className="mx-auto max-w-[1440px] rounded-[28px] border border-[var(--fb-line)] bg-[var(--fb-card)] px-5 pb-6 pt-10 text-[var(--fb-ink)] sm:px-8 sm:pt-12">
          <p className="ffb-display ffb-caps whitespace-nowrap text-[clamp(44px,12vw,180px)] leading-[0.78] tracking-[-0.045em]">
            FlutterForge
          </p>

          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 border-t border-[var(--fb-line)] pt-8 sm:grid-cols-3 lg:grid-cols-[1.8fr_repeat(5,minmax(0,1fr))] lg:gap-x-8">
            <div className="col-span-2 sm:col-span-3 lg:col-span-1 lg:pr-8">
              <Link to="/" className="flex items-center gap-2.5">
                <BrandLogo size={26} />
                <span className="ffb-display text-[16px] tracking-[-0.02em]">FlutterForge</span>
              </Link>
              <p className="mt-4 max-w-[32ch] text-[12px] leading-relaxed text-[var(--fb-muted)]">
                A local-first Flutter studio: brief, build, preview and repair in one workspace.
              </p>
              <a
                href={REPO}
                target="_blank"
                rel="noreferrer"
                className="group mt-5 inline-flex min-h-11 items-center gap-2.5 rounded-full border border-[var(--fb-line)] px-3.5 text-[11.5px] font-medium text-[var(--fb-muted)] transition-colors hover:border-[var(--fb-ink)] hover:text-[var(--fb-ink)]"
              >
                <Github size={14} />
                Source on GitHub
                <ArrowUpRight size={12} className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
              <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--fb-dim)]">
                Engineered by OnUs Devs
              </p>
            </div>

            <FooterCol title="Product">
              <li>
                <button type="button" onClick={() => go('hero')} className={footerLink}>
                  Overview
                </button>
              </li>
              <li>
                <button type="button" onClick={() => go('workflow')} className={footerLink}>
                  How it works
                </button>
              </li>
              <li>
                <button type="button" onClick={() => go('workbench')} className={footerLink}>
                  Workbench
                </button>
              </li>
              <li>
                <button type="button" onClick={() => go('desktop')} className={footerLink}>
                  Desktop export
                </button>
              </li>
            </FooterCol>

            <FooterCol title="Get started">
              <li>
                <Link to={workspaceHref} className={footerLink}>
                  {session ? 'Open dashboard' : 'Start a build'}
                </Link>
              </li>
              {!session ? (
                <li>
                  <Link to="/login" className={footerLink}>
                    Sign in
                  </Link>
                </li>
              ) : null}
              {!session ? (
                <li>
                  <Link to="/forgot-password" className={footerLink}>
                    Forgot password
                  </Link>
                </li>
              ) : null}
              <li>
                <button type="button" onClick={() => go('faq')} className={footerLink}>
                  FAQ
                </button>
              </li>
            </FooterCol>

            <FooterCol title="Use cases">
              {EXAMPLE_PROMPTS.map((example) => (
                <li key={example.label}>
                  <button type="button" onClick={() => useExample(example.prompt)} className={footerLink}>
                    {example.label}
                  </button>
                </li>
              ))}
            </FooterCol>

            <FooterCol title="Resources">
              <li>
                <button type="button" onClick={() => go('team')} className={footerLink}>
                  Project team
                </button>
              </li>
              <li>
                <a href={REPO} target="_blank" rel="noreferrer" className={footerLink}>
                  Repository
                </a>
              </li>
              <li>
                <button type="button" onClick={() => scrollToTarget(0, 0)} className={footerLink}>
                  Back to top
                </button>
              </li>
            </FooterCol>

            <FooterCol title="Legal">
              <li>
                <Link to="/legal/terms" className={footerLink}>
                  Terms of use
                </Link>
              </li>
              <li>
                <Link to="/legal/privacy" className={footerLink}>
                  Privacy notice
                </Link>
              </li>
              <li>
                <Link to="/legal/permissions" className={footerLink}>
                  Permissions
                </Link>
              </li>
            </FooterCol>
          </div>

          <div className="mt-8 flex flex-col gap-4 border-t border-[var(--fb-line)] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10.5px] text-[var(--fb-muted)]">
              © {new Date().getFullYear()} FlutterForge. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--fb-dim)] sm:inline">
                S. G. Balekundri Institute of Technology, Belagavi
              </span>
              <button
                type="button"
                onClick={toggle}
                aria-label={isDark ? 'Switch to light appearance' : 'Switch to dark appearance'}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--fb-line)] px-3.5 text-[11px] font-medium text-[var(--fb-muted)] transition-colors hover:border-[var(--fb-ink)] hover:text-[var(--fb-ink)]"
              >
                {isDark ? <Sun size={13} /> : <Moon size={13} />}
                {isDark ? 'Light' : 'Dark'}
              </button>
              <button
                type="button"
                onClick={() => scrollToTarget(0, 0)}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--fb-line)] px-3.5 text-[11px] font-medium text-[var(--fb-muted)] transition-colors hover:border-[var(--fb-ink)] hover:text-[var(--fb-ink)]"
              >
                Back to top
                <ArrowUp size={13} />
              </button>
              <a
                href={REPO}
                target="_blank"
                rel="noreferrer"
                aria-label="FlutterForge on GitHub"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--fb-line)] text-[var(--fb-muted)] transition-colors hover:border-[var(--fb-ink)] hover:text-[var(--fb-ink)]"
              >
                <Github size={14} />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
