# Shared helpers for the hook scripts (sourced). Hooks get their input as JSON on stdin.
# jq isn't guaranteed (Windows), node is (the frontend needs it): one node call reads every field we need.

hook_input="$(cat)"

# hook_fields <field>...: prints the fields' values, one per line ("" when missing; dotted paths allowed).
# The JSON goes in on stdin: as a command-line argument Windows would mangle its backslashes.
hook_fields() {
  printf '%s' "$hook_input" | node -e '
    const o = JSON.parse(require("fs").readFileSync(0, "utf8") || "{}");
    for (const k of process.argv.slice(1)) {
      const v = k.split(".").reduce((a, p) => (a == null ? a : a[p]), o);
      console.log(v == null ? "" : String(v).replace(/\r?\n/g, " ; ")); // one line per field; a newline separates shell commands
    }' "$@"
}

# to_unix <path>: Windows paths (C:\x\y) → the shell's form (/c/x/y); others unchanged.
to_unix() { if command -v cygpath > /dev/null; then cygpath -u "$1"; else printf '%s\n' "$1"; fi; }

# block <message>: refuse and tell the agent why (exit 2: stderr goes back to the model).
block() { printf '%s\n' "$*" >&2; exit 2; }

work() { bash "$CLAUDE_PROJECT_DIR/.claude/scripts/work.sh" "$@"; }

# Infrastructure paths only CloudOps changes – one list, in work.sh (also used by its gate).
is_infra_path() { work is-infra "$1"; }
