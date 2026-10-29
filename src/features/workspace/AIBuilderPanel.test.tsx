// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AIBuilderPanel } from './AIBuilderPanel';
import { useTerminalStore } from '@/stores/terminal.store';

const { projectState, sendMessageMock } = vi.hoisted(() => {
  const sendMessageMock = vi.fn();
  return {
    sendMessageMock,
    projectState: {
      messages: [],
      sendMessage: sendMessageMock,
      currentProject: { id: 'project-1', name: 'Demo', description: 'A sample project.' },
      conversation: null,
      files: [],
      repairBuild: vi.fn(),
      newConversation: vi.fn(),
    },
  };
});

vi.mock('@/stores/project.store', () => ({ useProjectStore: () => projectState }));
vi.mock('@/stores/workspace.store', () => ({
  useWorkspaceStore: () => ({ openFile: vi.fn(), activeFile: null }),
}));
vi.mock('@/stores/preview.store', () => ({
  usePreviewStore: () => ({ getSession: vi.fn(() => null) }),
}));
vi.mock('@/agent/harnessClient', () => ({
  HarnessClient: class {
    isHealthy() { return Promise.resolve(false); }
  },
}));
vi.mock('@/agent/chatContext', () => ({
  ChatContextHandler: { build: () => ({
    summary: 'A sample project.',
    fileCount: 0,
    screenCount: 0,
    backend: 'local',
    history: [],
    tokenEstimate: 10,
    activeFile: null,
  }) },
}));
vi.mock('@/components/ui/Toast', () => ({ toast: vi.fn() }));
vi.mock('@/components/BrandLogo', () => ({ BrandLogo: () => <span>Logo</span> }));
vi.mock('@/features/workspace/AgentActivityPopover', () => ({ AgentActivityPopover: () => null }));
vi.mock('@/components/ui/Dropdown', () => ({
  Dropdown: ({ trigger, children }: { trigger: React.ReactNode; children: React.ReactNode }) => <>{trigger}{children}</>,
  DropdownItem: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
}));

describe('AIBuilderPanel realtime chat', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    });
    sendMessageMock.mockReset();
    projectState.messages = [];
    projectState.conversation = null;
    useTerminalStore.setState({
      isGenerating: false,
      isAnswering: false,
      currentPhase: null,
      generationError: null,
      lines: [],
      liveFiles: [],
    });
  });

  afterEach(() => {
    cleanup();
    useTerminalStore.setState({ isAnswering: false, isGenerating: false, currentPhase: null, generationError: null });
  });

  it('renders chat tokens before the send request finishes', async () => {
    let finishRequest: ((result: { mode: 'chat' }) => void) | undefined;
    sendMessageMock.mockImplementation((_projectId, _content, _progress, options) => {
      options.onToken('The answer is arriving ');
      return new Promise((resolve) => { finishRequest = resolve; });
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AIBuilderPanel variant="page" />
      </MemoryRouter>,
    );

    await user.type(screen.getByPlaceholderText('Ask anything'), 'How does this project work?');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByText('The answer is arriving')).toBeTruthy();
    expect(sendMessageMock).toHaveBeenCalledOnce();
    finishRequest?.({ mode: 'chat' });
    await waitFor(() => expect(useTerminalStore.getState().isAnswering).toBe(false));
  });

  it('shows the live thought chain while the agent is designing architecture', () => {
    useTerminalStore.setState({
      isGenerating: true,
      currentPhase: 'Designing the app architecture',
    });

    render(
      <MemoryRouter>
        <AIBuilderPanel variant="page" />
      </MemoryRouter>,
    );

    expect(screen.getByText(/LIVE ·/)).toBeTruthy();
    // Header title + the active ThoughtChain step share the phase label.
    expect(screen.getAllByText('Designing the app architecture').length).toBeGreaterThan(0);
    expect(screen.getByText('In progress')).toBeTruthy();
    expect(screen.getByText('Understanding the brief')).toBeTruthy();
    expect(screen.getByText('Writing Flutter files')).toBeTruthy();
    // Detail text appears in both the card header and the active chain item.
    expect(screen.getAllByText('Shaping the app structure and deciding how its screens fit together.').length).toBeGreaterThan(0);
  });
});