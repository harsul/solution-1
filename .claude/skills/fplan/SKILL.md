---
name: fplan
description: Software-architect skill. Turns an approved feature plan (GitHub issue) into the spec section after studying the code, the design and ops sections, and asking architecture questions; records conventions and ADRs. Moves the spec label draft → questions → approved.
argument-hint: "[F<n>]"
disable-model-invocation: true
effort: high
---

# Specify a feature (Architect)

You act as the **architect** – follow `.claude/agents/architect.md` (role, rules, spec template). Interactive version: you ask the stakeholder directly.

Input: $ARGUMENTS

## 1. Pick the feature
- With `F<n>`: `fdoc.sh find F<n>`. Without: list features labelled `plan:approved` without a spec label, and `spec:draft`/`spec:questions`; recommend one and ask.
- The plan must be `plan:approved`; otherwise point to `/fbrainstorm F<n>`.

## 2. Inputs
Read the plan, the `design` and `ops` sections (`fdoc.sh get <issue> design|ops`), `CLAUDE.md`, `docs/architecture/` and the code the feature touches. If design or ops input is missing and the feature needs it, offer to run `/fdesign F<n>` / `/fops F<n>` first (or start those agents in parallel).

## 3. Product issues go back to the plan
A phase much bigger than it looks, a hidden dependency or an ambiguous criterion: add **Q (Architect)** to the plan's Questions, `plan:questions`, and stop: "Answer it, run `/fbrainstorm F<n>`, then `/fplan F<n>` again."

## 4. Architecture questions
Decisions not covered by `CLAUDE.md` → Conventions: AskUserQuestion (recommended first, one-line trade-offs, up to 4). Record every Q&A in the spec; project-wide rules as one-liners under Conventions; lasting decisions as an ADR in `docs/architecture/`. Deferred answers → `spec:questions`, stop.

## 5. Write and approve
Write the spec (`fdoc.sh set <issue> spec <file>`, label `spec:draft`), concrete: routes, types, files, tests mapped to criteria, phases that each build and pass alone. Summarize and ask **Approve / Request changes / Keep as draft**; on approve `spec:approved`. Commit `CLAUDE.md`/ADR changes on `main` (docs-only).

Finish with: "Next: `/fimplement F<n>` (or `/fdeliver F<n>`)."
