import { useState, type FormEvent } from 'react';
import { Link as RouterLink, useLocation, useNavigate, type Location } from 'react-router';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AuthCard from './AuthCard';
import { useAuth } from './AuthContext';
import PasswordRules from './PasswordRules';
import { isPasswordValid, isValidEmail } from './passwordRules';

type FormError = { kind: 'duplicate' } | { kind: 'messages'; messages: string[] };

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  // The page the user originally asked for (from RequireAuth), kept when switching to Sign in.
  const from = (useLocation().state as { from?: Location } | null)?.from;
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);

  const mismatch = confirm.length > 0 && confirm !== password;
  const passwordsReady = isPasswordValid(password) && confirm === password;
  // Show the email hint after leaving the field, or as soon as it's the only thing blocking submit.
  const emailInvalid = email !== '' && !isValidEmail(email) && (emailTouched || passwordsReady);
  const canSubmit = isValidEmail(email) && passwordsReady;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const result = await register({ email: email.trim(), password });
      // Signed in: GuestOnly takes the user to the app. Created but not signed in: ask to sign in.
      if (result.ok) {
        if (!result.signedIn) {
          navigate('/signin', { replace: true, state: { notice: 'Account created, please sign in.', from } });
        }
        return;
      }
      setError(result.duplicate ? { kind: 'duplicate' } : { kind: 'messages', messages: result.errors });
    } catch {
      setError({ kind: 'messages', messages: ['Something went wrong. Please try again.'] });
    }
    setBusy(false);
  };

  return (
    <AuthCard title="Create an account">
      <Stack component="form" onSubmit={handleSubmit} noValidate spacing={2}>
        {error?.kind === 'duplicate' && (
          <Alert severity="error">
            An account with this email already exists.{' '}
            <Link component={RouterLink} to="/signin" state={{ from }} color="inherit" sx={{ fontWeight: 500 }}>
              Sign in
            </Link>
          </Alert>
        )}
        {error?.kind === 'messages' && (
          <Alert severity="error">
            {error.messages.map((message) => (
              <div key={message}>{message}</div>
            ))}
          </Alert>
        )}
        <TextField
          label="Email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setEmailTouched(true)}
          error={emailInvalid}
          helperText={emailInvalid ? 'Enter a valid email address' : ' '}
          fullWidth
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          slotProps={{ htmlInput: { 'aria-describedby': 'password-rules' } }}
          fullWidth
        />
        <PasswordRules id="password-rules" password={password} />
        <TextField
          label="Repeat password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={mismatch}
          helperText={mismatch ? "Passwords don't match" : ' '}
          fullWidth
        />
        <Button type="submit" variant="contained" size="large" loading={busy} disabled={!canSubmit}>
          Create account
        </Button>
      </Stack>
      <Typography variant="body2">
        Already have an account?{' '}
        <Link component={RouterLink} to="/signin" state={{ from }}>
          Sign in
        </Link>
      </Typography>
    </AuthCard>
  );
}
