import type { ComponentProps } from 'react';
import { cn } from '@/utils/cn';

type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'success'
  | 'warning'
  | 'error'
  | 'destructive'
  | 'info';

interface BadgeProps extends Omit<ComponentProps<'span'>, 'className'> {
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ variant = 'default', children, className, ...props }: BadgeProps) {
  const variants: Record<BadgeVariant, string> = {
    default: 'bg-[var(--ff-surface-2)] text-[var(--ff-text-muted)] border-[var(--ff-border)]',
    secondary: 'bg-[var(--ff-surface-2)] text-[var(--ff-text-muted)] border-[var(--ff-border)]',
    outline: 'bg-transparent text-[var(--ff-text-muted)] border-[var(--ff-border)]',
    success: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25',
    warning: 'bg-amber-500/10 text-amber-700 border-amber-500/25',
    error: 'bg-red-500/10 text-red-600 border-red-500/25',
    destructive: 'bg-red-500/10 text-red-600 border-red-500/25',
    info: 'bg-[#0381A8]/10 text-[#0381A8] border-[#0381A8]/25',
  };

  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border', variants[variant], className)} {...props}>
      {children}
    </span>
  );
}
