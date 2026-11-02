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
| `docs/work/` | Epics and tasks (markdown, see Team workflow) |
| `docs/plans`, `docs/specs` | Archive of F1–F5 (F6–F19 were GitHub issues) |
| `.claude/agents/`, `.claude/skills/`, `.claude/hooks/`, `.claude/scripts/`, `.claude/workflow.conf` | The team: role agents, `/f*` commands, hooks, work tracking (`work.sh`), rename helper, workflow settings |

## Commands

- Prerequisites: .NET 10 SDK, Node 26 (`src/frontend/.nvmrc`, minimum 24.15), Docker for Redis. First time: `npm --prefix src/frontend install`
- Run everything: `aspire run` (or `dotnet run --project src/AspireApp1.AppHost`)
- Build: `dotnet build Solution1.slnx`
- Test: `dotnet test` (the runner is set to Microsoft.Testing.Platform in `global.json`)
- Frontend checks: `npm --prefix src/frontend run lint`, `npm --prefix src/frontend test`, `npm --prefix src/frontend run build`
- **All checks at once: `/fcommit check`** (format, build, tests, lint, frontend build; used by the agents)

## Team workflow

We build a **SaaS starter platform** that any kind of business can start from. Work is organised as **epics** and **tasks** in markdown files under `docs/work/` and delivered by a team of role agents (`.claude/agents/`): main → task branch → PR → main. **Scripts and hooks do the mechanical steps** (branch, gate, commit, push, PR) so the agents spend tokens only on thinking.

### Team

| Role | Agent | Owns |
|---|---|---|
| Product owner | `product-owner` | Epics (what and why, `epic.md`), each one working day of the agent team; acceptance; `docs/product.md` |
| Team lead | `team-lead` | Breaking an epic into small prioritized task files with dependencies; blocked, too big or failing tasks |
| Software architect | `architect` | Technical notes on every task, collisions between tasks, conventions, ADRs (`docs/architecture/`); its hook publishes the plan |
| Designer | `designer` | UI notes on tasks with screens, the design system (`docs/design/`), UI review |
| CloudOps | `cloudops` | Ops notes, the epic's `ops` task, pipeline and required checks, Azure dev environment; **the only role that changes the AppHost, `infra/`, `azure.yaml`, `.github/workflows/`, Dockerfiles, `docs/ops/`** |
| Developers (×`DEVELOPERS`) | `developer` | One task at a time in their own worktree: build it with tests; hooks gate and commit |
| QA | `qa` | Integration tests, security scan, code + security review, criteria → tests; commits tests only; pass → its hook ships the PR |
| Delivery lead | you, via the commands | Runs the agents, asks the stakeholder (agents can't), picks among ready tasks, tracks PRs |

### Commands

| Command | Does |
|---|---|
| `/finit [update [name \| brand \| tickets \| workflow \| quality \| section]]` | Setup: product questions → `docs/product.md`; code name (rename), display name, brand colors, task IDs, workflow settings. Re-run with `update` to change any of it |
| `/fepic "idea" \| review \| E<n>` | Product owner writes small epics (`docs/work/E<n>-…/epic.md`); you approve them |
| `/fplan E<n>` | Team lead + architect (+ designer, CloudOps) write the task files; the architect's hook validates and publishes them as a PR |
| `/fwork E<n>` | The sprint: developers in parallel take ready tasks (you pick when several are ready) → gate + commit (hook) → QA (integration tests, scan, review) → push + PR + auto-merge (hook) → next task; then epic QA, acceptance, retro (stops new work at `CUTOFF`) |
| `/ffix "bug" \| F<n>` | Bug: bug file → failing test → fix → gate → QA → PR |
| `/fcommit [check]` | Your own manual changes: all checks, then logical Conventional Commits; `check` only verifies |

Approvals (`GATES`, default `epic`): you approve the **epic**; the plan is published when the architect finishes, and you choose which ready task starts when there are several. `/fwork` only stops for real decisions (product behaviour, irreversible steps, security trade-offs, cost).

### Work files (`docs/work/`, `.claude/scripts/work.sh`)

- **Epic:** `docs/work/E<n>-<name>/epic.md`, front matter `id`, `title`, `status` (`draft → approved → planned → done`), `priority`, `depends_on`. Size: one working day of the agent team – at most `EPIC_MAX_TASKS` tasks.
- **Task:** `docs/work/E<n>-<name>/<ID>-<name>.md`, front matter `id`, `title`, `epic`, `type` (`task`/`ops`/`bug`), `status` (`todo → in-progress → review → done`, or `blocked` + `blocked_reason`), `priority` (`P1`–`P3`), `size` (`S`/`M`), `blocked_by`, `qa`; sections Goal, Acceptance criteria, Technical/UI/Ops notes, QA. At most `TASK_MAX_LINES` changed lines (tests, lock files, migrations not counted). IDs never reused (`work.sh next-id`; here `F`, from `F20`).
- **Bug:** `docs/work/bugs/<ID>-<name>.md`, `type: bug`; the file travels with its fix's PR.
- **Status travels with the work:** the plan PR puts the tasks on `main` as `todo`; the task branch changes them, and `done` reaches `main` with the task's merged PR. **Claims** are local locks in `.git/work/locks/` (shared by all worktrees, never committed).
- **Ready** = `todo` on `main`, not claimed, all blockers `done` (`work.sh ready E<n>`, best first). `work.sh board` shows everything.
- **Branches:** `feature|fix|ops/<ID>-<name>` from the latest `BASE_BRANCH` (`work.sh start <ID>`). Force pushes only `--force-with-lease` on your own task branch.
- **PRs:** one per task, title `<ID> – <title>`, merged by GitHub with `MERGE_METHOD` (squash) once the required checks pass (`AUTO_MERGE=on`). Commits end with `Refs: <ID>`.
- Questions flow upstream: developer → team lead / architect → product owner → stakeholder.
- F1–F19 were tracked as GitHub issues (F1–F5 plans and specs in `docs/plans`, `docs/specs`); open ones stay there.

### Hooks (`.claude/hooks/`, wired in `.claude/settings.json`)

| Hook | When | Does |
|---|---|---|
| `guard.sh` | before Bash / file edits | No push to `BASE_BRANCH`, no force push without lease, no manual `gh pr merge`; each role edits only its own files (developers: no infra paths; QA: tests only; agents only inside their own worktree) |
| `format.sh` | after an edit | Prettier on the changed frontend file |
| `subagent-stop.sh` | an agent finishes | **developer/cloudops:** `work.sh gate` (format, build, xUnit, Vitest, lint, frontend build, size, no infra paths outside ops tasks) – red goes back to the agent (3 rounds, then `blocked`), green → `review` + commit. **qa:** verdict `pass` → commit, `done`, `work.sh ship` (rebase, push, PR, auto-merge; conflicts → stays `done`, the developer rebases and its hook ships again); `fail` → commit, back to the developer. **architect:** `work.sh check-plan` → `publish-plan` |
| `session-start.sh` | session start | A short work board in the context |
| `notify.sh` | Claude waits for you | Desktop notification |

An agent that sets its task `blocked` with a reason may always finish: it is handing back a question. Logs: `.git/work/logs/`; ship and publish results next to the locks.

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
- [ ] Rebased on the latest base branch with all checks green; the task is current: criteria ticked, QA and review recorded; the PR links its task file (`work.sh ship` adds it).

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

- Work tracking: markdown files under `docs/work/` through `.claude/scripts/work.sh` (epics, task files with front matter, local claim locks); mechanical steps in hooks (`.claude/hooks/`); one branch and one PR per task.
- Workflow settings live in `.claude/workflow.conf` (read with `.claude/scripts/work.sh config`): task IDs (`ID_PREFIX`, `ID_START`), approvals (`GATES`), team size (`DEVELOPERS`), epic and task size (`EPIC_MAX_TASKS`, `TASK_MAX_LINES`), `BASE_BRANCH`, `MERGE_METHOD`, `AUTO_MERGE` (switch to `on` only once the pipeline has required checks and branch protection), the model per role (`COST`), and the daily cutoff (`CUTOFF`). `/finit` sets them; edit them any time.
- Infrastructure ownership: only CloudOps changes the **infra paths** – `src/<Code>.AppHost`, `infra/`, `azure.yaml`, `.github/workflows/`, Dockerfiles, `docs/ops/` – through one `ops` task per epic (`type: ops`, P1) when the epic needs it; tasks that depend on it are `Blocked by` it, the others start at once. Developers keep migrations, `Program.cs` wiring and `appsettings` bindings and stop when they need an infra change; the guard hook refuses their edits there and QA flags violations.
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
