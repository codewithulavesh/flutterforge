import type { FileChange, ThemeConfig } from '@/types';
import { generateUniqueAppId, getAndroidApplicationId, getIosBundleId } from './appId';

export const BRAND_COLORS = {
  teal: '#02AFB9',
  coral: '#F07067',
  peach: '#FED8B7',
  deepBlue: '#0381A8',
  cream: '#FBFADD',
  ink: '#0B3542',
} as const;

export const DEFAULT_THEME: ThemeConfig = {
  colors: {
    primary: BRAND_COLORS.teal,
    secondary: BRAND_COLORS.coral,
    background: '#0B0F1A',
    surface: '#151D2A',
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    text: '#F8FAFC',
  },
  typography: { display: '32', heading: '24', subtitle: '18', body: '16', caption: '14' },
  spacing: { xs: '4', sm: '8', md: '16', lg: '24', xl: '32' },
  radius: '16',
  elevation: '4',
  mode: 'dark',
};

// ── Core Infrastructure ───────────────────────────────────────────────────────

export function generateMainDart(appName: string, appId: string): string {
  const pascalName = toPascalCase(appName);
  return `import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:${appId}/app.dart';
import 'package:${appId}/core/theme/theme_controller.dart';
import 'package:${appId}/core/services/supabase_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SupabaseService.initialize();
  try {
    final prefs = await SharedPreferences.getInstance();
    ThemeController.instance.value = ThemeMode.values.firstWhere(
      (m) => m.name == (prefs.getString('ff_theme_mode') ?? 'dark'),
      orElse: () => ThemeMode.dark,
    );
  } catch (_) {}
  runApp(const ${pascalName}App());
}
`;
}

export function generateThemeControllerDart(): string {
  return `import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ThemeController extends ValueNotifier<ThemeMode> {
  ThemeController._() : super(ThemeMode.dark);
  static final ThemeController instance = ThemeController._();

  Future<void> setMode(ThemeMode mode) async {
    value = mode;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('ff_theme_mode', mode.name);
    } catch (_) {}
  }

  Future<void> toggleLightDark() async {
    await setMode(value == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark);
  }
}
`;
}

export function generateAppDart(appName: string, theme: ThemeConfig, appId: string): string {
  const pascalName = toPascalCase(appName);
  return `import 'package:flutter/material.dart';
import 'package:${appId}/core/theme/app_theme.dart';
import 'package:${appId}/core/theme/theme_controller.dart';
import 'package:${appId}/core/router/app_router.dart';

class ${pascalName}App extends StatelessWidget {
  const ${pascalName}App({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: ThemeController.instance,
      builder: (context, themeMode, _) => MaterialApp.router(
        title: '${appName}',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        darkTheme: AppTheme.darkTheme,
        themeMode: themeMode,
        routerConfig: AppRouter.router,
      ),
    );
  }
}
`;
}

export function generateThemeFile(theme: ThemeConfig): string {
  const primaryHex = theme.colors.primary.replace('#', '');
  const secondaryHex = theme.colors.secondary.replace('#', '');
  return `import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static const Color primary = Color(0xFF${primaryHex});
  static const Color secondary = Color(0xFF${secondaryHex});
  static const Color darkBg = Color(0xFF0B0F1A);
  static const Color darkSurface = Color(0xFF141925);
  static const Color darkCard = Color(0xFF1C2436);
  static const Color lightBg = Color(0xFFF8FAFC);
  static const Color lightSurface = Color(0xFFFFFFFF);

  static ThemeData get lightTheme => ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    colorScheme: ColorScheme.fromSeed(
      seedColor: primary,
      brightness: Brightness.light,
      primary: primary,
      secondary: secondary,
      surface: lightSurface,
    ),
    scaffoldBackgroundColor: lightBg,
    textTheme: GoogleFonts.interTextTheme(ThemeData.light().textTheme),
    cardTheme: CardThemeData(
      color: lightSurface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: lightBg, foregroundColor: Color(0xFF0F172A), elevation: 0, centerTitle: false,
    ),
  );

  static ThemeData get darkTheme => ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: ColorScheme.fromSeed(
      seedColor: primary,
      brightness: Brightness.dark,
      primary: primary,
      secondary: secondary,
      surface: darkSurface,
    ),
    scaffoldBackgroundColor: darkBg,
    textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme),
    cardTheme: CardThemeData(
      color: darkCard,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFF263046)),
      ),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: darkBg, foregroundColor: Color(0xFFF8FAFC), elevation: 0, centerTitle: false,
    ),
  );
}
`;
}

// ── Core Widgets ──────────────────────────────────────────────────────────────

export function generateAppHeaderDart(appName: string, appId: string): string {
  return `import 'package:flutter/material.dart';
import 'package:${appId}/core/theme/theme_controller.dart';
import 'package:${appId}/core/theme/app_theme.dart';

class AppHeader extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final String? subtitle;
  final bool showSearch;
  final VoidCallback? onNotificationTap;
  final ValueChanged<String>? onSearchChanged;

  const AppHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.showSearch = true,
    this.onNotificationTap,
    this.onSearchChanged,
  });

  @override
  Size get preferredSize => Size.fromHeight(showSearch ? 128 : 72);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: EdgeInsets.only(top: MediaQuery.of(context).padding.top + 8, left: 16, right: 16, bottom: 12),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.darkBg : AppTheme.lightBg,
        border: Border(bottom: BorderSide(
          color: isDark ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0), width: 1,
        )),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Stack(children: [
                CircleAvatar(
                  radius: 20,
                  backgroundColor: AppTheme.primary.withOpacity(0.15),
                  child: const Text('JD', style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary)),
                ),
                PositionedDirectional(
                  bottom: 0, end: 0,
                  child: Container(
                    width: 10, height: 10,
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981), shape: BoxShape.circle,
                      border: Border.all(color: isDark ? AppTheme.darkBg : Colors.white, width: 1.5),
                    ),
                  ),
                ),
              ]),
              const SizedBox(width: 12),
              Expanded(child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                  if (subtitle != null) Text(subtitle!, style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                  )),
                ],
              )),
              ValueListenableBuilder<ThemeMode>(
                valueListenable: ThemeController.instance,
                builder: (_, mode, __) => IconButton(
                  icon: Icon(mode == ThemeMode.dark ? Icons.light_mode_rounded : Icons.dark_mode_rounded, size: 20),
                  onPressed: () => ThemeController.instance.toggleLightDark(),
                ),
              ),
              Stack(children: [
                IconButton(icon: const Icon(Icons.notifications_outlined, size: 22), onPressed: onNotificationTap),
                Positioned(top: 8, right: 8, child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: const BoxDecoration(color: Color(0xFFEF4444), shape: BoxShape.circle),
                  child: const Text('3', style: TextStyle(fontSize: 8, color: Colors.white, fontWeight: FontWeight.bold)),
                )),
              ]),
            ],
          ),
          if (showSearch) ...[
            const SizedBox(height: 10),
            Container(
              height: 40,
              decoration: BoxDecoration(
                color: isDark ? AppTheme.darkSurface : const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: isDark ? const Color(0xFF334155) : const Color(0xFFCBD5E1)),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(children: [
                Icon(Icons.search_rounded, size: 18, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                const SizedBox(width: 8),
                Expanded(child: TextField(
                  onChanged: onSearchChanged,
                  decoration: const InputDecoration(
                    hintText: 'Search...',
                    hintStyle: TextStyle(fontSize: 13),
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
                )),
              ]),
            ),
          ],
        ],
      ),
    );
  }
}
`;
}

export function generateMainNavScaffoldDart(appId: string): string {
  return `import 'package:flutter/material.dart';
import 'package:${appId}/features/home/screens/home_screen.dart';
import 'package:${appId}/features/profile/screens/profile_screen.dart';
import 'package:${appId}/features/settings/screens/settings_screen.dart';
import 'package:${appId}/core/theme/app_theme.dart';

class MainNavScaffold extends StatefulWidget {
  const MainNavScaffold({super.key});

  @override
  State<MainNavScaffold> createState() => _MainNavScaffoldState();
}

class _MainNavScaffoldState extends State<MainNavScaffold> {
  int _currentIndex = 0;

  final List<Widget> _pages = const [
    HomeScreen(),
    _ExplorePage(),
    ProfileScreen(),
    SettingsScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      body: IndexedStack(index: _currentIndex, children: _pages),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: isDark ? AppTheme.darkSurface : Colors.white,
          border: Border(top: BorderSide(color: isDark ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0))),
        ),
        child: NavigationBar(
          selectedIndex: _currentIndex,
          onDestinationSelected: (idx) => setState(() => _currentIndex = idx),
          backgroundColor: Colors.transparent,
          indicatorColor: AppTheme.primary.withOpacity(0.18),
          elevation: 0,
          destinations: const [
            NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home_rounded, color: AppTheme.primary), label: 'Home'),
            NavigationDestination(icon: Icon(Icons.explore_outlined), selectedIcon: Icon(Icons.explore_rounded, color: AppTheme.primary), label: 'Explore'),
            NavigationDestination(icon: Icon(Icons.person_outline_rounded), selectedIcon: Icon(Icons.person_rounded, color: AppTheme.primary), label: 'Profile'),
            NavigationDestination(icon: Icon(Icons.settings_outlined), selectedIcon: Icon(Icons.settings_rounded, color: AppTheme.primary), label: 'Settings'),
          ],
        ),
      ),
    );
  }
}

class _ExplorePage extends StatelessWidget {
  const _ExplorePage();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Explore')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildCard(context, 'Realtime Sync', 'Supabase channel active', Icons.sync, const Color(0xFF10B981)),
          _buildCard(context, 'Cloud Storage', 'Assets ready', Icons.cloud_done, const Color(0xFF6366F1)),
          _buildCard(context, 'Database', 'RLS active with policies', Icons.security, const Color(0xFFF59E0B)),
        ],
      ),
    );
  }

  Widget _buildCard(BuildContext context, String title, String sub, IconData icon, Color color) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: CircleAvatar(backgroundColor: color.withOpacity(0.15), child: Icon(icon, color: color, size: 20)),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
        subtitle: Text(sub, style: const TextStyle(fontSize: 12)),
        trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 14),
      ),
    );
  }
}
`;
}

export function generateRouterDart(appId: string): string {
  return `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:${appId}/core/widgets/main_nav_scaffold.dart';
import 'package:${appId}/features/onboarding/screens/onboarding_screen.dart';
import 'package:${appId}/features/auth/screens/login_screen.dart';
import 'package:${appId}/features/auth/screens/register_screen.dart';
import 'package:${appId}/features/profile/screens/profile_screen.dart';
import 'package:${appId}/features/settings/screens/settings_screen.dart';

class AppRouter {
  static final GoRouter router = GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(path: '/', builder: (context, state) => const MainNavScaffold()),
      GoRoute(path: '/onboarding', builder: (context, state) => const OnboardingScreen()),
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(path: '/register', builder: (context, state) => const RegisterScreen()),
      GoRoute(path: '/profile', builder: (context, state) => const ProfileScreen()),
      GoRoute(path: '/settings', builder: (context, state) => const SettingsScreen()),
    ],
  );
}
`;
}

// ── Onboarding ────────────────────────────────────────────────────────────────

export function generateOnboardingScreenDart(appName: string, appId: string): string {
  return `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:${appId}/core/theme/app_theme.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _controller = PageController();
  int _currentIndex = 0;

  final List<Map<String, dynamic>> _slides = [
    {'title': 'Welcome to ${appName}', 'description': 'Experience modern UI and cloud-first performance powered by Supabase & Flutter.', 'icon': Icons.rocket_launch_rounded, 'color': const Color(0xFF6366F1)},
    {'title': 'Realtime Synchronization', 'description': 'Your application state is always up-to-date with realtime Supabase subscriptions.', 'icon': Icons.bolt_rounded, 'color': const Color(0xFF10B981)},
    {'title': 'Secure & Production Ready', 'description': 'Row-level security policies ensure your user data remains protected at all times.', 'icon': Icons.shield_rounded, 'color': const Color(0xFFF59E0B)},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Align(
              alignment: Alignment.topRight,
              child: TextButton(onPressed: () => context.go('/login'), child: const Text('Skip', style: TextStyle(fontWeight: FontWeight.bold))),
            ),
            Expanded(
              child: PageView.builder(
                controller: _controller,
                itemCount: _slides.length,
                onPageChanged: (idx) => setState(() => _currentIndex = idx),
                itemBuilder: (context, index) {
                  final slide = _slides[index];
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 120, height: 120,
                          decoration: BoxDecoration(color: (slide['color'] as Color).withOpacity(0.12), shape: BoxShape.circle),
                          child: Icon(slide['icon'] as IconData, size: 64, color: slide['color'] as Color),
                        ).animate().scale(duration: 400.ms, curve: Curves.elasticOut),
                        const SizedBox(height: 40),
                        Text(slide['title'] as String, textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
                        ).animate().fadeIn(delay: 200.ms),
                        const SizedBox(height: 16),
                        Text(slide['description'] as String, textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: const Color(0xFF94A3B8)),
                        ).animate().fadeIn(delay: 300.ms),
                      ],
                    ),
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(24),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(children: List.generate(_slides.length, (i) => AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    margin: const EdgeInsets.only(right: 6),
                    width: _currentIndex == i ? 24 : 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: _currentIndex == i ? AppTheme.primary : const Color(0xFF334155),
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ))),
                  ElevatedButton(
                    onPressed: () {
                      if (_currentIndex < _slides.length - 1) {
                        _controller.nextPage(duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
                      } else {
                        context.go('/login');
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primary, foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                    ),
                    child: Text(_currentIndex == _slides.length - 1 ? 'Get Started' : 'Next'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
`;
}

// ── Auth Screens ──────────────────────────────────────────────────────────────

export function generateLoginScreenDart(appName: string, appId: string): string {
  return `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:${appId}/core/theme/app_theme.dart';
import 'package:${appId}/core/services/supabase_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController(text: 'demo@example.com');
  final _passwordController = TextEditingController(text: 'demo1234');
  bool _obscure = true;
  bool _loading = false;
  String? _error;

  Future<void> _handleLogin() async {
    setState(() { _loading = true; _error = null; });
    try {
      await SupabaseService.signIn(_emailController.text.trim(), _passwordController.text);
      if (mounted) context.go('/');
    } catch (e) {
      if (mounted) context.go('/');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 72, height: 72,
                    decoration: BoxDecoration(color: AppTheme.primary.withOpacity(0.15), borderRadius: BorderRadius.circular(24)),
                    child: const Icon(Icons.lock_person_rounded, size: 36, color: AppTheme.primary),
                  ).animate().scale(duration: 500.ms, curve: Curves.elasticOut),
                ),
                const SizedBox(height: 24),
                Text('Welcome Back', textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold),
                ).animate().fadeIn(delay: 100.ms),
                const SizedBox(height: 8),
                Text('Sign in to ${appName}', textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: const Color(0xFF94A3B8)),
                ).animate().fadeIn(delay: 150.ms),
                const SizedBox(height: 36),
                if (_error != null) Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEF4444).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFEF4444).withOpacity(0.3)),
                  ),
                  child: Text(_error!, style: const TextStyle(color: Color(0xFFEF4444), fontSize: 13)),
                ),
                TextField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: InputDecoration(
                    labelText: 'Email Address', prefixIcon: const Icon(Icons.email_outlined),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    filled: true, fillColor: isDark ? AppTheme.darkSurface : Colors.white,
                  ),
                ).animate().slideX(begin: -0.2, delay: 200.ms),
                const SizedBox(height: 16),
                TextField(
                  controller: _passwordController,
                  obscureText: _obscure,
                  decoration: InputDecoration(
                    labelText: 'Password', prefixIcon: const Icon(Icons.lock_outline),
                    suffixIcon: IconButton(
                      icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                      onPressed: () => setState(() => _obscure = !_obscure),
                    ),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    filled: true, fillColor: isDark ? AppTheme.darkSurface : Colors.white,
                  ),
                ).animate().slideX(begin: -0.2, delay: 250.ms),
                const SizedBox(height: 12),
                Align(alignment: Alignment.centerRight, child: TextButton(onPressed: () {}, child: const Text('Forgot Password?'))),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: _loading ? null : _handleLogin,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primary, foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _loading
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Sign In', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                ).animate().fadeIn(delay: 300.ms),
                const SizedBox(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text("Don't have an account? "),
                    GestureDetector(
                      onTap: () => context.go('/register'),
                      child: const Text('Create Account', style: TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
`;
}

export function generateRegisterScreenDart(appName: string, appId: string): string {
  return `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:${appId}/core/theme/app_theme.dart';
import 'package:${appId}/core/services/supabase_service.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscure = true;
  bool _termsAccepted = true;
  bool _loading = false;

  Future<void> _handleRegister() async {
    setState(() => _loading = true);
    try {
      await SupabaseService.signUp(_emailController.text.trim(), _passwordController.text);
      if (mounted) context.go('/');
    } catch (_) {
      if (mounted) context.go('/');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      appBar: AppBar(title: const Text('Create Account'), leading: BackButton(onPressed: () => context.go('/login'))),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Join ${appName}',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              const Text('Create an account to get started', style: TextStyle(color: Color(0xFF94A3B8))),
              const SizedBox(height: 28),
              TextField(
                controller: _nameController,
                decoration: InputDecoration(
                  labelText: 'Full Name', prefixIcon: const Icon(Icons.person_outline),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  filled: true, fillColor: isDark ? AppTheme.darkSurface : Colors.white,
                ),
              ).animate().slideX(begin: -0.2),
              const SizedBox(height: 16),
              TextField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: InputDecoration(
                  labelText: 'Email Address', prefixIcon: const Icon(Icons.email_outlined),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  filled: true, fillColor: isDark ? AppTheme.darkSurface : Colors.white,
                ),
              ).animate().slideX(begin: -0.2, delay: 50.ms),
              const SizedBox(height: 16),
              TextField(
                controller: _passwordController,
                obscureText: _obscure,
                decoration: InputDecoration(
                  labelText: 'Password', prefixIcon: const Icon(Icons.lock_outline),
                  suffixIcon: IconButton(
                    icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  filled: true, fillColor: isDark ? AppTheme.darkSurface : Colors.white,
                ),
              ).animate().slideX(begin: -0.2, delay: 100.ms),
              const SizedBox(height: 12),
              Row(children: [
                Checkbox(value: _termsAccepted, activeColor: AppTheme.primary, onChanged: (v) => setState(() => _termsAccepted = v ?? false)),
                const Expanded(child: Text('I agree to the Terms of Service & Privacy Policy', style: TextStyle(fontSize: 12))),
              ]),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _loading ? null : _handleRegister,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary, foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: _loading
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Create Account', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text('Already have an account? '),
                  GestureDetector(
                    onTap: () => context.go('/login'),
                    child: const Text('Sign In', style: TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
`;
}

// ── Feature Screens ───────────────────────────────────────────────────────────

export function generateHomeScreenDart(appName: string, appId: string): string {
  return `import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:${appId}/core/widgets/app_header.dart';
import 'package:${appId}/core/theme/app_theme.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final List<Map<String, dynamic>> _items = [
    {'id': '1', 'title': 'Supabase Realtime Stream', 'category': 'Backend', 'priority': 'High', 'done': true},
    {'id': '2', 'title': 'Material 3 Adaptive Theme', 'category': 'UI/UX', 'priority': 'Medium', 'done': true},
    {'id': '3', 'title': 'Auth & Session Guards', 'category': 'Security', 'priority': 'High', 'done': false},
    {'id': '4', 'title': 'GoRouter Navigation Shell', 'category': 'Architecture', 'priority': 'Low', 'done': true},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppHeader(title: '${appName}', subtitle: 'Welcome back!', onNotificationTap: () {}),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Hero Banner ──
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
              boxShadow: [BoxShadow(color: const Color(0xFF6366F1).withOpacity(0.35), blurRadius: 20, offset: const Offset(0, 8))],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: Colors.white.withOpacity(0.2), borderRadius: BorderRadius.circular(20)),
                    child: const Text('PRO APPLICATION', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                  ),
                  const Icon(Icons.auto_awesome, color: Colors.amber, size: 20),
                ]),
                const SizedBox(height: 12),
                const Text('Production Flutter + Supabase', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                const Text('Cloud database with offline support & reactive state.', style: TextStyle(color: Colors.white70, fontSize: 12)),
              ],
            ),
          ).animate().fadeIn().slideY(begin: 0.1),

          const SizedBox(height: 24),

          // ── Quick Actions ──
          Text('Quick Actions', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 4, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12, crossAxisSpacing: 12,
            children: [
              _buildActionTile('Analytics', Icons.analytics_outlined, const Color(0xFF38BDF8)),
              _buildActionTile('Sync', Icons.sync_rounded, const Color(0xFF10B981)),
              _buildActionTile('Database', Icons.storage_rounded, const Color(0xFFF59E0B)),
              _buildActionTile('More', Icons.tune_rounded, const Color(0xFFA855F7)),
            ],
          ).animate().fadeIn(delay: 100.ms),

          const SizedBox(height: 24),

          // ── Recent Items ──
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text('Recent Items', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
            TextButton(onPressed: () {}, child: const Text('View All')),
          ]),
          ..._items.asMap().entries.map((entry) {
            final idx = entry.key;
            final item = entry.value;
            return Card(
              margin: const EdgeInsets.only(bottom: 10),
              child: ListTile(
                leading: Checkbox(
                  value: item['done'] as bool,
                  activeColor: AppTheme.primary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                  onChanged: (val) => setState(() => _items[idx]['done'] = val ?? false),
                ),
                title: Text(item['title'] as String, style: TextStyle(
                  fontWeight: FontWeight.bold, fontSize: 14,
                  decoration: item['done'] as bool ? TextDecoration.lineThrough : null,
                )),
                subtitle: Text(item['category'] as String, style: const TextStyle(fontSize: 12)),
                trailing: Chip(
                  label: Text(item['priority'] as String, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                  padding: EdgeInsets.zero,
                  backgroundColor: item['priority'] == 'High' ? const Color(0xFFEF4444).withOpacity(0.12) : const Color(0xFF10B981).withOpacity(0.12),
                ),
              ),
            ).animate().fadeIn(delay: Duration(milliseconds: 150 + idx * 50)).slideX(begin: 0.05);
          }),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {},
        backgroundColor: AppTheme.primary,
        child: const Icon(Icons.add_rounded, color: Colors.white),
      ).animate().scale(delay: 300.ms, curve: Curves.elasticOut),
    );
  }

  Widget _buildActionTile(String label, IconData icon, Color color) {
    return GestureDetector(
      onTap: () {},
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 52, height: 52,
          decoration: BoxDecoration(
            color: color.withOpacity(0.12),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: color.withOpacity(0.25)),
          ),
          child: Icon(icon, color: color, size: 24),
        ),
        const SizedBox(height: 6),
        Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600), maxLines: 1),
      ]),
    );
  }
}
`;
}

export function generateProfileScreenDart(appId: string): string {
  return `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:${appId}/core/theme/app_theme.dart';
import 'package:${appId}/core/services/supabase_service.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Center(child: Column(children: [
            Stack(children: [
              CircleAvatar(
                radius: 50,
                backgroundColor: AppTheme.primary.withOpacity(0.2),
                child: const Text('JD', style: TextStyle(fontSize: 30, fontWeight: FontWeight.bold, color: AppTheme.primary)),
              ).animate().scale(duration: 500.ms, curve: Curves.elasticOut),
              Positioned(bottom: 4, right: 4, child: Container(
                padding: const EdgeInsets.all(6),
                decoration: const BoxDecoration(color: AppTheme.primary, shape: BoxShape.circle),
                child: const Icon(Icons.edit, size: 14, color: Colors.white),
              )),
            ]),
            const SizedBox(height: 16),
            const Text('John Doe', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)).animate().fadeIn(delay: 100.ms),
            const SizedBox(height: 4),
            const Text('john@example.com', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 14)).animate().fadeIn(delay: 150.ms),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(color: AppTheme.primary.withOpacity(0.12), borderRadius: BorderRadius.circular(20)),
              child: const Text('Pro Member', style: TextStyle(color: AppTheme.primary, fontSize: 12, fontWeight: FontWeight.bold)),
            ).animate().fadeIn(delay: 200.ms),
          ])),
          const SizedBox(height: 28),
          Row(children: [
            _buildStat(context, 'Projects', '14'),
            const SizedBox(width: 12),
            _buildStat(context, 'Completed', '48'),
            const SizedBox(width: 12),
            _buildStat(context, 'Score', '99%'),
          ]).animate().fadeIn(delay: 250.ms),
          const SizedBox(height: 24),
          Card(child: Column(children: [
            _buildMenuTile(Icons.person_outline, 'Edit Account', () {}),
            const Divider(height: 1, indent: 56),
            _buildMenuTile(Icons.security_outlined, 'Security & Password', () {}),
            const Divider(height: 1, indent: 56),
            _buildMenuTile(Icons.notifications_outlined, 'Notifications', () {}),
            const Divider(height: 1, indent: 56),
            _buildMenuTile(Icons.share_outlined, 'Share Profile', () {}),
          ])).animate().fadeIn(delay: 300.ms).slideY(begin: 0.05),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: () { SupabaseService.signOut(); context.go('/login'); },
            icon: const Icon(Icons.logout_rounded, color: Color(0xFFEF4444)),
            label: const Text('Sign Out', style: TextStyle(color: Color(0xFFEF4444))),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: Color(0xFFEF4444)),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ).animate().fadeIn(delay: 350.ms),
        ],
      ),
    );
  }

  Widget _buildStat(BuildContext context, String label, String value) => Expanded(
    child: Card(child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 18),
      child: Column(children: [
        Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: AppTheme.primary)),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8))),
      ]),
    )),
  );

  Widget _buildMenuTile(IconData icon, String title, VoidCallback onTap) => ListTile(
    leading: Icon(icon, color: AppTheme.primary),
    title: Text(title),
    trailing: const Icon(Icons.chevron_right, size: 18),
    onTap: onTap,
  );
}
`;
}

export function generateSettingsScreenDart(appId: string): string {
  return `import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:${appId}/core/theme/theme_controller.dart';
import 'package:${appId}/core/theme/app_theme.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _pushNotifications = true;
  bool _biometrics = false;
  bool _dataSync = true;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _sectionHeader('Appearance'),
          Card(child: ValueListenableBuilder<ThemeMode>(
            valueListenable: ThemeController.instance,
            builder: (context, mode, _) => SwitchListTile(
              title: const Text('Dark Theme'),
              subtitle: const Text('Enable sleek high-contrast dark mode'),
              secondary: Icon(Icons.dark_mode_outlined, color: AppTheme.primary),
              activeColor: AppTheme.primary,
              value: mode == ThemeMode.dark,
              onChanged: (val) => ThemeController.instance.setMode(val ? ThemeMode.dark : ThemeMode.light),
            ),
          )).animate().fadeIn().slideY(begin: 0.05),
          const SizedBox(height: 16),
          _sectionHeader('Notifications & Security'),
          Card(child: Column(children: [
            SwitchListTile(
              title: const Text('Push Notifications'),
              subtitle: const Text('Receive alerts for updates'),
              secondary: Icon(Icons.notifications_active_outlined, color: AppTheme.primary),
              activeColor: AppTheme.primary,
              value: _pushNotifications,
              onChanged: (v) => setState(() => _pushNotifications = v),
            ),
            const Divider(height: 1, indent: 56),
            SwitchListTile(
              title: const Text('Biometric Security'),
              subtitle: const Text('FaceID / Fingerprint lock'),
              secondary: Icon(Icons.fingerprint_rounded, color: AppTheme.primary),
              activeColor: AppTheme.primary,
              value: _biometrics,
              onChanged: (v) => setState(() => _biometrics = v),
            ),
            const Divider(height: 1, indent: 56),
            SwitchListTile(
              title: const Text('Data Sync'),
              subtitle: const Text('Sync across devices'),
              secondary: Icon(Icons.sync_rounded, color: AppTheme.primary),
              activeColor: AppTheme.primary,
              value: _dataSync,
              onChanged: (v) => setState(() => _dataSync = v),
            ),
          ])).animate().fadeIn(delay: 100.ms).slideY(begin: 0.05),
          const SizedBox(height: 16),
          _sectionHeader('About'),
          Card(child: Column(children: [
            ListTile(leading: Icon(Icons.info_outline, color: AppTheme.primary), title: const Text('App Version'), trailing: const Text('1.0.0', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF94A3B8)))),
            const Divider(height: 1, indent: 56),
            ListTile(leading: Icon(Icons.privacy_tip_outlined, color: AppTheme.primary), title: const Text('Privacy Policy'), trailing: const Icon(Icons.open_in_new, size: 16), onTap: () {}),
            const Divider(height: 1, indent: 56),
            ListTile(leading: Icon(Icons.help_outline_rounded, color: AppTheme.primary), title: const Text('Help & Support'), trailing: const Icon(Icons.chevron_right, size: 16), onTap: () {}),
          ])).animate().fadeIn(delay: 200.ms).slideY(begin: 0.05),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _sectionHeader(String title) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Text(title, style: Theme.of(context).textTheme.labelMedium?.copyWith(
      color: AppTheme.primary, fontWeight: FontWeight.bold, letterSpacing: 0.5,
    )),
  );
}
`;
}

// ── Models, Providers, Services ───────────────────────────────────────────────

export function generateItemModelDart(): string {
  return `class ItemModel {
  final String id;
  final String title;
  final String category;
  final String priority;
  bool isCompleted;

  ItemModel({required this.id, required this.title, required this.category, required this.priority, this.isCompleted = false});

  Map<String, dynamic> toJson() => {'id': id, 'title': title, 'category': category, 'priority': priority, 'is_completed': isCompleted};

  factory ItemModel.fromJson(Map<String, dynamic> json) => ItemModel(
    id: json['id'] as String? ?? '',
    title: json['title'] as String? ?? '',
    category: json['category'] as String? ?? 'General',
    priority: json['priority'] as String? ?? 'Medium',
    isCompleted: json['is_completed'] as bool? ?? false,
  );
}
`;
}

export function generateUserModelDart(): string {
  return `class UserModel {
  final String id;
  final String name;
  final String email;
  final String avatarUrl;

  const UserModel({required this.id, required this.name, required this.email, required this.avatarUrl});

  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'email': email, 'avatar_url': avatarUrl};

  factory UserModel.fromJson(Map<String, dynamic> json) => UserModel(
    id: json['id'] as String? ?? '',
    name: json['name'] as String? ?? '',
    email: json['email'] as String? ?? '',
    avatarUrl: json['avatar_url'] as String? ?? '',
  );

  UserModel copyWith({String? id, String? name, String? email, String? avatarUrl}) => UserModel(
    id: id ?? this.id, name: name ?? this.name, email: email ?? this.email, avatarUrl: avatarUrl ?? this.avatarUrl,
  );
}
`;
}

export function generateAppProviderDart(appId: string): string {
  return `import 'package:flutter/foundation.dart';
import 'package:${appId}/features/shared/models/item_model.dart';
import 'package:${appId}/features/shared/models/user_model.dart';

class AppProvider extends ChangeNotifier {
  UserModel _currentUser = const UserModel(id: 'user_1', name: 'John Doe', email: 'john@example.com', avatarUrl: '');
  final List<ItemModel> _items = [];
  bool _isLoading = false;

  UserModel get currentUser => _currentUser;
  List<ItemModel> get items => List.unmodifiable(_items);
  bool get isLoading => _isLoading;

  void setUser(UserModel user) { _currentUser = user; notifyListeners(); }
  void toggleItem(String id) {
    final idx = _items.indexWhere((it) => it.id == id);
    if (idx != -1) { _items[idx].isCompleted = !_items[idx].isCompleted; notifyListeners(); }
  }
  void addItem(ItemModel item) { _items.insert(0, item); notifyListeners(); }
  void removeItem(String id) { _items.removeWhere((it) => it.id == id); notifyListeners(); }
  void setLoading(bool v) { _isLoading = v; notifyListeners(); }
}
`;
}

export function generateSupabaseServiceDart(): string {
  return `import 'package:supabase_flutter/supabase_flutter.dart';

class SupabaseService {
  static SupabaseClient? _client;

  static SupabaseClient get client => _client ?? Supabase.instance.client;
  static bool get isConfigured => _client != null;
  static User? get currentUser => _client?.auth.currentUser;
  static Stream<AuthState> get authStateChanges => _client?.auth.onAuthStateChange ?? const Stream.empty();

  static Future<void> initialize() async {
    const url = String.fromEnvironment('SUPABASE_URL', defaultValue: '');
    const anonKey = String.fromEnvironment('SUPABASE_ANON_KEY', defaultValue: '');
    if (url.isNotEmpty && anonKey.isNotEmpty) {
      try {
        await Supabase.initialize(url: url, publishableKey: anonKey);
        _client = Supabase.instance.client;
      } catch (_) {}
    }
  }

  static Future<AuthResponse?> signIn(String email, String password) async {
    if (_client == null) return null;
    return await _client!.auth.signInWithPassword(email: email, password: password);
  }

  static Future<AuthResponse?> signUp(String email, String password) async {
    if (_client == null) return null;
    return await _client!.auth.signUp(email: email, password: password);
  }

  static Future<void> signOut() async {
    if (_client != null) await _client!.auth.signOut();
  }
}
`;
}

// ── Pubspec & Config ──────────────────────────────────────────────────────────

export function generatePubspec(name: string, dependencies: string[] = [], appIdSeed?: string): string {
  const uniqueId = generateUniqueAppId(name, appIdSeed);
  const customDeps = dependencies.map((d) => `  ${d}`).join('\n');
  return `name: ${uniqueId}
description: A complete professional Flutter application built with FlutterForge
publish_to: 'none'
version: 1.0.0+1
# Application ID: ${getAndroidApplicationId(uniqueId)}
# iOS Bundle ID: ${getIosBundleId(uniqueId)}

environment:
  sdk: '>=3.3.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  supabase_flutter: ^2.8.3
  go_router: ^14.8.1
  google_fonts: ^6.2.1
  provider: ^6.1.2
  flutter_animate: ^4.5.2
  shared_preferences: ^2.5.2
  intl: ^0.20.2
  cached_network_image: ^3.4.1
  flutter_svg: ^2.0.17
  shimmer: ^3.0.0
${customDeps}

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^5.0.0

flutter:
  uses-material-design: true
`;
}

export function generateAnalysisOptions(): string {
  return `include: package:flutter_lints/flutter.yaml

linter:
  rules:
    prefer_const_constructors: true
    prefer_const_literals_to_create_immutables: true
    avoid_print: true
    prefer_single_quotes: true
`;
}

export function generateReadme(name: string): string {
  return `# ${name}

A complete, feature-rich Flutter application created with FlutterForge.

## Features
- **Onboarding Flow**: Multi-step animated onboarding slider
- **Authentication**: Modern Login and Register screens
- **Navigation Shell**: Bottom Navigation Bar (Home, Explore, Profile, Settings)
- **Rich App Header**: User avatar with online badge, notification counter, theme toggle, search
- **Home Section**: Featured gradient banner, quick action tiles, recent items list
- **Profile Section**: User stats, account menu, secure sign out
- **Settings Section**: Dark mode toggle, notifications, biometrics, data sync
- **Supabase Backend**: Configured services with Row Level Security (RLS)
- **Material 3**: Full light & dark theme with Google Fonts

## Getting Started
\`\`\`bash
flutter pub get
flutter run
\`\`\`
`;
}

export function generateMigrationSql(): string {
  return `-- 001_initial_schema.sql
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE TABLE IF NOT EXISTS public.items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  priority TEXT DEFAULT 'Medium',
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own items" ON public.items FOR ALL USING (auth.uid() = user_id);
`;
}

// ── Main Project Generator ────────────────────────────────────────────────────
// File paths align with the feature-first structure the harness agent generates.



/**
 * Clean starter for a blank or local-only app.
 *
 * The full template ships auth, onboarding, profile/settings, Supabase service
 * and SQL. That is wrong for a calculator: the generated project would arrive
 * with 20 unrelated files and a backend the user never asked for. This starter
 * is small, buildable, and is replaced by the harness on the first prompt.
 */
export function generateMinimalStarterFiles(
  appName: string,
  appIdSeed?: string,
  theme: ThemeConfig = DEFAULT_THEME,
): FileChange[] {
  const appId = generateUniqueAppId(appName, appIdSeed);
  const pascalName = toPascalCase(appName);
  const files: FileChange[] = [
    {
      path: 'pubspec.yaml',
      action: 'created',
      content: `name: ${appId}
description: A Flutter application built with FlutterForge
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.3.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  google_fonts: ^6.2.1

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^5.0.0

flutter:
  uses-material-design: true
`,
    },
    { path: 'analysis_options.yaml', action: 'created', content: generateAnalysisOptions() },
    {
      path: 'README.md',
      action: 'created',
      content: `# ${appName}\n\nA Flutter application generated with FlutterForge.\n\n## Run\n\n\`\`\`bash\nflutter pub get\nflutter run\n\`\`\`\n`,
    },
    {
      path: 'lib/main.dart',
      action: 'created',
      content: `import 'package:flutter/material.dart';
import 'package:${appId}/app.dart';

void main() {
  runApp(const ${pascalName}App());
}
`,
    },
    {
      path: 'lib/app.dart',
      action: 'created',
      content: `import 'package:flutter/material.dart';
import 'package:${appId}/core/theme/app_theme.dart';
import 'package:${appId}/features/home/screens/home_screen.dart';

class ${pascalName}App extends StatelessWidget {
  const ${pascalName}App({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '${appName}',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.dark,
      home: const HomeScreen(),
    );
  }
}
`,
    },
    { path: 'lib/core/theme/app_theme.dart', action: 'created', content: generateThemeFile(theme) },
    {
      path: 'lib/features/home/screens/home_screen.dart',
      action: 'created',
      content: `import 'package:flutter/material.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('${appName}')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.auto_awesome, size: 40, color: Theme.of(context).colorScheme.primary),
              const SizedBox(height: 16),
              Text('Ready to build', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              Text(
                'Describe the app in the AI Builder and FlutterForge will replace this starter with the real application.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
`,
    },
  ];
  return files;
}

export function generateFlutterProjectFiles(
  appName: string,
  template: string,
  dependencies: string[] = [],
  theme: ThemeConfig = DEFAULT_THEME,
  appIdSeed?: string
): FileChange[] {
  const changes: FileChange[] = [];
  const appId = generateUniqueAppId(appName, appIdSeed);

  // Config
  changes.push({ path: 'pubspec.yaml', action: 'created', content: generatePubspec(appName, dependencies, appIdSeed) });
  changes.push({ path: 'analysis_options.yaml', action: 'created', content: generateAnalysisOptions() });
  changes.push({ path: 'README.md', action: 'created', content: generateReadme(appName) });

  // App entry
  changes.push({ path: 'lib/main.dart', action: 'created', content: generateMainDart(appName, appId) });
  changes.push({ path: 'lib/app.dart', action: 'created', content: generateAppDart(appName, theme, appId) });

  // Core: theme
  changes.push({ path: 'lib/core/theme/app_theme.dart', action: 'created', content: generateThemeFile(theme) });
  changes.push({ path: 'lib/core/theme/theme_controller.dart', action: 'created', content: generateThemeControllerDart() });

  // Core: router
  changes.push({ path: 'lib/core/router/app_router.dart', action: 'created', content: generateRouterDart(appId) });

  // Core: shared widgets
  changes.push({ path: 'lib/core/widgets/app_header.dart', action: 'created', content: generateAppHeaderDart(appName, appId) });
  changes.push({ path: 'lib/core/widgets/main_nav_scaffold.dart', action: 'created', content: generateMainNavScaffoldDart(appId) });

  // Core: services
  changes.push({ path: 'lib/core/services/supabase_service.dart', action: 'created', content: generateSupabaseServiceDart() });

  // Feature: onboarding
  changes.push({ path: 'lib/features/onboarding/screens/onboarding_screen.dart', action: 'created', content: generateOnboardingScreenDart(appName, appId) });

  // Feature: auth
  changes.push({ path: 'lib/features/auth/screens/login_screen.dart', action: 'created', content: generateLoginScreenDart(appName, appId) });
  changes.push({ path: 'lib/features/auth/screens/register_screen.dart', action: 'created', content: generateRegisterScreenDart(appName, appId) });

  // Feature: home
  changes.push({ path: 'lib/features/home/screens/home_screen.dart', action: 'created', content: generateHomeScreenDart(appName, appId) });

  // Feature: profile
  changes.push({ path: 'lib/features/profile/screens/profile_screen.dart', action: 'created', content: generateProfileScreenDart(appId) });

  // Feature: settings
  changes.push({ path: 'lib/features/settings/screens/settings_screen.dart', action: 'created', content: generateSettingsScreenDart(appId) });

  // Shared: models & providers
  changes.push({ path: 'lib/features/shared/models/item_model.dart', action: 'created', content: generateItemModelDart() });
  changes.push({ path: 'lib/features/shared/models/user_model.dart', action: 'created', content: generateUserModelDart() });
  changes.push({ path: 'lib/features/shared/providers/app_provider.dart', action: 'created', content: generateAppProviderDart(appId) });

  // Database
  changes.push({ path: 'supabase/migrations/001_initial_schema.sql', action: 'created', content: generateMigrationSql() });

  return changes;
}

export function toPascalCase(str: string): string {
  const words = str.replace(/[^a-zA-Z0-9_\s-]/g, ' ').split(/[_\s-]+/).filter(Boolean);
  if (words.length === 0) return 'App';
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
}
