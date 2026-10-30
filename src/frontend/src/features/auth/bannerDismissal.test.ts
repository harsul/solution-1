import { describe, expect, it } from 'vitest';
import { clearBannerDismissals, dismissBanner, isBannerDismissed } from './bannerDismissal';

describe('bannerDismissal', () => {
  it('remembers a dismissal per email until cleared', () => {
    dismissBanner('ada@example.com');

    expect(isBannerDismissed('ada@example.com')).toBe(true);
    expect(isBannerDismissed('bob@example.com')).toBe(false);

    clearBannerDismissals();

    expect(isBannerDismissed('ada@example.com')).toBe(false);
  });

  it('leaves other session data alone when clearing', () => {
    sessionStorage.setItem('something-else', 'keep');
    dismissBanner('ada@example.com');

    clearBannerDismissals();

    expect(sessionStorage.getItem('something-else')).toBe('keep');
  });
});
