import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';
import { fakeAuthBackend } from './test/fakeApi';
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
});
