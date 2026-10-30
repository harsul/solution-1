import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../../App';
import { fakeApi, fakeAuthBackend, json, status } from '../../test/fakeApi';
import { renderWithProviders } from '../../test/render';

describe('UserMenu', () => {
  it('shows the email and signs out to the sign-in page', async () => {
    fakeAuthBackend({ signedInAs: 'ada@example.com' });
    renderWithProviders(<App />);

    await userEvent.click(await screen.findByRole('button', { name: 'Account menu for ada@example.com' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Account menu/ })).not.toBeInTheDocument();
  });

  it('stays signed in and says so when signing out fails', async () => {
    fakeApi({
      'GET /api/auth/manage/info': () => json({ email: 'ada@example.com', isEmailConfirmed: false }),
      'POST /api/auth/logout': () => status(500),
      'GET /api/weatherforecast': () => json([]),
    });
    renderWithProviders(<App />);

    await userEvent.click(await screen.findByRole('button', { name: 'Account menu for ada@example.com' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    expect(await screen.findByText(/Sign-out failed/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account menu for ada@example.com' })).toBeInTheDocument();
  });
});
