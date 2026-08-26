import { cn } from '@/utils/cn';

export function Spinner({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <span
      className="inline-block border-2 border-current border-t-transparent rounded-full ff-spin"
      style={{ width: size, height: size }}
      aria-label="Loading"
    />
  );
}

export function FullPageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-[var(--ff-bg)]">
      <Spinner size={32} className="text-[var(--ff-primary)]" />
      {label && <p className="text-sm text-[var(--ff-text-muted)]">{label}</p>}
    </div>
  );
}

export function InlineSpinner({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-3 py-8', className)}>
      <Spinner size={20} className="text-[var(--ff-primary)]" />
      {label && <span className="text-sm text-[var(--ff-text-muted)]">{label}</span>}
    </div>
  );
}
