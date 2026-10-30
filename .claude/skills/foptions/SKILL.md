---
name: foptions
description: Show the team workflow (roles, agents and the /f* commands), the settings, where the work stands on GitHub (epics, tasks, PRs), and the suggested next command. Read-only.
argument-hint: "[command or agent name for details]"
disable-model-invocation: true
effort: low
---

# Workflow options

Input: $ARGUMENTS

Read-only: don't change files, branches, issues or labels.

## 1. Collect
Read every `.claude/skills/*/SKILL.md` and `.claude/agents/*.md` (frontmatter `name`, `description`, `argument-hint`/`tools`). Always from the files, never from memory.

## 2. With an argument
Details for that command or agent: description, arguments or tools, its steps (`##` headings, one line each), what it reads and writes, what comes before and after. No match → closest names. Stop.

## 3. Overview
```
/finit  →  /fepic  →  /fplan #<epic>  →  /fwork #<epic>  ↺ next epic
 setup     epics      tasks (team lead     developers in parallel: task → QA → review →
           (PO)        + architect)         rebase → PR → auto-merge → next task
/ffix #<bug>    failing test → fix → QA → review → PR
/fcommit [check]  verify (+ commit) your own changes      /foptions  this overview
```
Tables: **Commands** (command + argument hint, one sentence) and **Agents** (role, owns, tools).

**Settings:** `fdoc.sh config` in one line (e.g. `IDs F · gates epic+tasks · 3 developers · ≤9 tasks/epic · ≤400 lines/task · base main · rebase · auto-merge off · cost balanced`); change them in `.claude/workflow.conf` or with `/finit update workflow`.

**Where you are** (skip silently what's empty): current branch; product profile present; `fdoc.sh check`; epics by status (`gh issue list --label epic`), per open epic its tasks (`fdoc.sh children`) with in-progress ones and what's ready (`fdoc.sh ready`); open PRs (`gh pr list`) with check status; open bugs; issues labelled `needs-answer`.

**Suggested next** (first matching rule):
| Situation | Suggest |
|---|---|
| no `docs/product.md` | `/finit` |
| `fdoc.sh check` fails | install / sign in to `gh` (or a cloud session with GitHub connected) |
| an issue labelled `needs-answer` | answer it, then the command that asked again |
| an epic `epic:planned` with open tasks | `/fwork #<epic>` |
| an epic `epic:approved` | `/fplan #<epic>` |
| an open bug | `/ffix #<n>` |
| an epic `epic:draft` | `/fepic #<epic>` |
| nothing open | `/fepic "<next idea>"` or `/fepic review` |

End with: "Details: `/foptions <name>`."
