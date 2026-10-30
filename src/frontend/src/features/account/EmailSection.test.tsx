import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../../App';
import { fakeApi, fakeAuthBackend, json, status } from '../../test/fakeApi';
import { renderWithProviders } from '../../test/render';

const section = async () => within(await screen.findByRole('region', { name: 'Email' }));

async function fill(newEmail: string, password: string) {
  const email = await section();
  await userEvent.type(email.getByLabelText('New email'), newEmail);
  await userEvent.type(email.getByLabelText('Password'), password);
}

const submit = () => userEvent.click(screen.getByRole('button', { name: 'Change email' }));

function signedInWith(handler: () => Response) {
  fakeApi({
    'GET /api/auth/manage/info': () => json({ email: 'ada@example.com', isEmailConfirmed: true }),
    'POST /api/account/email': handler,
  });
}

describe('EmailSection', () => {
  it('shows the current address and whether it is confirmed', async () => {
    fakeAuthBackend({ signedInAs: 'ada@example.com', emailConfirmed: true });
    renderWithProviders(<App />, { route: '/account' });

    const email = await section();

    expect(email.getByText('ada@example.com')).toBeInTheDocument();
    expect(email.getByText('Confirmed')).toBeInTheDocument();
  });

  it('says when the address is not confirmed', async () => {
    fakeAuthBackend({ signedInAs: 'ada@example.com' });
    renderWithProviders(<App />, { route: '/account' });

    expect((await section()).getByText('Not confirmed')).toBeInTheDocument();
  });

  it('sends the confirmation link and says where it went', async () => {
    const { emailChangeRequests } = fakeAuthBackend({ signedInAs: 'ada@example.com' });
    renderWithProviders(<App />, { route: '/account' });

    await fill(' ada@new.example ', 'Passw0rd!');
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We've sent a confirmation link to ada@new.example. Your email changes when you click it.",
    );
    expect(emailChangeRequests).toEqual(['ada@new.example']);
    expect((await section()).getByLabelText('New email')).toHaveFocus();
    expect((await section()).getByText('ada@example.com')).toBeInTheDocument();
  });

  it('blocks an invalid address and an empty password', async () => {
    const { emailChangeRequests } = fakeAuthBackend({ signedInAs: 'ada@example.com' });
    renderWithProviders(<App />, { route: '/account' });

    await fill('ada@new', 'Passw0rd!');
    await userEvent.tab();

    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change email' })).toBeDisabled();

    await userEvent.clear((await section()).getByLabelText('New email'));
    await userEvent.type((await section()).getByLabelText('New email'), 'ada@new.example');
    await userEvent.clear((await section()).getByLabelText('Password'));
    expect(screen.getByRole('button', { name: 'Change email' })).toBeDisabled();
    expect(emailChangeRequests).toEqual([]);
  });

  it('says when the password is wrong and focuses it', async () => {
    fakeAuthBackend({ signedInAs: 'ada@example.com' });
    renderWithProviders(<App />, { route: '/account' });

    await fill('ada@new.example', 'Wrong-passw0rd');
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Your password is incorrect.');
    expect((await section()).getByLabelText('Password')).toHaveFocus();
    expect((await section()).getByLabelText('Password')).toHaveValue('');
  });

  it('keeps the password and focuses the address when only the address was wrong', async () => {
    const { users } = fakeAuthBackend({ signedInAs: 'ada@example.com' });
    users.set('bob@example.com', 'Passw0rd!');
    renderWithProviders(<App />, { route: '/account' });

    await fill('bob@example.com', 'Passw0rd!');
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('This email address is already in use.');
    expect((await section()).getByLabelText('New email')).toHaveFocus();
    expect((await section()).getByLabelText('Password')).toHaveValue('Passw0rd!');
  });

  it.each([
    [() => json({ errors: { DuplicateEmail: ['x'] } }, 400), 'This email address is already in use.'],
    [() => json({ errors: { SameEmail: ['x'] } }, 400), 'This is already your email address.'],
    [() => json({ errors: { InvalidEmail: ['x'] } }, 400), 'Enter a valid email address.'],
    [() => json({ errors: { LockedOut: ['x'] } }, 400), 'This account is temporarily locked. Try again in 5 minutes.'],
    [() => status(429), 'Too many requests. Please wait a few minutes and try again.'],
    [() => status(500), 'Something went wrong. Please try again.'],
  ])('shows the server answer (%#)', async (handler, text) => {
    signedInWith(handler);
    renderWithProviders(<App />, { route: '/account' });

    await fill('ada@new.example', 'Passw0rd!');
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(text);
  });
});
