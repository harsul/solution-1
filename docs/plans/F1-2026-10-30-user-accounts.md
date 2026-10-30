---
id: F1
title: User accounts (register, sign in, sign out)
status: Approved
created: 2026-10-30
approved: 2026-10-30
depends-on:
---

# F1 – User accounts (register, sign in, sign out)

## Goal
Make the app private: people create an account with their email and a password, sign in to see the weather forecast, and sign out when they're done. Success means a visitor can go from "no account" to "signed in and seeing the forecast" in under a minute, and nobody sees the forecast without signing in.

## User stories
- As a visitor, I want to register with my email and a password so that I can use the app.
- As a registered user, I want to sign in so that I can see the weather forecast.
- As a signed-in user, I want to see that I'm signed in and be able to sign out, so that I stay in control on shared computers.
- As a user on my own computer, I want "Remember me" so that I don't have to sign in every time I open the browser.
- As an account owner, I want repeated wrong passwords to lock the account briefly so that nobody can guess my password.

## User flow
1. A visitor opens the app and sees the **Sign in** page (the forecast is not shown).
2. The visitor clicks **Create an account**, enters email, password and password again, and sees the password rules under the field.
3. On success they are signed in right away and land on the weather forecast.
4. The app bar shows their email; a menu next to it has **Sign out**.
5. Later they sign in with email and password, optionally ticking **Remember me**.
6. After sign-out, or when the session has expired, they're back on the Sign in page.

## Scope
**In:** register, sign in, sign out, remember me, password rules, temporary lockout, private weather page, signed-in state in the app bar.
**Out:** forgot password (→ F2), email confirmation, change password, profile/display name, social or Microsoft account sign-in, account deletion, admin/roles.

## Product decisions
- The whole app is private: only signed-in users see the weather forecast.
- Registration asks for email + password (typed twice). The email is the sign-in name.
- After registering the user is signed in automatically; no email confirmation.
- Password rules: at least 8 characters, containing at least one letter and one number. The rules are shown under the field and checked while typing.
- Sign-in errors never reveal whether the email exists: "Email or password is incorrect."
- 5 wrong passwords in a row lock the account for 5 minutes; the message says when to try again.
- Remember me: unticked = signed out when the browser closes; ticked = stay signed in for 14 days.
- Registering with an email that already has an account shows "An account with this email already exists" with a link to Sign in.
- The UI follows the existing Material UI look (Aspire purple, light/dark) and works on mobile.

## Phases

### Phase 1 – Create an account, sign in and sign out
**Goal:** the basic account loop works end to end.
- [ ] Given I'm not signed in, when I open the app, then I see the Sign in page with a link to Create an account.
- [ ] Given I'm on Create an account, when I enter a new email and matching valid passwords and submit, then I'm signed in and see the weather forecast.
- [ ] Given I have an account, when I sign in with the right email and password, then I see the weather forecast.
- [ ] Given I enter a wrong email or password, when I sign in, then I see "Email or password is incorrect" and stay on Sign in.
- [ ] Given I'm signed in, when I look at the app bar, then I see my email; when I choose Sign out, then I'm back on the Sign in page.
- [ ] Given a request is in progress, when I submit a form, then the button shows progress and can't be pressed twice.

### Phase 2 – Safe and convenient accounts
**Goal:** password rules, protection against guessing, and Remember me.
- [ ] Given I'm creating an account, when my password breaks a rule or the two passwords differ, then I see which rule fails before submitting and can't submit.
- [ ] Given an email that already has an account, when I register with it, then I see "An account with this email already exists" with a link to Sign in.
- [ ] Given I entered a wrong password 5 times in a row, when I try again within 5 minutes, then I'm told the account is temporarily locked and when to retry, even with the right password.
- [ ] Given I signed in with Remember me ticked, when I close and reopen the browser, then I'm still signed in (for up to 14 days).
- [ ] Given I signed in without Remember me, when I close and reopen the browser, then I have to sign in again.

### Phase 3 – Private app
**Goal:** nothing is visible without signing in, and users land where they wanted to go.
- [ ] Given I'm not signed in, when I open any page of the app directly, then I'm sent to Sign in, and after signing in I'm returned to the page I asked for.
- [ ] Given I'm not signed in, when the forecast data is requested, then it is refused and no weather data is shown.
- [ ] Given my session has expired, when I use the app, then I'm sent to Sign in with the message "Your session has expired, please sign in again."
- [ ] Given I'm signed in, when I open the Sign in or Create an account page, then I'm taken to the weather forecast instead.

## Questions
<!-- Answer under each question, then run /fbrainstorm F1. Asked by: PO | Architect -->
- **Q1 (Architect):** The built-in sign-in only reports "locked out", not until when. Is "This account is temporarily locked. Try again in 5 minutes." (based on the fixed lockout length) good enough for "the message says when to try again"?
  - **Answer:** Yes (2026-10-30).

## Questions for the architect
- Stakeholder preference: ASP.NET Core Identity, with accounts stored in PostgreSQL running in a container next to Redis. Please confirm or propose an alternative.
- Accounts must survive app restarts (persistent storage), but local development data may be reset.

## Related
- F2 – Forgot password (depends on F1).

## Later
- Change password, profile/display name, email confirmation, sign in with Microsoft account, account deletion, admin roles.
