import { Link } from 'react-router-dom';
import { Check, Sparkles } from 'lucide-react';
import { PRICING_PLANS } from '@/utils/constants';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

export function Pricing() {
  return (
    <section id="pricing" className="py-12 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-8 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4">Simple, transparent pricing</h2>
          <p className="text-base sm:text-base sm:text-lg text-[var(--ff-text-muted)]">
            Start free. Upgrade when you need more power. Cancel anytime.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PRICING_PLANS.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                'ff-card p-6 sm:p-8 relative',
                plan.highlight && 'border-[var(--ff-primary)] ff-glow'
              )}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[var(--ff-primary)] text-white text-xs font-medium flex items-center gap-1">
                  <Sparkles size={12} />
                  Most Popular
                </div>
              )}

              <h3 className="text-lg font-semibold text-white mb-1">{plan.name}</h3>
              <p className="text-sm text-[var(--ff-text-muted)] mb-4">{plan.description}</p>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-2xl sm:text-3xl lg:text-2xl sm:text-3xl lg:text-4xl font-bold text-white">{plan.price}</span>
                <span className="text-sm text-[var(--ff-text-dim)]">{plan.period}</span>
              </div>

              <Link to="/signup" className="block mb-6">
                <Button variant={plan.highlight ? 'primary' : 'outline'} className="w-full">
                  {plan.cta}
                </Button>
              </Link>

              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-[var(--ff-text-muted)]">
                    <Check size={16} className="text-[var(--ff-primary)] mt-0.5 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
