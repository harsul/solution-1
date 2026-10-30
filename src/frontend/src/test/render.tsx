import type { ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../theme';

/** Renders a component inside the app's MUI theme, like main.tsx does. */
export function renderWithTheme(ui: ReactElement, options?: RenderOptions) {
  return render(ui, {
    wrapper: ({ children }) => (
      <ThemeProvider theme={theme} defaultMode="system">
        {children}
      </ThemeProvider>
    ),
    ...options,
  });
}
