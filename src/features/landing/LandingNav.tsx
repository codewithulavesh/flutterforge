import { Link } from 'react-router-dom';
import { Sparkles, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ThemeToggle';

export function LandingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-[var(--ff-bg)]/80 backdrop-blur-xl border-b border-[var(--ff-border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--ff-primary)] flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <span className="text-lg font-bold text-white">FlutterForge</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-[var(--ff-text-muted)] hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-[var(--ff-text-muted)] hover:text-white transition-colors">How it Works</a>
            <a href="#templates" className="text-sm text-[var(--ff-text-muted)] hover:text-white transition-colors">Templates</a>
            <a href="#pricing" className="text-sm text-[var(--ff-text-muted)] hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="text-sm text-[var(--ff-text-muted)] hover:text-white transition-colors">FAQ</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            <Link to="/login">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link to="/signup">
              <Button size="sm">Start Building</Button>
            </Link>
          </div>

          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <button className="text-[var(--ff-text)]" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden pb-4 flex flex-col gap-3 ff-fade-in">
            <a href="#features" onClick={() => setMobileOpen(false)} className="text-sm text-[var(--ff-text-muted)] hover:text-white">Features</a>
            <a href="#how-it-works" onClick={() => setMobileOpen(false)} className="text-sm text-[var(--ff-text-muted)] hover:text-white">How it Works</a>
            <a href="#templates" onClick={() => setMobileOpen(false)} className="text-sm text-[var(--ff-text-muted)] hover:text-white">Templates</a>
            <a href="#pricing" onClick={() => setMobileOpen(false)} className="text-sm text-[var(--ff-text-muted)] hover:text-white">Pricing</a>
            <a href="#faq" onClick={() => setMobileOpen(false)} className="text-sm text-[var(--ff-text-muted)] hover:text-white">FAQ</a>
            <div className="flex gap-2 pt-2">
              <Link to="/login" className="flex-1"><Button variant="ghost" size="sm" className="w-full">Sign In</Button></Link>
              <Link to="/signup" className="flex-1"><Button size="sm" className="w-full">Start Building</Button></Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
