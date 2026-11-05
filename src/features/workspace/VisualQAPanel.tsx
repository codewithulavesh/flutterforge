import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Maximize2, RefreshCw, ScanEye, Wrench, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useVisualQAStore } from '@/stores/visualQA.store';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { cn } from '@/utils/cn';

interface VisualQAPanelProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  previewUrl: string | null;
}

/** Turn the sweep into a precise instruction the builder can act on. */
function buildFixPrompt(result: QACaptureResult): string {
  const captures = result.captures ?? [];
  const findings = captures.map((capture) => {
    const status = capture.issues.length ? capture.issues.join('; ') : 'no visible issues';
    return `- ${capture.label} (${capture.width}×${capture.height}): ${status}`;
  });
  const elements = (result.semantics ?? [])
    .filter((node) => node.label)
    .slice(0, 14)
    .map((node) => `${node.role} "${node.label}" @ ${node.x},${node.y}`);

  return [
    'Fix the visual issues in the running preview.',
    '',
    'Visual QA findings:',
    ...findings,
    ...(elements.length ? ['', `Visible elements: ${elements.join(', ')}`] : []),
    '',
    'Keep the approved design language and fix the root cause in the widget tree.',
  ].join('\n');
}

export function VisualQAPanel({ open, onClose, projectId, previewUrl }: VisualQAPanelProps) {
  const { running, error, result, run, reset } = useVisualQAStore();
  const setActiveView = useWorkspaceStore((state) => state.setActiveView);
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    if (open && previewUrl && !result && !running) {
      void run(projectId, previewUrl);
    }
  }, [open, previewUrl, result, running, projectId, run]);

  const captures = result?.captures ?? [];
  const issueCount = useMemo(
    () => captures.reduce((total, capture) => total + capture.issues.length, 0),
    [captures],
  );
  const elements = useMemo(
    () => (result?.semantics ?? []).filter((node) => node.label).slice(0, 16),
    [result],
  );

  function sendToBuilder() {
    if (!result) return;
    const text = buildFixPrompt(result);
    setActiveView('ai-builder');
    window.dispatchEvent(new CustomEvent('ff:prefill-composer', { detail: { text } }));
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Visual QA" size="xl">
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-[var(--ff-text)]">
              <ScanEye size={15} className="text-[var(--ff-primary)]" />
              Mobile, tablet, and desktop sweep
            </p>
            <p className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-[var(--ff-text-muted)]">
              Flutter paints into a canvas, so the desktop shell captures the real running app in Chromium
              at each device size, reads its accessibility tree, and checks for blank screens, flat
              contrast, and overflow stripes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {result && (
              <span className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em]',
                issueCount ? 'border border-amber-500/40 text-amber-500' : 'bg-[var(--fb-lime)] text-black',
              )}>
                {issueCount ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
                {issueCount ? `${issueCount} to review` : 'Looks clear'}
              </span>
            )}
            <Button
              size="sm"
              variant="ghost"
              icon={<RefreshCw size={12} className={running ? 'animate-spin' : ''} />}
              onClick={() => void run(projectId, previewUrl)}
              disabled={running || !previewUrl}
            >
              {result ? 'Re-run' : 'Run sweep'}
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[11.5px] leading-relaxed text-rose-400">
            {error}
          </div>
        )}

        {running && (
          <div className="flex items-center gap-3 rounded-xl border border-[var(--ff-border)]/60 bg-[var(--ff-surface)] px-4 py-6">
            <Loader2 size={18} className="animate-spin text-[var(--ff-primary)]" />
            <div>
              <p className="text-[12px] font-semibold text-[var(--ff-text)]">Capturing the live preview…</p>
              <p className="mt-0.5 text-[11px] text-[var(--ff-text-muted)]">Three Chromium windows, one per device. This takes a few seconds.</p>
            </div>
          </div>
        )}

        {!running && !result && !error && (
          <div className="rounded-xl border border-dashed border-[var(--ff-border)]/70 px-4 py-8 text-center">
            <p className="text-[12px] font-semibold text-[var(--ff-text)]">No sweep yet</p>
            <p className="mx-auto mt-1 max-w-sm text-[11.5px] leading-relaxed text-[var(--ff-text-muted)]">
              Compile the preview, then capture all three device sizes to check the real rendered screen.
            </p>
            <Button
              className="mt-4"
              size="sm"
              icon={<ScanEye size={13} />}
              onClick={() => void run(projectId, previewUrl)}
              disabled={!previewUrl}
            >
              Run Visual QA
            </Button>
          </div>
        )}

        {captures.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {captures.map((capture) => (
              <div
                key={`${capture.label}-${capture.width}`}
                className="flex flex-col overflow-hidden rounded-xl border border-[var(--ff-border)]/60 bg-[var(--ff-surface)]"
              >
                <div className="relative aspect-[4/5] bg-[#0b0b0f]">
                  {capture.dataUrl ? (
                    <button
                      className="group block h-full w-full"
                      onClick={() => setZoom(capture.dataUrl)}
                      title={`Open the ${capture.label} capture`}
                      type="button"
                    >
                      <img
                        alt={`${capture.label} preview at ${capture.width}×${capture.height}`}
                        className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
                        src={capture.dataUrl}
                      />
                      <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                        <Maximize2 size={13} />
                      </span>
                    </button>
                  ) : (
                    <div className="grid h-full place-items-center px-4 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--ff-text-dim)]">
                      No capture
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 border-t border-[var(--ff-border)]/50 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11.5px] font-semibold text-[var(--ff-text)]">{capture.label}</span>
                    <span className="font-mono text-[9px] tabular-nums text-[var(--ff-text-dim)]">
                      {capture.width}×{capture.height}
                    </span>
                  </div>
                  {capture.issues.length > 0 ? (
                    <ul className="space-y-1">
                      {capture.issues.map((issue) => (
                        <li className="flex items-start gap-1.5 text-[10.5px] leading-snug text-amber-500" key={issue}>
                          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                          <span>{issue}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="flex items-center gap-1.5 text-[10.5px] text-emerald-500">
                      <CheckCircle2 size={11} />
                      No pixel-level issues
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {result && (
          <div className="rounded-xl border border-[var(--ff-border)]/60 bg-[var(--ff-surface)] px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--ff-text-dim)]">
                Element inspection · accessibility tree
              </p>
              <span className="font-mono text-[9px] tabular-nums text-[var(--ff-text-dim)]">
                {elements.length ? `${elements.length} nodes` : 'none exposed'}
              </span>
            </div>
            {elements.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {elements.map((node, index) => (
                  <span
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--ff-border)]/60 bg-[var(--ff-bg)] px-2 py-1 text-[10px] text-[var(--ff-text-muted)]"
                    key={`${node.role}-${node.label}-${index}`}
                    title={`${node.role} at ${node.x},${node.y} · ${node.width}×${node.height}`}
                  >
                    <span className="font-mono text-[8.5px] uppercase tracking-[0.08em] text-[var(--ff-text-dim)]">{node.role}</span>
                    <span className="truncate">{node.label}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--ff-text-muted)]">
                The app did not expose accessibility nodes. Add Semantics labels to key controls so the
                inspector and screen readers can see them.
              </p>
            )}
          </div>
        )}

        {result && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ff-border)]/50 pt-4">
            <p className="max-w-md text-[11px] leading-relaxed text-[var(--ff-text-muted)]">
              “Fix this” sends the findings, device sizes, and visible elements into the builder as context.
              The screenshots stay on this machine.
            </p>
            <Button icon={<Wrench size={13} />} onClick={sendToBuilder}>
              Fix this
            </Button>
          </div>
        )}
      </div>

      {zoom && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4" onClick={() => setZoom(null)}>
          <button
            aria-label="Close full-size capture"
            className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={() => setZoom(null)}
            type="button"
          >
            <X size={18} />
          </button>
          <img alt="Full-size preview capture" className="max-h-full max-w-full rounded-lg shadow-2xl" src={zoom} />
        </div>
      )}
    </Modal>
  );
}
