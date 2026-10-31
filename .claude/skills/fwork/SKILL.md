---
name: fwork
description: Run the sprint for a planned epic. Several developer agents in parallel (each in its own git worktree) take the ready tasks by priority, build them with tests, get them checked by QA and reviewed (code + security, plus UI/ops reviews where relevant), rebase on the latest base branch, open PRs that merge automatically when the pipeline passes, and take the next task until the epic is done.
argument-hint: "#<epic>"
disable-model-invocation: true
effort: high
---

# Run the sprint (Delivery lead)

You are the **delivery lead**: you run the team, you don't code. Only you talk to the stakeholder; subagents return questions to you.

Input: $ARGUMENTS

## 0. Preconditions
- `fgit.sh check`; settings `fgit.sh config` (`DEVELOPERS`, `BASE_BRANCH`, `MERGE_METHOD`, `AUTO_MERGE`).
- The epic is `epic:planned` (otherwise `/fplan #<epic>`). Show `fgit.sh children <epic>` and `fgit.sh ready <epic>` in a few lines.
- `AUTO_MERGE=on` needs a pipeline with required checks and branch protection on `BASE_BRANCH` – check once (`gh api repos/{owner}/{repo}/branches/<BASE_BRANCH>/protection --jq '.required_status_checks.contexts'`). Missing → tell the stakeholder that PRs would merge without checks; continue only with their OK, or with `AUTO_MERGE=off`.
- Tasks still labelled `in-progress` from an earlier run: check their branch/PR and resume them first.

## 1. Developer slots
Slots `dev-1` … `dev-<DEVELOPERS>`. For every free slot, while `fgit.sh ready <epic>` has a task nobody in this run has taken, **`BASE_BRANCH` is green** (step 2.5) and it is before `CUTOFF` (`fgit.sh config CUTOFF`, local time; `off` = no cutoff – after it, slots only finish the tasks they have):
1. `fgit.sh claim <task> dev-<k>` (an `ops` task: `cloudops`; check with `fgit.sh labels <task>`; it takes a slot like any task, and being P1 it is picked first).
2. Start a **developer** agent (for an `ops` task the **cloudops** agent, following its "Ops tasks" flow; its ops review in step 2 is then done by the **reviewer** only) with `isolation: "worktree"` in the background: the task number, its slot name, the settings, and "build, verify and commit (steps 1–3), then return your worktree path and branch". Never give two developers the same task.

## 2. Per task, when its developer returns (other slots keep working)
1. **QA** agent in the developer's worktree: criteria → tests, edge cases, flows; commits tests; reports defects. Skip for `ops` tasks (the pipeline lints the workflows; the reviewer checks them).
2. Reviews in parallel, independent (worktree + branch + task, never the developer's reasoning):
   - **reviewer** (code + security), always;
   - **designer** UI review if the frontend changed;
   - **cloudops** ops review if configuration or migrations changed (the AppHost, infra and workflows only change in `ops` tasks);
   - the built-in `/security-review` only when the task touches sign-in, accounts, permissions, tenant data, payments or secrets, and `/code-review` only for size-M tasks (each starts its own agents; the reviewer covers the rest).
3. **Verify the findings** against the code; drop false positives. Record `fgit.sh set <task> review <file>` (fixed / skipped with reason). Every skipped finding worth keeping becomes a follow-up (`fgit.sh new follow-up "<title>" <file>` with the task, file:line and why it was skipped), so it isn't lost when the task closes.
4. Resume the **same developer** (SendMessage to its agent): fix QA defects and all must/should findings (consider-items when cheap) with tests and new commits, then step 5 of its instructions – rebase on `origin/<BASE_BRANCH>`, checks, push, PR with `Closes #<task>`, auto-merge when `AUTO_MERGE=on`. **At most two fix rounds:** must-fix findings still open after the second → **team-lead** decides (split, re-scope, follow-up, or a question for the stakeholder) instead of a third round.
5. Track the PR (`gh pr view <pr> --json state,mergeStateStatus,statusCheckRollup`, or `gh pr checks <pr> --watch` in the background):
   - checks failing → resume the developer with the failing output;
   - behind `BASE_BRANCH` / conflicts → resume the developer to rebase and push with lease;
   - **merged** → the task closes (`Closes #<task>`); remove the worktree if it's left; `fgit.sh sync` in the main checkout (back on `BASE_BRANCH`, pulled, merged branches deleted); check the merge's run on `BASE_BRANCH` (`gh run list --branch <BASE_BRANCH> --limit 1`, watch it if still running); the slot takes the next ready task (step 1).
   - **`BASE_BRANCH` red** after a merge → nobody claims new tasks; open a bug (`fgit.sh new bug`, failing check and log excerpt) and resume the developer whose merge broke it to fix it on a `fix/<bug>-…` branch first (PR with `Fixes #<bug>`); then the slots go on.
   - `AUTO_MERGE=off` → tell the stakeholder the PR is ready; the slot takes the next ready task meanwhile.

## 3. Problems
- A developer reports the task too big, a missing blocker (incl. a needed infrastructure change → the team lead adds or extends the `ops` task and makes it a blocker), or a design/product/API question → **team-lead** (and architect / product owner) decide; `fgit.sh release <task> "<why>"` if it goes back; questions for the stakeholder with AskUserQuestion (or `needs-answer` + comment if they're away).
- Nothing ready but tasks open → they wait for PRs to merge; say which ones and why.
- `CUTOFF` reached with tasks still open → finish the ones in flight (through merge), claim nothing new, and end with the day report (step 4, last bullet) listing what carries over; the next `/fwork #<epic>` resumes them. A task that won't fit tomorrow either → **team-lead** splits it.
- Never push to `BASE_BRANCH`, merge by hand, close issues by hand or touch cloud resources; force pushes only with lease on a developer's own task branch.

## 4. Epic done
All tasks closed (`fgit.sh children <epic>`):
1. **Epic QA** – a **qa** agent with `isolation: "worktree"` on the latest `origin/<BASE_BRANCH>` runs its "Epic pass" (the epic's success criteria end to end, across the tasks). Missing tests → its PR (`test/<epic>-epic-pass`); defects → bugs, fixed first with `/ffix` steps 2–4.
2. **Acceptance** – the **product-owner** checks what was delivered against the epic's success criteria, with the QA report: **accepted** (and writes the "What users get" comment on the epic) or the missing pieces as new tasks → back to step 1.
3. Close the epic (`gh issue close <epic> --comment "<summary>"`).
4. **Retro** – non-obvious lessons from the developers' gotchas and the review findings → one-liners in `CLAUDE.md` → Gotchas (no duplicates). A **developer** agent (worktree) makes the change on `docs/retro-<epic>` and opens the PR; once it merges, `fgit.sh sync` so the main checkout ends on the latest `BASE_BRANCH`.
5. **Report** (also at `CUTOFF`, posted as a comment on the epic): what users get, the PRs, notable review fixes, follow-ups created, what carries over and why, steps for the stakeholder (from CloudOps), and the next approved epic (`/fplan #<n>` or `/fwork #<n>`).
