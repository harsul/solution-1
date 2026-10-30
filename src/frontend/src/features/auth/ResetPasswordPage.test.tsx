import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../../App';
import { fakeApi, fakeAuthBackend, json, status } from '../../test/fakeApi';
import { renderWithProviders } from '../../test/render';

const link = (code = 'valid', email = 'ada@example.com') =>
  `/reset-password?${new URLSearchParams({ email, code })}`;

async function choosePassword(password: string, repeat = password) {
  await userEvent.type(await screen.findByLabelText('New password'), password);
  await userEvent.type(screen.getByLabelText('Repeat new password'), repeat);
}

describe('ResetPasswordPage', () => {
  it('changes the password and sends the user to sign in, where the new password works', async () => {
    const { users } = fakeAuthBackend();
    users.set('ada@example.com', 'Passw0rd!');
    renderWithProviders(<App />, { route: link() });

    await choosePassword('N3wPassw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByText('Your password was changed. Please sign in.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(users.get('ada@example.com')).toBe('N3wPassw0rd!');
  });

  it('signs out a signed-in user after the change', async () => {
    const { fetchMock } = fakeAuthBackend({ signedInAs: 'ada@example.com' });
    renderWithProviders(<App />, { route: link() });

    await choosePassword('N3wPassw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByText('Your password was changed. Please sign in.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/auth/logout')).toBe(true);
  });

  it('blocks a password that breaks a rule or does not match', async () => {
    fakeAuthBackend();
    renderWithProviders(<App />, { route: link() });

    await choosePassword('short');
    expect(screen.getByText(/At least 8 characters/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change password' })).toBeDisabled();

    await userEvent.clear(screen.getByLabelText('New password'));
    await userEvent.clear(screen.getByLabelText('Repeat new password'));
    await choosePassword('N3wPassw0rd!', 'N3wPassw0rd?');
    expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change password' })).toBeDisabled();
  });

  it('shows the expired view for a used or expired link, with a way to request a new one', async () => {
    const { users } = fakeAuthBackend();
    users.set('ada@example.com', 'Passw0rd!');
    renderWithProviders(<App />, { route: link('old') });

    await choosePassword('N3wPassw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByRole('heading', { name: 'This link has expired' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Request a new link' }));
    expect(await screen.findByLabelText('Email')).toHaveValue('ada@example.com');
  });

  it('lets a signed-in user request a new link from the expired view', async () => {
    fakeAuthBackend({ signedInAs: 'ada@example.com' });
    renderWithProviders(<App />, { route: link('old') });

    await choosePassword('N3wPassw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    await userEvent.click(await screen.findByRole('link', { name: 'Request a new link' }));

    expect(await screen.findByLabelText('Email')).toHaveValue('ada@example.com');
  });

  it('tells the user the password changed when signing out fails', async () => {
    fakeApi({
      'GET /api/auth/manage/info': () => json({ email: 'ada@example.com', isEmailConfirmed: true }),
      'POST /api/auth/resetPassword': () => status(200),
      'POST /api/auth/logout': () => status(500),
    });
    renderWithProviders(<App />, { route: link() });

    await choosePassword('N3wPassw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByText(/Your password was changed\. Please sign out and sign in again/)).toBeInTheDocument();
  });

  it('shows the expired view when the link is incomplete', async () => {
    fakeAuthBackend();

    renderWithProviders(<App />, { route: '/reset-password?email=ada%40example.com' });

    expect(await screen.findByRole('heading', { name: 'This link has expired' })).toBeInTheDocument();
  });

  it('shows the server rule messages when the server rejects the password', async () => {
    fakeApi({
      'GET /api/auth/manage/info': () => status(401),
      'POST /api/auth/resetPassword': () =>
        json({ errors: { PasswordRequiresUniqueChars: ['Passwords must use at least 1 different characters.'] } }, 400),
    });
    renderWithProviders(<App />, { route: link() });

    await choosePassword('N3wPassw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Passwords must use at least 1 different characters.');
  });
});
