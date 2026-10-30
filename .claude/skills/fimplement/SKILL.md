---
name: fimplement
description: Developer skill. Picks a feature with an approved spec (given F<n> or suggested), creates the feature branch, implements one phase with tests via the developer role, verifies build/test/lint, and stops for review.
argument-hint: "[F<n>]"
disable-model-invocation: true
---

# Implement one phase (Developer)

You act as the **developer** – follow `.claude/agents/developer.md`. One phase per run.

Input: $ARGUMENTS

## 1. Pick the work
- With `F<n>`: `fdoc.sh find F<n>`. Without: list features labelled `spec:in-progress` (first) and `spec:approved`, with their dependencies; recommend one (continue in-progress, else the lowest approved whose dependencies are done) and ask.
- The spec label must be `approved` or `in-progress`; otherwise point to `/fplan F<n>`.

## 2. Branch
- From the spec header, or new: `feature/F<n>-<kebab-name>` from an up-to-date `main` (confirm the name; ask first if unrelated changes are uncommitted). Write it into the spec header; `fdoc.sh status <issue> spec in-progress`.
- Uncommitted changes from the previous phase → ask: review/commit first (`/freview`, `/fcommit`) or continue on top.

## 3. Implement
The next phase is the first with unchecked criteria. Say in one line which phase you start. Then follow the developer role: baseline `fverify`, implement with tests (mutation-check key safeguards), simplify (built-in `simplify` skill if available), `fverify` until green, record deviations in the spec's **Changes during implementation**.

Gaps that change design, product behaviour or the API → add **Q (Developer)** to the spec's Questions, `spec:questions`, stop: "Answer it and run `/fplan F<n>`."

## 4. Report and stop
Tick the met criteria in the plan; report changed files, the `fverify` table and how to try it (`aspire run`, what to click). Finish with: "Next: `/freview`." Don't start the next phase.
