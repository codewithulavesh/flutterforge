import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FolderOpen, LogOut, Plus, Search, SearchX, Sparkles, X } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { useProjectStore } from '@/stores/project.store';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ProjectCard } from '@/features/dashboard/ProjectCard';
import { CreateProjectWizard } from '@/features/dashboard/CreateProjectWizard';
import { HERO_PROMPT_KEY } from '@/utils/landing';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/utils/cn';

type SortBy = 'updated' | 'created' | 'name';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function initialsOf(name?: string | null, email?: string | null): string {
  const source = (name || email || '?').trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

function ProjectSkeletons() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading projects"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          className="animate-pulse overflow-hidden rounded-2xl border border-[var(--ff-border)] bg-[var(--ff-surface)] p-5"
          key={index}
          style={{ animationDelay: `${index * 60}ms` }}
        >
          <div className="h-10 w-10 rounded-xl bg-[var(--ff-surface-2)]" />
          <div className="mt-4 h-4 w-3/5 rounded bg-[var(--ff-surface-2)]" />
          <div className="mt-2 h-3 w-full rounded bg-[var(--ff-surface-2)]" />
          <div className="mt-1.5 h-3 w-4/5 rounded bg-[var(--ff-surface-2)]" />
          <div className="mt-5 h-3 w-1/3 rounded bg-[var(--ff-surface-2)]" />
        </div>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projects, loadProjects, loading } = useProjectStore();
  const { profile, signOut } = useAuthStore();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardDescription, setWizardDescription] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('updated');
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Native menu / global command: open the creation wizard.
  useEffect(() => {
    const open = () => {
      setWizardDescription('');
      setWizardOpen(true);
    };
    window.addEventListener('ff:new-project', open);
    return () => window.removeEventListener('ff:new-project', open);
  }, []);

  // "/" focuses search, like most dev tools (ignored while typing in a field).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      event.preventDefault();
      searchRef.current?.querySelector('input')?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Prompt-first entry: a Hero prompt (via navigation state or sessionStorage
  // when it survived the signup hop) opens the wizard with it prefilled.
  useEffect(() => {
    const fromState = (location.state as { heroPrompt?: string } | null)?.heroPrompt?.trim();
    let fromStorage = '';
    try {
      fromStorage = (sessionStorage.getItem(HERO_PROMPT_KEY) || '').trim();
      sessionStorage.removeItem(HERO_PROMPT_KEY);
    } catch {
      // storage unavailable — state only
    }
    const heroPrompt = fromState || fromStorage;
    if (heroPrompt) {
      setWizardDescription(heroPrompt);
      setWizardOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...projects]
      .filter((p) => !query
        || p.name.toLowerCase().includes(query)
        || p.description?.toLowerCase().includes(query))
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'created') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
  }, [projects, search, sortBy]);

  const stats = useMemo(() => {
    const now = Date.now();
    const active = projects.filter((p) => now - new Date(p.updated_at).getTime() < WEEK_MS).length;
    const latest = [...projects].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )[0];
    return { total: projects.length, active, latest: latest?.name ?? '—' };
  }, [projects]);

  const hasProjects = projects.length > 0;
  const searching = search.trim().length > 0;
  const firstName = profile?.full_name?.split(' ')[0];

  const openWizard = () => {
    setWizardDescription('');
    setWizardOpen(true);
  };

  return (
    <div className="min-h-[100dvh] bg-[var(--ff-bg)] ff-brand ff-studio">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--ff-border)] bg-[var(--ff-bg)]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between sm:h-16">
            <button
              aria-label="FlutterForge home"
              className="flex items-center gap-2 rounded-lg transition-opacity hover:opacity-80"
              onClick={() => navigate('/')}
              type="button"
            >
              <BrandLogo size={30} />
              <span className="text-base font-bold text-[var(--ff-text)] sm:text-lg">FlutterForge</span>
            </button>

            <div className="flex items-center gap-1.5 sm:gap-3">
              <ThemeToggle />
              <div className="hidden items-center gap-2.5 border-l border-[var(--ff-border)] pl-3 sm:flex">
                <div
                  aria-hidden
                  className="flex size-8 items-center justify-center rounded-full bg-[var(--ff-primary)]/15 font-mono text-[11px] font-semibold text-[var(--ff-primary)]"
                >
                  {initialsOf(profile?.full_name, profile?.email)}
                </div>
                <span className="max-w-[180px] truncate text-sm text-[var(--ff-text-muted)]">{profile?.email}</span>
              </div>
              <Button variant="ghost" size="sm" icon={<LogOut size={14} />} onClick={signOut}>
                <span className="hidden sm:inline">Sign Out</span>
                <span className="sr-only sm:hidden">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 sm:pb-12 sm:pt-10 lg:px-8">
        {/* Welcome */}
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="ff-label mb-1.5 text-[10px] text-[var(--ff-text-dim)]">{greeting()}</p>
            <h1 className="ff-display truncate text-2xl font-bold tracking-tight text-[var(--ff-text)] sm:text-3xl">
              Welcome back{firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="mt-1 text-[13px] text-[var(--ff-text-muted)] sm:text-sm">
              Manage your Flutter projects and create new ones with AI.
            </p>
          </div>

          {/* Stats */}
          {hasProjects && !loading && (
            <dl className="grid grid-cols-3 divide-x divide-[var(--ff-border)] overflow-hidden rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface)] shadow-[var(--ff-soft-shadow)] lg:min-w-[420px]">
              <div className="px-3 py-3 sm:px-4">
                <dt className="text-[10px] uppercase tracking-wide text-[var(--ff-text-dim)]">Projects</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--ff-text)] sm:text-xl">{stats.total}</dd>
              </div>
              <div className="px-3 py-3 sm:px-4">
                <dt className="text-[10px] uppercase tracking-wide text-[var(--ff-text-dim)]">Active · 7d</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--ff-text)] sm:text-xl">{stats.active}</dd>
              </div>
              <div className="min-w-0 px-3 py-3 sm:px-4">
                <dt className="text-[10px] uppercase tracking-wide text-[var(--ff-text-dim)]">Latest</dt>
                <dd className="mt-1 truncate text-[13px] font-medium text-[var(--ff-text)] sm:text-sm" title={stats.latest}>
                  {stats.latest}
                </dd>
              </div>
            </dl>
          )}
        </div>

        {/* Actions bar */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1" ref={searchRef}>
            <div className="relative">
              <Input
                aria-label="Search projects"
                icon={<Search size={16} />}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSearch('');
                }}
                placeholder="Search projects…  (press / to focus)"
                value={search}
              />
              {searching && (
                <button
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[var(--ff-text-dim)] transition-colors hover:bg-[var(--ff-surface-2)] hover:text-[var(--ff-text)]"
                  onClick={() => setSearch('')}
                  type="button"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <select
              aria-label="Sort projects"
              className="ff-input min-w-0 flex-1 px-3 py-2.5 text-sm sm:flex-none"
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              value={sortBy}
            >
              <option value="updated">Last Updated</option>
              <option value="created">Newest First</option>
              <option value="name">Name (A-Z)</option>
            </select>
            <Button className="hidden shrink-0 sm:inline-flex" icon={<Plus size={16} />} onClick={openWizard}>
              New App
            </Button>
          </div>
        </div>

        {/* Result count */}
        {!loading && hasProjects && (
          <p aria-live="polite" className="mb-3 text-xs text-[var(--ff-text-dim)]">
            {searching
              ? `${filtered.length} of ${projects.length} project${projects.length === 1 ? '' : 's'} match “${search.trim()}”`
              : `${projects.length} project${projects.length === 1 ? '' : 's'}`}
          </p>
        )}

        {/* Projects */}
        {loading ? (
          <ProjectSkeletons />
        ) : !hasProjects ? (
          <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--ff-border)] bg-[var(--ff-surface)]/60 px-6 py-14 text-center sm:py-20">
            <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-[var(--ff-primary)]/10">
              <FolderOpen className="text-[var(--ff-primary)]" size={28} />
            </div>
            <h3 className="mb-1 text-lg font-semibold text-[var(--ff-text)]">No projects yet</h3>
            <p className="mb-6 text-sm text-[var(--ff-text-muted)]">
              Describe an app and FlutterForge will write, compile and preview it for you.
            </p>
            <Button icon={<Sparkles size={16} />} onClick={openWizard}>Create your first app</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center justify-center px-6 py-14 text-center sm:py-20">
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-[var(--ff-surface-2)]">
              <SearchX className="text-[var(--ff-text-dim)]" size={24} />
            </div>
            <h3 className="mb-1 text-base font-semibold text-[var(--ff-text)]">No matching projects</h3>
            <p className="mb-5 text-sm text-[var(--ff-text-muted)]">
              Nothing matches “{search.trim()}”. Try a different keyword or clear the search.
            </p>
            <Button onClick={() => setSearch('')} variant="ghost">Clear search</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </main>

      {/* Mobile quick-create */}
      <button
        aria-label="New app"
        className={cn(
          'ff-cta fixed right-4 z-30 flex items-center gap-2 rounded-full px-5 py-3.5 text-sm font-semibold shadow-[var(--ff-soft-shadow-lg)] sm:hidden',
          'bottom-[max(1rem,env(safe-area-inset-bottom))]',
        )}
        onClick={openWizard}
        type="button"
      >
        <Plus size={18} /> New App
      </button>

      <CreateProjectWizard
        open={wizardOpen}
        initialDescription={wizardDescription}
        onClose={() => {
          setWizardOpen(false);
          setWizardDescription('');
        }}
      />
    </div>
  );
}