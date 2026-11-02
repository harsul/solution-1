#!/usr/bin/env bash
# SubagentStop: the deterministic steps after a role finishes – no tokens unless something fails.
#   developer  → gate (format, build, unit tests, lint, size); red → back to the developer; green → commit
#   qa         → verdict pass → commit tests + QA notes, ship (rebase, push, PR, auto-merge); fail → commit, stop
#   architect  → validate the plan of the epic(s) it changed; invalid → back to the architect; valid → publish
# An agent that sets its task to "blocked" (with a reason) may always stop: it is handing back a question.
set -uo pipefail
. "$(dirname "$0")/lib.sh"

mapfile -t f < <(hook_fields agent_type cwd stop_hook_active)
agent="${f[0]}"; cwd="$(to_unix "${f[1]}")"; again="${f[2]}"
cd "$cwd" 2>/dev/null && cd "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || exit 0
common="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" || exit 0
locks="$common/work/locks"
coauthor="Co-Authored-By: Claude <noreply@anthropic.com>"

task_id() { git branch --show-current | sed -nE 's#^(feature|fix|ops)/([A-Za-z]+[0-9]+)-.*#\2#p'; }

# Give up after three red rounds in a row: the task goes to blocked and the lead decides.
attempts() { # <ID> inc|reset → prints the count
  local c="$locks/$1/gate-attempts"; mkdir -p "$locks/$1"
  if [[ "$2" == reset ]]; then rm -f "$c"; echo 0; return; fi
  local n=$(( $(cat "$c" 2>/dev/null || echo 0) + 1 )); echo "$n" > "$c"; echo "$n"
}

commit_all() { # <subject> <ID>: commit everything in the worktree (no-op when clean)
  git add -A
  git diff --cached --quiet && return 0
  git commit --quiet -m "$1" -m "Refs: $2" -m "$coauthor"
}

developer() {
  local id file status title type out n kind
  id="$(task_id)"; [[ -n "$id" ]] || exit 0            # not on a task branch: nothing to do
  file="$(work file "$id" 2>/dev/null)" || exit 0
  status="$(work.fm "$file" status)"
  [[ "$status" == blocked ]] && exit 0
  [[ -d "$(git rev-parse --git-dir)/rebase-merge" || -d "$(git rev-parse --git-dir)/rebase-apply" ]] \
    && block "A rebase is still in progress: resolve the conflicts (keep both sides' intent), git rebase --continue, then finish."
  # Nothing changed since the base: let it stop (it reports why).
  [[ -z "$(git status --porcelain)" && -z "$(git log --oneline "origin/$(work config BASE_BRANCH)..HEAD" 2>/dev/null)" ]] && exit 0

  if ! out="$(work gate 2>&1)"; then
    n="$(attempts "$id" inc)"
    if (( n >= 3 )); then
      work status "$id" blocked "gate still red after $n rounds" > /dev/null
      exit 0
    fi
    block "$(printf 'The task gate is red (round %s of 3) – fix it, then finish again. Logs: %s/work/logs/\n%s\n\nIf you cannot fix it (or the task is too big / needs an infra change / has an open question): work.sh status %s blocked "<reason>", then finish.' "$n" "$common" "$out" "$id")"
  fi
  attempts "$id" reset > /dev/null
  title="$(work.fm "$file" title)"; type="$(work.fm "$file" type)"
  kind=feat; [[ "$type" == bug ]] && kind=fix; [[ "$type" == ops ]] && kind=ci
  if [[ "$status" == done ]]; then                      # QA passed before: a conflict or pipeline fix → ship again
    commit_all "fix($id): rebase and pipeline fixes" "$id"
    work ship > "$locks/$id/ship.log" 2>&1 || true
    exit 0
  fi
  [[ -n "$(git log --oneline "origin/$(work config BASE_BRANCH)..HEAD" 2>/dev/null)" ]] && title="rework after QA"
  work status "$id" review > /dev/null
  commit_all "$kind($id): $title" "$id"
}

qa() {
  local id file verdict product
  id="$(task_id)"; [[ -n "$id" ]] || exit 0
  file="$(work file "$id" 2>/dev/null)" || exit 0
  verdict="$(work.fm "$file" qa)"
  if [[ "$verdict" != pass && "$verdict" != fail ]]; then
    [[ "$again" == true ]] && exit 0
    block "Record your verdict before finishing: the '## QA' section in $file, then 'work.sh set $id qa pass' or 'work.sh set $id qa fail'."
  fi
  product="$(git status --porcelain | awk '{print $NF}' | grep -vE '^(tests/|docs/work/)|\.test\.tsx?$|src/frontend/src/test/' || true)"
  [[ -z "$product" ]] || block "QA commits tests only. Revert these product-code changes and report them as defects instead: $product"
  if [[ "$verdict" == fail ]]; then
    work status "$id" in-progress > /dev/null
    commit_all "test($id): QA findings" "$id"
    exit 0                                               # the lead resumes the developer with the findings
  fi
  work status "$id" done > /dev/null                    # lands on the base branch with the merge
  commit_all "test($id): QA pass" "$id"
  # A failed ship (rebase conflicts) keeps the task done: work.sh ship records the conflicts in the lock
  # (board shows them), the lead resumes the developer, and its hook ships again once the rebase is resolved.
  work ship > "$locks/$id/ship.log" 2>&1 || true
  exit 0
}

architect() {
  local e rc out errors=""
  for e in $(git status --porcelain -uall -- docs/work | sed -nE 's#.*docs/work/(E[0-9]+)-[^/]*/.*#\1#p' | sort -u); do
    out="$(work check-plan "$e" 2>&1)"; rc=$?
    case $rc in
      0) [[ "$(work config GATES)" == *tasks* ]] && continue   # the stakeholder approves the task list first
         work publish-plan "$e" > "$common/work/publish-$e.log" 2>&1 || errors+="publishing $e failed: $(tail -5 "$common/work/publish-$e.log")"$'\n' ;;
      3) ;;                                                     # open questions: the lead asks the stakeholder
      *) errors+="$out"$'\n' ;;
    esac
  done
  [[ -z "$errors" || "$again" == true ]] && exit 0
  block "$(printf 'The plan is not valid yet – fix the task files, then finish again:\n%s' "$errors")"
}

# Front-matter field reader (the same as fm in work.sh).
work.fm() { awk -v k="$2" 'NR==1 && $0=="---" {f=1; next} f && $0=="---" {exit}
  f && index($0, k":")==1 {v=substr($0, length(k)+2); sub(/^[ \t]+/, "", v); sub(/[ \t]+#.*$/, "", v); print v; exit}' "$1"; }

case "$agent" in
  developer|cloudops) developer ;;
  qa) qa ;;
  architect) architect ;;
esac
exit 0
