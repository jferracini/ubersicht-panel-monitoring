#!/bin/bash
# panel-cleanup.sh — cleanup actions for the panel-info Disk "CLR" menu.
# Usage: panel-cleanup.sh <caches|snapshots|ollama|downloads|trash>
#
# Safety (per spec): caches + snapshots run directly (regenerable, low risk);
# ollama, downloads, trash show a native confirm dialog with the space freed.
set -uo pipefail

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

case "${1:-}" in
  caches)
    rm -rf "$HOME/Library/Caches/"* "$HOME/Library/Application Support/Caches/"* 2>/dev/null
    notify "Caches limpos"
    ;;

  snapshots)
    tmutil thinlocalsnapshots / 999999999999 4 >/dev/null 2>&1
    notify "Snapshots APFS limpos"
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
    if ollama rm "$CHOICE" >/dev/null 2>&1; then
      notify "Removido: $CHOICE"
    fi
    ;;

  downloads)
    FILES=$(find "$HOME/Downloads" -maxdepth 1 -type f \
      \( -iname '*.dmg' -o -iname '*.pkg' -o -iname '*.zip' -o -iname '*.rar' \) 2>/dev/null)
    if [ -z "$FILES" ]; then
      notify "Nada a remover em Downloads"; exit 0
    fi
    SZ=$(printf '%s\n' "$FILES" | tr '\n' '\0' | xargs -0 du -shc 2>/dev/null | tail -1 | awk '{print $1}')
    if confirm "Remover instaladores do Downloads (.dmg .pkg .zip .rar). Libera ~${SZ}. Confirmar?"; then
      printf '%s\n' "$FILES" | tr '\n' '\0' | xargs -0 rm -f 2>/dev/null
      notify "Instaladores removidos (~${SZ})"
    fi
    ;;

  trash)
    SZ=$(human_size "$HOME/.Trash/"* 2>/dev/null); SZ=${SZ:-0}
    if confirm "Esvaziar a Lixeira (~${SZ})?"; then
      osascript -e 'tell application "Finder" to empty trash' >/dev/null 2>&1
      notify "Lixeira esvaziada"
    fi
    ;;

  *)
    echo "usage: panel-cleanup.sh <caches|snapshots|ollama|downloads|trash>" >&2
    exit 1
    ;;
esac
