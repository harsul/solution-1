# Roadmap

_Owner: product owner (`/froadmap`) · Created: 2026-10-30 · Last review: 2026-10-30_

## Vision

A SaaS starter platform that a B2B team can fork on day one and sell on day thirty. It ships everything that is the same in every SaaS product (accounts, organizations with members and roles, Stripe subscriptions, a platform admin console, audit log, privacy tooling) and runs in Azure through CI/CD. Teams only build what makes their product different.

**v1 is done when** the template is **deployed and sellable**: it runs in Azure (staging + production) through CI/CD, teams can sign up, invite colleagues and pay for a plan, platform staff can support them, and the trust basics (audit log, data export/delete) are in place.

## Target customers

- **Primary: B2B SaaS teams.** Small product teams (1–10 developers) building a web app sold to other companies on a subscription.
- **Who pays (their customers):** organizations. An org owner subscribes, and members use the product under the org's plan.
- **Also served:** solo users. Every user gets a personal workspace and can create or join organizations later.
- **Not targeted in v1:** marketplaces (payouts, two-sided trust) and internal-only tools (SSO-first). Both can build on the template later.

## Principles

- **Generic, not domain-specific.** Nothing in the template should assume what the business sells. The `weather` sample is a placeholder for "your product here".
- **Tenant first.** All product data belongs to an organization (or personal workspace). One tenant can never see another's data.
- **Secure by default.** Least privilege for roles, every sensitive action is audited, and no secrets in the repo.
- **Deployed from the start.** Every feature after the Deploy epic ships to staging, and production stays one approval away.
- **Small vertical slices.** Each feature is at most 3 phases and each phase is usable on its own.
- **Cheap to run.** A small team must be able to afford staging and production with little traffic.

## Actors

| Actor | Who |
|---|---|
| Visitor | Not signed in: pricing page, sign-up, sign-in |
| User | Signed in, with a personal workspace |
| Org owner | Created or owns the org; billing, deleting the org, transferring ownership |
| Org admin | Manages members and invitations and sees the audit log |
| Org member | Uses the product inside the org |
| Platform admin | Staff of the business running the template; supports users and orgs |

## Epics (in order)

### ✅ 0. Accounts & Identity (done, F1–F5)
Sign-up, sign-in, sessions, forgot/reset password, email confirmation, account settings (change password, sign out everywhere), change email. Archived in `docs/plans` and `docs/specs`.

### 1. Deploy & CI/CD (#2)
**Goal:** Every merge to `main` reaches a real Azure environment safely, and production is a manual approval away.
**Success criteria**
- Every pull request runs build, tests and lint, and merging is blocked when they fail.
- `main` deploys automatically to **staging**, and **production** deploys after a manual approval.
- Database changes apply safely in staging and production without manual steps.
- A new user can sign up, confirm their email and sign in on staging and production (real email delivery).
- The team can see errors, health and basic usage of each environment, and gets alerts when production is down.

**Features**
- F6 – CI checks on pull requests (#9)
- F7 – Staging environment on Azure (auto-deploy from `main`, database migrations) (#10)
- F8 – Production environment with approval gate (#11)
- F9 – Production email delivery (#12)
- F10 – Monitoring, health checks and alerts (#13)

**Depends on:** nothing. **Resolves open decisions:** migrations outside Development, real email provider.

### 2. Organizations & Members (#3)
**Goal:** Users work together in organizations with clear roles, and all product data belongs to a tenant.
**Success criteria**
- Every user has a personal workspace and can create organizations and switch between them.
- Owners and admins invite people by email, and invitees can accept (signing up if needed) or decline.
- Fixed roles **Owner / Admin / Member** with clear permissions. Admins manage members, and only owners manage billing and delete the org.
- Owners can transfer ownership, and members can leave (the last owner can't).
- Product data (the sample feature) is scoped to the current organization, and cross-tenant access returns "not found".

**Features**
- F11 – Personal workspace, create organization, org switcher (#14)
- F12 – Invite members by email (accept / decline / revoke) (#15)
- F13 – Manage members: change role, remove, leave, transfer ownership (#16)
- F14 – Organization settings (name, ...) (#17)
- F15 – Org-scoped product data (sample feature moved under the org) (#18)

**Depends on:** 1.

### 3. Billing & Plans (Stripe) (#4)
**Goal:** Organizations pay for a plan by themselves, and plan limits are enforced.
**Success criteria**
- A public pricing page shows **Free / Pro / Business**. Every new org starts on **Free**, without a card.
- Owners upgrade through Stripe Checkout and manage payment methods, invoices and cancellation in the Stripe customer portal.
- The org's plan and subscription status are always in sync with Stripe (also after failed payments and cancellations).
- Plan limits (e.g. number of members) are enforced, with a clear upgrade prompt at the limit.
- Failed payments and downgrades are handled gracefully: no data is lost, and over-limit orgs get read-only or upgrade prompts.

**Features (rough)**
- Plan catalogue and pricing page
- Upgrade with Stripe Checkout, manage in the customer portal
- Subscription sync (Stripe webhooks) and billing status in org settings
- Plan limits and upgrade prompts
- Failed payment, cancellation and downgrade handling

**Depends on:** 1 (public URL for webhooks), 2 (billing belongs to an org).

### 4. Onboarding & Email templates (#5)
**Goal:** A new sign-up reaches "my team is set up" quickly, and every email looks like it comes from one product.
**Success criteria**
- After the first sign-in a short guided flow helps the user create or name their org and invite teammates, and it can be skipped.
- An onboarding checklist shows progress until it is completed or dismissed.
- All transactional emails (confirmation, password reset, email change, invitations, billing) share one branded layout with plain-text versions.
- Template users change branding (name, logo, colors, sender) in one place.

**Features (rough)**
- First-run onboarding flow
- Onboarding checklist
- Branded email templates for all transactional emails

**Depends on:** 2 (invitations), 3 (billing emails).

### 5. Platform admin console (#6)
**Goal:** Platform staff can find and support any user or organization without touching the database.
**Success criteria**
- A platform admin role that normal users can never get by themselves.
- Admins search users and orgs and see their details: email status, orgs, members, plan, subscription status.
- Support actions: disable/enable a user, resend confirmation, and end a user's sessions.
- Every admin action is recorded.

**Features (rough)**
- Platform admin role and access
- Users and organizations: search and details
- Support actions

**Depends on:** 2, 3.

### 6. Audit log (#7)
**Goal:** Org admins and platform admins can see who did what and when.
**Success criteria**
- Security and org events are recorded: sign-in, password/email changes, invitations, role changes, member removal, billing changes, admin actions.
- Org owners and admins see their org's audit log, filtered by person, event type and date. Members can't see it.
- Platform admins see platform-level events, including their own support actions.
- Entries can't be edited or deleted from the app and are kept for a defined period.

**Features (rough)**
- Record audit events
- Organization audit log view
- Platform audit log view

**Depends on:** 2, 5.

### 7. Privacy & data (GDPR) (#8)
**Goal:** Users and organizations control their data: they can take it with them and have it deleted.
**Success criteria**
- A user can export their personal data in a readable format.
- A user can delete their account. Owners must transfer ownership or delete their orgs first.
- An owner can delete their organization: the subscription is cancelled and the data is removed after a short grace period.
- Deletions are confirmed by email and audited.

**Features (rough)**
- Export my data
- Delete my account
- Delete organization

**Depends on:** 2, 3, 6.

## Later (after v1)

- Two-factor authentication (TOTP, recovery codes) and passkeys
- SSO / SAML and SCIM for enterprise orgs
- API keys and outgoing webhooks for customers
- Feature flags (per plan / per org)
- In-app notifications and notification preferences
- Usage-based / per-seat billing, annual plans, coupons
- Custom roles and permissions
- Admin impersonation ("view as user"), audit log export
- Internationalization (i18n)
- PR preview environments
