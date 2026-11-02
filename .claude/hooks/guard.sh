#!/usr/bin/env bash
# PreToolUse guard (Bash, Edit, Write, MultiEdit, NotebookEdit): the team's hard rules, free of tokens.
#  - nobody pushes to the base branch, force-pushes without lease, or merges a PR by hand
#  - each role edits only its own files; agents stay inside their own worktree
set -uo pipefail
. "$(dirname "$0")/lib.sh"

mapfile -t f < <(hook_fields tool_name agent_type cwd tool_input.command tool_input.file_path tool_input.notebook_path)
tool="${f[0]}"; agent="${f[1]}"; cwd="$(to_unix "${f[2]}")"; command="${f[3]}"; file="${f[4]:-${f[5]}}"
base="$(work config BASE_BRANCH 2>/dev/null || echo main)"

if [[ "$tool" == Bash ]]; then
  if [[ "$command" =~ git[[:space:]]+push(.*) ]]; then
    args="${BASH_REMATCH[1]}"; args="${args%%$'\n'*}"; args=" ${args%%[;&|]*} "   # only this command, not what follows it
    # An explicit target (main, HEAD:main, refs/heads/main), or – while on the base branch – a plain push
    # or one of the current branch (origin HEAD / origin @).
    explicit='[[:space:]:]'"(refs/heads/)?$base"'[[:space:]]'
    named='[[:space:]]origin[[:space:]]+[^[:space:]-]'
    current='[[:space:]](HEAD|@)[[:space:]]'
    branch="$(git -C "$cwd" branch --show-current 2>/dev/null)"
    if [[ "$args" =~ $explicit ]] || [[ "$branch" == "$base" && ( ! "$args" =~ $named || "$args" =~ $current ) ]]; then
      block "Pushing to $base is not allowed: everything reaches $base through a PR (work.sh ship / publish-plan)."
    fi
    [[ "$args" =~ ([[:space:]]--force[[:space:]]|[[:space:]]-f[[:space:]]) ]] \
      && block "Force pushes only with --force-with-lease, on your own task branch."
  fi
  [[ "$command" =~ gh[[:space:]]+pr[[:space:]]+merge && ! "$command" =~ --auto ]] \
    && block "PRs merge through auto-merge when the required checks pass (gh pr merge --auto), never by hand."
  exit 0
fi

# File edits: only for subagents (the main session is the stakeholder's own hands).
[[ -n "$agent" && -n "$file" ]] || exit 0
file="$(to_unix "$file")"
top="$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null)"; top="$(to_unix "${top:-$cwd}")"
shopt -s nocasematch
[[ "$file" == "$top"/* ]] || block "You may only edit files inside your checkout ($top), not $file."
rel="${file#"$top"/}"
shopt -u nocasematch

allowed() { local p; for p in "$@"; do [[ "$rel" == $p ]] && return 0; done; return 1; }
case "$agent" in
  developer)
    is_infra_path "$rel" && block "$rel is an infrastructure path: only CloudOps changes it (an ops task). Set your task to blocked with the reason (work.sh status <ID> blocked \"needs …\") and finish."
    allowed ".claude/*" "docs/product.md" && block "$rel belongs to the team setup / product owner, not to a task."
    ;;
  qa)
    allowed "tests/*" "*.test.ts" "*.test.tsx" "src/frontend/src/test/*" "docs/work/*" \
      || block "QA changes tests only. $rel is product code: report it as a defect in the task's QA section."
    ;;
  product-owner) allowed "docs/work/*" "docs/product.md" || block "The product owner writes epics (docs/work/) and docs/product.md only." ;;
  team-lead)     allowed "docs/work/*" || block "The team lead writes task files under docs/work/ only." ;;
  architect)     allowed "docs/work/*" "docs/architecture/*" "CLAUDE.md" || block "The architect writes task notes (docs/work/), ADRs (docs/architecture/) and CLAUDE.md only." ;;
  designer)      allowed "docs/work/*" "docs/design/*" || block "The designer writes UI notes (docs/work/) and docs/design/ only." ;;
  cloudops)
    is_infra_path "$rel" || allowed "docs/work/*" "docs/ops/*" \
      || block "CloudOps changes infrastructure paths only; $rel is application code (a developer task)."
    ;;
esac
exit 0
