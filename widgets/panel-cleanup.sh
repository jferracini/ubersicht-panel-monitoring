#!/bin/bash
# panel-cleanup.sh — cleanup actions for the panel-info Disk "CLR" menu.
# Usage: panel-cleanup.sh <appcaches|snapshots|ollama|downloads|trash>
#
# Safety: snapshots run directly (regenerable). appcaches, downloads, ollama and
# trash show a native confirm dialog with the space involved, and every action
# reports how much disk was actually freed (measured via df delta).
set -uo pipefail

AS="$HOME/Library/Application Support"

notify() {
  local msg=${1//\"/\'}
  osascript -e "display notification \"$msg\" with title \"Disk\" sound name \"Pop\"" >/dev/null 2>&1
}

# Returns 0 only if the user clicks the non-default "Limpar" button.
confirm() {
  local msg=${1//\"/\'}
  osascript -e "display dialog \"$msg\" buttons {\"Cancelar\",\"Limpar\"} default button \"Cancelar\"" >/dev/null 2>&1
}

human_size() { du -shc "$@" 2>/dev/null | tail -1 | awk '{print $1}'; }

# Free space available on the volume, in KB.
avail_kb() { df -k / | tail -1 | awk '{print $4}'; }

# Turn a KB amount into a friendly string (e.g. "6.3 GB").
human_kb() {
  awk -v k="${1:-0}" 'BEGIN{
    split("KB MB GB TB", u, " "); s=k; i=1;
    while (s>=1024 && i<4){ s/=1024; i++ }
    printf "%.1f %s", s, u[i]
  }'
}

case "${1:-}" in
  # Clear the safe, regenerable cache folders of the heaviest apps. Never touches
  # logins, passwords, open tabs, settings or user files.
  appcaches)
    roots=("$AS/Google/Chrome" "$AS/Cursor" "$AS/Claude" "$AS/com.openai.atlas")

    TMP=$(mktemp)
    for r in "${roots[@]}"; do
      [ -d "$r" ] || continue
      find "$r" -maxdepth 5 -type d \
        \( -iname 'Cache' -o -iname 'Code Cache' -o -iname 'GPUCache' \
           -o -iname 'CachedData' -o -iname 'Service Worker' \
           -o -iname 'DawnWebGPUCache' -o -iname 'DawnGraphiteCache' \) \
        2>/dev/null >> "$TMP"
    done
    [ -d "$AS/Cursor/logs" ] && echo "$AS/Cursor/logs" >> "$TMP"
    [ -d "$HOME/Library/Caches" ] && echo "$HOME/Library/Caches" >> "$TMP"

    if [ ! -s "$TMP" ]; then
      rm -f "$TMP"; notify "Nenhum cache encontrado"; exit 0
    fi

    EST=$(tr '\n' '\0' < "$TMP" | xargs -0 du -shc 2>/dev/null | tail -1 | awk '{print $1}')
    EST=${EST:-0}

    running=""
    pgrep -x "Google Chrome" >/dev/null 2>&1 && running="$running Chrome"
    pgrep -x "Cursor"        >/dev/null 2>&1 && running="$running Cursor"
    pgrep -x "Claude"        >/dev/null 2>&1 && running="$running Claude"

    MSG="Limpar caches de apps (Chrome, Cursor, Claude, Atlas). Libera ~${EST}. Não afeta login, abas, senhas nem arquivos."
    [ -n "$running" ] && MSG="$MSG  Abertos:${running} — feche-os para liberar tudo."
    MSG="$MSG  Continuar?"

    if confirm "$MSG"; then
      before=$(avail_kb)
      tr '\n' '\0' < "$TMP" | xargs -0 rm -rf 2>/dev/null
      after=$(avail_kb)
      freed=$((after - before)); [ "$freed" -lt 0 ] && freed=0
      notify "Caches limpos — liberados $(human_kb "$freed")"
    fi
    rm -f "$TMP"
    ;;

  snapshots)
    before=$(avail_kb)
    tmutil thinlocalsnapshots / 999999999999 4 >/dev/null 2>&1
    after=$(avail_kb)
    freed=$((after - before)); [ "$freed" -lt 0 ] && freed=0
    notify "Snapshots APFS limpos — liberados $(human_kb "$freed")"
    ;;

  ollama)
    if ! command -v ollama >/dev/null 2>&1; then
      notify "Ollama não instalado"; exit 0
    fi
    LIST=$(ollama list 2>/dev/null | awk 'NR>1 {print $1}')
    if [ -z "$LIST" ]; then
      notify "Nenhum modelo Ollama"; exit 0
    fi
    AS_LIST=$(printf '%s\n' "$LIST" | awk '{gsub(/"/,"",$0); printf "\"%s\",", $0}' | sed 's/,$//')
    CHOICE=$(osascript -e "choose from list {$AS_LIST} with prompt \"Remover qual modelo Ollama?\"" 2>/dev/null)
    if [ "$CHOICE" = "false" ] || [ -z "$CHOICE" ]; then
      exit 0
    fi
    before=$(avail_kb)
    if ollama rm "$CHOICE" >/dev/null 2>&1; then
      after=$(avail_kb)
      freed=$((after - before)); [ "$freed" -lt 0 ] && freed=0
      notify "Removido: $CHOICE — liberados $(human_kb "$freed")"
    fi
    ;;

  # Show the biggest files in Downloads and let the user pick which to delete.
  downloads)
    i=0
    paths=()
    labels=()
    while IFS=$'\t' read -r kb fpath; do
      [ -z "${fpath:-}" ] && continue
      i=$((i + 1))
      hum=$(human_kb "$kb")
      base=$(basename "$fpath")
      paths[$i]="$fpath"
      labels[$i]="$i. $hum  $base"
    done < <(find "$HOME/Downloads" -maxdepth 2 -type f -not -name '.*' -exec du -k {} + 2>/dev/null | sort -rn | head -15)

    if [ "$i" -eq 0 ]; then
      notify "Nada a remover em Downloads"; exit 0
    fi

    AS_LIST=""
    for idx in "${!labels[@]}"; do
      lab=${labels[$idx]//\"/}
      AS_LIST="$AS_LIST\"$lab\","
    done
    AS_LIST=${AS_LIST%,}

    CHOSEN=$(osascript <<EOF 2>/dev/null
set theList to {$AS_LIST}
set chosen to choose from list theList with prompt "Selecione os arquivos para apagar (maiores no topo):" with multiple selections allowed
if chosen is false then return ""
set AppleScript's text item delimiters to linefeed
return chosen as text
EOF
)
    [ -z "$CHOSEN" ] && exit 0

    before=$(avail_kb)
    while IFS= read -r line; do
      [ -z "$line" ] && continue
      n=$(printf '%s' "$line" | grep -o '^[0-9]\{1,\}')
      [ -z "$n" ] && continue
      f="${paths[$n]:-}"
      [ -n "$f" ] && [ -e "$f" ] && rm -f "$f" 2>/dev/null
    done <<< "$CHOSEN"
    after=$(avail_kb)
    freed=$((after - before)); [ "$freed" -lt 0 ] && freed=0
    notify "Downloads limpos — liberados $(human_kb "$freed")"
    ;;

  trash)
    SZ=$(human_size "$HOME/.Trash/"* 2>/dev/null); SZ=${SZ:-0}
    if confirm "Esvaziar a Lixeira (~${SZ})?"; then
      before=$(avail_kb)
      osascript -e 'tell application "Finder" to empty trash' >/dev/null 2>&1
      after=$(avail_kb)
      freed=$((after - before)); [ "$freed" -lt 0 ] && freed=0
      notify "Lixeira esvaziada — liberados $(human_kb "$freed")"
    fi
    ;;

  *)
    echo "usage: panel-cleanup.sh <appcaches|snapshots|ollama|downloads|trash>" >&2
    exit 1
    ;;
esac
