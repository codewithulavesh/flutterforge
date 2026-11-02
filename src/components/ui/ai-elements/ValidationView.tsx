import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check,
  ChevronDown,
  AlertTriangle,
  XCircle,
  Bug,
  TestTube2,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type { ValidationReport, ValidationIssue } from '@/agent/types';

interface ValidationViewProps {
  report: ValidationReport;
  className?: string;
}

export function ValidationView({ report, className }: ValidationViewProps) {
  const [expanded, setExpanded] = useState(!report.isValid);
  const errors = report.issues.filter((i) => i.severity === 'error');
  const warnings = report.issues.filter((i) => i.severity === 'warning');
  const infos = report.issues.filter((i) => i.severity === 'info');

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-xl border overflow-hidden',
        report.isValid
          ? 'border-emerald-500/25 bg-emerald-500/[0.03]'
          : 'border-red-500/25 bg-red-500/[0.03]',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[var(--ff-surface-2)]/20 transition-colors"
      >
        <div className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
          report.isValid ? 'bg-emerald-500/15' : 'bg-red-500/15',
        )}>
          {report.isValid ? (
            <Check size={12} className="text-emerald-400" strokeWidth={3} />
          ) : (
            <XCircle size={12} className="text-red-400" />
          )}
        </div>

        <div className="min-w-0 flex-1 text-left">
          <span className={cn(
            'text-[12px] font-semibold block',
            report.isValid ? 'text-emerald-400' : 'text-red-400',
          )}>
            {report.isValid ? 'Validation Passed' : 'Validation Issues Found'}
          </span>
          <span className="text-[10px] text-[var(--ff-text-dim)] block">
            {report.summary}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {errors.length > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono bg-red-500/10 text-red-400">
              <XCircle size={8} /> {errors.length}
            </span>
          )}
          {warnings.length > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/10 text-amber-400">
              <AlertTriangle size={8} /> {warnings.length}
            </span>
          )}
          {report.fixedIssues.length > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-400">
              <Check size={8} /> {report.fixedIssues.length} fixed
            </span>
          )}
        </div>

        <ChevronDown
          size={12}
          className={cn(
            'text-[var(--ff-text-dim)] transition-transform shrink-0',
            expanded && 'rotate-180',
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && report.issues.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[var(--ff-border)]/60 max-h-60 overflow-y-auto ff-scrollbar">
              {report.issues.map((issue, index) => (
                <IssueRow key={`${issue.filePath}-${issue.code}-${index}`} issue={issue} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fixed issues */}
      {expanded && report.fixedIssues.length > 0 && (
        <div className="border-t border-[var(--ff-border)]/60 px-3 py-2">
          <p className="text-[10px] font-semibold text-emerald-400 mb-1">Auto-healed</p>
          {report.fixedIssues.slice(0, 5).map((fix, index) => (
            <div key={index} className="flex items-start gap-1.5 py-0.5 text-[10px]">
              <Check size={9} className="text-emerald-400 mt-0.5 shrink-0" />
              <span className="text-[var(--ff-text-dim)]">{fix.fixDescription}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function IssueRow({ issue }: { issue: ValidationIssue }) {
  const icon = issue.severity === 'error'
    ? <XCircle size={10} className="text-red-400" />
    : issue.severity === 'warning'
      ? <AlertTriangle size={10} className="text-amber-400" />
      : <Bug size={10} className="text-[var(--ff-text-dim)]" />;

  return (
    <div className="flex items-start gap-2 px-3 py-1.5 text-[11px] border-b border-[var(--ff-border)]/30 last:border-b-0 hover:bg-[var(--ff-surface-2)]/30">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-[var(--ff-text-muted)] truncate">
            {issue.filePath}{issue.line ? `:${issue.line}` : ''}
          </span>
          <span className="text-[9px] px-1 py-0.5 rounded bg-[var(--ff-surface-2)] text-[var(--ff-text-dim)] shrink-0 uppercase tracking-wider font-mono">
            {issue.code}
          </span>
        </div>
        <p className={cn(
          'mt-0.5',
          issue.severity === 'error' ? 'text-red-400' : 'text-[var(--ff-text-muted)]',
        )}>
          {issue.message}
        </p>
        {issue.suggestion && (
          <p className="text-[10px] text-emerald-500/80 mt-0.5">
            💡 {issue.suggestion}
          </p>
        )}
      </div>
      {issue.autoFixAvailable && (
        <span className="text-[8px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400 shrink-0">
          AUTO-FIX
        </span>
      )}
    </div>
  );
}

/* ---------- StackTrace ---------- */

interface StackFrame {
  file: string;
  line?: number;
  message: string;
}

interface StackTraceProps {
  frames: StackFrame[];
  error?: string;
  className?: string;
}

export function StackTrace({ frames, error, className }: StackTraceProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border border-red-500/25 bg-red-500/[0.03] overflow-hidden',
        className,
      )}
    >
      <div className="px-3 py-2 flex items-center gap-2 border-b border-red-500/15">
        <Bug size={12} className="text-red-400" />
        <span className="text-[11px] font-semibold text-red-400">Stack Trace</span>
      </div>
      {error && (
        <div className="px-3 py-2 border-b border-red-500/15">
          <p className="text-[12px] font-mono text-red-400 break-words">{error}</p>
        </div>
      )}
      <div className="px-3 py-2 space-y-1 max-h-48 overflow-y-auto ff-scrollbar">
        {frames.map((frame, index) => (
          <div key={index} className="flex items-start gap-2 text-[10px] font-mono">
            <span className="text-[var(--ff-text-dim)] shrink-0 w-4 text-right">
              {index}
            </span>
            <span className="text-red-400/80 break-all min-w-0">
              at {frame.file}{frame.line ? `:${frame.line}` : ''} — {frame.message}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ---------- TestResults ---------- */

export interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  duration?: number;
  error?: string;
}

interface TestResultsProps {
  results: TestResult[];
  className?: string;
}

export function TestResults({ results, className }: TestResultsProps) {
  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const skipped = results.filter((r) => r.status === 'skip').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border overflow-hidden',
        failed > 0
          ? 'border-red-500/25 bg-red-500/[0.03]'
          : 'border-emerald-500/25 bg-emerald-500/[0.03]',
        className,
      )}
    >
      <div className="px-3 py-2 flex items-center gap-2 border-b border-[var(--ff-border)]/60">
        <TestTube2 size={12} className={failed > 0 ? 'text-red-400' : 'text-emerald-400'} />
        <span className="text-[11px] font-semibold text-[var(--ff-text)]">Test Results</span>
        <div className="ml-auto flex items-center gap-2 text-[9px] font-mono">
          <span className="text-emerald-400">{passed} pass</span>
          {failed > 0 && <span className="text-red-400">{failed} fail</span>}
          {skipped > 0 && <span className="text-[var(--ff-text-dim)]">{skipped} skip</span>}
        </div>
      </div>
      <div className="px-3 py-2 space-y-1 max-h-48 overflow-y-auto ff-scrollbar">
        {results.map((result, index) => (
          <div key={index} className="flex items-center gap-2 py-0.5 text-[11px]">
            <span className="shrink-0">
              {result.status === 'pass' ? (
                <Check size={10} className="text-emerald-400" strokeWidth={3} />
              ) : result.status === 'fail' ? (
                <XCircle size={10} className="text-red-400" />
              ) : (
                <span className="text-[var(--ff-text-dim)]">—</span>
              )}
            </span>
            <span className={cn(
              'truncate',
              result.status === 'fail' ? 'text-red-400' : 'text-[var(--ff-text-muted)]',
              result.status === 'skip' && 'text-[var(--ff-text-dim)] italic',
            )}>
              {result.name}
            </span>
            {result.duration !== undefined && (
              <span className="ml-auto text-[9px] font-mono text-[var(--ff-text-dim)] shrink-0">
                {result.duration}ms
              </span>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
