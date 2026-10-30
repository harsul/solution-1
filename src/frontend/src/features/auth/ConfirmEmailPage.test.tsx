import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../../App';
import { fakeApi, fakeAuthBackend, json, status } from '../../test/fakeApi';
import { renderWithProviders } from '../../test/render';

const link = (userId: string, code: string) => `/confirm-email?userId=${encodeURIComponent(userId)}&code=${code}`;

describe('ConfirmEmailPage', () => {
  it('confirms a valid link for a signed-out visitor and offers sign in', async () => {
    const { confirmed } = fakeAuthBackend();

    renderWithProviders(<App />, { route: link('ada@example.com', 'valid') });

    expect(await screen.findByRole('heading', { name: 'Email confirmed' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/signin');
    expect(confirmed.has('ada@example.com')).toBe(true);
  });

  it('confirms a valid link for a signed-in user, refreshes the account and offers the app', async () => {
    const { fetchMock } = fakeAuthBackend({ signedInAs: 'ada@example.com' });

    renderWithProviders(<App />, { route: link('ada@example.com', 'valid') });

    expect(await screen.findByRole('heading', { name: 'Email confirmed' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the app' })).toHaveAttribute('href', '/');
    const infoCalls = fetchMock.mock.calls.filter(([url]) => String(url) === '/api/auth/manage/info');
    expect(infoCalls.length).toBeGreaterThanOrEqual(2); // initial check + refresh after confirming
  });

  it('shows "no longer valid" with sign in for a signed-out visitor', async () => {
    fakeAuthBackend();

    renderWithProviders(<App />, { route: link('ada@example.com', 'expired') });

    expect(await screen.findByRole('heading', { name: 'This link is no longer valid' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('lets a signed-in user resend the email from an invalid link', async () => {
    const { resent } = fakeAuthBackend({ signedInAs: 'ada@example.com' });
    renderWithProviders(<App />, { route: link('ada@example.com', 'expired') });

    await userEvent.click(await screen.findByRole('button', { name: 'Resend email' }));

    expect(await screen.findByText('Email sent to ada@example.com. Check your inbox.')).toBeInTheDocument();
    expect(resent).toEqual(['ada@example.com']);
  });

  it('treats a link without userId or code as invalid without calling the API', async () => {
    const { fetchMock } = fakeAuthBackend();

    renderWithProviders(<App />, { route: '/confirm-email' });

    expect(await screen.findByRole('heading', { name: 'This link is no longer valid' })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith('/api/auth/confirmEmail'))).toBe(false);
  });

  it('shows "Email confirmed" to a confirmed user opening an old link, without offering resend', async () => {
    const { resent } = fakeAuthBackend({ signedInAs: 'ada@example.com', emailConfirmed: true });

    renderWithProviders(<App />, { route: link('ada@example.com', 'expired') });

    expect(await screen.findByRole('heading', { name: 'Email confirmed' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resend email' })).not.toBeInTheDocument();
    expect(resent).toEqual([]);
  });

  it('shows an error state when the server fails, distinct from an invalid link', async () => {
    fakeApi({
      'GET /api/auth/manage/info': () => json({ email: 'ada@example.com', isEmailConfirmed: false }),
      'GET /api/auth/confirmEmail': () => status(500),
    });

    renderWithProviders(<App />, { route: link('ada@example.com', 'valid') });

    expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the app' })).toBeInTheDocument();
  });
});
