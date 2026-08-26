import type { FileChange, ThemeConfig } from '@/types';

export const DEFAULT_THEME: ThemeConfig = {
  colors: {
    primary: '#3B82F6',
    secondary: '#8B5CF6',
    background: '#FFFFFF',
    surface: '#F9FAFB',
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    text: '#111827',
  },
  typography: {
    display: '32',
    heading: '24',
    subtitle: '18',
    body: '16',
    caption: '14',
  },
  spacing: {
    xs: '4',
    sm: '8',
    md: '16',
    lg: '24',
    xl: '32',
  },
  radius: '12',
  elevation: '4',
  mode: 'light',
};

export function generateMainDart(appName: string): string {
  const pascalName = toPascalCase(appName);
  return `import 'package:flutter/material.dart';
import 'app.dart';

void main() {
  runApp(${pascalName}App());
}
`;
}

export function generateAppDart(appName: string, theme: ThemeConfig): string {
  const pascalName = toPascalCase(appName);
  const isDark = theme.mode === 'dark';
  return `import 'package:flutter/material.dart';
import 'core/theme/app_theme.dart';
import 'core/router/app_router.dart';

class ${pascalName}App extends StatelessWidget {
  const ${pascalName}App({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: '${appName}',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.${isDark ? 'dark' : 'light'},
      routerConfig: AppRouter.router,
    );
  }
}
`;
}

export function generateThemeFile(theme: ThemeConfig): string {
  return `import 'package:flutter/material.dart';

class AppTheme {
  static const Color primary = Color(0xFF${theme.colors.primary.replace('#', '')});
  static const Color secondary = Color(0xFF${theme.colors.secondary.replace('#', '')});
  static const Color background = Color(0xFF${theme.colors.background.replace('#', '')});
  static const Color surface = Color(0xFF${theme.colors.surface.replace('#', '')});
  static const Color error = Color(0xFF${theme.colors.error.replace('#', '')});
  static const Color success = Color(0xFF${theme.colors.success.replace('#', '')});
  static const Color warning = Color(0xFF${theme.colors.warning.replace('#', '')});
  static const Color text = Color(0xFF${theme.colors.text.replace('#', '')});

  static ThemeData get lightTheme => ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: primary,
      brightness: Brightness.light,
    ),
    scaffoldBackgroundColor: background,
    cardColor: surface,
    appBarTheme: AppBarTheme(
      backgroundColor: background,
      foregroundColor: text,
      elevation: 0,
      centerTitle: false,
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(${theme.radius}),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(${theme.radius}),
        borderSide: BorderSide.none,
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    ),
    cardTheme: CardTheme(
      elevation: ${theme.elevation},
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(${theme.radius}),
      ),
      color: surface,
    ),
  );

  static ThemeData get darkTheme => ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: primary,
      brightness: Brightness.dark,
    ),
    scaffoldBackgroundColor: const Color(0xFF111827),
    cardColor: const Color(0xFF1F2937),
    appBarTheme: const AppBarTheme(
      backgroundColor: Color(0xFF111827),
      foregroundColor: Colors.white,
      elevation: 0,
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(${theme.radius}),
        ),
      ),
    ),
  );
}
`;
}

export function generateRouter(screens: string[]): string {
  const routes = screens.map((s) => {
    const pascal = toPascalCase(s);
    const snake = toSnakeCase(s);
    return `  static final routes = [
    GoRoute(
      path: '/${snake}',
      name: '${snake}',
      builder: (context, state) => const ${pascal}Screen(),
    ),`;
  }).join('\n');

  return `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
${screens.map((s) => `import '../screens/${toSnakeCase(s)}/${toSnakeCase(s)}_screen.dart';`).join('\n')}

class AppRouter {
${routes}
  ];

  static GoRouter get router => GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const Scaffold(
          body: Center(child: Text('Home')),
        ),
      ),
      ...routes,
    ],
  );
}
`;
}

export function generateScreen(name: string, theme: ThemeConfig): string {
  const pascal = toPascalCase(name);
  const snake = toSnakeCase(name);
  return `import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

class ${pascal}Screen extends StatelessWidget {
  const ${pascal}Screen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('${pascal}'),
      ),
      body: Center(
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.widgets,
                  size: 48,
                  color: AppTheme.primary,
                ),
                const SizedBox(height: 16),
                Text(
                  '${pascal} Screen',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                Text(
                  'This screen was generated by FlutterForge',
                  style: Theme.of(context).textTheme.bodyMedium,
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

export function generatePubspec(name: string, dependencies: string[] = []): string {
  const snake = toSnakeCase(name);
  const deps = dependencies.map((d) => `  ${d}`).join('\n');
  return `name: ${snake}
description: A Flutter application generated by FlutterForge
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  go_router: ^14.0.0
${deps}

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^4.0.0

flutter:
  uses-material-design: true
  assets:
    - assets/images/
    - assets/icons/
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

A Flutter application generated by FlutterForge.

## Getting Started

\`\`\`bash
flutter pub get
flutter run
\`\`\`

## Build

\`\`\`bash
flutter build web
\`\`\`

## Generated by FlutterForge

This project was created using [FlutterForge](https://flutterforge.app) - AI-powered Flutter app generation.
`;
}

export function generateFlutterProjectFiles(
  appName: string,
  template: string,
  screens: string[] = ['home'],
  dependencies: string[] = [],
  theme: ThemeConfig = DEFAULT_THEME
): FileChange[] {
  const changes: FileChange[] = [];

  changes.push({
    path: 'lib/main.dart',
    action: 'created',
    content: generateMainDart(appName),
  });
  changes.push({
    path: 'lib/app.dart',
    action: 'created',
    content: generateAppDart(appName, theme),
  });
  changes.push({
    path: 'lib/core/theme/app_theme.dart',
    action: 'created',
    content: generateThemeFile(theme),
  });
  changes.push({
    path: 'lib/core/router/app_router.dart',
    action: 'created',
    content: generateRouter(screens),
  });

  for (const screen of screens) {
    changes.push({
      path: `lib/screens/${toSnakeCase(screen)}/${toSnakeCase(screen)}_screen.dart`,
      action: 'created',
      content: generateScreen(screen, theme),
    });
  }

  changes.push({
    path: 'pubspec.yaml',
    action: 'created',
    content: generatePubspec(appName, dependencies),
  });
  changes.push({
    path: 'analysis_options.yaml',
    action: 'created',
    content: generateAnalysisOptions(),
  });
  changes.push({
    path: 'README.md',
    action: 'created',
    content: generateReadme(appName),
  });

  return changes;
}

function toPascalCase(str: string): string {
  return str
    .split(/[_\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(/[\s_-]+/)
    .map((w) => w.toLowerCase())
    .join('_');
}

export { toPascalCase, toSnakeCase };
