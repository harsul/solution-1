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
| `docs/roadmap.md` | Product vision and epics (product owner, `/froadmap`) |
| `docs/design/` | Design system (designer) |
| `docs/architecture/` | Architecture decision records (architect) |
| `docs/ops/` | Environments, runbooks, secrets inventory (CloudOps) |
| `docs/plans`, `docs/specs` | Archive of F1–F5 (newer features live on GitHub Issues) |
| `.claude/agents/`, `.claude/skills/`, `.claude/scripts/fdoc.sh` | The team: role agents, `/f*` commands, GitHub Issues helper |

## Commands

- Prerequisites: .NET 10 SDK, Node 26 (`src/frontend/.nvmrc`, minimum 24.15), Docker for Redis. First time: `npm --prefix src/frontend install`
- Run everything: `aspire run` (or `dotnet run --project src/AspireApp1.AppHost`)
- Build: `dotnet build Solution1.slnx`
- Test: `dotnet test` (the runner is set to Microsoft.Testing.Platform in `global.json`)
- Frontend checks: `npm --prefix src/frontend run lint`, `npm --prefix src/frontend test`, `npm --prefix src/frontend run build`
- **All checks at once: `/fverify`** (used by `/fimplement`, `/freview` and `/fcommit`)

## Team workflow

We build a **SaaS starter platform** that any kind of business can start from. The work is done by a team of role agents (`.claude/agents/`), tracked on **GitHub Issues**, and run end to end by `/fdeliver`.

### Team

| Role | Agent | Owns | Writes |
|---|---|---|---|
| Product owner | `product-owner` | roadmap, epics, feature plans, acceptance criteria | `docs/roadmap.md`, issue bodies, `plan:*` labels |
| Designer | `designer` | flows, screen states, copy, accessibility, design system, UI review | `design` section, `docs/design/` |
| Software architect | `architect` | specs, conventions, decision records | `spec` section, `spec:*` labels, `CLAUDE.md` Conventions, `docs/architecture/` |
| CloudOps | `cloudops` | Azure Container Apps, AppHost, CI/CD, secrets, migrations, monitoring, cost, ops review | `ops` section, AppHost, `infra/`, `.github/workflows/`, `docs/ops/` |
| Developer | `developer` | one phase at a time, with tests | code, tests, "Changes during implementation" |
| Code reviewer | `reviewer` | independent code + security review (read-only) | findings only |
| Delivery lead | you, via `/fdeliver` | runs the team, batches questions, gates, commits, PR | `review-p<k>` sections, commits |

Subagents can't talk to the stakeholder: they return questions, and the delivery lead asks them in one batch.

### Commands

| Command | Role | Does |
|---|---|---|
| `/froadmap [topic \| review]` | Product owner | Vision, target businesses, epics → `docs/roadmap.md` + epic issues |
| `/fdeliver F<n> \| epic #<n> \| "idea"` | Delivery lead | Whole team run: plan gate → design ∥ spec ∥ ops → spec gate → per phase implement → reviews → fixes → commit → PR |
| `/fbrainstorm <idea \| F<n>>` | Product owner | Interactive plan for one feature |
| `/fdesign F<n> \| system \| review F<n>` | Designer | Design section, design system, or UI review from screenshots |
| `/fops F<n> \| ci \| deploy \| review` | CloudOps | Ops section, or delivery work (CI/CD, deployment, environments) |
| `/fplan [F<n>]` | Architect | Interactive spec, conventions, ADRs |
| `/fimplement [F<n>]` | Developer | One phase on the feature branch |
| `/freview [branch]` | Reviewer (+ Designer, CloudOps) | Independent reviews, verified findings, fixes, review record |
| `/fcommit [auto]` | – | Verifies, then logical Conventional Commits; never pushes |
| `/fverify [server\|frontend]` | – | Build, test, lint table |
| `/foptions [name]` | – | Team, commands, where you are, next command |

Gates: the stakeholder approves the **plan** and the **spec**; after that `/fdeliver` runs on its own and only stops for real decisions (product behaviour, irreversible steps, security trade-offs, cost).

### Work items on GitHub Issues

All reads and writes go through `.claude/scripts/fdoc.sh` (needs `gh`, signed in; run `fdoc.sh init-labels` once).

- **Epic:** issue `Epic: <name>`, label `type:epic`; body = goal, success criteria, checklist of features.
- **Feature:** issue `F<n> – <title>`, label `type:feature`; **body = plan**. `F<n>` is sequential and never reused (`fdoc.sh next-id`). At most 3 phases; bigger → several features.
- **Sections** = one comment each, updated in place: `design`, `ops`, `spec`, `review-p<k>`.
- **Status labels:** `plan:draft → questions → approved → done`, `spec:draft → questions → approved → in-progress → done`, plus `needs-answer` while waiting for the stakeholder.
- **Branch** `feature/F<n>-<name>` (CloudOps work: `ops/<name>`); commits end with `Refs: F<n> (#<issue>)`; one PR per feature with `Closes #<issue>`.
- Questions flow upstream: Developer → spec (Architect) → plan (PO) → stakeholder.
- F1–F5 were built before this setup; their plans and specs stay in `docs/plans` and `docs/specs` as an archive.

## Principles

- Keep it simple: no new layers, libraries or abstractions unless the feature needs them or they are listed under Conventions.
- Features are small vertical slices: API + UI + tests. Every phase leaves the solution building and the tests passing.
- Code is never committed to `main` directly (roadmap, docs and `.claude/` may be). Never push without being asked.

## Conventions

Decided conventions. `/fplan` adds to this list when you answer an architecture question, so it is not asked again.

- Work tracking: GitHub Issues through `.claude/scripts/fdoc.sh` (epics, features `F<n>`, sections, status labels); one PR per feature.
- Hosting: Azure Container Apps, deployed from the Aspire AppHost (`aspire publish`/azd); CI/CD with GitHub Actions using OIDC federated credentials; secrets in Key Vault / Container Apps secrets, never in the repo.
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
