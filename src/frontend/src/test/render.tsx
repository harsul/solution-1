import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { render, type RenderOptions } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import AuthProvider from '../features/auth/AuthProvider';
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

/** Renders with theme, router (starting at `route`) and auth state, like the real app. */
export function renderWithProviders(ui: ReactElement, { route = '/' }: { route?: string } = {}) {
  return render(ui, {
    wrapper: ({ children }) => (
      <ThemeProvider theme={theme} defaultMode="system">
        <MemoryRouter initialEntries={[route]}>
          <AuthProvider>{children}</AuthProvider>
        </MemoryRouter>
      </ThemeProvider>
    ),
  });
}
