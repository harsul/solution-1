import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../../App';
import { fakeApi, fakeAuthBackend, status } from '../../test/fakeApi';
import { renderWithProviders } from '../../test/render';

describe('ForgotPasswordPage', () => {
  it('is reachable from the sign-in page', async () => {
    fakeAuthBackend();
    renderWithProviders(<App />, { route: '/signin' });

    await userEvent.click(await screen.findByRole('link', { name: 'Forgot password?' }));

    expect(await screen.findByRole('heading', { name: 'Forgot your password?' })).toBeInTheDocument();
  });

  it('sends the request and shows the neutral confirmation', async () => {
    const { resetRequests } = fakeAuthBackend();
    renderWithProviders(<App />, { route: '/forgot-password' });

    await userEvent.type(await screen.findByLabelText('Email'), 'ada@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(
      await screen.findByText("If an account exists for this email, we've sent a link to reset your password."),
    ).toBeInTheDocument();
    expect(resetRequests).toEqual(['ada@example.com']);
  });

  it('blocks an invalid email address', async () => {
    const { resetRequests } = fakeAuthBackend();
    renderWithProviders(<App />, { route: '/forgot-password' });

    await userEvent.type(await screen.findByLabelText('Email'), 'ada@example');
    await userEvent.tab();

    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeDisabled();
    expect(resetRequests).toEqual([]);
  });

  it('shows an error when the server fails', async () => {
    fakeApi({
      'GET /api/auth/manage/info': () => status(401),
      'POST /api/auth/forgotPassword': () => status(500),
    });
    renderWithProviders(<App />, { route: '/forgot-password' });

    await userEvent.type(await screen.findByLabelText('Email'), 'ada@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  });

  it('prefills the email from the link', async () => {
    fakeAuthBackend();

    renderWithProviders(<App />, { route: '/forgot-password?email=ada%40example.com' });

    expect(await screen.findByLabelText('Email')).toHaveValue('ada@example.com');
  });
});
