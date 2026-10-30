import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../../App';
import { fakeApi, fakeAuthBackend, json, status } from '../../test/fakeApi';
import { renderWithProviders } from '../../test/render';

async function fillForm(email: string, password: string, repeat = password) {
  await userEvent.type(await screen.findByLabelText('Email'), email);
  await userEvent.type(screen.getByLabelText('Password'), password);
  await userEvent.type(screen.getByLabelText('Repeat password'), repeat);
}

describe('RegisterPage', () => {
  it('registers, signs in automatically and shows the forecast', async () => {
    fakeAuthBackend();
    renderWithProviders(<App />, { route: '/register' });

    await fillForm('new@example.com', 'Passw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Mild')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account menu for new@example.com' })).toBeInTheDocument();
  });

  it('blocks submitting when the two passwords differ', async () => {
    fakeAuthBackend();
    renderWithProviders(<App />, { route: '/register' });

    await fillForm('new@example.com', 'Passw0rd!', 'Passw0rd?');

    expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
  });

  it('shows the server errors when registration fails', async () => {
    const { users } = fakeAuthBackend();
    users.set('taken@example.com', 'Passw0rd!');
    renderWithProviders(<App />, { route: '/register' });

    await fillForm('taken@example.com', 'Passw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Username 'taken@example.com' is already taken.");
  });

  it('sends the user to sign in with a notice when the account was created but signing in failed', async () => {
    fakeApi({
      'GET /api/auth/manage/info': () => status(401),
      'POST /api/auth/register': () => status(200),
      'POST /api/auth/login': () => status(500),
    });
    renderWithProviders(<App />, { route: '/register' });

    await fillForm('new@example.com', 'Passw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('Account created, please sign in.')).toBeInTheDocument();
  });

  it('disables the button while creating the account and ignores a second submit', async () => {
    let finishRegister: (response: Response) => void = () => {};
    const fetchMock = fakeApi({
      'GET /api/auth/manage/info': () => status(401),
      'POST /api/auth/register': () => new Promise<Response>((resolve) => (finishRegister = resolve)),
    });
    renderWithProviders(<App />, { route: '/register' });

    await fillForm('new@example.com', 'Passw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Repeat password'), '{Enter}');

    expect(fetchMock.mock.calls.filter(([url]) => String(url) === '/api/auth/register')).toHaveLength(1);
    finishRegister(json({ errors: { InvalidEmail: ['Email is invalid.'] } }, 400));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email is invalid.');
  });
});
