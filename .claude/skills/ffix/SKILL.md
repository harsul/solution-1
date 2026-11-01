---
name: ffix
description: Fix a bug with the team. Writes it as a bug file under docs/work/bugs/, a developer agent reproduces it with a failing test in its own worktree and fixes the root cause, hooks run the gate and commit, QA checks it, and on a pass a hook pushes and opens the PR with auto-merge. Asks only when the "bug" is really a product or design question.
argument-hint: "F<n> | \"bug description\""
disable-model-invocation: true
effort: high
---

# Fix a bug (Delivery lead)

Input: $ARGUMENTS

## 1. The bug
- A description → `work.sh next-id`, then `docs/work/bugs/<ID>-<kebab-summary>.md` with the task front matter (`type: bug`, `epic: -`, `status: todo`, `priority`, `size: S`, `blocked_by: -`, `qa: -`) and sections **Goal** (expected vs actual), **Steps to reproduce**, **Acceptance criteria** (the fixed behaviour), **Technical notes** (suspected cause, if known). Ask the stakeholder for anything missing.
- Is it a bug? If the behaviour matches what an approved task asked for, it's a change: suggest an epic (`/fepic`). Product or design ambiguity → ask the stakeholder.
- Write the bug file in the main checkout and leave it uncommitted: the developer's `work.sh start` copies it into the fix branch, so it lands with the fix's PR (`work.sh sync` removes the local copy after the merge).

## 2. Reproduce and fix
`work.sh claim <ID> dev-fix`, then a **developer** agent (the **cloudops** agent if the fix is in the infra paths) with `isolation: "worktree"`: "Bug <ID>. Start with `.claude/scripts/work.sh start <ID>`. First a **failing test** at the lowest level that shows the bug (run it, see it fail; can't reproduce → `blocked` with what was tried), then fix the root cause, tests for close variants, the same pattern elsewhere fixed or listed." Its hook runs the gate and commits (`fix(<ID>): …`).

## 3. Check and ship
**QA** in the developer's worktree (variants, regressions, review). Pass → its hook ships (PR with auto-merge); fail → resume the developer. Track as in `/fwork` step 4; once merged, `work.sh sync`. A non-obvious trap → `CLAUDE.md` → Gotchas (next retro).

Report: the cause in one sentence, the fix, tests, QA notes, the PR.
