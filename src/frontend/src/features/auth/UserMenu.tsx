import { useState } from 'react';
import { useNavigate } from 'react-router';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from './AuthContext';

/** Signed-in user's email in the app bar, with a menu to sign out. Renders nothing when signed out. */
export default function UserMenu() {
  const { state, signOut } = useAuth();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [signOutFailed, setSignOutFailed] = useState(false);

  if (state.status !== 'signedIn') return null;

  const handleSignOut = async () => {
    setAnchor(null);
    try {
      await signOut();
      navigate('/signin', { replace: true });
    } catch {
      // Stay signed in and say so: the user must not walk away believing they signed out.
      setSignOutFailed(true);
    }
  };

  return (
    <>
      <Button
        color="inherit"
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-label={`Account menu for ${state.email}`}
        aria-haspopup="menu"
        aria-expanded={anchor ? 'true' : undefined}
        startIcon={<AccountCircleIcon />}
        sx={{ textTransform: 'none', minWidth: 0 }}
      >
        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
          {state.email}
        </Box>
      </Button>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
        <MenuItem onClick={handleSignOut}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Sign out
        </MenuItem>
      </Menu>
      <Snackbar
        open={signOutFailed}
        onClose={() => setSignOutFailed(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="error" variant="filled" onClose={() => setSignOutFailed(false)}>
          Sign-out failed. You are still signed in, please try again.
        </Alert>
      </Snackbar>
    </>
  );
}
