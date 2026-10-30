import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { fakeAuthBackend } from '../../test/fakeApi';
import { renderWithProviders } from '../../test/render';
import ForgotPasswordPage from './ForgotPasswordPage';
import GuestOnly from './GuestOnly';
import RequireAuth from './RequireAuth';
import RegisterPage from './RegisterPage';
import SignInPage from './SignInPage';

function CurrentLocation() {
  const { pathname, search } = useLocation();
  return <p>Protected page at {pathname + search}</p>;
}

function TestRoutes() {
  return (
    <Routes>
      <Route
        path="/signin"
        element={
          <GuestOnly>
            <SignInPage />
          </GuestOnly>
        }
      />
      <Route
        path="/register"
        element={
          <GuestOnly>
            <RegisterPage />
          </GuestOnly>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <GuestOnly>
            <ForgotPasswordPage />
          </GuestOnly>
        }
      />
      <Route
        path="/reports"
        element={
          <RequireAuth>
            <CurrentLocation />
          </RequireAuth>
        }
      />
    </Routes>
  );
}

describe('RequireAuth', () => {
  it('sends a signed-out visitor to sign in and back to the requested page afterwards', async () => {
    const { users } = fakeAuthBackend();
    users.set('ada@example.com', 'Passw0rd!');
    renderWithProviders(<TestRoutes />, { route: '/reports?range=week' });

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText(/Protected page/)).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Passw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Protected page at /reports?range=week')).toBeInTheDocument();
  });

  it('shows the page directly to a signed-in user', async () => {
    fakeAuthBackend({ signedInAs: 'ada@example.com' });

    renderWithProviders(<TestRoutes />, { route: '/reports' });

    expect(await screen.findByText('Protected page at /reports')).toBeInTheDocument();
  });

  it('keeps the requested page when the visitor creates an account instead of signing in', async () => {
    fakeAuthBackend();
    renderWithProviders(<TestRoutes />, { route: '/reports?range=week' });

    await userEvent.click(await screen.findByRole('link', { name: 'Create an account' }));
    await userEvent.type(await screen.findByLabelText('Email'), 'new@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Passw0rd!');
    await userEvent.type(screen.getByLabelText('Repeat password'), 'Passw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Protected page at /reports?range=week')).toBeInTheDocument();
  });

  it('keeps the requested page after visiting Forgot password and going back', async () => {
    const { users } = fakeAuthBackend();
    users.set('ada@example.com', 'Passw0rd!');
    renderWithProviders(<TestRoutes />, { route: '/reports?range=week' });

    await userEvent.click(await screen.findByRole('link', { name: 'Forgot password?' }));
    await userEvent.click(await screen.findByRole('link', { name: 'Back to sign in' }));
    await userEvent.type(await screen.findByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Passw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Protected page at /reports?range=week')).toBeInTheDocument();
  });
});
