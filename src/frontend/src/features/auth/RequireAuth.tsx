import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from './AuthContext';

/** Shows its children only to signed-in users; everyone else goes to the sign-in page. */
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
    return <Navigate to="/signin" replace state={{ from: location }} />;
  }

  return children;
}
