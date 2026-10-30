---
id: F4
title: Account settings
status: Approved
created: 2026-10-30
approved: 2026-10-30
depends-on: F1, F3
---

# F4 – Account settings

## Goal
Signed-in users can manage their own account: change their password, sign out devices they no longer use, and delete the account. Success: none of this needs support, and a stolen session or password can be cut off by the user.

## User stories
- As a signed-in user, I want to change my password so that I can replace a weak or leaked one.
- As a signed-in user, I want to sign out my other devices so that a lost laptop or shared computer can't use my account.
- As a signed-in user, I want to delete my account so that my data is gone when I stop using the app.
- As an account owner, I want an email when my password changes or my account is deleted so that I notice if it wasn't me.

## User flow
1. Signed in, I open the user menu and choose **Account settings**; the page `/account` opens with three sections: **Password**, **Sessions**, **Delete account**.
2. **Password:** I enter my current password, a new password and the new password again; the password rules show while I type. On **Change password** I see "Your password was changed." I stay signed in here; my other devices are signed out. A notification email goes to my address.
3. **Sessions:** I click **Sign out other devices** and confirm; I see "You've been signed out on all other devices." I stay signed in here.
4. **Delete account:** I click **Delete account**; a dialog explains it can't be undone and asks for my password and to type my email address. **Delete my account** stays disabled until the typed email matches. After deleting, I'm signed out and see "Your account was deleted." on the Sign in page. A notification email goes to my address.
5. Errors: a wrong current password shows "Your current password is incorrect." (fields keep their values except the password); too many tries show the F1 lockout message; network/server problems show "Something went wrong. Please try again."

## Scope
**In:**
- `/account` page (signed-in only) with a link in the user menu.
- Change password with current password, password rules (F1), repeat field.
- Sign out other devices (keeps the current session).
- Delete account immediately, confirmed with password + typing the email.
- Notification emails (password changed, account deleted) to **confirmed** addresses.

**Out:**
- Changing the email address (F5).
- Listing individual sessions/devices, or signing out one specific device.
- Grace period or restoring a deleted account; data export.
- Two-factor authentication.

## Product decisions
- Settings live on one page `/account`, reached from the user menu (Q&A 2026-10-30).
- After a password change: this browser stays signed in, all other sessions end right away (Q&A).
- "Sign out other devices" ends every other session and keeps this one, the same rule as the password change.
- Delete is immediate and can't be undone; it needs the password **and** the typed email (case-insensitive match) (Q&A).
- Users with an unconfirmed email can use all settings; notification emails are sent only to confirmed addresses, since an unconfirmed address may be a typo (Q&A).
- Notification emails say what changed, when, and "If this wasn't you, reset your password" (password change) — they never contain a link that changes anything.
- A wrong current password counts towards the F1 lockout (5 tries → 5 minutes), so the settings can't be used to guess the password.

## Phases

### Phase 1 – Account page and change password
**Goal:** users can change their password from a new Account settings page.
- [x] Given I'm signed in, when I open the user menu, then I see "Account settings", which opens `/account`.
- [x] Given I'm signed out, when I open `/account`, then I'm sent to Sign in and come back to `/account` afterwards.
- [x] Given I enter my correct current password and a valid new password twice, when I click Change password, then I see "Your password was changed.", the new password works for signing in and the old one doesn't.
- [x] Given I'm signed in on two devices, when I change my password on one, then the other is signed out on its next request and this one stays signed in.
- [x] Given my current password is wrong, when I submit, then I see "Your current password is incorrect." and the password isn't changed; after 5 wrong tries I see the F1 lockout message.
- [x] Given the new password breaks a rule or the two new passwords differ, when I try to submit, then I see which rule fails and can't submit.
- [x] Given my email is confirmed, when I change my password, then I receive a "Your password was changed" email; given it isn't confirmed, no email is sent.

### Phase 2 – Sign out other devices
**Goal:** users can end all their other sessions.
- [x] Given I'm signed in on two devices, when I click "Sign out other devices" and confirm, then I see "You've been signed out on all other devices.", the other device is signed out on its next request, and I stay signed in.
- [x] Given I open the confirmation, when I cancel, then nothing changes.

### Phase 3 – Delete account
**Goal:** users can delete their account for good.
- [ ] Given I open Delete account, when the typed email doesn't match my address or the password is empty, then "Delete my account" is disabled.
- [ ] Given I enter my password and my email, when I confirm, then the account is deleted, I'm signed out, I see "Your account was deleted." on Sign in, and I can't sign in with it anymore.
- [ ] Given the account is deleted, when someone registers with the same email, then it works like a new account.
- [ ] Given my password is wrong, when I confirm, then I see "Your password is incorrect." and nothing is deleted.
- [ ] Given my email was confirmed, when I delete my account, then I receive an "Your account was deleted" email.
- [ ] Given I was signed in on another device, when I delete my account here, then the other device is signed out on its next request.

## Questions
<!-- Answer under each question, then run /fbrainstorm F4. Asked by: PO | Architect -->
_None._

## Related
- F1 – User accounts (password rules, lockout, sessions).
- F3 – Email confirmation (email pipeline; confirmed vs unconfirmed).
- F5 – Change email address (split from this feature).

## Later
- List active sessions with device/browser and sign out one of them.
- Two-factor authentication.
