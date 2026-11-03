import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { useThemeStore } from '@/stores/theme.store';

export function AuthLayout({ children }: { children: ReactNode }) {
  const { theme, toggle } = useThemeStore();
  const isDark = theme === 'dark';

  return (
    <div className="ff-bold min-h-[100dvh] lg:grid lg:grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)]">
      <aside className="ffb-auth-poster relative hidden overflow-hidden lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:flex-col lg:justify-between lg:border-r lg:border-[var(--fb-line)] lg:px-12 lg:py-10 xl:px-16">
        <div aria-hidden className="ffb-auth-grid" />

        <Link
          to="/"
          className="relative z-10 inline-flex w-fit items-center gap-2.5 text-[var(--fb-ink)]"
          aria-label="FlutterForge home"
        >
          <BrandLogo size={30} />
          <span className="ffb-display text-[19px] tracking-[-0.02em]">FlutterForge</span>
        </Link>

        <div className="relative z-10 mx-auto flex w-full max-w-[34rem] flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--fb-line)] bg-[var(--fb-card)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--fb-muted)]">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--fb-magenta)]" />
            A local Flutter studio
          </span>

          <p className="ffb-display ffb-caps mt-6 text-[clamp(40px,5.4vw,78px)] leading-[0.84] tracking-[-0.04em] text-[var(--fb-ink)]">
            <span className="block">The next app</span>
            <span className="block">is one brief</span>
            <span className="block">away.</span>
          </p>

          <p className="mx-auto mt-5 max-w-[30rem] text-[13.5px] leading-relaxed text-[var(--fb-muted)]">
            Brief an app in plain language. FlutterForge writes real Dart files, runs a live preview,
            repairs compile errors, and leaves the project on your machine.
          </p>

          <div className="relative mt-8 w-full max-w-[30rem] text-left">
            <span
              aria-hidden
              className="ffb-float pointer-events-none absolute -left-5 -top-5 z-10 -rotate-6 rounded-[8px] border-2 border-black bg-[var(--fb-lime)] px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-black shadow-[3px_3px_0_#000]"
            >
              Dart 3
            </span>

            <div className="overflow-hidden rounded-[22px] border-[6px] border-[#0a0a0a] bg-white shadow-[0_30px_60px_-42px_rgba(0,0,0,0.55)]">
              <div className="flex items-center gap-2 border-b border-black/10 px-3.5 py-2">
                <span className="flex gap-1.5" aria-hidden>
                  <span className="h-2 w-2 rounded-full bg-black/15" />
                  <span className="h-2 w-2 rounded-full bg-black/15" />
                  <span className="h-2 w-2 rounded-full bg-black/15" />
                </span>
                <span className="ml-1 rounded-full bg-black/5 px-2.5 py-1 font-mono text-[9px] text-black/60">
                  habit.local
                </span>
                <span className="ml-auto flex items-center gap-1.5 text-[8.5px] font-semibold uppercase tracking-[0.12em] text-black/55">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--fb-lime)]" />
                  Preview ready
                </span>
              </div>

              <div className="p-3.5">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-black/55">You</p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-black">
                  Build a habit tracker with weekly goals, streaks and a clean daily check-in.
                </p>

                <div className="mt-3 rounded-[14px] border border-black/10 p-3">
                  <div className="flex items-center gap-2">
                    <BrandLogo size={14} />
                    <span className="text-[10px] font-semibold text-black">FlutterForge</span>
                    <span className="ml-auto rounded-full bg-[var(--fb-lime)] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-black">
                      Ready
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1 font-mono text-[9.5px] text-black/55">
                    <li>✓ lib/main.dart</li>
                    <li>✓ lib/screens/home_screen.dart</li>
                    <li>✓ flutter analyze · no issues</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--fb-muted)]">
            One brief. Real source. A running preview.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--fb-dim)]">
          <span>© 2026 FlutterForge</span>
          <div className="flex items-center gap-4">
            <Link to="/legal/terms" className="transition-colors hover:text-[var(--fb-ink)]">
              Terms
            </Link>
            <Link to="/legal/privacy" className="transition-colors hover:text-[var(--fb-ink)]">
              Privacy
            </Link>
          </div>
        </div>
      </aside>

      <div className="flex min-h-[100dvh] flex-col bg-[var(--fb-bg)]">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--fb-line)] px-4 py-3 sm:px-6 lg:justify-end">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[var(--fb-ink)] lg:hidden"
            aria-label="FlutterForge home"
          >
            <BrandLogo size={24} />
            <span className="ffb-display text-[15px] tracking-[-0.02em]">FlutterForge</span>
          </Link>
          <button
            type="button"
            onClick={toggle}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-[var(--fb-line)] bg-transparent text-[var(--fb-muted)] transition-colors hover:border-[var(--fb-ink)] hover:text-[var(--fb-ink)]"
            aria-label={isDark ? 'Switch to light appearance' : 'Switch to dark appearance'}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </header>

        <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
          <div className="w-full max-w-[440px]">
            {children}
            <div className="mt-5 flex items-center justify-center gap-3 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--fb-dim)] lg:hidden">
              <Link to="/legal/terms" className="transition-colors hover:text-[var(--fb-ink)]">
                Terms
              </Link>
              <span aria-hidden>·</span>
              <Link to="/legal/privacy" className="transition-colors hover:text-[var(--fb-ink)]">
                Privacy
              </Link>
              <span aria-hidden>·</span>
              <Link to="/legal/permissions" className="transition-colors hover:text-[var(--fb-ink)]">
                Permissions
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
