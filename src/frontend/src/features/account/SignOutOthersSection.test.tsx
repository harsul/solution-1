import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../../App';
import { fakeApi, fakeAuthBackend, json, status } from '../../test/fakeApi';
import { renderWithProviders } from '../../test/render';

const openDialog = async () =>
  userEvent.click(await screen.findByRole('button', { name: 'Sign out other devices' }));

describe('SignOutOthersSection', () => {
  it('signs out the other devices after confirming and stays signed in', async () => {
    const { signedOutOthers, fetchMock } = fakeAuthBackend({ signedInAs: 'ada@example.com' });
    renderWithProviders(<App />, { route: '/account' });

    await openDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out others' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("You've been signed out on all other devices.");
    expect(signedOutOthers).toEqual(['ada@example.com']);
    // This browser is not signed out.
    expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/auth/logout')).toBe(false);
    expect(screen.getByRole('button', { name: 'Account menu for ada@example.com' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('does nothing when cancelled', async () => {
    const { signedOutOthers } = fakeAuthBackend({ signedInAs: 'ada@example.com' });
    renderWithProviders(<App />, { route: '/account' });

    await openDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(signedOutOthers).toEqual([]);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says when it failed', async () => {
    fakeApi({
      'GET /api/auth/manage/info': () => json({ email: 'ada@example.com', isEmailConfirmed: true }),
      'POST /api/account/sign-out-others': () => status(500),
    });
    renderWithProviders(<App />, { route: '/account' });

    await openDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out others' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  });
});
