---
name: fcommit
description: Commit the current changes as a few logical Conventional Commits grouped by what they implement (server, frontend, tests, infra, docs, deps). Shows the grouping for confirmation first (unless called with auto) and never pushes.
argument-hint: "[auto] [optional note about the changes]"
disable-model-invocation: true
effort: low
---

# Commit changes in logical groups

Arguments: $ARGUMENTS (`auto` = commit without asking, used by `/fdeliver`)

## 1. Inspect
`git status --porcelain`, `git diff`, `git diff --staged`, `git branch --show-current`. No changes → say so, stop. On `main`: warn and point to the feature branch; commit there only for docs-only changes (roadmap, ADRs, `CLAUDE.md`, `.claude/`) or if the user confirms. Feature from the branch `feature/F<n>-...` → issue via `fdoc.sh find F<n>`.

## 2. Never commit
`bin/`, `obj/`, `node_modules/`, `.vs/`, `*.user`, `.env*`, secrets, connection strings, API keys, publish output (`infra/` generated secrets, `.azure/`), large build output. Leave them out and say so; suggest `.gitignore` entries when useful.

## 3. Verify
Code or project files changed → `fverify` (`server`/`frontend` scope if only one side). Any failure → don't commit; show the report and stop (commit anyway only on the user's explicit word, and say so). Docs/`.claude/`-only → skip and say so.

## 4. Group by purpose
One reviewable change per commit, in an order where earlier commits still build: build/deps (`package.json` + lock together) → server (+ its tests) → frontend → infra/workflows → docs. Group by *what is implemented*, never split a file, prefer 1–5 commits.

## 5. Messages (Conventional Commits)
```
<type>(<scope>): <imperative summary, ≤ 72 chars>

<why, 1–3 lines>
- <notable what, if not obvious>

Refs: F<n> (#<issue>)
```
types: feat, fix, test, refactor, docs, build, ci, chore, perf · scopes: server, frontend, apphost, infra, ci, tests, docs, deps, claude.

## 6. Confirm and commit
Unless `auto`: show the proposal (header + files per commit) and ask Commit / Adjust / Cancel. Then per group `git add -- <files>` and `git commit -F <message-file>`. No `--no-verify`, `--amend` or force. **Never push.** Finish with `git log --oneline -n <count>` and the remaining `git status`.
