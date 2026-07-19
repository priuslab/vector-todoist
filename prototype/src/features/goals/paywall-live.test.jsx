import { render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { PaywallScreens } from './PaywallScreens';

it('starts server checkout without client secrets and shows the $100 Lifetime Pro paywall', async () => {
  const apiClient = { request: vi.fn(async () => ({ id: 'cs_1' })) };
  render(<PaywallScreens screenId="stripe-loading" apiClient={apiClient} />);
  await waitFor(() => expect(apiClient.request).toHaveBeenCalledWith('/api/v1/billing/checkout', expect.objectContaining({ method: 'POST' })));
  expect(screen.getByText('Відкриваємо Stripe Checkout')).toBeInTheDocument();
});

it('polls entitlement status and only reveals Pro after webhook-confirmed active status', async () => {
  const apiClient = { request: vi.fn(async () => ({ active: true })) };
  render(<PaywallScreens screenId="payment-success" apiClient={apiClient} />);
  await waitFor(() => expect(screen.getByText('Lifetime Pro активний')).toBeInTheDocument());
  expect(apiClient.request).toHaveBeenCalledWith('/api/v1/billing/status');
});

it('keeps the return state pending when Stripe has not produced an entitlement', async () => {
  const apiClient = { request: vi.fn(async () => ({ active: false })) };
  render(<PaywallScreens screenId="payment-success" apiClient={apiClient} />);
  expect(await screen.findByText('Підтверджуємо оплату')).toBeInTheDocument();
  expect(screen.queryByText('Lifetime Pro активний')).not.toBeInTheDocument();
});
