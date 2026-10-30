---
name: fcommit
description: Verify and commit your own manual changes. Runs all checks (format, build, server and frontend tests, lint, frontend build) and, when they pass, commits as a few logical Conventional Commits. `check` only verifies. Inside /fwork and /ffix the developer agents follow the same rules themselves. Never pushes.
argument-hint: "[check [server|frontend] | auto] [note about the changes]"
effort: low
---

# Verify and commit

Arguments: $ARGUMENTS
- `check [server|frontend]` → only step 1 (verify) and the report; no commit, no fixes.
- `auto` → verify and commit without asking (the developer agents follow this mode inside `/fwork` and `/ffix`).
- otherwise → verify, then show the commit proposal and ask.

## 1. Verify
Run from the repository root. Don't fix anything here; only report – the caller decides what to do with failures.

| # | Check | Command | Scope |
|---|---|---|---|
| 1 | Server format | `dotnet format whitespace Solution1.slnx --verify-no-changes` | server |
| 2 | Server build | `dotnet build Solution1.slnx --nologo -v q` | server |
| 3 | Server tests | `dotnet test --no-build` | server (skip if 2 failed) |
| 4 | Frontend format | `npm --prefix src/frontend run format:check` | frontend |
| 5 | Frontend lint | `npm --prefix src/frontend run lint` | frontend |
| 6 | Frontend tests | `npm --prefix src/frontend test` | frontend |
| 7 | Frontend build | `npm --prefix src/frontend run build` | frontend |

- Scope: `check server` / `check frontend` runs one group. When committing, run the groups the changes touch: server for `*.cs`/`*.csproj`/AppHost, frontend for `src/frontend/**`; docs-only and `.claude/`-only changes skip verification (say so).
- `dotnet test` runs both test projects; the integration tests need Postgres (Docker for Testcontainers, or `TEST_POSTGRES_CONNECTION`).
- `src/frontend/node_modules` missing → `npm --prefix src/frontend ci` first (needs permission; say why).
- A tool (`dotnet`, `npm`) not available → mark its checks **not run**, never as passed.
- The server and frontend groups run independently.

Report:
```
| Check           | Result |
|-----------------|--------|
| Server format   | ✅ / ❌ (fix: dotnet format whitespace Solution1.slnx) |
| Server build    | ✅ / ❌ / ⏭ skipped / ⚠ not run |
| Server tests    | ✅ 154 passed / ❌ 2 of 154 failed |
| Frontend format | ✅ / ❌ (fix: npm --prefix src/frontend run format) |
| Frontend lint   | … |
| Frontend tests  | … |
| Frontend build  | … |
```
For each failure only the relevant lines (file:line, error, failing test name). End with **All checks passed** or **N check(s) failed**.

In `check` mode, stop here. When committing: any failure → **don't commit**; show the report and stop (commit anyway only on the stakeholder's explicit word, and say so in the summary).

## 2. Inspect
`git status --porcelain`, `git diff`, `git diff --staged`, `git branch --show-current`. No changes → say so, stop. On `main` (protected, nothing lands there without a PR): create a branch first (`git switch -c <type>/<kebab-summary>`, e.g. `chore/ci-pipeline`) and commit there. The feature comes from the branch (`feature/<ID>-…`, `fix/<issue>-…`); find its issue with `fgit.sh find <ID>`.

## 3. Never commit
`bin/`, `obj/`, `node_modules/`, `dist/`, `.vs/`, `*.user`, `.env*`, secrets, connection strings, API keys, `.azure/`, the stray `src/frontend/src/frontend/` copy, large build output. Leave them out and say so; suggest `.gitignore` entries when useful.

## 4. Group by purpose
One reviewable change per commit, in an order where earlier commits still build: build/deps (`package.json` + lock together) → server (+ its tests) → frontend → infra/workflows → docs. Group by *what is implemented*, never split a file, prefer 1–5 commits.

## 5. Messages (Conventional Commits)
```
<type>(<scope>): <imperative summary, ≤ 72 chars>

<why, 1–3 lines>
- <notable what, if not obvious>

Refs: <ID> (#<issue>)
```
types: feat, fix, test, refactor, docs, build, ci, chore, perf, style · scopes: server, frontend, apphost, infra, ci, tests, docs, deps, claude.

## 6. Confirm and commit
Unless `auto`: show the proposal (header + files per commit) and ask Commit / Adjust / Cancel. Then per group `git add -- <files>` and `git commit -F <message-file>`. No `--no-verify`, `--amend` or force. **Never push.** Finish with the verification table, `git log --oneline -n <count>` and the remaining `git status`. Once the branch's PR is merged: `.claude/scripts/fgit.sh sync` (back to `main`, pulled, merged branch deleted).
