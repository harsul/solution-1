---
name: ffix
description: Bug fix with the team. Takes a bug issue, reproduces it with a failing test, has the developer fix it, runs the independent reviewer, records the fix on the issue, commits and opens a PR. No plan or spec gates; asks only when the "bug" is really a product or design question.
argument-hint: "#<issue> | \"bug description\""
disable-model-invocation: true
effort: high
---

# Fix a bug (Delivery lead)

Input: $ARGUMENTS

## 1. The bug
- `#<n>` → read it (`gh issue view <n>`, `fdoc.sh comments <n>`). A description → create the issue from it in the bug template's shape (`fdoc.sh new bug "Bug: <summary>" <file>`) and ask the stakeholder for anything missing (steps, expected vs actual).
- Is it a bug? If the behaviour matches an approved plan and the request is really a change, say so and suggest `/fdeliver` instead. Product or design ambiguity → ask the stakeholder.
- If it touches a feature's area, read that feature issue (plan, `spec`, `design`) for the intended behaviour.

## 2. Reproduce first
Branch `fix/<issue>-<kebab-name>` from an up-to-date base branch (`fdoc.sh config BASE_BRANCH`). Start the **developer** agent to write a **failing test** that shows the bug (API test, unit test or page test – the lowest level that shows it) and run it to see it fail. Can't reproduce → report what was tried, comment on the issue, stop.

## 3. Fix
The **developer** agent fixes the root cause (not the symptom), keeps the new test, adds tests for close variants, runs all checks and commits (`fix(<scope>): …`, `Refs: #<issue>`; the failing test and the fix may be one commit). Look for the same bug elsewhere (same pattern in other endpoints or pages) and fix those too, or list them.

## 4. Review
Start the **reviewer** agent on `git diff <base>...HEAD` with the issue number (and the **designer**/**cloudops** reviews if UI or infrastructure changed). Verify the findings yourself; the developer fixes all must and should findings, runs all checks and commits the fixes as new commits.

## 5. Record and ship
- `fdoc.sh set <issue> fix <file>`: cause, fix, tests added, related places checked, review findings fixed/skipped.
- Check the **Definition of Done** in `CLAUDE.md`. If the bug revealed a non-obvious trap, add it to `CLAUDE.md` → **Gotchas**.
- Push and open a PR with `Fixes #<issue>` (both need the stakeholder's permission); don't merge unless asked.

Report: cause in one sentence, the fix, tests, review notes, PR link.
