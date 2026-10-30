import type { ReactNode } from 'react';
import { Navigate, useLocation, type Location } from 'react-router';
import { useAuth } from './AuthContext';

/**
 * For the sign-in and register pages: signed-in users are sent on to the page they originally
 * asked for (`state.from`, set by RequireAuth) or home. Renders the page while the session is
 * still being checked, so the form is usable right away.
 */
export default function GuestOnly({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const from = (useLocation().state as { from?: Location } | null)?.from;

  if (state.status === 'signedIn') {
    return <Navigate to={from ?? '/'} replace />;
  }

  return children;
}
