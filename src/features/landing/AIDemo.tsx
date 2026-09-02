import { Sparkles, Check, Loader2 } from 'lucide-react';

const DEMO_STEPS = [
  { label: 'Understanding requirements', status: 'completed' },
  { label: 'Planning application architecture', status: 'completed' },
  { label: 'Creating project structure', status: 'completed' },
  { label: 'Generating screens (8 screens)', status: 'completed' },
  { label: 'Generating reusable components', status: 'completed' },
  { label: 'Installing dependencies', status: 'completed' },
  { label: 'Running Flutter analyzer', status: 'completed' },
  { label: 'Fixing 3 analyzer issues', status: 'completed' },
  { label: 'Building Flutter Web', status: 'running' },
  { label: 'Starting preview', status: 'pending' },
];

const DEMO_FILES = [
  { path: 'lib/main.dart', action: 'A' },
  { path: 'lib/app.dart', action: 'A' },
  { path: 'lib/core/router/app_router.dart', action: 'A' },
  { path: 'lib/core/theme/app_theme.dart', action: 'A' },
  { path: 'lib/screens/home/home_screen.dart', action: 'A' },
  { path: 'lib/screens/login/login_screen.dart', action: 'A' },
  { path: 'lib/screens/cart/cart_screen.dart', action: 'A' },
  { path: 'lib/screens/profile/profile_screen.dart', action: 'A' },
  { path: 'lib/widgets/app_card.dart', action: 'A' },
  { path: 'pubspec.yaml', action: 'A' },
];

export function AIDemo() {
  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4">Watch AI build a Flutter app</h2>
          <p className="text-base sm:text-lg text-[var(--ff-text-muted)]">
            From a single prompt to a complete, compiled Flutter application.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {/* Chat + Activity */}
          <div className="ff-card p-5 space-y-4">
            <div className="space-y-3">
              <div className="ff-card p-3 text-sm text-[var(--ff-text-muted)]">
                Create a modern e-commerce Flutter app with splash, login, home, search, cart, checkout, orders, profile, and bottom navigation.
              </div>
              <div className="bg-[var(--ff-primary)]/10 border border-[var(--ff-primary)]/20 rounded-lg p-3 text-sm text-[var(--ff-text)]">
                I'll generate a complete e-commerce app with 12 screens, GoRouter navigation, Material 3 theme, and reusable widgets. Let me plan the architecture and generate the files...
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-[var(--ff-border)]">
              <div className="flex items-center gap-2 text-xs text-[var(--ff-text-dim)] mb-2">
                <Sparkles size={12} className="text-[var(--ff-primary)]" />
                AI Agent Activity
              </div>
              {DEMO_STEPS.map((step) => (
                <div key={step.label} className="flex items-center gap-2 text-xs">
                  {step.status === 'completed' && (
                    <span className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <Check size={10} className="text-emerald-400" />
                    </span>
                  )}
                  {step.status === 'running' && (
                    <Loader2 size={14} className="text-[var(--ff-primary)] ff-spin" />
                  )}
                  {step.status === 'pending' && (
                    <span className="w-4 h-4 rounded-full border border-[var(--ff-border)]" />
                  )}
                  <span className={step.status === 'pending' ? 'text-[var(--ff-text-dim)]' : step.status === 'completed' ? 'text-[var(--ff-text-muted)]' : 'text-[var(--ff-text)]'}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* File changes */}
          <div className="ff-card p-5">
            <div className="flex items-center gap-2 text-xs text-[var(--ff-text-dim)] mb-3">
              <span className="font-medium text-[var(--ff-text-muted)]">Files Changed</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">10 added</span>
            </div>
            <div className="space-y-1 ff-scrollbar max-h-[420px] overflow-y-auto">
              {DEMO_FILES.map((file) => (
                <div key={file.path} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--ff-surface-2)] text-xs">
                  <span className="w-5 text-center font-mono text-emerald-400">{file.action}</span>
                  <span className="text-[var(--ff-text-muted)] font-mono">{file.path}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
