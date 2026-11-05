import type {
  AgentPlan,
  DatabaseSchemaPlan,
  TableDefinition,
  ModelPlan,
  ServicePlan,
  ScreenPlan,
  AgentContext,
  DetectedFeatures,
  DesignBrief,
} from './types';
import { generateUniqueAppId, getAndroidApplicationId, getIosBundleId } from '../utils/appId';
import { SkillRegistry, type FlutterSkill } from './skills';

export class AgentPlanner {
  /**
   * Plans the entire Flutter + Supabase application architecture based on user prompt and context
   */
  public static plan(
    prompt: string,
    context: AgentContext,
    opts?: { stateManagement?: AgentPlan['stateManagement']; skills?: FlutterSkill[] | string[] },
  ): AgentPlan {
    const lower = prompt.toLowerCase();
    const appName = this.inferAppName(prompt, context.projectName);
    const domain = this.detectDomain(lower);
    const features = this.detectFeatures(prompt, domain);
    const schema = this.planSchema(domain);
    const models = this.planModels(schema);
    const services = this.planServices(domain, schema);
    const screens = this.planScreens(domain, context.usesSupabase !== false);
    const isDark = lower.includes('dark');
    const design = this.planDesign(prompt, domain);
    const theme = {
      primaryColor: design.palette.primary,
      secondaryColor: design.palette.secondary,
      backgroundColor: isDark ? design.palette.backgroundDark : design.palette.background,
      isDarkPreferred: isDark,
    };

    const stateManagement = opts?.stateManagement ?? 'change_notifier';

    const dependencies: Record<string, string> = {
      flutter: 'sdk',
      supabase_flutter: '^2.8.0',
      go_router: '^14.6.2',
      google_fonts: '^6.2.1',
      intl: '^0.20.3',
      cached_network_image: '^3.4.1',
      flutter_animate: '^4.5.0',
      uuid: '^4.5.1',
      shared_preferences: '^2.3.2',
    };

    // Merge skills packages
    const activeSkills: FlutterSkill[] = Array.isArray(opts?.skills) && opts.skills.length > 0 && typeof opts.skills[0] === 'object'
      ? (opts.skills as FlutterSkill[])
      : SkillRegistry.getActiveSkills();
    const skillPackages = SkillRegistry.getRequiredPackages(activeSkills);
    Object.assign(dependencies, skillPackages);
    // The offline generator + validator key off this: riverpod projects get
    // flutter_riverpod (with ProviderScope/StateNotifier templates),
    // everything else keeps provider/ChangeNotifier.
    if (stateManagement === 'riverpod') {
      dependencies['flutter_riverpod'] = '^2.5.1';
    } else {
      dependencies['provider'] = '^6.1.2';
    }

    const devDependencies: Record<string, string> = {
      flutter_test: 'sdk',
      flutter_lints: '^5.0.0',
    };

    // Calculate files to create vs modify
    const existingFilePaths = new Set(context.existingFiles.map((f) => f.path));

    const allPlannedFiles = [
      'pubspec.yaml',
      'analysis_options.yaml',
      'lib/main.dart',
      'lib/app.dart',
      'lib/core/constants/app_constants.dart',
      'lib/core/theme/app_theme.dart',
      'lib/core/theme/theme_controller.dart',
      'lib/core/widgets/theme_toggle_button.dart',
      'lib/core/router/app_router.dart',
      'lib/core/utils/formatters.dart',
      'lib/core/widgets/custom_button.dart',
      'lib/core/widgets/custom_text_field.dart',
      'lib/core/widgets/empty_state.dart',
      'lib/core/widgets/loading_indicator.dart',
      'lib/core/widgets/shimmer_skeleton.dart',
      'lib/state/app_provider.dart',
      'supabase/migrations/001_initial_schema.sql',
      ...models.map((m) => m.filePath),
      ...services.map((s) => s.filePath),
      ...screens.map((s) => s.filePath),
    ];

    const filesToCreate: string[] = [];
    const filesToModify: string[] = [];

    for (const filePath of allPlannedFiles) {
      if (existingFilePaths.has(filePath)) {
        filesToModify.push(filePath);
      } else {
        filesToCreate.push(filePath);
      }
    }

    const appId = generateUniqueAppId(appName, context.projectId || undefined);

    return {
      id: crypto.randomUUID(),
      appName,
      // Every new app gets a different id: slug + 6 chars from the project
      // UUID (deterministic per project, unique across projects sharing a name).
      appId,
      applicationId: getAndroidApplicationId(appId),
      bundleId: getIosBundleId(appId),
      appDescription: `Production-ready ${domain} Flutter application integrated with Supabase backend.`,
      architecture: 'feature_first',
      stateManagement,
      domain,
      features,
      theme,
      design,
      appliedSkills: activeSkills.map((s) => s.id),
      dependencies,
      devDependencies,
      schema,
      models,
      services,
      screens,
      filesToCreate,
      filesToModify,
      estimatedSteps: allPlannedFiles.length + 3,
    };
  }

  public static detectFeatures(prompt: string, domain: string): DetectedFeatures {
    const lower = prompt.toLowerCase();
    return {
      domain,
      authMode: lower.includes('magic') ? 'magic_link' : lower.includes('google') || lower.includes('oauth') ? 'oauth' : 'email',
      hasDarkMode: lower.includes('dark'),
      hasSearch: lower.includes('search') || lower.includes('filter') || domain === 'ecommerce' || domain === 'food',
      hasFilters: lower.includes('filter') || lower.includes('sort') || domain === 'ecommerce',
      hasCharts: lower.includes('chart') || lower.includes('graph') || lower.includes('stat') || domain === 'fitness' || domain === 'crypto',
      hasNotifications: lower.includes('notification') || lower.includes('alert') || lower.includes('remind'),
      hasMaps: lower.includes('map') || lower.includes('location') || lower.includes('gps') || domain === 'food' || domain === 'travel',
      hasPayments: lower.includes('pay') || lower.includes('stripe') || lower.includes('checkout') || domain === 'ecommerce' || domain === 'booking',
      hasRealtime: true,
      hasFileUpload: lower.includes('upload') || lower.includes('avatar') || lower.includes('image') || lower.includes('photo'),
      hasAnimations: true,
    };
  }

  private static inferAppName(prompt: string, fallback: string): string {
    if (prompt.match(/called\s+([A-Za-z0-9_]+)/i)) {
      const match = prompt.match(/called\s+([A-Za-z0-9_]+)/i);
      if (match && match[1]) return this.sanitizeAppName(match[1], fallback);
    }
    if (prompt.match(/named\s+([A-Za-z0-9_]+)/i)) {
      const match = prompt.match(/named\s+([A-Za-z0-9_]+)/i);
      if (match && match[1]) return this.sanitizeAppName(match[1], fallback);
    }
    return fallback || 'FlutterForgeApp';
  }

  /**
   * App names flow into Dart class names and pubspec names, so they must be
   * valid identifiers: strip illegal chars and leading digits/underscores
   * (e.g. "3DViewer" -> "DViewer", never "3DViewerApp").
   */
  private static sanitizeAppName(name: string, fallback: string): string {
    const cleaned = name.replace(/[^A-Za-z0-9_]/g, '').replace(/^[0-9_]+/, '');
    return cleaned || fallback || 'FlutterForgeApp';
  }

  public static detectDomain(lower: string): string {
    if (/\b(dashboard|admin|analytics|metrics|kpi|crm|audit|portal|backoffice|telemetry)\b/i.test(lower)) {
      return 'dashboard';
    }
    if (/\b(shop|store|ecommerce|e-commerce|products?|cart|checkout|sneaker|catalog|merchandise)\b/i.test(lower) && !/\b(production|productive|productivity)\b/i.test(lower)) {
      return 'ecommerce';
    }
    if (/\b(social|feed|posts?|follow|community)\b/i.test(lower)) {
      return 'social';
    }
    if (/\b(task|tasks|todo|todos|kanban|board)\b/i.test(lower)) {
      return 'tasks';
    }
    if (/\b(fitness|workout|exercise|gym|streak)\b/i.test(lower)) {
      return 'fitness';
    }
    if (/\b(chat|ai|gpt|llm|assistant|bot|chatbot)\b/i.test(lower)) {
      return 'ai_chat';
    }
    if (/\b(food|restaurant|recipe|meal|delivery|dining)\b/i.test(lower)) {
      return 'food';
    }
    if (/\b(crypto|wallet|bitcoin|ethereum|coin|tokens?)\b/i.test(lower)) {
      return 'crypto';
    }
    if (/\b(doctor|health|medical|clinic|patient)\b/i.test(lower)) {
      return 'healthcare';
    }
    if (/\b(course|courses|learn|school|quiz|tutor|education)\b/i.test(lower)) {
      return 'education';
    }
    if (/\b(book|booking|reserve|hotel|venue|ticket|reservation)\b/i.test(lower)) {
      return 'booking';
    }
    if (/\b(music|song|songs|audio|playlist|playlists|track|tracks|album|artist|beats)\b/i.test(lower)) {
      return 'music';
    }
    if (/\b(trip|travel|flight|tour|destination|itinerary)\b/i.test(lower)) {
      return 'travel';
    }
    if (/\b(property|real estate|rent|house|apartment|realtor)\b/i.test(lower)) {
      return 'real_estate';
    }
    if (/\b(habit|habits|journal|note|notes|focus|routine|productivity)\b/i.test(lower)) {
      return 'productivity';
    }
    return 'general';
  }

  /**
   * Curated design directions. Each domain gets a committed palette,
   * type pairing, spacing scale and motion language so generated apps
   * read as designed rather than defaulted. Presets are stable across
   * runs; only the prompt hash picks between generic fallbacks.
   */
  private static readonly designPresets: Record<string, DesignBrief> = {
    dashboard: {
      direction: 'Enterprise Cockpit — high information density, dark telemetry, clean status indicators and tabular data.',
      palette: {
        primary: '#3B82F6', secondary: '#10B981', accent: '#F59E0B',
        background: '#0F172A', surface: '#1E293B', ink: '#F8FAFC', muted: '#94A3B8',
        backgroundDark: '#0B0F19', surfaceDark: '#131C2E', inkDark: '#F1F5F9',
      },
      typography: { display: 'Inter', body: 'Inter', mono: 'JetBrains Mono', displayWeight: 700, bodyWeight: 400 },
      spacing: { unit: 4, scale: [4, 8, 12, 16, 24, 32, 48] },
      radius: { sm: 6, md: 10, lg: 16, pill: 999 },
      motion: { fastMs: 90, baseMs: 160, slowMs: 260, curve: 'easeOutQuad', style: 'crisp' },
      voice: { tone: 'analytical, precise', rule: 'Present metrics, counts, and status clearly; no marketing fluff.' },
    },
    ecommerce: {
      direction: 'Cobalt retail — a confident storefront with editorial product photography and fast, factual buying flows.',
      palette: {
        primary: '#1D4ED8', secondary: '#EA580C', accent: '#0EA5E9',
        background: '#F6F8FC', surface: '#FFFFFF', ink: '#0B1220', muted: '#5D6B82',
        backgroundDark: '#080D18', surfaceDark: '#121A2A', inkDark: '#EDF2FA',
      },
      typography: { display: 'Sora', body: 'Inter', mono: 'JetBrains Mono', displayWeight: 700, bodyWeight: 400 },
      spacing: { unit: 4, scale: [4, 8, 12, 16, 24, 32, 48] },
      radius: { sm: 8, md: 14, lg: 24, pill: 999 },
      motion: { fastMs: 120, baseMs: 220, slowMs: 380, curve: 'easeOutCubic', style: 'crisp' },
      voice: { tone: 'confident, concise', rule: 'Lead with price, stock and delivery facts; never stack hype adjectives.' },
    },
    social: {
      direction: 'Signal — a bright community feed that makes people, not chrome, the loudest thing on screen.',
      palette: {
        primary: '#7C3AED', secondary: '#F43F5E', accent: '#22D3EE',
        background: '#FAF8FF', surface: '#FFFFFF', ink: '#171026', muted: '#6B6480',
        backgroundDark: '#0B0714', surfaceDark: '#171027', inkDark: '#F4F1FB',
      },
      typography: { display: 'Space Grotesk', body: 'Inter', mono: 'Space Mono', displayWeight: 700, bodyWeight: 400 },
      spacing: { unit: 4, scale: [4, 8, 12, 16, 24, 32, 48] },
      radius: { sm: 10, md: 18, lg: 28, pill: 999 },
      motion: { fastMs: 100, baseMs: 180, slowMs: 320, curve: 'easeOutBack', style: 'springy' },
      voice: { tone: 'warm, direct', rule: 'Write like a person talking to a friend; no corporate filler.' },
    },
    tasks: {
      direction: 'Quiet focus — a work board with disciplined hierarchy and almost no decoration between the user and the next action.',
      palette: {
        primary: '#334155', secondary: '#2563EB', accent: '#F59E0B',
        background: '#F8FAFC', surface: '#FFFFFF', ink: '#0F172A', muted: '#64748B',
        backgroundDark: '#0B1220', surfaceDark: '#151E2E', inkDark: '#E9EEF6',
      },
      typography: { display: 'Manrope', body: 'Inter', mono: 'JetBrains Mono', displayWeight: 700, bodyWeight: 400 },
      spacing: { unit: 4, scale: [4, 8, 12, 16, 24, 32, 48] },
      radius: { sm: 6, md: 12, lg: 18, pill: 999 },
      motion: { fastMs: 110, baseMs: 200, slowMs: 340, curve: 'easeOutQuad', style: 'quiet' },
      voice: { tone: 'calm, factual', rule: 'State the next action on the button and the result in the confirmation.' },
    },
    fitness: {
      direction: 'Kinetic training floor — progress numbers dominate, surfaces stay flat, motion feels like effort.',
      palette: {
        primary: '#4D7C0F', secondary: '#0EA5E9', accent: '#F97316',
        background: '#F5F8F1', surface: '#FFFFFF', ink: '#10160C', muted: '#5B6B52',
        backgroundDark: '#080D06', surfaceDark: '#131B11', inkDark: '#EDF3E7',
      },
      typography: { display: 'Archivo', body: 'DM Sans', mono: 'IBM Plex Mono', displayWeight: 800, bodyWeight: 400 },
      spacing: { unit: 4, scale: [4, 8, 12, 16, 24, 32, 48] },
      radius: { sm: 8, md: 16, lg: 24, pill: 999 },
      motion: { fastMs: 90, baseMs: 160, slowMs: 280, curve: 'easeOutCubic', style: 'kinetic' },
      voice: { tone: 'energetic, encouraging', rule: "Lead with the user's progress, never with the app's features." },
    },
    ai_chat: {
      direction: 'Signal terminal — a calm assistant workspace where the conversation is the interface and tool activity is always legible.',
      palette: {
        primary: '#4F46E5', secondary: '#0E7490', accent: '#F59E0B',
        background: '#F7F8FB', surface: '#FFFFFF', ink: '#0C1120', muted: '#5B6478',
        backgroundDark: '#07090F', surfaceDark: '#111520', inkDark: '#ECEFF5',
      },
      typography: { display: 'Sora', body: 'Inter', mono: 'JetBrains Mono', displayWeight: 700, bodyWeight: 400 },
      spacing: { unit: 4, scale: [4, 8, 12, 16, 24, 32, 48] },
      radius: { sm: 10, md: 16, lg: 24, pill: 999 },
      motion: { fastMs: 100, baseMs: 180, slowMs: 320, curve: 'easeOutCubic', style: 'fluid' },
      voice: { tone: 'precise, candid', rule: "Show the model's confidence and source in one short line." },
    },
    food: {
      direction: 'Open kitchen — warm surfaces, generous food photography and menus that scan in one glance.',
      palette: {
        primary: '#C2410C', secondary: '#15803D', accent: '#F59E0B',
        background: '#FFF9F2', surface: '#FFFFFF', ink: '#2A1A10', muted: '#77645A',
        backgroundDark: '#170E09', surfaceDark: '#241610', inkDark: '#FCF1E7',
      },
      typography: { display: 'Bitter', body: 'Karla', mono: 'JetBrains Mono', displayWeight: 700, bodyWeight: 400 },
      spacing: { unit: 4, scale: [4, 8, 12, 16, 24, 32, 48] },
      radius: { sm: 10, md: 18, lg: 26, pill: 999 },
      motion: { fastMs: 120, baseMs: 210, slowMs: 360, curve: 'easeOutCubic', style: 'appetizing' },
      voice: { tone: 'sensory, brief', rule: 'Describe taste and texture with nouns; do not stack three adjectives.' },
    },
    crypto: {
      direction: 'Precision ledger — sober numbers, tabular figures and zero visual noise around balances and movements.',
      palette: {
        primary: '#0F766E', secondary: '#B45309', accent: '#0EA5E9',
        background: '#F6FAF9', surface: '#FFFFFF', ink: '#08211E', muted: '#4E6F6A',
        backgroundDark: '#04110F', surfaceDark: '#0A1E1B', inkDark: '#E6F5F1',
      },
      typography: { display: 'IBM Plex Sans', body: 'Inter', mono: 'IBM Plex Mono', displayWeight: 600, bodyWeight: 400 },
      spacing: { unit: 4, scale: [4, 8, 12, 16, 24, 32, 48] },
      radius: { sm: 6, md: 12, lg: 18, pill: 999 },
      motion: { fastMs: 100, baseMs: 180, slowMs: 300, curve: 'easeOutQuad', style: 'precise' },
      voice: { tone: 'sober, transparent', rule: 'Every number carries its timestamp and unit.' },
    },
    healthcare: {
      direction: 'Calm care — soft surfaces, generous text and a persistent sense of what happens next.',
      palette: {
        primary: '#0E7490', secondary: '#0F766E', accent: '#22C55E',
        background: '#F4FBFA', surface: '#FFFFFF', ink: '#0B2624', muted: '#557471',
        backgroundDark: '#061818', surfaceDark: '#0C2625', inkDark: '#E9F7F5',
      },
      typography: { display: 'Manrope', body: 'Inter', mono: 'IBM Plex Mono', displayWeight: 700, bodyWeight: 400 },
      spacing: { unit: 4, scale: [4, 8, 12, 16, 24, 32, 48] },
      radius: { sm: 8, md: 14, lg: 22, pill: 999 },
      motion: { fastMs: 140, baseMs: 240, slowMs: 400, curve: 'easeInOutCubic', style: 'gentle' },
      voice: { tone: 'calm, precise', rule: 'Never alarm. Explain what happens next and who it is for.' },
    },
    education: {
      direction: 'Study room — friendly structure, visible progress and plain language at every step.',
      palette: {
        primary: '#4338CA', secondary: '#DB2777', accent: '#0D9488',
        background: '#F7F7FF', surface: '#FFFFFF', ink: '#151238', muted: '#62607F',
        backgroundDark: '#0A091E', surfaceDark: '#151336', inkDark: '#EEEBFF',
      },
      typography: { display: 'Lexend', body: 'Inter', mono: 'JetBrains Mono', displayWeight: 700, bodyWeight: 400 },
      spacing: { unit: 4, scale: [4, 8, 12, 16, 24, 32, 48] },
      radius: { sm: 8, md: 16, lg: 24, pill: 999 },
      motion: { fastMs: 120, baseMs: 200, slowMs: 340, curve: 'easeOutCubic', style: 'friendly' },
      voice: { tone: 'clear, supportive', rule: 'Plain language at a ninth-grade reading level; define each term once.' },
    },
    booking: {
      direction: 'Front desk — exact times and places, with one obvious commitment action per screen.',
      palette: {
        primary: '#0F4C81', secondary: '#B45309', accent: '#0EA5E9',
        background: '#F5F9FD', surface: '#FFFFFF', ink: '#0A2236', muted: '#56708A',
        backgroundDark: '#061421', surfaceDark: '#0B1E30', inkDark: '#E9F3FC',
      },
      typography: { display: 'Libre Franklin', body: 'Inter', mono: 'JetBrains Mono', displayWeight: 700, bodyWeight: 400 },
      spacing: { unit: 4, scale: [4, 8, 12, 16, 24, 32, 48] },
      radius: { sm: 6, md: 12, lg: 20, pill: 999 },
      motion: { fastMs: 110, baseMs: 190, slowMs: 320, curve: 'easeOutQuad', style: 'steady' },
      voice: { tone: 'helpful, exact', rule: 'Name the time, place and party before asking for commitment.' },
    },
    music: {
      direction: 'Afterhours — dark-first listening surfaces where artwork and track titles carry every screen.',
      palette: {
        primary: '#BE185D', secondary: '#7C3AED', accent: '#F59E0B',
        background: '#FAF7FA', surface: '#FFFFFF', ink: '#1E0F1A', muted: '#6E5A6A',
        backgroundDark: '#0B0710', surfaceDark: '#160E1B', inkDark: '#F7EEF7',
      },
      typography: { display: 'Epilogue', body: 'Inter', mono: 'Space Mono', displayWeight: 700, bodyWeight: 400 },
      spacing: { unit: 4, scale: [4, 8, 12, 16, 24, 32, 48] },
      radius: { sm: 12, md: 20, lg: 30, pill: 999 },
      motion: { fastMs: 90, baseMs: 170, slowMs: 300, curve: 'easeOutCubic', style: 'expressive' },
      voice: { tone: 'evocative, short', rule: 'One line per idea; let artwork and titles carry the mood.' },
    },
    travel: {
      direction: 'Postcard — real places, real times, wide imagery and a booking path that never hides the cost.',
      palette: {
        primary: '#0369A1', secondary: '#EA580C', accent: '#FACC15',
        background: '#F4FAFD', surface: '#FFFFFF', ink: '#08283A', muted: '#537486',
        backgroundDark: '#051722', surfaceDark: '#0A283A', inkDark: '#E9F6FD',
      },
      typography: { display: 'Outfit', body: 'Inter', mono: 'JetBrains Mono', displayWeight: 700, bodyWeight: 400 },
      spacing: { unit: 4, scale: [4, 8, 12, 16, 24, 32, 48] },
      radius: { sm: 8, md: 16, lg: 24, pill: 999 },
      motion: { fastMs: 120, baseMs: 220, slowMs: 380, curve: 'easeOutCubic', style: 'open' },
      voice: { tone: 'aspirational, concrete', rule: 'Name real places and times; never say unforgettable.' },
    },
    real_estate: {
      direction: 'Architectural — restrained typography, sharp geometry and facts before adjectives.',
      palette: {
        primary: '#1F2937', secondary: '#B45309', accent: '#0E7490',
        background: '#F7F6F2', surface: '#FFFFFF', ink: '#14171C', muted: '#6A6E75',
        backgroundDark: '#0C0E12', surfaceDark: '#181B21', inkDark: '#F3F1EB',
      },
      typography: { display: 'Urbanist', body: 'Inter', mono: 'JetBrains Mono', displayWeight: 700, bodyWeight: 400 },
      spacing: { unit: 4, scale: [4, 8, 12, 16, 24, 32, 48] },
      radius: { sm: 4, md: 10, lg: 16, pill: 999 },
      motion: { fastMs: 140, baseMs: 240, slowMs: 400, curve: 'easeInOutCubic', style: 'restrained' },
      voice: { tone: 'substantive, specific', rule: 'Square metres, light direction and commute times before adjectives.' },
    },
    productivity: {
      direction: 'Daily rhythm — gentle pacing, clear streaks and no guilt mechanics.',
      palette: {
        primary: '#475569', secondary: '#0F766E', accent: '#F59E0B',
        background: '#F8FAF9', surface: '#FFFFFF', ink: '#101817', muted: '#5E6D6A',
        backgroundDark: '#08100F', surfaceDark: '#121D1B', inkDark: '#ECF3F1',
      },
      typography: { display: 'Public Sans', body: 'Inter', mono: 'JetBrains Mono', displayWeight: 700, bodyWeight: 400 },
      spacing: { unit: 4, scale: [4, 8, 12, 16, 24, 32, 48] },
      radius: { sm: 8, md: 14, lg: 22, pill: 999 },
      motion: { fastMs: 130, baseMs: 220, slowMs: 360, curve: 'easeOutCubic', style: 'gentle' },
      voice: { tone: 'calm, matter-of-fact', rule: 'Celebrate the behaviour, never the streak number itself.' },
    },
    general: {
      direction: 'Forge — the product palette: deep-sea ink, teal signal and coral emphasis with disciplined spacing.',
      palette: {
        primary: '#02AFB9', secondary: '#F07067', accent: '#FACC15',
        background: '#FBFADD', surface: '#FFFFFF', ink: '#0B3542', muted: '#5A7178',
        backgroundDark: '#0A3542', surfaceDark: '#124551', inkDark: '#F2FAFB',
      },
      typography: { display: 'Sora', body: 'Inter', mono: 'JetBrains Mono', displayWeight: 700, bodyWeight: 400 },
      spacing: { unit: 4, scale: [4, 8, 12, 16, 24, 32, 48] },
      radius: { sm: 8, md: 14, lg: 24, pill: 999 },
      motion: { fastMs: 120, baseMs: 200, slowMs: 340, curve: 'easeOutCubic', style: 'composed' },
      voice: { tone: 'clear, practical', rule: 'Say what the product does in plain words; skip superlatives.' },
    },
  };

  /**
   * Generic prompts still deserve a designed app. A stable hash of the prompt
   * picks between three neutral-but-distinct directions so repeat runs of the
   * same brief keep the same identity.
   */
  private static readonly generalVariants: DesignBrief[] = [
    {
      direction: 'Forge — the product palette: deep-sea ink, teal signal and coral emphasis with disciplined spacing.',
      palette: {
        primary: '#02AFB9', secondary: '#F07067', accent: '#FACC15',
        background: '#FBFADD', surface: '#FFFFFF', ink: '#0B3542', muted: '#5A7178',
        backgroundDark: '#0A3542', surfaceDark: '#124551', inkDark: '#F2FAFB',
      },
      typography: { display: 'Sora', body: 'Inter', mono: 'JetBrains Mono', displayWeight: 700, bodyWeight: 400 },
      spacing: { unit: 4, scale: [4, 8, 12, 16, 24, 32, 48] },
      radius: { sm: 8, md: 14, lg: 24, pill: 999 },
      motion: { fastMs: 120, baseMs: 200, slowMs: 340, curve: 'easeOutCubic', style: 'composed' },
      voice: { tone: 'clear, practical', rule: 'Say what the product does in plain words; skip superlatives.' },
    },
    {
      direction: 'Graphite — near-black ink, amber emphasis and quiet editorial spacing for tools that respect attention.',
      palette: {
        primary: '#1F2937', secondary: '#D97706', accent: '#0EA5E9',
        background: '#F7F7F5', surface: '#FFFFFF', ink: '#141518', muted: '#6A6C72',
        backgroundDark: '#0B0C0F', surfaceDark: '#16181D', inkDark: '#F2F2EF',
      },
      typography: { display: 'Sora', body: 'Inter', mono: 'JetBrains Mono', displayWeight: 700, bodyWeight: 400 },
      spacing: { unit: 4, scale: [4, 8, 12, 16, 24, 32, 48] },
      radius: { sm: 6, md: 12, lg: 20, pill: 999 },
      motion: { fastMs: 120, baseMs: 200, slowMs: 340, curve: 'easeOutCubic', style: 'composed' },
      voice: { tone: 'clear, practical', rule: 'Say what the product does in plain words; skip superlatives.' },
    },
    {
      direction: 'Cobalt — a clean blue system with warm orange emphasis and fast, legible interactions.',
      palette: {
        primary: '#1E40AF', secondary: '#EA580C', accent: '#0D9488',
        background: '#F6F8FC', surface: '#FFFFFF', ink: '#0B1220', muted: '#5D6B82',
        backgroundDark: '#070C18', surfaceDark: '#111A2B', inkDark: '#ECF1FA',
      },
      typography: { display: 'Space Grotesk', body: 'Inter', mono: 'JetBrains Mono', displayWeight: 700, bodyWeight: 400 },
      spacing: { unit: 4, scale: [4, 8, 12, 16, 24, 32, 48] },
      radius: { sm: 8, md: 14, lg: 24, pill: 999 },
      motion: { fastMs: 110, baseMs: 190, slowMs: 320, curve: 'easeOutCubic', style: 'crisp' },
      voice: { tone: 'clear, practical', rule: 'Say what the product does in plain words; skip superlatives.' },
    },
  ];

  public static planDesign(prompt: string, domain: string): DesignBrief {
    const preset = this.designPresets[domain]
      ?? this.generalVariants[this.promptHash(prompt) % this.generalVariants.length];
    const brief: DesignBrief = {
      ...preset,
      palette: { ...preset.palette },
      typography: { ...preset.typography },
      spacing: { unit: preset.spacing.unit, scale: [...preset.spacing.scale] },
      radius: { ...preset.radius },
      motion: { ...preset.motion },
      voice: { ...preset.voice },
    };

    // An explicit hex in the brief wins over the preset primary.
    const explicit = prompt.match(/#([0-9A-Fa-f]{6})\b/);
    if (explicit) brief.palette.primary = `#${explicit[1].toUpperCase()}`;

    return brief;
  }

  private static promptHash(prompt: string): number {
    let hash = 2166136261;
    for (let i = 0; i < prompt.length; i += 1) {
      hash ^= prompt.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  private static planSchema(domain: string): DatabaseSchemaPlan {
    const tables: TableDefinition[] = [];

    // Common profiles table for Supabase Auth
    tables.push({
      name: 'profiles',
      description: 'Public user profiles linked to auth.users',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, references: { table: 'auth.users', column: 'id', onDelete: 'CASCADE' } },
        { name: 'email', type: 'text', isNullable: false },
        { name: 'full_name', type: 'text', isNullable: true },
        { name: 'avatar_url', type: 'text', isNullable: true },
        { name: 'created_at', type: 'timestamptz', defaultValue: 'now()' },
        { name: 'updated_at', type: 'timestamptz', defaultValue: 'now()' },
      ],
      enableRLS: true,
      policies: [
        { name: 'Public profiles are viewable by everyone', table: 'profiles', action: 'SELECT', usingExpression: 'true' },
        { name: 'Users can insert their own profile', table: 'profiles', action: 'INSERT', withCheckExpression: 'auth.uid() = id' },
        { name: 'Users can update their own profile', table: 'profiles', action: 'UPDATE', usingExpression: 'auth.uid() = id' },
      ],
      enableRealtime: true,
    });

    if (domain === 'ecommerce') {
      tables.push({
        name: 'products',
        description: 'Store inventory items and pricing',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
          { name: 'title', type: 'text', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'price', type: 'numeric', isNullable: false, defaultValue: '0.00' },
          { name: 'image_url', type: 'text', isNullable: true },
          { name: 'category', type: 'text', isNullable: false, defaultValue: "'General'" },
          { name: 'stock_quantity', type: 'integer', isNullable: false, defaultValue: '10' },
          { name: 'rating', type: 'float', isNullable: false, defaultValue: '4.8' },
          { name: 'created_at', type: 'timestamptz', defaultValue: 'now()' },
        ],
        enableRLS: true,
        policies: [
          { name: 'Anyone can view products', table: 'products', action: 'SELECT', usingExpression: 'true' },
          { name: 'Authenticated users can add products', table: 'products', action: 'INSERT', withCheckExpression: "auth.role() = 'authenticated'" },
        ],
        enableRealtime: true,
      });

      tables.push({
        name: 'orders',
        description: 'Customer purchase orders',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
          { name: 'user_id', type: 'uuid', references: { table: 'auth.users', column: 'id', onDelete: 'CASCADE' } },
          { name: 'total_amount', type: 'numeric', isNullable: false },
          { name: 'status', type: 'text', isNullable: false, defaultValue: "'pending'" },
          { name: 'shipping_address', type: 'text', isNullable: true },
          { name: 'items_json', type: 'jsonb', isNullable: false },
          { name: 'created_at', type: 'timestamptz', defaultValue: 'now()' },
        ],
        enableRLS: true,
        policies: [
          { name: 'Users can view their own orders', table: 'orders', action: 'SELECT', usingExpression: 'auth.uid() = user_id' },
          { name: 'Users can create their own orders', table: 'orders', action: 'INSERT', withCheckExpression: 'auth.uid() = user_id' },
        ],
        enableRealtime: true,
      });
    } else if (domain === 'fitness') {
      tables.push({
        name: 'workouts',
        description: 'User workout routines and history',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
          { name: 'user_id', type: 'uuid', references: { table: 'auth.users', column: 'id', onDelete: 'CASCADE' } },
          { name: 'title', type: 'text', isNullable: false },
          { name: 'duration_minutes', type: 'integer', isNullable: false, defaultValue: '30' },
          { name: 'calories_burned', type: 'integer', isNullable: false, defaultValue: '200' },
          { name: 'is_completed', type: 'boolean', isNullable: false, defaultValue: 'false' },
          { name: 'workout_type', type: 'text', isNullable: false, defaultValue: "'Cardio'" },
          { name: 'completed_at', type: 'timestamptz', defaultValue: 'now()' },
        ],
        enableRLS: true,
        policies: [
          { name: 'Users can view own workouts', table: 'workouts', action: 'SELECT', usingExpression: 'auth.uid() = user_id' },
          { name: 'Users can insert own workouts', table: 'workouts', action: 'INSERT', withCheckExpression: 'auth.uid() = user_id' },
          { name: 'Users can update own workouts', table: 'workouts', action: 'UPDATE', usingExpression: 'auth.uid() = user_id' },
          { name: 'Users can delete own workouts', table: 'workouts', action: 'DELETE', usingExpression: 'auth.uid() = user_id' },
        ],
        enableRealtime: true,
      });

      tables.push({
        name: 'streaks',
        description: 'Daily workout streaks counter',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
          { name: 'user_id', type: 'uuid', references: { table: 'auth.users', column: 'id', onDelete: 'CASCADE' } },
          { name: 'current_streak', type: 'integer', isNullable: false, defaultValue: '1' },
          { name: 'longest_streak', type: 'integer', isNullable: false, defaultValue: '1' },
          { name: 'last_active_date', type: 'timestamptz', defaultValue: 'now()' },
        ],
        enableRLS: true,
        policies: [
          { name: 'Users can view own streaks', table: 'streaks', action: 'SELECT', usingExpression: 'auth.uid() = user_id' },
          { name: 'Users can update own streaks', table: 'streaks', action: 'ALL', usingExpression: 'auth.uid() = user_id' },
        ],
        enableRealtime: true,
      });
    } else if (domain === 'healthcare') {
      tables.push({
        name: 'appointments',
        description: 'Doctor and clinic booking appointments',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
          { name: 'user_id', type: 'uuid', references: { table: 'auth.users', column: 'id', onDelete: 'CASCADE' } },
          { name: 'doctor_name', type: 'text', isNullable: false },
          { name: 'specialty', type: 'text', isNullable: false, defaultValue: "'General Practice'" },
          { name: 'appointment_time', type: 'timestamptz', isNullable: false },
          { name: 'status', type: 'text', isNullable: false, defaultValue: "'confirmed'" },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamptz', defaultValue: 'now()' },
        ],
        enableRLS: true,
        policies: [
          { name: 'Users can view own appointments', table: 'appointments', action: 'SELECT', usingExpression: 'auth.uid() = user_id' },
          { name: 'Users can create appointments', table: 'appointments', action: 'INSERT', withCheckExpression: 'auth.uid() = user_id' },
        ],
        enableRealtime: true,
      });
    } else if (domain === 'ai_chat') {
      tables.push({
        name: 'conversations',
        description: 'AI chat conversation threads',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
          { name: 'user_id', type: 'uuid', references: { table: 'auth.users', column: 'id', onDelete: 'CASCADE' } },
          { name: 'title', type: 'text', isNullable: false, defaultValue: "'New Conversation'" },
          { name: 'model', type: 'text', isNullable: false, defaultValue: "'gpt-4o'" },
          { name: 'created_at', type: 'timestamptz', defaultValue: 'now()' },
          { name: 'updated_at', type: 'timestamptz', defaultValue: 'now()' },
        ],
        enableRLS: true,
        policies: [
          { name: 'Users can view their conversations', table: 'conversations', action: 'SELECT', usingExpression: 'auth.uid() = user_id' },
          { name: 'Users can create conversations', table: 'conversations', action: 'INSERT', withCheckExpression: 'auth.uid() = user_id' },
          { name: 'Users can update conversations', table: 'conversations', action: 'UPDATE', usingExpression: 'auth.uid() = user_id' },
          { name: 'Users can delete conversations', table: 'conversations', action: 'DELETE', usingExpression: 'auth.uid() = user_id' },
        ],
        enableRealtime: true,
      });

      tables.push({
        name: 'messages',
        description: 'Individual messages in chat threads',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
          { name: 'conversation_id', type: 'uuid', references: { table: 'conversations', column: 'id', onDelete: 'CASCADE' } },
          { name: 'role', type: 'text', isNullable: false },
          { name: 'content', type: 'text', isNullable: false },
          { name: 'created_at', type: 'timestamptz', defaultValue: 'now()' },
        ],
        enableRLS: true,
        policies: [
          { name: 'Users can view messages in their conversations', table: 'messages', action: 'SELECT', usingExpression: 'EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid())' },
          { name: 'Users can insert messages', table: 'messages', action: 'INSERT', withCheckExpression: 'EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid())' },
        ],
        enableRealtime: true,
      });
    } else if (domain === 'social') {
      tables.push({
        name: 'posts',
        description: 'User feed posts with likes and media',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
          { name: 'user_id', type: 'uuid', references: { table: 'auth.users', column: 'id', onDelete: 'CASCADE' } },
          { name: 'caption', type: 'text', isNullable: false },
          { name: 'media_url', type: 'text', isNullable: true },
          { name: 'likes_count', type: 'integer', isNullable: false, defaultValue: '0' },
          { name: 'comments_count', type: 'integer', isNullable: false, defaultValue: '0' },
          { name: 'created_at', type: 'timestamptz', defaultValue: 'now()' },
        ],
        policies: [
          { name: 'Anyone can view posts', table: 'posts', action: 'SELECT', usingExpression: 'true' },
          { name: 'Users can create posts', table: 'posts', action: 'INSERT', withCheckExpression: 'auth.uid() = user_id' },
          { name: 'Users can update their own posts', table: 'posts', action: 'UPDATE', usingExpression: 'auth.uid() = user_id' },
          { name: 'Users can delete their own posts', table: 'posts', action: 'DELETE', usingExpression: 'auth.uid() = user_id' },
        ],
        enableRLS: true,
        enableRealtime: true,
      });
    } else if (domain === 'booking') {
      tables.push({
        name: 'bookings',
        description: 'Venue and reservation booking records',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
          { name: 'user_id', type: 'uuid', references: { table: 'auth.users', column: 'id', onDelete: 'CASCADE' } },
          { name: 'venue_title', type: 'text', isNullable: false },
          { name: 'booking_date', type: 'timestamptz', isNullable: false },
          { name: 'guests_count', type: 'integer', isNullable: false, defaultValue: '2' },
          { name: 'status', type: 'text', isNullable: false, defaultValue: "'confirmed'" },
          { name: 'total_price', type: 'numeric', isNullable: false, defaultValue: '0.00' },
          { name: 'created_at', type: 'timestamptz', defaultValue: 'now()' },
        ],
        enableRLS: true,
        policies: [
          { name: 'Users can view own bookings', table: 'bookings', action: 'SELECT', usingExpression: 'auth.uid() = user_id' },
          { name: 'Users can create bookings', table: 'bookings', action: 'INSERT', withCheckExpression: 'auth.uid() = user_id' },
        ],
        enableRealtime: true,
      });
    } else if (domain === 'productivity') {
      tables.push({
        name: 'habits',
        description: 'Daily habit and routine tracking records',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
          { name: 'user_id', type: 'uuid', references: { table: 'auth.users', column: 'id', onDelete: 'CASCADE' } },
          { name: 'title', type: 'text', isNullable: false },
          { name: 'frequency', type: 'text', isNullable: false, defaultValue: "'daily'" },
          { name: 'streak_count', type: 'integer', isNullable: false, defaultValue: '0' },
          { name: 'is_completed_today', type: 'boolean', isNullable: false, defaultValue: 'false' },
          { name: 'created_at', type: 'timestamptz', defaultValue: 'now()' },
        ],
        enableRLS: true,
        policies: [
          { name: 'Users can view own habits', table: 'habits', action: 'SELECT', usingExpression: 'auth.uid() = user_id' },
          { name: 'Users can create habits', table: 'habits', action: 'INSERT', withCheckExpression: 'auth.uid() = user_id' },
          { name: 'Users can update own habits', table: 'habits', action: 'UPDATE', usingExpression: 'auth.uid() = user_id' },
          { name: 'Users can delete own habits', table: 'habits', action: 'DELETE', usingExpression: 'auth.uid() = user_id' },
        ],
        enableRealtime: true,
      });
      tables.push({
        name: 'items',
        description: 'Productivity tasks and quick notes',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
          { name: 'user_id', type: 'uuid', references: { table: 'auth.users', column: 'id', onDelete: 'CASCADE' } },
          { name: 'title', type: 'text', isNullable: false },
          { name: 'is_completed', type: 'boolean', isNullable: false, defaultValue: 'false' },
          { name: 'created_at', type: 'timestamptz', defaultValue: 'now()' },
        ],
        enableRLS: true,
        policies: [
          { name: 'Users can view own items', table: 'items', action: 'SELECT', usingExpression: 'auth.uid() = user_id' },
          { name: 'Users can manage own items', table: 'items', action: 'ALL', usingExpression: 'auth.uid() = user_id' },
        ],
        enableRealtime: true,
      });
    } else if (domain === 'dashboard') {
      tables.push({
        name: 'audit_logs',
        description: 'System activity and user action audit records',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
          { name: 'user_id', type: 'uuid', references: { table: 'auth.users', column: 'id', onDelete: 'CASCADE' } },
          { name: 'action', type: 'text', isNullable: false },
          { name: 'entity', type: 'text', isNullable: false, defaultValue: "'System'" },
          { name: 'details', type: 'text', isNullable: true },
          { name: 'status', type: 'text', isNullable: false, defaultValue: "'success'" },
          { name: 'created_at', type: 'timestamptz', defaultValue: 'now()' },
        ],
        enableRLS: true,
        policies: [
          { name: 'Admins can view all audit logs', table: 'audit_logs', action: 'SELECT', usingExpression: 'true' },
          { name: 'System can insert audit logs', table: 'audit_logs', action: 'INSERT', withCheckExpression: 'true' },
        ],
        enableRealtime: true,
      });

      tables.push({
        name: 'system_metrics',
        description: 'Server and platform health performance indicators',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
          { name: 'metric_name', type: 'text', isNullable: false },
          { name: 'metric_value', type: 'float', isNullable: false },
          { name: 'unit', type: 'text', isNullable: false, defaultValue: "'%'" },
          { name: 'status', type: 'text', isNullable: false, defaultValue: "'healthy'" },
          { name: 'recorded_at', type: 'timestamptz', defaultValue: 'now()' },
        ],
        enableRLS: true,
        policies: [
          { name: 'Admins can view system metrics', table: 'system_metrics', action: 'SELECT', usingExpression: 'true' },
        ],
        enableRealtime: true,
      });
    } else {
      // General tasks/items table
      tables.push({
        name: 'items',
        description: 'Main entity records for the application',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
          { name: 'user_id', type: 'uuid', references: { table: 'auth.users', column: 'id', onDelete: 'CASCADE' } },
          { name: 'title', type: 'text', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'category', type: 'text', isNullable: false, defaultValue: "'General'" },
          { name: 'is_completed', type: 'boolean', isNullable: false, defaultValue: 'false' },
          { name: 'priority', type: 'text', isNullable: false, defaultValue: "'medium'" },
          { name: 'due_date', type: 'timestamptz', isNullable: true },
          { name: 'created_at', type: 'timestamptz', defaultValue: 'now()' },
        ],
        enableRLS: true,
        policies: [
          { name: 'Users can view their own items', table: 'items', action: 'SELECT', usingExpression: 'auth.uid() = user_id' },
          { name: 'Users can create items', table: 'items', action: 'INSERT', withCheckExpression: 'auth.uid() = user_id' },
          { name: 'Users can update their items', table: 'items', action: 'UPDATE', usingExpression: 'auth.uid() = user_id' },
          { name: 'Users can delete their items', table: 'items', action: 'DELETE', usingExpression: 'auth.uid() = user_id' },
        ],
        enableRealtime: true,
      });
    }

    return {
      projectName: 'FlutterForge Supabase Schema',
      tables,
      storageBuckets: [
        { name: 'media', isPublic: true, fileLimitMb: 10 },
        { name: 'avatars', isPublic: true, fileLimitMb: 5 },
      ],
    };
  }

  private static planModels(schema: DatabaseSchemaPlan): ModelPlan[] {
    const models: ModelPlan[] = [];

    // User profile model
    models.push({
      name: 'UserProfile',
      filePath: 'lib/models/user_profile.dart',
      tableName: 'profiles',
      fields: [
        { name: 'id', dartType: 'String', isNullable: false, jsonKey: 'id' },
        { name: 'email', dartType: 'String', isNullable: false, jsonKey: 'email' },
        { name: 'fullName', dartType: 'String?', isNullable: true, jsonKey: 'full_name' },
        { name: 'avatarUrl', dartType: 'String?', isNullable: true, jsonKey: 'avatar_url' },
        { name: 'createdAt', dartType: 'DateTime?', isNullable: true, jsonKey: 'created_at' },
      ],
    });

    for (const table of schema.tables) {
      if (table.name === 'profiles') continue;
      const modelName = this.toPascalCase(this.singularize(table.name));
      models.push({
        name: modelName,
        filePath: `lib/models/${this.toSnakeCase(modelName)}.dart`,
        tableName: table.name,
        fields: table.columns.map((c) => ({
          name: this.toCamelCase(c.name),
          dartType: this.sqlTypeToDartType(c.type, c.isNullable),
          isNullable: !!c.isNullable,
          jsonKey: c.name,
        })),
      });
    }

    return models;
  }

  private static planServices(domain: string, schema: DatabaseSchemaPlan): ServicePlan[] {
    const services: ServicePlan[] = [
      {
        name: 'SupabaseService',
        filePath: 'lib/services/supabase_service.dart',
        purpose: 'Central client access, authentication state and realtime management',
        methods: ['signIn', 'signUp', 'signOut', 'currentUser', 'onAuthStateChange'],
        dependencies: ['supabase_flutter'],
      },
    ];

    for (const table of schema.tables) {
      if (table.name === 'profiles') continue;
      const serviceName = `${this.toPascalCase(this.singularize(table.name))}Service`;
      services.push({
        name: serviceName,
        filePath: `lib/services/${this.toSnakeCase(serviceName)}.dart`,
        purpose: `CRUD and realtime listener operations for ${table.name}`,
        methods: ['fetchAll', 'streamAll', 'create', 'update', 'delete', 'fetchById'],
        dependencies: ['supabase_flutter'],
      });
    }

    return services;
  }

  private static planScreens(domain: string, usesSupabase = true): ScreenPlan[] {
    const screens: ScreenPlan[] = [];

    if (usesSupabase) {
      screens.push(
        {
          name: 'SplashScreen',
          routeName: 'splash',
          routePath: '/splash',
          filePath: 'lib/screens/splash/splash_screen.dart',
          description: 'Brand splash and authentication router',
          isAuthProtected: false,
          widgets: ['AnimatedLogo', 'LoadingBar'],
          stateNeeds: ['SupabaseService'],
        },
        {
          name: 'AuthScreen',
          routeName: 'auth',
          routePath: '/auth',
          filePath: 'lib/screens/auth/auth_screen.dart',
          description: 'Login, Sign Up and Password Reset with Supabase Auth',
          isAuthProtected: false,
          widgets: ['AuthForm', 'SocialButtons', 'ToggleAuthMode'],
          stateNeeds: ['SupabaseService'],
        },
      );
    }

    screens.push(
      {
        name: 'HomeScreen',
        routeName: 'home',
        routePath: '/',
        filePath: 'lib/screens/home/home_screen.dart',
        description: 'Main dashboard view with realtime data integration and quick actions',
        isAuthProtected: usesSupabase,
        widgets: ['HeaderAppBar', 'RealtimeList', 'SummaryCards', 'FloatingActionButton'],
        stateNeeds: ['AppProvider'],
      },
      {
        name: 'DetailScreen',
        routeName: 'detail',
        routePath: '/detail/:id',
        filePath: 'lib/screens/detail/detail_screen.dart',
        description: 'Detailed view with editing, status updates and actions',
        isAuthProtected: usesSupabase,
        widgets: ['HeroHeader', 'DetailsCard', 'ActionButtonBar'],
        stateNeeds: ['AppProvider'],
      },
      {
        name: 'ProfileScreen',
        routeName: 'profile',
        routePath: '/profile',
        filePath: 'lib/screens/profile/profile_screen.dart',
        description: 'User settings, avatar upload, theme switcher',
        isAuthProtected: usesSupabase,
        widgets: ['AvatarPicker', 'ProfileForm', 'ThemeSelector'],
        stateNeeds: ['AppProvider'],
      },
    );

    if (domain === 'dashboard') {
      screens.push(
        {
          name: 'UserManagementScreen',
          routeName: 'users',
          routePath: '/users',
          filePath: 'lib/screens/users/user_management_screen.dart',
          description: 'User accounts, role assignment (Admin/Editor/Viewer) and status',
          isAuthProtected: usesSupabase,
          widgets: ['UserTable', 'RoleFilter', 'AddUserDialog'],
          stateNeeds: ['AppProvider'],
        },
        {
          name: 'AuditLogsScreen',
          routeName: 'audit',
          routePath: '/audit',
          filePath: 'lib/screens/audit/audit_logs_screen.dart',
          description: 'System audit trails, activity logs and timeline history',
          isAuthProtected: usesSupabase,
          widgets: ['AuditLogList', 'SeverityFilter', 'ExportLogsButton'],
          stateNeeds: ['AppProvider'],
        },
        {
          name: 'HealthMonitorScreen',
          routeName: 'health',
          routePath: '/health',
          filePath: 'lib/screens/health/health_monitor_screen.dart',
          description: 'System metrics, CPU/memory performance, and service status',
          isAuthProtected: usesSupabase,
          widgets: ['MetricCardsGrid', 'SystemStatusCard', 'RefreshTimer'],
          stateNeeds: ['AppProvider'],
        },
        {
          name: 'AnalyticsScreen',
          routeName: 'analytics',
          routePath: '/analytics',
          filePath: 'lib/screens/analytics/analytics_screen.dart',
          description: 'System health, KPIs, and audit reporting dashboard',
          isAuthProtected: usesSupabase,
          widgets: ['MetricCardsGrid', 'ActivityLogTable', 'StatusBadge', 'ExportButton'],
          stateNeeds: ['AppProvider'],
        },
      );
    }

    if (domain === 'ecommerce') {
      screens.push({
        name: 'CartScreen',
        routeName: 'cart',
        routePath: '/cart',
        filePath: 'lib/screens/cart/cart_screen.dart',
        description: 'Shopping cart review and checkout flow',
        isAuthProtected: usesSupabase,
        widgets: ['CartItemList', 'CouponField', 'OrderSummary', 'CheckoutButton'],
        stateNeeds: ['CartProvider'],
      });
    }

    return screens;
  }

  private static sqlTypeToDartType(sqlType: string, isNullable?: boolean): string {
    let type = 'String';
    switch (sqlType) {
      case 'uuid':
      case 'text':
      case 'varchar':
        type = 'String';
        break;
      case 'integer':
      case 'bigint':
        type = 'int';
        break;
      case 'numeric':
      case 'float':
        type = 'double';
        break;
      case 'boolean':
        type = 'bool';
        break;
      case 'timestamp':
      case 'timestamptz':
        type = 'DateTime';
        break;
      case 'jsonb':
        type = 'Map<String, dynamic>';
        break;
      default:
        type = 'String';
    }
    return isNullable ? `${type}?` : type;
  }

  private static toPascalCase(str: string): string {
    return str
      .replace(/[-_](\w)/g, (_, c) => c.toUpperCase())
      .replace(/^\w/, (c) => c.toUpperCase());
  }

  private static toCamelCase(str: string): string {
    const pascal = this.toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }

  private static toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  }

  private static singularize(word: string): string {
    if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
    if (word.endsWith('ses')) return word.slice(0, -2);
    if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
    return word;
  }
}
