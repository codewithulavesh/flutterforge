import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function CTA() {
  return (
    <section className="py-12 sm:py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative ff-card p-6 sm:p-12 text-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-purple-600/10" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 sm:w-96 sm:h-96 bg-blue-500/10 rounded-full blur-3xl" />

          <div className="relative z-10">
            <h2 className="text-2xl sm:text-3xl lg:text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 sm:mb-4">
              Ready to build your Flutter app?
            </h2>
            <p className="text-base sm:text-base sm:text-lg text-[var(--ff-text-muted)] mb-6 sm:mb-8 max-w-xl mx-auto px-2">
              Join thousands of developers building production Flutter apps with AI. No setup, no configuration — just describe and build.
            </p>
            <Link to="/signup">
              <Button size="lg" className="group">
                Start Building Free
                <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
            <p className="mt-4 text-sm text-[var(--ff-text-dim)]">
              No credit card required. Free plan includes 3 projects.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
