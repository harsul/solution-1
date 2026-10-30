---
name: ffix
description: Fix a bug with the team. A developer agent reproduces it with a failing test in its own worktree, fixes the root cause, QA and the reviewer check it, the developer rebases on the base branch, pushes and opens a PR that merges automatically when the pipeline passes. Asks only when the "bug" is really a product or design question.
argument-hint: "#<issue> | \"bug description\""
disable-model-invocation: true
effort: high
---

# Fix a bug (Delivery lead)

Input: $ARGUMENTS

## 1. The bug
- `#<n>` → read it (`gh issue view <n>`, `fgit.sh comments <n>`). A description → create it in the bug template's shape (`fgit.sh new bug "Bug: <summary>" <file>`) and ask the stakeholder for anything missing (steps, expected vs actual).
- Is it a bug? If the behaviour matches what an approved task asked for, it's a change: suggest a task in an epic (`/fepic`). Product or design ambiguity → ask the stakeholder.
- Related task or epic → read it for the intended behaviour. `fgit.sh claim <n> dev-fix`.

## 2. Reproduce and fix
Start a **developer** agent (the **cloudops** agent if the fix is in the AppHost, `infra/`, workflows or Dockerfiles; a developer needing a change there stops and reports) (`isolation: "worktree"`): branch `fix/<n>-<kebab-summary>` from `origin/<BASE_BRANCH>`; first a **failing test** at the lowest level that shows the bug (run it, see it fail; can't reproduce → report what was tried, comment on the issue, release it, stop); then fix the root cause, tests for close variants, the same pattern elsewhere fixed or listed; checks green; commit (`fix(<scope>): …`, `Refs: #<n>`).

## 3. Check
**QA** in the developer's worktree (variants, regressions), then the **reviewer** on `git diff origin/<BASE_BRANCH>...HEAD` (plus designer/CloudOps if UI or infrastructure changed). Verify the findings; the developer fixes them with new commits.

## 4. Ship
- `fgit.sh set <n> fix <file>`: cause, fix, tests, related places checked, review notes. A non-obvious trap → `CLAUDE.md` → Gotchas.
- The developer rebases on `origin/<BASE_BRANCH>`, runs the checks, pushes, opens the PR with `Fixes #<n>`, and sets auto-merge when `AUTO_MERGE=on`. Track it as in `/fwork` step 2.5.

Report: the cause in one sentence, the fix, tests, review notes, the PR.
