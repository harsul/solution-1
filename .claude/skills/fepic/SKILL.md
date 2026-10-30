---
name: fepic
description: Define epics with the product owner. Turns an idea, a list of wishes or the product profile into one or more small epics (one working day of the agent team each) as GitHub issues labelled epic, asks the stakeholder the open product questions, and gets each epic approved. Also reviews and reorders existing epics.
argument-hint: "\"idea\" | review | #<epic>"
disable-model-invocation: true
effort: high
---

# Define epics (Product owner)

Input: $ARGUMENTS

## 0. Context
`.claude/scripts/fgit.sh check` (else stop: `gh` installed and signed in, or a cloud session with GitHub connected); `fgit.sh init-labels` once per repo. Read `docs/product.md` (no profile → suggest `/finit` first), `CLAUDE.md`, the settings (`fgit.sh config`) and the existing epics (`gh issue list --label epic --state all`).

## 1. Epics
- **An idea** → start the **product-owner** agent with it, the profile and the existing epics. It writes one or more epics (status `epic:draft`), each small enough for one working day of the agent team (at most `EPIC_MAX_TASKS` tasks), split where needed, with priorities and dependencies between epics.
- **`review`** → show the open epics (priority, status, open tasks via `fgit.sh children`) and ask what changes: reorder, add, split, drop.
- **`#<epic>`** → refine that epic with the product owner.

## 2. Questions and approval
- Ask the agent's **questions for the stakeholder** with AskUserQuestion (max 4 per call, recommended first, each self-contained); pass the answers back to the product owner to fold in.
- With `GATES=epic+tasks`: show each epic in 3–5 lines (goal, in/out, success criteria, priority) and ask **Approve / Change / Drop**. On approve: `fgit.sh epic-status <epic> approved` and fill **Approved:** in its body. With `GATES=tasks` or `none`: approve automatically once no question is open.
- Stakeholder away: comment the questions on the epic (`fgit.sh comment`), label `needs-answer`, stop; resume with `/fepic #<epic>`.

## 3. Next
List the approved epics by priority and suggest `/fplan #<epic>` for the first one.
