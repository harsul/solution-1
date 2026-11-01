#!/usr/bin/env bash
# work.sh – the team's work tracking in markdown files, plus the git/GitHub steps the hooks run.
#
# Files (in git, under docs/work/):
#   E<n>-<slug>/epic.md        epic: front matter (id, title, status, priority, created) + Goal, Scope, Success criteria, Questions
#   E<n>-<slug>/<ID>-<slug>.md task: front matter (see below) + Goal, Acceptance criteria, Technical/UI/Ops notes, QA
#   bugs/<ID>-<slug>.md        bug: a task with type: bug and epic: -
#
#   Task front matter:  id: F20 · title: … · epic: E1 · type: task|ops|bug · status: todo|in-progress|review|blocked|done
#                       priority: P1|P2|P3 · size: S|M · blocked_by: F18, F19 (or -) · qa: -|pass|fail
#   Epic statuses:      draft → approved → planned → done
#
# Status lives in the files and travels with the task's own branch and PR ("done" lands on the base branch
# when the PR merges). Claims are local locks in the shared git directory, so every worktree sees them at once.
#
# Usage:
#   work.sh config [KEY]          settings from .claude/workflow.conf (all, or one value)
#   work.sh next-id | next-epic   next free task ID (e.g. F20) / epic ID (e.g. E1)
#   work.sh board [E<n>] [--brief] tasks with status, priority, blockers, claim and PR
#   work.sh ready [E<n>]          open, unclaimed tasks whose blockers are done – best first
#   work.sh file <ID>             path of the task file in this checkout
#   work.sh claim <ID> <owner> | release <ID>
#   work.sh start <ID>            in a developer worktree: branch from the latest base branch, status in-progress
#   work.sh status <ID> <status> [reason]   set the status (blocked needs a reason)
#   work.sh set <ID> <key> <value>          set any front-matter field (e.g. qa pass)
#   work.sh check-plan <E<n>>     validate an epic's task files
#   work.sh publish-plan <E<n>>   commit the epic folder on plan/<E>, push, PR with auto-merge
#   work.sh gate                  format, build, unit tests (xUnit + Vitest), lint, frontend build, size
#   work.sh scan                  integration tests, vulnerable packages, secret scan
#   work.sh ship                  rebase on the base branch, push, PR, auto-merge
#   work.sh sync                  main checkout: base branch, pull, clean merged branches, locks and worktrees
set -euo pipefail

die() { echo "work: $*" >&2; exit 1; }

root="$(git rev-parse --show-toplevel 2>/dev/null)" || die "not in a git repository"
cd "$root"
common="$(git rev-parse --path-format=absolute --git-common-dir)"
main_root="$(dirname "$common")"            # the main checkout (worktrees share its .git)
locks="$common/work/locks"
work_dir=docs/work

# ---- settings ------------------------------------------------------------------------------------
ID_PREFIX=F; ID_START=1; GATES=epic; DEVELOPERS=2; EPIC_MAX_TASKS=9; TASK_MAX_LINES=400
BASE_BRANCH=main; MERGE_METHOD=squash; AUTO_MERGE=on; COST=balanced; CUTOFF=off
config_keys=(ID_PREFIX ID_START GATES DEVELOPERS EPIC_MAX_TASKS TASK_MAX_LINES BASE_BRANCH MERGE_METHOD AUTO_MERGE COST CUTOFF)
if [[ -f .claude/workflow.conf ]]; then  # read, never execute: KEY=value, # comments allowed
  while IFS='=' read -r key value; do
    key="${key//[[:space:]]/}"; value="${value%%#*}"; value="${value//[[:space:]]/}"
    for k in "${config_keys[@]}"; do [[ "$key" == "$k" ]] && printf -v "$k" '%s' "$value"; done
  done < .claude/workflow.conf
fi

# ---- front matter --------------------------------------------------------------------------------
fm() { # <file> <key>: value of a front-matter field ("" if missing)
  awk -v k="$2" 'NR==1 && $0=="---" {f=1; next} f && $0=="---" {exit}
    f && index($0, k":")==1 {v=substr($0, length(k)+2); sub(/^[ \t]+/, "", v); sub(/[ \t]+#.*$/, "", v); print v; exit}' "$1"
}
fm_set() { # <file> <key> <value>: set (or add) a front-matter field
  local tmp; tmp="$(mktemp)"
  awk -v k="$2" -v v="$3" 'NR==1 && $0=="---" {f=1; print; next}
    f && $0=="---" {if (!done) print k": "v; f=0; print; next}
    f && index($0, k":")==1 {print k": "v; done=1; next} {print}' "$1" > "$tmp"
  cat "$tmp" > "$1"; rm -f "$tmp"
}
slug() { echo "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g' | cut -c1-40 | sed -E 's/-+$//'; }

task_file() { # <ID>: task file in this checkout
  local f; f="$(find "$work_dir" -name "$1-*.md" -not -name epic.md 2>/dev/null | head -1)"
  [[ -n "$f" ]] || die "no task file for $1 under $work_dir (is the plan merged? git fetch, work.sh sync)"
  echo "$f"
}
epic_dir() { # <E<n>>
  local d; d="$(find "$work_dir" -maxdepth 1 -type d -name "$1-*" 2>/dev/null | head -1)"
  [[ -n "$d" ]] || die "no epic folder $work_dir/$1-*"
  echo "$d"
}

# Task files as on the base branch: what's planned, and "done" once a task's PR merged.
base_ref() { git rev-parse --verify -q "origin/$BASE_BRANCH" >/dev/null && echo "origin/$BASE_BRANCH" || echo HEAD; }
base_tasks() { # [E<n>]: paths of task files on the base branch
  { git ls-tree -r --name-only "$(base_ref)" -- "$work_dir" 2>/dev/null || true; } \
    | { grep -E "/${ID_PREFIX}[0-9]+-[^/]*\.md$" || true; } \
    | { if [[ -n "${1:-}" ]]; then grep "/$1-" || true; else cat; fi; }
}
base_fm() { git show "$(base_ref):$1" 2>/dev/null > "$tmp_fm" && fm "$tmp_fm" "$2"; }
tmp_fm="$(mktemp)"; trap 'rm -f "$tmp_fm"' EXIT

lock_of() { [[ -f "$locks/$1/owner" ]] && cat "$locks/$1/owner" || true; }
lock_get() { [[ -f "$locks/$1/$2" ]] && cat "$locks/$1/$2" || true; }

branch_id() { git branch --show-current | sed -nE "s#^(feature|fix|ops)/(${ID_PREFIX}[0-9]+)-.*#\2#p"; }

base_branch_guard() { [[ "$(git branch --show-current)" != "$BASE_BRANCH" ]] || die "on $BASE_BRANCH – this runs on a task branch"; }

run_step() { # <name> <log> <command...>: run quietly, print the tail on failure
  local name="$1" log="$2"; shift 2
  if "$@" > "$log" 2>&1; then echo "ok    $name"; return 0; fi
  echo "FAIL  $name"; echo "----- last lines of $name -----"; tail -40 "$log" | sed 's/\x1b\[[0-9;]*m//g'; echo "-----"
  return 1
}

frontend_modules() { # a worktree has no node_modules: link the main checkout's
  [[ -d src/frontend ]] || return 0
  [[ -e src/frontend/node_modules ]] && return 0
  [[ -d "$main_root/src/frontend/node_modules" ]] || die "run 'npm --prefix src/frontend install' in $main_root first"
  if [[ "$(uname -s)" == MINGW* || "$(uname -s)" == MSYS* ]]; then
    # A junction needs no admin rights; without path conversion Git Bash would mangle the /J switch.
    MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' cmd /c mklink /J \
      "$(cygpath -w "$root/src/frontend/node_modules")" "$(cygpath -w "$main_root/src/frontend/node_modules")" > /dev/null
  else
    ln -s "$main_root/src/frontend/node_modules" src/frontend/node_modules
  fi
}

unlink_modules() { # <worktree>: remove the node_modules link (never its target) before the worktree goes
  local link="$1/src/frontend/node_modules"
  [[ -L "$link" ]] && { rm -f "$link"; return; }
  if [[ -d "$link" ]] && command -v cygpath > /dev/null; then
    # A junction: rmdir removes only the link. A real folder (not ours) isn't empty, so rmdir refuses it.
    MSYS_NO_PATHCONV=1 cmd /c rmdir "$(cygpath -w "$link")" > /dev/null 2>&1 || true
  fi
}

changed_lines() { # added + changed lines since the base (new files included), without tests, lock files, docs/work
  local base; base="$(git merge-base HEAD "$(base_ref)")"
  local skip=(':!tests/**' ':!**/*.test.ts' ':!**/*.test.tsx' ':!**/package-lock.json' ':!docs/work/**' ':!**/Migrations/**')
  local tracked untracked
  tracked="$(git diff --numstat "$base" -- . "${skip[@]}" | awk '$1 ~ /^[0-9]+$/ {s += $1} END {print s+0}')"
  untracked="$(git ls-files -z --others --exclude-standard -- . "${skip[@]}" | xargs -0 -r cat 2>/dev/null | wc -l)"
  echo $(( tracked + untracked ))
}

cmd="${1:-}"; shift || true
case "$cmd" in
  config)
    if [[ -n "${1:-}" ]]; then printf '%s\n' "${!1:?unknown setting: $1}"
    else for k in "${config_keys[@]}"; do echo "$k=${!k}"; done; fi
    ;;
  next-id)
    max=$((ID_START - 1))
    while read -r n; do (( n > max )) && max=$n; done < <(
      { git ls-tree -r --name-only "$(base_ref)" -- "$work_dir" 2>/dev/null; find "$work_dir" -name '*.md' 2>/dev/null; } \
        | sed -nE "s#.*/${ID_PREFIX}([0-9]+)-[^/]*\.md\$#\1#p")
    echo "${ID_PREFIX}$((max + 1))"
    ;;
  next-epic)
    max=0
    while read -r n; do (( n > max )) && max=$n; done < <(
      { git ls-tree -d --name-only "$(base_ref)" "$work_dir/" 2>/dev/null; find "$work_dir" -maxdepth 1 -type d 2>/dev/null; } \
        | sed -nE 's#.*/E([0-9]+)-[^/]*$#\1#p')
    echo "E$((max + 1))"
    ;;
  board)
    epic=""; brief=""; for a in "$@"; do [[ "$a" == --brief ]] && brief=1 || epic="$a"; done
    git fetch --quiet origin "$BASE_BRANCH" 2>/dev/null || true
    paths="$(base_tasks "$epic")"
    if [[ -z "$paths" ]]; then echo "No planned tasks on $BASE_BRANCH${epic:+ for $epic}."; exit 0; fi
    declare -A counts=()
    while read -r p; do
      id="$(base_fm "$p" id)"; st="$(base_fm "$p" status)"; owner="$(lock_of "$id")"
      [[ -n "$owner" && "$st" != done ]] && st="${st/todo/claimed}"
      counts[$st]=$(( ${counts[$st]:-0} + 1 ))
      [[ -n "$brief" ]] && continue
      printf '%-5s %-11s %-3s %-12s %-10s %s %s\n' "$id" "$st" "$(base_fm "$p" priority)" \
        "blk:$(base_fm "$p" blocked_by)" "${owner:--}" "$(base_fm "$p" title)" "$(lock_get "$id" pr)"
    done <<< "$paths"
    summary=""; for k in "${!counts[@]}"; do summary+="$k ${counts[$k]}, "; done
    echo "Tasks${epic:+ in $epic}: ${summary%, }"
    if [[ -n "$brief" ]]; then r="$("$0" ready "$epic" 2>/dev/null | head -3)"; [[ -n "$r" ]] && echo "Ready: $(echo "$r" | cut -d' ' -f1 | paste -sd' ')"; fi
    ;;
  ready)
    epic="${1:-}"
    all="$(base_tasks)"
    [[ -n "$all" ]] || exit 0
    declare -A status_of=()  # all epics: blockers may live in another epic
    while read -r p; do status_of[$(base_fm "$p" id)]="$(base_fm "$p" status)"; done <<< "$all"
    while read -r p; do
      [[ -z "$epic" || "$p" == */"$epic"-*/* ]] || continue
      id="$(base_fm "$p" id)"
      [[ "${status_of[$id]}" == todo && -z "$(lock_of "$id")" ]] || continue
      ok=1
      for b in $(base_fm "$p" blocked_by | tr ',' ' '); do
        [[ "$b" == - || "${status_of[$b]:-}" == done ]] || ok=0
      done
      (( ok )) || continue
      pr="$(base_fm "$p" priority)"; rank="${pr#P}"; [[ "$(base_fm "$p" type)" == ops ]] && rank=0
      printf '%s %s %s %s %s\n' "$rank" "${id#"$ID_PREFIX"}" "$id" "$pr" "$(base_fm "$p" title)"
    done <<< "$all" | sort -k1,1n -k2,2n | cut -d' ' -f3-
    ;;
  file) task_file "${1:?usage: file <ID>}" ;;
  claim)
    [[ -n "${1:-}" && -n "${2:-}" ]] || die "usage: claim <ID> <owner>"
    mkdir -p "$locks"
    mkdir "$locks/$1" 2>/dev/null || die "$1 is already claimed by $(lock_of "$1")"
    echo "$2" > "$locks/$1/owner"; date '+%F %R' > "$locks/$1/since"
    echo "$1 claimed by $2"
    ;;
  release)
    [[ -n "${1:-}" ]] || die "usage: release <ID>"
    rm -rf "${locks:?}/$1"; echo "$1 released"
    ;;
  start)
    id="${1:?usage: start <ID>}"
    [[ "$root" != "$main_root" ]] || die "start runs in your own worktree, not in the main checkout"
    git fetch --quiet origin "$BASE_BRANCH"
    [[ -z "$(git status --porcelain)" ]] || die "uncommitted changes in this worktree"
    f="$(git ls-tree -r --name-only "origin/$BASE_BRANCH" -- "$work_dir" | grep -E "/$id-[^/]*\.md$" | head -1)"
    local_copy=""  # a bug file that exists only in the main checkout travels with the fix's own PR
    if [[ -z "$f" ]]; then
      local_copy="$(cd "$main_root" && find "$work_dir" -name "$id-*.md" 2>/dev/null | head -1)"
      [[ -n "$local_copy" ]] || die "$id is neither on origin/$BASE_BRANCH nor in $main_root/$work_dir (plan not merged yet?)"
      f="$local_copy"; cp "$main_root/$f" "$tmp_fm"
    else
      git show "origin/$BASE_BRANCH:$f" > "$tmp_fm"
    fi
    type="$(fm "$tmp_fm" type)"; title="$(fm "$tmp_fm" title)"
    prefix=feature; [[ "$type" == bug ]] && prefix=fix; [[ "$type" == ops ]] && prefix=ops
    branch="$prefix/$id-$(slug "$title")"
    if git show-ref --verify -q "refs/remotes/origin/$branch"; then git switch --quiet -C "$branch" "origin/$branch"  # resume
    else git switch --quiet -C "$branch" "origin/$BASE_BRANCH"; fi
    [[ -d "$locks/$id" ]] || { mkdir -p "$locks/$id"; echo "${WORK_OWNER:-developer}" > "$locks/$id/owner"; }
    echo "$branch" > "$locks/$id/branch"; echo "$root" > "$locks/$id/worktree"
    if [[ -n "$local_copy" && ! -f "$f" ]]; then mkdir -p "$(dirname "$f")"; cp "$main_root/$f" "$f"; fi
    [[ "$(fm "$f" status)" == done ]] || fm_set "$f" status in-progress
    frontend_modules
    echo "branch $branch"; echo "task   $f"
    ;;
  status)
    id="${1:?usage: status <ID> <status> [reason]}"; st="${2:?status}"
    [[ "$st" =~ ^(todo|in-progress|review|blocked|done)$ ]] || die "status: todo, in-progress, review, blocked or done"
    f="$(task_file "$id")"; fm_set "$f" status "$st"
    if [[ "$st" == blocked ]]; then
      [[ -n "${3:-}" ]] || die "blocked needs a reason"
      fm_set "$f" blocked_reason "\"${3//\"/\'}\""
    fi
    echo "$id → $st"
    ;;
  set)
    [[ $# -eq 3 ]] || die "usage: set <ID> <key> <value>"
    fm_set "$(task_file "$1")" "$2" "$3"; echo "$1 $2: $3"
    ;;
  check-plan)
    e="${1:?usage: check-plan <E<n>>}"; d="$(epic_dir "$e")"; errors=()
    [[ -f "$d/epic.md" ]] || errors+=("$d/epic.md missing")
    files=("$d"/"$ID_PREFIX"*-*.md)
    [[ -e "${files[0]}" ]] || errors+=("no task files ($d/${ID_PREFIX}<n>-<slug>.md)")
    (( ${#files[@]} <= EPIC_MAX_TASKS )) || errors+=("${#files[@]} tasks > EPIC_MAX_TASKS=$EPIC_MAX_TASKS: split the epic")
    declare -A ids=()
    for f in "${files[@]}"; do [[ -e "$f" ]] && ids[$(fm "$f" id)]=1; done
    for f in "${files[@]}"; do
      [[ -e "$f" ]] || continue
      n="$(basename "$f")"; id="$(fm "$f" id)"
      [[ "$n" == "$id"-* ]] || errors+=("$n: id '$id' doesn't match the file name")
      [[ "$(fm "$f" epic)" == "$e" ]] || errors+=("$n: epic must be $e")
      [[ "$(fm "$f" status)" =~ ^(todo|done)$ ]] || errors+=("$n: status must be todo")
      [[ "$(fm "$f" priority)" =~ ^P[1-3]$ ]] || errors+=("$n: priority P1|P2|P3")
      [[ "$(fm "$f" type)" =~ ^(task|ops)$ ]] || errors+=("$n: type task|ops")
      [[ "$(fm "$f" size)" =~ ^(S|M)$ ]] || errors+=("$n: size S|M")
      [[ -n "$(fm "$f" title)" ]] || errors+=("$n: title missing")
      for b in $(fm "$f" blocked_by | tr ',' ' '); do
        [[ "$b" == - || -n "${ids[$b]:-}" || -n "$(base_tasks | grep "/$b-")" ]] || errors+=("$n: blocker $b doesn't exist")
        [[ "$b" != "$id" ]] || errors+=("$n: blocks itself")
      done
      for s in "## Goal" "## Acceptance criteria" "## Technical notes"; do
        grep -q "^$s" "$f" || errors+=("$n: section '$s' missing")
      done
      grep -qE '^- \[ \]' "$f" || errors+=("$n: no acceptance criteria (- [ ] …)")
    done
    if (( ${#errors[@]} )); then printf 'plan %s: %s\n' "$e" "${errors[@]}"; exit 1; fi
    if grep -rqE '_pending_' "$d"; then echo "plan $e: valid, but open questions (_pending_) remain"; exit 3; fi
    echo "plan $e: valid (${#files[@]} tasks)"
    ;;
  publish-plan)
    e="${1:?usage: publish-plan <E<n>>}"; d="$(epic_dir "$e")"
    "$0" check-plan "$e"
    command -v gh > /dev/null || die "gh not found"
    fm_set "$d/epic.md" status planned
    git fetch --quiet origin "$BASE_BRANCH"
    branch="plan/$e"; tmp="$common/work/publish-$e"
    rm -rf "$tmp"; git worktree prune
    git worktree add --quiet -B "$branch" "$tmp" "origin/$BASE_BRANCH"
    mkdir -p "$tmp/$d"; cp -R "$d/." "$tmp/$d/"
    title="$(fm "$d/epic.md" title)"
    git -C "$tmp" add "$d"
    if git -C "$tmp" diff --cached --quiet; then git worktree remove --force "$tmp"; echo "plan $e: nothing new to publish"; exit 0; fi
    git -C "$tmp" commit --quiet -m "docs(plan): $e – $title" -m "Refs: $e"
    git -C "$tmp" push --quiet --force-with-lease -u origin "$branch"
    url="$(gh pr list --head "$branch" --state open --json url --jq '.[0].url')"
    if [[ -z "$url" ]]; then
      body="$(printf 'Plan for **%s – %s**\n\n| ID | Pri | Size | Blocked by | Title |\n|---|---|---|---|---|\n' "$e" "$title")"
      for f in "$d"/"$ID_PREFIX"*-*.md; do
        body+="$(printf '\n| %s | %s | %s | %s | %s |' "$(fm "$f" id)" "$(fm "$f" priority)" "$(fm "$f" size)" "$(fm "$f" blocked_by)" "$(fm "$f" title)")"
      done
      url="$(gh pr create --base "$BASE_BRANCH" --head "$branch" --title "docs(plan): $e – $title" --body "$body")"
    fi
    [[ "$AUTO_MERGE" == on ]] && gh pr merge "$url" --auto "--$MERGE_METHOD" > /dev/null
    git worktree remove --force "$tmp"
    echo "plan $e: $url"
    ;;
  gate)
    base_branch_guard
    log="$common/work/logs"; mkdir -p "$log"; id="$(branch_id)"; id="${id:-x}"
    sln="$(ls ./*.slnx | head -1)"; unit="$(find tests -maxdepth 1 -type d -name '*.xUnit' | head -1)"
    frontend_modules
    fail=0
    run_step "format (dotnet)" "$log/$id-format-dotnet.log" dotnet format whitespace "$sln" || fail=1
    if [[ -d src/frontend ]]; then
      run_step "format (prettier)" "$log/$id-format-web.log" npm --prefix src/frontend run format || fail=1
    fi
    run_step "build" "$log/$id-build.log" dotnet build "$sln" -v q -nologo || fail=1
    if (( ! fail )) && [[ -n "$unit" ]]; then run_step "unit tests (xUnit)" "$log/$id-xunit.log" dotnet test --project "$unit" --no-build || fail=1; fi
    if [[ -d src/frontend ]]; then
      run_step "unit tests (Vitest)" "$log/$id-vitest.log" npm --prefix src/frontend test || fail=1
      run_step "lint" "$log/$id-lint.log" npm --prefix src/frontend run lint || fail=1
      run_step "frontend build" "$log/$id-web-build.log" npm --prefix src/frontend run build || fail=1
    fi
    lines="$(changed_lines)"
    if (( lines > TASK_MAX_LINES )); then echo "FAIL  size: $lines changed lines > TASK_MAX_LINES=$TASK_MAX_LINES (tests, lock files, migrations not counted) – stop and report it, the task needs splitting"; fail=1
    else echo "ok    size: $lines changed lines"; fi
    exit $fail
    ;;
  scan)
    base_branch_guard
    log="$common/work/logs"; mkdir -p "$log"; id="$(branch_id)"; id="${id:-x}"
    integ="$(find tests -maxdepth 1 -type d -name '*.xIntegration' | head -1)"; sln="$(ls ./*.slnx | head -1)"
    fail=0
    if [[ -n "$integ" ]]; then run_step "integration tests" "$log/$id-integration.log" dotnet test --project "$integ" || fail=1; fi
    dotnet list "$sln" package --vulnerable --include-transitive > "$log/$id-vuln.log" 2>&1 || true
    if grep -qiE '(High|Critical)' "$log/$id-vuln.log"; then echo "FAIL  vulnerable NuGet packages:"; grep -iE '>|High|Critical' "$log/$id-vuln.log" | head -20; fail=1
    else echo "ok    NuGet packages (no high/critical vulnerabilities)"; fi
    if [[ -f src/frontend/package-lock.json ]]; then
      if (cd src/frontend && npm audit --omit=dev --audit-level=high) > "$log/$id-npm-audit.log" 2>&1; then echo "ok    npm audit (no high/critical in production dependencies)"
      else echo "FAIL  npm audit:"; tail -20 "$log/$id-npm-audit.log"; fail=1; fi
    fi
    base="$(git merge-base HEAD "$(base_ref)")"
    if command -v gitleaks > /dev/null; then
      if gitleaks git --no-banner --log-opts="$base..HEAD" > "$log/$id-secrets.log" 2>&1; then echo "ok    secrets (gitleaks)"
      else echo "FAIL  secrets (gitleaks):"; tail -20 "$log/$id-secrets.log"; fail=1; fi
    else
      hits="$(git diff "$base" -U0 | grep -E '^\+' | grep -iE '(password|secret|api[_-]?key|token|connectionstring)\s*[:=]\s*["'"'"'][^"'"'"']{8,}|-----BEGIN [A-Z ]*PRIVATE KEY|AKIA[0-9A-Z]{16}|ghp_[0-9A-Za-z]{36}' | head -10 || true)"
      if [[ -n "$hits" ]]; then echo "WARN  possible secrets in the diff (no gitleaks installed, pattern check only):"; echo "$hits"
      else echo "ok    secrets (pattern check; install gitleaks for a full scan)"; fi
    fi
    echo "diff: $(git diff --shortstat "$base")"
    exit $fail
    ;;
  ship)
    base_branch_guard
    command -v gh > /dev/null || die "gh not found"
    id="$(branch_id)"; [[ -n "$id" ]] || die "not on a task branch (feature|fix|ops/<ID>-…)"
    f="$(task_file "$id")"; branch="$(git branch --show-current)"
    [[ -z "$(git status --porcelain)" ]] || die "uncommitted changes – the hooks commit before shipping"
    git fetch --quiet origin "$BASE_BRANCH"
    if ! git rebase --quiet "origin/$BASE_BRANCH" > /dev/null 2>&1; then
      conflicts="$(git diff --name-only --diff-filter=U | paste -sd' ')"; git rebase --abort
      mkdir -p "$locks/$id"; echo "conflicts: $conflicts" > "$locks/$id/ship"
      die "rebase on origin/$BASE_BRANCH has conflicts ($conflicts) – the developer resolves them, then ship again"
    fi
    git push --quiet --force-with-lease -u origin "$branch"
    url="$(gh pr list --head "$branch" --state open --json url --jq '.[0].url')"
    if [[ -z "$url" ]]; then
      type="$(fm "$f" type)"; title="$(fm "$f" title)"
      body="$(awk '/^## Goal/{p=1} /^## Technical notes/{p=0} p' "$f")"
      qa="$(awk '/^## QA/{p=1} p' "$f")"
      labels=(); [[ "$type" == ops ]] && labels=(--label ops)
      url="$(gh pr create --base "$BASE_BRANCH" --head "$branch" --title "$id – $title" "${labels[@]}" \
        --body "$(printf '%s\n\n%s\n\nTask: `%s`\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)' "$body" "$qa" "$f")")"
    fi
    [[ "$AUTO_MERGE" == on ]] && gh pr merge "$url" --auto "--$MERGE_METHOD" > /dev/null
    mkdir -p "$locks/$id"; echo "$url" > "$locks/$id/pr"; rm -f "$locks/$id/ship"
    echo "$id shipped: $url"
    ;;
  sync)
    [[ "$root" == "$main_root" ]] || die "sync runs in the main checkout"
    [[ -z "$(git status --porcelain -- . ':!docs/work')" ]] || die "uncommitted changes – commit or stash them first"
    git fetch --prune --quiet origin
    git switch --quiet "$BASE_BRANCH"
    # Local plan files written before publish-plan: drop the copies that are now on the base branch
    # (a differing copy is kept under .git/work/backup), so the pull can bring the merged ones.
    while read -r p; do
      git cat-file -e "origin/$BASE_BRANCH:$p" 2>/dev/null || continue
      if ! git show "origin/$BASE_BRANCH:$p" | cmp -s - "$p"; then
        mkdir -p "$common/work/backup/$(dirname "$p")"; cp "$p" "$common/work/backup/$p"; echo "kept a copy of local $p in .git/work/backup"
      fi
      rm -f "$p"
    done < <(git ls-files --others --exclude-standard -- "$work_dir")
    git pull --ff-only --quiet origin "$BASE_BRANCH"
    # Locks of tasks that are done on the base branch, their worktrees and merged branches.
    if [[ -d "$locks" ]]; then
      for l in "$locks"/*/; do
        [[ -d "$l" ]] || continue; id="$(basename "$l")"
        p="$(base_tasks | grep "/$id-" | head -1)"
        [[ -n "$p" && "$(base_fm "$p" status)" == done ]] || continue
        wt="$(lock_get "$id" worktree)"; br="$(lock_get "$id" branch)"
        if [[ -n "$wt" && -d "$wt" ]]; then unlink_modules "$wt"; git worktree remove --force "$wt" 2>/dev/null && echo "removed worktree of $id"; fi
        [[ -n "$br" ]] && git branch -D "$br" > /dev/null 2>&1 && echo "deleted $br"
        rm -rf "$l"; echo "$id done – lock released"
      done
    fi
    git worktree prune
    while read -r b; do  # other local branches whose PR is merged
      [[ "$b" == "$BASE_BRANCH" ]] && continue
      if command -v gh > /dev/null && [[ -n "$(gh pr list --state merged --head "$b" --json number --jq '.[0].number' 2>/dev/null)" ]]; then
        git branch -D "$b" > /dev/null 2>&1 && echo "deleted $b (PR merged)" || echo "kept $b (checked out in a worktree)"
      fi
    done < <(git for-each-ref --format='%(refname:short)' refs/heads)
    git log --oneline -1
    ;;
  *) sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
