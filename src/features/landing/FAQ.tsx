import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FAQS } from '@/utils/constants';
import { cn } from '@/utils/cn';

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-12 sm:py-12 sm:py-24 bg-[var(--ff-surface)]/30">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-8 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4">Frequently asked questions</h2>
          <p className="text-base sm:text-base sm:text-lg text-[var(--ff-text-muted)]">
            Everything you need to know about FlutterForge.
          </p>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <div key={i} className="ff-card overflow-hidden">
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex items-center justify-between w-full p-4 sm:p-5 text-left"
              >
                <span className="text-sm font-medium text-white">{faq.question}</span>
                <ChevronDown
                  size={18}
                  className={cn(
                    'text-[var(--ff-text-dim)] transition-transform shrink-0 ml-4',
                    openIndex === i && 'rotate-180'
                  )}
                />
              </button>
              {openIndex === i && (
                <div className="px-5 pb-5 text-sm text-[var(--ff-text-muted)] leading-relaxed ff-fade-in">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
