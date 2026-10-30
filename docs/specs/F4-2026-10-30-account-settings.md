---
id: F4
title: Account settings
plan: docs/plans/F4-2026-10-30-account-settings.md
status: In progress
phase: 2/3
created: 2026-10-30
approved: 2026-10-30
branch: feature/F4-account-settings
---

# Spec F4 – Account settings

## Overview
Own minimal-API endpoints under `/api/account` (signed-in only) change the password, end other sessions and delete the account. All three verify the password with `SignInManager.CheckPasswordSignInAsync(..., lockoutOnFailure: true)`, so wrong passwords count towards the F1 lockout. Ending sessions uses Identity's **security stamp**: changing it invalidates every cookie, and `RefreshSignInAsync` re-issues the cookie for the current browser. The stamp is now checked on **every request**, so other devices are signed out on their next call. The React app gets an `/account` page with three sections, reached from the user menu.

## Architecture decisions
- **Security stamp checked on every request** (Q1): `SecurityStampValidatorOptions.ValidationInterval = TimeSpan.Zero`. One user lookup per signed-in request; also closes F2's "other sessions end within 30 minutes" note.
- **Own endpoints** (Q2, Q3): the built-in `/manage/info` password change doesn't count wrong passwords, would sign out this browser too (stamp change) and can't send notifications. Delete is `POST /api/account/delete` with a JSON body.
- **Error shape:** like Identity's own errors, a `400` ValidationProblem keyed by code: `PasswordMismatch` (wrong password), `LockedOut`, `EmailMismatch` (delete), and Identity's password rule codes (`PasswordTooShort`, ...). The frontend maps codes to messages.
- **Notifications:** sent after the change succeeded, only when the email is confirmed, inside the request; failures are logged and don't change the response (as in F2). Plain text + HTML in code, no links that change anything.
- **No new rate limit:** the lockout already limits password guessing; these endpoints need a session.

## API
| Method | Route | Request | Response | Errors |
|---|---|---|---|---|
| POST | `/api/account/password` | `{ currentPassword, newPassword }` | `204`; this browser's cookie is re-issued | `400` `PasswordMismatch` / `LockedOut` / password rule codes; `401` not signed in |
| POST | `/api/account/sign-out-others` | – | `204`; this browser's cookie is re-issued | `401` |
| POST | `/api/account/delete` | `{ password, email }` | `204`; cookie cleared | `400` `PasswordMismatch` / `LockedOut` / `EmailMismatch`; `401` |

Order of checks (password and delete): lockout/password via `CheckPasswordSignInAsync` first; only then the email match (delete) or the new password rules (password). So rule errors never reveal anything without the right password.

## Data models
No database changes.

**C# (server)**
```csharp
public sealed record ChangePasswordRequest(string? CurrentPassword, string? NewPassword);
public sealed record DeleteAccountRequest(string? Password, string? Email);
// Email/Messages: PasswordChangedMessage.Create(to), AccountDeletedMessage.Create(to)
```
**TypeScript (frontend)**
```ts
export type ChangePasswordResult = { ok: true } | { ok: false; code: 'wrongPassword' | 'lockedOut' | 'rules'; errors: string[] };
export type DeleteAccountResult = { ok: true } | { ok: false; code: 'wrongPassword' | 'lockedOut' | 'emailMismatch' };
```

## Server
| File | New/Changed | Responsibility |
|---|---|---|
| `Endpoints/AccountEndpoints.cs` | New | `MapAccountEndpoints()`: group `/api/account`, `.RequireAuthorization()`, the three endpoints above; a private `VerifyPasswordAsync` helper returning `null` or the `LockedOut`/`PasswordMismatch` ValidationProblem |
| `Email/Messages/PasswordChangedMessage.cs` | New | "Your password was changed": time (UTC), "If this wasn't you, reset your password on the sign-in page" |
| `Email/Messages/AccountDeletedMessage.cs` | New | "Your account was deleted": can't be undone; you can register again anytime |
| `Auth/IdentitySetup.cs` | Changed | `Configure<SecurityStampValidatorOptions>(o => o.ValidationInterval = TimeSpan.Zero)` |
| `Program.cs` | Changed | `app.MapAccountEndpoints()` |

Endpoint details:
- **password:** `GetUserAsync(principal)` (null → 401) → verify → `ChangePasswordAsync` (failure → 400 with its codes) → `RefreshSignInAsync(user)` (keeps Remember me) → notify if confirmed → 204.
- **sign-out-others:** `UpdateSecurityStampAsync` → `RefreshSignInAsync` → 204.
- **delete:** verify → trimmed `email` equals the stored email (`OrdinalIgnoreCase`) else `EmailMismatch` → remember address + confirmed → `DeleteAsync` (Identity tables cascade) → `SignOutAsync` → notify → 204.

Persistence and caching: none new.

## Frontend
| File | New/Changed | Responsibility |
|---|---|---|
| `src/features/account/api.ts` | New | `changePassword`, `signOutOtherDevices`, `deleteAccount` via `apiFetch` (401 → session expired), map codes to results |
| `src/features/account/AccountPage.tsx` | New | `/account`: title "Account settings", the signed-in email, the three sections as `Card`s |
| `src/features/account/ChangePasswordSection.tsx` | New | Current / New / Repeat new password + `PasswordRules`; success Alert "Your password was changed." and fields cleared; errors: "Your current password is incorrect.", F1 lockout text, rule messages, "Something went wrong. Please try again." |
| `src/features/account/SignOutOthersSection.tsx` | New | Button → confirm `Dialog` → "You've been signed out on all other devices." |
| `src/features/account/DeleteAccountSection.tsx` | New | "Delete account" (error colour) → `Dialog`: warning, password, "Type your email to confirm"; **Delete my account** enabled when password not empty and email matches case-insensitively; success → `signOut()` → `/signin` with notice "Your account was deleted."; errors "Your password is incorrect.", lockout text |
| `src/features/auth/UserMenu.tsx` | Changed | "Account settings" item (`ManageAccounts` icon) → `/account` |
| `src/App.tsx` | Changed | `/account` inside `RequireAuth` |
| `src/test/fakeApi.ts` | Changed | handlers for the three endpoints (password check against `users`, session per test) |

State and UX: buttons disabled and `loading` while busy; dialogs close only via Cancel or success; mobile 390 px: sections stack full width; light/dark via theme.

## Tests
| Acceptance criterion | Test | Project/file |
|---|---|---|
| P1 – user menu → `/account` | menu item opens the page | `UserMenu.test.tsx` / `AccountPage.test.tsx` |
| P1 – signed out → Sign in → back | `/account` redirects and returns | `AccountPage.test.tsx` |
| P1 – change works, new pw signs in, old doesn't | `Change_password_with_correct_current_password_works` | `xIntegration/AccountEndpointsTests.cs` |
| P1 – other device signed out, this one stays | `Change_password_signs_out_other_sessions_but_keeps_this_one` (two clients; other → `/api/auth/manage/info` 401) | `AccountEndpointsTests.cs` |
| P1 – wrong current password; lockout after 5 | `Wrong_current_password_returns_PasswordMismatch`, `Fifth_wrong_current_password_locks_the_account` | `AccountEndpointsTests.cs` |
| P1 – rules / mismatch block submit; server rule codes | page test; `Weak_new_password_returns_rule_codes` | `ChangePasswordSection.test.tsx`; `AccountEndpointsTests.cs` |
| P1 – notification only when confirmed | `Password_change_notifies_confirmed_address`, `…_does_not_notify_unconfirmed` | `AccountEndpointsTests.cs`; message text in `xUnit/EmailTests.cs` |
| P1 – 401 when signed out | `Account_endpoints_require_a_session` (Theory, all routes) | `AccountEndpointsTests.cs` |
| P2 – sign out others | `Sign_out_others_ends_other_sessions_but_keeps_this_one` | `AccountEndpointsTests.cs` |
| P2 – confirm / cancel | dialog tests | `SignOutOthersSection.test.tsx` |
| P3 – button disabled until email matches | dialog test | `DeleteAccountSection.test.tsx` |
| P3 – delete, signed out, can't sign in | `Delete_removes_the_account_and_signs_out` | `AccountEndpointsTests.cs` |
| P3 – same email can register again | `Deleted_email_can_register_again` | `AccountEndpointsTests.cs` |
| P3 – wrong password / email mismatch | `Delete_with_wrong_password_keeps_the_account`, `Delete_with_other_email_returns_EmailMismatch` | `AccountEndpointsTests.cs` |
| P3 – notification when confirmed | `Delete_notifies_confirmed_address` | `AccountEndpointsTests.cs` |
| P3 – other device signed out | `Delete_signs_out_other_sessions` | `AccountEndpointsTests.cs` |
| P3 – success → Sign in with notice; errors | page tests | `DeleteAccountSection.test.tsx` |

## Implementation phases
### Phase 1 – Account page and change password
1. `IdentitySetup`: stamp validation interval zero.
2. `AccountEndpoints` with `/password`, `PasswordChangedMessage`, `Program.cs`; integration + unit tests.
3. Frontend: `features/account/api.ts` (`changePassword`), `AccountPage` with `ChangePasswordSection`, route, user menu item, fakeApi; tests.

### Phase 2 – Sign out other devices
1. `/sign-out-others` endpoint + test.
2. `SignOutOthersSection` with confirm dialog + tests.

### Phase 3 – Delete account
1. `/delete` endpoint, `AccountDeletedMessage` + tests.
2. `DeleteAccountSection` with dialog, sign-in notice + tests.

## Questions
<!-- Answer under each question, then run /fplan F4. Asked by: Architect | Developer -->
- **Q1 (Architect):** How often should sessions be re-checked so other devices are signed out on their next request?
  - **Answer (2026-10-30):** Every request (`ValidationInterval = 0`).
- **Q2 (Architect):** Change password via an own endpoint or the built-in `/manage/info`?
  - **Answer (2026-10-30):** Own `POST /api/account/password`.
- **Q3 (Architect):** Delete call shape?
  - **Answer (2026-10-30):** `POST /api/account/delete` with `{ password, email }`.

## Risks / notes
- Per-request stamp check: two small queries (user + claims) per signed-in request, and every authenticated response re-issues the cookie (so sliding expiration restarts on each request). Static files are served before authentication to skip it. Fine for this app; revisit if traffic grows.
- Because every response re-issues the cookie, a request still in flight while the password changes (or other devices are signed out) could store a cookie with the old stamp and sign this browser out. The account page makes no parallel calls, so this is unlikely.
- Bearer tokens from the built-in `/api/auth/login` (without `useCookies`) aren't checked against the stamp; an existing access token keeps working until it expires (1 h). The React app uses cookies only.
- A signed-out device notices on its next API call; a page left open shows the F1 "session expired" message then.
- The built-in `/manage/info` can still change the password (no lockout counting, signs out this browser too). The UI doesn't use it; it stays for now.
- Deleting removes Identity rows only; future features that store user data must delete it too (or use cascade).

## Changes during implementation
- Phase 1: the 401 test is a Theory over the account routes; phases 2 and 3 add their routes to it.
- Phase 1: after a wrong current password or lockout, only the current-password field is cleared and focused; the new password stays so it needn't be typed again.
- Phase 1: `PasswordChangedMessage` takes the time from `TimeProvider` and states it in UTC.
- Phase 1: rule errors from the server show Identity's own descriptions (as on Register and Reset password) instead of frontend-mapped texts.
- Phase 1 (review fix): `app.UseFileServer()` moved before `UseAuthentication()`; the lockout text is shared in `features/auth/messages.ts`; the server's `LockedOut` description is just "Account locked.".
- Phase 2: the dialog's confirm button says "Sign out others" (not "Sign out", which is the user menu's action for this browser). A failed security-stamp update is an error (500), never a 204.

## Review log
- 2026-10-30, Phase 1 (independent reviewer; `/code-review` not available in this session). No 🔴.
  - Fixed 🟡 1: the rule test now checks *which* rule fails (accessible description), here and in `ResetPasswordPage.test.tsx`.
  - Fixed 🟡 2: hidden `username` field so password managers update the right entry.
  - Fixed 🔵 3 (static files before authentication + risk note), 🔵 4 and 🔵 9 (risk notes), 🔵 5 (test that Remember me survives the change), 🔵 6 (shared lockout text), 🔵 7 (focus returns to Current password after success).
  - Skipped 🔵 8 (fields editable while saving): same as the other forms.
- 2026-10-30, Phase 2 (independent reviewer). No 🔴.
  - Fixed 🟡 1: the result of `UpdateSecurityStampAsync` was ignored; a failure now throws (logged 500) instead of claiming success. Not covered by a test (needs a failing user store).
  - Fixed 🔵 2: confirm button renamed "Sign out others".
  - Fixed 🔵 3: the page test now checks that this browser is not signed out (no logout call, user menu still there).
