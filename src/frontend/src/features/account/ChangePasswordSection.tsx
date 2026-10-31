import { useRef, useState, type FormEvent } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useAuth } from '../auth/AuthContext';
import PasswordRuleList from '../auth/PasswordRuleList';
import { isPasswordValid } from '../auth/passwordRules';
import { changePassword } from './api';

type Feedback = { severity: 'success' | 'error'; messages: string[] };

const messages = {
  wrongPassword: 'Your current password is incorrect.',
  error: 'Something went wrong. Please try again.',
};

export default function ChangePasswordSection() {
  const { state, signOut } = useAuth();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const currentRef = useRef<HTMLInputElement>(null);

  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = current !== '' && isPasswordValid(password) && confirm === password;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !canSubmit) return;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await changePassword(current, password);
      if (result.ok) {
        // The browser is signed out; RequireAuth sends the user to the sign-in page with a notice.
        await signOut('passwordChanged');
      } else if (result.code === 'rules') {
        setFeedback({ severity: 'error', messages: result.errors.length ? result.errors : [messages.error] });
      } else {
        // Only the current password was wrong: keep the new one so it needn't be typed again.
        setCurrent('');
        currentRef.current?.focus();
        setFeedback({ severity: 'error', messages: [messages.wrongPassword] });
      }
    } catch {
      setFeedback({ severity: 'error', messages: [messages.error] });
    }
    setBusy(false);
  };

  return (
    <Card variant="outlined" component="section" aria-labelledby="password-heading">
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack component="form" onSubmit={handleSubmit} noValidate spacing={2}>
          <Typography id="password-heading" variant="h6" component="h3">
            Password
          </Typography>
          {feedback && (
            <Alert severity={feedback.severity}>
              {feedback.messages.map((message) => (
                <div key={message}>{message}</div>
              ))}
            </Alert>
          )}
          {/* Lets password managers update the saved password of the right account. */}
          <input
            type="email"
            name="username"
            autoComplete="username"
            value={state.status === 'signedIn' ? state.email : ''}
            readOnly
            hidden
          />
          <TextField
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            inputRef={currentRef}
            fullWidth
          />
          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            slotProps={{ htmlInput: { 'aria-describedby': 'new-password-rules' } }}
            fullWidth
          />
          <PasswordRuleList id="new-password-rules" password={password} />
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
          <Button
            type="submit"
            variant="contained"
            loading={busy}
            disabled={!canSubmit}
            sx={{ alignSelf: { sm: 'flex-start' } }}
          >
            Change password
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
