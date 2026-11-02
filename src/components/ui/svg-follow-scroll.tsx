import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Code2, Cpu, Eye, Files, type LucideIcon } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const BUILD_STAGES: { number: string; title: string; detail: string; icon: LucideIcon }[] = [
  { number: '01', title: 'Shape the idea', detail: 'A brief becomes a clear build plan.', icon: Cpu },
  { number: '02', title: 'Write real Flutter', detail: 'Editable Dart files land in your workspace.', icon: Files },
  { number: '03', title: 'Run and refine', detail: 'Preview the app, inspect output, keep the code.', icon: Eye },
];

/** Scroll-linked product story showing the path from a prompt to a runnable project. */
export function SvgFollowScroll() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const media = gsap.matchMedia(section);
    media.add({
      desktop: '(min-width: 1024px)',
      motionAllowed: '(prefers-reduced-motion: no-preference)',
    }, ({ conditions }) => {
      const path = section.querySelector<SVGPathElement>('.ff-trace-path');
      const stage = section.querySelector<HTMLElement>('.ff-scroll-trace-stage');
      const cards = gsap.utils.toArray<HTMLElement>('.ff-trace-card, .ff-trace-output', section);
      if (!path || !stage || !cards.length) return;

      if (!conditions?.motionAllowed) {
        gsap.set(path, { strokeDasharray: 'none', strokeDashoffset: 0 });
        gsap.set(cards, { clearProps: 'all', autoAlpha: 1 });
        return;
      }

      const pathLength = path.getTotalLength();
      gsap.set(path, { strokeDasharray: pathLength, strokeDashoffset: pathLength });
      gsap.set(cards, {
        autoAlpha: 0,
        y: 22,
        rotateX: -4,
        transformPerspective: 900,
        transformOrigin: '50% 0%',
      });

      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          pin: conditions.desktop ? stage : false,
          pinSpacing: true,
          start: conditions.desktop ? 'top top+=72' : 'top 82%',
          end: conditions.desktop ? '+=1250' : 'bottom 25%',
          scrub: conditions.desktop ? 0.9 : 0.45,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      timeline
        .to(path, { strokeDashoffset: 0, ease: 'none', duration: 1 }, 0)
        .to(cards, {
          autoAlpha: 1,
          y: 0,
          rotateX: 0,
          stagger: 0.19,
          ease: 'none',
          duration: 0.34,
        }, 0.12);

      return () => timeline.scrollTrigger?.kill();
    });

    return () => media.revert();
  }, []);

  return (
    <section ref={sectionRef} aria-labelledby="build-trace-title" className="ff-scroll-trace relative">
      <div className="ff-scroll-trace-stage relative flex min-h-[700px] items-center overflow-hidden border-y border-[var(--ff-border)] bg-[var(--ff-surface)] lg:h-[calc(100svh-72px)] lg:min-h-[620px]">
        <div className="ff-scroll-trace-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="ff-scroll-trace-glow pointer-events-none absolute inset-0" aria-hidden="true" />

        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1200 720" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
          <path d="M-60 610 C 140 610 160 420 320 420 S 450 570 600 480 S 700 260 845 285 S 1020 430 1260 105" stroke="var(--ff-border)" strokeWidth="2" strokeDasharray="5 10" vectorEffect="non-scaling-stroke" />
          <path className="ff-trace-path" d="M-60 610 C 140 610 160 420 320 420 S 450 570 600 480 S 700 260 845 285 S 1020 430 1260 105" stroke="var(--ff-brand-teal)" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>

        <div className="relative mx-auto grid w-full max-w-7xl gap-8 px-5 py-12 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:px-10">
          <div className="max-w-lg">
            <p className="ff-label flex items-center gap-2 text-[9px] text-[var(--ff-brand-teal)]"><span className="h-px w-5 bg-[var(--ff-brand-teal)]" />An observable build system</p>
            <h2 id="build-trace-title" className="ff-display mt-5 text-4xl font-semibold leading-[1.02] text-[var(--ff-text)] sm:text-5xl">
              Follow the code as it takes shape.
            </h2>
            <p className="mt-4 max-w-md text-[13px] leading-relaxed text-[var(--ff-text-muted)] sm:text-sm">
              The AI plan, generated source, and running preview stay connected. Scroll to trace the path from your brief to a project you can keep.
            </p>
            <div className="mt-7 inline-flex items-center gap-2 rounded-md border border-[var(--ff-border)] bg-[var(--ff-surface)]/90 px-3 py-2 font-mono text-[9px] text-[var(--ff-text-dim)] shadow-[var(--ff-soft-shadow)]">
              <Code2 size={12} className="text-[var(--ff-brand-teal)]" /> SOURCE-TO-RUNTIME TRACE
            </div>
          </div>

          <div className="relative mx-auto grid w-full max-w-xl gap-3 sm:gap-4">
            {BUILD_STAGES.map(({ number, title, detail, icon: Icon }) => (
              <article
                key={number}
                className="ff-trace-card relative z-10 flex items-center gap-3 rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface)]/95 p-3.5 shadow-[var(--ff-soft-shadow)] backdrop-blur-md sm:gap-4 sm:p-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--ff-border)] bg-[var(--ff-bg)] text-[var(--ff-brand-teal)]"><Icon size={17} strokeWidth={1.8} /></span>
                <span className="min-w-0 flex-1">
                  <span className="ff-label block text-[8px] text-[var(--ff-text-dim)]">STAGE {number}</span>
                  <span className="mt-1 block text-[12px] font-semibold text-[var(--ff-text)] sm:text-[13px]">{title}</span>
                  <span className="mt-1 block text-[10px] leading-relaxed text-[var(--ff-text-muted)] sm:text-[11px]">{detail}</span>
                </span>
                <span className="hidden font-mono text-[9px] text-[var(--ff-text-dim)] sm:block">{number}<span className="text-[var(--ff-brand-teal)]"> / 03</span></span>
              </article>
            ))}
            <div className="ff-trace-output relative z-10 flex items-center justify-between gap-3 rounded-xl border border-[var(--ff-brand-teal)]/30 bg-[var(--ff-bg)]/95 px-4 py-3 shadow-[var(--ff-soft-shadow)] backdrop-blur-md">
              <span className="min-w-0"><span className="ff-label block text-[8px] text-[var(--ff-brand-teal)]">OUTPUT</span><span className="mt-1 block truncate font-mono text-[10px] text-[var(--ff-text)]">your-app/ · ready to run</span></span>
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#7dd8b5]/15 px-2.5 py-1 text-[9px] font-medium text-[#328565]"><span className="h-1.5 w-1.5 rounded-full bg-[#55b992]" />Project ready</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
