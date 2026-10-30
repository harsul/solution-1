import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../../App';
import { fakeAuthBackend } from '../../test/fakeApi';
import { renderWithProviders } from '../../test/render';

describe('AccountPage', () => {
  it('shows the account settings of the signed-in user', async () => {
    fakeAuthBackend({ signedInAs: 'ada@example.com' });

    renderWithProviders(<App />, { route: '/account' });

    expect(await screen.findByRole('heading', { name: 'Account settings' })).toBeInTheDocument();
    expect(screen.getByText('Signed in as ada@example.com')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Password' })).toBeInTheDocument();
  });

  it('sends a signed-out visitor to sign in and back to the account page', async () => {
    const { users } = fakeAuthBackend();
    users.set('ada@example.com', 'Passw0rd!');
    renderWithProviders(<App />, { route: '/account' });

    await userEvent.type(await screen.findByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Passw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Account settings' })).toBeInTheDocument();
  });
});
