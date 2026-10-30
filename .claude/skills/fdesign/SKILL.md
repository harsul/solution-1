---
name: fdesign
description: Designer skill. Writes or updates the design section of a feature (flows, screen states, components, exact copy, accessibility) or the design system in docs/design/system.md, or reviews implemented UI from screenshots.
argument-hint: "[F<n> | system | review F<n>]"
disable-model-invocation: true
---

# Design (Designer)

Input: $ARGUMENTS

Start the **designer** agent (`.claude/agents/designer.md`) with the request:
- `F<n>` → design section for that feature (the plan must be `plan:approved`);
- `system` → create or refresh `docs/design/system.md` from the current UI and theme;
- `review F<n>` → UI review of the current changes from screenshots.

Ask the stakeholder the agent's open design questions with AskUserQuestion, pass the answers back to the agent so it updates its section, then show a short summary (screens, notable decisions) or the review findings. For `system`, commit the file on `main` if the stakeholder agrees (docs-only).
