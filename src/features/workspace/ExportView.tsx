import { Download, FileArchive, Check } from 'lucide-react';
import { useState } from 'react';
import { useProjectStore } from '@/stores/project.store';
import { toast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { generateFlutterProjectFiles, DEFAULT_THEME } from '@/utils/flutterTemplates';
import { toSnakeCase } from '@/utils/flutterTemplates';

export function ExportView() {
  const { currentProject, files } = useProjectStore();
  const [exporting, setExporting] = useState(false);

  if (!currentProject) return null;

  async function handleExport() {
    setExporting(true);
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const projectName = toSnakeCase(currentProject!.name);

      if (files.length === 0) {
        const generated = generateFlutterProjectFiles(
          currentProject!.name,
          currentProject!.template,
          ['home'],
          [],
          DEFAULT_THEME
        );
        for (const file of generated) {
          if (file.content) zip.file(file.path, file.content);
        }
      } else {
        for (const file of files) {
          if (!file.is_directory && file.content) {
            zip.file(file.path, file.content);
          }
        }
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast('success', 'Project exported as ZIP');
    } catch {
      toast('error', 'Export failed');
    }
    setExporting(false);
  }

  const fileCount = files.filter((f) => !f.is_directory).length;

  return (
    <div className="flex flex-col h-full bg-[var(--ff-bg)] overflow-y-auto ff-scrollbar">
      <div className="max-w-2xl mx-auto w-full p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Download size={18} className="text-[var(--ff-primary)]" />
          <h2 className="text-lg font-semibold text-white">Export Project</h2>
        </div>

        <div className="ff-card p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--ff-primary)]/10 flex items-center justify-center mx-auto mb-4">
            <FileArchive size={28} className="text-[var(--ff-primary)]" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">Export as ZIP</h3>
          <p className="text-sm text-[var(--ff-text-muted)] mt-1 mb-4">
            Download a complete Flutter project with all source files. The ZIP runs independently with Flutter SDK.
          </p>

          <div className="flex items-center justify-center gap-6 mb-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{fileCount}</p>
              <p className="text-xs text-[var(--ff-text-dim)]">Files</p>
            </div>
            <div className="w-px h-10 bg-[var(--ff-border)]" />
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{currentProject.template}</p>
              <p className="text-xs text-[var(--ff-text-dim)]">Template</p>
            </div>
            <div className="w-px h-10 bg-[var(--ff-border)]" />
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{currentProject.flutter_version}</p>
              <p className="text-xs text-[var(--ff-text-dim)]">Flutter</p>
            </div>
          </div>

          <Button loading={exporting} onClick={handleExport} icon={!exporting ? <Download size={14} /> : undefined}>
            {exporting ? 'Exporting...' : 'Download ZIP'}
          </Button>
        </div>

        <div className="ff-card p-4">
          <h4 className="text-sm font-semibold text-white mb-3">What's included</h4>
          <ul className="space-y-2">
            {[
              'Complete lib/ directory with Dart source files',
              'pubspec.yaml with all dependencies',
              'analysis_options.yaml for linting',
              'README.md with setup instructions',
              'Standard Flutter project structure',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-xs text-[var(--ff-text-muted)]">
                <Check size={14} className="text-emerald-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
