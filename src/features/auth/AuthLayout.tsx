import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-[var(--ff-bg)]">
      {/* Left side - branding */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-purple-600/10" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />

        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-[var(--ff-primary)] flex items-center justify-center">
              <Sparkles size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold text-white">FlutterForge</span>
          </Link>
        </div>

        <div className="relative z-10 max-w-md">
          <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
            Build Flutter Apps With AI
          </h2>
          <p className="text-[var(--ff-text-muted)] text-lg leading-relaxed">
            Describe your application. FlutterForge generates the Flutter project, runs it, fixes it, and lets you ship it.
          </p>
          <div className="mt-8 flex items-center gap-6">
            <div>
              <div className="text-2xl font-bold text-white">10k+</div>
              <div className="text-sm text-[var(--ff-text-dim)]">Apps Generated</div>
            </div>
            <div className="w-px h-10 bg-[var(--ff-border)]" />
            <div>
              <div className="text-2xl font-bold text-white">50k+</div>
              <div className="text-sm text-[var(--ff-text-dim)]">Developers</div>
            </div>
            <div className="w-px h-10 bg-[var(--ff-border)]" />
            <div>
              <div className="text-2xl font-bold text-white">99.9%</div>
              <div className="text-sm text-[var(--ff-text-dim)]">Uptime</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm text-[var(--ff-text-dim)]">
          © 2026 FlutterForge. All rights reserved.
        </div>
      </div>

      {/* Right side - form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 relative">
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md flex-1 flex flex-col justify-center">
          <div className="lg:hidden mb-8">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-[var(--ff-primary)] flex items-center justify-center">
                <Sparkles size={20} className="text-white" />
              </div>
              <span className="text-xl font-bold text-white">FlutterForge</span>
            </Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
