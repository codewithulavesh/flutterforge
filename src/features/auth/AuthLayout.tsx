import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '@/components/BrandLogo';
import { ThemeToggle } from '@/components/ThemeToggle';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-[var(--ff-bg)] ff-brand ff-studio">
      {/* Left side - branding */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 relative overflow-hidden ff-dark-block">
        <div className="absolute inset-0 bg-gradient-to-br from-[#02AFB9]/15 via-transparent to-[#F07067]/10" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#02AFB9]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#FED8B7]/20 rounded-full blur-3xl" />

        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo size={36} />
            <span className="text-xl font-bold text-[var(--ff-text)]">FlutterForge</span>
          </Link>
        </div>

        <div className="relative z-10 max-w-md">
          <h2 className="text-3xl font-bold text-[var(--ff-text)] mb-4 leading-tight">
            Build Flutter Apps With AI
          </h2>
          <p className="text-[var(--ff-text-muted)] text-lg leading-relaxed">
            Describe your application. FlutterForge generates the Flutter project, runs it, fixes it, and lets you ship it.
          </p>
          <div className="mt-8 space-y-3">
            {[
              { title: 'Local-first engine', desc: 'The Flutter SDK runs on your machine.' },
              { title: 'Real, runnable code', desc: 'Every project is complete and exportable.' },
              { title: 'Self-healing builds', desc: 'Compile errors feed back into the agent.' },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ff-primary)]" />
                <p className="text-sm text-[var(--ff-text-muted)]">
                  <span className="font-semibold text-[var(--ff-text)]">{item.title}.</span>{' '}
                  {item.desc}
                </p>
              </div>
            ))}
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
              <BrandLogo size={36} />
              <span className="text-xl font-bold text-[var(--ff-text)]">FlutterForge</span>
            </Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
