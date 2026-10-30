import { useRef, useState, type FormEvent } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useAuth } from '../auth/AuthContext';
import { lockedOutMessage } from '../auth/messages';
import { isValidEmail } from '../auth/passwordRules';
import { changeEmail, type ChangeEmailResult } from './api';

type Feedback = { severity: 'success' | 'error'; message: string };

const errorMessages: Record<Extract<ChangeEmailResult, { ok: false }>['code'], string> = {
  wrongPassword: 'Your password is incorrect.',
  lockedOut: lockedOutMessage,
  invalidEmail: 'Enter a valid email address.',
  sameEmail: 'This is already your email address.',
  inUse: 'This email address is already in use.',
  tooManyRequests: 'Too many requests. Please wait a few minutes and try again.',
};

export default function EmailSection() {
  const { state } = useAuth();
  const current = state.status === 'signedIn' ? state.email : '';
  const confirmed = state.status === 'signedIn' && state.emailConfirmed;
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const emailValid = isValidEmail(newEmail);
  const showEmailError = touched && newEmail !== '' && !emailValid;
  const canSubmit = emailValid && password !== '';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !canSubmit) return;
    setBusy(true);
    setFeedback(null);
    const address = newEmail.trim();
    try {
      const result = await changeEmail(address, password);
      if (result.ok) {
        setNewEmail('');
        setPassword('');
        setTouched(false);
        // The submit button is now disabled; keep keyboard focus in the form.
        emailRef.current?.focus();
        setFeedback({
          severity: 'success',
          message: `We've sent a confirmation link to ${address}. Your email changes when you click it.`,
        });
      } else {
        setFeedback({ severity: 'error', message: errorMessages[result.code] });
        if (result.code === 'invalidEmail' || result.code === 'sameEmail' || result.code === 'inUse') {
          // Only the address was wrong: keep the password so it needn't be typed again.
          emailRef.current?.focus();
        } else {
          setPassword('');
          passwordRef.current?.focus();
        }
      }
    } catch {
      setFeedback({ severity: 'error', message: 'Something went wrong. Please try again.' });
    }
    setBusy(false);
  };

  return (
    <Card variant="outlined" component="section" aria-labelledby="email-heading">
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack component="form" onSubmit={handleSubmit} noValidate spacing={2}>
          <Typography id="email-heading" variant="h6" component="h3">
            Email
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
            <Typography sx={{ overflowWrap: 'anywhere' }}>{current}</Typography>
            <Chip
              size="small"
              label={confirmed ? 'Confirmed' : 'Not confirmed'}
              color={confirmed ? 'success' : 'warning'}
              variant="outlined"
            />
          </Stack>
          {feedback && <Alert severity={feedback.severity}>{feedback.message}</Alert>}
          <TextField
            label="New email"
            type="email"
            autoComplete="off"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onBlur={() => setTouched(true)}
            inputRef={emailRef}
            error={showEmailError}
            helperText={showEmailError ? 'Enter a valid email address.' : ' '}
            fullWidth
          />
          {/* The account's sign-in name, so password managers fill the right password. */}
          <input type="email" name="username" autoComplete="username" value={current} readOnly hidden />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            inputRef={passwordRef}
            fullWidth
          />
          <Button
            type="submit"
            variant="contained"
            loading={busy}
            disabled={!canSubmit}
            sx={{ alignSelf: { sm: 'flex-start' } }}
          >
            Change email
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
