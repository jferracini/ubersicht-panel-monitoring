#!/bin/bash
# Symlinks every widget file into the Übersicht widgets dir so git pull updates live.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$REPO_DIR/widgets"
DST="$HOME/Library/Application Support/Übersicht/widgets"

if [ ! -d "$DST" ]; then
  echo "❌ Übersicht widgets dir not found: $DST"
  echo "   Install Übersicht.app first: https://tracesof.net/uebersicht/"
  exit 1
fi

echo "→ Linking widgets from $SRC"
echo "  to $DST"
echo

for f in "$SRC"/*.jsx "$SRC"/*.swift; do
  [ -e "$f" ] || continue
  name=$(basename "$f")
  target="$DST/$name"

  if [ -L "$target" ]; then
    rm "$target"
  elif [ -e "$target" ]; then
    backup="$target.bak.$(date +%s)"
    echo "  ⚠ $name already exists — backing up to $(basename "$backup")"
    mv "$target" "$backup"
  fi

  ln -s "$f" "$target"
  echo "  ✓ $name"
done

echo
echo "✓ Done. Launching Übersicht…"
open "/Applications/Übersicht.app" 2>/dev/null || open -a "Übersicht" 2>/dev/null || true
echo
echo "Tip: pull updates anytime with: cd $REPO_DIR && git pull"
