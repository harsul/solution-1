import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../../App';
import { fakeApi, fakeAuthBackend, json, status } from '../../test/fakeApi';
import { renderWithProviders } from '../../test/render';

const section = async () => within(await screen.findByRole('region', { name: 'Email' }));

async function fill(newEmail: string) {
  await userEvent.type((await section()).getByLabelText('New email'), newEmail);
}

const submit = () => userEvent.click(screen.getByRole('button', { name: 'Change email' }));

function signedInWith(handler: () => Response) {
  fakeApi({
    'GET /api/auth/manage/info': () => json({ email: 'ada@example.com', isEmailConfirmed: true }),
    'POST /api/auth/manage/info': handler,
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

  it('has no password field', async () => {
    fakeAuthBackend({ signedInAs: 'ada@example.com' });
    renderWithProviders(<App />, { route: '/account' });

    expect((await section()).queryByLabelText('Password')).not.toBeInTheDocument();
  });

  it('sends the confirmation link and says where it went', async () => {
    const { emailChangeRequests } = fakeAuthBackend({ signedInAs: 'ada@example.com' });
    renderWithProviders(<App />, { route: '/account' });

    await fill(' ada@new.example ');
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We've sent a confirmation link to ada@new.example. Your email changes when you click it.",
    );
    expect(emailChangeRequests).toEqual(['ada@new.example']);
    expect((await section()).getByLabelText('New email')).toHaveFocus();
    expect((await section()).getByText('ada@example.com')).toBeInTheDocument();
  });

  it('blocks an invalid address', async () => {
    const { emailChangeRequests } = fakeAuthBackend({ signedInAs: 'ada@example.com' });
    renderWithProviders(<App />, { route: '/account' });

    await fill('ada@new');
    await userEvent.tab();

    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change email' })).toBeDisabled();
    expect(emailChangeRequests).toEqual([]);
  });

  it.each([["o'brien@example.com"], ['zoé@example.com']])(
    'refuses %s, which Identity cannot use as a sign-in name, without calling the API',
    async (address) => {
      const { emailChangeRequests } = fakeAuthBackend({ signedInAs: 'ada@example.com' });
      renderWithProviders(<App />, { route: '/account' });

      await fill(address);
      await submit();

      expect(await screen.findByRole('alert')).toHaveTextContent("This email address can't be used to sign in.");
      expect(emailChangeRequests).toEqual([]);
      expect((await section()).getByLabelText('New email')).toHaveFocus();
    },
  );

  it('refuses the current address (any case) without calling the API', async () => {
    const { emailChangeRequests } = fakeAuthBackend({ signedInAs: 'ada@example.com' });
    renderWithProviders(<App />, { route: '/account' });

    await fill('Ada@Example.com');
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('This is already your email address.');
    expect(emailChangeRequests).toEqual([]);
  });

  it.each([
    [() => json({ errors: { InvalidEmail: ['x'] } }, 400), 'Enter a valid email address.'],
    [() => status(500), 'Something went wrong. Please try again.'],
  ])('shows the server answer (%#)', async (handler, text) => {
    signedInWith(handler);
    renderWithProviders(<App />, { route: '/account' });

    await fill('ada@new.example');
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(text);
  });
});
