import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import ColorModeToggle from './ColorModeToggle';
import { renderWithTheme } from '../test/render';

describe('ColorModeToggle', () => {
  it('follows the system setting by default', async () => {
    renderWithTheme(<ColorModeToggle />);

    expect(await screen.findByRole('button', { name: 'System mode' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches to the chosen mode', async () => {
    renderWithTheme(<ColorModeToggle />);

    await userEvent.click(await screen.findByRole('button', { name: 'Dark mode' }));

    expect(screen.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'System mode' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('remembers the choice after the app is reloaded', async () => {
    const { unmount } = renderWithTheme(<ColorModeToggle />);
    await userEvent.click(await screen.findByRole('button', { name: 'Light mode' }));
    unmount();

    renderWithTheme(<ColorModeToggle />);

    expect(await screen.findByRole('button', { name: 'Light mode' })).toHaveAttribute('aria-pressed', 'true');
  });
});
