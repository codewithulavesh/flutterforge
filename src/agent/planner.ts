import type {
  AgentPlan,
  DatabaseSchemaPlan,
  TableDefinition,
  ModelPlan,
  ServicePlan,
  ScreenPlan,
  AgentContext,
  DetectedFeatures,
} from './types';
import { generateUniqueAppId, getAndroidApplicationId, getIosBundleId } from '../utils/appId';

export class AgentPlanner {
  /**
   * Plans the entire Flutter + Supabase application architecture based on user prompt and context
   */
  public static plan(
    prompt: string,
    context: AgentContext,
    opts?: { stateManagement?: AgentPlan['stateManagement'] },
  ): AgentPlan {
    const lower = prompt.toLowerCase();
    const appName = this.inferAppName(prompt, context.projectName);
    const domain = this.detectDomain(lower);
    const features = this.detectFeatures(prompt, domain);
    const schema = this.planSchema(domain);
    const models = this.planModels(schema);
    const services = this.planServices(domain, schema);
    const screens = this.planScreens(domain);
    const theme = this.planTheme(domain, lower);

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
    if (lower.includes('shop') || lower.includes('store') || lower.includes('ecommerce') || lower.includes('product') || lower.includes('cart') || lower.includes('sneaker')) {
      return 'ecommerce';
    }
    if (lower.includes('social') || lower.includes('feed') || lower.includes('post') || lower.includes('follow') || lower.includes('community')) {
      return 'social';
    }
    if (lower.includes('task') || lower.includes('todo') || lower.includes('kanban') || lower.includes('project') || lower.includes('board')) {
      return 'tasks';
    }
    if (lower.includes('fitness') || lower.includes('workout') || lower.includes('exercise') || lower.includes('gym') || lower.includes('streak')) {
      return 'fitness';
    }
    if (/\b(chat|ai|gpt|llm|assistant|bot|chatbot)\b/i.test(lower)) {
      return 'ai_chat';
    }
    if (lower.includes('food') || lower.includes('restaurant') || lower.includes('recipe') || lower.includes('meal') || lower.includes('delivery')) {
      return 'food';
    }
    if (lower.includes('crypto') || lower.includes('wallet') || lower.includes('bitcoin') || lower.includes('ethereum') || lower.includes('coin')) {
      return 'crypto';
    }
    if (lower.includes('doctor') || lower.includes('health') || lower.includes('medical') || lower.includes('clinic') || lower.includes('patient')) {
      return 'healthcare';
    }
    if (lower.includes('course') || lower.includes('learn') || lower.includes('school') || lower.includes('quiz') || lower.includes('tutor') || lower.includes('education')) {
      return 'education';
    }
    if (lower.includes('book') || lower.includes('reserve') || lower.includes('hotel') || lower.includes('venue') || lower.includes('ticket') || lower.includes('reservation')) {
      return 'booking';
    }
    if (/\b(music|song|songs|audio|playlist|playlists|track|tracks|album|artist|beats)\b/i.test(lower)) {
      return 'music';
    }
    if (lower.includes('trip') || lower.includes('travel') || lower.includes('flight') || lower.includes('tour') || lower.includes('destination') || lower.includes('itinerary')) {
      return 'travel';
    }
    if (lower.includes('property') || lower.includes('real estate') || lower.includes('rent') || lower.includes('house') || lower.includes('apartment') || lower.includes('realtor')) {
      return 'real_estate';
    }
    if (lower.includes('habit') || lower.includes('journal') || lower.includes('note') || lower.includes('focus') || lower.includes('routine') || lower.includes('productivity')) {
      return 'productivity';
    }
    return 'general';
  }

  private static planTheme(domain: string, lower: string) {
    void domain;
    const isDark = lower.includes('dark');
    // Brand palette for every domain (matches the product theme):
    // teal #02AFB9 primary · coral #F07067 secondary · cream #FBFADD page ·
    // deep blue #0381A8 depth · deep-sea #0A3542 dark page.
    return { primaryColor: '#02AFB9', secondaryColor: '#F07067', backgroundColor: isDark ? '#0A3542' : '#FBFADD', isDarkPreferred: isDark };
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

  private static planScreens(domain: string): ScreenPlan[] {
    const screens: ScreenPlan[] = [
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
      {
        name: 'HomeScreen',
        routeName: 'home',
        routePath: '/',
        filePath: 'lib/screens/home/home_screen.dart',
        description: 'Main dashboard view with realtime data integration and quick actions',
        isAuthProtected: true,
        widgets: ['HeaderAppBar', 'RealtimeList', 'SummaryCards', 'FloatingActionButton'],
        stateNeeds: ['AppProvider', 'SupabaseService'],
      },
      {
        name: 'DetailScreen',
        routeName: 'detail',
        routePath: '/detail/:id',
        filePath: 'lib/screens/detail/detail_screen.dart',
        description: 'Detailed view with editing, status updates and actions',
        isAuthProtected: true,
        widgets: ['HeroHeader', 'DetailsCard', 'ActionButtonBar'],
        stateNeeds: ['AppProvider'],
      },
      {
        name: 'ProfileScreen',
        routeName: 'profile',
        routePath: '/profile',
        filePath: 'lib/screens/profile/profile_screen.dart',
        description: 'User settings, avatar upload, theme switcher, and sign out',
        isAuthProtected: true,
        widgets: ['AvatarPicker', 'ProfileForm', 'ThemeSelector', 'SignOutButton'],
        stateNeeds: ['SupabaseService', 'AppProvider'],
      },
    ];

    if (domain === 'ecommerce') {
      screens.push({
        name: 'CartScreen',
        routeName: 'cart',
        routePath: '/cart',
        filePath: 'lib/screens/cart/cart_screen.dart',
        description: 'Shopping cart review and checkout flow',
        isAuthProtected: true,
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
