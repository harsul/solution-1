---
name: foptions
description: List the team workflow (roles, agents and /f* commands) with what each does, where the work currently stands on GitHub Issues, and the suggested next command. Read-only.
argument-hint: "[skill or agent name for details]"
disable-model-invocation: true
effort: low
---

# Workflow options

Input: $ARGUMENTS

Read-only: don't change files, branches, issues or labels.

## 1. Collect
Read every `.claude/skills/*/SKILL.md` and `.claude/agents/*.md` (frontmatter `name`, `description`, `argument-hint`/`tools`). Always from the files, never from memory.

## 2. With an argument
Details for that skill or agent: description, arguments or tools, its steps (`##` headings, one line each), what it reads and writes, what comes before and after. No match → closest names. Stop.

## 3. Overview
**Team run:** `/fdeliver F<n> | epic #<n> | "idea"` – PO → (Designer ∥ Architect ∥ CloudOps) → spec gate → per phase Developer → Reviewer (+ Designer/CloudOps) → fixes → commit → PR.

**Bugs:** `/ffix #<issue>` – reproduce with a failing test → fix → review → PR (no plan/spec gates).

**Step by step:** `/froadmap` → `/fbrainstorm` → (`/fdesign`, `/fops`) → `/fplan` → `/fimplement` → `/freview` → `/fcommit` ↺

Tables: **Agents** (role, owns, tools) and **Commands** (command + argument hint, role, one-sentence description), helpers last (`/fverify`, `/foptions`).

**Where you are** (skip silently what's empty): current branch; `fdoc.sh check` result; open epics with their open features; features by label (`gh issue list --label type:feature --state open --json number,title,labels`) – one line each, e.g. `F7 Invitations (#23) – spec in-progress`; issues labelled `needs-answer`.

**Suggested next** (first matching rule):
| Situation | Suggest |
|---|---|
| `fdoc.sh check` fails | install/sign in to `gh` |
| an issue labelled `needs-answer` | answer it, then `/fdeliver F<n>` |
| an open issue labelled `type:bug` | `/ffix #<n>` |
| uncommitted code on a feature branch | `/freview` |
| reviewed changes not committed | `/fcommit` |
| `spec:in-progress` or `spec:approved` | `/fdeliver F<n>` (or `/fimplement F<n>`) |
| `plan:approved` without spec | `/fdeliver F<n>` (or `/fplan F<n>`) |
| no roadmap issue (`fdoc.sh roadmap` fails) | `/froadmap` |
| nothing open | `/fdeliver epic #<n>` for the next epic |

End with: "Details: `/foptions <name>`."
