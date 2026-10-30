---
id: F3
title: Email confirmation
plan: docs/plans/F3-2026-10-30-email-confirmation.md
status: Approved
phase: 0/2
created: 2026-10-30
approved: 2026-10-30
branch:
---

# Spec F3 – Email confirmation

## Overview
Use ASP.NET Core Identity's **built-in** confirmation endpoints (`/register` already sends the email, `/confirmEmail`, `/resendConfirmationEmail`) and add what's missing around them: a real email pipeline (MailKit → Mailpit in development), links that point to the **frontend** (built from a configured public URL), a 24-hour lifetime for confirmation tokens, a path-scoped rate limit for resending, and the React confirm page plus reminder banner.

## Architecture decisions
- **Built-in endpoints only** (stakeholder decision, Q1). The email sender rebuilds the built-in API link into a frontend link: it takes only `userId` and `code` from the generated URL and combines them with `App:PublicUrl`, so request `Host`/`Origin` headers never end up in an email.
- **Email pipeline:** `IEmailSender<IdentityUser>` (`IdentityEmailSender`: builds messages) → `IEmailDelivery` (`MailKitEmailDelivery`: SMTP). Tests replace `IEmailDelivery` with a hand-written capturing double; production can swap the delivery later.
- **Email content:** plain text + simple HTML built in code, one small class per email (Q2). Links are HTML-encoded in the HTML part.
- **Confirmation emails never fail a request:** if delivery fails, `IdentityEmailSender` logs the error and returns, so registration still succeeds; the user can resend from the banner.
- **24-hour tokens:** a dedicated `EmailConfirmationTokenProvider` (a `DataProtectorTokenProvider<IdentityUser>` with its own options, `TokenLifespan = 24 h`) registered as `Tokens.EmailConfirmationTokenProvider`. The default provider keeps its own lifetime for F2's reset tokens (1 h, set in F2). Confirming doesn't change the security stamp, so a link opened again still succeeds ("Email confirmed"), and earlier links stay valid after a resend (plan decisions).
- **Rate limiting:** ASP.NET Core's built-in limiter as a **global limiter partitioned by path**: only `POST /api/auth/resendConfirmationEmail` is limited (1 request per 60 s per client IP; F2 adds `/forgotPassword`), all other paths get `NoLimiter`. Rejections return `429` ProblemDetails with `Retry-After`. Limits come from configuration (`RateLimits:*`) so tests can raise them.
- **Public URL:** `App:PublicUrl`. In run mode the AppHost sets it to the Vite frontend's endpoint; for publish it must be configured (the server then serves the frontend itself). Missing value at startup → fail fast with a clear message.
- **Password reset emails** (`SendPasswordResetCodeAsync` / `SendPasswordResetLinkAsync`) are F2's job: until then they log and do nothing, so the built-in `/forgotPassword` can't send unplanned emails.

## API
All built in (from `MapIdentityApi`), behaviour as used by F3:

| Method | Route | Request | Response | Errors |
|---|---|---|---|---|
| POST | `/api/auth/register` | `{ email, password }` | `200`, now also sends the confirmation email | unchanged (F1) |
| GET | `/api/auth/confirmEmail?userId=…&code=…` | – | `200` (text) – confirmed, also when already confirmed | `401` invalid/expired/tampered |
| POST | `/api/auth/resendConfirmationEmail` | `{ email }` | `200` always (sends only if the account exists) | `429` rate limited |
| GET | `/api/auth/manage/info` | – | `200 { email, isEmailConfirmed }` | `401` |

Frontend link in the email: `{App:PublicUrl}/confirm-email?userId={userId}&code={code}` (values URL-encoded).

## Data models
No database changes (`AspNetUsers.EmailConfirmed` exists; existing accounts are `false`, which is exactly "unconfirmed").

**C# (server)**
```csharp
public sealed record EmailMessage(string To, string Subject, string TextBody, string HtmlBody);
public interface IEmailDelivery { Task SendAsync(EmailMessage message, CancellationToken cancellationToken); }
public sealed class EmailOptions { public required string PublicUrl { get; set; } public string FromAddress { get; set; } = "no-reply@aspireapp1.local"; public string FromName { get; set; } = "Aspire Starter"; }
```
**TypeScript (frontend)**
```ts
// AuthState gains the confirmation flag (from /manage/info)
| { status: 'signedIn'; email: string; emailConfirmed: boolean }
export type ResendResult = 'sent' | 'tooSoon';
```

## Server
| File | New/Changed | Responsibility |
|---|---|---|
| `src/AspireApp1.AppHost/*.csproj` | Changed | + `CommunityToolkit.Aspire.Hosting.MailPit` 13.6.1 |
| `src/AspireApp1.AppHost/AppHost.cs` | Changed | `AddMailPit("mailpit")`; server `.WithReference(mailpit).WaitFor(mailpit)`; run mode: `.WithEnvironment("App__PublicUrl", webfrontend.GetEndpoint("http"))` |
| `src/AspireApp1.Server/*.csproj` | Changed | + `MailKit` 4.18.2 |
| `Email/EmailOptions.cs`, `Email/EmailMessage.cs`, `Email/IEmailDelivery.cs` | New | types above; `EmailOptions` bound from `App` + `Email` sections, validated on start |
| `Email/MailKitEmailDelivery.cs` | New | parses `ConnectionStrings:mailpit` (`endpoint=smtp://host:port`, via `DbConnectionStringBuilder`), sends with MailKit (text + HTML alternative) |
| `Email/IdentityEmailSender.cs` | New | `IEmailSender<IdentityUser>`: confirmation → rebuild frontend link, `ConfirmEmailMessage`, deliver; log-and-continue on failure. Reset methods: log only (F2) |
| `Email/Messages/ConfirmEmailMessage.cs` | New | subject "Confirm your email address", text + HTML with the link and "valid for 24 hours" |
| `Email/EmailSetup.cs` | New | `AddAppEmail()` registrations |
| `Auth/EmailConfirmationTokenProvider.cs` | New | provider + options class (24 h) |
| `Auth/IdentitySetup.cs` | Changed | register the provider in `Tokens.ProviderMap`, set `Tokens.EmailConfirmationTokenProvider` |
| `RateLimiting/RateLimitSetup.cs` | New (phase 2) | `AddAppRateLimiting()`: global limiter by path + IP, options `RateLimits:ResendConfirmation` (`PermitLimit = 1`, `Window = 00:01:00`), 429 ProblemDetails + `Retry-After` |
| `Program.cs` | Changed | `AddAppEmail()`, `AddAppRateLimiting()`, `UseRateLimiter()` (after authentication) |

Validation and errors: built-in endpoints return their own codes (above); 429 via the limiter's `OnRejected`.
Persistence and caching: none new.

## Frontend
| File | New/Changed | Responsibility |
|---|---|---|
| `src/features/auth/api.ts` | Changed | `confirmEmail(userId, code): Promise<boolean>`, `resendConfirmation(email): Promise<ResendResult>`; `getUserInfo` keeps `isEmailConfirmed` |
| `src/features/auth/AuthContext.ts`, `AuthProvider.tsx` | Changed | `emailConfirmed` in signed-in state; `refreshUser()` exposed for the confirm page |
| `src/features/auth/ConfirmEmailPage.tsx` | New | route `/confirm-email` (not guarded): calls confirm once, shows loading → "Email confirmed" (button **Go to the app** / **Sign in**) or "This link is no longer valid" (**Resend email** when signed in / **Sign in**); refreshes the user when signed in |
| `src/features/auth/ConfirmEmailBanner.tsx` | New (phase 2) | MUI `Alert` under the app bar for signed-in unconfirmed users: text, **Resend email**, close; after sending "Email sent", button disabled with countdown (60 s); 429 → "Please wait a minute before trying again." |
| `src/features/auth/bannerDismissal.ts` | New (phase 2) | `sessionStorage` flag per email, cleared by `signIn`/`signOut` (so the banner returns on the next sign-in) |
| `src/App.tsx` | Changed | `/confirm-email` route; banner below the app bar |

State and UX: confirm page shows a spinner while confirming; all states work in light/dark and at 390 px.

## Tests
| Acceptance criterion | Test | Project/file |
|---|---|---|
| P1 – sign-up sends a confirmation email with a frontend link | `Register_sends_one_confirmation_email_with_a_frontend_link` | `xIntegration/EmailConfirmationTests.cs` |
| P1 – link rebuilt from userId/code only, HTML-encoded | `Confirmation_link_uses_public_url_not_request_host`; `ConfirmEmailMessage` cases | `xIntegration/…`; `xUnit/ConfirmEmailMessageTests.cs` |
| P1 – valid link confirms; opening again still confirmed | `ConfirmEmail_with_link_values_confirms_and_info_reports_it`, `ConfirmEmail_again_still_succeeds` | `xIntegration/EmailConfirmationTests.cs` |
| P1 – tampered / expired link | `ConfirmEmail_with_tampered_code_returns_401`; `Confirmation_link_expires_after_24_hours` (test clock via Identity's `TimeProvider`; fallback: assert the provider's configured lifespan) | `xIntegration/EmailConfirmationTests.cs` |
| P1 – registration survives a delivery failure | `Register_succeeds_when_email_delivery_fails` | `xIntegration/EmailConfirmationTests.cs` |
| P1 – confirm page states | success signed in / signed out, invalid link signed in / signed out | `src/features/auth/ConfirmEmailPage.test.tsx` |
| P2 – banner for unconfirmed, none for confirmed | banner shown/hidden by `isEmailConfirmed` | `src/features/auth/ConfirmEmailBanner.test.tsx` |
| P2 – resend sends a new email; 2nd within a minute → 429 | `Resend_sends_a_new_confirmation_email`, `Second_resend_within_a_minute_is_rate_limited` | `xIntegration/EmailConfirmationTests.cs` |
| P2 – resend UI: sent message, countdown, 429 message | banner tests | `ConfirmEmailBanner.test.tsx` |
| P2 – close hides until next sign-in | dismissal survives navigation, cleared on sign-in/out | `ConfirmEmailBanner.test.tsx`, `bannerDismissal.test.ts` |
| P2 – old accounts see the banner | covered by "unconfirmed → banner" (old accounts have `EmailConfirmed = false`) | `ConfirmEmailBanner.test.tsx` |
| (safety) reset emails stay off until F2 | `ForgotPassword_for_confirmed_account_sends_no_email_yet` | `xIntegration/EmailConfirmationTests.cs` |

Test infrastructure: `ServerFactory` replaces `IEmailDelivery` with `TestDoubles/CapturingEmailDelivery` (exposes `Sent` messages; can be switched to throw), sets `App:PublicUrl=https://app.test` and a high `RateLimits` permit limit; the rate-limit test uses `factory.WithWebHostBuilder` with the real 1/min limit. Frontend: `fakeAuthBackend` gains `isEmailConfirmed`, confirm and resend handlers.

## Implementation phases
### Phase 1 – Confirmation email and confirm page
1. AppHost: Mailpit resource, references, `App__PublicUrl` in run mode.
2. Server: MailKit, `Email/*` (options, message, delivery, sender, `ConfirmEmailMessage`, setup), `EmailConfirmationTokenProvider` + Identity registration; reset methods log only.
3. Tests: capturing delivery in `ServerFactory`; `EmailConfirmationTests` (P1 rows), `ConfirmEmailMessageTests`.
4. Frontend: `api.ts` confirm, `emailConfirmed` + `refreshUser` in auth state, `ConfirmEmailPage`, route; tests; `/fverify`.

### Phase 2 – Reminder and resend
1. Server: `RateLimitSetup` + `UseRateLimiter`; resend + 429 tests.
2. Frontend: `resendConfirmation`, `ConfirmEmailBanner` with countdown and 429 message, `bannerDismissal`, mount in `App.tsx`; tests; `/fverify`.
3. README: Mailpit inbox (Aspire dashboard → mailpit) for development emails.

## Questions
<!-- Answer under each question, then run /fplan F3. Asked by: Architect | Developer -->
- **Q1 (Architect):** Own confirm/resend endpoints or the built-in ones?
  - **Answer:** Built-in endpoints only (links rebuilt to the frontend in the email sender; path-scoped rate limit).
- **Q2 (Architect):** How is email content built?
  - **Answer:** Plain text + simple HTML in code, no templating package.

## Risks / notes
- **Built-in resend is anonymous by email address:** it never reveals whether an account exists (always 200), but anyone can trigger emails to a registered address; limited by the per-IP rate limit. Acceptable for now.
- **Per-IP limits** treat users behind one NAT as one client and don't stop distributed abuse; fine for this app's size. Behind a reverse proxy, forwarded headers must be configured before the IP is meaningful (deployment task).
- **Built-in link rebuilding** depends on the generated URL containing `userId` and `code` query values (stable in .NET 10); covered by an integration test so an upgrade that changes it fails loudly.
- **Identity `TimeProvider`:** the exact hook for a test clock is verified during implementation; the fallback test asserts the configured 24 h lifespan.
- F2 builds on this: default token provider lifetime 1 h for reset, `/forgotPassword` added to the rate limiter, reset email + "confirm first" email for unconfirmed accounts.

## Changes during implementation
- _filled in by /fimplement_

## Review log
- _filled in by /freview_
