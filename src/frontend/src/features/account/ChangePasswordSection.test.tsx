import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../../App';
import { fakeApi, fakeAuthBackend, json, status } from '../../test/fakeApi';
import { renderWithProviders } from '../../test/render';

async function fill(current: string, password: string, repeat = password) {
  await userEvent.type(await screen.findByLabelText('Current password'), current);
  await userEvent.type(screen.getByLabelText('New password'), password);
  await userEvent.type(screen.getByLabelText('Repeat new password'), repeat);
}

const submit = () => userEvent.click(screen.getByRole('button', { name: 'Change password' }));

function signedInWith(handler: () => Response) {
  fakeApi({
    'GET /api/auth/manage/info': () => json({ email: 'ada@example.com', isEmailConfirmed: true }),
    'POST /api/auth/manage/info': handler,
  });
}

describe('ChangePasswordSection', () => {
  it('changes the password through manage/info, signs out and says so on the sign-in page', async () => {
    const { users, fetchMock } = fakeAuthBackend({ signedInAs: 'ada@example.com' });
    renderWithProviders(<App />, { route: '/account' });

    await fill('Passw0rd!', 'N3wPassw0rd!');
    await submit();

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('Your password was changed. Please sign in with your new password.')).toBeInTheDocument();
    expect(users.get('ada@example.com')).toBe('N3wPassw0rd!');
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/auth/logout')).toBe(true);
  });

  it('says when the current password is wrong and keeps the new one', async () => {
    const { users } = fakeAuthBackend({ signedInAs: 'ada@example.com' });
    renderWithProviders(<App />, { route: '/account' });

    await fill('Wrong-passw0rd', 'N3wPassw0rd!');
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Your current password is incorrect.');
    expect(users.get('ada@example.com')).toBe('Passw0rd!');
    expect(screen.getByLabelText('New password')).toHaveValue('N3wPassw0rd!');
    expect(screen.getByLabelText('Current password')).toHaveFocus();
  });

  it('still signs out with the notice when the sign-out request fails after the change', async () => {
    fakeApi({
      'GET /api/auth/manage/info': () => json({ email: 'ada@example.com', isEmailConfirmed: true }),
      'POST /api/auth/manage/info': () => json({ email: 'ada@example.com', isEmailConfirmed: true }),
      'POST /api/auth/logout': () => status(500),
    });
    renderWithProviders(<App />, { route: '/account' });

    await fill('Passw0rd!', 'N3wPassw0rd!');
    await submit();

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('Your password was changed. Please sign in with your new password.')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument();
  });

  it('shows the server rule messages', async () => {
    signedInWith(() => json({ errors: { PasswordRequiresUpper: ['Passwords must have an uppercase letter.'] } }, 400));
    renderWithProviders(<App />, { route: '/account' });

    await fill('Passw0rd!', 'N3wPassw0rd!');
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Passwords must have an uppercase letter.');
  });

  it('shows a generic message for unexpected errors', async () => {
    signedInWith(() => status(500));
    renderWithProviders(<App />, { route: '/account' });

    await fill('Passw0rd!', 'N3wPassw0rd!');
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  });

  it('blocks a new password that breaks a rule or does not match', async () => {
    fakeAuthBackend({ signedInAs: 'ada@example.com' });
    renderWithProviders(<App />, { route: '/account' });

    await fill('Passw0rd!', 'short');
    expect(screen.getByLabelText('New password')).toHaveAccessibleDescription(/At least 6 characters: not met/);
    expect(screen.getByRole('button', { name: 'Change password' })).toBeDisabled();

    await userEvent.clear(screen.getByLabelText('New password'));
    await userEvent.clear(screen.getByLabelText('Repeat new password'));
    await userEvent.type(screen.getByLabelText('New password'), 'N3wPassw0rd!');
    await userEvent.type(screen.getByLabelText('Repeat new password'), 'N3wPassw0rd?');
    expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change password' })).toBeDisabled();
  });
});
