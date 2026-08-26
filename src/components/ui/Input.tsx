import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, id, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-[var(--ff-text-muted)] mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ff-text-dim)]">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'ff-input w-full px-3 py-2.5 text-sm placeholder:text-[var(--ff-text-dim)]',
              icon ? 'pl-10' : '',
              error && 'border-[var(--ff-error)]',
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="mt-1 text-xs text-[var(--ff-error)]">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
