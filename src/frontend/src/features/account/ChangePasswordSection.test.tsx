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
    'POST /api/account/password': handler,
  });
}

describe('ChangePasswordSection', () => {
  it('changes the password, says so and clears the fields', async () => {
    const { users } = fakeAuthBackend({ signedInAs: 'ada@example.com' });
    renderWithProviders(<App />, { route: '/account' });

    await fill('Passw0rd!', 'N3wPassw0rd!');
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Your password was changed.');
    expect(users.get('ada@example.com')).toBe('N3wPassw0rd!');
    expect(screen.getByLabelText('Current password')).toHaveValue('');
    expect(screen.getByLabelText('New password')).toHaveValue('');
    expect(screen.getByLabelText('Current password')).toHaveFocus();
  });

  it('says when the current password is wrong', async () => {
    const { users } = fakeAuthBackend({ signedInAs: 'ada@example.com' });
    renderWithProviders(<App />, { route: '/account' });

    await fill('Wrong-passw0rd', 'N3wPassw0rd!');
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Your current password is incorrect.');
    expect(users.get('ada@example.com')).toBe('Passw0rd!');
    expect(screen.getByLabelText('New password')).toHaveValue('N3wPassw0rd!');
  });

  it('shows the lockout message', async () => {
    signedInWith(() => json({ errors: { LockedOut: ['Locked.'] } }, 400));
    renderWithProviders(<App />, { route: '/account' });

    await fill('Passw0rd!', 'N3wPassw0rd!');
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This account is temporarily locked. Try again in 5 minutes.',
    );
  });

  it('shows the server rule messages', async () => {
    signedInWith(() => json({ errors: { PasswordRequiresUniqueChars: ['Use more different characters.'] } }, 400));
    renderWithProviders(<App />, { route: '/account' });

    await fill('Passw0rd!', 'N3wPassw0rd!');
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Use more different characters.');
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
    expect(screen.getByLabelText('New password')).toHaveAccessibleDescription(/At least 8 characters: not met/);
    expect(screen.getByRole('button', { name: 'Change password' })).toBeDisabled();

    await userEvent.clear(screen.getByLabelText('New password'));
    await userEvent.clear(screen.getByLabelText('Repeat new password'));
    await userEvent.type(screen.getByLabelText('New password'), 'N3wPassw0rd!');
    await userEvent.type(screen.getByLabelText('Repeat new password'), 'N3wPassw0rd?');
    expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change password' })).toBeDisabled();
  });
});
