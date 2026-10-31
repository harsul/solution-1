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
| `docs/product.md` | Product profile: name, customers, tenancy, modules, brand, hosting, compliance (`/finit`); read by every agent |
| `docs/design/` | Design system (designer) |
| `docs/architecture/` | Architecture decision records (architect) |
| `docs/ops/` | Environments, runbooks, secrets inventory (CloudOps) |
| `docs/plans`, `docs/specs` | Archive of F1–F5 (newer features live on GitHub Issues) |
| `.claude/agents/`, `.claude/skills/`, `.claude/scripts/`, `.claude/workflow.conf` | The team: role agents, `/f*` commands, GitHub Issues helper (`fgit.sh`), rename helper, workflow settings |

## Commands

- Prerequisites: .NET 10 SDK, Node 26 (`src/frontend/.nvmrc`, minimum 24.15), Docker for Redis. First time: `npm --prefix src/frontend install`
- Run everything: `aspire run` (or `dotnet run --project src/AspireApp1.AppHost`)
- Build: `dotnet build Solution1.slnx`
- Test: `dotnet test` (the runner is set to Microsoft.Testing.Platform in `global.json`)
- Frontend checks: `npm --prefix src/frontend run lint`, `npm --prefix src/frontend test`, `npm --prefix src/frontend run build`
- **All checks at once: `/fcommit check`** (format, build, tests, lint, frontend build; used by the agents)

## Team workflow

We build a **SaaS starter platform** that any kind of business can start from. Work is organised as **epics** and **tasks** on GitHub Issues and delivered by a team of role agents (`.claude/agents/`): main → task branch → PR → main.

### Team

| Role | Agent | Owns |
|---|---|---|
| Product owner | `product-owner` | Epics (what and why), each one working day of the agent team; `docs/product.md` |
| Team lead | `team-lead` | Breaking an epic into small prioritized tasks with dependencies; keeping the sprint flowing |
| Software architect | `architect` | Technical notes on every task, collisions between tasks, conventions, ADRs (`docs/architecture/`) |
| Designer | `designer` | UI notes on tasks with screens, the design system (`docs/design/`), UI review before a PR |
| CloudOps | `cloudops` | Ops notes, the epic's `ops` task, pipeline and required checks, Azure dev environment; **the only role that changes the AppHost, `infra/`, `azure.yaml`, `.github/workflows/`, Dockerfiles, `docs/ops/`**; ops review |
| Developers (×`DEVELOPERS`) | `developer` | One task at a time in their own worktree: branch, build with tests, verify, commit, fix findings, rebase, push, PR with auto-merge |
| QA | `qa` | Acceptance criteria → tests, edge cases, main flows; commits tests only; reports defects |
| Reviewer | `reviewer` | Independent code + security review of every task before its PR (read-only) |
| Delivery lead | you, via the commands | Runs the agents, asks the stakeholder (agents can't), tracks PRs |

### Commands

| Command | Does |
|---|---|
| `/finit [update [name \| brand \| tickets \| workflow \| quality \| section]]` | Setup: product questions → `docs/product.md`; code name (rename), display name, brand colors, task IDs, workflow settings. Re-run with `update` to change any of it |
| `/fepic "idea" \| review \| #<epic>` | Product owner defines small epics (label `epic`); you approve them |
| `/fplan #<epic>` | Team lead + architect (+ designer, CloudOps) break the epic into tasks (sub-issues); you approve the task list |
| `/fwork #<epic>` | The sprint: developers in parallel take ready tasks by priority → QA → review → rebase → PR → auto-merge → next task; then epic QA, product-owner acceptance, retro and day report (stops new work at `CUTOFF`) |
| `/ffix #<bug>` | Bug: failing test → fix → QA → review → PR |
| `/fcommit [check]` | Your own manual changes: all checks, then logical Conventional Commits; `check` only verifies |

Approvals (`GATES`, default `epic+tasks`): you approve the **epic** and its **task list**; after that `/fwork` runs on its own and only stops for real decisions (product behaviour, irreversible steps, security trade-offs, cost).

### Epics and tasks on GitHub Issues

All reads and writes go through `.claude/scripts/fgit.sh` (needs `gh`, signed in; `fgit.sh init-labels` once per repo).

- **Epic:** issue `Epic: <name>`, label `epic`, status `epic:draft → epic:approved → epic:planned`, closed when done. Size: one working day of the agent team – at most `EPIC_MAX_TASKS` tasks.
- **Task:** issue `<ID> – <title>`, label `task` + priority `P1`/`P2`/`P3`, a **sub-issue** of its epic. Body: goal, acceptance criteria, technical/UI/ops notes, `**Blocked by:** #<n>, …` (or `–`). At most `TASK_MAX_LINES` changed lines (tests and lock files not counted). IDs: prefix + sequential number, never reused (`fgit.sh next-id`; `ID_PREFIX`/`ID_START`, here `F` → `F6`).
- **Ready** = open, not `in-progress`, all blockers closed (`fgit.sh ready <epic>`, best first). A developer takes one with `fgit.sh claim`; a merged PR (`Closes #<task>`) closes it.
- **Sections** (one comment each, updated in place): `qa`, `review`, `fix`.
- **Epic close:** QA's epic pass on the merged result, then the product owner accepts it ("What users get" comment) or adds the missing tasks. Skipped review findings become `follow-up` issues (P3, outside the epic); ideas from the feature template get `idea`; both feed `/fepic review`.
- **Bug:** label `bug` (bug template); `/ffix` on `fix/<issue>-<name>`, PR with `Fixes #<issue>`.
- **Branches:** `feature/<ID>-<name>` from the latest `BASE_BRANCH`; before the PR: rebase on `origin/<BASE_BRANCH>`, resolve conflicts, all checks again. Force pushes only `--force-with-lease` on your own task branch.
- **PRs:** one per task, `Closes #<task>`, merged by GitHub with `MERGE_METHOD` once the pipeline's required checks pass (`AUTO_MERGE=on`; needs branch protection with required checks).
- Commits end with `Refs: <ID> (#<task>)`.
- Questions flow upstream: developer → team lead / architect → product owner → stakeholder.
- F1–F5 were built before this setup; their plans and specs stay in `docs/plans` and `docs/specs` as an archive.

## Principles

- Keep it simple: no new layers, libraries or abstractions unless the feature needs them or they are listed under Conventions.
- Tasks are small vertical slices: API + UI + tests. Every commit leaves the solution building and the tests passing.
- Nothing is committed to the base branch (`BASE_BRANCH`, default `main`) directly – code, docs and `.claude/` all go through a PR; branch protection enforces it, for admins too (required checks `Server (format, build, tests)` and `Frontend (format, lint, tests, build)`, no approvals needed). Never push without being asked.

## Definition of Done

Every task (and every bug fix) is done only when:

- [ ] Its acceptance criteria are met and each has a test; key safeguards are mutation-checked (break it once, a test fails).
- [ ] `/fcommit check` passes: format, build, all server and frontend tests, lint, frontend build.
- [ ] UI: loading, empty and error states; accessible names; focus stays in the form after actions; meets the **Quality bar** in `docs/product.md` (default: works at 390 px, light and dark mode, WCAG 2.1 AA, current Chrome/Edge/Safari/Firefox); copy matches the task's UI notes.
- [ ] Security: authorization (and tenant scope) on every new endpoint; no secrets, tokens or personal data in code, logs or errors; built-in endpoints can't bypass the feature's rules.
- [ ] Operations: new configuration, secrets, migrations or resources are in the task's ops notes and the AppHost; the pipeline still covers the change.
- [ ] No debug code, unused code or unrelated changes.
- [ ] Rebased on the latest base branch with all checks green; the task is current: criteria ticked, QA and review recorded; the PR says `Closes #<task>`.

## Gotchas

Non-obvious traps the team ran into. `/fwork` adds new ones after each epic (retro); keep each to one line.

- Vitest fake timers break Testing Library's `findBy*`: fake only what you need (`toFake: ['setInterval', 'clearInterval', 'Date']`) and only after the `findBy` calls.
- ASP.NET Identity token providers (`DataProtectorTokenProvider`) have no `TimeProvider`: test expiry by shrinking `TokenLifespan` in a `WithWebHostBuilder` host, plus a test for the configured lifespan.
- Built-in `/confirmEmail?changedEmail=` saves the email and the user name separately: an address outside `AllowedUserNameCharacters` changes the email but not the sign-in name; reject such addresses in the frontend.
- `UserManager.FindByEmailAsync` matches normalized (upper-cased) addresses, so `IEmailSender` implementations send to `user.Email` (stored), never to the `email` parameter.
- Navigating right after a state change that `RequireAuth` reacts to (e.g. sign-out) races its own redirect: let `RequireAuth` redirect (signed-out `reason`) instead.
- Integration tests need Postgres: Testcontainers with Docker, or `TEST_POSTGRES_CONNECTION`.
- Line endings are LF everywhere (`.gitattributes`, `.editorconfig`); bash scripts fail on CRLF.

## Conventions

Decided conventions. The architect adds to this list when the stakeholder answers an architecture question (during `/finit`, `/fplan` or `/fwork`), so it is not asked again.

- Work tracking: GitHub Issues through `.claude/scripts/fgit.sh`: epics (label `epic`) and their tasks (sub-issues, label `task`, priorities `P1`–`P3`, `Blocked by` lines); one branch and one PR per task.
- Workflow settings live in `.claude/workflow.conf` (read with `.claude/scripts/fgit.sh config`): task IDs (`ID_PREFIX`, `ID_START`), approvals (`GATES`), team size (`DEVELOPERS`), epic and task size (`EPIC_MAX_TASKS`, `TASK_MAX_LINES`), `BASE_BRANCH`, `MERGE_METHOD`, `AUTO_MERGE` (switch to `on` only once the pipeline has required checks and branch protection), the model per role (`COST`), and the daily cutoff (`CUTOFF`). `/finit` sets them; edit them any time.
- Infrastructure ownership: only CloudOps changes the **infra paths** – `src/<Code>.AppHost`, `infra/`, `azure.yaml`, `.github/workflows/`, Dockerfiles, `docs/ops/` – through one `ops` task per epic (label `ops`, P1) when the epic needs it; tasks that depend on it are `Blocked by` it, the others start at once. Developers keep migrations, `Program.cs` wiring and `appsettings` bindings and stop when they need an infra change; the reviewer flags violations.
- Hosting: Azure Container Apps (dev environment only for now; production comes later, as its own epic), deployed from the Aspire AppHost (`aspire publish`/azd); CI/CD with GitHub Actions using OIDC federated credentials; secrets in Key Vault / Container Apps secrets, never in the repo.
- Server endpoints: minimal APIs under `/api`, one `Endpoints/<Feature>Endpoints.cs` per feature with a `Map<Feature>Endpoints()` extension; `Program.cs` only wires things up.
- Database: PostgreSQL via Aspire (`appdb`, pgAdmin in dev) with EF Core; DbContext, migrations and DB helpers in `Data/`. Migrations apply automatically at startup in Development only. Create them with `dotnet ef migrations add <Name> -o Data/Migrations` (local tool).
- Auth: ASP.NET Core Identity with cookie sessions (same origin, `HttpOnly`, `SameSite=Strict`); API returns 401/403, never redirects. Protect endpoints with `.RequireAuthorization()`. Account flows use only Identity's built-in endpoints (`/api/auth/*` incl. `manage/info`, `forgotPassword`, `resetPassword`, `confirmEmail`); the only custom one is `POST /api/auth/logout`. Identity's default password, lockout and token options.
- Email: `IEmailSender<IdentityUser>` (`Email/IdentityEmailSender`) sends the confirm (incl. change-email, `changedEmail`) and reset emails (plain text + HTML in code) with links rebuilt from `App:PublicUrl`, never from request headers. Confirm and reset go to the stored address, change-email links to the new one. `IEmailDelivery` sends them (MailKit → Mailpit in development); tests swap it for a capturing test double.
- Sessions: Identity's default security stamp check (30 min); after a password or email change the frontend signs the browser out.
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
- Branding: the name users see and the colors live in `src/frontend/src/brand.ts` (theme, app bar gradient and dark-mode shades are derived from it) and `Branding.ProductName` on the server (emails); never hard-code the product name or brand colors elsewhere.
- Code style: `.editorconfig` for everything (LF, UTF-8, 4 spaces; 2 for web files), `dotnet format` for C#, Prettier for the frontend (`src/frontend/.prettierrc.json`: single quotes, width 120). `/fcommit check` checks both; fix with `npm --prefix src/frontend run format` and `dotnet format whitespace Solution1.slnx`.
- Frontend tests: `<Component>.test.tsx` next to the component, rendered with `renderWithTheme` (`src/test/render.tsx`). Use Testing Library queries by role or label, `userEvent` for interaction, and stub `fetch` with `vi.stubGlobal`. Shared setup (incl. `matchMedia` stub) is in `src/test/setup.ts`.
- No mocking libraries: write small test doubles by hand in a `TestDoubles/` folder (C#) or inline (TS).
- Each acceptance criterion maps to at least one test: API behaviour → `xIntegration`, logic → `xUnit`, UI behaviour → Vitest.

### Open decisions (ask when a feature first needs them)

- Applying migrations outside Development (deployment strategy)
- Real email provider for production (F2 uses Mailpit in development)
- Rate limiting of email-sending endpoints (removed for the minimal starter)
