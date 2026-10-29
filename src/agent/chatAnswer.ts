/**
 * General-question answering for the AI Builder.
 *
 * Conversational messages (classified by `chatIntent.ts`) are answered
 * directly with project-aware context instead of running the full Flutter
 * generation pipeline — no files change, no versions snapshot, no rebuild.
 */

import { OpenRouterClient, budgetHistory, type LLMMessage } from './llmClient';
import { keyPool } from './keyPool';

const CHAT_SYSTEM_PROMPT = `
You are the FlutterForge in-workspace assistant: friendly, concise, expert in
Flutter, Dart, Supabase and this user's project (summarized below when available).

Rules:
- Answer the user's question directly. Keep replies short (a few sentences or
  a compact list) unless they ask for detail.
- You know the project context — reference its screens, tables and packages
  when relevant. If they ask about an error, explain the likely cause.
- NEVER invent file contents, NEVER wrap anything in a code block with a
  filepath="..." attribute, and NEVER claim you changed files — you cannot
  modify the project in this mode.
- If they seem to want a change ("add X", "fix Y"), briefly say what you'd do
  and invite them to say the word (e.g. "Say 'add it' and I'll implement it").
- No TODOs, no boilerplate, no asking for information you already have.
`.trim();

export interface ChatAnswerContext {
  projectName: string;
  projectSummary: string;
  history: Array<{ role: string; content: string }>;
  apiKey: string;
  model?: string;
  onProgress?: (message: string) => void;
  onToken?: (token: string) => void;
  signal?: AbortSignal;
}

/** Zero-key offline replies for pure pleasantries — no network needed. */
function offlineCannedReply(question: string): string | null {
  const q = question.toLowerCase().trim();
  if (/^(hi|hii+|hello|hey|yo|hola|namaste)\b/.test(q)) {
    return "Hey! I'm your FlutterForge assistant. Ask me anything about Flutter, Supabase, or this project — or describe what you want to build and I'll generate it.";
  }
  if (/^(thanks?|thank\s?you|thx)\b/.test(q)) {
    return "You're welcome! Anything else — a question, or something to add to the app?";
  }
  if (/^(bye|goodbye|see\s?you)\b/.test(q)) {
    return 'See you soon — your project is saved and ready whenever you are.';
  }
  if (/^(ok|okay|cool|nice|great|awesome|perfect|got\s?it|understood)\b/.test(q)) {
    return 'Got it. Let me know if you want anything explained or changed in the app.';
  }
  if (/who\sare\syou|what\sare\syou|what\scan\syou\sdo/.test(q)) {
    return "I'm the FlutterForge builder AI. I can answer questions about your project and Flutter/Supabase in general — and when you're ready, describe a feature and I'll generate the complete code, wire up Supabase, and preview it.";
  }
  return null;
}

function resolveModel(explicit?: string): string {
  if (explicit) return explicit;
  try {
    if (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_AGENT_MODEL as string | undefined)) {
      return import.meta.env.VITE_AGENT_MODEL as string;
    }
  } catch { /* import.meta unavailable (tests) */ }
  try {
    if (typeof process !== 'undefined' && (process.env?.VITE_AGENT_MODEL as string | undefined)) {
      return process.env.VITE_AGENT_MODEL as string;
    }
  } catch { /* process unavailable (browser) */ }
  return 'nvidia/nemotron-3-ultra-550b-a55b:free';
}

/**
 * Answers a general question. Throws a user-facing Error when no API key is
 * available and the message isn't answerable offline.
 */
export async function answerGeneralQuestion(
  question: string,
  ctx: ChatAnswerContext,
): Promise<string> {
  const canned = offlineCannedReply(question);
  if (canned) return canned;

  let apiKey = ctx.apiKey;
  if (!apiKey) {
    try {
      apiKey = keyPool.getNextKey();
    } catch {
      apiKey = '';
    }
  }
  if (!apiKey) {
    throw new Error(
      'I need an AI key to answer that — add your OpenRouter key to keep chatting. (Building apps still works offline.)',
    );
  }

  ctx.onProgress?.('Thinking...');
  const client = new OpenRouterClient({
    apiKey,
    model: resolveModel(ctx.model),
    temperature: 0.7,
  });

  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: `${CHAT_SYSTEM_PROMPT}\n\nProject: ${ctx.projectName}\n${ctx.projectSummary}`,
    },
  ];
  for (const turn of budgetHistory(ctx.history, { maxTurns: 8, maxTokens: 4000 })) {
    messages.push({
      role: turn.role === 'assistant' ? 'assistant' : 'user',
      content: turn.content,
    });
  }
  messages.push({ role: 'user', content: question });

  ctx.onProgress?.('Answering...');
  const reply = (await client.chatStream(messages, {
    temperature: 0.7,
    maxTokens: 1500,
    onToken: ctx.onToken,
    signal: ctx.signal,
  })).trim();
  if (!reply) throw new Error('The AI returned an empty reply — please try again.');
  return reply;
}
