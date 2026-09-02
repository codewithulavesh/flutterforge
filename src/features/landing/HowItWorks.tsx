import { MessageSquare, Brain, FileCode2, Bug, Hammer, Rocket } from 'lucide-react';

const STEPS = [
  {
    icon: MessageSquare,
    title: 'Describe Your App',
    description: 'Tell FlutterForge what you want to build in plain English. No technical knowledge needed.',
    step: '01',
  },
  {
    icon: Brain,
    title: 'AI Plans Architecture',
    description: 'The AI agent analyzes requirements, plans screens, architecture, and file structure.',
    step: '02',
  },
  {
    icon: FileCode2,
    title: 'Code Generation',
    description: 'Real Dart files are generated — models, services, screens, widgets, routing, and theme.',
    step: '03',
  },
  {
    icon: Bug,
    title: 'Analyze & Fix',
    description: 'Flutter analyzer runs automatically. Errors are detected and fixed by the AI fix agent.',
    step: '04',
  },
  {
    icon: Hammer,
    title: 'Build & Preview',
    description: 'Flutter Web build compiles your app. See it live in the preview with device presets.',
    step: '05',
  },
  {
    icon: Rocket,
    title: 'Export & Deploy',
    description: 'Export a complete Flutter project ZIP or deploy your web app with a single click.',
    step: '06',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-12 sm:py-24 bg-[var(--ff-surface)]/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4">From idea to app in minutes</h2>
          <p className="text-base sm:text-lg text-[var(--ff-text-muted)]">
            Six steps. No setup. No Flutter installation. Just describe and build.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.step} className="relative ff-card p-4 sm:p-6 group hover:border-[var(--ff-border-hover)] transition-all">
                <div className="absolute top-4 right-4 text-5xl font-bold text-[var(--ff-border)] group-hover:text-[var(--ff-primary)]/20 transition-colors">
                  {step.step}
                </div>
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-[var(--ff-primary)]/10 flex items-center justify-center mb-4">
                    <Icon size={24} className="text-[var(--ff-primary)]" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-[var(--ff-text-muted)] leading-relaxed">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
