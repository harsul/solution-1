# Solution1

Aspire 13.6 app: ASP.NET Core (.NET 10) API + React 19 / Material UI 9 / Vite 8 / TypeScript frontend (Node 26) + Redis output cache.

## Layout

| Path | What |
|---|---|
| `src/AspireApp1.AppHost` | Aspire orchestration (`AppHost.cs`): Redis `cache`, `server`, Vite `webfrontend` |
| `src/AspireApp1.Server` | API. Minimal APIs in `Program.cs`, all routes under the `/api` group. `GlobalExceptionHandler.cs` = unhandled errors → ProblemDetails. `Extensions.cs` = service defaults |
| `src/frontend` | React app. Vite proxies `/api` to the server in dev; in publish it is served from the server's `wwwroot`. `src/theme.ts` = MUI theme (Aspire purple, light/dark), `src/components/` = shared components |
| `tests/AspireApp1.Server.xUnit` | Unit tests (xunit.v3, Microsoft Testing Platform) |
| `tests/AspireApp1.Server.xIntegration` | API tests: server in memory via `WebApplicationFactory<Program>` (`ServerFactory`) |
| `tests/*/TestDoubles/` | Hand-written test doubles (`TestLogger`, `TestLoggerProvider`, `ThrowingEndpointStartupFilter`) |
| `src/frontend/src/**/*.test.tsx` | Frontend tests (Vitest + Testing Library, jsdom) |
| `docs/plans` | Feature plans (product owner, `/fbrainstorm`) |
| `docs/specs` | Technical specs (architect, `/fplan`) |

## Commands

- Prerequisites: .NET 10 SDK, Node 26 (`src/frontend/.nvmrc`, minimum 24.15), Docker for Redis. First time: `npm --prefix src/frontend install`
- Run everything: `aspire run` (or `dotnet run --project src/AspireApp1.AppHost`)
- Build: `dotnet build Solution1.slnx`
- Test: `dotnet test` (the runner is set to Microsoft.Testing.Platform in `global.json`)
- Frontend checks: `npm --prefix src/frontend run lint`, `npm --prefix src/frontend test`, `npm --prefix src/frontend run build`
- **All checks at once: `/fverify`** (used by `/fimplement`, `/freview` and `/fcommit`)

## Feature workflow

| Step | Role | Does | Writes |
|---|---|---|---|
| `/fbrainstorm <idea \| F<n>>` | Product owner | Product Q&A, splits big features, approves the plan | `docs/plans/` |
| `/fplan [F<n>]` | Software architect | Studies the code, asks architecture questions, approves the spec | `docs/specs/`, Conventions below |
| `/fimplement [F<n>]` | Developer | Picks an Approved spec, creates the branch, implements **one phase** | code, tests |
| `/freview [branch]` | Code reviewer | Independent review, fixes only what you approve | Review log in the spec |
| `/fcommit` | – | Verifies, then logical Conventional Commits after confirmation; never pushes | commits |
| `/fverify [server\|frontend]` | – | Build, test and lint with a pass/fail table; called by the skills above | – |
| `/foptions [skill]` | – | Lists all workflow skills, where you are, and the suggested next command | – |

Loop per phase: `fimplement → freview → fcommit`.

### Features, files and branches

- Feature ID: `F<n>`, numbered sequentially and never reused. A feature has at most 3 phases; bigger ones are split into several IDs.
- Plan: `docs/plans/F<n>-<YYYY-MM-DD>-<name>.md`. Spec: the same file name in `docs/specs/`.
- Branch: `feature/F<n>-<name>`, created by the developer when implementation starts. Commits end with `Refs: F<n>`.

### Statuses (frontmatter `status:`)

| Plan (PO) | Spec (Architect → Developer) |
|---|---|
| Draft → Questions → **Approved** → Done | Draft → Questions → **Approved** → In progress → Done |

- Only an **Approved** plan can be specified, and only an **Approved** spec can be implemented.
- Open questions live in the file's **Questions** section with `_pending_` answers. Answer them in the file or in chat, then re-run the owning skill (`/fbrainstorm F<n>` for plans, `/fplan F<n>` for specs).
- Questions flow upstream: Developer → spec → Architect; Architect (product issue) → plan → PO.

## Principles

- Keep it simple: no new layers, libraries or abstractions unless the feature needs them or they are listed under Conventions.
- Features are small vertical slices: API + UI + tests. Every phase leaves the solution building and the tests passing.
- Code is never committed to `main` directly (plans and specs may be). Never push without being asked.

## Conventions

Decided conventions. `/fplan` adds to this list when you answer an architecture question, so it is not asked again.

- Server endpoints: minimal APIs under `/api`, one `Endpoints/<Feature>Endpoints.cs` per feature with a `Map<Feature>Endpoints()` extension; `Program.cs` only wires things up.
- Database: PostgreSQL via Aspire (`appdb`, pgAdmin in dev) with EF Core; DbContext, migrations and DB helpers in `Data/`. Migrations apply automatically at startup in Development only. Create them with `dotnet ef migrations add <Name> -o Data/Migrations` (local tool).
- Auth: ASP.NET Core Identity with cookie sessions (same origin, `HttpOnly`, `SameSite=Strict`); API returns 401/403, never redirects. Protect endpoints with `.RequireAuthorization()`.
- Email: Identity's built-in email endpoints; `IEmailSender<IdentityUser>` (`Email/IdentityEmailSender`) builds messages (plain text + HTML in code) and rebuilds links to the frontend from `App:PublicUrl`, never from request headers; `IEmailDelivery` sends them (MailKit → Mailpit in development). Tests swap `IEmailDelivery` for a capturing test double.
- Sessions: the security stamp is validated on every request (`ValidationInterval = 0`); end sessions with `UpdateSecurityStampAsync` and keep the current one with `RefreshSignInAsync`.
- Account changes: own endpoints under `/api/account` (`.RequireAuthorization()`) when the built-in Identity endpoints lack needed behaviour; verify passwords with `CheckPasswordSignInAsync(..., lockoutOnFailure: true)`; expected failures are `400` ValidationProblems keyed by code (e.g. `PasswordMismatch`, `LockedOut`).
- Rate limiting: ASP.NET Core's built-in rate limiter as a global limiter partitioned by path (only email-sending paths are limited, per client IP), limits from `RateLimits:*` configuration, 429 ProblemDetails with `Retry-After`.
- Errors: don't catch exceptions just to return 500; `GlobalExceptionHandler` turns unhandled exceptions into a ProblemDetails 500 (logged, no details leaked). For expected failures return `TypedResults.Problem` / `TypedResults.ValidationProblem` / `TypedResults.NotFound` with the right status code.
- Frontend data fetching: relative `/api/...` URLs through `src/api/apiFetch.ts` (handles expired sessions).
- Frontend structure: feature folders `src/features/<feature>/` (pages, API calls, hooks, tests); shared UI in `src/components/`. Routing with React Router 8 (`react-router`).
- Forms: plain MUI fields with `useState`; validation in small pure functions (unit-tested), no form libraries.
- UI: Material UI components first. Style with the `sx` prop and theme values (`primary`, `text.secondary`, spacing), never hard-coded colors; no new `.css` files. Theme changes go in `src/theme.ts`; light and dark must both work.
- Icons: `@mui/icons-material`, imported by path (`import RefreshIcon from '@mui/icons-material/Refresh'`). MUI components are imported by path too (`@mui/material/Button`).
- Accessibility: every interactive element has an accessible name (visible text or `aria-label`); tests find elements by role or label.
- Tests: xunit.v3 with `[Fact]`/`[Theory]`, global `using Xunit`; pass `TestContext.Current.CancellationToken` to async calls.
- Unit tests (`xUnit` project): pure logic, no HTTP. Server internals are visible to it via `InternalsVisibleTo`.
- API tests (`xIntegration` project): `IClassFixture<ServerFactory>` and `factory.CreateClient()`. `ServerFactory` swaps Redis output caching for a no-op store and gets its own database on one shared Postgres server per test run (`PostgresFixture`: Testcontainers, so `dotnet test` needs Docker; or set `TEST_POSTGRES_CONNECTION` to use an existing server). Use a unique email per test. Assert status codes and JSON bodies, using test-local DTO records.
- Frontend tests: `<Component>.test.tsx` next to the component, rendered with `renderWithTheme` (`src/test/render.tsx`). Use Testing Library queries by role or label, `userEvent` for interaction, and stub `fetch` with `vi.stubGlobal`. Shared setup (incl. `matchMedia` stub) is in `src/test/setup.ts`.
- No mocking libraries: write small test doubles by hand in a `TestDoubles/` folder (C#) or inline (TS).
- Each acceptance criterion maps to at least one test: API behaviour → `xIntegration`, logic → `xUnit`, UI behaviour → Vitest.

### Open decisions (ask when a feature first needs them)

- Applying migrations outside Development (deployment strategy)
- Real email provider for production (F2 uses Mailpit in development)
