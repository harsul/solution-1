import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import CssBaseline from '@mui/material/CssBaseline';
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';
import { ThemeProvider } from '@mui/material/styles';
import { BrowserRouter } from 'react-router';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import './index.css';
import App from './App.tsx';
import AuthProvider from './features/auth/AuthProvider';
import { theme } from './theme';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <InitColorSchemeScript attribute="data" defaultMode="system" />
    <ThemeProvider theme={theme} defaultMode="system">
      <CssBaseline enableColorScheme />
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
