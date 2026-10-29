import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Search, LogOut } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { useProjectStore } from '@/stores/project.store';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ProjectCard } from '@/features/dashboard/ProjectCard';
import { CreateProjectWizard } from '@/features/dashboard/CreateProjectWizard';
import { HERO_PROMPT_KEY } from '@/utils/landing';
import { InlineSpinner } from '@/components/ui/Spinner';
import { ThemeToggle } from '@/components/ThemeToggle';

type SortBy = 'updated' | 'created' | 'name';

export function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projects, loadProjects, loading } = useProjectStore();
  const { profile, signOut } = useAuthStore();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardDescription, setWizardDescription] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('updated');

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

  const filtered = [...projects]
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'created') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  return (
    <div className="min-h-screen bg-[var(--ff-bg)] ff-brand ff-studio">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[var(--ff-bg)]/80 backdrop-blur-xl border-b border-[var(--ff-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
              <BrandLogo size={32} />
              <span className="text-lg font-bold text-[var(--ff-text)]">FlutterForge</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <ThemeToggle />
              <span className="text-sm text-[var(--ff-text-muted)] hidden sm:block max-w-[160px] truncate">{profile?.email}</span>
              <Button variant="ghost" size="sm" icon={<LogOut size={14} />} onClick={signOut}>Sign Out</Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="ff-display text-3xl font-bold text-[var(--ff-text)] mb-1">
            Welcome back{profile?.full_name ? `, ${profile.full_name}` : ''}
          </h1>
          <p className="text-sm text-[var(--ff-text-muted)]">Manage your Flutter projects and create new ones with AI.</p>
        </div>

        {/* Actions bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1">
            <Input
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search size={16} />}
            />
          </div>
          <div className="flex gap-2">
            <select
              className="ff-input px-3 py-2.5 text-sm"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
            >
              <option value="updated">Last Updated</option>
              <option value="created">Newest First</option>
              <option value="name">Name (A-Z)</option>
            </select>
            <Button icon={<Plus size={16} />} onClick={() => setWizardOpen(true)}>New App</Button>
          </div>
        </div>

        {/* Projects */}
        {loading ? (
          <InlineSpinner label="Loading projects..." />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--ff-primary)]/10 flex items-center justify-center mb-4">
              <Plus size={28} className="text-[var(--ff-primary)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--ff-text)] mb-1">No projects yet</h3>
            <p className="text-sm text-[var(--ff-text-muted)] mb-6">Create your first Flutter app with AI.</p>
            <Button icon={<Plus size={16} />} onClick={() => setWizardOpen(true)}>Create New App</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </main>

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
