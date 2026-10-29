// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateProjectWizard } from './CreateProjectWizard';

const { createProjectMock, toastMock } = vi.hoisted(() => ({
  createProjectMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock('@/stores/project.store', () => ({
  useProjectStore: Object.assign(
    vi.fn(() => ({ createProject: createProjectMock })),
    { getState: () => ({ error: null }) },
  ),
}));

vi.mock('@/components/ui/Toast', () => ({ toast: toastMock }));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-state">{JSON.stringify({ pathname: location.pathname, state: location.state })}</output>;
}

describe('CreateProjectWizard generation handoff', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    createProjectMock.mockReset();
    toastMock.mockReset();
  });

  it('passes the project and initial prompt into workspace navigation', async () => {
    createProjectMock.mockResolvedValueOnce({ id: 'project-1' });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CreateProjectWizard open onClose={vi.fn()} />
        <LocationProbe />
      </MemoryRouter>,
    );

    await user.type(screen.getByPlaceholderText(/Describe your Flutter app/i), 'A local habit tracker');
    await user.click(screen.getAllByRole('button', { name: 'Generate App' })[0]);

    await waitFor(() => expect(screen.getByTestId('location-state').textContent).toContain('/project/project-1'));
    const handoff = JSON.parse(screen.getByTestId('location-state').textContent ?? '{}');
    expect(handoff.state.initialPrompt).toBe('A local habit tracker');
    expect(handoff.state.richPrompt).toContain('Description: A local habit tracker');
  });

  it('shows create failures and unlocks the form for retry', async () => {
    createProjectMock.mockRejectedValueOnce(new Error('Network unavailable'));
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CreateProjectWizard open onClose={vi.fn()} />
      </MemoryRouter>,
    );

    const prompt = screen.getAllByPlaceholderText(/Describe your Flutter app/i)[0];
    await user.type(prompt, 'A local habit tracker');
    await user.click(screen.getAllByRole('button', { name: 'Generate App' })[0]);

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('error', 'Network unavailable'));
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Generate App' }).every((button) => !button.hasAttribute('disabled'))).toBe(true);
    });
    expect((prompt as HTMLTextAreaElement).value).toBe('A local habit tracker');
  });
});