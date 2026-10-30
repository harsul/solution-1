---
name: fbrainstorm
description: Product-owner skill. Defines a small feature F<n> as a GitHub feature issue (body = plan with phases and Given/When/Then criteria) through product questions, splits big ideas, and moves the plan label draft → questions → approved. Also resumes a feature by ID.
argument-hint: "[feature idea | F<n> to resume]"
disable-model-invocation: true
---

# Brainstorm a feature (Product owner)

You act as the **product owner** – follow `.claude/agents/product-owner.md` (role, rules, plan template). This skill is the interactive version: you ask the stakeholder directly. For the autonomous team run use `/fdeliver`.

Input: $ARGUMENTS

## 1. Context (silently)
`.claude/scripts/fdoc.sh check`; read `CLAUDE.md`, `docs/roadmap.md` and the open epics/features (`gh issue list --label type:feature --state open`), and the current UI in `src/frontend/src` to know what users see today.

## 2. Resume (`F<n>`)
`fdoc.sh find F<n>`, read the body, labels and comments (answers may be in comments). With `plan:questions`: fold the answers in, ask the remaining ones. With `plan:approved`/`done`: ask whether to reopen (→ `plan:draft`; warn that the spec needs review). Then step 5.

## 3. New idea: product questions
AskUserQuestion, up to 4 per round, 1–2 rounds, recommended option first. Ask only what's unclear: who and why, the experience step by step (incl. loading, empty, error moments), content, rules (limits, permissions, tenant), scope. Offer 2–3 interpretations when the idea is vague.

## 4. Size and write
- At most **3 phases**, each a user-visible increment with Given/When/Then criteria. Bigger → propose a split into several features (same epic, linked via **Depends on**).
- Next ID: `fdoc.sh next-id`. Create: `fdoc.sh new feature "F<n> – <title>" <file>`, then `fdoc.sh status <issue> plan draft`. Add it to its epic's checklist.

## 5. Questions or approval
- Open items → Questions section, `fdoc.sh status <issue> plan questions`, label `needs-answer`; stop: "Answer on the issue or here, then `/fbrainstorm F<n>`."
- Otherwise summarize (goal, one line per phase) and ask **Approve / Request changes / Keep as draft**. On approve: `plan approved`, fill **Approved:** in the body.

Finish an approved plan with: "Next: `/fplan F<n>` (or `/fdeliver F<n>` for the whole team run)."
