import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-OpenRouter-Key, X-OpenRouter-Model",
};

const SYSTEM_PROMPT = `You are Lovable FlutterForge Agent, an elite full-stack Flutter and Supabase architect and software engineer.
You design, architect, and generate end-to-end, production-grade Flutter mobile and web applications integrated with Supabase backend services.

Your primary goal is to build beautiful, robust, pixel-perfect, scalable, and responsive Flutter applications that feel like top-tier commercial apps (like Apple, Stripe, Linear, Airbnb).

### CORE PRINCIPLES:

1. ARCHITECTURE:
   - Clean Architecture with Feature-First structure (lib/core/, lib/models/, lib/services/, lib/screens/)
   - Strict Dart Null Safety, const constructors, proper dispose()
   - ABSOLUTE BAN ON STUBS: No "// TODO", "// implement", or truncated code

2. SUPABASE:
   - Initialize Supabase in main.dart with AppConstants
   - RLS enabled on every table with explicit policies
   - Real-time subscriptions with .stream(primaryKey: ['id'])
   - Auth flows: Email/Password, Magic Link, OAuth

3. UI/UX:
   - Material 3 with rich harmonious palettes (default seed #02AFB9 teal, accent #F07067 coral)
   - flutter_animate for micro-animations
   - Shimmer skeleton loading states
   - Glassmorphism cards with subtle shadows

4. THEME TOGGLE (mandatory for every app):
   - Generate BOTH lightTheme and darkTheme in app_theme.dart
   - ThemeMode state in the app root (ValueNotifier/provider, persisted via shared_preferences)
   - Toggle button (IconButton/Switch/SegmentedButton) in AppBar AND Profile/Settings
   - Support ThemeMode.system as default, with user override

5. IMPORTS & DEPENDENCIES (build breakers — follow exactly):
   - Import your own files with RELATIVE imports or as
     \`package:<exact-app-id>/...\` using the EXACT pubspec name. NEVER
     shorten it to \`package:<stem>/...\`.
   - NEVER invent a package. Only depend on real pub.dev packages.
   - NEVER add a dependency named after the app itself.

4. OUTPUT FORMAT:
   - For NEW projects: Generate ALL files in a SINGLE response
   - Each file MUST be wrapped in markdown code blocks with filepath:
     \\\`\\\`\\\`dart filepath="lib/main.dart"
     // Complete file content
     \\\`\\\`\\\`
     \\\`\\\`\\\`yaml filepath="pubspec.yaml"
     # Complete file content
     \\\`\\\`\\\`
     \\\`\\\`\\\`sql filepath="supabase/migrations/001_initial_schema.sql"
     -- Complete SQL with RLS
     \\\`\\\`\\\`
   - Every file must be complete and compilable. No placeholders.

5. DEPENDENCIES to include in pubspec.yaml:
   - supabase_flutter: ^2.8.0
   - go_router: ^14.6.2
   - google_fonts: ^6.2.1
   - provider: ^6.1.2
   - flutter_animate: ^4.5.0
   - cached_network_image: ^3.4.1
    - intl: ^0.20.3`;

// Free model chain - verified available free models on OpenRouter (Aug 2026)
const FREE_MODEL_CHAIN = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "poolside/laguna-s-2.1:free",
  "cohere/north-mini-code:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3.5-lightning:free",
];

// Files without which a Flutter project can never build — the client
// backfills these from its deterministic generator when missing.
const CRITICAL_FILES = [
  "pubspec.yaml",
  "lib/main.dart",
  "lib/app.dart",
  "supabase/migrations/001_initial_schema.sql",
];

// Per-model output caps: requesting more than a model supports can fail the
// call outright (e.g. Laguna caps at 32k completion tokens).
function clampMaxTokens(model: string, requested: number): number {
  if (model.toLowerCase().includes("laguna")) return Math.min(requested, 32000);
  return requested;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const openRouterKey = req.headers.get("X-OpenRouter-Key") || Deno.env.get("OPENROUTER_API_KEY");
    const requestedModel = req.headers.get("X-OpenRouter-Model");

    if (!openRouterKey) {
      return new Response(JSON.stringify({ error: "Missing OpenRouter API key." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, files, mode } = await req.json();
    const isChat = mode === "chat";

    const conversationMessages: Array<{ role: string; content: string }> = [
      {
        role: "system",
        content: isChat
          ? "You are FlutterForge's AI assistant. Answer clearly and accurately. Use supplied project context when available, state when information is missing, and never claim to have changed files."
          : SYSTEM_PROMPT,
      },
    ];

    // Include existing files as context (smart: only paths + first 200 lines per file)
    if (!isChat && files && files.length > 0) {
      if (mode === "new") {
        // For new generation, include file list summary
        const fileList = files.map((f: { path: string }) => f.path).join("\n");
        conversationMessages.push({
          role: "system",
          content: `Existing project files:\n${fileList}\n\nGenerate a complete new project, overwriting all files as needed.`,
        });
      } else {
        // For edits, include full file contents
        const fileContext = files
          .slice(0, 20) // Limit to 20 files to stay in context
          .map((f: { path: string; content: string }) => `--- ${f.path} ---\n${f.content.slice(0, 3000)}`)
          .join("\n\n");
        conversationMessages.push({
          role: "system",
          content: `Here are the current project files:\n\n${fileContext}`,
        });
      }
    }

    // Include conversation history for context — bounded (last 20 turns,
    // each truncated) so long workspace chats can't blow the context window.
    const history = Array.isArray(messages) ? messages.slice(-20) : [];
    for (const msg of history) {
      const content = typeof msg.content === "string" && msg.content.length > 4000
        ? msg.content.slice(0, 4000) + "\n…[truncated for context budget]"
        : msg.content;
      conversationMessages.push({
        role: msg.role === "assistant" ? "assistant" : "user",
        content,
      });
    }

    // Try models in fallback chain
    let lastError = "";
    for (const model of (requestedModel ? [requestedModel, ...FREE_MODEL_CHAIN] : FREE_MODEL_CHAIN)) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openRouterKey}`,
            "HTTP-Referer": "https://flutterforge.app",
            "X-Title": "FlutterForge AI",
          },
          body: JSON.stringify({
            model,
            messages: conversationMessages,
            temperature: isChat ? 0.7 : 0.15,
            max_tokens: isChat ? 1500 : clampMaxTokens(model, mode === "edit" ? 32000 : 64000),
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          lastError = `${model}: ${response.status} ${errText.slice(0, 100)}`;
          continue;
        }

        const data = await response.json();
        const aiContent = data.choices?.[0]?.message?.content ?? "";

        if (isChat && typeof aiContent === "string" && aiContent.trim()) {
          return new Response(JSON.stringify({ answer: aiContent.trim(), model }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Parse files from markdown code blocks
        const files: Array<{ path: string; content: string }> = [];
        const codeBlockRegex = /```(?:dart|yaml|sql|json|swift|kotlin|xml|gradle)\s+filepath="([^"]+)"\s*\n([\s\S]*?)```/g;
        let match;
        while ((match = codeBlockRegex.exec(aiContent)) !== null) {
          files.push({ path: match[1], content: match[2].trim() });
        }

        // Fallback: try <code_block> JSON parsing
        if (files.length === 0) {
          const codeBlockMatch = aiContent.match(/<code_block>\s*([\s\S]*?)\s*<\/code_block>/);
          if (codeBlockMatch) {
            try {
              const parsed = JSON.parse(codeBlockMatch[1]);
              if (parsed.files && Array.isArray(parsed.files)) {
                files.push(...parsed.files);
              }
            } catch {
              const jsonMatch = codeBlockMatch[1].match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                try {
                  const parsed = JSON.parse(jsonMatch[0]);
                  if (parsed.files && Array.isArray(parsed.files)) {
                    files.push(...parsed.files);
                  }
                } catch { /* give up */ }
              }
            }
          }
        }

        // Fallback: try raw JSON
        if (files.length === 0) {
          const jsonMatch = aiContent.match(/\{[\s\S]*"files"[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.files && Array.isArray(parsed.files)) {
                files.push(...parsed.files);
              }
            } catch { /* give up */ }
          }
        }

        if (files.length > 0) {
          // Validate completeness like the client does: flag missing
          // critical files so the caller can backfill them deterministically.
          const produced = new Set(files.map((f) => f.path));
          const missing = CRITICAL_FILES.filter((p) => !produced.has(p));
          return new Response(JSON.stringify({
            summary: `Generated ${files.length} files`,
            files,
            model,
            complete: missing.length === 0,
            missing,
            raw_tokens: data.usage?.total_tokens ?? 0,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (e) {
        lastError = `${model}: ${String(e).slice(0, 100)}`;
        continue;
      }
    }

    return new Response(JSON.stringify({
      error: `All models failed. Last error: ${lastError}`,
    }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Server error: ${String(err)}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
