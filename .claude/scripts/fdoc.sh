#!/usr/bin/env bash
# fdoc.sh – the only way the workflow reads and writes GitHub Issues (via the gh CLI).
#
# Model (see CLAUDE.md → Team workflow):
#   roadmap issue  title "Roadmap",                label type:roadmap, pinned; body = vision, customers, epic order
#   epic issue     title "Epic: <name>",        label type:epic,    body = goal, success criteria, planned features
#                  its features are GitHub sub-issues (link / children)
#   feature issue  title "<ID> – <title>",      label type:feature, body = the plan (product owner)
#                  <ID> = ID_PREFIX + number from .claude/workflow.conf, e.g. F6 or ENG-1
#   bug issue      label type:bug (from the bug template); fixed with /ffix, sections fix and review-p1
#   sections       one comment per section, first line "<!-- fdoc:<section> -->"
#                  (spec, design, ops, review-p<k>, summary); updated in place, never duplicated
#   status labels  plan:<draft|questions|approved|done>, spec:<draft|questions|approved|in-progress|done>
#
# Usage:
#   fdoc.sh check                         gh installed, signed in, repo detected
#   fdoc.sh config [KEY]                  validated workflow settings from .claude/workflow.conf (all, or one value)
#   fdoc.sh init-labels                   create/refresh the workflow labels (idempotent)
#   fdoc.sh next-id                       next free ticket ID, e.g. F6 or ENG-1 (issues + legacy docs/plans)
#   fdoc.sh find <ID>                     issue number of the feature with that ID (exit 1 if none)
#   fdoc.sh new feature|epic|bug "<title>" <body-file>   create an issue, print its number
#   fdoc.sh roadmap                       print the roadmap issue body (exit 1 if there is none)
#   fdoc.sh set-roadmap <file>            create (and pin) or update the roadmap issue, print its number
#   fdoc.sh link <epic> <feature>         make the feature issue a sub-issue of the epic (idempotent)
#   fdoc.sh children <epic>               list the sub-issues: "#<n> <state> <title>"
#   fdoc.sh body <issue>                  print the issue body
#   fdoc.sh set-body <issue> <file>       replace the issue body
#   fdoc.sh get <issue> <section>         print a section comment without its marker (exit 1 if none)
#   fdoc.sh set <issue> <section> <file>  create or update a section comment
#   fdoc.sh comment <issue> <file>        add a plain comment (questions to the user, notes)
#   fdoc.sh comments <issue>              print all comments (author, date, body) to read answers
#   fdoc.sh status <issue> plan|spec <value>   set the status label, removing the other values
#   fdoc.sh labels <issue>                print the issue's labels, one per line
set -euo pipefail

die() { echo "fdoc: $*" >&2; exit 1; }
need_file() { [[ -f "$1" ]] || die "file not found: $1"; }

# Workflow settings from .claude/workflow.conf, with defaults.
ID_PREFIX=F; ID_START=1; GATES=plan+spec; REVIEW=risk; AUTO_MERGE=off; MAX_PHASES=3; BASE_BRANCH=main; COST=balanced
config_keys=(ID_PREFIX ID_START GATES REVIEW AUTO_MERGE MAX_PHASES BASE_BRANCH COST)
conf="$(git rev-parse --show-toplevel 2>/dev/null)/.claude/workflow.conf"
if [[ -f "$conf" ]]; then  # read, never execute: KEY=value, # comments allowed
  while IFS='=' read -r key value; do
    value="$(printf '%s' "${value%%#*}" | tr -d '\r' | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
    case "$key" in
      ID_PREFIX) ID_PREFIX="$value" ;; ID_START) ID_START="$value" ;; GATES) GATES="$value" ;;
      REVIEW) REVIEW="$value" ;; AUTO_MERGE) AUTO_MERGE="$value" ;; MAX_PHASES) MAX_PHASES="$value" ;;
      BASE_BRANCH) BASE_BRANCH="$value" ;; COST) COST="$value" ;;
      *) echo "fdoc: unknown setting $key in .claude/workflow.conf (ignored)" >&2 ;;
    esac
  done < <(grep -E '^[A-Z_]+=' "$conf")
fi
[[ "$ID_PREFIX" =~ ^[A-Za-z]+-?$ ]] || die "ID_PREFIX in .claude/workflow.conf must be letters, optionally followed by '-' (e.g. F or ENG-)"
[[ "$ID_START" =~ ^[0-9]+$ ]] || die "ID_START in .claude/workflow.conf must be a number"
[[ "$GATES" =~ ^(plan\+spec|spec|none)$ ]] || die "GATES must be plan+spec, spec or none (is: $GATES)"
[[ "$REVIEW" =~ ^(risk|every-phase|end-only)$ ]] || die "REVIEW must be risk, every-phase or end-only (is: $REVIEW)"
[[ "$AUTO_MERGE" =~ ^(on|off)$ ]] || die "AUTO_MERGE must be on or off (is: $AUTO_MERGE)"
[[ "$MAX_PHASES" =~ ^[1-5]$ ]] || die "MAX_PHASES must be 1 to 5 (is: $MAX_PHASES)"
[[ "$BASE_BRANCH" =~ ^[A-Za-z0-9._/-]+$ ]] || die "BASE_BRANCH is not a valid branch name (is: $BASE_BRANCH)"
[[ "$COST" =~ ^(economy|balanced|max)$ ]] || die "COST must be economy, balanced or max (is: $COST)"

plan_values=(draft questions approved done)
spec_values=(draft questions approved in-progress done)

marker() { printf '<!-- fdoc:%s -->' "$1"; }

section_comment_id() { # <issue> <section>
  gh api "repos/{owner}/{repo}/issues/$1/comments" --paginate \
    --jq ".[] | select(.body | startswith(\"$(marker "$2")\")) | .id" | head -n1
}

with_marker() { # <section> <file> → temp file path
  local tmp; tmp="$(mktemp)"
  { marker "$1"; printf '\n\n'; cat "$2"; } > "$tmp"
  echo "$tmp"
}

cmd="${1:-}"; shift || true
case "$cmd" in
  config)
    if [[ -n "${1:-}" ]]; then
      [[ " ${config_keys[*]} " == *" $1 "* ]] || die "unknown setting: $1 (${config_keys[*]})"
      echo "${!1}"
    else
      for k in "${config_keys[@]}"; do echo "$k=${!k}"; done
    fi
    ;;
  check)
    command -v gh >/dev/null || die "gh CLI not installed (https://cli.github.com)"
    gh auth status >/dev/null 2>&1 || die "gh is not signed in: run 'gh auth login'"
    gh repo view --json nameWithOwner --jq .nameWithOwner
    ;;
  init-labels)
    gh label create type:epic --color 5319e7 --description "Roadmap epic" --force
    gh label create type:feature --color 1d76db --description "Feature F<n>" --force
    gh label create type:bug --color d73a4a --description "Something is broken" --force
    gh label create type:roadmap --color 0e8a16 --description "Product roadmap (pinned)" --force
    for v in "${plan_values[@]}"; do gh label create "plan:$v" --color c5def5 --description "Plan status" --force; done
    for v in "${spec_values[@]}"; do gh label create "spec:$v" --color bfdadc --description "Spec status" --force; done
    gh label create needs-answer --color d93f0b --description "Waiting for an answer from the stakeholder" --force
    ;;
  next-id)
    max=$((ID_START - 1))
    while read -r n; do (( 10#$n > max )) && max=$((10#$n)); done < <(
      { gh issue list --state all --label type:feature --limit 1000 --json title --jq '.[].title' 2>/dev/null || true
        [[ "$ID_PREFIX" == F ]] && ls docs/plans 2>/dev/null || true; } | sed -nE "s/^${ID_PREFIX}([0-9]+)([^0-9].*)?$/\1/p")
    echo "${ID_PREFIX}$((max + 1))"
    ;;
  find)
    [[ "${1:-}" =~ ^${ID_PREFIX}[0-9]+$ ]] || die "usage: find ${ID_PREFIX}<number> (prefix from .claude/workflow.conf)"
    n="$(gh issue list --state all --label type:feature --limit 1000 --json number,title \
      --jq ".[] | select(.title | test(\"^$1[^0-9]\")) | .number" | head -n1)"
    [[ -n "$n" ]] || die "no feature issue for $1"
    echo "$n"
    ;;
  new)
    [[ "${1:-}" =~ ^(feature|epic|bug)$ ]] || die "usage: new feature|epic|bug <title> <body-file>"
    need_file "${3:-}"
    url="$(gh issue create --title "$2" --body-file "$3" --label "type:$1")"
    echo "${url##*/}"
    ;;
  link)
    [[ -n "${1:-}" && -n "${2:-}" ]] || die "usage: link <epic> <feature>"
    # The API wants the feature's internal id, not its number.
    id="$(gh api "repos/{owner}/{repo}/issues/$2" --jq .id)"
    if gh api "repos/{owner}/{repo}/issues/$1/sub_issues" --paginate --jq '.[].number' | grep -qx "$2"; then
      echo "#$2 is already a sub-issue of #$1"
    else
      gh api -X POST "repos/{owner}/{repo}/issues/$1/sub_issues" -F "sub_issue_id=$id" >/dev/null
      echo "linked #$2 to #$1"
    fi
    ;;
  children)
    gh api "repos/{owner}/{repo}/issues/$1/sub_issues" --paginate --jq '.[] | "#\(.number) \(.state) \(.title)"'
    ;;
  roadmap)
    n="$(gh issue list --state open --label type:roadmap --limit 1 --json number --jq '.[0].number // empty')"
    [[ -n "$n" ]] || die "no roadmap issue yet (run /froadmap)"
    gh issue view "$n" --json body --jq .body
    ;;
  set-roadmap)
    need_file "${1:-}"
    n="$(gh issue list --state open --label type:roadmap --limit 1 --json number --jq '.[0].number // empty')"
    if [[ -n "$n" ]]; then
      gh issue edit "$n" --body-file "$1" >/dev/null
    else
      url="$(gh issue create --title "Roadmap" --body-file "$1" --label type:roadmap)"
      n="${url##*/}"
      gh issue pin "$n" >/dev/null || echo "fdoc: couldn't pin #$n; pin it on GitHub" >&2
    fi
    echo "$n"
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
    tmp="$(with_marker "$2" "$3")"
    id="$(section_comment_id "$1" "$2")"
    if [[ -n "$id" ]]; then
      gh api -X PATCH "repos/{owner}/{repo}/issues/comments/$id" -F "body=@$tmp" --jq .html_url
    else
      gh issue comment "$1" --body-file "$tmp"
    fi
    rm -f "$tmp"
    ;;
  comment)   need_file "${2:-}"; gh issue comment "$1" --body-file "$2" ;;
  comments)
    gh api "repos/{owner}/{repo}/issues/$1/comments" --paginate \
      --jq '.[] | "--- \(.user.login) \(.created_at)\n\(.body)\n"'
    ;;
  status)
    kind="${2:-}"; value="${3:-}"
    case "$kind" in
      plan) values=("${plan_values[@]}") ;;
      spec) values=("${spec_values[@]}") ;;
      *) die "usage: status <issue> plan|spec <value>" ;;
    esac
    [[ " ${values[*]} " == *" $value "* ]] || die "unknown $kind status: $value (${values[*]})"
    args=()
    for v in "${values[@]}"; do [[ "$v" != "$value" ]] && args+=(--remove-label "$kind:$v"); done
    gh issue edit "$1" --add-label "$kind:$value" "${args[@]}" >/dev/null
    ;;
  labels)    gh issue view "$1" --json labels --jq '.labels[].name' ;;
  *) sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
