# Panel Cleanup Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Disk tile `CLR` chip in `panel-info.jsx` into a popup cleanup menu (Snapshots, Caches, Ollama models, Downloads installers, Trash).

**Architecture:** Shell logic lives in a new `panel-cleanup.sh` dispatcher (one branch per action, including native confirm dialogs) — matching the repo's existing convention of moving bash out of JSX template literals (`vibe-actions.sh`, `vibe-code.sh`). The JSX only renders the menu and calls `run("bash panel-cleanup.sh <action>")`. The popup uses the same hidden-div + `style.display` toggle pattern as the `vibe-actions.jsx` help popup.

**Tech Stack:** Übersicht widget (React/Emotion JSX via `uebersicht` `run`), bash, osascript (AppleScript dialogs/notifications), `tmutil`, `ollama`.

**Verification note:** Übersicht widgets have no automated test harness. Shell is verified with `bash -n` (syntax) plus running the safe branches; JSX is verified by `./sync.sh` then visual reload in Übersicht. This is the established workflow for this repo.

---

## File Structure

- **Create:** `widgets/panel-cleanup.sh` — cleanup dispatcher, `panel-cleanup.sh <caches|snapshots|ollama|downloads|trash>`. One responsibility: execute one cleanup action with its safety dialog and notification.
- **Modify:** `widgets/panel-info.jsx` — add cleanup menu UI + toggle wiring; repoint the Disk `CLR` chip from `clearPurgeable` to the menu toggle. No other widget changes.
- **Unchanged:** `sync.sh` already copies `widgets/*.sh` and `chmod +x` them, so the new script deploys with no script edits.

---

### Task 1: Create the cleanup dispatcher script

**Files:**
- Create: `widgets/panel-cleanup.sh`

- [ ] **Step 1: Write the script**

```bash
#!/bin/bash
# panel-cleanup.sh — cleanup actions for the panel-info Disk "CLR" menu.
# Usage: panel-cleanup.sh <caches|snapshots|ollama|downloads|trash>
#
# Safety (per spec): caches + snapshots run directly (regenerable, low risk);
# ollama, downloads, trash show a native confirm dialog with the space freed.
set -uo pipefail

notify() {
  osascript -e "display notification \"$1\" with title \"Disk\" sound name \"Pop\"" >/dev/null 2>&1
}

# Returns 0 only if the user clicks the non-default "Limpar" button.
confirm() {
  osascript -e "display dialog \"$1\" buttons {\"Cancelar\",\"Limpar\"} default button \"Cancelar\"" >/dev/null 2>&1
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
    AS_LIST=$(echo "$LIST" | awk '{printf "\"%s\",", $0}' | sed 's/,$//')
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
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x ~/Sites/ubersicht-panel-monitoring/widgets/panel-cleanup.sh`
Expected: no output.

- [ ] **Step 3: Syntax-check**

Run: `bash -n ~/Sites/ubersicht-panel-monitoring/widgets/panel-cleanup.sh && echo OK`
Expected: `OK`

- [ ] **Step 4: Verify the usage / dispatch guard**

Run: `bash ~/Sites/ubersicht-panel-monitoring/widgets/panel-cleanup.sh; echo "exit=$?"`
Expected: prints `usage: panel-cleanup.sh <caches|snapshots|ollama|downloads|trash>` and `exit=1`.

- [ ] **Step 5: Verify the ollama branch is safe when ollama is present (read-only path)**

Run: `bash ~/Sites/ubersicht-panel-monitoring/widgets/panel-cleanup.sh ollama` then immediately press **Cancel** in the macOS "choose from list" dialog.
Expected: dialog lists current models; pressing Cancel removes nothing (`ollama list` unchanged). If ollama is not installed, a "Ollama não instalado" notification appears instead — also acceptable.

- [ ] **Step 6: Commit**

```bash
cd ~/Sites/ubersicht-panel-monitoring
git add widgets/panel-cleanup.sh
git commit -m "feat(panel): add panel-cleanup.sh cleanup dispatcher

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Add the cleanup menu UI to panel-info.jsx

**Files:**
- Modify: `widgets/panel-info.jsx`
  - module helpers near `clearPurgeable` (around line 254-257)
  - `Cell` root style (around line 201)
  - Disk `<Cell>` (around line 379-398)

- [ ] **Step 1: Add cleanup module helpers + CleanRow component**

Insert immediately after the `clearPurgeable` function (after line 257):

```jsx
// ---- cleanup menu ----
const CLEAN_SH = `bash "$HOME/Library/Application Support/Übersicht/widgets/panel-cleanup.sh"`;
const runCleanup = (action) => run(`${CLEAN_SH} ${action}`);

let __cleanupVisible = false;

const __setCleanup = (visible) => {
  __cleanupVisible = visible;
  const popup = document.querySelector('[data-pi-cleanup]');
  if (popup) popup.style.display = visible ? 'block' : 'none';
};

const __toggleCleanup = () => __setCleanup(!__cleanupVisible);
const __closeCleanup = () => __setCleanup(false);

// Close the menu on any click outside the popup. The CLR chip and the menu rows
// call stopPropagation, so their own clicks never reach this listener.
if (typeof window !== 'undefined' && !window.__piCleanupBound) {
  window.__piCleanupBound = true;
  document.addEventListener('click', () => {
    if (__cleanupVisible) __closeCleanup();
  });
}

const CleanRow = ({ label, hint }) => null; // replaced in Step 3
```

(The `CleanRow` placeholder is replaced in Step 3; it is here only so Step 1 is a
self-contained edit. If implementing in one pass, skip the placeholder.)

- [ ] **Step 2: Give the Cell a positioning context for the popup**

Modify the `Cell` root `style` object (lines 201-210). Add `position: "relative"`:

```jsx
const Cell = ({ children, label, value, accent, action, onAction }) => (
  <div style={{
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 10,
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    minHeight: 78,
    boxSizing: "border-box",
    position: "relative",
  }}>
```

- [ ] **Step 3: Replace the CleanRow placeholder with the real component**

Replace the `const CleanRow = ({ label, hint }) => null;` line from Step 1 with:

```jsx
const CleanRow = ({ label, hint, action, danger }) => (
  <div
    onClick={(e) => { e.stopPropagation(); runCleanup(action); __closeCleanup(); }}
    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      gap: 12, padding: "6px 10px", borderRadius: 6, cursor: "pointer",
      fontSize: 11, whiteSpace: "nowrap", color: danger ? "#ff6b6b" : "#fff",
    }}
  >
    <span>{label}</span>
    {hint && <span style={{ opacity: 0.45, fontSize: 9.5 }}>{hint}</span>}
  </div>
);
```

- [ ] **Step 4: Repoint the Disk CLR chip and add the popup**

Replace the entire Disk `<Cell> … </Cell>` block (lines 379-398) with:

```jsx
        {/* DISK */}
        <Cell
          label="Disk"
          value={`${diskPct.toFixed(0)}%`}
          accent={diskColor}
          action="CLR"
          onAction={__toggleCleanup}
        >
          <div style={{ display: "flex", height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 2.5, overflow: "hidden", marginBottom: 6 }}>
            <div style={{ width: `${diskPct}%`, height: "100%", background: diskColor }} />
            <div style={{ width: `${diskPurgePct}%`, height: "100%", background: "#ffcc00", opacity: 0.7 }} />
          </div>
          <div style={{ fontSize: 10, opacity: 0.6, fontVariantNumeric: "tabular-nums" }}>
            {fmtGB(diskUsed)} / {fmtGB(diskTotal)} GB
          </div>
          {hasPurgeable && (
            <div style={{ fontSize: 9.5, opacity: 0.5, color: "#ffcc00", marginTop: 2 }}>
              purg {fmtGB(diskPurge)} GB
            </div>
          )}

          {/* cleanup popup */}
          <div
            data-pi-cleanup
            onClick={(e) => e.stopPropagation()}
            style={{
              display: __cleanupVisible ? "block" : "none",
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: 6,
              minWidth: 190,
              padding: 4,
              background: "rgba(28,28,34,0.98)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              zIndex: 20,
            }}
          >
            <div style={{ fontSize: 9, opacity: 0.4, textTransform: "uppercase", letterSpacing: 0.5, padding: "4px 10px 2px" }}>
              Limpar espaço
            </div>
            {hasPurgeable && <CleanRow label="Snapshots APFS" hint={`${fmtGB(diskPurge)} GB`} action="snapshots" />}
            <CleanRow label="Caches" action="caches" />
            <CleanRow label="Modelos Ollama" action="ollama" />
            <CleanRow label="Downloads (instaladores)" action="downloads" />
            <CleanRow label="Esvaziar Lixeira" action="trash" danger />
          </div>
        </Cell>
```

- [ ] **Step 5: Deploy to the live widgets dir**

Run: `cd ~/Sites/ubersicht-panel-monitoring && ./sync.sh`
Expected: `✓ copied N files` and a soft refresh. (If the menu does not appear, run `./sync.sh --restart`.)

- [ ] **Step 6: Visual verification in Übersicht**

Confirm each by eye:
- Disk tile shows a `CLR` chip **always** (even with no purgeable).
- Click `CLR` → popup opens below the Disk tile with: Snapshots (only if purgeable), Caches, Modelos Ollama, Downloads, Esvaziar Lixeira.
- Click anywhere outside → popup closes.
- Click `Caches` → "Caches limpos" notification, popup closes, no dialog.
- Click `Modelos Ollama` → model list dialog; Cancel removes nothing.
- Click `Downloads` → confirm dialog showing a size; Cancel removes nothing.
- Click `Esvaziar Lixeira` → confirm dialog; Cancel does nothing.
- Click `Snapshots APFS` (if shown) → "Snapshots APFS limpos" notification.

- [ ] **Step 7: Commit**

```bash
cd ~/Sites/ubersicht-panel-monitoring
git add widgets/panel-info.jsx
git commit -m "feat(panel): expand Disk CLR into cleanup menu

CLR now always renders and opens a popup with Snapshots, Caches,
Ollama models, Downloads installers, and Empty Trash. Destructive
items confirm via native dialog; caches/snapshots run directly.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Header comment + finish branch

**Files:**
- Modify: `widgets/panel-info.jsx:1-2` (header comment)

- [ ] **Step 1: Update the file header comment**

Replace lines 1-2:

```jsx
// Panel Info — 2x4 grid combining clock, stay-awake, battery, gpu, disk, ram, cpu, net
// Refresh every 3s. Stay-awake / Disk Clear / RAM Purge clickable. Drag to reposition.
```

with:

```jsx
// Panel Info — 2x4 grid combining clock, stay-awake, battery, gpu, disk, ram, cpu, net
// Refresh every 3s. Stay-awake toggle, Disk CLR cleanup menu, RAM PRG purge. Drag to reposition.
```

- [ ] **Step 2: Commit**

```bash
cd ~/Sites/ubersicht-panel-monitoring
git add widgets/panel-info.jsx
git commit -m "docs(panel): update header for CLR cleanup menu

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 3: Finish the branch**

Use the superpowers:finishing-a-development-branch skill to merge `feat/panel-cleanup-menu` into `main` (or open a PR), per user preference.

---

## Self-Review

**Spec coverage:**
- CLR → popup menu — Task 2 Step 4. ✓
- Popup reuses vibe-actions toggle pattern — Task 2 Step 1 (hidden div + `style.display`, outside-click `click` listener). ✓
- Menu items Snapshots / Caches / Ollama / Downloads / Trash — Task 2 Step 4 + Task 1 branches. ✓
- Safety: caches+snapshots direct, ollama/downloads/trash confirm — Task 1 `case` branches. ✓
- Sizes computed on demand (not in refresh `command`) — Task 1 `downloads`/`trash` compute size at click time; panel `command` untouched. ✓
- Ollama-missing → friendly notification — Task 1 `ollama` branch. ✓
- Empty Downloads/Trash → notification, no error — Task 1 `downloads` ("Nada a remover"), trash size defaults 0. ✓
- CLR always renders, only Snapshots gated — Task 2 Step 4 (`action="CLR"` unconditional; `{hasPurgeable && <CleanRow ... action="snapshots" />}`). ✓ (matches updated spec Trigger section)
- Notification after success mirrors existing style — Task 1 `notify()` uses same `display notification … sound name "Pop"`. ✓
- No RAM duplication, no du in refresh — confirmed; PRG untouched. ✓

**Placeholder scan:** The only placeholder is the intentional `CleanRow = … null` stub in Task 2 Step 1, explicitly replaced in Step 3 with a note. No `TODO`/`TBD`/"handle edge cases". ✓

**Type/name consistency:** `runCleanup(action)`, `__toggleCleanup`, `__closeCleanup`, `__setCleanup`, `__cleanupVisible`, `data-pi-cleanup`, `CLEAN_SH`, `CleanRow` used consistently across Task 2 steps. Script action strings (`caches`/`snapshots`/`ollama`/`downloads`/`trash`) match the `CleanRow action=` props and the `case` labels in Task 1. ✓
