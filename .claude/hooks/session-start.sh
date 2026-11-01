#!/usr/bin/env bash
# SessionStart: a short board in the context, so the session knows where the work stands.
set -uo pipefail
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0
[[ -d docs/work ]] || exit 0
board="$(timeout 20 bash .claude/scripts/work.sh board --brief 2>/dev/null)" || exit 0
[[ -n "$board" ]] && printf 'Work board (docs/work, .claude/scripts/work.sh):\n%s\n' "$board"
exit 0
