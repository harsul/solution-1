import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { fakeApi, fakeAuthBackend, json, status } from '../../test/fakeApi';
import { renderWithProviders } from '../../test/render';

const reminder = /Please confirm your email address/;

afterEach(() => {
  sessionStorage.clear();
  vi.useRealTimers();
});

describe('ConfirmEmailBanner', () => {
  it('reminds a signed-in user whose email is not confirmed (also accounts from before this feature)', async () => {
    fakeAuthBackend({ signedInAs: 'ada@example.com', emailConfirmed: false });

    renderWithProviders(<App />);

    expect(await screen.findByText(reminder)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend email' })).toBeInTheDocument();
  });

  it('shows nothing once the email is confirmed', async () => {
    fakeAuthBackend({ signedInAs: 'ada@example.com', emailConfirmed: true });

    renderWithProviders(<App />);

    expect(await screen.findByText('Mild')).toBeInTheDocument();
    expect(screen.queryByText(reminder)).not.toBeInTheDocument();
  });

  it('resends the email, says so, and blocks another resend for a minute', async () => {
    const { resent } = fakeAuthBackend({ signedInAs: 'ada@example.com' });
    renderWithProviders(<App />);
    const resendButton = await screen.findByRole('button', { name: 'Resend email' });

    // Fake only the countdown's clock and interval, and only from here on: Testing Library's
    // findBy* helpers don't work with Vitest's fake timers, so the rest uses act() + getBy*.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    await act(async () => resendButton.click());

    expect(screen.getByText('Email sent to ada@example.com. Check your inbox.')).toBeInTheDocument();
    expect(resent).toEqual(['ada@example.com']);
    expect(screen.getByRole('button', { name: 'Resend in 60 s' })).toBeDisabled();

    await act(async () => vi.advanceTimersByTime(30_000));
    expect(screen.getByRole('button', { name: 'Resend in 30 s' })).toBeDisabled();

    await act(async () => vi.advanceTimersByTime(30_000));
    expect(screen.getByRole('button', { name: 'Resend email' })).toBeEnabled();
  });

  it('asks the user to wait when the server rate-limits the resend', async () => {
    fakeApi({
      'GET /api/auth/manage/info': () => json({ email: 'ada@example.com', isEmailConfirmed: false }),
      'GET /api/weatherforecast': () => json([]),
      'POST /api/auth/resendConfirmationEmail': () => status(429),
    });
    renderWithProviders(<App />);

    await userEvent.click(await screen.findByRole('button', { name: 'Resend email' }));

    expect(await screen.findByText('Please wait a minute before trying again.')).toBeInTheDocument();
  });

  it('stays closed after closing, until the user signs in again', async () => {
    const { users } = fakeAuthBackend({ signedInAs: 'ada@example.com' });
    users.set('ada@example.com', 'Passw0rd!');
    const { unmount } = renderWithProviders(<App />);

    await userEvent.click(await screen.findByRole('button', { name: 'Close' }));
    expect(screen.queryByText(reminder)).not.toBeInTheDocument();

    // Reload in the same tab: still closed.
    unmount();
    renderWithProviders(<App />);
    expect(await screen.findByText('Mild')).toBeInTheDocument();
    expect(screen.queryByText(reminder)).not.toBeInTheDocument();

    // Sign out and in again: the reminder is back.
    await userEvent.click(screen.getByRole('button', { name: 'Account menu for ada@example.com' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    await userEvent.type(await screen.findByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Passw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText(reminder)).toBeInTheDocument();
  });

  it('comes back after signing in again when the old session simply ended (no sign-out)', async () => {
    const { users } = fakeAuthBackend({ signedInAs: 'ada@example.com' });
    users.set('ada@example.com', 'Passw0rd!');
    const { unmount } = renderWithProviders(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Close' }));

    // The session ends on the server (e.g. expired), without the app signing out.
    unmount();
    await fetch('/api/auth/logout', { method: 'POST' });
    renderWithProviders(<App />);
    await userEvent.type(await screen.findByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Passw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText(reminder)).toBeInTheDocument();
  });

  it('comes back after signing out and in again in the same tab, without a reload', async () => {
    const { users } = fakeAuthBackend({ signedInAs: 'ada@example.com' });
    users.set('ada@example.com', 'Passw0rd!');
    renderWithProviders(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Close' }));

    await signOutAndIn('ada@example.com');

    expect(await screen.findByText(reminder)).toBeInTheDocument();
  });

  it("doesn't carry one user's resend message and countdown over to the next user", async () => {
    const { users } = fakeAuthBackend({ signedInAs: 'ada@example.com' });
    users.set('ada@example.com', 'Passw0rd!');
    users.set('bob@example.com', 'Passw0rd!');
    renderWithProviders(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Resend email' }));
    expect(await screen.findByText('Email sent to ada@example.com. Check your inbox.')).toBeInTheDocument();

    await signOutAndIn('bob@example.com', 'ada@example.com');

    expect(await screen.findByText(reminder)).toBeInTheDocument();
    expect(screen.queryByText(/Email sent to/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend email' })).toBeEnabled();
  });

  it('announces only the message, not the buttons or the countdown', async () => {
    fakeAuthBackend({ signedInAs: 'ada@example.com' });
    renderWithProviders(<App />);

    const live = await screen.findByRole('status');

    expect(live).toHaveTextContent(reminder);
    expect(within(live).queryByRole('button')).not.toBeInTheDocument();
  });
});

async function signOutAndIn(email: string, current = email) {
  await userEvent.click(screen.getByRole('button', { name: `Account menu for ${current}` }));
  await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
  await userEvent.type(await screen.findByLabelText('Email'), email);
  await userEvent.type(screen.getByLabelText('Password'), 'Passw0rd!');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}
