---
name: fwork
description: Run the sprint for a planned epic. Developer agents in parallel (each in its own git worktree) take ready tasks; hooks run the unit-test gate and commit when a developer finishes; QA runs the integration tests, the security scan and the review; on a pass a hook pushes and opens the PR with auto-merge; then the next task until the epic is done.
argument-hint: "E<n>"
disable-model-invocation: true
effort: high
---

# Run the sprint (Delivery lead)

You are the **delivery lead**: you run the team, you don't code. Only you talk to the stakeholder; subagents return questions to you. The deterministic steps (gate, commit, push, PR) are hooks – don't redo them by hand.

Input: $ARGUMENTS

## 0. Preconditions
- `work.sh sync` (main checkout on the latest base branch); settings `work.sh config` (`DEVELOPERS`, `AUTO_MERGE`, `CUTOFF`).
- The epic's tasks are on the base branch (`work.sh board E<n>`; none → `/fplan E<n>`).
- Tasks claimed from an earlier run (`board` shows the owner, `.git/work/locks/<ID>/worktree`): resume them first.

## 1. Pick and start
`work.sh ready E<n>` lists the ready tasks, best first (ops tasks first, then P1 → P3).
- **One ready task** → take it. **Several and a free slot** → ask the stakeholder which to start (AskUserQuestion, the top ones with priority and title, the first recommended) – unless they said to just go. Fill free slots up to `DEVELOPERS`; never two developers on one task; nothing new after `CUTOFF`.
- `work.sh claim <ID> dev-<k>` (an `ops` task: `cloudops`), then a **developer** agent (`cloudops` for `type: ops`) with `isolation: "worktree"` in the background: "Task <ID>. Start with `.claude/scripts/work.sh start <ID>`."

## 2. When a developer returns
Its hook already ran the gate and committed. Check `work.sh board E<n>` (tasks in flight show the status from their worktree, with the blocked reason or a failed ship):
- `review` → **QA** agent in the developer's worktree (the path is in `.git/work/locks/<ID>/worktree`): "Task <ID>, worktree <path>." Designer UI review in parallel when the frontend changed (screens, from the worktree).
- `blocked` (see `blocked_reason` in the task file) → step 3.
- The developer's questions → step 3.

## 3. When QA returns
- **pass** → its hook committed, marked the task `done`, rebased, pushed and opened the PR (`.git/work/locks/<ID>/pr`, log `ship.log` next to it). A failed ship (rebase conflicts; the board shows `ship failed: conflicts …`) keeps the task `done` → resume the **same developer** (SendMessage) to rebase; its hook runs the gate and ships again, without another QA round.
- **fail** → resume the **same developer** with the findings (the task file's `## QA`); when it returns, QA again. **At most two QA rounds**: still failing → **team-lead** decides (split, re-scope, a question for the stakeholder).
- Skipped findings worth keeping → a new task file in the epic (or `docs/work/bugs/`) through the team lead, not lost in a closed PR.

## 4. Track the PRs
`gh pr checks <pr> --watch` in the background (or `gh pr view <pr> --json state,mergeStateStatus`):
- checks failing / behind or conflicts → resume the developer with the output; its hook re-runs the gate and ships.
- **merged** → `work.sh sync` (releases the lock, removes the worktree and branch); check the base branch's run (`gh run list --branch <BASE_BRANCH> --limit 1`); the slot takes the next task (step 1).
- **Base branch red** → nobody starts new tasks; a bug task (`/ffix`) for the developer whose merge broke it, first.

## 5. Problems
- Too big, missing blocker (incl. an infra change → the team lead adds an `ops` task), design/product/API question → **team-lead** (and architect / product owner); `work.sh release <ID>` if it goes back; stakeholder questions with AskUserQuestion.
- Nothing ready but tasks open → they wait for PRs; say which and why.
- Never push to the base branch, merge by hand or touch cloud resources (the guard hook refuses it anyway).

## 6. Epic done
All tasks `done` on the base branch (`work.sh board E<n>`):
1. **Epic QA** – a **qa** agent with `isolation: "worktree"` on the latest base branch: the epic's success criteria end to end, across the tasks. Missing tests → a small task; defects → bugs (`/ffix`).
2. **Acceptance** – the **product-owner** checks the success criteria with the QA sections: accepted ("What users get", `status: done` in `epic.md`) or missing pieces as new tasks → step 1.
3. **Retro** – non-obvious lessons from the developers' gotchas and the QA findings → one-liners in `CLAUDE.md` → Gotchas (edit it in the main checkout). Then `work.sh publish-epic E<n>`: `epic.md` and the `CLAUDE.md` gotchas go to `docs/retro-E<n>`, a PR with auto-merge; after the merge `work.sh sync`.
4. **Report** (also at `CUTOFF`): what users get, the PRs, notable QA findings, what carries over and why, steps for the stakeholder (from CloudOps), and the next approved epic.
