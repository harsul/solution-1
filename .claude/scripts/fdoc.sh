#!/usr/bin/env bash
# fdoc.sh – the only way the workflow reads and writes GitHub Issues (via the gh CLI).
#
# Model (see CLAUDE.md → Feature workflow):
#   epic issue     title "Epic: <name>",        label type:epic,    body = epic goal + feature checklist
#   feature issue  title "F<n> – <title>",      label type:feature, body = the plan (product owner)
#   sections       one comment per section, first line "<!-- fdoc:<section> -->"
#                  (spec, design, ops, review-p<k>, summary); updated in place, never duplicated
#   status labels  plan:<draft|questions|approved|done>, spec:<draft|questions|approved|in-progress|done>
#
# Usage:
#   fdoc.sh check                         gh installed, signed in, repo detected
#   fdoc.sh init-labels                   create/refresh the workflow labels (idempotent)
#   fdoc.sh next-id                       next free F<n> number (issues + legacy docs/plans)
#   fdoc.sh find F<n>                     issue number of feature F<n> (exit 1 if none)
#   fdoc.sh new feature|epic "<title>" <body-file>   create an issue, print its number
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
  check)
    command -v gh >/dev/null || die "gh CLI not installed (https://cli.github.com)"
    gh auth status >/dev/null 2>&1 || die "gh is not signed in: run 'gh auth login'"
    gh repo view --json nameWithOwner --jq .nameWithOwner
    ;;
  init-labels)
    gh label create type:epic --color 5319e7 --description "Roadmap epic" --force
    gh label create type:feature --color 1d76db --description "Feature F<n>" --force
    for v in "${plan_values[@]}"; do gh label create "plan:$v" --color c5def5 --description "Plan status" --force; done
    for v in "${spec_values[@]}"; do gh label create "spec:$v" --color bfdadc --description "Spec status" --force; done
    gh label create needs-answer --color d93f0b --description "Waiting for an answer from the stakeholder" --force
    ;;
  next-id)
    max=0
    while read -r n; do (( n > max )) && max=$n; done < <(
      { gh issue list --state all --label type:feature --limit 1000 --json title --jq '.[].title' 2>/dev/null || true
        ls docs/plans 2>/dev/null || true; } | sed -nE 's/^F([0-9]+)[^0-9].*/\1/p')
    echo $((max + 1))
    ;;
  find)
    [[ "${1:-}" =~ ^F[0-9]+$ ]] || die "usage: find F<n>"
    n="$(gh issue list --state all --label type:feature --limit 1000 --json number,title \
      --jq ".[] | select(.title | test(\"^$1[^0-9]\")) | .number" | head -n1)"
    [[ -n "$n" ]] || die "no feature issue for $1"
    echo "$n"
    ;;
  new)
    [[ "${1:-}" == feature || "${1:-}" == epic ]] || die "usage: new feature|epic <title> <body-file>"
    need_file "${3:-}"
    url="$(gh issue create --title "$2" --body-file "$3" --label "type:$1")"
    echo "${url##*/}"
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
