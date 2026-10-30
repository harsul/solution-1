#!/usr/bin/env bash
# rename.sh <NewName>
#
# Renames the code base: solution file, project folders and files, namespaces and every reference
# (AspireApp1.Server → <NewName>.Server, Solution1.slnx → <NewName>.slnx, Projects.AspireApp1_Server, ...).
# The name users see (app title, emails, colors) is separate: /finit update (brand.ts, Branding.cs).
#
# Run from a clean working tree; review the result with `git status` / `git diff --stat`, then build,
# test and commit (the /frename skill does all of this).
set -euo pipefail

die() { echo "rename: $*" >&2; exit 1; }

new="${1:-}"
[[ "$new" =~ ^[A-Z][A-Za-z0-9]{1,40}$ ]] || die "the name must be PascalCase letters and digits, e.g. Acme or BookingHub (no dots, spaces or dashes)"

cd "$(git rev-parse --show-toplevel)"
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || die "commit or stash your changes first"

sln="$(git ls-files '*.slnx' | head -n1)"
[[ -n "$sln" ]] || die "no .slnx solution file found"
old_sln="$(basename "$sln" .slnx)"
apphost="$(git ls-files 'src/*.AppHost/*.AppHost.csproj' | head -n1)"
[[ -n "$apphost" ]] || die "no src/<Name>.AppHost project found"
old="$(basename "$apphost" .AppHost.csproj)"
[[ "$old" != "$new" || "$old_sln" != "$new" ]] || die "already named $new"
echo "Renaming projects $old.* → $new.* and solution $old_sln.slnx → $new.slnx"

# 1. Project folders (src/<old>.X, tests/<old>.X) and the files named after them.
while read -r dir; do
  git mv "$dir" "${dir/$old./$new.}"
done < <(git ls-files src tests | sed -nE "s#^((src|tests)/$old\.[^/]+)/.*#\1#p" | sort -u)
while read -r file; do
  git mv "$file" "$(dirname "$file")/$(basename "$file" | sed "s/^$old\./$new./")"
done < <(git ls-files src tests | grep -E "/$old\.[^/]+\.(csproj|http)$" || true)
[[ "$old_sln" == "$new" ]] || git mv "$sln" "$(dirname "$sln")/$new.slnx"

# 2. Every reference in tracked text files (namespaces, project paths, Projects.<old>_Server, docs,
#    workflow commands). The F1–F5 archive keeps its original wording.
git grep -lzI -e "$old" -e "$old_sln" -- . ':!docs/plans' ':!docs/specs' ':!.claude/scripts/rename.sh' \
  | xargs -0 -r sed -i -e "s/$old/$new/g" -e "s/$old_sln/$new/g"

# 3. Build output still carries the old names; it is rebuilt on the next build.
find src tests -type d \( -name bin -o -name obj \) -prune -exec rm -rf {} + 2>/dev/null || true

echo
echo "Done. Next:"
echo "  dotnet build $new.slnx && dotnet test     # then commit"
echo "Notes:"
echo "  - Reopen the solution in your IDE ($new.slnx)."
echo "  - Aspire names local containers and volumes after the AppHost: the local Postgres starts empty"
echo "    once (migrations recreate the schema); the old volume stays until you remove it."
echo "  - Rename the GitHub repository and the local folder separately if you want them to match."
