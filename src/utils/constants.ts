import type { DevicePreset, Template } from '@/types';

export const TEMPLATES: Template[] = [
  {
    id: 'blank',
    name: 'Blank Flutter App',
    description: 'Start from scratch with a clean Flutter project',
    icon: 'FileCode2',
    color: '#3B82F6',
    features: ['Material Design', 'Basic routing', 'Theme setup'],
  },
  {
    id: 'ecommerce',
    name: 'E-Commerce',
    description: 'Complete shopping app with cart, products, and checkout',
    icon: 'ShoppingCart',
    color: '#10B981',
    features: ['Product listing', 'Cart', 'Checkout', 'Orders', 'Profile'],
  },
  {
    id: 'saas',
    name: 'SaaS Dashboard',
    description: 'Analytics dashboard with charts and data tables',
    icon: 'LayoutDashboard',
    color: '#8B5CF6',
    features: ['Charts', 'Data tables', 'Auth', 'Settings'],
  },
  {
    id: 'social',
    name: 'Social Network',
    description: 'Social feed with posts, comments, and profiles',
    icon: 'Users',
    color: '#EC4899',
    features: ['Feed', 'Posts', 'Comments', 'Profiles', 'Follow'],
  },
  {
    id: 'dashboard',
    name: 'Admin Dashboard',
    description: 'Admin panel with user management and analytics',
    icon: 'ShieldCheck',
    color: '#F59E0B',
    features: ['User management', 'Analytics', 'Reports', 'Settings'],
  },
  {
    id: 'finance',
    name: 'Finance',
    description: 'Financial app with transactions and budget tracking',
    icon: 'Wallet',
    color: '#059669',
    features: ['Transactions', 'Budgets', 'Charts', 'Categories'],
  },
  {
    id: 'food_delivery',
    name: 'Food Delivery',
    description: 'Food ordering app with restaurants and delivery tracking',
    icon: 'UtensilsCrossed',
    color: '#EF4444',
    features: ['Restaurants', 'Menu', 'Cart', 'Tracking', 'Profile'],
  },
  {
    id: 'ai_chat',
    name: 'AI Chat',
    description: 'AI-powered chat application with streaming responses',
    icon: 'MessageSquare',
    color: '#6366F1',
    features: ['Chat', 'Streaming', 'History', 'Settings'],
  },
];

export const DEVICE_PRESETS: DevicePreset[] = [
  { name: 'iPhone 15 Pro', width: 393, height: 852, icon: 'smartphone' },
  { name: 'Android Pixel', width: 412, height: 915, icon: 'smartphone' },
  { name: 'iPad Pro', width: 1024, height: 1366, icon: 'tablet' },
  { name: 'Desktop', width: 1440, height: 900, icon: 'monitor' },
];

export const SIDEBAR_SECTIONS = [
  {
    label: 'HOME',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'LayoutGrid' },
    ],
  },
  {
    label: 'BUILD',
    items: [
      { id: 'ai-builder', label: 'AI Builder', icon: 'Sparkles' },
      { id: 'preview', label: 'Preview', icon: 'Eye' },
      { id: 'files', label: 'Files', icon: 'FolderTree' },
      { id: 'components', label: 'Components', icon: 'Blocks' },
      { id: 'theme', label: 'Theme', icon: 'Palette' },
      { id: 'dependencies', label: 'Dependencies', icon: 'Package' },
      { id: 'connectors', label: 'Connectors', icon: 'Plug' },
    ],
  },
  {
    label: 'DEVELOPMENT',
    items: [
      { id: 'code', label: 'Code', icon: 'Code2' },
      { id: 'terminal', label: 'Terminal', icon: 'TerminalSquare' },
      { id: 'problems', label: 'Problems', icon: 'AlertTriangle' },
      { id: 'git', label: 'Git', icon: 'GitBranch' },
    ],
  },
  {
    label: 'PROJECT',
    items: [
      { id: 'versions', label: 'Versions', icon: 'History' },
      { id: 'settings', label: 'Settings', icon: 'Settings' },
      { id: 'deploy', label: 'Deploy', icon: 'Rocket' },
      { id: 'export', label: 'Export', icon: 'Download' },
    ],
  },
] as const;

export const PRICING_PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Perfect for trying out FlutterForge',
    features: ['3 projects', '50 AI generations/month', '10 build minutes/month', 'Community support'],
    cta: 'Start Free',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    description: 'For developers building production apps',
    features: ['Unlimited projects', '500 AI generations/month', '100 build minutes/month', 'Priority support', 'Custom themes', 'Export & deploy'],
    cta: 'Start Pro Trial',
    highlight: true,
  },
  {
    name: 'Team',
    price: '$99',
    period: '/month',
    description: 'For teams collaborating on Flutter apps',
    features: ['Everything in Pro', 'Unlimited AI generations', '500 build minutes/month', 'Team collaboration', 'Shared projects', 'Admin panel', 'SSO'],
    cta: 'Start Team Trial',
    highlight: false,
  },
];

export const FAQS = [
  {
    question: 'What is FlutterForge?',
    answer: 'FlutterForge is an AI-powered development environment that generates complete Flutter applications from natural language descriptions. It handles code generation, dependency management, analysis, error fixing, and building — all in one place.',
  },
  {
    question: 'Do I need Flutter installed locally?',
    answer: 'No. FlutterForge runs the Flutter SDK in isolated cloud environments. You describe your app, and we handle the compilation, analysis, and preview entirely in the browser.',
  },
  {
    question: 'Can I export the generated code?',
    answer: 'Yes. Every generated project can be exported as a complete Flutter ZIP that runs independently of FlutterForge. You get full ownership of the source code.',
  },
  {
    question: 'What state management solutions are supported?',
    answer: 'FlutterForge supports Provider, Riverpod, and Bloc by default. You can choose your preferred state management during project creation.',
  },
  {
    question: 'Can I modify the generated code?',
    answer: 'Absolutely. You can edit any file directly in the built-in Monaco editor, or ask the AI to make changes for you. The AI understands your project context and makes incremental modifications.',
  },
  {
    question: 'Does FlutterForge support deployment?',
    answer: 'Yes, FlutterForge supports Flutter Web deployment out of the box. You can build, deploy, and get a live URL directly from the platform.',
  },
];

export const KEYBOARD_SHORTCUTS = [
  { keys: ['Cmd', 'K'], action: 'AI command' },
  { keys: ['Cmd', 'P'], action: 'Quick file search' },
  { keys: ['Cmd', 'S'], action: 'Save' },
  { keys: ['Cmd', 'Shift', 'P'], action: 'Command palette' },
  { keys: ['Cmd', 'B'], action: 'Toggle sidebar' },
  { keys: ['Cmd', 'Enter'], action: 'Send AI prompt' },
];

export const COMMAND_PALETTE_COMMANDS = [
  { id: 'open-file', label: 'Open File', icon: 'FileOpen', section: 'File' },
  { id: 'open-preview', label: 'Open Preview', icon: 'Eye', section: 'View' },
  { id: 'open-ai-builder', label: 'Open AI Builder', icon: 'Sparkles', section: 'View' },
  { id: 'open-terminal', label: 'Open Terminal', icon: 'TerminalSquare', section: 'View' },
  { id: 'run-analyze', label: 'Run Flutter Analyze', icon: 'Search', section: 'Build' },
  { id: 'build-preview', label: 'Build Preview', icon: 'Hammer', section: 'Build' },
  { id: 'add-dependency', label: 'Add Dependency', icon: 'Package', section: 'Project' },
  { id: 'create-screen', label: 'Create Screen', icon: 'SquarePlus', section: 'Project' },
  { id: 'create-component', label: 'Create Component', icon: 'Blocks', section: 'Project' },
  { id: 'change-theme', label: 'Change Theme', icon: 'Palette', section: 'Project' },
  { id: 'export-project', label: 'Export Project', icon: 'Download', section: 'Project' },
] as const;
