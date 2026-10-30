#!/usr/bin/env bash
# fdoc.sh – the only way the team reads and writes GitHub Issues (via the gh CLI).
#
# Model (see CLAUDE.md → Team workflow):
#   epic   issue "Epic: <name>", label epic + epic:<draft|approved|planned>; body = the epic (product owner);
#          its tasks are GitHub sub-issues; the epic closes when all tasks are done
#   task   issue "<ID> – <title>", label task + priority P1|P2|P3; body = the task (team lead + architect),
#          incl. a line "**Blocked by:** #12, #15" (or "–"); label in-progress while a developer works on it;
#          label ops = infrastructure task (AppHost, infra, workflows), done by CloudOps only
#   bug    issue from the bug template, label bug; fixed with /ffix
#   sections  one comment per section, first line "<!-- fdoc:<name> -->" (qa, review, fix), updated in place
#   <ID>   ID_PREFIX + number from .claude/workflow.conf, e.g. F6 or ENG-1
#
# Usage:
#   fdoc.sh check                          gh installed, signed in, repo detected
#   fdoc.sh config [KEY]                   validated settings from .claude/workflow.conf (all, or one value)
#   fdoc.sh init-labels                    create/refresh the labels (idempotent)
#   fdoc.sh next-id                        next free task ID, e.g. F6 or ENG-1
#   fdoc.sh find <ID>                      issue number of the task with that ID (exit 1 if none)
#   fdoc.sh new epic|task|bug "<title>" <body-file>   create an issue, print its number
#   fdoc.sh link <epic> <task>             make the task a sub-issue of the epic (idempotent)
#   fdoc.sh children <epic>                the epic's tasks: "#<n> <state> <labels> <title>"
#   fdoc.sh ready <epic>                   open tasks nobody works on whose blockers are all closed,
#                                          best first: "<priority> #<n> <title>" (empty = nothing ready)
#   fdoc.sh blockers <issue>               "#<n> <state>" for each issue in its "Blocked by" line
#   fdoc.sh claim <issue> <who>            mark a task in progress (label + comment "Taken by <who>")
#   fdoc.sh release <issue> [reason]       give a task back (remove the label, comment the reason)
#   fdoc.sh epic-status <epic> draft|approved|planned   set the epic's status label
#   fdoc.sh body <issue> / set-body <issue> <file>      read / replace the issue body
#   fdoc.sh get <issue> <section>          a section comment without its marker (exit 1 if none)
#   fdoc.sh set <issue> <section> <file>   create or update a section comment
#   fdoc.sh comment <issue> <file>         add a plain comment (questions, notes)
#   fdoc.sh comments <issue>               all comments (author, date, body), e.g. to read answers
#   fdoc.sh labels <issue>                 the issue's labels, one per line
set -euo pipefail

die() { echo "fdoc: $*" >&2; exit 1; }
need_file() { [[ -f "$1" ]] || die "file not found: $1"; }

# ---- settings ------------------------------------------------------------------------------------
config_keys=(ID_PREFIX ID_START GATES DEVELOPERS EPIC_MAX_TASKS TASK_MAX_LINES BASE_BRANCH MERGE_METHOD AUTO_MERGE COST)
ID_PREFIX=F; ID_START=1; GATES=epic+tasks; DEVELOPERS=3; EPIC_MAX_TASKS=9; TASK_MAX_LINES=400
BASE_BRANCH=main; MERGE_METHOD=rebase; AUTO_MERGE=off; COST=balanced
conf="$(git rev-parse --show-toplevel 2>/dev/null)/.claude/workflow.conf"
if [[ -f "$conf" ]]; then  # read, never execute: KEY=value, # comments allowed
  while IFS='=' read -r key value; do
    value="$(printf '%s' "${value%%#*}" | tr -d '\r' | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
    if [[ " ${config_keys[*]} " == *" $key "* ]]; then printf -v "$key" '%s' "$value"
    else echo "fdoc: unknown setting $key in .claude/workflow.conf (ignored)" >&2; fi
  done < <(grep -E '^[A-Z_]+=' "$conf")
fi
check_setting() { [[ "$2" =~ $3 ]] || die "$1 in .claude/workflow.conf must be $4 (is: $2)"; }
check_setting ID_PREFIX "$ID_PREFIX" '^[A-Za-z]+-?$' "letters, optionally followed by '-' (e.g. F or ENG-)"
check_setting ID_START "$ID_START" '^[0-9]+$' "a number"
check_setting GATES "$GATES" '^(epic\+tasks|tasks|none)$' "epic+tasks, tasks or none"
check_setting DEVELOPERS "$DEVELOPERS" '^[1-5]$' "1 to 5"
check_setting EPIC_MAX_TASKS "$EPIC_MAX_TASKS" '^([1-9]|1[0-9]|20)$' "1 to 20"
check_setting TASK_MAX_LINES "$TASK_MAX_LINES" '^[1-9][0-9]{1,3}$' "10 to 9999"
check_setting BASE_BRANCH "$BASE_BRANCH" '^[A-Za-z0-9._/-]+$' "a branch name"
check_setting MERGE_METHOD "$MERGE_METHOD" '^(rebase|squash|merge)$' "rebase, squash or merge"
check_setting AUTO_MERGE "$AUTO_MERGE" '^(on|off)$' "on or off"
check_setting COST "$COST" '^(economy|balanced|max)$' "economy, balanced or max"

marker() { printf '<!-- fdoc:%s -->' "$1"; }
section_comment_id() { # <issue> <section>
  gh api "repos/{owner}/{repo}/issues/$1/comments" --paginate \
    --jq ".[] | select(.body | startswith(\"$(marker "$2")\")) | .id" | head -n1
}
blocker_numbers() { # issue body on stdin → blocking issue numbers, one per line
  grep -iE '^\**blocked by:?\**' | grep -oE '#[0-9]+' | tr -d '#' || true
}

cmd="${1:-}"; shift || true
case "$cmd" in
  check)
    command -v gh >/dev/null || die "gh CLI not installed (https://cli.github.com)"
    gh auth status >/dev/null 2>&1 || die "gh is not signed in: run 'gh auth login'"
    gh repo view --json nameWithOwner --jq .nameWithOwner
    ;;
  config)
    if [[ -n "${1:-}" ]]; then
      [[ " ${config_keys[*]} " == *" $1 "* ]] || die "unknown setting: $1 (${config_keys[*]})"
      echo "${!1}"
    else
      for k in "${config_keys[@]}"; do echo "$k=${!k}"; done
    fi
    ;;
  init-labels)
    gh label create epic --color 5319e7 --description "Epic: one day of the agent team" --force
    gh label create task --color 1d76db --description "Task <ID>, a sub-issue of an epic" --force
    gh label create bug --color d73a4a --description "Something is broken" --force
    for v in draft approved planned; do gh label create "epic:$v" --color c5def5 --description "Epic status" --force; done
    gh label create ops --color 0e8a16 --description "Infrastructure task: only CloudOps changes AppHost, infra, workflows" --force
    gh label create in-progress --color fbca04 --description "A developer is working on it" --force
    gh label create P1 --color b60205 --description "Priority: first" --force
    gh label create P2 --color d93f0b --description "Priority: normal" --force
    gh label create P3 --color fef2c0 --description "Priority: later" --force
    gh label create needs-answer --color e99695 --description "Waiting for an answer from the stakeholder" --force
    ;;
  next-id)
    max=$((ID_START - 1))
    while read -r n; do (( 10#$n > max )) && max=$((10#$n)); done < <(
      { gh issue list --state all --limit 1000 --json title --jq '.[].title' 2>/dev/null || true
        [[ "$ID_PREFIX" == F ]] && ls docs/plans 2>/dev/null || true; } | sed -nE "s/^${ID_PREFIX}([0-9]+)([^0-9].*)?$/\1/p")
    echo "${ID_PREFIX}$((max + 1))"
    ;;
  find)
    [[ "${1:-}" =~ ^${ID_PREFIX}[0-9]+$ ]] || die "usage: find ${ID_PREFIX}<number>"
    n="$(gh issue list --state all --limit 1000 --json number,title \
      --jq ".[] | select(.title | test(\"^$1[^0-9]\")) | .number" | head -n1)"
    [[ -n "$n" ]] || die "no issue for $1"
    echo "$n"
    ;;
  new)
    [[ "${1:-}" =~ ^(epic|task|bug)$ ]] || die "usage: new epic|task|bug <title> <body-file>"
    need_file "${3:-}"
    url="$(gh issue create --title "$2" --body-file "$3" --label "$1")"
    n="${url##*/}"
    [[ "$1" == epic ]] && gh issue edit "$n" --add-label epic:draft >/dev/null
    echo "$n"
    ;;
  link)
    [[ -n "${1:-}" && -n "${2:-}" ]] || die "usage: link <epic> <task>"
    id="$(gh api "repos/{owner}/{repo}/issues/$2" --jq .id)"  # the API wants the internal id
    if gh api "repos/{owner}/{repo}/issues/$1/sub_issues" --paginate --jq '.[].number' | grep -qx "$2"; then
      echo "#$2 is already a task of #$1"
    else
      gh api -X POST "repos/{owner}/{repo}/issues/$1/sub_issues" -F "sub_issue_id=$id" >/dev/null
      echo "linked #$2 to #$1"
    fi
    ;;
  children)
    gh api "repos/{owner}/{repo}/issues/$1/sub_issues" --paginate \
      --jq '.[] | "#\(.number) \(.state) [\([.labels[].name] | join(","))] \(.title)"'
    ;;
  blockers)
    while read -r b; do
      [[ -n "$b" ]] && echo "#$b $(gh api "repos/{owner}/{repo}/issues/$b" --jq .state)"
    done < <(gh issue view "$1" --json body --jq .body | blocker_numbers)
    ;;
  ready)
    declare -A state=()
    is_closed() { [[ -n "${state[$1]:-}" ]] || state[$1]="$(gh api "repos/{owner}/{repo}/issues/$1" --jq .state)"; [[ "${state[$1]}" == closed ]]; }
    while IFS=$'\t' read -r num prio title body64; do
      ok=1
      while read -r b; do [[ -z "$b" ]] || is_closed "$b" || { ok=0; break; }; done < <(printf '%s' "$body64" | base64 -d | blocker_numbers)
      (( ok )) && printf '%s #%s %s\n' "$prio" "$num" "$title"
    done < <(gh api "repos/{owner}/{repo}/issues/$1/sub_issues" --paginate --jq '.[]
        | select(.state == "open")
        | select([.labels[].name] | index("task"))
        | select([.labels[].name] | index("in-progress") | not)
        | [(.number | tostring), ([.labels[].name | select(test("^P[1-3]$"))] | first // "P3"), .title, ((.body // "") | @base64)]
        | @tsv') | sort -k1,1 -k2.2n
    ;;
  claim)
    [[ -n "${1:-}" && -n "${2:-}" ]] || die "usage: claim <issue> <who>"
    if gh issue view "$1" --json labels --jq '.labels[].name' | grep -qx in-progress; then die "#$1 is already in progress"; fi
    gh issue edit "$1" --add-label in-progress >/dev/null
    tmp="$(mktemp)"; printf 'Taken by **%s**.\n' "$2" > "$tmp"; gh issue comment "$1" --body-file "$tmp" >/dev/null; rm -f "$tmp"
    echo "#$1 taken by $2"
    ;;
  release)
    [[ -n "${1:-}" ]] || die "usage: release <issue> [reason]"
    gh issue edit "$1" --remove-label in-progress >/dev/null
    tmp="$(mktemp)"; printf 'Released%s.\n' "${2:+: $2}" > "$tmp"; gh issue comment "$1" --body-file "$tmp" >/dev/null; rm -f "$tmp"
    echo "#$1 released"
    ;;
  epic-status)
    [[ "${2:-}" =~ ^(draft|approved|planned)$ ]] || die "usage: epic-status <epic> draft|approved|planned"
    args=(); for v in draft approved planned; do [[ "$v" != "$2" ]] && args+=(--remove-label "epic:$v"); done
    gh issue edit "$1" --add-label "epic:$2" "${args[@]}" >/dev/null
    ;;
  body)      gh issue view "$1" --json body --jq .body ;;
  set-body)  need_file "${2:-}"; gh issue edit "$1" --body-file "$2" >/dev/null ;;
  get)
    id="$(section_comment_id "$1" "$2")"
    [[ -n "$id" ]] || die "no '$2' section on issue #$1"
    gh api "repos/{owner}/{repo}/issues/comments/$id" --jq .body | tail -n +3
    ;;
  set)
    need_file "${3:-}"
    tmp="$(mktemp)"; { marker "$2"; printf '\n\n'; cat "$3"; } > "$tmp"
    id="$(section_comment_id "$1" "$2")"
    if [[ -n "$id" ]]; then gh api -X PATCH "repos/{owner}/{repo}/issues/comments/$id" -F "body=@$tmp" --jq .html_url
    else gh issue comment "$1" --body-file "$tmp"; fi
    rm -f "$tmp"
    ;;
  comment)   need_file "${2:-}"; gh issue comment "$1" --body-file "$2" ;;
  comments)
    gh api "repos/{owner}/{repo}/issues/$1/comments" --paginate --jq '.[] | "--- \(.user.login) \(.created_at)\n\(.body)\n"'
    ;;
  labels)    gh issue view "$1" --json labels --jq '.labels[].name' ;;
  *) sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
