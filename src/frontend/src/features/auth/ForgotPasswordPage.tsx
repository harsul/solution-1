import { useState, type FormEvent } from 'react';
import { Link as RouterLink, useLocation, useSearchParams, type Location } from 'react-router';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AuthCard from './AuthCard';
import { requestPasswordReset } from './api';
import { isValidEmail } from './passwordRules';

const messages = {
  sent: "If an account exists for this email, we've sent a link to reset your password.",
  tooManyRequests: 'Too many requests. Please wait a few minutes and try again.',
  invalidEmail: 'Enter a valid email address.',
  error: 'Something went wrong. Please try again.',
};

/** Asks for a reset link. The confirmation message never says whether the account exists. */
export default function ForgotPasswordPage() {
  // The page the user originally asked for (from RequireAuth), kept when going back to Sign in.
  const from = (useLocation().state as { from?: Location } | null)?.from;
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = isValidEmail(email);
  const showEmailError = touched && email !== '' && !valid;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !valid) return;
    setBusy(true);
    setError(null);
    try {
      const result = await requestPasswordReset(email.trim());
      if (result === 'sent') setSent(true);
      else setError(messages[result]);
    } catch {
      setError(messages.error);
    }
    setBusy(false);
  };

  return (
    <AuthCard title="Forgot your password?">
      {sent ? (
        <Alert severity="success">{messages.sent}</Alert>
      ) : (
        <Stack component="form" onSubmit={handleSubmit} noValidate spacing={2}>
          <Typography>Enter your email address and we'll send you a link to choose a new password.</Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched(true)}
            error={showEmailError}
            helperText={showEmailError ? messages.invalidEmail : ' '}
            fullWidth
          />
          <Button type="submit" variant="contained" size="large" loading={busy} disabled={!valid}>
            Send reset link
          </Button>
        </Stack>
      )}
      <Typography variant="body2">
        <Link component={RouterLink} to="/signin" state={{ from }}>
          Back to sign in
        </Link>
      </Typography>
    </AuthCard>
  );
}
