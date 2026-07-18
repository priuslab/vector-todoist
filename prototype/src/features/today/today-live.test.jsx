import { render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { TodayScreens } from './TodayScreens';

it('renders persisted Today data from the authenticated API', async () => {
  const apiClient = { request: vi.fn(async () => ({ date: '2026-07-18', timezone: 'Europe/Warsaw', tasks: [{ id: 'task-1', title: 'Підготувати структуру', status: 'scheduled', estimatedMinutes: 60, plannedStart: '2026-07-18T09:30:00+02:00', plannedEnd: '2026-07-18T10:30:00+02:00' }], blocks: [], warnings: [] })) };
  render(<TodayScreens apiClient={apiClient} />);
  await waitFor(() => expect(screen.getByText('Підготувати структуру')).toBeInTheDocument());
  expect(apiClient.request).toHaveBeenCalledWith(expect.stringContaining('/api/v1/today?'));
});
