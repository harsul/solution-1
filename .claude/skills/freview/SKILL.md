---
name: freview
description: Code-reviewer pass over the current feature changes. Runs an independent review against the spec, conventions and best practices, verifies the findings, and fixes only what the user approves.
argument-hint: "[branch]  (default: uncommitted changes; 'branch' = whole branch vs main)"
disable-model-invocation: true
effort: high
---

# Review (Code Reviewer)

You are the **code reviewer**. You judge the code; you don't write features. You change code only for findings the user approves. You don't commit.

Scope argument: $ARGUMENTS

## 1. Collect what to review

- Feature: the ID from the current branch (`feature/F<n>-...`). Read `docs/specs/F<n>-*.md`, `docs/plans/F<n>-*.md` and `CLAUDE.md`.
- Default scope is the uncommitted changes: `git diff HEAD` plus the untracked files from `git status --porcelain`.
- If the argument is `branch`, the scope is everything on the branch: `git diff main...HEAD` plus the uncommitted changes.
- If the scope is empty, say so and stop.

## 2. Independent review

To keep the review unbiased, use the **Agent tool** to start a fresh reviewer subagent. Give it:

- the list of changed files and the diff command to run;
- the paths to the spec, the plan and `CLAUDE.md`;
- this checklist.

Don't give it the implementer's reasoning or your own opinion of the code. Ask it to return findings only (no edits), each with: severity, file:line, the problem, why it matters, and a suggested fix.

Checklist:

- **Spec fit**: do the acceptance criteria for this phase actually hold? Is anything missing, or built beyond the spec?
- **Correctness**: logic errors, null handling, async/await misuse, off-by-one, race conditions, HTTP status codes.
- **Security**: input validation, injection, leaking internals in errors, secrets in code, CORS/auth assumptions.
- **Frontend**: loading, empty and error states; effect dependencies; keys in lists; accessibility basics; types match the API.
- **Tests**: are the acceptance criteria covered? Do the tests assert behaviour, and can they actually fail?
- **Simplicity and conventions**: unnecessary abstractions, duplication, dead code, naming, and consistency with `CLAUDE.md` and the existing code.
- **Performance** (only obvious issues): N+1 calls, unnecessary re-renders, missing caching where the spec asked for it.

## 3. Built-in reviews

Run these alongside the spec-focused reviewer. **Never pass `--fix` or `--comment`**: fixes happen only after the user approves them (step 6).

- **`code-review`** (Skill tool) on the same scope: no argument for uncommitted changes, or the current branch name when reviewing the whole branch. It hunts for correctness bugs independently of the spec.
- **`security-review`**: when the scope is `branch`, or this is the last phase of the feature. It reviews the branch against `origin`'s default branch for injection, auth and data-exposure issues.

If a built-in can't be invoked from a skill in this environment, note that in the report and tell the user to run it themselves (`/code-review`, `/security-review`).

## 4. Verify the findings

Combine the findings from all reviewers. For each one, open the code and confirm it is real. Drop false positives and pure style nitpicks that the linters already cover. Merge duplicates, and note which reviewer found each finding (spec / code-review / security).

## 5. Report

Number the findings and group them by severity:

- 🔴 **Must fix**: bugs, security issues, acceptance criteria not met.
- 🟡 **Should fix**: maintainability, missing tests, convention breaks.
- 🔵 **Consider**: optional improvements.

Each finding gets one line on the problem, the file:line, and the proposed fix. If there are no findings, say so clearly and suggest `/fcommit`.

## 6. Ask permission

Ask with AskUserQuestion which findings to fix:

- Fix all 🔴 and 🟡 (recommended)
- Fix only 🔴
- Let me pick (the user replies with numbers)
- Fix nothing

## 7. Fix and re-verify

- Apply only the approved fixes, each as the smallest change that resolves it.
- Invoke **`fverify`** and make sure everything still passes after the fixes. Include its table in the summary.
- Append a short entry to the spec's **Review log**: date, phase, findings fixed and findings skipped (with reason).
- If this was the **last phase** and no 🔴 findings remain, set both the spec's and the plan's status to **Done**.

Finish with a summary of what changed and: "Next: run `/fcommit`."
