import { render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { GoalScreens } from './GoalScreens';

it('renders the authenticated goal and exposes the free goal limit action', async () => {
  const apiClient = { request: vi.fn(async () => [{ id: 'goal-1', title: 'Запустити сезон подкасту', status: 'active', progress: 58 }]) };
  render(<GoalScreens apiClient={apiClient} />);
  await waitFor(() => expect(screen.getByText('Запустити сезон подкасту')).toBeInTheDocument());
  expect(apiClient.request).toHaveBeenCalledWith('/api/v1/goals');
  expect(screen.getByRole('button', { name: 'Додати ще одну мету' })).toBeInTheDocument();
});
