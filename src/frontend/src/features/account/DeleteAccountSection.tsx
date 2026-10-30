import { useRef, useState, type FormEvent } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useAuth } from '../auth/AuthContext';
import { lockedOutMessage } from '../auth/messages';
import { deleteAccount } from './api';

const messages = {
  wrongPassword: 'Your password is incorrect.',
  lockedOut: lockedOutMessage,
  emailMismatch: "The email address doesn't match this account.",
  error: 'Something went wrong. Please try again.',
};

/** Deleting needs the password and the account's email typed in (case-insensitive). */
export default function DeleteAccountSection() {
  const { state, accountDeleted } = useAuth();
  const accountEmail = state.status === 'signedIn' ? state.email : '';
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [typedEmail, setTypedEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const emailMatches = accountEmail !== '' && typedEmail.trim().toLowerCase() === accountEmail.toLowerCase();
  const canDelete = password !== '' && emailMatches;

  const openDialog = () => {
    setPassword('');
    setTypedEmail('');
    setError(null);
    setOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !canDelete) return;
    setBusy(true);
    setError(null);
    try {
      const result = await deleteAccount(password, typedEmail.trim());
      if (result.ok) {
        // The server already ended the session; RequireAuth now shows Sign in with the notice.
        accountDeleted();
        return;
      }
      if (result.code === 'wrongPassword') setPassword('');
      setError(messages[result.code]);
      passwordRef.current?.focus();
    } catch {
      setError(messages.error);
    }
    setBusy(false);
  };

  return (
    <Card variant="outlined" component="section" aria-labelledby="delete-heading" sx={{ borderColor: 'error.main' }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={2}>
          <Typography id="delete-heading" variant="h6" component="h3">
            Delete account
          </Typography>
          <Typography sx={{ color: 'text.secondary' }}>
            Deletes your account and its data right away. This can't be undone.
          </Typography>
          <Button variant="outlined" color="error" onClick={openDialog} sx={{ alignSelf: { sm: 'flex-start' } }}>
            Delete account
          </Button>
        </Stack>
      </CardContent>
      <Dialog
        open={open}
        onClose={() => !busy && setOpen(false)}
        aria-labelledby="delete-account-title"
        aria-describedby="delete-account-description"
      >
        <DialogTitle id="delete-account-title">Delete your account?</DialogTitle>
        <form onSubmit={handleSubmit} noValidate>
          <DialogContent>
            <Stack spacing={2}>
              <DialogContentText id="delete-account-description">
                Your account <strong>{accountEmail}</strong> and its data will be deleted right away. This can't be
                undone.
              </DialogContentText>
              {error && <Alert severity="error">{error}</Alert>}
              {/* Lets password managers fill the password of the right account. */}
              <input type="email" name="username" autoComplete="username" value={accountEmail} readOnly hidden />
              <TextField
                label="Password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                inputRef={passwordRef}
                autoFocus
                fullWidth
              />
              <TextField
                label="Type your email to confirm"
                autoComplete="off"
                value={typedEmail}
                onChange={(e) => setTypedEmail(e.target.value)}
                helperText={accountEmail}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="error" loading={busy} disabled={!canDelete}>
              Delete my account
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Card>
  );
}
