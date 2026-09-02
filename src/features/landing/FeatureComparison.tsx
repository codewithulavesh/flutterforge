import { Check, Minus, Sparkles, Code2, Eye, GitBranch, Package, Download, Rocket } from 'lucide-react';

const COMPARISON = [
  { feature: 'AI Code Generation', flutterforge: true, bolt: true, flutterflow: false, cursor: true },
  { feature: 'Flutter-Specific', flutterforge: true, bolt: false, flutterflow: true, cursor: false },
  { feature: 'Real Flutter Build', flutterforge: true, bolt: false, flutterflow: true, cursor: false },
  { feature: 'Live Preview', flutterforge: true, bolt: true, flutterflow: true, cursor: false },
  { feature: 'Auto Error Fixing', flutterforge: true, bolt: true, flutterflow: false, cursor: true },
  { feature: 'Dependency Management', flutterforge: true, bolt: true, flutterflow: true, cursor: false },
  { feature: 'Visual Theme Editor', flutterforge: true, bolt: false, flutterflow: true, cursor: false },
  { feature: 'Version History', flutterforge: true, bolt: false, flutterflow: true, cursor: true },
  { feature: 'Export ZIP', flutterforge: true, bolt: true, flutterflow: true, cursor: true },
  { feature: 'Web Deployment', flutterforge: true, bolt: true, flutterflow: true, cursor: false },
  { feature: 'Conversational AI', flutterforge: true, bolt: true, flutterflow: false, cursor: true },
  { feature: 'No Setup Required', flutterforge: true, bolt: true, flutterflow: true, cursor: false },
];

const TOOLS = [
  { icon: Sparkles, label: 'AI Builder' },
  { icon: Code2, label: 'Code Editor' },
  { icon: Eye, label: 'Live Preview' },
  { icon: GitBranch, label: 'Git' },
  { icon: Package, label: 'Packages' },
  { icon: Download, label: 'Export' },
  { icon: Rocket, label: 'Deploy' },
];

export function FeatureComparison() {
  return (
    <section className="py-12 sm:py-12 sm:py-24 bg-[var(--ff-surface)]/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-8 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 sm:mb-4">How FlutterForge compares</h2>
          <p className="text-base sm:text-base sm:text-lg text-[var(--ff-text-muted)] px-2">
            The best of Lovable, VS Code, FlutterFlow, and AI coding agents — combined.
          </p>
        </div>

        <div className="ff-card overflow-x-auto overflow-hidden -mx-4 sm:mx-0">
          <div className="min-w-[600px] sm:min-w-0">
          <div className="grid grid-cols-5 gap-px bg-[var(--ff-border)]">
            <div className="bg-[var(--ff-surface)] p-2 sm:p-4">
              <span className="text-xs sm:text-sm font-medium text-[var(--ff-text-muted)]">Feature</span>
            </div>
            <div className="bg-[var(--ff-primary)]/10 p-2 sm:p-4 text-center">
              <span className="text-xs sm:text-sm font-bold text-[var(--ff-primary)]">FlutterForge</span>
            </div>
            <div className="bg-[var(--ff-surface)] p-2 sm:p-4 text-center">
              <span className="text-xs sm:text-sm font-medium text-[var(--ff-text-muted)]">Bolt</span>
            </div>
            <div className="bg-[var(--ff-surface)] p-2 sm:p-4 text-center">
              <span className="text-xs sm:text-sm font-medium text-[var(--ff-text-muted)]">FlutterFlow</span>
            </div>
            <div className="bg-[var(--ff-surface)] p-2 sm:p-4 text-center">
              <span className="text-xs sm:text-sm font-medium text-[var(--ff-text-muted)]">Cursor</span>
            </div>
          </div>

          {COMPARISON.map((row, i) => (
            <div key={row.feature} className={`grid grid-cols-5 gap-px bg-[var(--ff-border)] ${i % 2 === 0 ? 'bg-opacity-50' : ''}`}>
              <div className="bg-[var(--ff-surface)] p-2 sm:p-3 sm:px-4">
                <span className="text-[10px] sm:text-xs text-[var(--ff-text-muted)] leading-tight">{row.feature}</span>
              </div>
              <div className="bg-[var(--ff-primary)]/5 p-2 sm:p-3 flex items-center justify-center">
                {row.flutterforge ? (
                  <Check size={14} className="text-[var(--ff-primary)] sm:w-4 sm:h-4" />
                ) : (
                  <Minus size={14} className="text-[var(--ff-text-dim)] sm:w-4 sm:h-4" />
                )}
              </div>
              <div className="bg-[var(--ff-surface)] p-2 sm:p-3 flex items-center justify-center">
                {row.bolt ? (
                  <Check size={14} className="text-emerald-400 sm:w-4 sm:h-4" />
                ) : (
                  <Minus size={14} className="text-[var(--ff-text-dim)] sm:w-4 sm:h-4" />
                )}
              </div>
              <div className="bg-[var(--ff-surface)] p-2 sm:p-3 flex items-center justify-center">
                {row.flutterflow ? (
                  <Check size={14} className="text-emerald-400 sm:w-4 sm:h-4" />
                ) : (
                  <Minus size={14} className="text-[var(--ff-text-dim)] sm:w-4 sm:h-4" />
                )}
              </div>
              <div className="bg-[var(--ff-surface)] p-2 sm:p-3 flex items-center justify-center">
                {row.cursor ? (
                  <Check size={14} className="text-emerald-400 sm:w-4 sm:h-4" />
                ) : (
                  <Minus size={14} className="text-[var(--ff-text-dim)] sm:w-4 sm:h-4" />
                )}
              </div>
            </div>
          ))}
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-6">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <div key={tool.label} className="flex items-center gap-2 text-sm text-[var(--ff-text-dim)]">
                <Icon size={16} />
                {tool.label}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
