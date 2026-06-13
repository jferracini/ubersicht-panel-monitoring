#!/bin/bash
# Vibe Actions — quick actions bar state collector
# Emits: CLOUDFLARED_STATUS|CLOUDFLARED_URL|CLOUDFLARED_PORT##THEME

# ---- cloudflared status ------------------------------------------------------
CF_BIN=$(command -v cloudflared 2>/dev/null)
CF_PID=$(pgrep -f "cloudflared tunnel" 2>/dev/null | head -1)
CF_URL=""
CF_PORT=""

if [ -z "$CF_BIN" ]; then
  CF_STATUS="missing"
elif [ -n "$CF_PID" ]; then
  CF_STATUS="on"
  # parse URL + port from log file (cloudflared writes ~10s after start)
  if [ -f /tmp/vibe-tunnel.log ]; then
    CF_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/vibe-tunnel.log 2>/dev/null | tail -1)
    CF_PORT=$(grep -oE 'http://localhost:[0-9]+' /tmp/vibe-tunnel.log 2>/dev/null | grep -oE '[0-9]+$' | tail -1)
  fi
else
  CF_STATUS="off"
fi

# ---- claude CLI availability -------------------------------------------------
CLAUDE_BIN=$(command -v claude 2>/dev/null)
if [ -n "$CLAUDE_BIN" ]; then
  CLAUDE_STATUS="ok"
else
  CLAUDE_STATUS="missing"
fi

printf "%s|%s|%s##%s" "$CF_STATUS" "$CF_URL" "$CF_PORT" "$CLAUDE_STATUS"
