import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useAuth } from '../auth/AuthContext';
import ChangePasswordSection from './ChangePasswordSection';
import DeleteAccountSection from './DeleteAccountSection';
import EmailSection from './EmailSection';
import SignOutOthersSection from './SignOutOthersSection';

/** `/account` (signed-in only): the user's own account settings. */
export default function AccountPage() {
  const { state } = useAuth();

  return (
    <Stack spacing={3} sx={{ maxWidth: 560, mx: 'auto' }}>
      <div>
        <Typography variant="h4" component="h2">
          Account settings
        </Typography>
        {state.status === 'signedIn' && (
          <Typography sx={{ color: 'text.secondary' }}>Signed in as {state.email}</Typography>
        )}
      </div>
      <EmailSection />
      <ChangePasswordSection />
      <SignOutOthersSection />
      <DeleteAccountSection />
    </Stack>
  );
}
