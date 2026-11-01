#!/usr/bin/env bash
# PostToolUse (Edit, Write, MultiEdit): format the frontend file that was just changed, so formatting
# never costs a fix round. C# is formatted by the developer gate (dotnet format is too slow per edit).
set -uo pipefail
. "$(dirname "$0")/lib.sh"

mapfile -t f < <(hook_fields cwd tool_input.file_path)
file="$(to_unix "${f[1]}")"
case "$file" in
  */src/frontend/*.ts|*/src/frontend/*.tsx|*/src/frontend/*.js|*/src/frontend/*.css|*/src/frontend/*.json) ;;
  *) exit 0 ;;
esac
[[ "$file" == */node_modules/* || ! -f "$file" ]] && exit 0
prettier="$CLAUDE_PROJECT_DIR/src/frontend/node_modules/.bin/prettier"
[[ -x "$prettier" ]] || exit 0
"$prettier" --write --log-level silent "$file" > /dev/null 2>&1 || true
exit 0
