import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from './AuthContext';
import { resendConfirmation } from './api';
import { dismissBanner, isBannerDismissed } from './bannerDismissal';

const cooldownSeconds = 60;

const hiddenOn = ['/confirm-email', '/confirm-email-change'];

type Feedback = 'sent' | 'tooSoon' | 'error' | null;

/**
 * Reminder for signed-in users whose email isn't confirmed yet, with "Resend email".
 * Keyed by who is signed in, so every sign-in/sign-out starts with fresh state: a banner closed by
 * one session, or a resend message and countdown, never carries over to the next session or user.
 */
export default function ConfirmEmailBanner() {
  const { state } = useAuth();
  return <SessionBanner key={state.status === 'signedIn' ? `in:${state.email}` : state.status} />;
}

function SessionBanner() {
  const { state } = useAuth();
  const { pathname } = useLocation();
  const email = state.status === 'signedIn' && !state.emailConfirmed ? state.email : null;
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  // The countdown is based on an end time, so it stays correct even when the browser throttles
  // timers (e.g. in a background tab); the interval only refreshes the display.
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (cooldownUntil === 0) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= cooldownUntil) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownUntil]);

  const secondsLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  // The confirm page handles confirmation itself; no second "Resend email" there.
  // The confirm pages have their own messages; a reminder about the (old) address would confuse.
  if (!email || hiddenOn.includes(pathname) || dismissedFor === email || isBannerDismissed(email)) return null;

  const resend = async () => {
    setBusy(true);
    try {
      const result = await resendConfirmation(email);
      setFeedback(result);
      const current = Date.now();
      setNow(current);
      setCooldownUntil(current + cooldownSeconds * 1000);
    } catch {
      setFeedback('error');
    }
    setBusy(false);
  };

  const close = () => {
    dismissBanner(email);
    setDismissedFor(email);
  };

  const message = {
    sent: `Email sent to ${email}. Check your inbox.`,
    tooSoon: 'Please wait a minute before trying again.',
    error: "The email couldn't be sent. Please try again.",
  };

  return (
    <Alert
      severity={feedback === 'error' ? 'error' : 'info'}
      role="region"
      aria-label="Email confirmation reminder"
      sx={{ mb: 3 }}
      action={
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Button
            color="inherit"
            size="small"
            onClick={resend}
            loading={busy}
            disabled={secondsLeft > 0}
            sx={{ whiteSpace: 'nowrap' }}
          >
            {secondsLeft > 0 ? `Resend in ${secondsLeft} s` : 'Resend email'}
          </Button>
          <IconButton color="inherit" size="small" aria-label="Close" onClick={close}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      }
    >
      {/* Only the message is a live region; the countdown on the button isn't announced every second. */}
      <Box component="span" role="status">
        {feedback
          ? message[feedback]
          : 'Please confirm your email address. We sent you a link when you created your account.'}
      </Box>
    </Alert>
  );
}
