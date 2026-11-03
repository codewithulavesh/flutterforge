import { useCallback, useEffect, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { X, Save } from 'lucide-react';
import { useProjectStore } from '@/stores/project.store';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { toast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';

export function CodeEditor() {
  const { files, currentProject, saveFile } = useProjectStore();
  const { openTabs, activeFile, closeTab, openFile } = useWorkspaceStore();
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const currentFile = files.find((f) => f.path === activeFile);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const draftsRef = useRef(drafts);

  const updateDraft = useCallback((path: string, content: string) => {
    const nextDrafts = { ...draftsRef.current, [path]: content };
    draftsRef.current = nextDrafts;
    setDrafts(nextDrafts);
  }, []);

  const clearDraft = useCallback((path: string, savedContent: string) => {
    if (draftsRef.current[path] !== savedContent) return;
    const nextDrafts = { ...draftsRef.current };
    delete nextDrafts[path];
    draftsRef.current = nextDrafts;
    setDrafts(nextDrafts);
  }, []);

  useEffect(() => {
    if (editorRef.current && currentFile) {
      editorRef.current.setValue(currentFile.content);
    }
  }, [activeFile, currentFile?.path]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    monaco.languages.register({ id: 'dart' });
    monaco.languages.setMonarchTokensProvider('dart', {
      tokenizer: {
        root: [
          [/@\w+/, 'annotation'],
          [/[A-Z]\w+/, 'type.identifier'],
          [/import|class|extends|implements|with|return|if|else|for|while|switch|case|break|continue|void|var|final|const|static|late|required|async|await|Future|Stream|Widget|BuildContext|StatelessWidget|StatefulWidget|State|override|get|set|new|try|catch|finally|throw|enum|typedef|abstract|factory|mixin/, 'keyword'],
          [/true|false|null|this|super/, 'keyword'],
          [/[{}()[\]]/, '@brackets'],
          [/[<>=!+\-*/%&|^~?:]/, 'operators'],
          [/\/\/.*$/, 'comment'],
          [/\/\*/, 'comment', '@comment'],
          [/"([^"\\]|\\.)*$/, 'string.invalid'],
          [/"/, 'string', '@string'],
          [/'/, 'string', '@string_single'],
          [/\d+\.?\d*/, 'number'],
        ],
        comment: [
          [/\*\//, 'comment', '@pop'],
          [/[^*]+/, 'comment'],
          [/\*/, 'comment'],
        ],
        string: [
          [/[^\\"]+/, 'string'],
          [/\\./, 'string.escape'],
          [/"/, 'string', '@pop'],
        ],
        string_single: [
          [/[^\\']+/, 'string'],
          [/\\./, 'string.escape'],
          [/'/, 'string', '@pop'],
        ],
      },
    });

    monaco.editor.defineTheme('flutterforge-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'c586c0' },
        { token: 'type.identifier', foreground: '4ec9b0' },
        { token: 'string', foreground: 'ce9178' },
        { token: 'number', foreground: 'b5cea8' },
        { token: 'comment', foreground: '6a9955' },
        { token: 'annotation', foreground: '9cdcfe' },
        { token: 'operators', foreground: 'd4d4d4' },
      ],
      colors: {
        'editor.background': '#0a0a0b',
        'editor.foreground': '#d4d4d4',
        'editorLineNumber.foreground': '#3f3f46',
        'editorLineNumber.activeForeground': '#a1a1aa',
        'editor.selectionBackground': '#264f7840',
        'editor.lineHighlightBackground': '#ffffff08',
        'editorCursor.foreground': '#3b82f6',
        'editorIndentGuide.background': '#27272a',
      },
    });
  };

  const handleSave = useCallback(async () => {
    if (!currentProject || !activeFile || !editorRef.current) return;
    const content = draftsRef.current[activeFile] ?? editorRef.current.getValue();
    if (content === currentFile?.content) {
      clearDraft(activeFile, content);
      return;
    }
    const saved = await saveFile(currentProject.id, activeFile, content);
    clearDraft(activeFile, content);
    if (saved) toast('success', 'File saved');
    else toast('warning', 'Saved locally only — backend unavailable, changes may not persist.');
  }, [currentProject, activeFile, currentFile?.content, saveFile, clearDraft]);

  useEffect(() => {
    const onSave = () => { void handleSave(); };
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener('ff:save-file', onSave);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('ff:save-file', onSave);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [handleSave]);

  const isDirty = (path: string) => {
    const file = files.find((item) => item.path === path);
    return Boolean(file && drafts[path] !== undefined && drafts[path] !== file.content);
  };

  const handleCloseTab = (path: string) => {
    if (isDirty(path) && !window.confirm(`Discard unsaved changes to ${path}?`)) return;
    closeTab(path);
    const draft = draftsRef.current[path];
    if (draft !== undefined) clearDraft(path, draft);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--fb-bg)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--fb-line)] bg-[var(--fb-bg)] px-3 py-2 shrink-0">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="shrink-0 rounded-full border border-[var(--fb-line)] bg-[var(--fb-card)] px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--fb-muted)]">
            Editor
          </div>
          {activeFile && (
            <div className="min-w-0 overflow-hidden">
              <div className="truncate text-[11.5px] font-semibold text-[var(--fb-ink)]">{activeFile}</div>
              <div className={cn('mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em]', activeFile && isDirty(activeFile) ? 'text-[var(--fb-orange)]' : 'text-[var(--fb-dim)]')}>
                {currentFile ? (isDirty(activeFile) ? 'Unsaved changes' : 'Saved') : 'No file selected'}
              </div>
            </div>
          )}
        </div>
        {activeFile && (
          <button
            onClick={handleSave}
            disabled={!isDirty(activeFile)}
            title="Save file (Cmd/Ctrl+S)"
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--fb-line)] bg-[var(--fb-card)] px-3 py-1.5 text-[10px] font-semibold text-[var(--fb-muted)] transition-colors hover:border-[var(--fb-ink)] hover:text-[var(--fb-ink)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save size={12} />
            Save
          </button>
        )}
      </div>

      {/* Open file tabs */}
      <div className="flex items-stretch border-b border-[var(--fb-line)] bg-[var(--fb-bg)] shrink-0">
        <div className="flex items-center flex-1 min-w-0 overflow-x-auto ff-scrollbar">
          {openTabs.length === 0 && (
            <div className="px-4 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--fb-dim)]">No files open</div>
          )}
          {openTabs.map((path) => (
            <div
              key={path}
              onClick={() => openFile(path)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-xs cursor-pointer border-r border-[var(--fb-line)] transition-colors group',
                activeFile === path
                  ? 'bg-[var(--fb-card)] font-semibold text-[var(--fb-ink)] shadow-[inset_0_-2px_0_var(--fb-ink)]'
                  : 'text-[var(--fb-dim)] hover:bg-[var(--fb-soft)] hover:text-[var(--fb-ink)]'
              )}
            >
              <span className="truncate max-w-[160px]">{path.split('/').pop()}</span>
              {isDirty(path) && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--fb-orange)]" title="Unsaved changes" />}
              <button
                onClick={(e) => { e.stopPropagation(); handleCloseTab(path); }}
                aria-label={`Close ${path}`}
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-[var(--fb-ink)] transition-opacity"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        {activeFile && currentFile ? (
          <Editor
            height="100%"
            path={activeFile}
            defaultLanguage="dart"
            theme="flutterforge-dark"
            value={currentFile.content}
            onMount={handleMount}
            onChange={(value: string | undefined) => {
              if (activeFile) updateDraft(activeFile, value ?? '');
            }}
            options={{
              fontSize: 13,
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
              lineHeight: 20,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              padding: { top: 12, bottom: 12 },
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              renderLineHighlight: 'all',
              fontLigatures: true,
              tabSize: 2,
              wordWrap: 'on',
              automaticLayout: true,
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <div className="mb-4 flex size-14 items-center justify-center rounded-[18px] border border-[var(--fb-line)] bg-[var(--fb-card)]">
              <Save size={24} className="text-[var(--fb-ink)]" />
            </div>
            <p className="ffb-display ffb-caps text-[22px] leading-none text-[var(--fb-ink)]">Open a file</p>
            <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--fb-dim)]">Select one from the explorer</p>
          </div>
        )}
      </div>
    </div>
  );
}
