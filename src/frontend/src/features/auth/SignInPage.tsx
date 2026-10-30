import { useState, type FormEvent } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AuthCard from './AuthCard';
import { useAuth } from './AuthContext';

const signInMessages = {
  invalid: 'Email or password is incorrect.',
  lockedOut: 'This account is temporarily locked. Try again in 5 minutes.',
  unexpected: 'Something went wrong. Please try again.',
};

export default function SignInPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !email || !password) return;
    setBusy(true);
    setError(null);
    try {
      const result = await signIn({ email: email.trim(), password }, rememberMe);
      if (result === 'ok') {
        navigate('/', { replace: true });
        return;
      }
      setError(signInMessages[result]);
    } catch {
      setError(signInMessages.unexpected);
    }
    setBusy(false);
  };

  return (
    <AuthCard title="Sign in">
      <Stack component="form" onSubmit={handleSubmit} noValidate spacing={2}>
        {notice && !error && <Alert severity="info">{notice}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="Email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          fullWidth
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          fullWidth
        />
        <FormControlLabel
          control={<Checkbox checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />}
          label="Remember me"
          sx={{ mt: -1 }}
        />
        <Button type="submit" variant="contained" size="large" loading={busy} disabled={!email || !password}>
          Sign in
        </Button>
      </Stack>
      <Typography variant="body2">
        New here?{' '}
        <Link component={RouterLink} to="/register">
          Create an account
        </Link>
      </Typography>
    </AuthCard>
  );
}
