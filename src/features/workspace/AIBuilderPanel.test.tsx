// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AIBuilderPanel } from './AIBuilderPanel';
import { useTerminalStore } from '@/stores/terminal.store';
import { useActivityStore } from '@/stores/activity.store';

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
    useActivityStore.getState().clear();
  });

  afterEach(() => {
    cleanup();
    useActivityStore.getState().clear();
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

    await user.type(screen.getByPlaceholderText('Ask about the project, or describe what to build next…'), 'How does this project work?');
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('The answer is arriving')).toBeTruthy();
    expect(sendMessageMock).toHaveBeenCalledOnce();
    finishRequest?.({ mode: 'chat' });
    await waitFor(() => expect(useTerminalStore.getState().isAnswering).toBe(false));
  });

  it('shows the live agent timeline, sources, queue and terminal of a running generation', () => {
    const activity = useActivityStore.getState();
    activity.begin('project-1', 'Build a pomodoro timer', true, 'google/gemini-2.0-flash:free');
    activity.ingestProgress('Understanding the brief');
    activity.ingestProgress('Planning the app architecture');
    activity.ingestProgress('lib/main.dart created');
    activity.ingestFile({ path: 'lib/main.dart', action: 'created', content: '', language: 'dart', node: 'file_ready' });
    useActivityStore.setState({
      plan: {
        appName: 'Pomodoro Timer',
        appDescription: 'A focused timer app.',
        architecture: 'feature_first',
        stateManagement: 'provider',
        screens: [{ name: 'Home', routePath: '/', filePath: 'lib/screens/home_screen.dart' }],
        filesToCreate: ['lib/main.dart', 'lib/screens/home_screen.dart', 'lib/widgets/timer_ring.dart'],
      } as never,
    });
    useTerminalStore.setState({
      isGenerating: true,
      currentPhase: 'Planning the app architecture',
    });

    render(
      <MemoryRouter>
        <AIBuilderPanel variant="page" />
      </MemoryRouter>,
    );

    // Agent card identifies the run and its model.
    expect(screen.getByText('FlutterForge Agent')).toBeTruthy();
    expect(screen.getByText('gemini 2.0 flash')).toBeTruthy();
    // The two ingested progress messages become chain-of-thought steps.
    expect(screen.getByText('Planning the app architecture')).toBeTruthy();
    expect(screen.getByText('Understanding the brief')).toBeTruthy();
    // Sources list the file the engine produced.
    expect(screen.getByText('Used 1 project sources')).toBeTruthy();
    // Queued plan files that have not been generated yet show as in progress.
    expect(screen.getByText(/in progress/)).toBeTruthy();
    // The terminal accumulates every streaming line, ready to expand.
    expect(screen.getByText(/Live logs · 3 lines/)).toBeTruthy();
  });
});