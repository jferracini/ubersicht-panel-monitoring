#!/bin/bash
# Übersicht Panel — Installer
# Idempotent: safe to run multiple times.

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$REPO_DIR/widgets"
DST="$HOME/Library/Application Support/Übersicht/widgets"
UBER_APP="/Applications/Übersicht.app"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   Übersicht Panel — Installer"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1. Install Übersicht ───────────────────────────────────────────────────────
echo "[1/4] Checking Übersicht…"

if [ ! -d "$UBER_APP" ]; then
  echo "     Not found — installing via Homebrew…"
  if ! command -v brew &>/dev/null; then
    echo ""
    echo "❌ Homebrew not found. Install it first:"
    echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    echo ""
    exit 1
  fi
  brew install --cask ubersicht
fi

if [ ! -d "$UBER_APP" ]; then
  echo "❌ Übersicht install failed. Try: brew install --cask ubersicht"
  exit 1
fi

echo "     ✓ Found."
echo ""

# ── 2. Kill any running instance ──────────────────────────────────────────────
echo "[2/4] Stopping Übersicht…"

osascript -e 'tell application "Übersicht" to quit' 2>/dev/null || true
sleep 1
# Kill any leftover processes by path (avoids Unicode issues in pkill)
pgrep -f "Übersicht.app/Contents" | xargs kill -9 2>/dev/null || true
pgrep -f "Uebersicht" | xargs kill -9 2>/dev/null || true
sleep 1

echo "     ✓ Done."
echo ""

# ── 3. Link widgets ───────────────────────────────────────────────────────────
echo "[3/4] Installing widgets…"
echo ""

mkdir -p "$DST"
rm -f "$DST/GettingStarted.jsx"

# Write widget visibility: only panel-info-jsx visible, all others hidden
WIDGET_SETTINGS_DIR="$HOME/Library/Application Support/tracesOf.Uebersicht"
mkdir -p "$WIDGET_SETTINGS_DIR"
cat > "$WIDGET_SETTINGS_DIR/WidgetSettings.json" << 'EOF'
{"battery-info-jsx":{"showOnAllScreens":true,"showOnMainScreen":false,"showOnSelectedScreens":false,"hidden":true,"screens":[]},"clock-jsx":{"showOnAllScreens":true,"showOnMainScreen":false,"showOnSelectedScreens":false,"hidden":true,"screens":[]},"cpu-info-jsx":{"showOnAllScreens":true,"showOnMainScreen":false,"showOnSelectedScreens":false,"hidden":true,"screens":[]},"disk-info-jsx":{"showOnAllScreens":true,"showOnMainScreen":false,"showOnSelectedScreens":false,"hidden":true,"screens":[]},"gpu-info-jsx":{"showOnAllScreens":true,"showOnMainScreen":false,"showOnSelectedScreens":false,"hidden":true,"screens":[]},"panel-info-jsx":{"showOnAllScreens":true,"showOnMainScreen":false,"showOnSelectedScreens":false,"hidden":false,"screens":[]},"ram-info-jsx":{"showOnAllScreens":true,"showOnMainScreen":false,"showOnSelectedScreens":false,"hidden":true,"screens":[]},"stay-awake-jsx":{"showOnAllScreens":true,"showOnMainScreen":false,"showOnSelectedScreens":false,"hidden":true,"screens":[]},"vibe-code-jsx":{"showOnAllScreens":true,"showOnMainScreen":false,"showOnSelectedScreens":false,"hidden":true,"screens":[]}}
EOF

for f in "$SRC"/*.jsx "$SRC"/*.swift; do
  [ -e "$f" ] || continue
  name=$(basename "$f")
  target="$DST/$name"
  [ -L "$target" ] && rm "$target"
  [ -e "$target" ] && mv "$target" "$target.bak.$(date +%s)"
  ln -s "$f" "$target"
  echo "     ✓ $name"
done

echo ""
echo "     ✓ All widgets linked."
echo ""

# ── 4. Launch + Screen Recording (required one-time step on macOS 13+) ────────
echo "[4/4] Launching Übersicht…"
echo ""

open "$UBER_APP"
sleep 3

echo "  ┌──────────────────────────────────────────────────────┐"
echo "  │  ONE-TIME PERMISSION REQUIRED                        │"
echo "  │                                                      │"
echo "  │  System Settings → Screen Recording is opening now. │"
echo "  │                                                      │"
echo "  │  Übersicht won't appear in the list automatically.  │"
echo "  │  Add it manually:                                    │"
echo "  │                                                      │"
echo "  │  1. Click the  +  button at the bottom of the list  │"
echo "  │  2. Navigate to Applications                        │"
echo "  │  3. Select Übersicht.app → click Open               │"
echo "  │  4. Toggle Übersicht ON                             │"
echo "  │  5. Come back here and press Enter ↵                │"
echo "  └──────────────────────────────────────────────────────┘"
echo ""

open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"

read -r -p "  → Press Enter after adding and enabling Übersicht… "
echo ""

# ── 5. Add to Login Items so it auto-starts on every boot ─────────────────────
osascript 2>/dev/null <<'OSASCRIPT'
tell application "System Events"
  set loginItems to get the name of every login item
  if "Übersicht" is not in loginItems then
    make login item at end with properties {path:"/Applications/Übersicht.app", hidden:false}
  end if
end tell
OSASCRIPT

# ── Detect and report ──────────────────────────────────────────────────────────
sleep 2
UBER_PID=$(pgrep -f "Übersicht.app/Contents/MacOS" 2>/dev/null | head -1)

if [ -n "$UBER_PID" ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "   ✓ Done! Panel is on screen."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "   ⚠ Could not detect Übersicht."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Open /Applications/Übersicht.app manually."
fi

echo ""
echo "Drag the panel anywhere — position is saved."
echo "Übersicht starts automatically on every login."
echo "To update: cd $REPO_DIR && git pull"
echo ""
