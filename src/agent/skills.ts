/**
 * FlutterForge Skills System
 *
 * Lovable-grade modular capability packs that inject specialized architectural rules,
 * UI design tokens, package dependencies, and validation guidelines into the AI agent.
 */

export type SkillCategory = 'ui' | 'architecture' | 'platform' | 'backend' | 'motion' | 'data' | 'custom';

export interface FlutterSkill {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  icon: string;
  enabled: boolean;
  requiredPackages: Record<string, string>;
  rules: string[];
  codeSnippets?: Array<{ title: string; code: string }>;
}

export const BUILT_IN_SKILLS: FlutterSkill[] = [
  {
    id: 'modern-ui',
    name: 'Modern UI & Design System',
    description: 'Material 3 theme tokens, fluid responsive layout, polished elevation, and complete empty/loading states.',
    category: 'ui',
    icon: 'Palette',
    enabled: true,
    requiredPackages: {
      'google_fonts': '^6.2.1',
    },
    rules: [
      'Strictly use Material 3 ColorScheme tokens (colorScheme.primary, colorScheme.surface, colorScheme.outlineVariant) rather than hardcoded colors.',
      'Always implement responsive layout adaptivity using LayoutBuilder or MediaQuery.sizeOf(context).width with max-width containment (e.g. 640px) on wide displays.',
      'Every screen and list must explicitly handle three visual states: Loading (adaptive spinner or shimmer), Error (friendly card with retry action), and Empty (illustrative icon + call-to-action).',
      'Use GoogleFonts.inter or GoogleFonts.plusJakartaSans with a clear typography scale (displayMedium, titleLarge, bodyMedium, labelSmall).',
      'Maintain consistent 8pt grid spacing (8, 16, 24, 32, 48) using SizedBox or EdgeInsets.',
    ],
  },
  {
    id: 'clean-architecture',
    name: 'Feature-First Architecture',
    description: 'Clean separation of concerns with features, data repositories, domain models, and presentation widgets.',
    category: 'architecture',
    icon: 'Layers',
    enabled: true,
    requiredPackages: {
      'go_router': '^14.2.0',
    },
    rules: [
      'Organize code by feature under lib/features/<feature_name>/{presentation,data,models}.',
      'Decouple business logic and HTTP/Supabase calls into dedicated Service or Repository classes — never execute network/DB queries inside build() methods.',
      'Use GoRouter with declarative routes, route constants, and typed navigation paths.',
      'Always dispose TextEditingControllers, AnimationControllers, and StreamSubscriptions in State.dispose().',
      'Prefer immutable state objects and pure transformation functions.',
    ],
  },
  {
    id: 'animations-motion',
    name: 'Animations & Micro-interactions',
    description: 'Staggered list appearances, smooth page transitions, tap scale micro-interactions, and flutter_animate motion.',
    category: 'motion',
    icon: 'Sparkles',
    enabled: true,
    requiredPackages: {
      'flutter_animate': '^4.5.0',
    },
    rules: [
      'Apply subtle entrance animations to cards and list items using flutter_animate (.animate().fadeIn(duration: 300.ms).slideY(begin: 0.1, end: 0)).',
      'Use staggered delays for lists (delay: (index * 50).ms) to make feed and grid views feel fluid and premium.',
      'Add micro-interaction feedback on primary action buttons (subtle scale, press state).',
      'Keep animation durations snappy (150ms-350ms) with smooth easing curves (Curves.easeOutCubic or Curves.fastOutSlowIn).',
    ],
  },
  {
    id: 'desktop-web-parity',
    name: 'Web & Desktop Ergonomics',
    description: 'Keyboard shortcuts, mouse hover effects, centered desktop constraints, and web-safe guards.',
    category: 'platform',
    icon: 'Monitor',
    enabled: true,
    requiredPackages: {},
    rules: [
      'Wrap wide interactive forms in Center and ConstrainedBox with BoxConstraints(maxWidth: 720) so they do not stretch horizontally across 4K displays.',
      'Add hover feedback using MouseRegion or InkWell hoverColor for web and desktop mouse interactions.',
      'Support keyboard navigation and Enter-to-submit on forms using Shortcuts or onSubmitted callbacks.',
      'Always import dart:io conditionally or guard with kIsWeb before accessing platform filesystems.',
      'Ensure scrollbars are visible on desktop platforms using Scrollbar widget with thumbVisibility: true.',
    ],
  },
  {
    id: 'supabase-production',
    name: 'Supabase Production Backend',
    description: 'Row-Level Security (RLS) SQL policies, robust auth listeners, typed models, and realtime data streaming.',
    category: 'backend',
    icon: 'Database',
    enabled: true,
    requiredPackages: {
      'supabase_flutter': '^2.6.0',
    },
    rules: [
      'Generate robust RLS (Row-Level Security) policies for every Postgres table in supabase/migrations/ — NEVER leave tables unshielded.',
      'Models must include robust fromJson() and toJson() factories handling null values gracefully with fallback defaults.',
      'Listen to Supabase auth state changes (Supabase.instance.client.auth.onAuthStateChange) to redirect between auth and home screens.',
      'Provide clear, user-friendly error banners when Supabase operations fail (e.g. invalid credentials, network failure).',
      'Store Supabase client initialization in a single reliable service singleton (SupabaseService).',
    ],
  },
  {
    id: 'clean-forms-validation',
    name: 'Clean Forms & Input Masks',
    description: 'Instant inline validation, un-focus on background tap, loading states on submit buttons, and email/password guards.',
    category: 'ui',
    icon: 'CheckSquare',
    enabled: true,
    requiredPackages: {},
    rules: [
      'Always wrap form screens with GestureDetector(onTap: () => FocusScope.of(context).unfocus(), child: ...) to dismiss virtual keyboards comfortably.',
      'Disable the submit button and show a CircularProgressIndicator.adaptive() when an async action is in flight (isLoading ? null : onSubmit).',
      'Validate email formats, required fields, and password lengths with clear, friendly inline error messages.',
      'Include clear prefix icons (Icons.email_outlined, Icons.lock_outline) and eye-toggle buttons for password fields.',
    ],
  },
  {
    id: 'offline-first-caching',
    name: 'Offline Resilience & Local Storage',
    description: 'Persist preferences, recent sessions, and cache critical data locally using shared_preferences.',
    category: 'data',
    icon: 'HardDrive',
    enabled: false,
    requiredPackages: {
      'shared_preferences': '^2.2.3',
    },
    rules: [
      'Store theme mode preference (light/dark/system) and user session flags in SharedPreferences.',
      'Implement an offline fallback state when network requests fail, displaying previously cached data or an offline banner.',
      'Gracefully handle empty local cache on first app launch.',
    ],
  },
];

const SKILLS_STORAGE_KEY = 'flutterforge_active_skills_v1';

export class SkillRegistry {
  private static skills: FlutterSkill[] = SkillRegistry.loadSkills();

  private static loadSkills(): FlutterSkill[] {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [...BUILT_IN_SKILLS];
    }
    try {
      const stored = localStorage.getItem(SKILLS_STORAGE_KEY);
      if (!stored) return [...BUILT_IN_SKILLS];
      const parsed: Record<string, boolean> = JSON.parse(stored);
      return BUILT_IN_SKILLS.map((skill) => ({
        ...skill,
        enabled: parsed[skill.id] !== undefined ? parsed[skill.id] : skill.enabled,
      }));
    } catch {
      return [...BUILT_IN_SKILLS];
    }
  }

  private static persist(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const state = this.skills.reduce<Record<string, boolean>>((acc, s) => {
        acc[s.id] = s.enabled;
        return acc;
      }, {});
      localStorage.setItem(SKILLS_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore localStorage quota errors
    }
  }

  public static getAllSkills(): FlutterSkill[] {
    return [...this.skills];
  }

  public static getActiveSkills(): FlutterSkill[] {
    return this.skills.filter((s) => s.enabled);
  }

  public static setSkillEnabled(skillId: string, enabled: boolean): void {
    const target = this.skills.find((s) => s.id === skillId);
    if (target) {
      target.enabled = enabled;
      this.persist();
    }
  }

  public static toggleSkill(skillId: string): boolean {
    const target = this.skills.find((s) => s.id === skillId);
    if (target) {
      target.enabled = !target.enabled;
      this.persist();
      return target.enabled;
    }
    return false;
  }

  public static getRequiredPackages(activeSkills?: FlutterSkill[]): Record<string, string> {
    const list = activeSkills ?? this.getActiveSkills();
    const packages: Record<string, string> = {};
    for (const skill of list) {
      if (skill.requiredPackages) {
        Object.assign(packages, skill.requiredPackages);
      }
    }
    return packages;
  }

  public static formatPromptInjection(activeSkills?: FlutterSkill[]): string {
    const list = activeSkills ?? this.getActiveSkills();
    if (list.length === 0) return '';

    const lines: string[] = [
      '### ACTIVE FLUTTER CAPABILITY SKILLS',
      'The user has enabled the following specialized architectural skills for this project. Adhere strictly to these rules:',
      '',
    ];

    for (const skill of list) {
      lines.push(`#### Skill: ${skill.name} (${skill.category})`);
      lines.push(`- Goal: ${skill.description}`);
      for (const rule of skill.rules) {
        lines.push(`  * ${rule}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}

