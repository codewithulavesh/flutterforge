import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  Database,
  Undo2,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/utils/cn';

interface FileDiffProps {
  path: string;
  oldContent?: string;
  newContent: string;
  action: 'created' | 'modified' | 'deleted';
  onRestore?: (path: string) => void;
  onOpenFile?: (path: string) => void;
}

export function FileDiff({
  path,
  oldContent,
  newContent,
  action,
  onRestore,
  onOpenFile,
}: FileDiffProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Compute a simple line-by-line diff
  const oldLines = oldContent ? oldContent.split('\n') : [];
  const newLines = newContent.split('\n');

  const additions = action === 'created' ? newLines.length : Math.max(0, newLines.length - oldLines.length);
  const deletions = action === 'deleted' ? oldLines.length : Math.max(0, oldLines.length - newLines.length);

  return (
    <div className="rounded-xl border border-[var(--ff-border)] bg-black/25 overflow-hidden text-xs my-1 transition-all">
      {/* File Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-3 py-2 bg-[var(--ff-surface)]/60 hover:bg-[var(--ff-surface)] cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-[var(--ff-text-dim)]">
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
          {path.endsWith('.sql') ? (
            <Database size={13} className="text-cyan-400 shrink-0" />
          ) : (
            <FileCode2 size={13} className="text-blue-400 shrink-0" />
          )}
          <span className="font-mono text-[11px] text-white/90 truncate">{path}</span>
          <span
            className={cn(
              'text-[9px] px-1.5 py-0.5 rounded font-mono font-medium shrink-0',
              action === 'created'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : action === 'modified'
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                : 'bg-red-500/15 text-red-400 border border-red-500/20'
            )}
          >
            {action === 'created' ? '+ new' : action === 'modified' ? 'modified' : 'deleted'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          {action === 'modified' && (
            <div className="flex items-center gap-1 font-mono text-[10px]">
              {additions > 0 && <span className="text-emerald-400">+{additions}</span>}
              {deletions > 0 && <span className="text-red-400">-{deletions}</span>}
            </div>
          )}

          {onOpenFile && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenFile(path);
              }}
              title="Open in Code Editor"
              className="p-1 rounded hover:bg-white/10 text-[var(--ff-text-dim)] hover:text-white transition-colors"
            >
              <ExternalLink size={11} />
            </button>
          )}

          {action === 'modified' && oldContent && onRestore && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRestore(path);
              }}
              title="Restore previous version of this file"
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[9px] text-[var(--ff-text-dim)] hover:text-white transition-all"
            >
              <Undo2 size={9} />
              <span>Restore</span>
            </button>
          )}
        </div>
      </div>

      {/* Expanded Diff Lines View */}
      {isExpanded && (
        <div className="max-h-56 overflow-y-auto ff-scrollbar bg-[#090D16] p-2 font-mono text-[10px] space-y-0.5">
          {action === 'created' ? (
            newLines.slice(0, 30).map((line, idx) => (
              <div key={idx} className="flex gap-2 text-emerald-300 bg-emerald-950/20 px-1 rounded">
                <span className="text-emerald-600 select-none w-6 text-right shrink-0">{idx + 1}</span>
                <span className="text-emerald-500 select-none shrink-0">+</span>
                <span className="truncate">{line || ' '}</span>
              </div>
            ))
          ) : (
            newLines.slice(0, 40).map((line, idx) => {
              const isAdded = !oldLines.includes(line);
              return (
                <div
                  key={idx}
                  className={cn(
                    'flex gap-2 px-1 rounded',
                    isAdded ? 'text-emerald-300 bg-emerald-950/20' : 'text-white/70'
                  )}
                >
                  <span className="text-white/20 select-none w-6 text-right shrink-0">{idx + 1}</span>
                  <span className="text-white/30 select-none shrink-0">{isAdded ? '+' : ' '}</span>
                  <span className="truncate">{line || ' '}</span>
                </div>
              );
            })
          )}
          {newLines.length > 40 && (
            <div className="text-[9px] text-white/30 italic px-2 py-1">
              ... +{newLines.length - 40} more lines
            </div>
          )}
        </div>
      )}
    </div>
  );
}
