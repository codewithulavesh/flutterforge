import { useEffect } from 'react';
import { useWorkspaceStore } from '@/stores/workspace.store';

export function useKeyboardShortcuts() {
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);
  const setCommandPaletteOpen = useWorkspaceStore((s) => s.setCommandPaletteOpen);
  const setActiveView = useWorkspaceStore((s) => s.setActiveView);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const cmd = e.metaKey || e.ctrlKey;

      if (cmd && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      if (cmd && e.key === 'p' && !e.shiftKey) {
        e.preventDefault();
        setActiveView('files');
      }
      if (cmd && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
      if (cmd && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleSidebar, setCommandPaletteOpen, setActiveView]);
}
