import { useState, type FormEvent } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AuthCard from './AuthCard';
import { useAuth } from './AuthContext';
import PasswordRules from './PasswordRules';
import { resetPassword } from './api';
import { isPasswordValid } from './passwordRules';

/** Opened from the reset email: `/reset-password?email=…&code=…`. Works signed in or out. */
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  const code = params.get('code') ?? '';
  const { state, signOut } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(!email || !code);
  const [errors, setErrors] = useState<string[]>([]);
  // Set when the password changed but signing out here failed, so Sign in (guest-only) can't be shown.
  const [changedButSignedIn, setChangedButSignedIn] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = isPasswordValid(password) && confirm === password;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !canSubmit) return;
    setBusy(true);
    setErrors([]);
    try {
      const result = await resetPassword(email, code, password);
      if (result.ok) {
        // Whoever is signed in here must sign in again with the new password.
        if (state.status === 'signedIn') {
          try {
            await signOut();
          } catch {
            setChangedButSignedIn(true);
            setBusy(false);
            return;
          }
        }
        navigate('/signin', { replace: true, state: { notice: 'Your password was changed. Please sign in.' } });
        return;
      }
      if (result.expired) setExpired(true);
      else setErrors(result.errors.length ? result.errors : ['Something went wrong. Please try again.']);
    } catch {
      setErrors(['Something went wrong. Please try again.']);
    }
    setBusy(false);
  };

  if (changedButSignedIn) {
    return (
      <AuthCard title="Password changed">
        <Alert severity="success">
          Your password was changed. Please sign out and sign in again with your new password.
        </Alert>
      </AuthCard>
    );
  }

  if (expired) {
    return (
      <AuthCard title="This link has expired">
        <Typography>
          Reset links are valid for 24 hours and work once. Request a new link to choose a new password.
        </Typography>
        <Button
          component={RouterLink}
          to={email ? `/forgot-password?${new URLSearchParams({ email })}` : '/forgot-password'}
          variant="contained"
          size="large"
        >
          Request a new link
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Set a new password">
      <Stack component="form" onSubmit={handleSubmit} noValidate spacing={2}>
        <Typography>
          For <strong>{email}</strong>
        </Typography>
        {errors.length > 0 && (
          <Alert severity="error">
            {errors.map((message) => (
              <div key={message}>{message}</div>
            ))}
          </Alert>
        )}
        {/* Lets password managers save the new password for the right account. */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          slotProps={{ htmlInput: { 'aria-describedby': 'password-rules' } }}
          fullWidth
        />
        <PasswordRules id="password-rules" password={password} />
        <TextField
          label="Repeat new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={mismatch}
          helperText={mismatch ? "Passwords don't match" : ' '}
          fullWidth
        />
        <Button type="submit" variant="contained" size="large" loading={busy} disabled={!canSubmit}>
          Change password
        </Button>
      </Stack>
      <Typography variant="body2">
        <Link component={RouterLink} to="/signin">
          Back to sign in
        </Link>
      </Typography>
    </AuthCard>
  );
}
