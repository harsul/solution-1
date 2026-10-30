---
name: finit
description: The one setup command. For a new project from this template it asks about the product (name, customers, tenancy, sign-in, billing, modules, brand, hosting, compliance, team workflow, ticket IDs), writes the product profile docs/product.md and applies it to the code - code name (solution, projects, namespaces), display name, brand colors, ticket prefix. Re-run any time to change any of it, e.g. /finit update name or /finit update brand.
argument-hint: "[update [name | brand | tickets | workflow | quality | <section>]]"
disable-model-invocation: true
effort: high
---

# Product setup (finit)

You run the product setup with the stakeholder, as **product owner** for the product questions and **architect/CloudOps** for the technical options. Ask with AskUserQuestion: up to 4 questions per call, the recommended option first with a one-line trade-off, each question self-contained (the dialog may hide earlier text). The stakeholder can always type their own answer.

Input: $ARGUMENTS

## 1. Context (silently)
- Read `CLAUDE.md`, `docs/product.md` if it exists, `src/frontend/src/theme.ts`, `src/frontend/src/App.tsx` and what is already built (`src/frontend/src/features/`, `src/AspireApp1.Server/Endpoints/`).
- **Profile exists** → update mode: show a 5-line summary of it and ask which sections to change (or take the topic given: `name` = code name and/or display name, `brand` = name users see, tagline, colors, `tickets` = ticket prefix, `workflow` = the workflow settings and cost, `quality` = the quality bar, or any profile section); ask only those questions, then apply only those changes (step 5). **No profile** → all rounds below.
- The current code name is the prefix of `src/*.AppHost` (e.g. `AspireApp1`), the solution is the `*.slnx` file.

## 2. Free-text basics (in chat, one message)
Ask in plain text, as one short list, and wait for the answer:
1. **Product name** (and short name for tight spaces, if different), and the **code name** for the solution and projects (PascalCase, e.g. `BookingHub`; suggest one from the product name, or keep the template's).
2. **One sentence**: what it does and for whom.
3. **Tagline** for the app bar (optional; suggest one).
4. **Main entities** the product manages (e.g. projects, invoices, bookings) – these become the first product features.
5. **Brand**: main color (hex) and optionally an accent color, or "keep the template's purple and blue"; logo now or later.
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

**Round D – look and feel, and the quality bar**
- Default theme: follow the system / light / dark.
- Density and tone: friendly and plain (recommended) / formal / playful.
- Layout: top app bar (current) / side navigation for app-like products.
- Quality bar (multi-select; becomes part of the Definition of Done): phones from 390 px wide (recommended) / dark mode (recommended) / WCAG 2.1 AA (recommended) / WCAG 2.2 AA. Also ask the browsers: current Chrome, Edge, Safari, Firefox (recommended) / plus older versions.
- Tests: mutation checks for key safeguards (recommended) / a coverage minimum in CI (e.g. 80 %) / both.

**Round E – hosting and compliance**
- Hosting: Azure Container Apps (current) / other.
- Data region: EU (e.g. West Europe) / US / customer-selectable later.
- Environments now: dev only / dev + prod.
- Email provider: decide later / Azure Communication Services / SendGrid / Postmark / SMTP.
- Compliance needs: GDPR basics / SOC 2 later / HIPAA / none special.
- Product analytics: none / privacy-friendly (e.g. Plausible) / full (e.g. PostHog).

**Round F – how the team works** (written to `.claude/workflow.conf`; explain that it can be edited any time)
- Approvals `GATES`: epic + task list (recommended, `epic+tasks`) / task list only (`tasks`) / none, only real decisions (`none`).
- Team size `DEVELOPERS`: 2 developers + QA (recommended) / 3 (faster, more cost) / 4–5 (fastest, more conflicts and cost).
- Epic and task size: an epic is one working day of the agent team – `EPIC_MAX_TASKS` (default 9) tasks of up to `TASK_MAX_LINES` (default 400) changed lines; ask only if the stakeholder wants other limits.
- Merging `MERGE_METHOD`: rebase, linear history (recommended) / squash, one commit per task / merge commits. `AUTO_MERGE`: off until the pipeline and branch protection exist (recommended) / on.
- Cost `COST`: balanced (recommended: Sonnet for the product owner, designer, QA and developers; the session's model for architect, team lead, CloudOps and reviewer) / economy (Sonnet for every role except the reviewer) / max (the session's model everywhere).
- `BASE_BRANCH` (default `main`): ask only if the stakeholder wants another one.
- Work tracking: GitHub Issues (current tooling) / something else (note it; the tooling stays GitHub-based for now).
- **Task IDs**: prefix and first number – `F` → F1, F2 (template default) / `ENG-` → ENG-1 / a project key like `BKG-`. Written to `.claude/workflow.conf` (`ID_PREFIX`, `ID_START`); change it only before the first task.

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
## Quality bar       (screen sizes, color modes, accessibility level, browsers, test rules)
## Team workflow     (tracking; the settings themselves live in .claude/workflow.conf)
## Decisions log     (date – decision – reason, appended on every update)
```

Project-wide technical rules that follow from the answers (data region, environments, auto-merge, sign-in providers) also go as one-liners into `CLAUDE.md` → Conventions, replacing the template's defaults where they differ. Replace the first lines of `CLAUDE.md` (title + one-sentence description) with the product's.

## 5. Apply the basics to the code
Working tree clean (otherwise ask to commit or stash first); a branch `chore/finit` (update mode: `chore/finit-<topic>`) from an up-to-date `main`. Apply only what changed:
- **Code name** (if it changes) – first, so the following edits land in the renamed projects:
  - tell the stakeholder in two lines what happens: folders, project files and namespaces move; the local Aspire Postgres starts empty once (its volume is named after the AppHost; migrations recreate the schema; the old volume stays until removed); the IDE must reopen the new `.slnx`;
  - run `.claude/scripts/rename.sh <CodeName>`; check that `git status` shows renames (not deletions plus additions) and that `git grep -n "<OldName>"` finds nothing outside `docs/plans` and `docs/specs` (the F1–F5 archive keeps its wording).
- **Workflow settings**: write the chosen values into `.claude/workflow.conf` (keep its comments) and check them with `.claude/scripts/fgit.sh config`.
- **Cost**: set `model:` in the agents' frontmatter (`.claude/agents/*.md`) – `economy`: `sonnet` for every agent except `reviewer` (`inherit`); `balanced`: `sonnet` for `product-owner`, `designer`, `qa` and `developer`, `inherit` for the rest; `max`: `inherit` everywhere.
- Start the **developer** agent with the profile and these tasks only:
  - `src/frontend/src/brand.ts`: `name`, `tagline`, `primary` (main color), `secondary` (accent; derive a harmonious one if only a main color was given), `defaultMode`. Remove `primaryDark`/`secondaryDark` unless the stakeholder gave dark-mode shades – the theme then derives readable lighter shades, the backgrounds and the app bar gradient from the brand colors.
  - `src/<Code>.Server/Branding.cs`: `ProductName` (emails and the email sender).
  - `src/frontend/index.html`: `<title>`.
  - Check contrast: text on `primary` buttons and the app bar gradient must stay readable (WCAG AA); adjust the shades in `brand.ts` if not.
  - Nothing else – modules, sign-in methods, billing and so on become epics, not setup changes.
Then `/fcommit check` (format, build, all tests, frontend) – fix only what setup broke – the **designer** agent reviews the brand change from screenshots (light/dark, 390 px) if the colors changed, and `/fcommit auto`: a rename as its own commit (`refactor: rename the project to <CodeName>`), then `chore: set up <product name>` (brand, profile, `CLAUDE.md`, `workflow.conf`). Record every change in the profile's Decisions log. Leave merging and pushing to the stakeholder; after a rename tell them to reopen `<CodeName>.slnx`, and that renaming the GitHub repository (Settings → General) and the local folder is optional and separate.

## 6. Next
Report: the profile summary, what changed in the code, and the next step – for a new project `/fepic`, which turns the profile's v1 modules and main entities into the first epics without asking the same questions again. Also tell the stakeholder what `AUTO_MERGE=on` needs (a pipeline with required checks and branch protection on `BASE_BRANCH` – usually the first epic) and the `.claude/settings.json` permissions for pushing task branches and creating PRs.
