# Übersicht Panel

System dashboard for macOS Apple Silicon — single 2×4 grid widget plus 7 standalone widgets.

## Cells

| Row 1 | Clock | Stay Awake (toggle) | Battery | GPU + VRAM |
|-------|-------|---------------------|---------|------------|
| **Row 2** | Disk (+ Clear purgeable) | Memory (+ Purge admin) | CPU | Network (en* + utun*) |

All widgets draggable with snap, position persisted in `localStorage`.

## Requirements

- macOS 13+ Apple Silicon (M1/M2/M3/M4)
- [Übersicht.app](https://tracesof.net/uebersicht/)
- Swift toolchain (Xcode CLT) for disk widget

## Install

```bash
gh repo clone julioferracini/ubersicht-panel-monitoring ~/dev/ubersicht-panel-monitoring
# or: git clone https://github.com/julioferracini/ubersicht-panel-monitoring.git ~/dev/ubersicht-panel-monitoring
cd ~/dev/ubersicht-panel-monitoring
./install.sh
```

`install.sh` symlinks each `.jsx`/`.swift` from `widgets/` into `~/Library/Application Support/Übersicht/widgets/` so future `git pull` updates apply live.

## Update

```bash
cd ~/dev/ubersicht-panel
git pull
# Übersicht auto-reloads on file change
```

## Uninstall

```bash
./uninstall.sh
```

Removes symlinks only. Repo and Übersicht itself untouched.

## Files

- `widgets/panel-info.jsx` — consolidated 2×4 dashboard
- `widgets/{clock,stay-awake,battery-info,disk-info,gpu-info,ram-info,cpu-info}.jsx` — standalone versions
- `widgets/disk-info.swift` — uses `volumeAvailableCapacityForImportantUsage` (matches Finder numbers)

## Notes

- Stay-awake toggles `caffeinate -dimsu` — survives terminal close, dies on reboot
- Disk Clear runs `tmutil thinlocalsnapshots / 999999999999 4` (no sudo)
- RAM Purge runs `sudo purge` via `osascript` admin prompt
- Network aggregates `en*` (physical) + `utun*` (VPN tunnels — Palo Alto GlobalProtect etc.)
- GPU sampling: delta `busy_ms` over 500 ms window (Apple Silicon reports 0% when idle deep, so cumulative delta is more reliable)
