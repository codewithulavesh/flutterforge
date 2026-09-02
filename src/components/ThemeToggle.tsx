import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '@/stores/theme.store';
import { cn } from '@/utils/cn';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useThemeStore();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className={cn(
        'relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-[var(--ff-border)] bg-[var(--ff-surface)] hover:bg-[var(--ff-surface-2)] text-[var(--ff-text-muted)] hover:text-[var(--ff-text)] transition-all shrink-0',
        className
      )}
    >
      <Sun
        size={16}
        className={cn(
          'absolute transition-all duration-300',
          isDark ? 'scale-0 rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100'
        )}
      />
      <Moon
        size={16}
        className={cn(
          'absolute transition-all duration-300',
          isDark ? 'scale-100 rotate-0 opacity-100' : 'scale-0 -rotate-90 opacity-0'
        )}
      />
    </button>
  );
}

export function ThemeToggleWithLabel({ className }: { className?: string }) {
  const { theme, toggle } = useThemeStore();
  const isDark = theme === 'dark';
  return (
    <button
      onClick={toggle}
      className={cn(
        'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[var(--ff-border)] bg-[var(--ff-surface)] hover:bg-[var(--ff-surface-2)] text-xs text-[var(--ff-text-muted)] hover:text-[var(--ff-text)] transition-colors',
        className
      )}
    >
      {isDark ? <Sun size={14} /> : <Moon size={14} />}
      <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
    </button>
  );
}
