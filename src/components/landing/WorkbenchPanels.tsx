import { useState } from 'react';
import { Check, FileCode2, Folder, TriangleAlert } from 'lucide-react';
import { cn } from '@/utils/cn';

const SOURCE_TREE = [
  { label: 'lib/', depth: 0, open: true },
  { label: 'main.dart', depth: 1 },
  { label: 'screens/', depth: 1, open: true },
  { label: 'home_screen.dart', depth: 2, active: true },
  { label: 'history_screen.dart', depth: 2 },
  { label: 'theme/', depth: 1, open: true },
  { label: 'forge_theme.dart', depth: 2 },
  { label: 'pubspec.yaml', depth: 0 },
];

export function SourceArtifact() {
  return (
    <div className="ff-plate overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--ff-rule)] px-4 py-2.5">
        <span className="ff-kicker">Source / lib</span>
        <span className="ff-kicker">Dart 3 · 12 files</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[184px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[var(--ff-rule)] bg-[var(--ff-surface-2)] px-3 py-4 sm:block" aria-label="Project files">
          <p className="ff-kicker mb-3">habit_tracker</p>
          <ul className="space-y-1">
            {SOURCE_TREE.map((item) => (
              <li
                key={`${item.depth}-${item.label}`}
                className={`flex items-center gap-1.5 rounded-[3px] py-0.5 pr-1 font-mono text-[10px] ${
                  item.active ? 'bg-[var(--ff-accent-ink)]/10 text-[var(--ff-text)]' : 'text-[var(--ff-text-muted)]'
                }`}
                style={{ paddingLeft: `${item.depth * 10}px` }}
              >
                {item.label.endsWith('/') ? (
                  <Folder size={10} className="shrink-0 text-[var(--ff-text-dim)]" />
                ) : (
                  <FileCode2 size={10} className="shrink-0 text-[var(--ff-text-dim)]" />
                )}
                <span className="truncate">{item.label}</span>
              </li>
            ))}
          </ul>
        </aside>

        <div className="ff-code-surface min-w-0">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
            <span className="font-mono text-[10px] text-white/70">home_screen.dart</span>
            <span className="font-mono text-[9px] text-white/35">Dart</span>
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-[10.5px] leading-[1.85] sm:text-[11px]">
            <code>
              <span className="ff-code-key">class</span> HomeScreen <span className="ff-code-key">extends</span> StatelessWidget {'{\n'}
              {'  '}<span className="ff-code-key">const</span> HomeScreen({'{'}super.key, <span className="ff-code-key">required</span> <span className="ff-code-key">this</span>.goals{'}'});{'\n\n'}
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
              {'}\n'}
            </code>
          </pre>
          <div className="flex items-center gap-2 border-t border-white/10 px-4 py-2.5">
            <Check size={11} className="text-[var(--ff-code-ok)]" />
            <span className="font-mono text-[9px] text-white/50">flutter analyze · no issues</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const HABITS = [
  { label: 'Read 20 pages', meta: '6 / 7 days', width: '86%' },
  { label: 'Morning walk', meta: '5 / 7 days', width: '71%' },
  { label: 'No phone after 22:00', meta: '4 / 7 days', width: '57%' },
];

const VIEWPORTS = [
  { id: 'desktop', label: 'Desktop', width: 440, dims: '1440 × 900' },
  { id: 'tablet', label: 'Tablet', width: 336, dims: '820 × 1180' },
  { id: 'mobile', label: 'Phone', width: 248, dims: '390 × 844' },
] as const;

type Viewport = (typeof VIEWPORTS)[number];

export function PreviewArtifact() {
  const [viewport, setViewport] = useState<Viewport>(VIEWPORTS[0]);

  return (
    <div className="ff-plate overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--ff-rule)] px-4 py-2.5">
        <span className="ff-kicker">Preview / habit.local</span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[9px] text-[var(--ff-accent-ink)]">
          <span className="ff-live-dot h-1.5 w-1.5 rounded-full bg-[var(--ff-accent-ink)]" /> ready
        </span>
      </div>

      <div className="ff-draft-grid relative min-h-[320px] bg-[var(--ff-surface-2)] p-4 sm:min-h-[380px] sm:p-7">
        <div className="relative z-10 flex items-center justify-between gap-3">
          <span className="font-mono text-[8px] text-[var(--ff-text-dim)]">{viewport.dims}</span>
          <div
            role="group"
            aria-label="Preview viewport"
            className="flex items-center gap-0.5 border border-[var(--ff-rule-strong)] bg-[var(--ff-surface)] p-0.5"
          >
            {VIEWPORTS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={viewport.id === option.id}
                onClick={() => setViewport(option)}
                className={cn(
                  'relative h-7 px-2 font-mono text-[8px] uppercase tracking-[0.12em] transition-colors after:absolute after:-inset-y-2',
                  viewport.id === option.id
                    ? 'bg-[var(--ff-text)] text-[var(--ff-bg)]'
                    : 'text-[var(--ff-text-dim)] hover:text-[var(--ff-text)]',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div
          key={viewport.id}
          className="ff-swap mx-auto mt-4 w-full overflow-hidden rounded-md border border-[var(--ff-rule-strong)] bg-[var(--ff-surface)] shadow-[0_18px_40px_-32px_rgba(16,36,31,0.45)] sm:mt-5"
          style={{ maxWidth: `${viewport.width}px` }}
        >
          <div className="flex items-center gap-1.5 border-b border-[var(--ff-rule)] px-3 py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--ff-rule-strong)]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--ff-rule-strong)]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--ff-rule-strong)]" />
            <span className="ml-2 font-mono text-[9px] text-[var(--ff-text-dim)]">habit.local</span>
            <span className="ml-auto font-mono text-[8px] uppercase tracking-[0.12em] text-[var(--ff-text-dim)]">web</span>
          </div>

          <div className="p-4 sm:p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-[var(--ff-text-dim)]">This week</p>
                <p className="ff-display mt-1 text-[26px] font-semibold leading-none text-[var(--ff-text)]">76%</p>
              </div>
              <div className="flex gap-1 pt-1" aria-hidden>
                {[1, 1, 1, 1, 1, 0, 0].map((done, i) => (
                  <span
                    key={i}
                    className={`h-5 w-1.5 rounded-full ${done ? 'bg-[var(--ff-accent-ink)]' : 'bg-[var(--ff-rule)]'}`}
                  />
                ))}
              </div>
            </div>

            <div className={cn('mt-4 space-y-2.5', viewport.id === 'desktop' && 'sm:pr-20')}>
              {HABITS.map((habit) => (
                <div key={habit.label} className="border-t border-[var(--ff-rule)] pt-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-medium text-[var(--ff-text)]">{habit.label}</span>
                    <span className="font-mono text-[8px] text-[var(--ff-text-dim)]">{habit.meta}</span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--ff-rule)]">
                    <div className="h-full rounded-full bg-[var(--ff-accent-ink)]" style={{ width: habit.width }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {viewport.id === 'desktop' ? (
          <div className="ff-float absolute bottom-6 right-5 hidden w-[124px] overflow-hidden rounded-[18px] border border-[var(--ff-rule-strong)] bg-[var(--ff-surface)] p-1 shadow-[0_20px_36px_-26px_rgba(16,36,31,0.55)] sm:block">
            <div className="rounded-[14px] bg-[var(--ff-surface)] p-2.5">
              <div className="mx-auto mb-2 h-1 w-6 rounded-full bg-[var(--ff-rule-strong)]" />
              <p className="font-mono text-[7px] uppercase tracking-[0.12em] text-[var(--ff-text-dim)]">Today</p>
              <p className="mt-1 text-[11px] font-semibold leading-tight text-[var(--ff-text)]">
                Three habits,
                <br />
                one calm list.
              </p>
              <div className="mt-2 space-y-1.5">
                {[1, 1, 0].map((done, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span
                      className={`flex h-3 w-3 items-center justify-center rounded-full border ${
                        done
                          ? 'border-[var(--ff-accent-ink)] bg-[var(--ff-accent-ink)]'
                          : 'border-[var(--ff-rule-strong)]'
                      }`}
                    >
                      {done ? <Check size={7} className="text-white" /> : null}
                    </span>
                    <span className="h-1 flex-1 rounded-full bg-[var(--ff-rule)]" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const DESKTOP_NAV = ['Today', 'History', 'Settings'];
const WEEK_BARS = [34, 52, 28, 64, 46, 22, 16];

export function DesktopArtifact() {
  return (
    <div className="ff-plate overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--ff-rule)] px-4 py-2.5">
        <span className="ff-kicker">Runners / export</span>
        <span className="ff-kicker">macOS · Windows · release</span>
      </div>

      <div className="ff-draft-grid relative bg-[var(--ff-surface-2)] p-4 sm:p-6">
        <div className="overflow-hidden rounded-md border border-[var(--ff-rule-strong)] bg-[var(--ff-surface)] shadow-[0_18px_40px_-32px_rgba(16,36,31,0.45)]">
          <div className="flex items-center gap-1.5 border-b border-[var(--ff-rule)] px-3 py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--ff-rule-strong)]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--ff-rule-strong)]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--ff-rule-strong)]" />
            <span className="ml-2 font-mono text-[9px] text-[var(--ff-text-dim)]">habit_tracker</span>
            <span className="ml-auto font-mono text-[8px] uppercase tracking-[0.12em] text-[var(--ff-text-dim)]">release</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[112px_minmax(0,1fr)]">
            <aside className="hidden border-r border-[var(--ff-rule)] bg-[var(--ff-surface-2)] p-3 sm:block" aria-hidden>
              <p className="ff-kicker">Workspace</p>
              <ul className="mt-2.5 space-y-1">
                {DESKTOP_NAV.map((label, index) => (
                  <li
                    key={label}
                    className={`flex items-center gap-1.5 rounded-[3px] px-1.5 py-1 ${
                      index === 0 ? 'bg-[var(--ff-accent-ink)]/10 text-[var(--ff-text)]' : 'text-[var(--ff-text-muted)]'
                    }`}
                  >
                    <span
                      className={`h-1 w-1 rounded-full ${
                        index === 0 ? 'bg-[var(--ff-accent-ink)]' : 'bg-[var(--ff-rule-strong)]'
                      }`}
                    />
                    <span className="font-mono text-[9px]">{label}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 font-mono text-[8px] leading-relaxed text-[var(--ff-text-dim)]">
                local project
                <br />
                ~/forge/habit
              </p>
            </aside>

            <div className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-[var(--ff-text-dim)]">This week</p>
                  <p className="ff-display mt-1 text-[24px] font-semibold leading-none text-[var(--ff-text)]">76%</p>
                </div>
                <div className="flex items-end gap-1 pt-1" aria-hidden>
                  {WEEK_BARS.map((height, index) => (
                    <span
                      key={index}
                      style={{ height: `${height * 0.55}px` }}
                      className={`w-2 rounded-t-[1px] ${index < 5 ? 'bg-[var(--ff-accent-ink)]' : 'bg-[var(--ff-rule)]'}`}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {HABITS.map((habit) => (
                  <div key={habit.label} className="border-t border-[var(--ff-rule)] pt-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10.5px] font-medium text-[var(--ff-text)]">{habit.label}</span>
                      <span className="font-mono text-[8px] text-[var(--ff-text-dim)]">{habit.meta}</span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--ff-rule)]">
                      <div className="h-full rounded-full bg-[var(--ff-accent-ink)]" style={{ width: habit.width }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-[4px] border border-[var(--ff-rule-strong)] sm:mt-4">
          <div className="ff-code-surface px-3 py-2.5 font-mono text-[9.5px] leading-relaxed">
            <p className="text-white/85">$ flutter build macos --release</p>
            <p className="text-[var(--ff-code-ok)]">✓ habit_tracker.app · 24.6 MB</p>
            <p className="text-white/85">$ flutter build windows --release</p>
            <p className="text-[var(--ff-code-ok)]">✓ habit_tracker.exe · 19.8 MB</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const LOG_LINES = [
  { kind: 'prompt', text: '$ flutter analyze' },
  { kind: 'dim', text: 'Analyzing habit_tracker...' },
  { kind: 'error', text: "error • home_screen.dart:42:5 • The named parameter 'title' isn't defined" },
  { kind: 'blank', text: '' },
  { kind: 'prompt', text: '$ ff repair --from analyze' },
  { kind: 'dim', text: 'reading lib/screens/home_screen.dart' },
  { kind: 'ok', text: 'patch 1/2 applied · HomeHeader(title: health.title)' },
  { kind: 'dim', text: 'rebuilding preview…' },
  { kind: 'blank', text: '' },
  { kind: 'ok', text: '✓ flutter analyze — no issues found' },
  { kind: 'ok', text: '✓ preview ready · 2.1s' },
] as const;

export function RepairArtifact() {
  return (
    <div className="ff-plate overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--ff-rule)] px-4 py-2.5">
        <span className="ff-kicker">Diagnostics / terminal</span>
        <span className="inline-flex items-center gap-1.5 rounded-[3px] border border-[var(--ff-rule)] px-2 py-1 font-mono text-[8px] text-[var(--ff-text-dim)]">
          <TriangleAlert size={9} /> 2 repair rounds max
        </span>
      </div>

      <div className="ff-code-surface p-4 sm:p-5">
        <div className="space-y-1.5 font-mono text-[10px] leading-relaxed sm:text-[10.5px]">
          {LOG_LINES.map((line, index) => (
            <p
              key={index}
              className={
                line.kind === 'error'
                  ? 'text-[var(--ff-code-error)]'
                  : line.kind === 'ok'
                    ? 'text-[var(--ff-code-ok)]'
                    : line.kind === 'prompt'
                      ? 'text-white/85'
                      : line.kind === 'dim'
                        ? 'text-white/40'
                        : ''
              }
            >
              {line.text || '\u00A0'}
            </p>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-3">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--ff-code-ok)]" />
          <span className="font-mono text-[9px] text-white/45">compiler loop closed · no manual step</span>
        </div>
      </div>
    </div>
  );
}
