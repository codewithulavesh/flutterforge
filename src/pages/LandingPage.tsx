import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  Code2,
  Layers,
  LayoutDashboard,
  Monitor,
  Moon,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Sparkles,
  Sun,
  User,
  Zap,
} from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import Dock, { type DockItemData } from '@/components/Dock';
import { useAuthStore } from '@/stores/auth.store';
import { useThemeStore } from '@/stores/theme.store';
import { HERO_PROMPT_KEY } from '@/utils/landing';
import { cn } from '@/utils/cn';

const FEATURES = [
  {
    icon: Code2,
    title: 'A real Flutter project',
    copy: 'Every run writes pubspec.yaml, Dart source, models and services to disk. No mock screenshots, no fake codegen.',
  },
  {
    icon: Zap,
    title: 'Warm web preview',
    copy: 'A persistent flutter run -d web-server process reloads in seconds. You see the actual widget tree, not a canvas approximation.',
  },
  {
    icon: RefreshCw,
    title: 'Compile repair loop',
    copy: 'When the build fails, the compiler errors go back to the agent. It fixes the root cause and rebuilds — twice, then it asks you.',
  },
  {
    icon: ShieldCheck,
    title: 'Supabase only when needed',
    copy: 'A calculator stays local. Auth, orders, realtime or shared data get Supabase with RLS migrations. No backend by default.',
  },
  {
    icon: Monitor,
    title: 'Desktop-ready export',
    copy: 'One Flutter codebase for web, iOS, Android, macOS and Windows. Desktop runners are added with a single export script.',
  },
  {
    icon: Layers,
    title: 'Local-first harness',
    copy: 'The DeepSeek Harness engine runs on your machine.',
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
    copy: 'The harness writes complete files with a pinned package name, skills for architecture and UI, and a focused 6–10 file budget.',
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

const FAQS = [
  {
    q: 'Do I need Flutter installed?',
    a: 'Yes. The desktop app discovers Flutter and Dart from common install locations or FLUTTER_BIN. Generation still works without the SDK, but the live preview needs it.',
  },
  {
    q: 'Where does the AI run?',
    a: 'Locally. The Electron app starts a Node bridge that drives the DeepSeek Harness engine on your machine. Your project files stay in a local workspace.',
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
    a: 'Yes. Export a complete Flutter project, then build it with the Flutter SDK. macOS and Windows runner folders can be added with the included export script.',
  },
];

const PROOF = [
  ['Real files on disk', 'pubspec, Dart, SQL'],
  ['Warm Flutter preview', 'flutter run -d web-server'],
  ['Two-round repair loop', 'compile errors → patch'],
  ['Desktop targets', 'macOS · Windows'],
] as const;

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

export function LandingPage() {
  const navigate = useNavigate();
  const session = useAuthStore((s) => s.session);
  const { theme, toggle } = useThemeStore();
  const isDark = theme === 'dark';
  const [prompt, setPrompt] = useState('');

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
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const authLabel = session ? 'Dashboard' : 'Sign in';
  const goAuth = () => navigate(session ? '/dashboard' : '/login');
  const goStart = () => navigate(session ? '/dashboard' : '/signup');

  const dockItems: DockItemData[] = [
    {
      icon: <BrandLogo size={26} />,
      label: 'FlutterForge',
      menu: [
        { label: 'Start building', onClick: goStart },
        { separator: true },
        { label: authLabel, onClick: goAuth },
        { label: 'How it works', onClick: () => scrollToSection('workflow') },
      ],
    },
    { separator: true },
    { icon: <Layers size={19} />, label: 'Product', onClick: () => scrollToSection('product') },
    { icon: <RefreshCw size={19} />, label: 'Workflow', onClick: () => scrollToSection('workflow') },
    { icon: <Sparkles size={19} />, label: 'Features', onClick: () => scrollToSection('features') },
    { icon: <CircleHelp size={19} />, label: 'FAQ', onClick: () => scrollToSection('faq') },
    { separator: true },
    {
      icon: isDark ? <Sun size={19} /> : <Moon size={19} />,
      label: isDark ? 'Light mode' : 'Dark mode',
      onClick: toggle,
    },
    {
      icon: session ? <LayoutDashboard size={19} /> : <User size={19} />,
      label: authLabel,
      onClick: goAuth,
    },
    {
      icon: <Rocket size={19} />,
      label: 'Start building',
      className: 'ff-dock-start',
      onClick: goStart,
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--ff-bg)] ff-brand ff-studio ff-landing">
      <main>
        {/* ── Hero ───────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-[var(--ff-border)]">
          {/* Ambient background: masked grid + teal light */}
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="ff-studio-grid absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_75%_65%_at_50%_0%,black_35%,transparent)]" />
            <div className="ff-hero-glow absolute -top-48 left-1/2 h-[460px] w-[880px] max-w-none -translate-x-1/2" />
            <div className="ff-orb ff-orb-coral absolute right-[6%] top-24 h-72 w-72" />
            <div className="ff-orb ff-orb-lavender absolute -left-24 bottom-0 h-80 w-80" />
            <div className="ff-hero-glow absolute -right-40 top-40 h-[320px] w-[420px] rotate-12 opacity-60" />
          </div>

          <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 pb-16 pt-16 sm:px-6 sm:pt-24 lg:grid-cols-12 lg:gap-8 lg:px-8 lg:pb-24 lg:pt-28">
            <div className="flex flex-col justify-center lg:col-span-5">
              <div className="ff-enter ff-eyebrow inline-flex w-fit items-center gap-2 rounded-full border border-[var(--ff-border)] bg-[var(--ff-surface)]/80 px-3 py-1.5 shadow-[var(--ff-soft-shadow)] backdrop-blur">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--ff-brand-teal)] opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--ff-brand-teal)]" />
                </span>
                <span className="ff-label text-[9px] text-[var(--ff-text-muted)]">Runs locally · Real Flutter SDK</span>
              </div>

              <h1
                className="ff-enter ff-display mt-6 text-[40px] font-semibold leading-[1.02] tracking-[-0.05em] text-[var(--ff-text)] sm:text-[56px] lg:text-[62px]"
                style={{ animationDelay: '90ms' }}
              >
                Describe the app.
                <br />
                <span className="ff-gradient-text">Ship the Flutter code.</span>
              </h1>

              <p
                className="ff-enter mt-5 max-w-lg text-[15px] leading-relaxed text-[var(--ff-text-muted)]"
                style={{ animationDelay: '180ms' }}
              >
                FlutterForge runs a local coding agent that writes a real Flutter project, compiles it,
                previews it, and repairs build errors. Supabase only when the app needs it.
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
                    placeholder="A colorful calculator with history and keyboard support…"
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
                <span className="inline-flex items-center gap-1.5"><Code2 size={11} /> Flutter 3.24+</span>
                <span className="inline-flex items-center gap-1.5"><ShieldCheck size={11} /> Supabase optional</span>
              </div>
            </div>

            <div className="lg:col-span-7 lg:pl-4">
              <div className="ff-enter relative" style={{ animationDelay: '220ms' }}>
                <div className="ff-window-glow absolute -inset-8 rounded-[36px]" aria-hidden />
                <div className="relative">
                  <ProductWindow />
                </div>
                <p className="mt-4 text-center text-[10px] text-[var(--ff-text-dim)]">Illustrative product preview</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Proof strip ────────────────────────────────────────────── */}
        <section className="ff-proof border-b border-[var(--ff-border)] bg-[var(--ff-surface)]">
          <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-[var(--ff-border)] px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
            {PROOF.map(([title, detail]) => (
              <div key={title} className="group px-3 py-5 transition-colors hover:bg-[var(--ff-surface-2)] sm:px-5">
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--ff-text)]">
                  <Check size={12} className="shrink-0 text-[var(--ff-brand-teal)]" />
                  {title}
                </p>
                <p className="mt-1 pl-[19px] font-mono text-[9px] text-[var(--ff-text-dim)]">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Workflow ───────────────────────────────────────────────── */}
        <section id="workflow" className="mx-auto max-w-7xl scroll-mt-6 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <Reveal>
                <p className="ff-label text-[9px] text-[var(--ff-brand-teal)]">Workflow</p>
                <h2 className="ff-display mt-3 text-3xl font-semibold leading-tight text-[var(--ff-text)] sm:text-4xl">
                  A short loop from idea to a runnable app.
                </h2>
                <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-[var(--ff-text-muted)]">
                  Four steps, no black box. You can inspect every file, run the terminal, and take the project out at any time.
                </p>
                <div className="mt-8 overflow-hidden rounded-xl border border-[var(--ff-border)] shadow-[var(--ff-soft-shadow)]">
                  <div className="flex items-center gap-1.5 border-b border-[var(--ff-border)] bg-[var(--ff-surface-2)] px-3 py-2">
                    <span className="h-2 w-2 rounded-full bg-[#f07067]/70" />
                    <span className="h-2 w-2 rounded-full bg-[#f2d45c]/70" />
                    <span className="h-2 w-2 rounded-full bg-[#7dd8b5]/70" />
                    <span className="ml-2 font-mono text-[9px] text-[var(--ff-text-dim)]">export.sh</span>
                  </div>
                  <div className="bg-[#0f1115] p-4">
                    <pre className="overflow-x-auto font-mono text-[10px] leading-relaxed text-[#c9c3b5]">
                      <span className="text-[#02AFB9]">$</span>{' '}
                      {`flutter create --platforms=macos,windows .
flutter run -d macos
flutter build windows --release`}
                    </pre>
                  </div>
                </div>
              </Reveal>
            </div>

            <div className="lg:col-span-8">
              <div className="divide-y divide-[var(--ff-border)] border-y border-[var(--ff-border)]">
                {STEPS.map((step, index) => (
                  <Reveal key={step.number} delay={index * 70}>
                    <div className="group grid cursor-default grid-cols-[48px_1fr] gap-4 py-6 transition-colors hover:bg-[var(--ff-surface)]/60 sm:grid-cols-[72px_1fr] sm:gap-6">
                      <span className="ff-display text-2xl font-semibold text-[var(--ff-text-dim)] transition-colors duration-300 group-hover:text-[var(--ff-brand-teal)] sm:text-3xl">
                        {step.number}
                      </span>
                      <div>
                        <h3 className="ff-display flex items-center gap-2 text-lg font-semibold text-[var(--ff-text)]">
                          {step.title}
                          <ArrowRight
                            size={15}
                            className="opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-60"
                          />
                        </h3>
                        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[var(--ff-text-muted)]">{step.copy}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ───────────────────────────────────────────────── */}
        <section id="features" className="relative border-y border-[var(--ff-border)] bg-[var(--ff-surface)]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <Reveal>
                <p className="ff-label text-[9px] text-[var(--ff-brand-teal)]">Product</p>
                <h2 className="ff-display mt-3 max-w-xl text-3xl font-semibold leading-tight text-[var(--ff-text)] sm:text-4xl">
                  Built like a real dev tool, not a demo.
                </h2>
              </Reveal>
              <Reveal delay={100}>
                <p className="max-w-sm text-[13px] leading-relaxed text-[var(--ff-text-muted)]">
                  The parts that matter when the app has to compile, run, and leave your machine.
                </p>
              </Reveal>
            </div>

            <div id="product" className="mt-12 grid grid-cols-1 gap-px scroll-mt-6 overflow-hidden rounded-2xl border border-[var(--ff-border)] bg-[var(--ff-border)] shadow-[var(--ff-soft-shadow)] sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, copy }, index) => (
                <Reveal key={title} delay={(index % 3) * 80}>
                  <div className="group relative h-full bg-[var(--ff-surface)] p-6 transition-colors duration-300 hover:bg-[var(--ff-surface-2)]">
                    <div className="absolute inset-x-0 top-0 h-px scale-x-0 bg-gradient-to-r from-transparent via-[var(--ff-brand-teal)] to-transparent transition-transform duration-500 group-hover:scale-x-100" />
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--ff-border)] bg-[var(--ff-bg)] transition-all duration-300 group-hover:border-[var(--ff-brand-teal)]/40 group-hover:shadow-[0_0_16px_-4px_rgba(2,175,185,0.4)]">
                      <Icon size={15} className="text-[var(--ff-text-muted)] transition-colors duration-300 group-hover:text-[var(--ff-brand-teal)]" />
                    </div>
                    <h3 className="ff-display mt-5 text-[15px] font-semibold text-[var(--ff-text)]">{title}</h3>
                    <p className="mt-2 text-[12px] leading-relaxed text-[var(--ff-text-muted)]">{copy}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Desktop / export ──────────────────────────────────────── */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
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
              <div className="overflow-hidden rounded-2xl border border-[var(--ff-border)] bg-[var(--ff-surface)] shadow-[var(--ff-soft-shadow-lg)] transition-transform duration-500 hover:-translate-y-1">
                <div className="flex items-center gap-1.5 border-b border-[var(--ff-border)] bg-[var(--ff-surface-2)] px-3 py-2">
                  <span className="h-2 w-2 rounded-full bg-[#f07067]" />
                  <span className="h-2 w-2 rounded-full bg-[#f2d45c]" />
                  <span className="h-2 w-2 rounded-full bg-[#7dd8b5]" />
                  <span className="ml-2 font-mono text-[9px] text-[var(--ff-text-dim)]">terminal — calcyic</span>
                </div>
                <div className="bg-[#0f1115] p-5 font-mono text-[11px] leading-loose">
                  <p className="text-[#c9c3b5]"><span className="text-[#02AFB9]">$</span> flutter create --platforms=macos,windows .</p>
                  <p className="pl-3 text-[#8b8578]">Recreating project…</p>
                  <p className="text-[#c9c3b5]"><span className="text-[#02AFB9]">$</span> flutter build macos --release</p>
                  <p className="pl-3 text-[#7dd8b5]">✓ Built build/macos/Build/Products/Release</p>
                  <p className="text-[#c9c3b5]"><span className="text-[#02AFB9]">$</span> flutter build windows --release</p>
                  <p className="pl-3 text-[#7dd8b5]">✓ Built build/windows/x64/runner/Release</p>
                </div>
              </div>
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

        {/* ── CTA ────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <Reveal>
            <div className="ff-cta-panel relative overflow-hidden rounded-3xl border border-[var(--ff-border)] bg-[var(--ff-surface)] shadow-[var(--ff-soft-shadow-lg)]">
              <div className="pointer-events-none absolute inset-0" aria-hidden>
                <div className="ff-studio-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_60%_80%_at_80%_50%,black,transparent)]" />
                <div className="ff-orb ff-orb-lavender absolute -left-20 bottom-0 h-56 w-56" />
                <div className="ff-hero-glow absolute -right-24 -top-24 h-[300px] w-[420px]" />
              </div>
              <div className="relative grid gap-8 p-8 sm:p-12 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <div className="flex items-center gap-2.5">
                    <BrandLogo size={30} />
                    <span className="ff-display text-sm font-semibold text-[var(--ff-text)]">FlutterForge</span>
                  </div>
                  <h2 className="ff-display mt-5 max-w-xl text-3xl font-semibold leading-tight text-[var(--ff-text)] sm:text-4xl">
                    Start with an idea. <span className="ff-gradient-text">Leave with a project.</span>
                  </h2>
                  <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-[var(--ff-text-muted)]">
                    Local harness, real Flutter files, live preview, and a clean export.
                  </p>
                </div>
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

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--ff-border)] bg-[var(--ff-surface)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 pb-28 pt-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-2">
            <BrandLogo size={22} />
            <span className="text-[12px] text-[var(--ff-text-muted)]">FlutterForge</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-[var(--ff-text-dim)]">
            <a href="#product" className="transition-colors hover:text-[var(--ff-text)]">Product</a>
            <a href="#workflow" className="transition-colors hover:text-[var(--ff-text)]">Workflow</a>
            <a href="#faq" className="transition-colors hover:text-[var(--ff-text)]">FAQ</a>
            <span>© {new Date().getFullYear()} FlutterForge</span>
          </div>
        </div>
      </footer>

      {/* ── Dock navbar ──────────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50">
        <Dock
          items={dockItems}
          theme={isDark ? 'dark' : 'light'}
          baseItemSize={46}
          magnification={64}
          panelHeight={62}
          gap={8}
          accentColor="#02afb9"
          className="pointer-events-auto"
        />
      </div>
    </div>
  );
}

function ProductWindow() {
  return (
    <div className="relative">
      <div className="ff-window overflow-hidden rounded-2xl border border-[var(--ff-border)] bg-[var(--ff-surface)] shadow-[var(--ff-soft-shadow-lg)]">
        <div className="flex items-center gap-2 border-b border-[var(--ff-border)] bg-[var(--ff-surface-2)] px-3 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#f07067]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#f2d45c]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#7dd8b5]" />
          <span className="ml-2 truncate font-mono text-[9px] text-[var(--ff-text-dim)]">calcyic — FlutterForge</span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[#7dd8b5]/40 bg-[#7dd8b5]/10 px-2 py-0.5 text-[8px] font-medium text-[#2f7d61]">
            <span className="relative flex h-1 w-1">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2f7d61] opacity-60" />
              <span className="relative inline-flex h-1 w-1 rounded-full bg-[#2f7d61]" />
            </span>
            preview live
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
                Build an Apple-style calculator with history and keyboard support. Local only.
              </p>
            </div>
            <div className="mt-2 rounded-lg border border-[var(--ff-border)] bg-[var(--ff-surface)] p-2">
              <div className="flex items-center gap-1">
                <BrandLogo size={12} />
                <p className="text-[8px] font-semibold text-[var(--ff-text)]">FlutterForge</p>
              </div>
              <p className="mt-1 text-[8px] leading-relaxed text-[var(--ff-text-muted)]">
                Built 7 files with Material 3. Compile clean, preview is live.
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
                <p className="text-right font-mono text-[18px] font-light text-white">1,248</p>
                <div className="mt-2 grid grid-cols-4 gap-1">
                  {['AC', '±', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '='].map((key) => (
                    <span
                      key={key}
                      className={cn(
                        'flex h-5 items-center justify-center rounded-full text-[7px] font-medium',
                        ['÷', '×', '−', '+', '='].includes(key)
                          ? 'bg-[#f2a03d] text-white'
                          : ['AC', '±', '%'].includes(key)
                            ? 'bg-[#3a3a3c] text-white'
                            : 'bg-[#1c1c1e] text-white',
                        key === '0' && 'col-span-2',
                      )}
                    >
                      {key}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="ff-compile-badge ff-float absolute -bottom-4 -left-3 inline-flex items-center gap-1.5 rounded-lg border border-[var(--ff-border)] bg-[var(--ff-studio-yellow)] px-2.5 py-1.5 shadow-[var(--ff-soft-shadow)]">
        <Check size={11} className="text-[#141414]" />
        <span className="font-mono text-[8px] font-medium text-[#141414]">compile clean · 0 errors</span>
      </div>
    </div>
  );
}
