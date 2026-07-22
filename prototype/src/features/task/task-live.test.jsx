import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { TaskScreens } from './TaskScreens';

it('edits and completes an authenticated task through the injected API', async () => {
  const apiClient = { request: vi.fn(async (path, init) => {
    if (path.startsWith('/api/v1/tasks/') && init?.method === 'PATCH') return { task: { id: 'task-1', title: 'Оновлена задача', status: 'scheduled', priority: 'high', estimatedMinutes: 60 }, changeSet: { id: 'change-1' } };
    if (path.endsWith('/complete')) return { task: { id: 'task-1', title: 'Оновлена задача', status: 'completed', priority: 'high', estimatedMinutes: 60 }, changeSet: { id: 'change-2' } };
    return { id: 'task-1', title: 'Початкова задача', status: 'scheduled', priority: 'high', estimatedMinutes: 60 };
  }) };
  const user = userEvent.setup();
  render(<TaskScreens apiClient={apiClient} taskId="task-1" screenId="task-edit" />);
  await waitFor(() => expect(screen.getByDisplayValue('Початкова задача')).toBeInTheDocument());
  await user.clear(screen.getByDisplayValue('Початкова задача')); await user.type(screen.getByLabelText('Назва'), 'Оновлена задача'); await user.click(screen.getByRole('button', { name: 'Зберегти зміни' }));
  expect(apiClient.request).toHaveBeenCalledWith('/api/v1/tasks/task-1', expect.objectContaining({ method: 'PATCH' }));
});
