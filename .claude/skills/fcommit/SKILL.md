---
name: fcommit
description: Commit the current changes as a few logical Conventional Commits grouped by what they implement (server, frontend, tests, docs, deps). Shows the grouping for confirmation first and never pushes.
argument-hint: "[optional note about the changes]"
disable-model-invocation: true
effort: low
---

# Commit changes in logical groups

Extra context from the user: $ARGUMENTS

## 1. Inspect

- Run `git status --porcelain`, `git diff`, `git diff --staged` and `git branch --show-current`.
- If there are no changes, say so and stop.
- If you're on `main`, warn the user and point to the spec's `branch:` (or `/fimplement`). Commit on `main` only if they confirm. That is fine for docs-only changes such as plans and specs.
- Read `docs/specs/F<n>-*.md` and `docs/plans/F<n>-*.md` (ID from the branch `feature/F<n>-...`) to see which phase this work belongs to.

## 2. Check for things that must not be committed

These include `bin/`, `obj/`, `node_modules/`, `.vs/`, `*.user`, `.env*`, secrets, connection strings, API keys and large build output. Leave them out and tell the user. If one should really be in `.gitignore`, suggest adding it.

## 3. Verify before committing

- If the changes include code or project files (`*.cs`, `*.csproj`, `src/frontend/**` except docs), invoke **`fverify`**. Use scope `server` or `frontend` if only one side changed.
- If any check fails, **don't commit**. Show the report and stop. Commit anyway only if the user explicitly says so; mention it in the final summary.
- For docs-only or `.claude/`-only changes, skip verification and say so.

## 4. Group by purpose

Each commit is one coherent change that someone could review on its own. Typical groups, in this order, so that earlier commits still build where possible:

1. **build / deps**: `*.csproj`, `package.json` + `package-lock.json` (always together), `global.json`, config.
2. **server**: DTOs/models + endpoint + registration for one capability.
3. **server tests**: tests for that capability. Fold small test changes into the server commit.
4. **frontend**: types/API client + components + styles for one capability.
5. **docs**: plan, spec, `CLAUDE.md`, README.

Rules:

- Group by *what is implemented*, not by file type. If a phase adds two separate capabilities, make one commit each.
- Don't split a single file across commits.
- Prefer 1–5 commits. Don't create a commit for a trivial one-line change if it belongs with another group.

## 5. Write messages (Conventional Commits)

```
<type>(<scope>): <imperative summary, ≤ 72 chars, no trailing period>

<why this change, 1–3 lines, wrapped at 72>
- <notable what, only if not obvious>

Refs: F<n>
```

- **type**: `feat`, `fix`, `test`, `refactor`, `docs`, `build`, `chore`, `style`, `perf`
- **scope**: `server`, `frontend`, `apphost`, `tests`, `docs`, `deps`
- Drop the body for self-explanatory commits. Drop `Refs` when there is no feature ID.

## 6. Confirm

Show the proposal as a list: for each commit, the message header and the files in it. Ask with AskUserQuestion:

- Commit as proposed (recommended)
- Adjust (the user describes the change; revise and show it again)
- Cancel

## 7. Commit

For each group, in order: `git add -- <files>` then `git commit -m "<header>" -m "<body>"`.

- Don't use `--no-verify`, `--amend` or force operations.
- If a hook fails, show the error, fix it if trivial, otherwise stop and ask.
- **Never push.**

Finish by showing `git log --oneline -n <count>` and the remaining `git status` (should be clean or only excluded files). If the plan has phases left, suggest `/fimplement`. If the plan is done, suggest pushing and opening a PR.
