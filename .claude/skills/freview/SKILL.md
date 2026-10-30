---
name: freview
description: Code-review step. Runs the independent reviewer agent (plus designer and CloudOps reviews when UI or infra changed) on the current feature changes, verifies the findings, asks which to fix, applies the approved fixes and records the review on the issue.
argument-hint: "[branch]  (default: uncommitted changes; 'branch' = whole branch vs main)"
disable-model-invocation: true
effort: high
---

# Review (Code reviewer)

Scope argument: $ARGUMENTS

## 1. Scope
Feature from the branch `feature/F<n>-...` → `fdoc.sh find F<n>`. Default scope: `git diff HEAD` plus untracked files; `branch`: `git diff main...HEAD` plus uncommitted changes. Empty scope → say so and stop.

## 2. Independent reviews (in parallel, one message)
Give each agent the scope, the issue number and `CLAUDE.md` – **never** the implementer's reasoning or your opinion:
- **reviewer** (`.claude/agents/reviewer.md`), always; at the end of a feature also a security pass over the whole feature (see **Review depth** in `/fdeliver`: risky phases are reviewed each, others once per feature);
- **designer** UI review if frontend files changed;
- **cloudops** ops review if AppHost, configuration, migrations, `infra/` or workflows changed.
Also run the built-in `code-review` (and `security-review` at the last phase or for `branch`) without `--fix`/`--comment`, when available; otherwise note it and tell the user to run them.

## 3. Verify and report
Check every finding against the code; drop false positives and linter nitpicks; merge duplicates and note who found each. Group: 🔴 must fix · 🟡 should fix · 🔵 consider (one line each: problem, file:line, fix). No findings → say so, suggest `/fcommit`.

## 4. Ask, fix, verify, record
- AskUserQuestion: Fix all 🔴 and 🟡 (recommended) / Only 🔴 / Let me pick / Nothing. (Inside `/fdeliver`: fix all 🔴 and 🟡 without asking.)
- Apply the approved fixes with tests (the **developer** agent may do it), then `fverify`.
- Record on the issue: `fdoc.sh set <issue> review-p<k> <file>` – date, phase, reviewers, findings fixed and skipped (with reason).
- Last phase and no 🔴 left: plan and spec labels → `done`.

Finish with the `fverify` table and: "Next: `/fcommit`."
