import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-OpenRouter-Key, X-OpenRouter-Model",
};

const SYSTEM_PROMPT = `You are an expert Flutter developer AI assistant. You generate complete, working Flutter projects from natural-language requests.

When the user asks you to create or modify an app, you MUST respond with a JSON object wrapped in <code_block> tags. The JSON has this shape:

{
  "summary": "Brief description of what was generated",
  "files": [
    {
      "path": "lib/main.dart",
      "content": "..."
    },
    {
      "path": "pubspec.yaml",
      "content": "..."
    }
  ]
}

Rules:
- Always include a complete Flutter entry point at lib/main.dart.
- Include all Dart files required by the requested screens, navigation, state, and interactions.
- Include pubspec.yaml with every package used by the generated Dart code.
- Use Material 3, responsive layouts, meaningful content, and working interactions.
- Use a cohesive color scheme and avoid purple/indigo defaults unless requested.
- When modifying an existing project, preserve working files and return changed files with complete contents.
- Keep paths relative to the project root and return valid JSON only inside the code_block tags.

If the user is modifying an existing project, include ALL files in the response (both modified and unchanged), so the output is always a complete project.

Always wrap your JSON response in <code_block> and </code_block> tags.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const openRouterKey = req.headers.get("X-OpenRouter-Key") || Deno.env.get("OPENROUTER_API_KEY");
    const openRouterModel = req.headers.get("X-OpenRouter-Model") || Deno.env.get("OPENROUTER_MODEL") || "poolside/laguna-s-2.1:free";

    if (!openRouterKey) {
      return new Response(JSON.stringify({ error: "Missing OpenRouter API key. Set OPENROUTER_API_KEY env var or pass X-OpenRouter-Key header." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, files, mode } = await req.json();

    const conversationMessages: Array<{ role: string; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    if (files && files.length > 0 && mode !== "new") {
      const fileContext = files.map((f: { path: string; content: string }) => `--- ${f.path} ---\n${f.content}`).join("\n\n");
      conversationMessages.push({
        role: "system",
        content: `Here are the current project files:\n\n${fileContext}`,
      });
    }

    for (const msg of messages) {
      conversationMessages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openRouterKey}`,
        "HTTP-Referer": "https://flutterforge.app",
        "X-Title": "FlutterForge AI",
      },
      body: JSON.stringify({
        model: openRouterModel,
        messages: conversationMessages,
        temperature: 0.7,
        max_tokens: 16000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: `AI request failed: ${response.status} ${errText}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const aiContent = data.choices?.[0]?.message?.content ?? "";

    let parsed: { summary: string; files: Array<{ path: string; content: string }> } | null = null;

    const codeBlockMatch = aiContent.match(/<code_block>\s*([\s\S]*?)\s*<\/code_block>/);
    if (codeBlockMatch) {
      try {
        parsed = JSON.parse(codeBlockMatch[1]);
      } catch {
        const jsonMatch = codeBlockMatch[1].match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch {
            // give up parsing
          }
        }
      }
    } else {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          // give up
        }
      }
    }

    if (!parsed || !parsed.files) {
      return new Response(JSON.stringify({
        error: "Failed to parse AI response",
        raw: aiContent.slice(0, 2000),
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      summary: parsed.summary || "Generated successfully",
      files: parsed.files,
      raw_tokens: data.usage?.total_tokens ?? 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Server error: ${String(err)}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
