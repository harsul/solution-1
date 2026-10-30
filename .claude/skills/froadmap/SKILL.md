---
name: froadmap
description: Product roadmap session with the product owner. Shapes the SaaS template's vision, target businesses and epics as a pinned Roadmap issue plus epic and draft feature issues on GitHub; reorders or adds epics later.
argument-hint: "[\"topic\" | review]"
disable-model-invocation: true
effort: high
---

# Roadmap (Product owner)

You act as the **product owner** (`.claude/agents/product-owner.md`) together with the stakeholder. This is a conversation: ask with AskUserQuestion (up to 4 per round, recommended option first).

Input: $ARGUMENTS

## 1. Context (silently)
Read `CLAUDE.md`, the **Roadmap** issue (`fdoc.sh roadmap`) (if any), the epic issues (`gh issue list --label type:epic --state all`) and what is already built (Done features, `src/frontend/src/features/`). Run `.claude/scripts/fdoc.sh check`.

## 2. Without a roadmap: shape it (2–3 rounds)
Start from `docs/product.md` (written by `/finit`): its customers, tenancy, billing, v1 modules and main entities already answer most questions below – don't ask them again; ask only what's missing (mainly order, success criteria and what "v1 done" means). No profile → suggest running `/finit` first, or continue with the questions below.
- **Vision and customers:** what kinds of businesses start from this template (B2B SaaS, marketplaces, internal tools, ...), who pays, what "done" looks like for v1.
- **Tenancy model:** single user, organizations/workspaces with members and roles, or both.
- **Monetization:** none yet, subscriptions with plans, usage-based; payment provider.
- **Must-haves for v1** vs later: deploy & CI/CD, organizations, billing, admin console, audit log, notifications/email templates, feature flags, API keys, i18n, onboarding, GDPR export/delete, observability.
- **Order:** what has to come first (usually Deploy & CI/CD, then tenancy, then billing).

## 3. With a roadmap (`review` or a topic)
Show the epics with their status and open features; ask what changes (reorder, add, drop, split).

## 4. Write
- The **Roadmap** issue (`fdoc.sh set-roadmap <file>`; created and pinned the first time, updated in place later): vision (3–5 lines), target customers, principles, epics in order (one line each with its issue link `#<n>`, goal and dependencies), Later. Write it after the epics exist so it can link them.
- One issue per epic: `fdoc.sh new epic "Epic: <name>" <file>`; body = goal, success criteria and **Planned features** (in order). Existing epics are updated, not duplicated.
- One **draft feature issue** per planned feature, in roadmap order: `fdoc.sh next-id`, then `fdoc.sh new feature "F<n> – <title>" <file>`, `fdoc.sh status <issue> plan draft`, `fdoc.sh link <epic> <issue>`. The body is a short draft, not a full plan: **Epic**, **Depends on**, **Goal** (1–3 sentences), rough **Scope** (in/out), and "Plan to be completed by the product owner (`/fbrainstorm F<n>` or `/fdeliver F<n>`)." Features of later epics may stay as lines in the epic body until their epic comes up; ask the stakeholder whether to create all now or only the first one or two epics' features (recommended).
- Show the result: epics with their sub-issues (`fdoc.sh children <epic>`).

Finish with the first suggested command, e.g. `/fdeliver epic #<n>`.
