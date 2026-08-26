import { useEffect, useRef } from 'react';
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
          [/[{}()\[\]]/, '@brackets'],
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

  async function handleSave() {
    if (!currentProject || !activeFile || !editorRef.current) return;
    const content = editorRef.current.getValue();
    await saveFile(currentProject.id, activeFile, content);
    toast('success', 'File saved');
  }

  return (
    <div className="flex flex-col h-full bg-[var(--ff-bg)]">
      {/* Tabs */}
      <div className="flex items-center border-b border-[var(--ff-border)] bg-[var(--ff-surface)] overflow-x-auto ff-scrollbar shrink-0">
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
                ? 'bg-[var(--ff-bg)] text-white'
                : 'text-[var(--ff-text-dim)] hover:text-[var(--ff-text-muted)]'
            )}
          >
            <span className="truncate max-w-[160px]">{path.split('/').pop()}</span>
            <button
              onClick={(e) => { e.stopPropagation(); closeTab(path); }}
              className="opacity-0 group-hover:opacity-100 hover:text-white transition-opacity"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {activeFile && (
          <button
            onClick={handleSave}
            className="ml-auto px-3 py-2 text-xs text-[var(--ff-text-muted)] hover:text-white flex items-center gap-1.5 shrink-0"
          >
            <Save size={12} />
            Save
          </button>
        )}
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
              void value;
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
