import { createTheme } from '@mui/material/styles';

// Aspire purple, taken from the original stylesheet's accent gradient.
const aspire = {
  blue: '#5b6fd8',
  purple: '#6b46a3',
  blueLight: '#7c92f5',
  purpleLight: '#a78bfa',
};

export const theme = createTheme({
  // CSS variables + a data attribute let the color mode switch at runtime without a flash.
  cssVariables: { colorSchemeSelector: 'data' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: aspire.purple },
        secondary: { main: aspire.blue },
        background: { default: '#f0f4ff', paper: '#ffffff' },
      },
    },
    dark: {
      palette: {
        // Lighter shades keep text and icons readable on the dark background.
        primary: { main: aspire.purpleLight },
        secondary: { main: aspire.blueLight },
        background: { default: '#1a1a2e', paper: '#1e1e2e' },
      },
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  shape: { borderRadius: 12 },
});

/** Gradient used for the app bar, matching the original Aspire header. */
export const aspireGradient = `linear-gradient(135deg, ${aspire.blue} 0%, ${aspire.purple} 100%)`;
