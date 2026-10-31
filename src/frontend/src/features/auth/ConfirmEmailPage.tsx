import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AuthCard from './AuthCard';
import { useAuth } from './AuthContext';
import { confirmEmail, resendConfirmation } from './api';

type Status = 'confirming' | 'confirmed' | 'invalid' | 'error';

/** Target of the link in the confirmation email. Works signed in or not. */
export default function ConfirmEmailPage() {
  const { state, refreshUser, signOut } = useAuth();
  const [params] = useSearchParams();
  const userId = params.get('userId');
  const code = params.get('code');
  const changedEmail = params.get('changedEmail');
  const [status, setStatus] = useState<Status>(userId && code ? 'confirming' : 'invalid');
  const started = useRef(false);

  useEffect(() => {
    // Confirm once, also under React StrictMode's double effects.
    if (!userId || !code || started.current) return;
    started.current = true;
    confirmEmail(userId, code, changedEmail ?? undefined)
      .then(async (ok) => {
        // The change ended every session of the account: sign this browser out now rather than
        // surprising the user later.
        if (ok && changedEmail) await signOut().catch(() => undefined);
        else if (ok) await refreshUser();
        setStatus(ok ? 'confirmed' : 'invalid');
      })
      .catch(() => setStatus('error'));
  }, [userId, code, changedEmail, refreshUser, signOut]);

  const signedIn = state.status === 'signedIn';
  // An old link (expired or reused) shouldn't tell an already confirmed user that something's wrong.
  const alreadyConfirmed = state.status === 'signedIn' && state.emailConfirmed && !changedEmail;

  if (status === 'confirming') {
    return (
      <AuthCard title="Confirming your email…">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress aria-label="Confirming your email" />
        </Box>
      </AuthCard>
    );
  }

  if (status === 'confirmed' && changedEmail) {
    return (
      <AuthCard title="Email changed">
        <Alert severity="success">
          Your email address was changed. From now on, sign in with <strong>{changedEmail}</strong>.
        </Alert>
        <ContinueButton signedIn={false} />
      </AuthCard>
    );
  }

  if (status === 'confirmed' || (status === 'invalid' && alreadyConfirmed)) {
    return (
      <AuthCard title="Email confirmed">
        <Alert severity="success">Thanks! Your email address is confirmed.</Alert>
        <ContinueButton signedIn={signedIn} />
      </AuthCard>
    );
  }

  if (status === 'error') {
    return (
      <AuthCard title="Something went wrong">
        <Alert severity="error">We couldn't confirm your email right now. Please open the link again later.</Alert>
        <ContinueButton signedIn={signedIn} />
      </AuthCard>
    );
  }

  if (changedEmail) {
    return (
      <AuthCard title="This link is no longer valid">
        <Typography>This link is no longer valid. Request the change again in Account settings.</Typography>
        <ContinueButton signedIn={signedIn} />
      </AuthCard>
    );
  }

  return (
    <AuthCard title="This link is no longer valid">
      <Typography>
        Confirmation links work for 24 hours.{' '}
        {signedIn ? 'Get a new one below.' : 'Sign in and use "Resend email" to get a new one.'}
      </Typography>
      {state.status === 'signedIn' ? <ResendAndContinue email={state.email} /> : <ContinueButton signedIn={false} />}
    </AuthCard>
  );
}

function ContinueButton({ signedIn }: { signedIn: boolean }) {
  return signedIn ? (
    <Button component={RouterLink} to="/" variant="contained" size="large">
      Go to the app
    </Button>
  ) : (
    <Button component={RouterLink} to="/signin" variant="contained" size="large">
      Sign in
    </Button>
  );
}

function ResendAndContinue({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'sent' | 'error' | null>(null);

  const resend = async () => {
    setBusy(true);
    try {
      await resendConfirmation(email);
      setResult('sent');
    } catch {
      setResult('error');
    }
    setBusy(false);
  };

  return (
    <Stack spacing={2}>
      {result === 'sent' && <Alert severity="success">Email sent to {email}. Check your inbox.</Alert>}
      {result === 'error' && <Alert severity="error">Something went wrong. Please try again.</Alert>}
      <Button variant="contained" size="large" onClick={resend} loading={busy} disabled={result === 'sent'}>
        Resend email
      </Button>
      <Button component={RouterLink} to="/" size="large">
        Go to the app
      </Button>
    </Stack>
  );
}
