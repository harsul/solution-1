---
name: foptions
description: List all project workflow skills (the /f* commands) with what each one does, its arguments, the order to use them in, and a suggested next command for the current state. Read-only.
argument-hint: "[skill name for details, e.g. fplan]"
disable-model-invocation: true
effort: low
---

# Workflow options

Input: $ARGUMENTS

Read-only: don't change any files, branches or statuses.

## 1. Collect the skills

Read every `.claude/skills/*/SKILL.md` and take `name`, `description` and `argument-hint` from the frontmatter. Always build the list from the files, never from memory, so new or changed skills show up. Include this skill too.

## 2. With an argument (e.g. `/foptions fplan`)

Show the details for that one skill only:

- the description and the arguments;
- its steps: the `##` headings of its SKILL.md, one line each;
- the files it reads and writes;
- what usually comes before and after it.

If no skill matches, list the closest names. Then stop.

## 3. Without an argument: overview

Print, in this order and kept short:

**Feature workflow**

```
/fbrainstorm → /fplan → /fimplement → /freview → /fcommit
  (PO)          (Architect) (Developer)  (Reviewer)  ↺ next phase: /fimplement
```

**Skills**

A table with the columns Command (with its argument hint, e.g. `/fplan [F<n>]`), Role and What it does. Order the rows by the workflow above, then the helpers (`/fverify`, `/foptions`), then any other skills alphabetically. Shorten each description to one sentence.

**Where you are** (skip a line silently if there's nothing to show)

- The current branch: `git branch --show-current`.
- Features that aren't **Done**: read the frontmatter `id`, `title` and `status` (and `phase` for specs) of `docs/plans/*.md` and `docs/specs/*.md`. One line per feature, e.g. `F2 Login – spec In progress (phase 1/3)`.
- Pending questions: count `_pending_` answers in those files.

**Suggested next:** one command, picked by the first matching rule:

| Situation | Suggest |
|---|---|
| A plan or spec in **Questions** | `/fbrainstorm F<n>` (plan) or `/fplan F<n>` (spec) |
| Uncommitted code changes on a feature branch | `/freview` |
| Reviewed changes not committed yet | `/fcommit` |
| A spec **In progress** or **Approved** | `/fimplement F<n>` |
| A plan **Approved** without a spec | `/fplan F<n>` |
| Nothing open | `/fbrainstorm <idea>` |

End with: "Details: `/foptions <skill>`."
