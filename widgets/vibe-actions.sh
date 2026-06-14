#!/bin/bash
# Vibe Actions — quick actions bar state collector
# Emits: CLAUDE_STATUS

CLAUDE_BIN=$(command -v claude 2>/dev/null)
if [ -n "$CLAUDE_BIN" ]; then
  CLAUDE_STATUS="ok"
else
  CLAUDE_STATUS="missing"
fi

printf "%s" "$CLAUDE_STATUS"
