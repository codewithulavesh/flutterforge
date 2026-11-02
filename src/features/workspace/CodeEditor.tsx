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
    <div className="flex flex-col h-full bg-[var(--ff-bg)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--ff-border)] bg-[var(--ff-surface)] px-2 py-1.5 shrink-0">
        <div className="flex min-w-0 items-center gap-2">
          <div className="rounded-md border border-[var(--ff-border)] bg-[var(--ff-bg)] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--ff-text-dim)]">
            Editor
          </div>
          {activeFile && (
            <div className="min-w-0 overflow-hidden">
              <div className="truncate text-[11px] font-medium text-[var(--ff-text)]">{activeFile}</div>
              <div className={cn('text-[9px]', activeFile && isDirty(activeFile) ? 'text-amber-400' : 'text-[var(--ff-text-dim)]')}>
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
            className="flex items-center gap-1.5 rounded-lg border border-[var(--ff-border)] bg-[var(--ff-bg)] px-2.5 py-1.5 text-[10px] font-medium text-[var(--ff-text-muted)] transition-colors hover:text-[var(--ff-text)] hover:bg-[var(--ff-surface-2)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save size={12} />
            Save
          </button>
        )}
      </div>

      {/* Open file tabs */}
      <div className="flex items-stretch border-b border-[var(--ff-border)] bg-[var(--ff-surface)] shrink-0">
        <div className="flex items-center flex-1 min-w-0 overflow-x-auto ff-scrollbar">
          {openTabs.length === 0 && (
            <div className="px-4 py-2 text-xs text-[var(--ff-text-dim)]">No files open</div>
          )}
          {openTabs.map((path) => (
            <div
              key={path}
              onClick={() => openFile(path)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-xs cursor-pointer border-r border-[var(--ff-border)] transition-colors group',
                activeFile === path
                  ? 'bg-[var(--ff-bg)] text-[var(--ff-text)]'
                  : 'text-[var(--ff-text-dim)] hover:text-[var(--ff-text-muted)]'
              )}
            >
              <span className="truncate max-w-[160px]">{path.split('/').pop()}</span>
              {isDirty(path) && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" title="Unsaved changes" />}
              <button
                onClick={(e) => { e.stopPropagation(); handleCloseTab(path); }}
                aria-label={`Close ${path}`}
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-[var(--ff-text)] transition-opacity"
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
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--ff-surface)] flex items-center justify-center mb-4">
              <Save size={28} className="text-[var(--ff-text-dim)]" />
            </div>
            <p className="text-sm text-[var(--ff-text-muted)]">Open a file to start editing</p>
            <p className="text-xs text-[var(--ff-text-dim)] mt-1">Select from the file explorer on the left</p>
          </div>
        )}
      </div>
    </div>
  );
}
