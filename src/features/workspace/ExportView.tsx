import { Download, FileArchive, Check, FileCode2, Database, Settings2, Monitor, FolderOpen } from 'lucide-react';
import { useState } from 'react';
import { useProjectStore } from '@/stores/project.store';
import { toast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { downloadProjectZip, formatBytes, type BuiltZip } from '@/utils/exportProject';
import { HarnessClient } from '@/agent/harnessClient';

export function ExportView() {
  const { currentProject, files } = useProjectStore();
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<BuiltZip | null>(null);
  const [opening, setOpening] = useState(false);
  const isDesktop = Boolean(window.flutterforgeDesktop?.isDesktop);

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
