---
id: F2
title: Forgot password
status: Approved
created: 2026-10-30
approved: 2026-10-30
depends-on: F1
---

# F2 – Forgot password

## Goal
Users who forgot their password can set a new one through a link sent to their email, without contacting anyone. Success means a locked-out user is back in the app within a few minutes.

## User stories
- As a user who forgot my password, I want to request a reset link by email so that I can choose a new password myself.
- As an account owner, I want reset links to work only once and only for a limited time so that an old email can't be misused.

## User flow
1. On Sign in, the user clicks **Forgot password?**
2. They enter their email and submit; they see "If an account exists for this email, we've sent a link to reset your password."
3. They open the email and click the link.
4. On **Set a new password** they enter the new password twice (same rules as F1).
5. On success they're told the password was changed and are sent to Sign in.

## Scope
**In:** request reset link, reset email, set new password from the link, expired/used link handling.
**Out:** change password while signed in, email confirmation, real email provider for production (later), SMS or security questions.

## Product decisions
- The request page never reveals whether an email has an account (same message either way).
- The reset link is valid for 1 hour and works only once.
- New passwords follow the F1 rules; the old password stops working immediately.
- After resetting, the user signs in themselves (no automatic sign-in).
- A successful reset also lifts a temporary lockout.
- During development, emails are delivered to a local test mailbox that only developers see; no real emails are sent yet.

## Phases

### Phase 1 – Request a reset link
**Goal:** users can ask for a reset email and receive it.
- [ ] Given I'm on Sign in, when I click "Forgot password?", then I see a page asking for my email.
- [ ] Given I enter an email that has an account, when I submit, then I see the neutral confirmation message and an email with a reset link arrives in the test mailbox.
- [ ] Given I enter an email without an account, when I submit, then I see the same confirmation message and no email is sent.
- [ ] Given I enter an invalid email address, when I submit, then I see a validation message and nothing is sent.

### Phase 2 – Set a new password
**Goal:** the link lets users choose a new password and sign in with it.
- [ ] Given I open a valid reset link, when I enter a new valid password twice, then I'm told it was changed and sent to Sign in, where the new password works and the old one doesn't.
- [ ] Given the link is older than 1 hour or was already used, when I open it or submit it, then I see "This link has expired" with a button to request a new one.
- [ ] Given my new password breaks a rule or the two passwords differ, when I try to submit, then I see which rule fails and can't submit.
- [ ] Given my account was temporarily locked, when I reset my password, then I can sign in right away with the new password.

## Questions
<!-- Answer under each question, then run /fbrainstorm F2. Asked by: PO | Architect -->
_None open._

## Questions for the architect
- Stakeholder preference: use **Mailpit** as the development mailbox (local SMTP with a web inbox), ideally started by Aspire alongside the app.
- Which real email provider to use in production is a later feature; keep sending email behind something that can be swapped.

## Related
- F1 – User accounts (required first).

## Later
- Real email provider for production, change password while signed in, email confirmation on registration.
