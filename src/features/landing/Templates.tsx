import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { TEMPLATES } from '@/utils/constants';

export function Templates() {
  return (
    <section id="templates" className="py-12 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-8 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 sm:mb-4">Start from a template</h2>
          <p className="text-base sm:text-base sm:text-lg text-[var(--ff-text-muted)] px-2">
            Choose from pre-built templates or start from scratch. Every template is a real Flutter project.
          </p>
        </div>

        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {TEMPLATES.map((template) => {
            const Icon = (Icons as unknown as Record<string, LucideIcon>)[template.icon] ?? Icons.FileCode2;
            return (
              <Link to="/signup" key={template.id} className="ff-card p-5 hover:border-[var(--ff-border-hover)] transition-all group">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                  style={{ backgroundColor: `${template.color}15` }}
                >
                  <Icon size={24} className="" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">{template.name}</h3>
                <p className="text-xs text-[var(--ff-text-muted)] mb-3 leading-relaxed">{template.description}</p>
                <div className="flex flex-wrap gap-1">
                  {template.features.slice(0, 3).map((f) => (
                    <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--ff-surface-2)] text-[var(--ff-text-dim)]">
                      {f}
                    </span>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
