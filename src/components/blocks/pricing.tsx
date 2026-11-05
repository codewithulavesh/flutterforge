import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, Star } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/utils/cn';

export interface PricingPlan {
  id: string;
  name: string;
  price: number;
  yearlyPrice: number;
  period: string;
  features: string[];
  description: string;
  buttonText: string;
  href: string;
  isPopular: boolean;
}

interface PricingProps {
  plans: PricingPlan[];
  eyebrow?: string;
  title?: string;
  description?: string;
  note?: string;
  className?: string;
}

const EASE = [0.16, 1, 0.3, 1] as const;

export function Pricing({
  plans,
  eyebrow = '07 — Plans',
  title = 'Pay for the studio, not the tokens.',
  description = 'Every plan exports real Flutter source. Paid tiers add more agent room, faster models, and shared workspaces.',
  note = 'Draft pricing — checkout is not live yet. Every plan is free while FlutterForge is in preview.',
  className,
}: PricingProps) {
  const [isMonthly, setIsMonthly] = useState(true);
  const reduceMotion = useReducedMotion() ?? false;
  const sectionRef = useRef<HTMLElement>(null);
  const switchRef = useRef<HTMLButtonElement>(null);

  useEffect(
    () => () => {
      confetti.reset();
    },
    [],
  );

  function handleToggle(annual: boolean) {
    setIsMonthly(!annual);
    if (!annual || reduceMotion || !switchRef.current) return;

    const rect = switchRef.current.getBoundingClientRect();
    const style = getComputedStyle(sectionRef.current ?? document.documentElement);
    const brand = ['--fb-lime', '--fb-magenta', '--fb-cyan', '--fb-orange'].map(
      (token, index) => style.getPropertyValue(token).trim() || ['#adff02', '#fa00ff', '#02bbff', '#ff5a36'][index],
    );

    confetti({
      particleCount: 46,
      spread: 64,
      startVelocity: 28,
      gravity: 1.1,
      decay: 0.94,
      scalar: 0.9,
      ticks: 180,
      shapes: ['circle'],
      colors: brand,
      origin: {
        x: (rect.left + rect.width / 2) / window.innerWidth,
        y: (rect.top + rect.height / 2) / window.innerHeight,
      },
    });
  }

  return (
    <section id="pricing" ref={sectionRef} className={cn('scroll-mt-28 px-4 py-20 sm:px-6', className)}>
      <div className="mx-auto max-w-[1440px]">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-[var(--fb-line)] bg-[var(--fb-card)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--fb-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--fb-magenta)]" />
              {eyebrow}
            </p>
            <h2 className="ffb-display mt-4 text-[clamp(40px,5.6vw,64px)]">{title}</h2>
            <p className="mt-4 max-w-md text-[13px] leading-relaxed text-[var(--fb-muted)]">{description}</p>
          </div>

          <div
            role="group"
            aria-label="Billing period"
            className="inline-flex w-fit shrink-0 items-center gap-2.5 rounded-full border border-[var(--fb-line)] bg-[var(--fb-card)] p-1.5 pl-4 pr-3"
          >
            <span
              aria-hidden="true"
              className={cn(
                'text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors',
                isMonthly ? 'text-[var(--fb-ink)]' : 'text-[var(--fb-dim)]',
              )}
            >
              Monthly
            </span>
            <Label htmlFor="billing-cycle" className="cursor-pointer">
              <Switch
                id="billing-cycle"
                ref={switchRef}
                checked={!isMonthly}
                onCheckedChange={handleToggle}
                aria-label="Annual billing"
              />
            </Label>
            <span
              aria-hidden="true"
              className={cn(
                'text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors',
                !isMonthly ? 'text-[var(--fb-ink)]' : 'text-[var(--fb-dim)]',
              )}
            >
              Annual
            </span>
            <span className="rounded-full bg-[var(--fb-soft)] px-2 py-1 font-mono text-[9px] font-semibold tracking-[0.08em] text-[var(--fb-muted)]">
              Save 20%
            </span>
            <span className="sr-only" aria-live="polite">
              {isMonthly ? 'Showing monthly prices.' : 'Showing annual prices, 20 percent off.'}
            </span>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {plans.map((plan, index) => {
            const value = isMonthly ? plan.price : plan.yearlyPrice;
            const billingNote =
              plan.price === 0 ? 'no card required' : isMonthly ? 'billed monthly' : 'billed annually';

            return (
              <motion.article
                key={plan.id}
                initial={reduceMotion ? false : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.55, delay: index * 0.07, ease: EASE }}
                className={cn(
                  'flex flex-col rounded-[24px] p-6 sm:p-7',
                  plan.isPopular
                    ? 'bg-[var(--fb-ink)] text-[var(--fb-bg)]'
                    : 'bg-[var(--fb-card)] text-[var(--fb-ink)] ring-1 ring-[var(--fb-line)] transition-shadow hover:ring-[var(--fb-ink)]',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] opacity-60">
                      {plan.name}
                    </p>
                    <p className="mt-3 flex items-baseline gap-1.5">
                      <span className="ffb-display text-[clamp(44px,4.4vw,58px)] leading-none tabular-nums">
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span
                            key={value}
                            initial={reduceMotion ? false : { y: 12, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={reduceMotion ? { opacity: 1 } : { y: -12, opacity: 0 }}
                            transition={{ duration: reduceMotion ? 0 : 0.22, ease: EASE }}
                            className="inline-block"
                          >
                            ${value}
                          </motion.span>
                        </AnimatePresence>
                      </span>
                      <span className="text-[11px] font-medium opacity-60">/ {plan.period}</span>
                    </p>
                    <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] opacity-50">{billingNote}</p>
                  </div>

                  {plan.isPopular ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--fb-lime)] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#050505]">
                      <Star size={10} className="fill-current" />
                      Popular
                    </span>
                  ) : null}
                </div>

                <p className="mt-4 min-h-[36px] text-[12px] leading-relaxed opacity-60">{plan.description}</p>

                <div className="my-5 h-px bg-current opacity-15" />

                <ul className="flex flex-1 flex-col gap-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-[12px] leading-relaxed">
                      <span
                        className={cn(
                          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                          plan.isPopular
                            ? 'bg-[var(--fb-lime)] text-[#050505]'
                            : 'bg-[var(--fb-soft)] text-[var(--fb-ink)]',
                        )}
                      >
                        <Check size={10} strokeWidth={3} />
                      </span>
                      <span className="opacity-80">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to={plan.href}
                  className={cn(
                    'mt-7 inline-flex h-11 w-full items-center justify-center rounded-full text-[12.5px] font-semibold transition-transform hover:-translate-y-px',
                    plan.isPopular
                      ? 'bg-[var(--fb-lime)] text-[#050505]'
                      : 'border border-[var(--fb-line)] text-[var(--fb-ink)] hover:border-[var(--fb-ink)] hover:bg-[var(--fb-soft)]',
                  )}
                >
                  {plan.buttonText}
                </Link>
              </motion.article>
            );
          })}
        </div>

        {note ? (
          <p className="mt-6 flex items-start gap-2 font-mono text-[10px] leading-relaxed text-[var(--fb-dim)]">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current" />
            {note}
          </p>
        ) : null}
      </div>
    </section>
  );
}
