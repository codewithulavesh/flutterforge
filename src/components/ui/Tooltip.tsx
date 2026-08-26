import { type ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface TooltipProps {
  label: string;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function Tooltip({ label, children, side = 'right', className }: TooltipProps) {
  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div className={cn('relative group inline-flex', className)}>
      {children}
      <div className={cn(
        'absolute z-50 px-2 py-1 text-xs font-medium rounded bg-[var(--ff-surface-2)] border border-[var(--ff-border)] text-[var(--ff-text)] whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity',
        positions[side]
      )}>
        {label}
      </div>
    </div>
  );
}
