import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SettingsScreens } from './SettingsScreens';
describe('adaptation settings', () => { it('uses supportive explicit controls', () => { render(<SettingsScreens screenId="settings-adaptation" />); expect(screen.getByText('Прийняти зміну')).toBeTruthy(); expect(screen.getByText('Залишити як є')).toBeTruthy(); expect(screen.getByText(/не змінюється без твоєї згоди/)).toBeTruthy(); }); });
