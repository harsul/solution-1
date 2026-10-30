import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../../App';
import { fakeApi, fakeAuthBackend, json, status } from '../../test/fakeApi';
import { renderWithProviders } from '../../test/render';

async function fillAndSubmit(email: string, password: string) {
  await userEvent.type(await screen.findByLabelText('Email'), email);
  await userEvent.type(screen.getByLabelText('Password'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('SignInPage', () => {
  it('signs in and shows the forecast', async () => {
    const { users } = fakeAuthBackend();
    users.set('ada@example.com', 'Passw0rd!');
    renderWithProviders(<App />, { route: '/signin' });

    await fillAndSubmit('ada@example.com', 'Passw0rd!');

    expect(await screen.findByText('Mild')).toBeInTheDocument();
  });

  it('shows a generic message for wrong credentials and stays on the page', async () => {
    fakeAuthBackend();
    renderWithProviders(<App />, { route: '/signin' });

    await fillAndSubmit('nobody@example.com', 'Wrong-passw0rd');

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('disables the button while signing in and ignores a second submit', async () => {
    let finishLogin: (response: Response) => void = () => {};
    const fetchMock = fakeApi({
      'GET /api/auth/manage/info': () => status(401),
      'POST /api/auth/login': () => new Promise<Response>((resolve) => (finishLogin = resolve)),
    });
    renderWithProviders(<App />, { route: '/signin' });

    await fillAndSubmit('ada@example.com', 'Passw0rd!');
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Password'), '{Enter}');

    const loginCalls = fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/auth/login'));
    expect(loginCalls).toHaveLength(1);
    finishLogin(json({ detail: 'Failed' }, 401));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('stays signed in when the session check from page load finishes after the sign-in', async () => {
    let session = false;
    let infoCalls = 0;
    let finishFirstCheck: (response: Response) => void = () => {};
    fakeApi({
      'GET /api/auth/manage/info': () => {
        infoCalls++;
        if (infoCalls === 1) return new Promise<Response>((resolve) => (finishFirstCheck = resolve));
        return session ? json({ email: 'ada@example.com', isEmailConfirmed: false }) : status(401);
      },
      'POST /api/auth/login': () => {
        session = true;
        return status(200);
      },
      'GET /api/weatherforecast': () =>
        json([{ date: '2026-11-01', temperatureC: 20, temperatureF: 67, summary: 'Mild' }]),
    });
    renderWithProviders(<App />, { route: '/signin' });

    await fillAndSubmit('ada@example.com', 'Passw0rd!');
    expect(await screen.findByText('Mild')).toBeInTheDocument();

    // The slow check sent on page load (before the cookie existed) arrives last.
    await act(async () => finishFirstCheck(status(401)));

    expect(screen.getByText('Mild')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('tells a locked-out user when to try again', async () => {
    fakeApi({
      'GET /api/auth/manage/info': () => status(401),
      'POST /api/auth/login': () => json({ detail: 'LockedOut' }, 401),
    });
    renderWithProviders(<App />, { route: '/signin' });

    await fillAndSubmit('ada@example.com', 'Passw0rd!');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This account is temporarily locked. Try again in 5 minutes.',
    );
  });

  it.each([
    [true, 'useCookies=true'],
    [false, 'useSessionCookies=true'],
  ])('Remember me %s signs in with %s', async (rememberMe, expectedQuery) => {
    const { fetchMock, users } = fakeAuthBackend();
    users.set('ada@example.com', 'Passw0rd!');
    renderWithProviders(<App />, { route: '/signin' });

    await userEvent.type(await screen.findByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Passw0rd!');
    if (rememberMe) await userEvent.click(screen.getByLabelText('Remember me'));
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await screen.findByText('Mild');
    const loginUrl = fetchMock.mock.calls.map(([url]) => String(url)).find((url) => url.startsWith('/api/auth/login'));
    expect(loginUrl).toBe(`/api/auth/login?${expectedQuery}`);
  });
});
