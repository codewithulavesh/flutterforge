import {
  Download,
  FileArchive,
  Check,
  FileCode2,
  Database,
  Settings2,
  Monitor,
  FolderOpen,
  Rocket,
  ExternalLink,
  Copy,
  ScrollText,
  Globe,
  Smartphone,
  Laptop,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useProjectStore } from '@/stores/project.store';
import { toast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { downloadProjectZip, formatBytes, type BuiltZip } from '@/utils/exportProject';
import { HarnessClient } from '@/agent/harnessClient';
import { usePublishStore, type PublishTarget } from '@/stores/publish.store';
import { cn } from '@/utils/cn';

const TARGETS: Array<{ id: PublishTarget; label: string; icon: typeof Globe; hint: string }> = [
  { id: 'web', label: 'Web', icon: Globe, hint: 'Static Flutter web bundle served by the local engine.' },
  { id: 'pwa', label: 'PWA', icon: Globe, hint: 'Web build with manifest and service worker checks for installability.' },
  { id: 'android', label: 'APK', icon: Smartphone, hint: 'Release APK via the Android toolchain on this machine.' },
  { id: 'macos', label: 'macOS', icon: Monitor, hint: 'Release .app bundle — requires a Mac.' },
  { id: 'windows', label: 'Windows', icon: Laptop, hint: 'Release Windows runner — requires Windows.' },
];

function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms < 0) return '—';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

/** Desktop builds call the embedded engine; web builds may point at a preview host. */
const API_PREFIX = (typeof window !== 'undefined' && window.flutterforgeDesktop?.isDesktop
  ? ''
  : import.meta.env.VITE_PREVIEW_API_URL || '').replace(/\/+$/, '');

export function ExportView() {
  const { currentProject, files } = useProjectStore();
  const { jobs, starting, publish, refresh } = usePublishStore();
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<BuiltZip | null>(null);
  const [opening, setOpening] = useState(false);
  const isDesktop = Boolean(window.flutterforgeDesktop?.isDesktop);
  const hostPlatform = window.flutterforgeDesktop?.platform ?? 'web';

  const initialTarget = (): PublishTarget => {
    const platform = String(currentProject?.platform || 'web').toLowerCase();
    if (platform === 'macos') return 'macos';
    if (platform === 'windows') return 'windows';
    if (platform === 'mobile') return 'android';
    if (platform === 'desktop') return hostPlatform === 'win32' ? 'windows' : 'macos';
    return 'web';
  };
  const [target, setTarget] = useState<PublishTarget>(initialTarget);
  const job = currentProject ? jobs[currentProject.id] : undefined;

  useEffect(() => {
    if (!currentProject) return;
    setTarget(initialTarget());
    void refresh(currentProject.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id]);

  if (!currentProject) return null;

  async function handleExport() {
    setExporting(true);
    try {
      const built = await downloadProjectZip(currentProject!, files);
      setLastExport(built);
      toast('success', `Exported ${built.fileCount} files (${formatBytes(built.bytes)}) as ${built.filename}`);
    } catch (err) {
      toast('error', err instanceof Error ? `Export failed: ${err.message}` : 'Export failed');
    }
    setExporting(false);
  }

  async function handleOpenWorkspace() {
    const bridge = window.flutterforgeDesktop;
    if (!bridge || !currentProject) return;
    setOpening(true);
    try {
      const workspace = await new HarnessClient().workspacePath(currentProject.id);
      if (!workspace) throw new Error('The harness workspace is not available yet. Generate the app first.');
      const result = await bridge.openPath(workspace);
      if (!result.ok) throw new Error(result.error || 'Could not open the folder.');
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Could not open the workspace.');
    }
    setOpening(false);
  }

  const targetUnavailable =
    (target === 'macos' && hostPlatform !== 'darwin') ||
    (target === 'windows' && hostPlatform !== 'win32');

  const publicUrl = job?.report?.publicPath
    ? `${window.location.origin}${job.report.publicPath}`
    : null;

  async function handlePublish() {
    if (!currentProject) return;
    if (targetUnavailable) {
      toast('error', `${target === 'macos' ? 'macOS' : 'Windows'} builds must run on a ${target === 'macos' ? 'Mac' : 'Windows machine'}.`);
      return;
    }
    const label = TARGETS.find((item) => item.id === target)?.label ?? target;
    toast('info', `Publishing ${label}… the log stays here while the build runs.`);
    await publish(currentProject.id, files, target);
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast('success', 'Publish URL copied');
    } catch {
      toast('error', 'Could not copy the URL');
    }
  }

  const liveFiles = files.filter((f) => !f.is_directory);
  const dartCount = liveFiles.filter((f) => f.path.endsWith('.dart')).length;
  const sqlCount = liveFiles.filter((f) => f.path.endsWith('.sql')).length;
  const configCount = liveFiles.filter((f) => f.path.endsWith('.yaml') || f.path.endsWith('.md')).length;
  const fileCount = liveFiles.length;
  const targetPlatform = String(currentProject.platform || 'web').toLowerCase();
  const platformTargets = targetPlatform === 'mobile'
    ? 'android,ios'
    : targetPlatform === 'desktop'
      ? 'macos,windows'
      : targetPlatform === 'macos' || targetPlatform === 'windows'
        ? targetPlatform
        : 'web';
  const platformCommand = platformTargets === 'web'
    ? `# web/index.html is included in the ZIP
flutter pub get
flutter build web --release`
    : `bash tool/create_platforms.sh ${platformTargets}
flutter pub get
flutter run -d <device>`;
  const platformTitle = targetPlatform === 'web'
    ? 'Web'
    : targetPlatform === 'mobile'
      ? 'Android + iOS'
      : targetPlatform === 'desktop'
        ? 'macOS + Windows'
        : targetPlatform === 'macos'
          ? 'macOS'
          : 'Windows';

  return (
    <div className="flex flex-col h-full bg-[var(--ff-bg)] overflow-y-auto ff-scrollbar">
      <div className="max-w-2xl mx-auto w-full p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Download size={18} className="text-[var(--ff-primary)]" />
          <h2 className="text-lg font-semibold text-[var(--ff-text)]">Export Project</h2>
        </div>

        <div className="ff-card p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--ff-primary)]/10 flex items-center justify-center mx-auto mb-4">
            <FileArchive size={28} className="text-[var(--ff-primary)]" />
          </div>
          <h3 className="text-base font-semibold text-[var(--ff-text)] mb-1">Export as ZIP</h3>
          <p className="text-sm text-[var(--ff-text-muted)] mt-1 mb-4">
            Download a complete Flutter project with all source files. The ZIP runs independently with Flutter SDK.
          </p>

          <div className="flex items-center justify-center gap-6 mb-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-[var(--ff-text)]">{fileCount}</p>
              <p className="text-xs text-[var(--ff-text-dim)]">Files</p>
            </div>
            <div className="w-px h-10 bg-[var(--ff-border)]" />
            <div className="text-center">
              <p className="text-2xl font-bold text-[var(--ff-text)]">{currentProject.template}</p>
              <p className="text-xs text-[var(--ff-text-dim)]">Template</p>
            </div>
            <div className="w-px h-10 bg-[var(--ff-border)]" />
            <div className="text-center">
              <p className="text-2xl font-bold text-[var(--ff-text)]">{currentProject.flutter_version}</p>
              <p className="text-xs text-[var(--ff-text-dim)]">Flutter</p>
            </div>
          </div>

          <Button loading={exporting} onClick={handleExport} icon={!exporting ? <Download size={14} /> : undefined}>
            {exporting ? 'Exporting...' : 'Download ZIP'}
          </Button>

          {lastExport && (
            <p className="text-xs text-[var(--ff-text-dim)] mt-3 font-mono break-all">
              {lastExport.filename} · {lastExport.fileCount} files · {formatBytes(lastExport.bytes)}
            </p>
          )}
        </div>

        <div className="ff-card p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-[var(--ff-primary)]/10 text-[var(--ff-primary)]">
                <Rocket size={16} />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-[var(--ff-text)]">Publish</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--ff-text-muted)]">
                  One click builds the app locally, hosts the web bundle, and writes a build report.
                  Web and PWA work everywhere; APK and desktop builds use this machine’s toolchains.
                </p>
              </div>
            </div>
            {job && job.status !== 'none' && (
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em]',
                  job.status === 'succeeded'
                    ? 'bg-[var(--fb-lime)] text-black'
                    : job.status === 'failed'
                      ? 'border border-rose-500/40 text-rose-400'
                      : 'bg-[var(--fb-cyan)] text-black',
                )}
              >
                {job.status === 'building' ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : job.status === 'failed' ? (
                  <AlertTriangle size={11} />
                ) : (
                  <Check size={11} />
                )}
                {job.status === 'building' ? 'Building' : job.status === 'failed' ? 'Failed' : 'Published'}
              </span>
            )}
          </div>

          <div aria-label="Publish target" className="flex flex-wrap gap-1.5" role="group">
            {TARGETS.map(({ id, label, icon: Icon, hint }) => {
              const active = target === id;
              const blocked =
                (id === 'macos' && hostPlatform !== 'darwin') ||
                (id === 'windows' && hostPlatform !== 'win32');
              return (
                <button
                  aria-pressed={active}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors',
                    active
                      ? 'border-[var(--ff-primary)] bg-[var(--ff-primary)] text-white'
                      : 'border-[var(--ff-border)] text-[var(--ff-text-muted)] hover:border-[var(--ff-primary)] hover:text-[var(--ff-text)]',
                    blocked && !active && 'opacity-60',
                  )}
                  key={id}
                  onClick={() => setTarget(id)}
                  title={hint}
                  type="button"
                >
                  <Icon size={12} />
                  {label}
                </button>
              );
            })}
          </div>

          <p className="text-[11px] leading-relaxed text-[var(--ff-text-muted)]">
            {TARGETS.find((item) => item.id === target)?.hint}
            {targetUnavailable && (
              <span className="text-amber-500">
                {' '}
                This build needs a {target === 'macos' ? 'Mac' : 'Windows machine'} — publish Web or PWA here instead.
              </span>
            )}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={targetUnavailable || starting || job?.status === 'building'}
              icon={job?.status === 'building' ? undefined : <Rocket size={14} />}
              loading={job?.status === 'building'}
              onClick={() => void handlePublish()}
            >
              {job?.status === 'building' ? 'Publishing…' : `Publish ${TARGETS.find((item) => item.id === target)?.label ?? ''}`}
            </Button>
            {job?.status === 'building' && job.logs?.length ? (
              <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-[var(--ff-text-dim)]" title={job.logs[job.logs.length - 1]}>
                {job.logs[job.logs.length - 1]}
              </span>
            ) : null}
          </div>

          {job?.status === 'building' && job.logs && job.logs.length > 0 && (
            <div className="max-h-28 overflow-y-auto rounded-lg border border-[var(--ff-border)]/60 bg-[var(--ff-bg-subtle)] p-2.5 font-mono text-[10px] leading-relaxed text-[var(--ff-text-muted)] ff-scrollbar">
              {job.logs.slice(-8).map((line, index) => (
                <div className="break-all" key={`${index}-${line}`}>{line}</div>
              ))}
            </div>
          )}

          {job?.status === 'succeeded' && job.report && (
            <div className="space-y-3 rounded-xl border border-[var(--ff-border)]/60 bg-[var(--ff-bg-subtle)] p-3">
              {publicUrl && (
                <div className="flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-md border border-[var(--ff-border)]/60 bg-[var(--ff-bg)] px-2 py-1.5 font-mono text-[10.5px] text-[var(--ff-text-muted)]">
                    {publicUrl}
                  </code>
                  <Button size="sm" variant="secondary" icon={<ExternalLink size={12} />} onClick={() => window.open(publicUrl, '_blank', 'noopener')}>
                    Open
                  </Button>
                  <Button size="sm" variant="ghost" icon={<Copy size={12} />} onClick={() => void copyUrl(publicUrl)}>
                    Copy
                  </Button>
                </div>
              )}

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] sm:grid-cols-4">
                <div>
                  <dt className="text-[var(--ff-text-dim)]">Build time</dt>
                  <dd className="font-mono text-[var(--ff-text)]">{formatDuration(job.report.durationMs)}</dd>
                </div>
                <div>
                  <dt className="text-[var(--ff-text-dim)]">Files</dt>
                  <dd className="font-mono text-[var(--ff-text)]">{job.report.fileCount}</dd>
                </div>
                <div>
                  <dt className="text-[var(--ff-text-dim)]">Artifact</dt>
                  <dd className="truncate font-mono text-[var(--ff-text)]" title={job.report.artifact?.name}>
                    {job.report.artifact ? formatBytes(job.report.artifact.bytes) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--ff-text-dim)]">Analyzer</dt>
                  <dd className={cn('font-mono', job.report.analyzer?.errors ? 'text-rose-400' : 'text-[var(--ff-text)]')}>
                    {job.report.analyzer ? `${job.report.analyzer.errors} err · ${job.report.analyzer.warnings} warn` : 'skipped'}
                  </dd>
                </div>
              </dl>

              {job.report.notes.length > 0 && (
                <ul className="space-y-1">
                  {job.report.notes.map((note) => (
                    <li className="flex items-start gap-1.5 text-[10.5px] leading-snug text-[var(--ff-text-muted)]" key={note}>
                      <Check size={11} className="mt-0.5 shrink-0 text-emerald-500" />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <a
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ff-border)] px-3 py-1.5 text-xs font-medium text-[var(--ff-text)] transition-colors hover:border-[var(--ff-primary)] hover:text-[var(--ff-primary)]"
                  download
                  href={`${API_PREFIX}/api/publish/project/${currentProject.id}/report`}
                >
                  <ScrollText size={12} />
                  Build report
                </a>
                {job.report.target === 'android' && (
                  <a
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ff-border)] px-3 py-1.5 text-xs font-medium text-[var(--ff-text)] transition-colors hover:border-[var(--ff-primary)] hover:text-[var(--ff-primary)]"
                    download
                    href={`${API_PREFIX}/api/publish/project/${currentProject.id}/artifact`}
                  >
                    <Download size={12} />
                    Download APK
                  </a>
                )}
                {job.report.artifact?.kind === 'directory' && isDesktop && (
                  <span className="font-mono text-[10px] text-[var(--ff-text-dim)]">
                    {job.report.artifact.name} built in the project workspace
                  </span>
                )}
              </div>
            </div>
          )}

          {job?.status === 'failed' && (
            <div className="space-y-2 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3">
              <p className="text-[11.5px] font-medium leading-relaxed text-rose-400">
                {job.error || job.report?.error || 'The publish build failed.'}
              </p>
              {job.logs && job.logs.length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer font-mono text-[9.5px] uppercase tracking-[0.12em] text-[var(--ff-text-dim)]">
                    Last build lines
                  </summary>
                  <div className="mt-2 max-h-32 overflow-y-auto rounded-md bg-black/30 p-2 font-mono text-[10px] leading-relaxed text-[var(--ff-text-muted)] ff-scrollbar">
                    {job.logs.slice(-10).map((line, index) => (
                      <div className="break-all" key={`${index}-${line}`}>{line}</div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>

        <div className="ff-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Monitor size={15} className="text-[var(--ff-primary)]" />
            <h4 className="text-sm font-semibold text-[var(--ff-text)]">Platform runners · {platformTitle}</h4>
          </div>
          <p className="text-xs text-[var(--ff-text-muted)] mb-3">
            FlutterForge writes the app source only — no starter counter app. Flutter still
            needs its standard platform folders to build. The ZIP includes a script that adds
            them without touching <span className="font-mono">lib/</span> or <span className="font-mono">pubspec.yaml</span>.
          </p>
          <pre className="text-[11px] leading-relaxed font-mono bg-[var(--ff-bg-subtle)] border border-[var(--ff-border)] rounded-lg p-3 overflow-x-auto text-[var(--ff-text-muted)]">
{platformCommand}
          </pre>
          {isDesktop && (
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              loading={opening}
              onClick={handleOpenWorkspace}
              icon={!opening ? <FolderOpen size={14} /> : undefined}
            >
              {opening ? 'Opening…' : 'Open project folder'}
            </Button>
          )}
        </div>

        <div className="ff-card p-4">
          <h4 className="text-sm font-semibold text-[var(--ff-text)] mb-3">What's included</h4>
          <ul className="space-y-2">
            {[
              { icon: <FileCode2 size={14} className="text-[var(--ff-primary)] shrink-0" />, label: `${dartCount} Dart source files in lib/` },
              { icon: <Database size={14} className="text-emerald-400 shrink-0" />, label: `${sqlCount} Supabase migration${sqlCount === 1 ? '' : 's'} with RLS policies` },
              { icon: <Settings2 size={14} className="text-amber-400 shrink-0" />, label: `${configCount} config files (pubspec.yaml, analysis_options.yaml)` },
              { icon: <Check size={14} className="text-emerald-400 shrink-0" />, label: 'README.md with setup, build & Supabase instructions' },
            ].map((item) => (
              <li key={item.label} className="flex items-center gap-2 text-xs text-[var(--ff-text-muted)]">
                {item.icon}
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
