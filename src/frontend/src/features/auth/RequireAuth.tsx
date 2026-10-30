import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from './AuthContext';

const notices = {
  expired: 'Your session has expired, please sign in again.',
  deleted: 'Your account was deleted.',
};

/**
 * Shows its children only to signed-in users; everyone else goes to the sign-in page, which
 * sends them back here (`state.from`) once they have signed in.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress aria-label="Checking sign-in" />
      </Box>
    );
  }

  if (state.status === 'signedOut') {
    const notice = state.reason ? notices[state.reason] : undefined;
    return <Navigate to="/signin" replace state={{ from: location, notice }} />;
  }

  return children;
}
