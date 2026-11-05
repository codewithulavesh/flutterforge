import type { PricingPlan } from './pricing';

/**
 * Draft landing-page pricing. Numbers are illustrative until checkout ships —
 * edit prices, features and copy here; the block renders whatever it receives.
 */
export const LANDING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    yearlyPrice: 0,
    period: 'forever',
    features: [
      'Unlimited local projects',
      'Prompt to Flutter source',
      'Live web preview',
      'Automatic compile repair',
      'Editable project export',
    ],
    description: 'For students and solo builders shipping a first app.',
    buttonText: 'Start free',
    href: '/signup?plan=free',
    isPopular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 19,
    yearlyPrice: 15,
    period: 'per month',
    features: [
      'Everything in Free',
      'Priority AI model access',
      'Longer build sessions',
      'Desktop runner export',
      'Email support',
    ],
    description: 'For solo developers who ship every week.',
    buttonText: 'Choose Pro',
    href: '/signup?plan=pro',
    isPopular: true,
  },
  {
    id: 'team',
    name: 'Team',
    price: 49,
    yearlyPrice: 39,
    period: 'per month',
    features: [
      'Everything in Pro',
      'Shared project workspaces',
      'Roles and review links',
      'Central billing and seats',
      'Onboarding for your team',
    ],
    description: 'For small teams building client apps together.',
    buttonText: 'Start with Team',
    href: '/signup?plan=team',
    isPopular: false,
  },
];
