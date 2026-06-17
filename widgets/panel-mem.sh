#!/bin/bash
# panel-mem.sh — memory actions for the panel-info Memory "MEM" menu.
# Usage: panel-mem.sh <hogs|purge>
#
# hogs : list the biggest memory consumers and let the user quit one (the only
#        thing that actually relieves memory pressure on modern macOS).
# purge: run `purge` (needs admin) and honestly report how little it freed.
set -uo pipefail

notify() {
  local msg=${1//\"/\'}
  osascript -e "display notification \"$msg\" with title \"Memory\" sound name \"Pop\"" >/dev/null 2>&1
}

confirm() {
  local msg=${1//\"/\'}
  osascript -e "display dialog \"$msg\" buttons {\"Cancelar\",\"Fechar app\"} default button \"Cancelar\"" >/dev/null 2>&1
}

human_kb() {
  awk -v k="${1:-0}" 'BEGIN{
    split("KB MB GB TB", u, " "); s=k; i=1;
    while (s>=1024 && i<4){ s/=1024; i++ }
    printf "%.1f %s", s, u[i]
  }'
}

case "${1:-}" in
  # Show the biggest memory consumers grouped by app; let the user quit one.
  hogs)
    # Group every process under its parent .app bundle (so all "Google Chrome
    # Helper" processes roll up into "Google Chrome"). Non-app processes keep
    # their own name.
    # Only list real apps (processes under a .app bundle), so every entry is
    # something the user can safely quit. System daemons are left out.
    group_by_app='NR>1 {
      rss=$1; path=$2; for(i=3;i<=NF;i++) path=path" "$i;
      idx=index(path, ".app/");
      if(idx>0){ pre=substr(path,1,idx-1); m=split(pre,p,"/"); name=p[m]; sum[name]+=rss }
    } END { for(n in sum) printf "%d\t%s\n", sum[n], n }'

    i=0
    names=()
    labels=()
    while IFS=$'\t' read -r rss name; do
      [ -z "${name:-}" ] && continue
      name=${name//\"/}
      i=$((i + 1))
      names[$i]="$name"
      labels[$i]="$i. $(human_kb "$rss")  $name"
    done < <(ps -axo rss,command | awk "$group_by_app" | sort -rn | head -10)

    if [ "$i" -eq 0 ]; then
      notify "Nada encontrado"; exit 0
    fi

    AS_LIST=""
    for idx in "${!labels[@]}"; do
      AS_LIST="$AS_LIST\"${labels[$idx]}\","
    done
    AS_LIST=${AS_LIST%,}

    # Context line so the list reads as "the closeable subset", not the whole total.
    PAGE=$(vm_stat | head -1 | grep -oE '[0-9]+'); PAGE=${PAGE:-16384}
    VM=$(vm_stat)
    total_b=$(sysctl -n hw.memsize)
    freep=$(echo "$VM" | awk '/Pages free/{gsub(/\./,"",$3);print $3}'); freep=${freep:-0}
    inactp=$(echo "$VM" | awk '/Pages inactive/{gsub(/\./,"",$3);print $3}'); inactp=${inactp:-0}
    compp=$(echo "$VM" | awk '/occupied by compressor/{gsub(/\./,"",$5);print $5}'); compp=${compp:-0}
    used_gb=$(awk -v t="$total_b" -v f="$freep" -v ia="$inactp" -v p="$PAGE" 'BEGIN{printf "%.1f",(t-(f+ia)*p)/1073741824}')
    comp_gb=$(awk -v c="$compp" -v p="$PAGE" 'BEGIN{printf "%.1f",c*p/1073741824}')
    PROMPT="Em uso ${used_gb} GB (${comp_gb} GB comprimida, não fechável). Apps que dá pra fechar:"

    CHOICE=$(osascript -e "choose from list {$AS_LIST} with prompt \"$PROMPT\"" 2>/dev/null)
    if [ "$CHOICE" = "false" ] || [ -z "$CHOICE" ]; then
      exit 0
    fi

    n=$(printf '%s' "$CHOICE" | grep -o '^[0-9]\{1,\}')
    [ -z "$n" ] && exit 0
    NAME="${names[$n]:-}"
    [ -z "$NAME" ] && exit 0

    if confirm "Fechar \"$NAME\"? Salve seu trabalho — isso encerra o app inteiro."; then
      # Graceful quit for real apps; fall back to signalling every PID of that group.
      if osascript -e "tell application \"$NAME\" to quit" >/dev/null 2>&1; then
        notify "Fechando: $NAME"
      else
        ps -axo pid,command | awk -v t="$NAME" 'NR>1 {
          pid=$1; path=$2; for(i=3;i<=NF;i++) path=path" "$i;
          idx=index(path, ".app/");
          if(idx>0){ pre=substr(path,1,idx-1); m=split(pre,p,"/"); n=p[m] }
          else { m=split(path,p,"/"); n=p[m]; sub(/ .*/,"",n) }
          if(n==t) print pid
        }' | xargs kill 2>/dev/null
        notify "Encerrado: $NAME"
      fi
    fi
    ;;

  # Run purge and report the (usually small) amount actually freed.
  purge)
    page=$(vm_stat | head -1 | grep -oE '[0-9]+')
    page=${page:-16384}
    free0=$(vm_stat | awk '/Pages free/{gsub(/\./,"",$3);print $3}')
    free0=${free0:-0}
    if ! osascript -e 'do shell script "purge" with administrator privileges' >/dev/null 2>&1; then
      notify "Purge cancelado"; exit 0
    fi
    free1=$(vm_stat | awk '/Pages free/{gsub(/\./,"",$3);print $3}')
    free1=${free1:-0}
    freed_kb=$(( (free1 - free0) * page / 1024 ))
    [ "$freed_kb" -lt 0 ] && freed_kb=0
    notify "Purge concluído — liberados $(human_kb "$freed_kb")"
    ;;

  *)
    echo "usage: panel-mem.sh <hogs|purge>" >&2
    exit 1
    ;;
esac
