#!/bin/bash
# sync.sh — sync repo widgets → Übersicht widgets dir (real copies, not symlinks)
#
# Usage:
#   ./sync.sh              # copy widgets → DST + refresh Übersicht
#   ./sync.sh --pull       # git pull first, then copy + restart Übersicht
#   ./sync.sh --watch      # auto-resync on file change (requires fswatch)
#   ./sync.sh --restart    # full kill + relaunch (use if widget not detected)
#
# Why copy not symlink: Übersicht's server.js does not follow symlinks for new
# widgets, so newly added files never appear in the menu when symlinked.

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$REPO_DIR/widgets"
DST="$HOME/Library/Application Support/Übersicht/widgets"
UBER_APP="/Applications/Übersicht.app"

MODE_PULL=0
MODE_WATCH=0
MODE_RESTART=0
for arg in "$@"; do
  case "$arg" in
    --pull)    MODE_PULL=1 ;;
    --watch)   MODE_WATCH=1 ;;
    --restart) MODE_RESTART=1 ;;
    -h|--help)
      sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "Unknown flag: $arg"; exit 1 ;;
  esac
done

do_copy() {
  mkdir -p "$DST"
  for f in "$SRC"/*.jsx "$SRC"/*.swift "$SRC"/*.sh; do
    [ -e "$f" ] || continue
    name=$(basename "$f")
    target="$DST/$name"
    # Clean up old symlinks left by install.sh
    [ -L "$target" ] && rm "$target"
    cp "$f" "$target"
    [[ "$name" == *.sh ]] && chmod +x "$target"
  done
  echo "  ✓ copied $(ls "$SRC"/*.jsx "$SRC"/*.swift "$SRC"/*.sh 2>/dev/null | wc -l | tr -d ' ') files"
}

do_quit() {
  osascript -e 'tell application "Übersicht" to quit' 2>/dev/null || true
  sleep 1
  pgrep -f "Übersicht.app/Contents" | xargs kill -9 2>/dev/null || true
  pgrep -f "Uebersicht" | xargs kill -9 2>/dev/null || true
  sleep 1
}

do_launch() {
  open "$UBER_APP"
}

do_refresh() {
  # Soft refresh — keeps app running, reloads widgets via menu API
  osascript <<'OSASCRIPT' 2>/dev/null || true
tell application "System Events"
  tell process "Übersicht"
    try
      click menu bar item 1 of menu bar 2
      delay 0.2
      click menu item "Refresh All Widgets" of menu 1 of menu bar item 1 of menu bar 2
    end try
  end tell
end tell
OSASCRIPT
}

if [ "$MODE_WATCH" = "1" ]; then
  if ! command -v fswatch &>/dev/null; then
    echo "❌ fswatch not installed. brew install fswatch"
    exit 1
  fi
  echo "👀 watching $SRC for changes (Ctrl+C to stop)…"
  do_copy
  fswatch -o "$SRC" | while read -r _; do
    echo "  ↻ change detected → sync"
    do_copy
    do_refresh
  done
  exit 0
fi

if [ "$MODE_PULL" = "1" ]; then
  echo "📥 git pull…"
  (cd "$REPO_DIR" && git pull)
  echo ""
fi

echo "📋 copying widgets → DST…"
do_copy
echo ""

if [ "$MODE_RESTART" = "1" ] || [ "$MODE_PULL" = "1" ]; then
  echo "🔄 restarting Übersicht…"
  do_quit
  do_launch
  sleep 2
  if pgrep -f "Übersicht.app/Contents/MacOS" >/dev/null; then
    echo "  ✓ running"
  else
    echo "  ⚠ not detected — open manually"
  fi
else
  echo "🔄 soft refresh widgets…"
  do_refresh
  echo "  ✓ done (use --restart if new widget didn't appear)"
fi

echo ""
echo "Done."
