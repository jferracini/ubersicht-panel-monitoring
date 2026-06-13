#!/bin/bash
# Vibe Code Utilities — data collector

# ---- Dev Ports ----
PORTS=$(lsof -iTCP -sTCP:LISTEN -n -P 2>/dev/null \
  | awk 'NR>1 {
      split($9,a,":"); port=a[length(a)]+0
      if (port>=1024) { cmd=$1; gsub(".*/","",cmd); print port"|"cmd }
    }' \
  | sort -t"|" -k1,1n | uniq | head -10 \
  | paste -sd ";" -)

# ---- AI / Coding Processes ----
AI=$(ps -axo pcpu,pmem,comm 2>/dev/null \
  | awk 'tolower($3)~/claude|cursor|copilot|ollama|codex|windsurf|zed|continue/ && !/awk/ {
      gsub(".*/","",$3); name=substr($3,1,18)
      printf "%.1f|%.1f|%s\n",$1+0,$2+0,name
    }' \
  | sort -t"|" -k1,1rn | head -6 | paste -sd ";" -)

# ---- Git Repos (scan common dev dirs, depth 1) ----
GIT=""
for base in ~/Sites ~/dev ~/Developer ~/Code ~/Projects ~/workspace; do
  [ -d "$base" ] || continue
  for repo in "$base"/*/; do
    [ -d "${repo}.git" ] || continue
    branch=$(git -C "$repo" branch --show-current 2>/dev/null | head -1)
    [ -z "$branch" ] && continue
    changes=$(git -C "$repo" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
    mtime=$(stat -f '%m' "${repo}.git" 2>/dev/null || echo 0)
    name=$(basename "$repo")
    GIT="${GIT}${mtime}~${name}|${branch}|${changes};"
  done
done
GIT=$(printf "%s" "$GIT" | tr ';' '\n' | grep -v '^$' \
  | sort -t'~' -k1,1rn | head -5 | sed 's/^[0-9]*~//' | paste -sd ";" -)

# ---- Docker ----
DOCKER_N=$(docker ps -q 2>/dev/null | wc -l | tr -d ' ')
DOCKER=$(docker ps --format "{{.Names}}|{{.Status}}" 2>/dev/null | head -4 | paste -sd ";" -)
[ -z "$DOCKER_N" ] && DOCKER_N="n/a"

printf "%s##%s##%s##%s|%s" "$PORTS" "$AI" "$GIT" "$DOCKER_N" "$DOCKER"
