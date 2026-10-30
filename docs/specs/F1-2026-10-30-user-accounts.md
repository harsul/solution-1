---
id: F1
title: User accounts (register, sign in, sign out)
plan: docs/plans/F1-2026-10-30-user-accounts.md
status: Approved
phase: 0/3
created: 2026-10-30
approved: 2026-10-30
branch:
---

# Spec F1 – User accounts (register, sign in, sign out)

## Overview
Accounts are stored with **ASP.NET Core Identity** in **PostgreSQL** (an Aspire-managed container, with pgAdmin in development), accessed through EF Core 10 / Npgsql. The server exposes .NET's built-in Identity API endpoints (`MapIdentityApi`) under `/api/auth`, plus a small logout endpoint. Sessions use a secure **HttpOnly cookie**: the React app and the API share an origin (Vite proxy in dev, `wwwroot` in publish), so no tokens live in JavaScript. The frontend gets **React Router 8** for `/signin`, `/register` and `/`, an `AuthProvider` for the signed-in state, and MUI forms with small hand-written validators.

## Architecture decisions
- ASP.NET Core Identity + `MapIdentityApi` instead of hand-written auth endpoints: register, login with cookie mode, lockout and password reset (F2) come built in.
- Cookie sessions, not bearer tokens: same origin, nothing to store or refresh in JS. `SameSite=Strict`, `HttpOnly`, `Secure`, no CORS, JSON-only endpoints → no CSRF surface.
- Remember me maps to the built-in login switches: ticked → `?useCookies=true` (persistent cookie, 14 days sliding); unticked → `?useSessionCookies=true` (cookie ends with the browser session).
- API requests without a valid session get **401/403 instead of a redirect** to `/Account/Login` (cookie events overridden).
- Identity has no "requires a letter" rule → a small custom `IPasswordValidator` (`RequireLetterPasswordValidator`).
- Lockout message: "Try again in 5 minutes" from the fixed lockout length (the built-in login only reports `LockedOut`). Agreed with the PO, see plan Q1.
- Migrations are applied automatically at startup **in Development only**; production strategy is decided later.
- API tests run against a real Postgres via **Testcontainers**: `dotnet test` now needs Docker.
- Server code moves out of `Program.cs`: `Endpoints/` (one `Map<Feature>Endpoints()` extension per feature) and `Data/` (DbContext, migrations).
- Frontend: feature folders (`src/features/auth`, `src/features/weather`), React Router 8, plain MUI fields + pure validator functions.

## API
All under `/api`. Identity endpoints come from `MapIdentityApi<IdentityUser>()` on the `/api/auth` group.

| Method | Route | Request | Response | Errors |
|---|---|---|---|---|
| POST | `/api/auth/register` | `{ email, password }` | `200` (empty) | `400` ValidationProblem; error keys = Identity codes: `DuplicateUserName`, `InvalidEmail`, `PasswordTooShort`, `PasswordRequiresDigit`, `PasswordRequiresLetter` |
| POST | `/api/auth/login?useCookies=true` (remember me) or `?useSessionCookies=true` | `{ email, password }` | `200` + `Set-Cookie` | `401` Problem, `detail` = `Failed` or `LockedOut` |
| POST | `/api/auth/logout` | – | `204`, cookie cleared | `401` if not signed in |
| GET | `/api/auth/manage/info` | – | `200 { email, isEmailConfirmed }` | `401` if not signed in |
| GET | `/api/weatherforecast` | – | `200 WeatherForecast[]` | `401` if not signed in (from phase 3) |

Other `MapIdentityApi` routes (`/refresh`, `/confirmEmail`, `/forgotPassword`, `/resetPassword`, `/manage/2fa`) exist but aren't used by the UI in F1; F2 uses forgot/reset.

## Data models
**C# (server)**
```csharp
// Data/AppDbContext.cs – Identity tables only for now (AspNetUsers, AspNetRoles, ...).
public class AppDbContext(DbContextOptions<AppDbContext> options) : IdentityDbContext<IdentityUser>(options);
```
Request/response DTOs come from `Microsoft.AspNetCore.Identity.Data` (`RegisterRequest`, `LoginRequest`, `InfoResponse`).

**TypeScript (frontend)**
```ts
// src/features/auth/api.ts
export interface Credentials { email: string; password: string }
export interface UserInfo { email: string; isEmailConfirmed: boolean }
export type SignInResult = 'ok' | 'invalid' | 'lockedOut';
export type RegisterResult = { ok: true } | { ok: false; duplicate: boolean; errors: string[] };

// src/features/auth/AuthContext.tsx
export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut'; reason?: 'expired' }
  | { status: 'signedIn'; email: string };
```

## Server
| File | New/Changed | Responsibility |
|---|---|---|
| `src/AspireApp1.AppHost/AppHost.cs` | Changed | `AddPostgres("postgres").WithDataVolume().WithPgAdmin()`, `.AddDatabase("appdb")`; server `.WithReference(appDb).WaitFor(appDb)` |
| `src/AspireApp1.AppHost/*.csproj` | Changed | + `Aspire.Hosting.PostgreSQL` 13.6.4 |
| `src/AspireApp1.Server/*.csproj` | Changed | + `Aspire.Npgsql.EntityFrameworkCore.PostgreSQL` 13.6.4, `Microsoft.AspNetCore.Identity.EntityFrameworkCore` 10.0.14, `Microsoft.EntityFrameworkCore.Design` 10.0.14 (PrivateAssets=all) |
| `.config/dotnet-tools.json` | New | local tool `dotnet-ef` 10.0.14 (`dotnet tool restore`) |
| `src/AspireApp1.Server/Data/AppDbContext.cs` | New | Identity DbContext |
| `src/AspireApp1.Server/Data/Migrations/*` | New | `InitialIdentity` migration (`dotnet ef migrations add InitialIdentity -o Data/Migrations`) |
| `src/AspireApp1.Server/Data/DatabaseExtensions.cs` | New | `MigrateDatabaseAsync(this WebApplication)` – runs `Database.MigrateAsync()`; called only in Development |
| `src/AspireApp1.Server/Auth/IdentitySetup.cs` | New | `AddAppIdentity(this IHostApplicationBuilder)`: `AddIdentityApiEndpoints<IdentityUser>` + EF stores + options + cookie config (below) |
| `src/AspireApp1.Server/Auth/RequireLetterPasswordValidator.cs` | New | `IPasswordValidator<IdentityUser>`, error code `PasswordRequiresLetter` |
| `src/AspireApp1.Server/Endpoints/AuthEndpoints.cs` | New | `MapAuthEndpoints()`: `/api/auth` group → `MapIdentityApi<IdentityUser>()` + `POST /logout` (RequireAuthorization, `SignOutAsync(IdentityConstants.ApplicationScheme)`, 204) |
| `src/AspireApp1.Server/Endpoints/WeatherEndpoints.cs` | New | `MapWeatherEndpoints()`: the existing forecast endpoint moved from `Program.cs`; `.RequireAuthorization()` in phase 3 |
| `src/AspireApp1.Server/Program.cs` | Changed | `AddNpgsqlDbContext<AppDbContext>("appdb")`, `AddAppIdentity()`, `AddAuthorization()`; `UseAuthentication/UseAuthorization`; migrate in Development; `MapAuthEndpoints()`, `MapWeatherEndpoints()` |

Identity options (`IdentitySetup`):
- Password: `RequiredLength = 8`, `RequireDigit = true`, `RequireLowercase/Uppercase/NonAlphanumeric = false`, `RequiredUniqueChars = 1`, plus `RequireLetterPasswordValidator`.
- Lockout: `MaxFailedAccessAttempts = 5`, `DefaultLockoutTimeSpan = 5 min`, `AllowedForNewUsers = true` (the built-in login uses `lockoutOnFailure: true`).
- User: `RequireUniqueEmail = true`. SignIn: `RequireConfirmedAccount = false`.
- Application cookie: `HttpOnly`, `SameSite=Strict`, `SecurePolicy=Always`, `ExpireTimeSpan = 14 days`, `SlidingExpiration = true`; `OnRedirectToLogin` → 401, `OnRedirectToAccessDenied` → 403.

Validation and errors: Identity returns `ValidationProblem` (400) and `Problem` (401); everything unexpected goes through `GlobalExceptionHandler`.
Persistence and caching: Postgres volume keeps data across restarts; delete the volume to reset local data. Output caching stays on the weather endpoint, but the default policy doesn't cache authenticated requests, so from phase 3 it effectively doesn't cache (accepted, see Risks).

## Frontend
| File | New/Changed | Responsibility |
|---|---|---|
| `package.json` | Changed | + `react-router` ^8.5.1 |
| `src/main.tsx` | Changed | wrap in `BrowserRouter` and `AuthProvider` |
| `src/App.tsx` | Changed | layout (AppBar with `ColorModeToggle` + `UserMenu`, `<Outlet/>`, footer) and `<Routes>`: `/signin`, `/register`, `/` (protected) |
| `src/features/weather/WeatherPage.tsx` | New (moved) | the current weather view from `App.tsx`; uses `apiFetch` |
| `src/features/auth/api.ts` | New | `register`, `signIn(credentials, remember)`, `signOut`, `getUserInfo`; maps HTTP results to `SignInResult` / `RegisterResult` |
| `src/features/auth/AuthContext.tsx` | New | `AuthProvider` + `useAuth()`: loads `/manage/info` on start, exposes state and `signIn/register/signOut`, `markExpired()` |
| `src/features/auth/RequireAuth.tsx` | New | route guard: loading → spinner; signed out → `<Navigate to="/signin" state={{ from }}>` |
| `src/features/auth/SignInPage.tsx` | New | email, password, Remember me, submit with progress; error and lockout messages; link to register; `?expired` message |
| `src/features/auth/RegisterPage.tsx` | New | email, password, confirm; live rule checklist; duplicate-email message with Sign in link |
| `src/features/auth/PasswordRules.tsx` | New | ✓/✗ list of rules under the password field |
| `src/features/auth/passwordRules.ts` | New | pure functions: `checkPassword(pw) → { minLength, hasLetter, hasDigit }`, `isValidEmail` |
| `src/features/auth/UserMenu.tsx` | New | app-bar email + menu with Sign out (icon only on xs) |
| `src/api/apiFetch.ts` | New | `fetch` wrapper: `credentials: 'same-origin'`; on 401 while signed in → `markExpired()` (phase 3) |
| `src/test/render.tsx` | Changed | + `renderWithProviders(ui, { route, auth })` = theme + `MemoryRouter` + `AuthProvider` |

State and UX: forms disable the submit button while a request runs (MUI `loading` on `Button`); errors as `Alert`; field errors as `helperText`. All pages work in light/dark and at 390 px width.

Messages (exact text from the plan):
- Wrong credentials: "Email or password is incorrect."
- Locked: "This account is temporarily locked. Try again in 5 minutes."
- Duplicate: "An account with this email already exists." + link "Sign in"
- Expired: "Your session has expired, please sign in again."

## Tests
| Acceptance criterion | Test | Project/file |
|---|---|---|
| P1 – not signed in → Sign in page | `App` shows Sign in at `/` when signed out | `src/App.test.tsx` |
| P1 – register → signed in, sees forecast | `register then signs in and navigates home` | `src/features/auth/RegisterPage.test.tsx` |
| P1 – register API | `Register_with_valid_data_returns_200` | `xIntegration/AuthEndpointsTests.cs` |
| P1 – sign in with right credentials | `Login_with_cookies_then_info_returns_email` | `xIntegration/AuthEndpointsTests.cs` |
| P1 – wrong credentials message | `Login_with_wrong_password_returns_401_Failed`; `shows incorrect message` | `AuthEndpointsTests.cs`; `SignInPage.test.tsx` |
| P1 – email in app bar, sign out | `Logout_ends_the_session` (info → 401); `UserMenu shows email and signs out` | `AuthEndpointsTests.cs`; `UserMenu.test.tsx` |
| P1 – no double submit | `submit button is disabled while signing in` | `SignInPage.test.tsx` |
| P2 – rule / mismatch feedback | `checkPassword` cases; `shows failing rules and blocks submit` | `passwordRules.test.ts`; `RegisterPage.test.tsx` |
| P2 – letter rule on the server | `Validator_rejects_password_without_letter` | `xUnit/RequireLetterPasswordValidatorTests.cs` |
| P2 – duplicate email | `Register_duplicate_email_returns_DuplicateUserName`; `shows duplicate message with sign-in link` | `AuthEndpointsTests.cs`; `RegisterPage.test.tsx` |
| P2 – lockout after 5 failures | `Sixth_attempt_is_LockedOut_even_with_correct_password`; `shows lockout message` | `AuthEndpointsTests.cs`; `SignInPage.test.tsx` |
| P2 – remember me / session cookie | `UseCookies_sets_persistent_cookie_for_14_days`, `UseSessionCookies_sets_cookie_without_expiry`; `sends useCookies when Remember me is ticked` | `AuthEndpointsTests.cs`; `SignInPage.test.tsx` |
| P3 – deep link → sign in → back | `redirects to sign in and returns to the requested page` | `src/features/auth/RequireAuth.test.tsx` |
| P3 – data refused when signed out | `Weather_without_session_returns_401_not_redirect`; existing weather tests sign in first | `xIntegration/WeatherForecastEndpointTests.cs` |
| P3 – expired session message | `401 while signed in shows expired message on sign in` | `src/App.test.tsx` |
| P3 – signed in → away from sign-in/register | `signed-in user visiting /signin is sent home` | `src/App.test.tsx` |

Test infrastructure: `ServerFactory` implements `IAsyncLifetime`, starts a `PostgreSqlContainer` (Testcontainers.PostgreSql 4.16.0) and sets `ConnectionStrings:appdb`; migrations run at startup (Development). Tests use a unique email per test (`$"{Guid.NewGuid()}@test.local"`) and a helper `SignedInClientAsync()` in a new `TestDoubles/AuthHelpers.cs`. Frontend tests stub `fetch` per route.

## Implementation phases
### Phase 1 – Create an account, sign in and sign out
1. AppHost: Postgres + pgAdmin + `appdb`; reference from server.
2. Server packages, `.config/dotnet-tools.json`, `Data/AppDbContext.cs`, `InitialIdentity` migration, `DatabaseExtensions`.
3. `Auth/IdentitySetup.cs` (all options incl. password, lockout and cookie, so phase 2 is mostly UI), `RequireLetterPasswordValidator`.
4. `Endpoints/AuthEndpoints.cs` (+ logout) and `Endpoints/WeatherEndpoints.cs`; slim `Program.cs`.
5. Tests: `ServerFactory` on Testcontainers; `AuthEndpointsTests` for register, login, info and logout; existing tests still green.
6. Frontend: `react-router`; `features/auth/api.ts`, `AuthContext`, `RequireAuth` (basic redirect), `SignInPage`, `RegisterPage` (basic fields), `UserMenu`; move weather to `features/weather/WeatherPage.tsx`; routes in `App.tsx`; `renderWithProviders`.
7. Frontend tests for P1; `/fverify`.

### Phase 2 – Safe and convenient accounts
1. `passwordRules.ts` + `PasswordRules.tsx` live checklist; confirm-password match; disable submit until valid.
2. Duplicate-email message with Sign in link.
3. Lockout message; Remember me checkbox → `useCookies` vs `useSessionCookies`.
4. Tests: validator unit tests, lockout and cookie-lifetime API tests, frontend tests for P2; `/fverify`.

### Phase 3 – Private app
1. `WeatherEndpoints`: `.RequireAuthorization()`; update existing weather API tests to sign in; 401 test.
2. `apiFetch` with expired-session handling; `WeatherPage` uses it.
3. `RequireAuth` returns to `state.from` after sign-in; signed-in users visiting `/signin` or `/register` go to `/`.
4. Tests for P3; `/fverify`; README: Docker needed for `dotnet test`.

## Questions
<!-- Answer under each question, then run /fplan F1. Asked by: Architect | Developer -->
- **Q1 (Architect):** How do API tests get a database? 
  - **Answer:** Testcontainers Postgres (Docker needed for `dotnet test`).
- **Q2 (Architect):** How are migrations applied?
  - **Answer:** Automatically at startup in Development.
- **Q3 (Architect):** Frontend navigation?
  - **Answer:** React Router 8.
- **Q4 (Architect):** Frontend code organisation?
  - **Answer:** Feature folders (`src/features/<feature>/`), shared UI in `src/components/`.
- **Q5 (Architect):** Where do server endpoints and database code live?
  - **Answer:** `Endpoints/<Feature>Endpoints.cs` extension methods and `Data/`.
- **Q6 (Architect):** Form validation approach?
  - **Answer:** Plain MUI fields + small pure validator functions; no form library.
- **Q7 (Architect):** How exact is the lockout message?
  - **Answer:** "Try again in 5 minutes" from the fixed lockout length.
- **Q8 (Architect):** pgAdmin in development?
  - **Answer:** Yes.

## Risks / notes
- **Phase 1 is the biggest** (database foundation + auth + routing). It stays one phase because each part alone isn't user-visible; commit it in logical groups with `/fcommit`.
- **Docker for tests:** `dotnet test` needs Docker from phase 1 on. `/fverify` reports a clear "not run" if Docker is missing.
- **Secure cookie over the Vite dev proxy:** the browser talks HTTP to `localhost`, which browsers treat as secure, so `Secure` cookies work; verify in phase 1 with `aspire run`.
- **Output cache:** authenticated requests aren't cached by the default policy. That's fine for the sample forecast; revisit if real data needs caching.
- **Extra built-in Identity routes** (`/refresh`, bearer tokens, 2FA, confirm email) are reachable but unused. Acceptable for now; could be filtered later.
- **Migrations in production** aren't automatic; decide before the first deployment.

## Changes during implementation
- _filled in by /fimplement_

## Review log
- _filled in by /freview_
