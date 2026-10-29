import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem('ff-theme') as Theme | null;
  if (saved === 'light' || saved === 'dark') return saved;
  // Studio is a light-first product; the theme toggle still offers dark.
  return 'light';
}

function applyThemeToDom(theme: Theme) {
  localStorage.setItem('ff-theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
  // Tailwind `dark:` variant (class strategy) + generic `.light` hooks.
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  } else {
    document.documentElement.classList.add('light');
    document.documentElement.classList.remove('dark');
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getInitialTheme(),
  setTheme: (theme) => {
    applyThemeToDom(theme);
    set({ theme });
  },
  toggle: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },
}));

// Initialize on load
if (typeof window !== 'undefined') {
  applyThemeToDom(getInitialTheme());
}
