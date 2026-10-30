---
name: foptions
description: Show the team workflow (roles, agents and the /f* commands), where the work currently stands on GitHub Issues, and the suggested next command. Read-only.
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
/finit → /froadmap → /fdeliver epic #<n> ↺ next epic
 setup     epics      plan → approve → build, review, commit, PR (per feature)
/ffix #<bug>          failing test → fix → review → PR
/fcommit [check|auto] verify (+ commit)          /foptions  this overview
```
Tables: **Commands** (command + argument hint, one-sentence description) and **Agents** (role, owns, tools).

**Where you are** (skip silently what's empty): current branch; product profile present (`docs/product.md`); `fdoc.sh check`; the roadmap's epics with their open features and status labels (`fdoc.sh roadmap`, `fdoc.sh children <epic>`); open bugs (`type:bug`); issues labelled `needs-answer`; uncommitted changes.

**Suggested next** (first matching rule):
| Situation | Suggest |
|---|---|
| no `docs/product.md` | `/finit` |
| `fdoc.sh check` fails | install / sign in to `gh` (or use a cloud session with GitHub connected) |
| no roadmap issue | `/froadmap` |
| an issue labelled `needs-answer` | answer it, then the same `/fdeliver …` again |
| uncommitted changes on a branch | `/fcommit` (or continue `/fdeliver`) |
| a feature `spec:in-progress` | `/fdeliver <ID>` |
| an open bug | `/ffix #<n>` |
| an epic with open features | `/fdeliver epic #<n>` |
| nothing open | `/froadmap review` |

End with: "Details: `/foptions <name>`."
