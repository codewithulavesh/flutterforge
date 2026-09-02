import { Sparkles, FileCode2, Package, Search, Bug, Hammer, Eye, Download } from 'lucide-react';

const FEATURES = [
  {
    icon: Sparkles,
    title: 'AI-Powered Generation',
    description: 'Describe your app in natural language. Our AI agent understands requirements, plans architecture, and generates complete Flutter source code.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  {
    icon: FileCode2,
    title: 'Real Dart Code',
    description: 'Get production-ready Flutter code with proper architecture, null safety, reusable widgets, and state management — not just snippets.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
  },
  {
    icon: Package,
    title: 'Dependency Management',
    description: 'AI automatically manages pubspec.yaml dependencies. Add packages with a simple prompt and let the agent handle installation.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  {
    icon: Search,
    title: 'Flutter Analyzer',
    description: 'Built-in Flutter analyzer integration. Every generated file is checked for errors, warnings, and best practices automatically.',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
  {
    icon: Bug,
    title: 'Auto Error Fixing',
    description: 'When the analyzer finds issues, the AI fix agent reads the errors, modifies the relevant files, and re-analyzes until clean.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
  },
  {
    icon: Hammer,
    title: 'Flutter Web Build',
    description: 'Compile your Flutter app to web with real Flutter SDK builds. No local setup — everything runs in isolated cloud environments.',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
  },
  {
    icon: Eye,
    title: 'Live Preview',
    description: 'See your Flutter app running in real-time with device presets for iPhone, Android, tablet, and desktop. Switch orientations instantly.',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
  },
  {
    icon: Download,
    title: 'Export & Deploy',
    description: 'Export a complete Flutter project as ZIP that runs independently. Deploy Flutter Web apps with a single click and get a live URL.',
    color: 'text-teal-400',
    bg: 'bg-teal-500/10',
  },
];

export function Features() {
  return (
    <section id="features" className="py-12 sm:py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-8 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 sm:mb-4">Everything you need to build Flutter apps</h2>
          <p className="text-base sm:text-base sm:text-lg text-[var(--ff-text-muted)] px-2">
            FlutterForge is a complete development environment, not just a code generator. From idea to deployment, all in one place.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="ff-card p-6 hover:border-[var(--ff-border-hover)] transition-all group">
                <div className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon size={24} className={feature.color} />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-[var(--ff-text-muted)] leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
