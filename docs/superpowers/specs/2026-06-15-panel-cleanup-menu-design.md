# Panel Cleanup Menu — Design Spec

**Date:** 2026-06-15
**Status:** Approved (design phase)
**Target file:** `widgets/panel-info.jsx`

## Problem

The unified panel (`panel-info.jsx`) shows a Disk tile with a `CLR` chip that
runs a single action — `tmutil thinlocalsnapshots` — which only reclaims APFS
local snapshots (the "purgeable" space, e.g. 54.6 GB).

There is no widget action for the kinds of reclaimable space that actually fill
the disk: app caches, downloaded AI models (Ollama), stale installers in
Downloads, and the Trash. Today the user reclaims these by hand. A real cleanup
session recently freed ~36 GB (Ollama 22 GB, Telegram cache 7.6 GB, Chrome
Canary 5.4 GB, caches ~0.9 GB) — none of which the panel can do.

## Goal

Turn the `CLR` chip into a small cleanup menu offering the categories of
reclaimable space that don't exist anywhere in the widget set, while preserving
the current snapshot-thinning behavior as one menu item.

## Non-goals (YAGNI)

- No RAM / swap actions. RAM purge already exists as the `PRG` chip on the
  Memory tile (`purgeRam`, calls `purge` with admin privileges). Do not
  duplicate it.
- No `du` in the refresh loop — keeps the panel `command` cheap.
- No scheduling, history, charts, or settings.
- No changes to the standalone `disk-info.jsx` / `ram-info.jsx` widgets (they do
  not appear in the panel layout from the screenshot).

## Overlap analysis (why this scope)

| Capability                       | Already exists?      | Where |
| -------------------------------- | -------------------- | ----- |
| RAM purge (admin)                | Yes                  | `panel-info.jsx` `purgeRam` → `PRG` chip |
| RAM free / pressure / top hog    | Yes                  | Memory tile readout |
| Disk free / used %               | Yes                  | Disk tile readout |
| APFS snapshot thinning           | Yes                  | `panel-info.jsx` `clearPurge` → `CLR` chip |
| Cache cleanup                    | **No**               | — |
| Ollama model removal             | **No**               | — |
| Downloads installer cleanup      | **No**               | — |
| Empty Trash                      | **No**               | — |

The new value is the bottom four rows. Everything else stays untouched.

## Design

### Trigger

The `CLR` chip on the Disk tile keeps rendering only when `hasPurgeable` is
true. Its `onAction` changes from "run thinlocalsnapshots directly" to "toggle
the cleanup popup".

### Popup mechanism

Reuse the existing help-popup pattern from `vibe-actions.jsx`:

- A hidden `<div data-pi-cleanup>` rendered inside the panel root, `display:none`
  by default.
- A module-level toggle function (`__toggleCleanup`) flips `style.display`
  between `block` and `none` and tracks an `__cleanupVisible` boolean.
- The existing outside-click handler pattern closes the popup when a click lands
  outside the popup and outside the `CLR` chip. Mirror the `vibe-actions.jsx`
  document `mousedown`/click handler that checks `popup.contains(e.target)`.

The popup is anchored visually near the Disk tile (absolute-positioned within the
panel root). Exact offset tuned during implementation to sit below the Disk cell.

### Menu items

Each item is a row: label on the left, optional size hint on the right, click to
run. Order top to bottom:

| # | Label              | Action                                                                 | Confirm |
| - | ------------------ | ---------------------------------------------------------------------- | ------- |
| 1 | Snapshots APFS     | `tmutil thinlocalsnapshots / 999999999999 4` (current CLR behavior)    | direct  |
| 2 | Caches             | `rm -rf ~/Library/Caches/* ~/Library/Application\ Support/Caches/*`     | direct  |
| 3 | Modelos Ollama     | list models, pick, `ollama rm <model>`                                 | dialog  |
| 4 | Downloads          | remove stale installers (`*.dmg *.pkg *.zip *.rar`) in `~/Downloads`   | dialog  |
| 5 | Esvaziar Lixeira   | empty Trash via `osascript ... tell app "Finder" to empty trash`       | dialog  |

After any successful action, fire a macOS notification (`display notification`)
mirroring the existing `clearPurge` / `purgeRam` style, and close the popup.

### Safety model (per earlier decision: "native confirmation per action")

- **Direct (no dialog):** Snapshots, Caches — both fully regenerable, low risk.
- **Native dialog before running:** Ollama, Downloads, Trash. The dialog text
  states the space freed, computed on demand.

Confirmation dialogs are `osascript -e 'display dialog "…" buttons {"Cancelar","Limpar"} default button "Cancelar"'`.
Cancel (or non-default button) → no-op. Default button is the safe one
(Cancelar) so an accidental Return does nothing.

### Size computation (on demand, not in refresh)

Sizes are never computed in the panel `command`. They are computed only when the
user clicks a destructive item, inside the same shell invocation that shows the
dialog:

```sh
# pattern for a destructive item
SZ=$(du -shc <targets> 2>/dev/null | tail -1 | awk '{print $1}')
osascript -e "display dialog \"Libera ~${SZ}. Confirmar?\" buttons {\"Cancelar\",\"Limpar\"} default button \"Cancelar\"" \
  && rm -rf <targets> \
  && osascript -e 'display notification "Limpeza concluída" with title "Disk" sound name "Pop"'
```

The Ollama item is special: it runs `ollama list` to enumerate models, presents
them in an `osascript ... choose from list`, then `ollama rm` the chosen model.
If `ollama` is not on PATH, the item shows a "Ollama não instalado" notification
and does nothing.

### Action wiring

New module-level functions in `panel-info.jsx`, alongside `clearPurge` /
`purgeRam`:

- `__toggleCleanup(e)` — popup show/hide.
- `cleanSnapshots()` — current `clearPurge` body.
- `cleanCaches()` — direct cache removal + notification.
- `cleanOllama()` — list/pick/remove flow.
- `cleanDownloads()` — installer sweep with dialog.
- `emptyTrash()` — Trash empty with dialog.

Each destructive function ends by closing the popup (`__cleanupVisible = false`,
set `display:none`).

## Components / boundaries

- **`panel-info.jsx`** is the only file changed.
- The popup `<div data-pi-cleanup>` is self-contained: it renders the five menu
  rows and depends only on the `run()` helper and the module-level action
  functions.
- The `Cell` component (line ~216) is unchanged; only the `onAction` passed to
  the Disk cell changes from `clearPurge` to `__toggleCleanup`.

## Error handling

- Each shell action ends with `|| true`-style tolerance so a partial failure
  (locked file in a cache dir) does not surface a raw error; the notification
  still fires on the parts that succeeded.
- `ollama` missing → friendly notification, no error.
- Dialog cancel → silent no-op (the `&&` chain stops).
- Empty Downloads / no installers → notification "Nada a remover".

## Testing / verification

Übersicht widgets are not unit-testable in isolation; verification is manual:

1. `sync.sh` to copy the edited widget into the live Übersicht widgets dir.
2. Reload the widget in Übersicht.
3. Click `CLR` → popup opens; click outside → closes.
4. Caches item → runs, notification fires, no dialog.
5. Ollama item with a model present → list dialog appears; pick → `ollama rm`
   runs; verify with `ollama list`.
6. Downloads item → dialog shows a size; Cancel → nothing removed; Confirm →
   installers gone.
7. Trash item → dialog; Confirm → Trash empties.
8. Snapshots item → existing behavior intact.

Each destructive path is verified once with a disposable target before trusting
it on real data.

## Rollout

Single commit on `feat/panel-cleanup-menu`. After manual verification via
`sync.sh`, merge to `main`. No migration, no config.
