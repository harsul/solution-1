import { Navigate, Route, Routes } from 'react-router';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import GitHubIcon from '@mui/icons-material/GitHub';
import aspireLogo from '/Aspire.png';
import ColorModeToggle from './components/ColorModeToggle';
import ConfirmEmailBanner from './features/auth/ConfirmEmailBanner';
import ConfirmEmailPage from './features/auth/ConfirmEmailPage';
import GuestOnly from './features/auth/GuestOnly';
import RegisterPage from './features/auth/RegisterPage';
import RequireAuth from './features/auth/RequireAuth';
import SignInPage from './features/auth/SignInPage';
import UserMenu from './features/auth/UserMenu';
import WeatherPage from './features/weather/WeatherPage';
import { aspireGradient } from './theme';

function App() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" elevation={0} sx={{ background: aspireGradient }}>
        <Toolbar sx={{ gap: { xs: 1, sm: 2 } }}>
          <Link
            href="https://aspire.dev"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Visit Aspire website (opens in new tab)"
            sx={{ display: 'flex' }}
          >
            <Box component="img" src={aspireLogo} alt="Aspire logo" sx={{ height: 36 }} />
          </Link>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h6" component="h1" noWrap sx={{ lineHeight: 1.2 }}>
              Aspire Starter
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.85, display: { xs: 'none', md: 'block' } }}>
              Modern distributed application development
            </Typography>
          </Box>
          <UserMenu />
          <ColorModeToggle />
        </Toolbar>
      </AppBar>

      <Container component="main" maxWidth="md" sx={{ py: 4, flexGrow: 1 }}>
        <ConfirmEmailBanner />
        <Routes>
          <Route
            path="/signin"
            element={
              <GuestOnly>
                <SignInPage />
              </GuestOnly>
            }
          />
          <Route
            path="/register"
            element={
              <GuestOnly>
                <RegisterPage />
              </GuestOnly>
            }
          />
          <Route path="/confirm-email" element={<ConfirmEmailPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <WeatherPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Container>

      <Box component="footer" sx={{ py: 3 }}>
        <Stack
          component="nav"
          aria-label="Footer navigation"
          direction="row"
          spacing={2}
          sx={{ justifyContent: 'center', alignItems: 'center' }}
        >
          <Link href="https://aspire.dev" target="_blank" rel="noopener noreferrer">
            Learn more about Aspire
          </Link>
          <IconButton
            href="https://github.com/microsoft/aspire"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View Aspire on GitHub (opens in new tab)"
          >
            <GitHubIcon />
          </IconButton>
        </Stack>
      </Box>
    </Box>
  );
}

export default App;
