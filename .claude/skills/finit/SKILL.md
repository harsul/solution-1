---
name: finit
description: Product setup for a new project started from this template. Asks the stakeholder about the product (name, customers, tenancy, sign-in, billing, modules, brand, hosting, compliance, team workflow), writes the product profile docs/product.md that every agent reads, and applies the basics to the code (product name, tagline, brand color). Re-run to update the profile.
argument-hint: "[update | <topic>]"
disable-model-invocation: true
effort: high
---

# Product setup (finit)

You run the product setup with the stakeholder, as **product owner** for the product questions and **architect/CloudOps** for the technical options. Ask with AskUserQuestion: up to 4 questions per call, the recommended option first with a one-line trade-off, each question self-contained (the dialog may hide earlier text). The stakeholder can always type their own answer.

Input: $ARGUMENTS

## 1. Context (silently)
- Read `CLAUDE.md`, `docs/product.md` if it exists, `src/frontend/src/theme.ts`, `src/frontend/src/App.tsx` and what is already built (`src/frontend/src/features/`, `src/AspireApp1.Server/Endpoints/`).
- **Profile exists** → update mode: show a 5-line summary of it and ask which sections to change (or the `<topic>` given); ask only those rounds. **No profile** → all rounds below.

## 2. Free-text basics (in chat, one message)
Ask in plain text, as one short list, and wait for the answer:
1. **Product name** (and short name for tight spaces, if different).
2. **One sentence**: what it does and for whom.
3. **Tagline** for the app bar (optional; suggest one).
4. **Main entities** the product manages (e.g. projects, invoices, bookings) – these become the first product features.
5. **Brand**: primary color (hex) or "keep the template's purple"; logo now or later.
6. **Company / sender** name for emails, and support contact (email or URL) if there is one.

## 3. Option rounds (AskUserQuestion)
Skip any question the free-text answers or the existing profile already settle. Typical rounds:

**Round A – customers and access**
- Customers: B2B (organizations) / B2C (individuals) / both / internal tool.
- Tenancy: organizations with members and roles / one workspace per user / users only.
- Sign-up: open sign-up / invite-only / waitlist with approval.
- Sign-in methods (multi-select): email + password (built) / Google / Microsoft / passkeys / two-factor (TOTP) / enterprise SSO (later).

**Round B – money and plans**
- Billing: subscriptions with plans / subscriptions + usage / one-time payments / none in v1.
- Provider: Stripe / Paddle (merchant of record, handles VAT) / decide later.
- Plans: Free + paid / trial then paid / paid only.
- Currency and tax region: EUR (EU VAT) / USD / both.

**Round C – v1 modules** (multi-select; the rest goes to Later)
- Admin console for operators · audit log · notifications (email + in-app) · file uploads · API keys and webhooks · data export and deletion (GDPR) · reporting/dashboards · translations (which languages).

**Round D – look and feel**
- Default theme: follow the system / light / dark.
- Density and tone: friendly and plain (recommended) / formal / playful.
- Layout: top app bar (current) / side navigation for app-like products.

**Round E – hosting and compliance**
- Hosting: Azure Container Apps (current) / other.
- Data region: EU (e.g. West Europe) / US / customer-selectable later.
- Environments now: dev only / dev + prod.
- Email provider: decide later / Azure Communication Services / SendGrid / Postmark / SMTP.
- Compliance needs: GDPR basics / SOC 2 later / HIPAA / none special.
- Product analytics: none / privacy-friendly (e.g. Plausible) / full (e.g. PostHog).

**Round F – how the team works**
- Delivery: `/fdeliver epic` with plan + spec approval (recommended) / approve every feature / fully automatic.
- Auto-merge after CI: off until CI exists (recommended) / on.
- Work tracking: GitHub Issues (current tooling) / something else (note it; the tooling stays GitHub-based for now).

## 4. Write the profile
Show a compact summary (one line per section) and ask **Save / Change something**. Then write `docs/product.md`:

```markdown
# <Product name> – product profile

> Read by every agent. Owned by the product owner; change it with `/finit update`.

## Identity
Name · short name · one sentence · tagline · company/sender · support contact
## Customers and tenancy
## Access            (sign-up mode, sign-in methods: built / v1 / later)
## Billing           (model, provider, plans, currency/tax)
## Main entities     (what the product manages, one line each)
## Modules           (v1 / later / not planned)
## Brand and UI      (primary color, logo, theme default, tone, layout)
## Hosting and data  (platform, region, environments, email provider, analytics)
## Compliance
## Team workflow     (delivery mode, auto-merge, tracking)
## Decisions log     (date – decision – reason, appended on every update)
```

Project-wide technical rules that follow from the answers (data region, environments, auto-merge, sign-in providers) also go as one-liners into `CLAUDE.md` → Conventions, replacing the template's defaults where they differ. Replace the first lines of `CLAUDE.md` (title + one-sentence description) with the product's.

## 5. Apply the basics to the code
On a branch `chore/finit` from an up-to-date `main`, start the **developer** agent with the profile and these tasks only:
- Replace the template name ("Aspire Starter") and tagline everywhere they appear (`git grep -n "Aspire Starter"`: frontend title and app bar, `index.html`, email messages, `EmailOptions.FromName`) with the product name, tagline and sender; keep tests passing (update expected texts).
- Brand color: set `primary` in `src/frontend/src/theme.ts` for light and dark (a lighter shade for dark mode, readable contrast); default theme mode if chosen.
- Nothing else – modules, sign-in methods, billing and so on become roadmap features, not setup changes.
Then `fverify`, the **designer** agent reviews the brand change from screenshots (light/dark, 390 px) if the color changed, and `/fcommit auto` (`chore: set up <product name>`). Commit `docs/product.md` and `CLAUDE.md` with it. Leave merging and pushing to the stakeholder.

## 6. Next
Report: the profile summary, what changed in the code, and the next step – `/froadmap`, which turns the profile's v1 modules and main entities into epics and features without asking the same questions again.
