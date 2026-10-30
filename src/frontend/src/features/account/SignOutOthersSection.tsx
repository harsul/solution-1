import { useState } from 'react';
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
import Typography from '@mui/material/Typography';
import { signOutOtherDevices } from './api';

type Feedback = { severity: 'success' | 'error'; message: string };

export default function SignOutOthersSection() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await signOutOtherDevices();
      setFeedback({ severity: 'success', message: "You've been signed out on all other devices." });
    } catch {
      setFeedback({ severity: 'error', message: 'Something went wrong. Please try again.' });
    }
    setBusy(false);
    setOpen(false);
  };

  return (
    <Card variant="outlined" component="section" aria-labelledby="sessions-heading">
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={2}>
          <Typography id="sessions-heading" variant="h6" component="h3">
            Sessions
          </Typography>
          {feedback && <Alert severity={feedback.severity}>{feedback.message}</Alert>}
          <Typography sx={{ color: 'text.secondary' }}>
            Signed in on a computer or phone you no longer use? Sign out there without signing out here.
          </Typography>
          <Button
            variant="outlined"
            onClick={() => {
              setFeedback(null);
              setOpen(true);
            }}
            sx={{ alignSelf: { sm: 'flex-start' } }}
          >
            Sign out other devices
          </Button>
        </Stack>
      </CardContent>
      <Dialog
        open={open}
        onClose={() => !busy && setOpen(false)}
        aria-labelledby="sign-out-others-title"
        aria-describedby="sign-out-others-description"
      >
        <DialogTitle id="sign-out-others-title">Sign out other devices?</DialogTitle>
        <DialogContent>
          <DialogContentText id="sign-out-others-description">
            Every other browser and device signed in to your account will be signed out. You stay signed in here.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleConfirm} loading={busy}>
            Sign out others
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
