/**
 * Remembers that the "please confirm your email" banner was closed, for this browser tab session.
 * Cleared on sign-in and sign-out, so the banner comes back the next time the user signs in.
 * Storage can be unavailable (private mode, blocked site data): then the banner just shows again.
 */
const prefix = 'confirm-email-banner-dismissed:';

export function isBannerDismissed(email: string): boolean {
  try {
    return sessionStorage.getItem(prefix + email) === '1';
  } catch {
    return false;
  }
}

export function dismissBanner(email: string): void {
  try {
    sessionStorage.setItem(prefix + email, '1');
  } catch {
    // Not remembered; the banner reappears on the next page load.
  }
}

export function clearBannerDismissals(): void {
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Nothing stored or storage unavailable.
  }
}
