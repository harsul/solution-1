import { StrictMode } from 'react';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../App';
import { fakeApi, fakeAuthBackend, status } from '../../test/fakeApi';
import { renderWithProviders } from '../../test/render';

const link = (code = 'valid', userId = 'ada@example.com', email = 'ada@new.example') =>
  `/confirm-email-change?${new URLSearchParams({ userId, email, code })}`;

describe('ConfirmEmailChangePage', () => {
  it('changes the email of the signed-in user and shows the new address', async () => {
    fakeAuthBackend({ signedInAs: 'ada@example.com' });
    renderWithProviders(<App />, { route: link() });

    expect(await screen.findByRole('heading', { name: 'Email changed' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('From now on, sign in with ada@new.example.');
    expect(await screen.findByRole('button', { name: 'Account menu for ada@new.example' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Account settings' })).toHaveAttribute('href', '/account');
  });

  it('works when signed out and offers sign-in', async () => {
    const { users } = fakeAuthBackend();
    users.set('ada@example.com', 'Passw0rd!');
    renderWithProviders(<App />, { route: link() });

    expect(await screen.findByRole('heading', { name: 'Email changed' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(users.has('ada@new.example')).toBe(true);
  });

  it('says when the link is used or expired', async () => {
    fakeAuthBackend({ signedInAs: 'ada@example.com' });
    renderWithProviders(<App />, { route: link('old') });

    expect(await screen.findByRole('heading', { name: 'This link is no longer valid' })).toBeInTheDocument();
  });

  it('shows the invalid view without calling the server when values are missing', async () => {
    const fetchMock = fakeAuthBackend().fetchMock;

    renderWithProviders(<App />, { route: '/confirm-email-change?userId=x' });

    expect(await screen.findByRole('heading', { name: 'This link is no longer valid' })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/account/email/confirm'))).toBe(false);
  });

  it('says when the address was taken meanwhile', async () => {
    const { users } = fakeAuthBackend();
    users.set('ada@example.com', 'Passw0rd!');
    users.set('ada@new.example', 'Other-passw0rd');
    renderWithProviders(<App />, { route: link() });

    expect(await screen.findByRole('alert')).toHaveTextContent('This email address is already in use.');
  });

  it('confirms only once under StrictMode and hides the confirm-email reminder', async () => {
    const { fetchMock } = fakeAuthBackend({ signedInAs: 'ada@example.com' });

    renderWithProviders(
      <StrictMode>
        <App />
      </StrictMode>,
      { route: link() },
    );

    expect(await screen.findByRole('heading', { name: 'Email changed' })).toBeInTheDocument();
    const confirms = fetchMock.mock.calls.filter(([url]) => String(url) === '/api/account/email/confirm');
    expect(confirms).toHaveLength(1);
    expect(screen.queryByText(/Please confirm your email address/)).not.toBeInTheDocument();
  });

  it('does not offer Account settings to another signed-in user', async () => {
    const { users } = fakeAuthBackend({ signedInAs: 'bob@example.com' });
    users.set('ada@example.com', 'Passw0rd!');
    renderWithProviders(<App />, { route: link() });

    expect(await screen.findByRole('heading', { name: 'Email changed' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the app' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('button', { name: 'Account menu for bob@example.com' })).toBeInTheDocument();
  });

  it('shows an error for unexpected failures', async () => {
    fakeApi({
      'GET /api/auth/manage/info': () => status(401),
      'POST /api/account/email/confirm': () => status(500),
    });
    renderWithProviders(<App />, { route: link() });

    expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
  });
});
