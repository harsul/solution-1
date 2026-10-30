import { createTheme, darken, lighten } from '@mui/material/styles';
import { brand } from './brand';

// Dark mode uses lighter shades, so text and icons stay readable on the dark background.
const primaryDark = brand.primaryDark ?? lighten(brand.primary, 0.4);
const secondaryDark = brand.secondaryDark ?? lighten(brand.secondary, 0.4);

export const theme = createTheme({
  // CSS variables + a data attribute let the color mode switch at runtime without a flash.
  cssVariables: { colorSchemeSelector: 'data' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: brand.primary },
        secondary: { main: brand.secondary },
        // A faint tint of the accent color behind the content.
        background: { default: lighten(brand.secondary, 0.92), paper: '#ffffff' },
      },
    },
    dark: {
      palette: {
        primary: { main: primaryDark },
        secondary: { main: secondaryDark },
        // Near-black, slightly tinted with the brand color.
        background: { default: darken(brand.primary, 0.82), paper: darken(brand.primary, 0.78) },
      },
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  shape: { borderRadius: 12 },
});

/** Gradient used for the app bar, from the accent to the main brand color. */
export const brandGradient = `linear-gradient(135deg, ${brand.secondary} 0%, ${brand.primary} 100%)`;
