---
id: F2
title: Forgot password
plan: docs/plans/F2-2026-10-30-forgot-password.md
status: Approved
phase: 0/2
created: 2026-10-30
approved: 2026-10-30
branch:
---

# Spec F2 – Forgot password

> Builds on **F3 – Email confirmation** (email pipeline, `App:PublicUrl`, rate limiter). Implement F3 first.

## Overview
A small **own** forgot-password endpoint decides what to send: a reset link for confirmed accounts, a "confirm your email first" link for unconfirmed ones, nothing for unknown addresses, always the same neutral response. The reset itself uses Identity's **built-in** `/api/auth/resetPassword`. Reset links point to the frontend (`/reset-password`), are valid for 1 hour and work once. The React app gets a Forgot password page, a Set new password page and a link on Sign in.

## Architecture decisions
- **Own forgot endpoint, built-in reset** (Q5). The built-in `/forgotPassword` stays mapped but inert: it only calls `SendPasswordResetCodeAsync`, which keeps logging and sending nothing (F3).
- **Reset tokens:** Identity's default token provider with `DataProtectionTokenProviderOptions.TokenLifespan = 1 h`; F3's confirmation tokens keep their own 24 h. Resetting changes the security stamp, so a reset link works once and other sessions of that user end at their next stamp check.
- **Code format:** the endpoint encodes the token exactly like the built-in flow (`WebEncoders.Base64UrlEncode(UTF8 bytes)`), so the built-in `/resetPassword` decodes it.
- **Links** via a shared `EmailLinks` helper (from F3's `App:PublicUrl`): `ResetPassword(email, code)` → `{PublicUrl}/reset-password?email=…&code=…`, `ConfirmEmail(userId, code)` → as in F3.
- **Rate limit:** `POST /api/auth/password/forgot` joins F3's path-scoped limiter: 5 requests per 15 minutes per client IP (`RateLimits:ForgotPassword`), 429 + `Retry-After`.
- **Lockout:** not lifted by a reset (plan Q2); a locked user waits ≤ 5 minutes.
- **Signed-in users** can use a reset link (Q4); after a successful reset the app signs them out locally and asks them to sign in.

## API
| Method | Route | Request | Response | Errors |
|---|---|---|---|---|
| POST | `/api/auth/password/forgot` | `{ email }` | `200` always (neutral) | `400` ValidationProblem if the email is missing/malformed; `429` rate limited |
| POST | `/api/auth/resetPassword` (built-in) | `{ email, resetCode, newPassword }` | `200` | `400` ValidationProblem: `InvalidToken` (expired/used/tampered or unconfirmed), password rule codes (F1) |

Forgot endpoint behaviour (same `200` for all):
- confirmed account → reset email with the reset link;
- unconfirmed account → "Confirm your email address first" email with a confirmation link (F3 token, 24 h);
- no account → nothing.

## Data models
No database changes.

**C# (server)**
```csharp
public sealed record ForgotPasswordRequest(string Email);   // own endpoint's body
// Messages: ResetPasswordMessage(link), ConfirmBeforeResetMessage(link) → EmailMessage (F3)
```
**TypeScript (frontend)**
```ts
export type ForgotResult = 'sent' | 'tooManyRequests';
export type ResetResult = { ok: true } | { ok: false; expired: boolean; errors: string[] };
```

## Server
| File | New/Changed | Responsibility |
|---|---|---|
| `Email/EmailLinks.cs` | New | builds frontend links from `App:PublicUrl` (used by `IdentityEmailSender` and the forgot endpoint) |
| `Email/IdentityEmailSender.cs` | Changed | use `EmailLinks` for the confirmation link; `SendPasswordResetCodeAsync` stays log-only |
| `Email/Messages/ResetPasswordMessage.cs` | New | "Reset your password", link, "valid for 1 hour", "ignore if you didn't ask" |
| `Email/Messages/ConfirmBeforeResetMessage.cs` | New | "Confirm your email address first", confirmation link, then request the reset again |
| `Endpoints/PasswordEndpoints.cs` | New | `MapPasswordEndpoints()`: `POST /api/auth/password/forgot` (anonymous) as above; delivery failures are logged, response stays `200` |
| `Auth/IdentitySetup.cs` | Changed | `Configure<DataProtectionTokenProviderOptions>(o => o.TokenLifespan = TimeSpan.FromHours(1))` |
| `RateLimiting/RateLimitSetup.cs` | Changed | + `/api/auth/password/forgot` partition (5 / 15 min / IP) |
| `Program.cs` | Changed | `MapPasswordEndpoints()` |

Validation and errors: malformed email → 400 (doesn't reveal anything about accounts). Built-in reset returns its own 400 codes.

## Frontend
| File | New/Changed | Responsibility |
|---|---|---|
| `src/features/auth/api.ts` | Changed | `requestPasswordReset(email): Promise<ForgotResult>`, `resetPassword(email, code, newPassword): Promise<ResetResult>` (`InvalidToken` → `expired: true`) |
| `src/features/auth/ForgotPasswordPage.tsx` | New | `/forgot-password` (GuestOnly): email (`isValidEmail`), submit → neutral message "If an account exists for this email, we've sent a link to reset your password."; 429 → "Too many requests. Please wait a few minutes and try again."; link back to Sign in; email prefilled from `?email=` |
| `src/features/auth/ResetPasswordPage.tsx` | New | `/reset-password?email=&code=` (not guarded): new password + repeat with `PasswordRules`; success → sign out locally if signed in → `/signin` with notice "Your password was changed. Please sign in."; expired → "This link has expired" + **Request a new link** (`/forgot-password?email=…`); missing params → same expired view |
| `src/features/auth/SignInPage.tsx` | Changed | "Forgot password?" link (keeps `state.from`) |
| `src/App.tsx` | Changed | routes `/forgot-password` (GuestOnly) and `/reset-password` |

State and UX: both pages use `AuthCard`, disabled submit while busy, light/dark, 390 px.

## Tests
| Acceptance criterion | Test | Project/file |
|---|---|---|
| P1 – Forgot password link on Sign in | link navigates to `/forgot-password` | `SignInPage.test.tsx` |
| P1 – confirmed account → reset email | `Forgot_for_confirmed_account_sends_reset_link_to_frontend` | `xIntegration/PasswordResetTests.cs` |
| P1 – unknown email → same response, nothing sent | `Forgot_for_unknown_email_returns_200_and_sends_nothing` | `PasswordResetTests.cs` |
| P1 – unconfirmed → confirm-first email | `Forgot_for_unconfirmed_account_sends_confirmation_link_instead` | `PasswordResetTests.cs` |
| P1 – invalid email → validation, nothing sent | `Forgot_with_malformed_email_returns_400`; page blocks submit | `PasswordResetTests.cs`; `ForgotPasswordPage.test.tsx` |
| P1 – neutral message / 429 message | page tests | `ForgotPasswordPage.test.tsx` |
| P1 – rate limit | `Sixth_forgot_request_within_15_minutes_is_rate_limited` (real limits via `WithWebHostBuilder`) | `PasswordResetTests.cs` |
| P2 – valid link → new password works, old doesn't | `Reset_with_link_values_changes_the_password` | `PasswordResetTests.cs` |
| P2 – used / expired link | `Reset_link_works_only_once`; `Reset_link_expires_after_1_hour` (test clock as in F3, fallback: configured lifespan) | `PasswordResetTests.cs` |
| P2 – rules / mismatch block submit | page test | `ResetPasswordPage.test.tsx` |
| P2 – success → Sign in with notice (and signed out) | page test | `ResetPasswordPage.test.tsx` |
| P2 – expired view + request new link | page test | `ResetPasswordPage.test.tsx` |
| P2 – locked account: sign in after the lock runs out | `Reset_does_not_lift_lockout_until_it_expires` (asserts LockedOut right after reset; with the test clock +5 min → OK) | `PasswordResetTests.cs` |
| (safety) built-in `/forgotPassword` still sends nothing | F3's test stays green | `EmailConfirmationTests.cs` |

## Implementation phases
### Phase 1 – Request a reset link
1. Server: `EmailLinks`, `ResetPasswordMessage`, `ConfirmBeforeResetMessage`, `PasswordEndpoints` (forgot), 1 h token lifetime, rate-limit partition.
2. Tests: `PasswordResetTests` P1 rows.
3. Frontend: `requestPasswordReset`, `ForgotPasswordPage`, route, "Forgot password?" link; tests; `/fverify`.

### Phase 2 – Set a new password
1. Server: nothing new (built-in reset); tests for reset, single use, expiry, lockout.
2. Frontend: `resetPassword`, `ResetPasswordPage`, route; tests; `/fverify`.

## Questions
<!-- Answer under each question, then run /fplan F2. Asked by: Architect | Developer -->
- **Q1 (Architect):** How should password reset be implemented, given the built-in flow only works for confirmed emails?
  - **Answer:** Add email confirmation first (feature F3, approved); F2 depends on F3.
- **Q2 (Architect):** Which library sends the emails?
  - **Answer:** MailKit, behind `IEmailSender<IdentityUser>` / `IEmailDelivery` (F3).
- **Q3 (Architect):** Rate-limit the forgot-password endpoint?
  - **Answer:** Yes, per IP, with the built-in rate limiter.
- **Q4 (Architect):** What happens when a signed-in user opens a reset link?
  - **Answer:** The reset page works anyway; afterwards they sign in again.
- **Q5 (Architect):** Built-in endpoints lack the confirm-first email and the lockout lift. How to implement?
  - **Answer:** Own forgot endpoint, built-in reset; lockout lift dropped from the plan (plan Q2).

## Risks / notes
- **Timing:** the forgot endpoint does more work for existing accounts (token + email), which could hint whether an account exists. Accepted: registration already reveals it by product decision (F1).
- **Unconfirmed users** first get a confirmation email, then must request the reset again (two emails) — chosen by the PO.
- **Built-in `/forgotPassword`** remains reachable but sends nothing (F3 safety test).
- Other sessions of a user end only at the next security-stamp check (ASP.NET default interval: 30 min) after a reset; acceptable for this app.

## Changes during implementation
- _filled in by /fimplement_

## Review log
- _filled in by /freview_
