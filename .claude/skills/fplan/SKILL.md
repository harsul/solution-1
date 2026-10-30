---
name: fplan
description: Plan an approved epic with the team lead and the architect (designer and CloudOps for UI and infra notes) - small prioritized tasks with acceptance criteria, technical notes and dependencies, created as sub-issues of the epic - and get the task list approved. Tasks must not collide in the same code.
argument-hint: "#<epic>"
disable-model-invocation: true
effort: high
---

# Plan an epic into tasks (Team lead + Architect)

Input: $ARGUMENTS

## 0. Context
`fdoc.sh check`; the epic must be `epic:approved` (`fdoc.sh labels <epic>`) – otherwise point to `/fepic #<epic>`. Read the epic, `docs/product.md`, `CLAUDE.md` and the settings (`fdoc.sh config`: `EPIC_MAX_TASKS`, `TASK_MAX_LINES`, `DEVELOPERS`, `GATES`). Already planned (`epic:planned`) → show the tasks and ask whether to re-plan open ones.

## 1. Breakdown
1. **team-lead** agent: draft the tasks (goal, acceptance criteria, priority, size, blockers, collision check) and create them as sub-issues of the epic.
2. In parallel (one message), on the created tasks:
   - **architect** → Technical notes for every task; flags collisions and shared foundations;
   - **designer** → UI notes for tasks with screens (skip if none);
   - **cloudops** → Ops notes for tasks touching infrastructure, configuration, CI or migrations (skip if none).
3. **team-lead** again: fold in the architect's collisions (blockers, merged or extra foundation tasks), re-check sizes, and produce the **parallel plan**: which tasks can start at once, the critical path, roughly how many rounds `DEVELOPERS` developers need.
4. Too big (more than `EPIC_MAX_TASKS` tasks, or more rounds than one working day allows) → the **product-owner** splits the epic; re-plan the part that stays.

## 2. Questions and approval
- Collect the agents' questions; product questions go to the product owner first. Ask the stakeholder the rest with AskUserQuestion; write the answers back through the owning agent.
- With `GATES` = `epic+tasks` or `tasks`: show the task table (ID, title, priority, size, blocked by) and the parallel plan; ask **Approve / Change**. With `GATES=none`: approve automatically once no question is open.
- On approve: `fdoc.sh epic-status <epic> planned`.

## 3. Next
Suggest `/fwork #<epic>`. Reminder when `AUTO_MERGE=off`: PRs wait for the stakeholder to merge, and tasks blocked by them wait too.
