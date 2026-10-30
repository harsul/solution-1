---
name: frename
description: Rename the project after setup. Renames the code base (solution, project folders and files, namespaces, Projects.<Name>_Server, docs and workflow commands) with .claude/scripts/rename.sh, rebuilds and tests, and commits on a branch; optionally also the name users see (brand.ts, Branding.cs, page title).
argument-hint: "<NewName> [\"Display name\"]"
disable-model-invocation: true
---

# Rename the project

Input: $ARGUMENTS

There are two names; ask which ones change if the input doesn't say:
- **Code name** – `AspireApp1.Server`, `Solution1.slnx`, namespaces. PascalCase letters and digits, no dots or spaces (e.g. `BookingHub`).
- **Display name** – what users see: app bar, page title, emails, email sender. Free text (e.g. "Booking Hub").

## 1. Prepare
- Working tree clean (`git status`); otherwise ask to commit or stash first.
- Branch `chore/rename-<new-name-kebab>` from an up-to-date `main`.
- Tell the stakeholder in two lines what happens: folders, files and namespaces move; the local Aspire Postgres starts empty once (its volume is named after the AppHost; migrations recreate the schema, the old volume stays until removed); the IDE must reopen the new `.slnx`.

## 2. Code name
Run `.claude/scripts/rename.sh <NewName>`. Then check `git status` shows renames, not deletions plus additions, and that `git grep -n "<OldName>"` finds nothing outside `docs/plans` and `docs/specs` (the F1–F5 archive keeps its wording).

## 3. Display name (if it changes)
- `src/frontend/src/brand.ts` → `name` (and `tagline` if asked);
- `src/<NewName>.Server/Branding.cs` → `ProductName`;
- `src/frontend/index.html` → `<title>`;
- `docs/product.md` → Identity, plus a line in its Decisions log.

## 4. Verify and commit
`fverify` (format, build, all tests, frontend) must pass – fix only what the rename broke. Then `/fcommit auto` with `refactor: rename the project to <NewName>` (and `chore(brand): …` for the display name as its own commit). Don't push or merge; tell the stakeholder:
- merge the branch, then reopen `<NewName>.slnx`;
- optionally rename the GitHub repository (Settings → General) and the local folder – both are independent of the code;
- in cloud environments, nothing to change (paths come from the repo).
