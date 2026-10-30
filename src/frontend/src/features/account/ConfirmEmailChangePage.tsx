import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import AuthCard from '../auth/AuthCard';
import { useAuth } from '../auth/AuthContext';
import { confirmEmailChange, type ConfirmEmailChangeResult } from './api';

type Status = 'confirming' | ConfirmEmailChangeResult | 'error';

/** Target of the link sent to the new address (F5). Works signed in or not. */
export default function ConfirmEmailChangePage() {
  const { state, refreshUser } = useAuth();
  const [params] = useSearchParams();
  const userId = params.get('userId');
  const email = params.get('email');
  const code = params.get('code');
  const [status, setStatus] = useState<Status>(userId && email && code ? 'confirming' : 'invalid');
  const started = useRef(false);

  useEffect(() => {
    // Confirm once, also under React StrictMode's double effects.
    // Wait for the app's own sign-in check: a session check still in flight could otherwise
    // overwrite the cookie that confirming re-issues.
    if (!userId || !email || !code || state.status === 'loading' || started.current) return;
    started.current = true;
    confirmEmailChange(userId, email, code)
      .then(async (result) => {
        // Signed in here: the session now carries the new address.
        if (result === 'changed') await refreshUser();
        setStatus(result);
      })
      .catch(() => setStatus('error'));
  }, [userId, email, code, state.status, refreshUser]);

  // Signed in as the account whose email changed (after the refresh, its email is the new one).
  const isOwner = state.status === 'signedIn' && state.email.toLowerCase() === email?.toLowerCase();
  const target = isOwner ? 'account' : state.status === 'signedIn' ? 'app' : 'signin';

  if (status === 'confirming') {
    return (
      <AuthCard title="Changing your email…">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress aria-label="Changing your email" />
        </Box>
      </AuthCard>
    );
  }

  if (status === 'changed') {
    return (
      <AuthCard title="Email changed">
        <Alert severity="success">
          Your email address was changed. From now on, sign in with <strong>{email}</strong>.
        </Alert>
        <Continue target={target} />
      </AuthCard>
    );
  }

  if (status === 'inUse') {
    return (
      <AuthCard title="Email not changed">
        <Alert severity="error">This email address is already in use. Your email address wasn't changed.</Alert>
        <Continue target={target} />
      </AuthCard>
    );
  }

  if (status === 'error') {
    return (
      <AuthCard title="Something went wrong">
        <Alert severity="error">We couldn't change your email right now. Please open the link again later.</Alert>
        <Continue target={target} />
      </AuthCard>
    );
  }

  return (
    <AuthCard title="This link is no longer valid">
      <Typography>
        Links to change your email work once and for 24 hours. Request the change again in Account settings.
      </Typography>
      <Continue target={target} />
    </AuthCard>
  );
}

const continueLinks = {
  account: { to: '/account', label: 'Go to Account settings' },
  app: { to: '/', label: 'Go to the app' },
  signin: { to: '/signin', label: 'Sign in' },
};

function Continue({ target }: { target: keyof typeof continueLinks }) {
  const { to, label } = continueLinks[target];
  return (
    <Button component={RouterLink} to={to} variant="contained" size="large">
      {label}
    </Button>
  );
}
