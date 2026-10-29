import type { AIMessage, ProjectFile } from '@/types';
import { detectSupabaseNeed } from '@/utils/backendNeed';

export interface ChatContextInput {
  projectName: string;
  projectDescription?: string | null;
  files: ProjectFile[];
  messages: AIMessage[];
  activeFile?: string | null;
  buildErrors?: string[];
  question: string;
  attachedFiles?: string[];
}

export interface ChatContextBundle {
  /** Compact, system-prompt-ready project context. */
  summary: string;
  /** Recent turns for the chat model. */
  history: Array<{ role: string; content: string }>;
  backend: 'supabase' | 'local';
  fileCount: number;
  screenCount: number;
  activeFile: string | null;
  dependencies: string[];
  relevantFiles: string[];
  tokenEstimate: number;
}

const MAX_HISTORY_TURNS = 8;
const MAX_HISTORY_CHARS = 9000;
const MAX_ACTIVE_FILE_CHARS = 1800;
const MAX_FILE_LIST = 48;

function parseDependencies(content: string): string[] {
  const lines = content.split('\n');
  const dependencies: string[] = [];
  let inDependencies = false;
  for (const line of lines) {
    if (/^dependencies:\s*$/.test(line)) {
      inDependencies = true;
      continue;
    }
    if (!inDependencies) continue;
    if (/^\S/.test(line)) break;
    const match = line.match(/^ {2}([a-z][a-z0-9_]*):/);
    if (match && match[1] !== 'flutter') dependencies.push(match[1]);
  }
  return dependencies;
}

function screensFrom(files: ProjectFile[]): string[] {
  return files
    .filter((file) => /_screen\.dart$|\/screens?\//.test(file.path))
    .map((file) => file.path)
    .slice(0, 30);
}

function scoreFile(file: ProjectFile, question: string, activeFile: string | null): number {
  let score = 0;
  if (file.path === activeFile) score += 100;
  if (file.path === 'pubspec.yaml') score += 35;
  if (file.path === 'lib/main.dart' || file.path === 'lib/app.dart') score += 25;
  if (/_screen\.dart$/.test(file.path)) score += 8;
  const lowerPath = file.path.toLowerCase();
  const tokens = question.toLowerCase().split(/[^a-z0-9_]+/).filter((token) => token.length > 3);
  for (const token of tokens) {
    if (lowerPath.includes(token)) score += 12;
  }
  return score;
}

/**
 * Builds the chat model's project context.
 *
 * The assistant should know what the app currently is, what file the user is
 * looking at, what backend mode is active, and what just failed — without
 * dumping the entire repository into every request.
 */
export class ChatContextHandler {
  static build(input: ChatContextInput): ChatContextBundle {
    const files = input.files.filter((file) => !file.is_directory);
    const questionText = `${input.question} ${input.projectDescription ?? ''} ${input.projectName}`;
    const filesUseSupabase = files.some((file) => (
      /^supabase\//.test(file.path)
      || /supabase_flutter|Supabase\.initialize|SupabaseService/.test(file.content)
    ));
    const backend: 'supabase' | 'local' = filesUseSupabase
      || (files.length === 0 && detectSupabaseNeed(questionText))
      ? 'supabase'
      : 'local';
    const activeFile = input.activeFile && files.some((file) => file.path === input.activeFile)
      ? input.activeFile
      : null;

    const pubspec = files.find((file) => file.path === 'pubspec.yaml');
    const dependencies = pubspec ? parseDependencies(pubspec.content) : [];
    const screens = screensFrom(files);
    const fileList = files
      .map((file) => file.path)
      .sort((a, b) => a.localeCompare(b))
      .slice(0, MAX_FILE_LIST);

    const relevantFiles = [...files]
      .sort((a, b) => scoreFile(b, input.question, activeFile) - scoreFile(a, input.question, activeFile))
      .slice(0, 6)
      .map((file) => file.path);

    const activeContent = activeFile
      ? files.find((file) => file.path === activeFile)?.content.slice(0, MAX_ACTIVE_FILE_CHARS)
      : null;

    const attached = (input.attachedFiles ?? [])
      .map((path) => files.find((file) => file.path === path))
      .filter((file): file is ProjectFile => Boolean(file))
      .slice(0, 4)
      .map((file) => `--- ${file.path}\n${file.content.slice(0, 900)}`);

    const buildErrors = (input.buildErrors ?? [])
      .filter((line) => /error|exception|failed|not found|undefined|invalid/i.test(line))
      .slice(-8);

    const lines = [
      `Project: ${input.projectName}`,
      input.projectDescription ? `Description: ${input.projectDescription}` : '',
      `Backend: ${backend === 'supabase' ? 'Supabase (auth/database)' : 'local only (no Supabase)'}`,
      `Files: ${files.length}`,
      screens.length > 0 ? `Screens:\n${screens.map((screen) => `- ${screen}`).join('\n')}` : '',
      dependencies.length > 0 ? `Dependencies: ${dependencies.join(', ')}` : '',
      `File tree (first ${Math.min(files.length, MAX_FILE_LIST)}):\n${fileList.map((path) => `- ${path}`).join('\n')}`,
      relevantFiles.length > 0 ? `Relevant to the question: ${relevantFiles.join(', ')}` : '',
      activeFile ? `User is viewing: ${activeFile}` : '',
      activeContent ? `Active file excerpt (${activeFile}):\n\`\`\`dart\n${activeContent}\n\`\`\`` : '',
      buildErrors.length > 0 ? `Latest preview/build errors:\n${buildErrors.map((line) => `- ${line}`).join('\n')}` : '',
      attached.length > 0 ? `User-attached files (focus on these):\n${attached.join('\n')}` : '',
    ].filter(Boolean);

    const history: Array<{ role: string; content: string }> = [];
    let historyChars = 0;
    for (const message of input.messages.slice(-MAX_HISTORY_TURNS).reverse()) {
      if (message.role !== 'user' && message.role !== 'assistant') continue;
      const content = String(message.content ?? '').slice(0, 2000);
      if (historyChars + content.length > MAX_HISTORY_CHARS) break;
      history.unshift({ role: message.role, content });
      historyChars += content.length;
    }

    const summary = lines.join('\n');
    return {
      summary,
      history,
      backend,
      fileCount: files.length,
      screenCount: screens.length,
      activeFile,
      dependencies,
      relevantFiles,
      tokenEstimate: Math.ceil(summary.length / 4) + Math.ceil(historyChars / 4),
    };
  }
}
