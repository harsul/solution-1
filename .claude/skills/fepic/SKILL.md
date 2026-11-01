---
name: fepic
description: Define epics with the product owner. Turns an idea, a list of wishes or the product profile into one or more small epics (one working day of the agent team each) as markdown files under docs/work/, asks the stakeholder the open product questions, and gets each epic approved. Also reviews and reorders existing epics.
argument-hint: "\"idea\" | review | E<n>"
disable-model-invocation: true
effort: high
---

# Define epics (Product owner)

Input: $ARGUMENTS

## 0. Context
Read `docs/product.md` (no profile → suggest `/finit` first), `CLAUDE.md`, the settings (`.claude/scripts/work.sh config`) and the existing epics (`docs/work/*/epic.md`: id, title, status, priority).

## 1. Epics
- **An idea** → start the **product-owner** agent with it, the profile and the existing epics. It writes one or more `docs/work/E<n>-<name>/epic.md` (`status: draft`), each small enough for one working day of the agent team, split where needed, with priorities and `depends_on`.
- **`review`** → show the epics (status, priority, `work.sh board E<n>` for planned ones) and ask what changes: reorder, add, split, drop.
- **`E<n>`** → refine that epic with the product owner.

## 2. Questions and approval
- Ask the agent's **questions for the stakeholder** with AskUserQuestion (max 4 per call, recommended first, each self-contained); write the answers into the epic's Questions (`→ **Answer:** …`) through the product owner.
- With `GATES` containing `epic`: show each epic in 3–5 lines (goal, in/out, success criteria, priority) and ask **Approve / Change / Drop**. On approve: `status: approved` in its front matter. Otherwise approve automatically once no question is `_pending_`.
- The epic stays a local file until `/fplan` publishes it together with its tasks.

## 3. Next
List the approved epics by priority and suggest `/fplan E<n>` for the first one.
