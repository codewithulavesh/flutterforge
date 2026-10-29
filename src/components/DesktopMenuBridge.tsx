import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { useProjectStore } from '@/stores/project.store';
import { HarnessClient } from '@/agent/harnessClient';
import { toast } from '@/components/ui/Toast';

/**
 * Bridges native Electron menu actions to the real React stores.
 * In a browser this component is a no-op (no preload bridge).
 */
export function DesktopMenuBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    const bridge = window.flutterforgeDesktop;
    if (!bridge?.onMenuAction) return;

    const openWorkspace = (action: string) => {
      if (!useProjectStore.getState().currentProject) {
        navigate('/dashboard');
        return;
      }
      useWorkspaceStore.getState().setActiveView(action as never);
    };

    const openFolder = async () => {
      const project = useProjectStore.getState().currentProject;
      if (!project) {
        toast('error', 'Open a project first.');
        return;
      }
      const workspace = await new HarnessClient().workspacePath(project.id);
      if (!workspace) {
        toast('error', 'No generated workspace yet — build the app first.');
        return;
      }
      const result = await bridge.openPath(workspace);
      if (!result.ok) toast('error', result.error || 'Could not open the project folder.');
    };

    const unsubscribe = bridge.onMenuAction((action) => {
      switch (action) {
        case 'new-project':
          navigate('/dashboard');
          window.setTimeout(() => window.dispatchEvent(new CustomEvent('ff:new-project')), 250);
          break;
        case 'dashboard':
          navigate('/dashboard');
          break;
        case 'open-folder':
          void openFolder();
          break;
        case 'toggle-bottom-panel': {
          const state = useWorkspaceStore.getState();
          state.setBottomPanelOpen(!state.bottomPanelOpen);
          break;
        }
        case 'new-chat':
        case 'focus-composer':
        case 'retry-last':
        case 'copy-last':
        case 'stop-generation': {
          useWorkspaceStore.getState().setActiveView('ai-builder');
          window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent(
              action === 'focus-composer' ? 'ff:focus-composer'
                : action === 'new-chat' ? 'ff:new-chat'
                  : action === 'retry-last' ? 'ff:retry-last'
                    : action === 'copy-last' ? 'ff:copy-last'
                      : 'ff:stop-generation',
            ));
          }, 120);
          break;
        }
        case 'shortcuts':
          toast('info', '⌘1 AI Builder · ⌘2 Preview · ⌘3 Files · ⌘4 Code · ⌘5 Terminal · ⌘N New project · ⌘⇧N New chat · ⌘L Focus chat · ⌘J Bottom panel');
          break;
        case 'preview':
        case 'files':
        case 'code':
        case 'terminal':
        case 'dependencies':
        case 'versions':
        case 'settings':
        case 'export':
          openWorkspace(action);
          break;
        default:
          break;
      }
    });

    return unsubscribe;
  }, [navigate]);

  return null;
}
