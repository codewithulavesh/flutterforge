// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspacePage } from './WorkspacePage';

const { mockUseProjectStore } = vi.hoisted(() => ({
  mockUseProjectStore: vi.fn(),
}));

vi.mock('@/stores/project.store', () => ({
  useProjectStore: mockUseProjectStore,
}));

vi.mock('@/stores/workspace.store', () => ({
  useWorkspaceStore: () => ({
    activeView: 'ai-builder',
    bottomPanelOpen: false,
    bottomPanelTab: 'terminal',
    setBottomPanelTab: vi.fn(),
    setBottomPanelOpen: vi.fn(),
  }),
}));

vi.mock('@/hooks/useKeyboardShortcuts', () => ({ useKeyboardShortcuts: vi.fn() }));
vi.mock('@/features/workspace/WorkspaceToolbar', () => ({ WorkspaceToolbar: () => <div>WorkspaceHeader</div> }));
vi.mock('@/features/workspace/AIBuilderPanel', () => ({ AIBuilderPanel: () => null }));
vi.mock('@/features/workspace/FileExplorer', () => ({ FileExplorer: () => null }));
vi.mock('@/features/workspace/CodeEditor', () => ({ CodeEditor: () => null }));
vi.mock('@/features/workspace/PreviewPanel', () => ({ PreviewPanel: () => null }));
vi.mock('@/features/workspace/TerminalPanel', () => ({ TerminalPanel: () => null }));
vi.mock('@/features/workspace/BuildOutputPanel', () => ({ BuildOutputPanel: () => null }));
vi.mock('@/features/workspace/DependenciesView', () => ({ DependenciesView: () => null }));
vi.mock('@/features/workspace/VersionsView', () => ({ VersionsView: () => null }));
vi.mock('@/features/workspace/SettingsView', () => ({ SettingsView: () => null }));
vi.mock('@/features/workspace/ExportView', () => ({ ExportView: () => null }));
vi.mock('@/features/workspace/CommandPalette', () => ({ CommandPalette: () => null }));

describe('WorkspacePage routing', () => {
  beforeEach(() => {
    mockUseProjectStore.mockReset();
    mockUseProjectStore.mockReturnValue({
      currentProject: null,
      loading: false,
      loadProject: vi.fn(),
      clearCurrent: vi.fn(),
    });
  });

  afterEach(() => cleanup());

  it('redirects to the dashboard when the requested project is missing', async () => {
    render(
      <MemoryRouter initialEntries={['/project/missing']}>
        <Routes>
          <Route path="/project/:projectId" element={<WorkspacePage />} />
          <Route path="/dashboard" element={<h1>Dashboard</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeTruthy();
  });

  it('renders the workspace header when a project is loaded', async () => {
    mockUseProjectStore.mockReturnValue({
      currentProject: { id: 'proj-1', name: 'Sample Project', status: 'ready' },
      loading: false,
      loadProject: vi.fn(),
      clearCurrent: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/project/proj-1']}>
        <Routes>
          <Route path="/project/:projectId" element={<WorkspacePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('WorkspaceHeader')).toBeTruthy();
  });
});