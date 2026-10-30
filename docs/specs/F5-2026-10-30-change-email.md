---
id: F5
title: Change email address
plan: docs/plans/F5-2026-10-30-change-email.md
status: Approved
phase: 0/2
created: 2026-10-30
approved: 2026-10-30
branch:
---

# Spec F5 – Change email address

## Overview
Two own endpoints under `/api/account` (F4 pattern). **Request:** the signed-in user sends the new address and their password (lockout-counted); the server creates an Identity change-email token and emails a link to the **new** address. **Confirm:** the link opens a frontend page that posts the link values; the server applies `ChangeEmailAsync` (sets the email, marks it confirmed, changes the security stamp), renames the sign-in name to the new address, keeps the confirming browser signed in when it belongs to the same user, and notifies the old address. Identity's built-in `newEmail` option on `/manage/info` is blocked.

## Architecture decisions
- **Own endpoints** (Q1): the built-in `newEmail` flow needs no password, can't notify the old address, and our `IdentityEmailSender` drops its `changedEmail` link value.
- **Sessions** (Q2): the stamp change ends every session; the confirm endpoint re-issues the cookie (`RefreshSignInAsync`) when the caller is signed in as the same user. Other devices are signed out on their next request (F4).
- **Built-in blocked** (Q3): an endpoint filter on the built-in Identity endpoints rejects an `InfoRequest` with `NewEmail` → `400` `UseAccountEmail`.
- **Link lifetime 24 h:** `options.Tokens.ChangeEmailTokenProvider = EmailConfirmationTokenProvider.ProviderName` (same provider and lifetime as F3). This also fixes the F2 note that change-email links used the 1 h provider.
- **Rate limit:** the request endpoint sends email to an address of the user's choice, so it joins the limited paths (`RateLimits:ChangeEmail`, 5 per 15 min per IP).
- **Usernames are emails:** after the change, `SetUserNameAsync(user, newEmail)` so sign-in uses the new address.

## API
| Method | Route | Request | Response | Errors |
|---|---|---|---|---|
| POST | `/api/account/email` (signed in) | `{ newEmail, password }` | `204`; link emailed to `newEmail` | `400` `PasswordMismatch` / `LockedOut` / `InvalidEmail` / `SameEmail` / `DuplicateEmail`; `401`; `429` |
| POST | `/api/account/email/confirm` (anonymous) | `{ userId, email, code }` | `204`; cookie re-issued if the caller is that user | `400` `InvalidToken` (expired, used, tampered, unknown user) / `DuplicateEmail` |
| POST | `/api/auth/manage/info` (built-in) | with `newEmail` | – | `400` `UseAccountEmail` (blocked) |

Check order (request): password first (so nothing else is revealed without it), then email format, same-as-current, in use.

## Data models
No database changes.

**C# (server)**
```csharp
public sealed record ChangeEmailRequest(string? NewEmail, string? Password);
public sealed record ConfirmEmailChangeRequest(string? UserId, string? Email, string? Code);
// Email/Messages: ChangeEmailMessage.Create(to, link)            – to the new address, "valid for 24 hours"
//                 EmailChangedMessage.Create(to, newEmail)        – to the old address, no link
// Email/EmailLinks: ConfirmEmailChange(publicUrl, userId, email, code) → /confirm-email-change?userId=&email=&code=
```
**TypeScript (frontend)**
```ts
export type ChangeEmailResult = { ok: true } | { ok: false; code: 'wrongPassword' | 'lockedOut' | 'invalidEmail' | 'sameEmail' | 'inUse' | 'tooManyRequests' };
export type ConfirmEmailChangeResult = 'changed' | 'invalid' | 'inUse';
```

## Server
| File | New/Changed | Responsibility |
|---|---|---|
| `Endpoints/AccountEndpoints.cs` | Changed | `POST /email` (in the authorized group) and `POST /email/confirm` (`AllowAnonymous`) as above |
| `Endpoints/AuthEndpoints.cs` | Changed | endpoint filter on `MapIdentityApi` rejecting `InfoRequest.NewEmail` |
| `Email/EmailLinks.cs` | Changed | `ConfirmEmailChange(...)` |
| `Email/Messages/ChangeEmailMessage.cs` | New | "Confirm your new email address": link, valid 24 hours, "your current address keeps working until then" |
| `Email/Messages/EmailChangedMessage.cs` | New | "Your email address was changed": new address, "If this wasn't you, reset your password" (via the new address is impossible, so: contact/sign in), no link |
| `Auth/IdentitySetup.cs` | Changed | `ChangeEmailTokenProvider` = the 24 h provider |
| `RateLimiting/RateLimitSetup.cs` | Changed | `ChangeEmail` limit + `/api/account/email` in `LimitedPaths` |
| `tests/.../ServerFactory.cs` | Changed | high `RateLimits:ChangeEmail` in tests |

Validation: `EmailAddressAttribute` on the trimmed address, like F2. Send failures are logged (response stays `204`), like F2/F4. A malformed `code` (not Base64Url) is `InvalidToken`, not a 500.

## Frontend
| File | New/Changed | Responsibility |
|---|---|---|
| `src/features/account/api.ts` | Changed | `changeEmail(newEmail, password)`, `confirmEmailChange(userId, email, code)` |
| `src/features/account/EmailSection.tsx` | New | first section on `/account`: current address + "Confirmed"/"Not confirmed" chip; New email (`isValidEmail`) + Password; success Alert "We've sent a confirmation link to <new>. Your email changes when you click it."; error texts per code |
| `src/features/account/ConfirmEmailChangePage.tsx` | New | `/confirm-email-change?userId&email&code` (not guarded): confirms once on open (StrictMode-safe, like `ConfirmEmailPage`), then `refreshUser()`; views: "Your email address was changed." (+ "Account settings" or "Sign in"), "This link is no longer valid" (+ request again from Account settings), "This email address is already in use.", generic error |
| `src/features/account/AccountPage.tsx` | Changed | `EmailSection` first |
| `src/App.tsx` | Changed | route `/confirm-email-change` |
| `src/test/fakeApi.ts` | Changed | handlers for both endpoints |

## Tests
| Acceptance criterion | Test | Project/file |
|---|---|---|
| P1 – Email section shows address + confirmed state | page test | `EmailSection.test.tsx` |
| P1 – valid request → link to new address, nothing changes yet | `Request_sends_link_to_new_address_and_changes_nothing_yet` | `xIntegration/ChangeEmailTests.cs` |
| P1 – invalid / same / in use | `Request_rejects_invalid_same_and_used_addresses` (Theory) | `ChangeEmailTests.cs` |
| P1 – wrong password; lockout counted | `Request_with_wrong_password_returns_PasswordMismatch`, `Request_counts_wrong_passwords_towards_lockout` | `ChangeEmailTests.cs` |
| P1 – rate limit | `Sixth_request_within_15_minutes_is_rate_limited` | `ChangeEmailTests.cs` |
| P1 – built-in blocked | `Built_in_newEmail_is_rejected` | `ChangeEmailTests.cs` |
| P1 – UI messages, client validation | page tests | `EmailSection.test.tsx` |
| P2 – link changes + confirms email; new sign-in works, old doesn't | `Confirm_changes_email_and_sign_in_name` | `ChangeEmailTests.cs` |
| P2 – this browser stays signed in, others signed out | `Confirm_keeps_this_browser_and_signs_out_others` | `ChangeEmailTests.cs` |
| P2 – expired / used / tampered link | `Confirm_link_works_once`, `Expired_confirm_link_is_InvalidToken`, `Malformed_code_is_InvalidToken` | `ChangeEmailTests.cs` |
| P2 – old address notified (only if confirmed) | `Confirm_notifies_old_confirmed_address`, `…_unconfirmed_…` | `ChangeEmailTests.cs` |
| P2 – address taken meanwhile | `Confirm_when_address_was_taken_meanwhile_returns_DuplicateEmail` | `ChangeEmailTests.cs` |
| P2 – page views | page tests | `ConfirmEmailChangePage.test.tsx` |
| messages + link | unit tests | `xUnit/EmailTests.cs` |

## Implementation phases
### Phase 1 – Request the change
1. Token provider, rate limit, `EmailLinks.ConfirmEmailChange`, `ChangeEmailMessage`, `POST /api/account/email`, built-in filter; tests.
2. `EmailSection` + api + fakeApi; tests.

### Phase 2 – Confirm the change
1. `POST /api/account/email/confirm`, `EmailChangedMessage`; tests.
2. `ConfirmEmailChangePage` + route; tests.

## Questions
<!-- Answer under each question, then run /fplan F5. Asked by: Architect | Developer -->
- **Q1 (Architect):** Own endpoints or the built-in `newEmail` flow?
  - **Answer (2026-10-30):** Own endpoints.
- **Q2 (Architect):** Sessions after the change?
  - **Answer (2026-10-30):** The browser that opens the link stays signed in if it is the same user; other devices are signed out.
- **Q3 (Architect):** Block the built-in `newEmail` on `/manage/info`?
  - **Answer (2026-10-30):** Yes, 400.

## Risks / notes
- Requesting again doesn't invalidate earlier links (Identity tokens only die with the stamp); every link is for the address it was sent to, and the first one used changes the stamp, so all others stop working.
- Phase 1 alone sends links to a page that only exists in phase 2; the branch is merged only after phase 2.
- Approved by the stakeholder's "finish the remaining features" after the three architecture answers.

## Changes during implementation
- _filled in by /fimplement_

## Review log
- _filled in by /freview_
