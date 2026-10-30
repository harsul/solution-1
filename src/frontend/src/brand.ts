/**
 * The product's brand: name, tagline and colors. `/finit` sets these values; the theme, the app bar
 * and the page title are derived from them. Keep `name` in sync with `Branding.ProductName` on the
 * server (emails) and `<title>` in index.html.
 */
export const brand = {
  name: 'Aspire Starter',
  tagline: 'Modern distributed application development',
  /** Main brand color: buttons, links, focus, selected states. */
  primary: '#6b46a3',
  /** Accent color: the app bar gradient starts with it. */
  secondary: '#5b6fd8',
  /**
   * Optional lighter shades for dark mode. Leave them out to derive them from the colors above
   * (lightened for contrast on the dark background).
   */
  primaryDark: '#a78bfa' as string | undefined,
  secondaryDark: '#7c92f5' as string | undefined,
  /** Color mode before the user picks one: follow the system, or start light or dark. */
  defaultMode: 'system' as 'system' | 'light' | 'dark',
};
