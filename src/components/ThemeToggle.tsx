import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '@/stores/theme.store';
import { cn } from '@/utils/cn';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useThemeStore();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode (${isDark ? '☀' : '☾'})`}
      aria-pressed={isDark}
      className={cn(
        'relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-[var(--ff-border)] bg-[var(--ff-surface)] hover:bg-[var(--ff-surface-2)] hover:border-[var(--ff-border-hover)] text-[var(--ff-text-muted)] hover:text-[var(--ff-text)] transition-all shrink-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ff-primary)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--ff-bg)]',
        className
      )}
    >
      <Sun
        size={16}
        aria-hidden
        className={cn(
          'absolute transition-all duration-300',
          isDark ? 'scale-0 rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100'
        )}
      />
      <Moon
        size={16}
        aria-hidden
        className={cn(
          'absolute transition-all duration-300',
          isDark ? 'scale-100 rotate-0 opacity-100' : 'scale-0 -rotate-90 opacity-0'
        )}
      />
    </button>
  );
}
