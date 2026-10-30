import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../../App';
import { fakeApi, fakeAuthBackend, json, status } from '../../test/fakeApi';
import { renderWithProviders } from '../../test/render';

async function openAndFill(password: string, email: string) {
  await userEvent.click(await screen.findByRole('button', { name: 'Delete account' }));
  const dialog = await screen.findByRole('dialog');
  if (password) await userEvent.type(within(screen.getByRole('dialog')).getByLabelText('Password'), password);
  if (email) await userEvent.type(screen.getByLabelText('Type your email to confirm'), email);
  return dialog;
}

const confirmButton = () => screen.getByRole('button', { name: 'Delete my account' });

function signedInWith(handler: () => Response) {
  fakeApi({
    'GET /api/auth/manage/info': () => json({ email: 'ada@example.com', isEmailConfirmed: true }),
    'POST /api/account/delete': handler,
  });
}

describe('DeleteAccountSection', () => {
  it('keeps the delete button disabled until the password is given and the email matches', async () => {
    fakeAuthBackend({ signedInAs: 'ada@example.com' });
    renderWithProviders(<App />, { route: '/account' });

    await openAndFill('', 'ADA@example.com');
    expect(confirmButton()).toBeDisabled(); // no password yet

    await userEvent.clear(screen.getByLabelText('Type your email to confirm'));
    await userEvent.type(screen.getByLabelText('Type your email to confirm'), 'ada@example.org');
    await userEvent.type(within(screen.getByRole('dialog')).getByLabelText('Password'), 'Passw0rd!');
    expect(confirmButton()).toBeDisabled(); // email doesn't match

    await userEvent.clear(screen.getByLabelText('Type your email to confirm'));
    await userEvent.type(screen.getByLabelText('Type your email to confirm'), 'ADA@example.com');
    expect(confirmButton()).toBeEnabled(); // matches, ignoring case
  });

  it('deletes the account, signs out and says so on the sign-in page', async () => {
    const { users } = fakeAuthBackend({ signedInAs: 'ada@example.com' });
    renderWithProviders(<App />, { route: '/account' });

    await openAndFill('Passw0rd!', 'ada@example.com');
    await userEvent.click(confirmButton());

    expect(await screen.findByText('Your account was deleted.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Account menu/ })).not.toBeInTheDocument();
    expect(users.has('ada@example.com')).toBe(false);
  });

  it('says when the password is wrong and keeps the account', async () => {
    const { users } = fakeAuthBackend({ signedInAs: 'ada@example.com' });
    renderWithProviders(<App />, { route: '/account' });

    await openAndFill('Wrong-passw0rd', 'ada@example.com');
    await userEvent.click(confirmButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Your password is incorrect.');
    expect(users.has('ada@example.com')).toBe(true);
    expect(within(screen.getByRole('dialog')).getByLabelText('Password')).toHaveValue('');
    expect(within(screen.getByRole('dialog')).getByLabelText('Password')).toHaveFocus();
  });

  it.each([
    [() => json({ errors: { LockedOut: ['Account locked.'] } }, 400), 'This account is temporarily locked. Try again in 5 minutes.'],
    [() => json({ errors: { EmailMismatch: ['No match.'] } }, 400), "The email address doesn't match this account."],
    [() => status(500), 'Something went wrong. Please try again.'],
  ])('shows the lockout and unexpected-error messages (%#)', async (handler, text) => {
    signedInWith(handler);
    renderWithProviders(<App />, { route: '/account' });

    await openAndFill('Passw0rd!', 'ada@example.com');
    await userEvent.click(confirmButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(text);
  });

  it('announces the warning when the dialog opens', async () => {
    fakeAuthBackend({ signedInAs: 'ada@example.com' });
    renderWithProviders(<App />, { route: '/account' });

    const dialog = await openAndFill('', '');

    expect(dialog).toHaveAccessibleDescription(/can't be undone/);
    expect(within(dialog).getByLabelText('Password')).toHaveFocus();
  });

  it('does nothing when cancelled', async () => {
    const { users } = fakeAuthBackend({ signedInAs: 'ada@example.com' });
    renderWithProviders(<App />, { route: '/account' });

    await openAndFill('Passw0rd!', 'ada@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(users.has('ada@example.com')).toBe(true);
  });
});
