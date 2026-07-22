import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { IntegrationRow } from './IntegrationRows';
import { OnboardingFlow } from '../onboarding/OnboardingFlow';

it.each([
  ['connected', 'Підключено'],
  ['attention', 'Потребує уваги'],
  ['disabled', 'Вимкнено'],
])('shows the Ukrainian Calendar status %s', (status, label) => {
  render(<IntegrationRow type="calendar" status={status} />);
  expect(screen.getByText(label)).toBeInTheDocument();
});

it('offers Calendar permission and a safe skip during onboarding', () => {
  const connect = () => {};
  const skip = () => {};
  render(<OnboardingFlow screenId="calendar-permission" onCalendarConnect={connect} onCalendarSkip={skip} onBack={() => {}} onNext={() => {}} />);
  expect(screen.getByRole('button', { name: 'Надати доступ' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Пропустити' })).toBeInTheDocument();
  expect(screen.getByText(/не бачитиме зайняті слоти/i)).toBeInTheDocument();
});
