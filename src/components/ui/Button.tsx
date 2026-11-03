import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils/cn';

// 'default' is an alias of 'primary' so shadcn-style call sites (AI Elements)
// work against this design-system button without a second component.
type Variant =
  | 'primary'
  | 'default'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'destructive'
  | 'outline';
// 'icon*' sizes are square buttons (shadcn vocabulary).
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, icon, children, disabled, ...props }, ref) => {
    const variants: Record<Variant, string> = {
      primary: 'ff-btn-primary',
      default: 'ff-btn-primary',
      secondary: 'bg-[var(--ff-surface-2)] text-[var(--ff-text)] border border-[var(--ff-border)] hover:bg-[var(--ff-border)] transition-colors',
      ghost: 'ff-btn-ghost',
      danger: 'bg-red-600 text-white hover:bg-red-700 transition-colors',
      destructive: 'bg-red-600 text-white hover:bg-red-700 transition-colors',
      outline: 'border border-[var(--ff-border)] text-[var(--ff-text)] hover:border-[var(--ff-primary)] hover:text-[var(--ff-primary)] transition-colors',
    };

    const sizes: Record<Size, string> = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
      icon: 'h-9 w-9 p-0',
      'icon-sm': 'h-8 w-8 p-0',
      'icon-lg': 'h-10 w-10 p-0',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full ff-spin" />
        ) : (
          icon
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
