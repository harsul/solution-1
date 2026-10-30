import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';
import { fakeApi, fakeAuthBackend, json, status } from './test/fakeApi';
import { renderWithProviders } from './test/render';

describe('App', () => {
  it('shows the sign-in page instead of the forecast when signed out', async () => {
    fakeAuthBackend();

    renderWithProviders(<App />);

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText('Weather Forecast')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/register');
  });

  it('shows the forecast and the account menu when signed in', async () => {
    fakeAuthBackend({ signedInAs: 'ada@example.com' });

    renderWithProviders(<App />);

    expect(await screen.findByText('Mild')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account menu for ada@example.com' })).toBeInTheDocument();
  });

  it('sends the user to sign in with a message when the session has expired', async () => {
    fakeApi({
      'GET /api/auth/manage/info': () => json({ email: 'ada@example.com', isEmailConfirmed: false }),
      'GET /api/weatherforecast': () => status(401),
    });

    renderWithProviders(<App />);

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('Your session has expired, please sign in again.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Account menu/ })).not.toBeInTheDocument();
  });

  it.each(['/signin', '/register'])('sends a signed-in user from %s to the forecast', async (route) => {
    fakeAuthBackend({ signedInAs: 'ada@example.com' });

    renderWithProviders(<App />, { route });

    expect(await screen.findByText('Mild')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Sign in|Create an account/ })).not.toBeInTheDocument();
  });
});
