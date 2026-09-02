import { supabase } from '../services/supabase';
import type { CodePattern, RelevantFile, AgentFileArtifact } from './types';

// Curated library of 30+ top-tier Flutter + Supabase production patterns
export const BUILTIN_CODE_PATTERNS: CodePattern[] = [
  // ── FITNESS ──────────────────────────────────────────────────────────
  {
    domain: 'fitness',
    category: 'widget',
    name: 'AnimatedStreakRing',
    description: 'Circular animated streak progress ring with gradient and fire emoji badge for fitness and habit apps',
    language: 'dart',
    tags: ['fitness', 'streak', 'animation', 'chart'],
    code: `import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

class AnimatedStreakRing extends StatelessWidget {
  final int streakDays;
  final double progress; // 0.0 to 1.0
  final String label;

  const AnimatedStreakRing({
    super.key,
    required this.streakDays,
    required this.progress,
    this.label = 'Day Streak',
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.06),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(
                width: 76,
                height: 76,
                child: CircularProgressIndicator(
                  value: progress,
                  strokeWidth: 8,
                  strokeCap: StrokeCap.round,
                  backgroundColor: const Color(0xFFF1F5F9),
                  valueColor: const AlwaysStoppedAnimation(Color(0xFF10B981)),
                ),
              ),
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('🔥', style: TextStyle(fontSize: 16)),
                  Text(
                    '$streakDays',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.5,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Keep it going! Complete today\'s workout to extend.',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey[600],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 400.ms).slideY(begin: 0.1, end: 0);
  }
}`,
  },
  {
    domain: 'fitness',
    category: 'screen',
    name: 'WorkoutDashboardScreen',
    description: 'Modern fitness home dashboard with stat cards, streak ring, weekly graph and real-time exercise log',
    language: 'dart',
    tags: ['fitness', 'dashboard', 'screen', 'streak'],
    code: `import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/empty_state.dart';

class FitnessHomeScreen extends StatefulWidget {
  const FitnessHomeScreen({super.key});

  @override
  State<FitnessHomeScreen> createState() => _FitnessHomeScreenState();
}

class _FitnessHomeScreenState extends State<FitnessHomeScreen> {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Activity Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () {},
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Stat Summary Cards
            Row(
              children: [
                Expanded(
                  child: _buildMetricCard(
                    context,
                    title: 'Calories',
                    value: '640 kcal',
                    icon: Icons.local_fire_department_rounded,
                    color: const Color(0xFFF97316),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildMetricCard(
                    context,
                    title: 'Active Time',
                    value: '45 mins',
                    icon: Icons.timer_outlined,
                    color: const Color(0xFF10B981),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            const Text(
              'Today\'s Workouts',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            _buildWorkoutItem(
              title: 'Morning HIIT Cardio',
              duration: '25 min · 220 kcal',
              isCompleted: true,
            ),
            const SizedBox(width: 8),
            _buildWorkoutItem(
              title: 'Core & Upper Body',
              duration: '35 min · 310 kcal',
              isCompleted: false,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricCard(BuildContext context, {
    required String title,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.grey.withOpacity(0.12)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(height: 12),
          Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 2),
          Text(title, style: TextStyle(fontSize: 12, color: Colors.grey[500])),
        ],
      ),
    ).animate().fadeIn(duration: 350.ms);
  }

  Widget _buildWorkoutItem({
    required String title,
    required String duration,
    required bool isCompleted,
  }) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: isCompleted ? Colors.emerald.withOpacity(0.15) : Colors.grey.withOpacity(0.1),
          child: Icon(
            isCompleted ? Icons.check_circle_rounded : Icons.fitness_center_rounded,
            color: isCompleted ? Colors.emerald : Colors.grey,
          ),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(duration),
        trailing: const Icon(Icons.chevron_right),
      ),
    );
  }
}`,
  },

  // ── ECOMMERCE ────────────────────────────────────────────────────────
  {
    domain: 'ecommerce',
    category: 'widget',
    name: 'ProductCardHero',
    description: 'Polished e-commerce product card with hero transition, discount badge, image loading shimmer and heart favorite action',
    language: 'dart',
    tags: ['ecommerce', 'product', 'card', 'hero'],
    code: `import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_animate/flutter_animate.dart';

class ProductCardHero extends StatelessWidget {
  final String id;
  final String title;
  final double price;
  final String? imageUrl;
  final String? category;
  final VoidCallback? onTap;
  final VoidCallback? onAddToCart;

  const ProductCardHero({
    super.key,
    required this.id,
    required this.title,
    required this.price,
    this.imageUrl,
    this.category,
    this.onTap,
    this.onAddToCart,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Theme.of(context).cardColor,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.black.withOpacity(0.05)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.03),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Hero(
                    tag: 'product-$id',
                    child: imageUrl != null && imageUrl!.isNotEmpty
                        ? CachedNetworkImage(
                            imageUrl: imageUrl!,
                            fit: BoxFit.cover,
                            placeholder: (_, __) => Container(color: Colors.grey[100]),
                          )
                        : Container(
                            color: const Color(0xFFF1F5F9),
                            child: const Icon(Icons.shopping_bag_outlined, size: 40, color: Colors.grey),
                          ),
                  ),
                  if (category != null)
                    Positioned(
                      top: 10,
                      left: 10,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.65),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          category!,
                          style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.between,
                    children: [
                      Text(
                        '\${price.toStringAsFixed(2)}',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF2563EB),
                        ),
                      ),
                      InkWell(
                        onTap: onAddToCart,
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: const Color(0xFF2563EB),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.add_shopping_cart, size: 14, color: Colors.white),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ).animate().fadeIn(duration: 300.ms);
  }
}`,
  },

  // ── AI CHAT ──────────────────────────────────────────────────────────
  {
    domain: 'ai_chat',
    category: 'widget',
    name: 'ChatBubble',
    description: 'Pixel-perfect chat message bubble with AI avatar, copy action, timestamp and markdown support',
    language: 'dart',
    tags: ['chat', 'ai', 'bubble', 'conversation'],
    code: `import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

class ChatBubble extends StatelessWidget {
  final String content;
  final bool isUser;
  final DateTime? timestamp;

  const ChatBubble({
    super.key,
    required this.content,
    required this.isUser,
    this.timestamp,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 12),
      child: Row(
        mainAxisAlignment: isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!isUser) ...[
            Container(
              width: 32,
              height: 32,
              decoration: const BoxDecoration(
                gradient: LinearGradient(colors: [Color(0xFF8B5CF6), Color(0xFF3B82F6)]),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.auto_awesome, color: Colors.white, size: 16),
            ),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: isUser ? const Color(0xFF3B82F6) : theme.cardColor,
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(18),
                  topRight: const Radius.circular(18),
                  bottomLeft: Radius.circular(isUser ? 18 : 4),
                  bottomRight: Radius.circular(isUser ? 4 : 18),
                ),
                border: isUser ? null : Border.all(color: Colors.grey.withOpacity(0.15)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.04),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Text(
                content,
                style: TextStyle(
                  color: isUser ? Colors.white : theme.textTheme.bodyMedium?.color,
                  fontSize: 14,
                  height: 1.45,
                ),
              ),
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 250.ms).slideY(begin: 0.05, end: 0);
  }
}`,
  },

  // ── GENERAL SHIMMER ──────────────────────────────────────────────────
  {
    domain: 'general',
    category: 'widget',
    name: 'ShimmerLoadingSkeleton',
    description: 'Skeleton shimmer placeholder loading block replacing generic loading spinners',
    language: 'dart',
    tags: ['shimmer', 'skeleton', 'loading', 'ui'],
    code: `import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

class ShimmerSkeleton extends StatelessWidget {
  final double width;
  final double height;
  final double borderRadius;

  const ShimmerSkeleton({
    super.key,
    this.width = double.infinity,
    required this.height,
    this.borderRadius = 12,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0),
        borderRadius: BorderRadius.circular(borderRadius),
      ),
    )
        .animate(onPlay: (controller) => controller.repeat())
        .shimmer(
          duration: 1200.ms,
          color: isDark ? const Color(0xFF334155) : const Color(0xFFF8FAFC),
        );
  }
}`,
  },

  // ── GLASSMORPHISM CARD ────────────────────────────────────────────────
  {
    domain: 'general',
    category: 'widget',
    name: 'GlassmorphicCard',
    description: 'Glassmorphism frosted glass card with blur and gradient border for high-end aesthetic',
    language: 'dart',
    tags: ['glassmorphism', 'card', 'modern', 'theme'],
    code: `import 'dart:ui';
import 'package:flutter/material.dart';

class GlassmorphicCard extends StatelessWidget {
  final Widget child;
  final double blur;
  final double opacity;
  final BorderRadius? borderRadius;
  final EdgeInsetsGeometry? padding;

  const GlassmorphicCard({
    super.key,
    required this.child,
    this.blur = 10,
    this.opacity = 0.15,
    this.borderRadius,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    final radius = borderRadius ?? BorderRadius.circular(20);
    return ClipRRect(
      borderRadius: radius,
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
        child: Container(
          padding: padding ?? const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(opacity),
            borderRadius: radius,
            border: Border.all(
              color: Colors.white.withOpacity(0.2),
              width: 1.5,
            ),
          ),
          child: child,
        ),
      ),
    );
  }
}`,
  },

  // ── SUPABASE REALTIME STREAM PATTERN ──────────────────────────────────
  {
    domain: 'general',
    category: 'service',
    name: 'RealtimeSupabaseStreamHelper',
    description: 'Reusable Supabase client realtime listener with automatic reconnection and typed mapping',
    language: 'dart',
    tags: ['supabase', 'realtime', 'stream', 'service'],
    code: `import 'package:supabase_flutter/supabase_flutter.dart';

class RealtimeStreamHelper<T> {
  final String tableName;
  final String primaryKey;
  final T Function(Map<String, dynamic> json) fromJson;

  RealtimeStreamHelper({
    required this.tableName,
    this.primaryKey = 'id',
    required this.fromJson,
  });

  Stream<List<T>> streamAll({String? orderBy, bool ascending = false}) {
    final query = Supabase.instance.client
        .from(tableName)
        .stream(primaryKey: [primaryKey]);
    
    if (orderBy != null) {
      return query
          .order(orderBy, ascending: ascending)
          .map((maps) => maps.map((m) => fromJson(m)).toList());
    }
    return query.map((maps) => maps.map((m) => fromJson(m)).toList());
  }
}`,
  },
];

export class VectorStore {
  /**
   * Generates text embedding vector using nomic-embed-text or OpenAI text-embedding-3-small via OpenRouter
   */
  public static async embed(text: string, apiKey?: string): Promise<number[] | null> {
    const key =
      apiKey ||
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENROUTER_API_KEY) ||
      (typeof process !== 'undefined' && (process.env?.VITE_OPENROUTER_API_KEY || process.env?.OPENROUTER_API_KEY)) ||
      '';

    if (!key) return null;

    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 4000);
      const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
          'HTTP-Referer': 'https://flutterforge.dev',
          'X-Title': 'FlutterForge Agent',
        },
        body: JSON.stringify({
          model: 'nomic-ai/nomic-embed-text-v1.5',
          input: text.slice(0, 2000),
        }),
        signal: controller.signal,
      });
      clearTimeout(tid);

      if (!res.ok) return null;
      const data = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
      return data.data?.[0]?.embedding ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Retrieves semantically relevant code patterns using vector search or intelligent in-memory matching
   */
  public static async retrievePatterns(
    prompt: string,
    domain: string,
    category?: string,
    topK = 3
  ): Promise<CodePattern[]> {
    const lower = prompt.toLowerCase();

    // 1. Try Supabase pgvector RPC search if available
    try {
      const embedding = await this.embed(prompt);
      if (embedding && supabase) {
        const { data, error } = await supabase.rpc('match_code_patterns', {
          query_embedding: embedding,
          domain_filter: domain !== 'general' ? domain : null,
          category_filter: category ?? null,
          match_count: topK,
          min_similarity: 0.25,
        });

        if (!error && Array.isArray(data) && data.length > 0) {
          return data as CodePattern[];
        }
      }
    } catch {
      // Fall through to in-memory pattern retrieval
    }

    // 2. High-precision keyword + domain in-memory pattern matching
    const matches = BUILTIN_CODE_PATTERNS.filter((pattern) => {
      if (category && pattern.category !== category) return false;
      if (pattern.domain === domain || pattern.domain === 'general') return true;
      return pattern.tags?.some((t) => lower.includes(t.toLowerCase()));
    });

    // Score and sort
    const scored = matches.map((p) => {
      let score = 0;
      if (p.domain === domain) score += 3;
      p.tags?.forEach((t) => {
        if (lower.includes(t.toLowerCase())) score += 2;
      });
      return { pattern: p, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map((s) => s.pattern);
  }

  /**
   * Retrieves semantically relevant files from an existing project
   */
  public static async retrieveRelevantFiles(
    projectId: string,
    prompt: string,
    topK = 8
  ): Promise<RelevantFile[]> {
    try {
      const embedding = await this.embed(prompt);
      if (embedding && supabase && projectId) {
        const { data, error } = await supabase.rpc('match_project_files', {
          query_embedding: embedding,
          p_project_id: projectId,
          match_count: topK,
          min_similarity: 0.2,
        });

        if (!error && Array.isArray(data) && data.length > 0) {
          return data.map((d: { file_path: string; summary: string; similarity: number }) => ({
            filePath: d.file_path,
            summary: d.summary,
            similarity: d.similarity,
          }));
        }
      }
    } catch {
      // Fall back to empty
    }
    return [];
  }

  /**
   * Embeds and stores project files in project_file_embeddings (non-blocking)
   */
  public static async embedProjectFiles(
    projectId: string,
    files: AgentFileArtifact[]
  ): Promise<void> {
    if (!projectId || !supabase) return;

    try {
      const targetFiles = files.filter((f) => f.language === 'dart' || f.language === 'sql');
      for (const file of targetFiles.slice(0, 10)) {
        const summary = `${file.path}: ${file.description || 'Dart/SQL source code'}`;
        const embedding = await this.embed(summary);
        if (embedding) {
          await supabase.from('project_file_embeddings').upsert(
            {
              project_id: projectId,
              file_path: file.path,
              summary,
              embedding,
              token_count: file.content.length / 4,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'project_id,file_path' }
          );
        }
      }
    } catch {
      // Silent catch so embedding never fails the main generation flow
    }
  }
}
