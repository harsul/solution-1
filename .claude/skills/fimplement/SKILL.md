---
name: fimplement
description: Developer skill. Implementation starts here. Picks an Approved spec (given F<n> or suggested), proposes and creates the feature branch, implements one phase with tests, verifies build/test/lint, and stops for review.
argument-hint: "[F<n>]"
disable-model-invocation: true
---

# Implement one phase (Software Developer)

You are the **developer**. Implementation starts here. You implement what the spec says, cleanly and simply, **one phase per run**. You don't redesign or invent product behaviour.

Input: $ARGUMENTS

## 1. Pick the work

- **With an ID** (`F1`): open `docs/specs/F1-*.md`.
- **Without an ID**: list the specs with status **In progress** (first) and **Approved**, sorted by ID, showing the ID, title, phase and `depends-on`. Recommend one: continue what's in progress, otherwise the lowest approved ID whose dependencies are **Done**. Ask with AskUserQuestion.
- The status must be **Approved** or **In progress**. Otherwise:
  - spec missing, **Draft** or **Questions** → stop, point to `/fplan F<n>`;
  - **Done** → say so.
- Read the spec, its plan and `CLAUDE.md`.

## 2. Branch

- Proposed name: `feature/F<n>-<kebab-name>` (the name part of the file name, e.g. `feature/F1-todo-list`). Use `fix/` for bug fixes.
- If the spec's `branch:` is empty:
  - check `git status`; if there are unrelated uncommitted changes, ask first;
  - suggest the name, confirm or adjust it with the user, then `git switch -c <branch>` from an up-to-date `main`;
  - write the name into the spec's `branch:`.
- Otherwise, `git switch <branch>` if you aren't on it already.
- If uncommitted changes from the previous phase exist, ask: review/commit first (`/freview`, `/fcommit`) or continue on top.

## 3. Baseline check

Before changing any code, invoke **`fverify`** (Skill tool).

- If everything passes, continue.
- If something already fails, stop and show the report. Ask the user: fix it first (outside this feature), continue anyway (note it in the report), or stop. Don't silently fix unrelated failures as part of the phase.

## 4. Phase

- The next phase is the first one in the plan with unchecked acceptance criteria.
- On the first phase, set the spec status to **In progress**.
- Tell the user, in one line, which phase you're starting.

## 5. Gaps

- **Small technical details** the spec leaves open: decide yourself, following the existing code.
- **Something that changes the design or product behaviour**, or that the spec contradicts:
  - add it as **Q<n> (Developer)** to the spec's **Questions** section;
  - set the spec status to **Questions**;
  - stop. Say: "Spec question added; answer it and run `/fplan F<n>`." Product questions go on to the plan from there.

## 6. Implement

- Follow the spec's steps and files, and `CLAUDE.md` conventions. Match the existing style.
- Keep it simple: no speculative abstractions, unrelated refactors, or packages the spec doesn't list.
- Write the tests the spec maps to this phase's acceptance criteria.
- Frontend: handle loading, empty and error states.
- Record unavoidable small deviations under **Changes during implementation**.

## 7. Simplify

Invoke the built-in **`simplify`** skill (Skill tool) on the files changed in this phase. It reviews them for reuse of existing helpers, needless complexity, efficiency and abstraction level, and applies cleanups.

- Keep only cleanups that preserve behaviour and fit the spec and `CLAUDE.md` conventions. Revert any that change agreed behaviour or the API contract.
- If the skill can't be invoked here, do a short simplification pass yourself with the same focus.

## 8. Verify

Invoke **`fverify`**. Fix the failures this phase caused and re-run until everything passes. Include the final `fverify` table in your report.

## 9. Update and stop

- In the plan, tick this phase's acceptance criteria that are met.
- In the spec, set `phase: n/N`.
- Report the changed files (grouped by server, frontend and tests), the verification results, and how to try it (`aspire run`, then what to click).

Finish with: "Next: `/freview`." Don't start the next phase.
