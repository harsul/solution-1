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
- `fdoc.sh check`; settings `fdoc.sh config` (`DEVELOPERS`, `BASE_BRANCH`, `MERGE_METHOD`, `AUTO_MERGE`).
- The epic is `epic:planned` (otherwise `/fplan #<epic>`). Show `fdoc.sh children <epic>` and `fdoc.sh ready <epic>` in a few lines.
- `AUTO_MERGE=on` needs a pipeline with required checks and branch protection on `BASE_BRANCH` – check once (`gh api repos/{owner}/{repo}/branches/<BASE_BRANCH>/protection --jq '.required_status_checks.contexts'`). Missing → tell the stakeholder that PRs would merge without checks; continue only with their OK, or with `AUTO_MERGE=off`.
- Tasks still labelled `in-progress` from an earlier run: check their branch/PR and resume them first.

## 1. Developer slots
Slots `dev-1` … `dev-<DEVELOPERS>`. For every free slot, while `fdoc.sh ready <epic>` has a task nobody in this run has taken:
1. `fdoc.sh claim <task> dev-<k>` (an `ops` task: `cloudops`; check with `fdoc.sh labels <task>`; it takes a slot like any task, and being P1 it is picked first).
2. Start a **developer** agent (for an `ops` task the **cloudops** agent, following its "Ops tasks" flow; its ops review in step 2 is then done by the **reviewer** only) with `isolation: "worktree"` in the background: the task number, its slot name, the settings, and "build, verify and commit (steps 1–3), then return your worktree path and branch". Never give two developers the same task.

## 2. Per task, when its developer returns (other slots keep working)
1. **QA** agent in the developer's worktree: criteria → tests, edge cases, flows; commits tests; reports defects.
2. Reviews in parallel, independent (worktree + branch + task, never the developer's reasoning):
   - **reviewer** (code + security), always;
   - **designer** UI review if the frontend changed;
   - **cloudops** ops review if configuration or migrations changed (the AppHost, infra and workflows only change in `ops` tasks);
   - the built-in `/code-review` and `/security-review` when available (note when not).
3. **Verify the findings** against the code; drop false positives. Record `fdoc.sh set <task> review <file>` (fixed / skipped with reason).
4. Resume the **same developer** (SendMessage to its agent): fix QA defects and all must/should findings (consider-items when cheap) with tests and new commits, then step 5 of its instructions – rebase on `origin/<BASE_BRANCH>`, checks, push, PR with `Closes #<task>`, auto-merge when `AUTO_MERGE=on`.
5. Track the PR (`gh pr view <pr> --json state,mergeStateStatus,statusCheckRollup`, or `gh pr checks <pr> --watch` in the background):
   - checks failing → resume the developer with the failing output;
   - behind `BASE_BRANCH` / conflicts → resume the developer to rebase and push with lease;
   - **merged** → the task closes (`Closes #<task>`); remove the worktree if it's left; the slot takes the next ready task (step 1).
   - `AUTO_MERGE=off` → tell the stakeholder the PR is ready; the slot takes the next ready task meanwhile.

## 3. Problems
- A developer reports the task too big, a missing blocker (incl. a needed infrastructure change → the team lead adds or extends the `ops` task and makes it a blocker), or a design/product/API question → **team-lead** (and architect / product owner) decide; `fdoc.sh release <task> "<why>"` if it goes back; questions for the stakeholder with AskUserQuestion (or `needs-answer` + comment if they're away).
- Nothing ready but tasks open → they wait for PRs to merge; say which ones and why.
- Never push to `BASE_BRANCH`, merge by hand, close issues by hand or touch cloud resources; force pushes only with lease on a developer's own task branch.

## 4. Epic done
All tasks closed (`fdoc.sh children <epic>`):
- **team-lead** confirms the epic's success criteria (missing → a new task, back to step 1);
- close the epic (`gh issue close <epic> --comment "<summary>"`);
- **retro**: non-obvious lessons from the developers' gotchas and the review findings → one-liners in `CLAUDE.md` → Gotchas (no duplicates), committed through a small PR like any change;
- report: what users get, the PRs, notable review fixes, skipped items, steps for the stakeholder (from CloudOps), and the next approved epic (`/fplan #<n>` or `/fwork #<n>`).
