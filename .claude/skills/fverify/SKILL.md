---
name: fverify
description: Run the project's verification checks (dotnet build, dotnet test, frontend lint, tests and build) and report a short pass/fail table. Use whenever code changes need verifying; also called by fimplement, freview and fcommit.
argument-hint: "[all | server | frontend]  (default: all)"
effort: low
---

# Verify the solution

Scope: $ARGUMENTS (empty means `all`)

Run from the repository root. Don't fix anything here; only report. The calling skill (or the user) decides what to do with failures.

## Checks

| # | Check | Command | Scope |
|---|---|---|---|
| 1 | Server build | `dotnet build Solution1.slnx --nologo -v q` | server |
| 2 | Server tests | `dotnet test --no-build` | server (skip if 1 failed) |
| 3 | Frontend lint | `npm --prefix src/frontend run lint` | frontend |
| 4 | Frontend tests | `npm --prefix src/frontend test` | frontend |
| 5 | Frontend build | `npm --prefix src/frontend run build` | frontend |

- `dotnet test` runs both test projects: `AspireApp1.Server.xUnit` (unit) and `AspireApp1.Server.xIntegration` (in-memory API tests via `WebApplicationFactory`; they need Postgres: Docker for Testcontainers, or `TEST_POSTGRES_CONNECTION` pointing at an existing server).
- `npm test` runs Vitest once (`vitest run`) in jsdom.
- If `src/frontend/node_modules` is missing, run `npm --prefix src/frontend ci` first. That needs permission; say why you're asking.
- If a tool (`dotnet`, `npm`) is not available in this environment, mark its checks **not run** and say so. Never report them as passed.
- Run the server and frontend groups independently: a server failure doesn't skip the frontend checks.

## Report

Keep it short:

```
| Check          | Result |
|----------------|--------|
| Server build   | ✅ / ❌ / ⏭ skipped / ⚠ not run |
| Server tests   | ✅ 12 passed / ❌ 2 of 12 failed |
| Frontend lint  | ...    |
| Frontend tests | ✅ 3 passed / ... |
| Frontend build | ...    |
```

For each failure, list the relevant error lines only, with file:line, the error code or message and the failing test name. Don't paste full logs.

End with one line: **All checks passed** or **N check(s) failed**.
