import { Link } from 'react-router-dom';
import { Sparkles, Twitter, Github, Linkedin } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-[var(--ff-border)] py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[var(--ff-primary)] flex items-center justify-center">
                <Sparkles size={18} className="text-white" />
              </div>
              <span className="text-lg font-bold text-white">FlutterForge</span>
            </Link>
            <p className="text-sm text-[var(--ff-text-muted)] max-w-xs">
              Build Flutter Apps With AI. Describe it. Generate it. Run it. Refine it. Ship it.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Product</h4>
            <ul className="space-y-2">
              <li><a href="#features" className="text-sm text-[var(--ff-text-muted)] hover:text-white transition-colors">Features</a></li>
              <li><a href="#templates" className="text-sm text-[var(--ff-text-muted)] hover:text-white transition-colors">Templates</a></li>
              <li><a href="#pricing" className="text-sm text-[var(--ff-text-muted)] hover:text-white transition-colors">Pricing</a></li>
              <li><a href="#faq" className="text-sm text-[var(--ff-text-muted)] hover:text-white transition-colors">FAQ</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Resources</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-sm text-[var(--ff-text-muted)] hover:text-white transition-colors">Documentation</a></li>
              <li><a href="#" className="text-sm text-[var(--ff-text-muted)] hover:text-white transition-colors">API Reference</a></li>
              <li><a href="#" className="text-sm text-[var(--ff-text-muted)] hover:text-white transition-colors">Tutorials</a></li>
              <li><a href="#" className="text-sm text-[var(--ff-text-muted)] hover:text-white transition-colors">Blog</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Company</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-sm text-[var(--ff-text-muted)] hover:text-white transition-colors">About</a></li>
              <li><a href="#" className="text-sm text-[var(--ff-text-muted)] hover:text-white transition-colors">Privacy</a></li>
              <li><a href="#" className="text-sm text-[var(--ff-text-muted)] hover:text-white transition-colors">Terms</a></li>
              <li><a href="#" className="text-sm text-[var(--ff-text-muted)] hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-[var(--ff-border)]">
          <p className="text-sm text-[var(--ff-text-dim)]">© 2026 FlutterForge. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-[var(--ff-text-dim)] hover:text-white transition-colors"><Twitter size={18} /></a>
            <a href="#" className="text-[var(--ff-text-dim)] hover:text-white transition-colors"><Github size={18} /></a>
            <a href="#" className="text-[var(--ff-text-dim)] hover:text-white transition-colors"><Linkedin size={18} /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}
