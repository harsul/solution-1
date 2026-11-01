---
name: fplan
description: Plan an approved epic with the team lead and the architect (designer and CloudOps for UI and infra notes) - small prioritized task files with acceptance criteria, technical notes and dependencies under docs/work/. When the architect finishes, a hook validates the plan and publishes it as a PR with auto-merge.
argument-hint: "E<n>"
disable-model-invocation: true
effort: high
---

# Plan an epic into tasks (Team lead + Architect)

Input: $ARGUMENTS

## 0. Context
The epic `docs/work/E<n>-…/epic.md` must be `status: approved` – otherwise point to `/fepic E<n>`. Read it, `docs/product.md`, `CLAUDE.md` and the settings (`work.sh config`: `EPIC_MAX_TASKS`, `TASK_MAX_LINES`, `DEVELOPERS`, `GATES`). Already planned (task files on the base branch, `work.sh board E<n>`) → show them and ask whether to re-plan the open ones.

## 1. Breakdown
1. **team-lead** agent: writes the task files in the epic folder (goal, acceptance criteria, priority, size, blockers, collision check).
2. In parallel (one message), on those files:
   - **designer** → UI notes for tasks with screens (skip if none);
   - **cloudops** → Ops notes for tasks touching infrastructure, configuration, CI or migrations (skip if none); says whether the epic needs an `ops` task.
3. **architect** agent last: Technical notes for every task, collisions resolved (blockers, merged or foundation tasks), `work.sh check-plan E<n>` clean.
4. Too big (more than `EPIC_MAX_TASKS` tasks, or more rounds than one working day allows for `DEVELOPERS` developers) → the **product-owner** splits the epic; re-plan the part that stays.

## 2. Publish (hook)
When the architect finishes, the **SubagentStop hook** runs `work.sh check-plan` (invalid → back to the architect) and, if no question is `_pending_` and `GATES` doesn't contain `tasks`, `work.sh publish-plan E<n>`: the epic folder goes to `plan/E<n>`, a `docs(plan)` PR with auto-merge. The log is in `.git/work/publish-E<n>.log`.
- Open questions → ask the stakeholder (AskUserQuestion), write the answers back through the owning agent, then `work.sh publish-plan E<n>`.
- `GATES` with `tasks` → show the task table (ID, title, priority, size, blocked by) and the parallel plan; ask **Approve / Change**; on approve `work.sh publish-plan E<n>`.

## 3. Next
Once the plan PR is merged (`work.sh sync`), suggest `/fwork E<n>`.
