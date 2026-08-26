import { LandingNav } from '@/features/landing/LandingNav';
import { Hero } from '@/features/landing/Hero';
import { AIDemo } from '@/features/landing/AIDemo';
import { Features } from '@/features/landing/Features';
import { HowItWorks } from '@/features/landing/HowItWorks';
import { Templates } from '@/features/landing/Templates';
import { LivePreviewDemo } from '@/features/landing/LivePreviewDemo';
import { CodeGenDemo } from '@/features/landing/CodeGenDemo';
import { FeatureComparison } from '@/features/landing/FeatureComparison';
import { Pricing } from '@/features/landing/Pricing';
import { FAQ } from '@/features/landing/FAQ';
import { CTA } from '@/features/landing/CTA';
import { Footer } from '@/features/landing/Footer';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--ff-bg)]">
      <LandingNav />
      <Hero />
      <AIDemo />
      <Features />
      <HowItWorks />
      <Templates />
      <LivePreviewDemo />
      <CodeGenDemo />
      <FeatureComparison />
      <Pricing />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
}
