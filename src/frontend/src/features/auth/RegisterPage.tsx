import { useState, type FormEvent } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AuthCard from './AuthCard';
import { useAuth } from './AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = email !== '' && password !== '' && confirm === password;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !canSubmit) return;
    setBusy(true);
    setErrors([]);
    try {
      const result = await register({ email, password });
      if (result.ok) {
        navigate(result.signedIn ? '/' : '/signin', {
          replace: true,
          state: result.signedIn ? undefined : { notice: 'Account created, please sign in.' },
        });
        return;
      }
      setErrors(result.errors);
    } catch {
      setErrors(['Something went wrong. Please try again.']);
    }
    setBusy(false);
  };

  return (
    <AuthCard title="Create an account">
      <Stack component="form" onSubmit={handleSubmit} noValidate spacing={2}>
        {errors.length > 0 && (
          <Alert severity="error">
            {errors.map((message) => (
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
          fullWidth
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          fullWidth
        />
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
        <Link component={RouterLink} to="/signin">
          Sign in
        </Link>
      </Typography>
    </AuthCard>
  );
}
