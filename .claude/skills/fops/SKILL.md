---
name: fops
description: CloudOps skill for Azure Container Apps. Writes the ops section of a feature, or works on delivery itself (CI/CD workflows, Aspire publish/azd, environments, secrets, migrations, monitoring) and documents the steps the stakeholder must run.
argument-hint: "[F<n> | ci | deploy | review | \"ops task\"]"
disable-model-invocation: true
---

# Operations (CloudOps)

Input: $ARGUMENTS

Start the **cloudops** agent (`.claude/agents/cloudops.md`) with the request:
- `F<n>` → `ops` section for that feature;
- `ci`, `deploy` or another ops task → work on a branch `ops/<name>` (create it from `main`); infra code and workflows, plus `docs/ops/`;
- `review` → ops review of the current changes.

Ask the stakeholder the agent's questions with AskUserQuestion and pass the answers back. Infra changes go through the normal review: start the **reviewer** agent on the diff, let **cloudops** fix the findings, verify (`fverify`), then `/fcommit`.

Finish with the **steps the stakeholder must do** (exact commands: Azure login, `azd` / `aspire` commands, GitHub environment secrets/variables, federated credential) – you can't create cloud resources or secrets from here.
