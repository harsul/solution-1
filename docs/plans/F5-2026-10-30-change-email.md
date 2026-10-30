---
id: F5
title: Change email address
status: Done
created: 2026-10-30
approved: 2026-10-30
depends-on: F3, F4
---

# F5 – Change email address

## Goal
Signed-in users can change the email address they sign in with, for example after switching jobs or to fix a typo made at sign-up. The new address must be proven by a confirmation link, and the old address is told about the change.

## User stories
- As a signed-in user, I want to change my email address so that I keep my account when my address changes.
- As a user who mistyped my email at sign-up, I want to correct it so that I can confirm it and reset my password later.
- As an account owner, I want my old address to be told about a change so that I notice if someone else did it.

## User flow
1. On **Account settings** (F4) a new **Email** section shows my current address and whether it is confirmed.
2. I enter a new address and my password and click **Change email**. I see "We've sent a confirmation link to <new address>. Your email changes when you click it." My current address keeps working until then.
3. I open the link from the new mailbox: the address changes, it counts as confirmed, and I see "Your email address was changed." From now on I sign in with the new address.
4. My old address (if it was confirmed) gets "Your email address was changed to <new>. If this wasn't you, contact us/reset your password."

## Scope
**In:** Email section on `/account`; confirmation link to the new address (valid 24 hours, like F3); sign-in uses the new address after confirming; notification to the old confirmed address.
**Out:** undoing a change from the old address via a link; more than one email per account.

## Product decisions
- The change needs the current password (protects against a borrowed, signed-in browser).
- The email only changes after the link is clicked; until then nothing changes, and requesting again sends a new link.
- After the change, the new address is confirmed (the link proved it), and the "confirm your email" banner disappears.
- An address already used by another account shows "This email address is already in use." (registration reveals this already, F1).
- Users with an unconfirmed email may change it too — this is how a typo is fixed.

## Phases

### Phase 1 – Request the change
**Goal:** users can ask to change their email and get a link at the new address.
- [x] Given I'm on Account settings, when I look at the Email section, then I see my current address and whether it is confirmed.
- [x] Given I enter a valid new address and my correct password, when I click Change email, then I see the "We've sent a confirmation link" message, an email with a link arrives at the new address, and my sign-in address doesn't change yet.
- [x] Given the new address is invalid, the same as my current one, or already in use, when I submit, then I see why and nothing is sent.
- [x] Given my password is wrong, when I submit, then I see "Your password is incorrect." and nothing is sent.

### Phase 2 – Confirm the change
**Goal:** the link changes the address and the old address is told.
- [x] Given I open a valid link, then my email is changed and confirmed, I see "Your email address was changed.", and I can sign in with the new address but not the old one.
- [x] Given the link is older than 24 hours or already used, when I open it, then I see that it's no longer valid and can request the change again from Account settings.
- [x] Given my old address was confirmed, when the change completes, then the old address receives a notification email.
- [x] Given someone registered the new address in the meantime, when I open the link, then I see "This email address is already in use." and nothing changes.

## Questions
<!-- Answer under each question, then run /fbrainstorm F5. Asked by: PO | Architect -->
_None._

## Related
- F4 – Account settings (split from it; adds a section to its page).
- F3 – Email confirmation (link validity, confirmed state, banner).

## Later
- "This wasn't me" link in the notification that reverts the change.
