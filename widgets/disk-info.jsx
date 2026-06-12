// Disk Info widget — shows HD used | purgeable | free
// Uses Swift volumeAvailableCapacityForImportantUsage API (matches Finder)
// Click "Clear" on Purgeable row to thin Time Machine local snapshots
// Refresh every 30 seconds

import { run } from 'uebersicht';

export const command = `swift "$HOME/Library/Application Support/Übersicht/widgets/disk-info.swift"`;

export const refreshFrequency = 30000;

export const className = `
  top: 20px;
  right: 20px;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
  color: #fff;
  background: rgba(20, 20, 24, 0.78);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 14px 18px;
  width: 240px;
  box-sizing: border-box;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
  font-size: 12px;
  line-height: 1.4;
`;

const __snapPos_disk_info = (left, top, w) => {
  const elW = w.offsetWidth;
  const elH = w.offsetHeight;
  const winW = window.innerWidth;
  const winH = window.innerHeight;
  const EDGE = 16, ALIGN = 8, GRID = 20;
  let sL = left, sT = top;
  let snappedX = false, snappedY = false;

  if (Math.abs(left) < EDGE) { sL = 0; snappedX = true; }
  else if (Math.abs(left + elW - winW) < EDGE) { sL = winW - elW; snappedX = true; }
  if (Math.abs(top) < EDGE) { sT = 0; snappedY = true; }
  else if (Math.abs(top + elH - winH) < EDGE) { sT = winH - elH; snappedY = true; }

  const cX = (winW - elW) / 2, cY = (winH - elH) / 2;
  if (!snappedX && Math.abs(left - cX) < EDGE) { sL = cX; snappedX = true; }
  if (!snappedY && Math.abs(top - cY) < EDGE) { sT = cY; snappedY = true; }

  document.querySelectorAll('[id$="-jsx"]').forEach(other => {
    if (other === w) return;
    const r = other.getBoundingClientRect();
    if (!snappedY) {
      if (Math.abs(top - r.top) < ALIGN) { sT = r.top; snappedY = true; }
      else if (Math.abs(top + elH - (r.top + r.height)) < ALIGN) { sT = r.top + r.height - elH; snappedY = true; }
      else if (Math.abs(top - (r.top + r.height + 12)) < ALIGN) { sT = r.top + r.height + 12; snappedY = true; }
      else if (Math.abs(top + elH + 12 - r.top) < ALIGN) { sT = r.top - elH - 12; snappedY = true; }
    }
    if (!snappedX) {
      if (Math.abs(left - r.left) < ALIGN) { sL = r.left; snappedX = true; }
      else if (Math.abs(left + elW - (r.left + r.width)) < ALIGN) { sL = r.left + r.width - elW; snappedX = true; }
      else if (Math.abs(left - (r.left + r.width + 12)) < ALIGN) { sL = r.left + r.width + 12; snappedX = true; }
      else if (Math.abs(left + elW + 12 - r.left) < ALIGN) { sL = r.left - elW - 12; snappedX = true; }
    }
  });

  if (!snappedX) sL = Math.round(left / GRID) * GRID;
  if (!snappedY) sT = Math.round(top / GRID) * GRID;
  return { left: sL, top: sT };
};

const __dragKey_disk_info = "ubersicht-pos-disk-info";
const __dragRef_disk_info = (el) => {
  if (!el) return;
  let w = el.parentElement;
  while (w && w !== document.body) {
    const cs = window.getComputedStyle(w);
    if (cs.position === "absolute" || cs.position === "fixed") break;
    w = w.parentElement;
  }
  if (!w) return;
  if (w.__dragInit_disk_info) return;
  w.__dragInit_disk_info = true;

  try {
    const saved = localStorage.getItem(__dragKey_disk_info);
    if (saved) {
      const p = JSON.parse(saved);
      w.style.top = p.top + "px";
      w.style.left = p.left + "px";
      w.style.right = "auto";
      w.style.bottom = "auto";
    }
  } catch (e) {}

  w.style.cursor = "move";
  w.style.userSelect = "none";

  let dragging = false, ox = 0, oy = 0;

  w.addEventListener("mousedown", (e) => {
    dragging = true;
    const r = w.getBoundingClientRect();
    ox = e.clientX - r.left;
    oy = e.clientY - r.top;
    w.style.opacity = "0.85";
    w.style.transition = "none";
    w.style.zIndex = "9999";
    w.style.outline = "2px solid rgba(0,122,255,0.4)";
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const rawL = e.clientX - ox;
    const rawT = e.clientY - oy;
    const snapped = __snapPos_disk_info(rawL, rawT, w);
    w.style.left = snapped.left + "px";
    w.style.top = snapped.top + "px";
    w.style.right = "auto";
    w.style.bottom = "auto";
  });

  document.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    w.style.opacity = "1";
    w.style.outline = "";
    const r = w.getBoundingClientRect();
    try {
      localStorage.setItem(__dragKey_disk_info, JSON.stringify({ top: Math.round(r.top), left: Math.round(r.left) }));
    } catch (e) {}
  });
};


const fmtGB = (bytes) => {
  const gb = bytes / 1e9;
  return gb >= 100 ? `${gb.toFixed(0)} GB` : `${gb.toFixed(1)} GB`;
};

export const render = ({ output }) => {
  if (!output) return <div ref={__dragRef_disk_info}>Loading…</div>;

  const parts = output.trim().split("|").map(Number);
  const [total, used, free, purgeable] = parts;
  if (!total) return <div ref={__dragRef_disk_info}>—</div>;

  const usedPct = (used / total) * 100;
  const purgePct = (purgeable / total) * 100;
  const freePct = (free / total) * 100;
  const availPct = ((free + purgeable) / total) * 100;

  let usedColor = "#34c759";
  if (usedPct >= 90) usedColor = "#ff3b30";
  else if (usedPct >= 75) usedColor = "#ff9500";

  return (
    <div ref={__dragRef_disk_info}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
      }}>
        <span style={{ fontWeight: 600, fontSize: 11, letterSpacing: 0.5, opacity: 0.6, textTransform: "uppercase" }}>
          Macintosh HD
        </span>
        <span style={{ fontWeight: 700, fontSize: 14, color: usedColor }}>
          {usedPct.toFixed(0)}%
        </span>
      </div>

      <div style={{
        display: "flex",
        height: 6,
        background: "rgba(255,255,255,0.1)",
        borderRadius: 3,
        overflow: "hidden",
        marginBottom: 10,
      }}>
        <div style={{
          width: `${usedPct}%`,
          height: "100%",
          background: usedColor,
          transition: "width 0.5s ease, background 0.3s ease",
        }} />
        <div style={{
          width: `${purgePct}%`,
          height: "100%",
          background: "#ffcc00",
          opacity: 0.7,
          transition: "width 0.5s ease",
        }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.85 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: usedColor, display: "inline-block" }} />
          Used
        </span>
        <span style={{ fontWeight: 600 }}>{fmtGB(used)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.85, marginTop: 4 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: "#ffcc00", opacity: 0.7, display: "inline-block" }} />
          Purgeable
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {purgeable > 100 * 1e6 && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                run(`tmutil thinlocalsnapshots / 999999999999 4 && osascript -e 'display notification "Purgeable cleared" with title "Disk" sound name "Pop"'`);
              }}
              style={{
                fontSize: 9,
                padding: "2px 6px",
                background: "rgba(255,204,0,0.15)",
                border: "1px solid rgba(255,204,0,0.35)",
                borderRadius: 4,
                color: "#ffcc00",
                cursor: "pointer",
                fontWeight: 600,
                letterSpacing: 0.3,
                textTransform: "uppercase",
              }}
            >
              Clear
            </span>
          )}
          <span style={{ fontWeight: 600 }}>{fmtGB(purgeable)}</span>
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.85, marginTop: 4 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: "rgba(255,255,255,0.2)", display: "inline-block" }} />
          Free
        </span>
        <span style={{ fontWeight: 600 }}>{fmtGB(free)}</span>
      </div>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        opacity: 0.5,
        marginTop: 8,
        paddingTop: 6,
        borderTop: "1px solid rgba(255,255,255,0.08)",
        fontSize: 11,
      }}>
        <span>Available</span>
        <span>{fmtGB(free + purgeable)} / {fmtGB(total)}</span>
      </div>
    </div>
  );
};
