import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight, Play } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function Hero() {
  return (
    <section className="relative pt-20 sm:pt-32 pb-12 sm:pb-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-blue-600/5 via-transparent to-transparent" />
      <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] sm:w-[600px] sm:h-[600px] bg-blue-500/5 rounded-full blur-3xl" />
      <div className="absolute top-1/3 right-1/4 w-[250px] h-[250px] sm:w-[500px] sm:h-[500px] bg-cyan-500/5 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--ff-surface)] border border-[var(--ff-border)] mb-8 ff-fade-in">
            <Sparkles size={14} className="text-[var(--ff-primary)]" />
            <span className="text-xs text-[var(--ff-text-muted)]">AI-Powered Flutter Development</span>
            <span className="text-xs text-[var(--ff-primary)] font-medium">New</span>
          </div>

          <h1 className="text-3xl xs:text-4xl sm:text-5xl lg:text-7xl font-bold text-white mb-4 sm:mb-6 leading-[1.1] tracking-tight px-2">
            Build Flutter Apps
            <br />
            <span className="ff-gradient-text">With AI</span>
          </h1>

          <p className="text-base sm:text-lg lg:text-xl text-[var(--ff-text-muted)] mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed px-4">
            Describe your application. FlutterForge generates the Flutter project, runs it, fixes it, and lets you ship it.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup">
              <Button size="lg" className="group">
                Start Building
                <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
            <a href="#templates">
              <Button variant="outline" size="lg">
                <Play size={16} />
                Explore Templates
              </Button>
            </a>
          </div>

          <div className="mt-10 sm:mt-16 flex flex-col xs:flex-row items-center justify-center gap-3 sm:gap-8 flex-wrap px-4">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-[var(--ff-text-dim)]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              No setup required
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-[var(--ff-text-dim)]">
              <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
              Real Flutter code
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-[var(--ff-text-dim)]">
              <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
              Export & deploy
            </div>
          </div>
        </div>

        {/* Workspace mockup - responsive */}
        <div className="mt-12 sm:mt-20 max-w-5xl mx-auto px-2 sm:px-0">
          <div className="ff-card p-1 sm:p-2 ff-glow overflow-hidden">
            <div className="flex items-center gap-1.5 px-2 sm:px-3 py-2 border-b border-[var(--ff-border)]">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-400/60" />
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-amber-400/60" />
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-400/60" />
              <div className="ml-2 sm:ml-3 text-[10px] sm:text-xs text-[var(--ff-text-dim)] truncate">FlutterForge — AI Builder</div>
            </div>
            {/* Desktop grid, mobile stacked */}
            <div className="hidden sm:grid grid-cols-12 gap-0 h-[280px] sm:h-[400px] overflow-hidden rounded-b-lg">
              {/* Sidebar */}
              <div className="col-span-2 bg-[var(--ff-surface)] border-r border-[var(--ff-border)] p-2 space-y-1">
                {['AI Builder', 'Preview', 'Files', 'Code', 'Terminal'].map((item, i) => (
                  <div key={item} className={`px-2 py-1.5 rounded text-xs ${i === 0 ? 'bg-[var(--ff-primary)]/10 text-[var(--ff-primary)]' : 'text-[var(--ff-text-dim)]'}`}>
                    {item}
                  </div>
                ))}
              </div>
              {/* Chat */}
              <div className="col-span-5 p-2 sm:p-3 space-y-2 overflow-hidden">
                <div className="ff-card p-2 text-xs text-[var(--ff-text-muted)]">
                  Create a food delivery app with login, restaurants, cart, and checkout.
                </div>
                <div className="bg-[var(--ff-primary)]/10 border border-[var(--ff-primary)]/20 rounded-lg p-2 text-xs text-[var(--ff-text)]">
                  I'll generate a complete Flutter app with 8 screens, routing, and theme...
                </div>
                <div className="space-y-1 pt-2">
                  {['Understanding requirements', 'Planning architecture', 'Generating screens', 'Installing dependencies'].map((step, i) => (
                    <div key={step} className="flex items-center gap-2 text-xs text-[var(--ff-text-dim)]">
                      <span className="w-3 h-3 rounded-full border border-emerald-400/40 bg-emerald-400/10 flex items-center justify-center shrink-0">
                        {i < 3 && <span className="w-1 h-1 rounded-full bg-emerald-400" />}
                      </span>
                      <span className="truncate">{step}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 text-xs text-[var(--ff-text-muted)]">
                    <span className="w-3 h-3 rounded-full border-2 border-[var(--ff-primary)] border-t-transparent ff-spin shrink-0" />
                    <span className="truncate">Building Flutter Web...</span>
                  </div>
                </div>
              </div>
              {/* Preview */}
              <div className="col-span-5 bg-[var(--ff-surface-2)] flex items-center justify-center p-2">
                <div className="w-[140px] h-[280px] sm:w-[180px] sm:h-[360px] bg-white rounded-2xl shadow-2xl overflow-hidden shrink-0">
                  <div className="h-full bg-gray-50 flex flex-col">
                    <div className="bg-blue-500 text-white p-2 sm:p-3 text-xs font-medium">FoodDelivery</div>
                    <div className="flex-1 p-2 space-y-2 overflow-hidden">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-white rounded-lg shadow-sm p-2">
                          <div className="w-full h-8 sm:h-12 bg-gray-200 rounded mb-1" />
                          <div className="h-2 bg-gray-200 rounded w-3/4 mb-1" />
                          <div className="h-2 bg-gray-200 rounded w-1/2" />
                        </div>
                      ))}
                    </div>
                    <div className="bg-white border-t flex justify-around p-2">
                      {['Home', 'Search', 'Cart', 'Profile'].map((tab, i) => (
                        <div key={tab} className={`text-[8px] ${i === 0 ? 'text-blue-500' : 'text-gray-400'}`}>{tab}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Mobile stacked mockup */}
            <div className="sm:hidden flex flex-col gap-2 p-2 bg-[var(--ff-surface-2)] rounded-b-lg">
              <div className="ff-card p-2 text-xs text-[var(--ff-text-muted)]">Create a food delivery app...</div>
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden mx-auto w-[200px] h-[320px]">
                <div className="bg-blue-500 text-white p-2 text-xs text-center">FoodDelivery</div>
                <div className="p-2 space-y-2">
                  {[1,2].map(i=> <div key={i} className="h-16 bg-gray-100 rounded" />)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
