#!/bin/bash
# Removes only the symlinks that point back into this repo.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$REPO_DIR/widgets"
DST="$HOME/Library/Application Support/Übersicht/widgets"

echo "→ Removing symlinks in $DST that point to $SRC"
echo

removed=0
for target in "$DST"/*.jsx "$DST"/*.swift; do
  [ -L "$target" ] || continue
  link_target=$(readlink "$target")
  case "$link_target" in
    "$SRC"/*)
      rm "$target"
      echo "  ✓ removed $(basename "$target")"
      removed=$((removed + 1))
      ;;
  esac
done

echo
echo "Done. $removed symlink(s) removed."
echo "Repo untouched at $REPO_DIR"
