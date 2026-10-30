---
id: F3
title: Email confirmation
status: Done
created: 2026-10-30
approved: 2026-10-30
depends-on: F1
---

# F3 – Email confirmation

## Goal
Users confirm that the email address on their account is really theirs. This keeps sign-up as quick as today, but makes the address trustworthy for anything sent to it, starting with password reset (F2). Success means new and existing users can confirm with one click from an email, and know when they still need to.

## User stories
- As a new user, I want a confirmation email right after creating my account so that I can prove the address is mine.
- As a user, I want to click the link in that email and see that my email is confirmed.
- As a user who hasn't confirmed yet, I want a reminder in the app and a way to get the email again, so that I don't get stuck if I lost or missed it.
- As someone who forgets passwords, I want my email confirmed so that I can reset my password later (F2).

## User flow
1. A visitor creates an account as today and is signed in right away (unchanged from F1).
2. They receive an email "Confirm your email address" with a button/link.
3. In the app, a banner says "Please confirm your email address" with **Resend email** and a close button.
4. They click the link in the email and see an **Email confirmed** page with a button to the app (or **Sign in** if they're not signed in on that device).
5. Once confirmed, the banner is gone for good.

## Scope
**In:** confirmation email on sign-up, confirmation page, expired/used link handling, reminder banner, resend email, existing accounts treated as unconfirmed.
**Out:** blocking unconfirmed users, changing the email address, confirming again after a change, real email provider for production (later), password reset itself (F2).

## Product decisions
- Unconfirmed users can use the whole app; confirmation is only *required* for password reset (F2).
- Accounts created before this feature count as unconfirmed: they see the banner and can request the email.
- The confirmation link is valid for 24 hours and works once. Opening it after the email is already confirmed just shows "Email confirmed".
- The banner can be closed; it stays hidden until the next sign-in and comes back while the email is unconfirmed.
- "Resend email" sends at most one email per minute†; the button says when it can be used again. Sending a new email doesn't break earlier links that are still valid†.
- After clicking the link, the user sees an "Email confirmed" page (whether signed in or not), with a button to the app or to Sign in.
- An expired or invalid link shows "This link is no longer valid" with a way to get a new one: **Resend email** when signed in, otherwise **Sign in** (then use the banner).
- During development, emails go to the local test mailbox (Mailpit), like F2.

† Default chosen by the PO; change during review if needed.

## Phases

### Phase 1 – Confirmation email and confirm page
**Goal:** every new account gets a working confirmation link.
- [x] Given I create a new account, when registration succeeds, then a "Confirm your email address" email with a link arrives in the test mailbox, and I'm signed in as before.
- [x] Given I open a valid confirmation link, when the page loads, then I see "Email confirmed" with a button to the app (or Sign in when I'm not signed in).
- [x] Given my email is already confirmed, when I open the link again, then I still see "Email confirmed".
- [x] Given a link older than 24 hours or a tampered link, when I open it, then I see "This link is no longer valid" with a way to get a new one.

### Phase 2 – Reminder and resend
**Goal:** unconfirmed users (new and existing) are reminded and can get the email again.
- [x] Given I'm signed in with an unconfirmed email, when I use the app, then I see a banner "Please confirm your email address" with Resend email and a close button.
- [x] Given I click Resend email, when it succeeds, then a new confirmation email arrives and the banner says it was sent; clicking again within a minute is not possible and says when it will be.
- [x] Given I close the banner, when I keep using the app, then it stays hidden; when I sign in again later and am still unconfirmed, then it's back.
- [x] Given my email is confirmed, when I use the app, then no banner is shown.
- [x] Given an account created before this feature, when its owner signs in, then they see the banner like any unconfirmed user.

## Questions
<!-- Answer under each question, then run /fbrainstorm F3. Asked by: PO | Architect -->
_None open._

## Questions for the architect
- The built-in registration already calls `SendConfirmationLinkAsync` (found while planning F2); please build on Identity's confirmation tokens rather than a separate mechanism.
- Confirmation links are valid for 24 hours, while F2's reset links are valid for 1 hour, so the two need separate token lifetimes.
- Links in emails must point to the frontend (configured public URL), as recorded for F2.

## Related
- F1 – User accounts: changes F1's "no email confirmation" decision; sign-up itself stays the same.
- F2 – Forgot password depends on this feature (reset requires a confirmed email).

## Later
- Changing the email address (with re-confirmation), requiring confirmation before sign-in, real email provider for production.
