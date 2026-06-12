// RAM Info widget — shows free / pressure / top hog
// Click "Purge" to flush inactive memory (prompts admin password)
// Refresh every 5 seconds

import { run } from 'uebersicht';

export const command = `
  PAGE_SIZE=$(vm_stat | head -1 | grep -oE '[0-9]+')
  STATS=$(vm_stat)
  free=$(echo "$STATS" | awk '/Pages free/ {gsub("\\\\.","",$3); print $3}')
  active=$(echo "$STATS" | awk '/Pages active/ {gsub("\\\\.","",$3); print $3}')
  inactive=$(echo "$STATS" | awk '/Pages inactive/ {gsub("\\\\.","",$3); print $3}')
  wired=$(echo "$STATS" | awk '/Pages wired down/ {gsub("\\\\.","",$4); print $4}')
  compressed=$(echo "$STATS" | awk '/occupied by compressor/ {gsub("\\\\.","",$5); print $5}')
  total_bytes=$(sysctl -n hw.memsize)
  total_gb=$(echo "scale=2; $total_bytes / 1073741824" | bc)
  free_gb=$(echo "scale=2; ($free + $inactive) * $PAGE_SIZE / 1073741824" | bc)
  used_gb=$(echo "scale=2; $total_gb - $free_gb" | bc)
  pct=$(echo "scale=0; $used_gb * 100 / $total_gb" | bc)
  pressure=$(memory_pressure 2>/dev/null | awk '/System-wide memory free percentage/ {print $5}' | tr -d '%')
  top_hog=$(ps -axo rss,comm | sort -rn | head -1 | awk '{mb=$1/1024; full=""; for(i=2;i<=NF;i++) full = full (i>2?" ":"") $i; n=split(full, parts, "/"); name=parts[n]; if(length(name)>22) name=substr(name,1,22)"…"; printf "%.0f|%s", mb, name}')
  echo "$total_gb|$used_gb|$free_gb|$pct|$pressure|$top_hog"
`;

export const refreshFrequency = 5000;

export const className = `
  top: 160px;
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

const __snapPos_ram_info = (left, top, w) => {
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

const __dragKey_ram_info = "ubersicht-pos-ram-info";
const __dragRef_ram_info = (el) => {
  if (!el) return;
  let w = el.parentElement;
  while (w && w !== document.body) {
    const cs = window.getComputedStyle(w);
    if (cs.position === "absolute" || cs.position === "fixed") break;
    w = w.parentElement;
  }
  if (!w) return;
  if (w.__dragInit_ram_info) return;
  w.__dragInit_ram_info = true;

  try {
    const saved = localStorage.getItem(__dragKey_ram_info);
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
    const snapped = __snapPos_ram_info(rawL, rawT, w);
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
      localStorage.setItem(__dragKey_ram_info, JSON.stringify({ top: Math.round(r.top), left: Math.round(r.left) }));
    } catch (e) {}
  });
};


export const render = ({ output }) => {
  if (!output) return <div ref={__dragRef_ram_info}>Loading…</div>;

  const parts = output.trim().split("|");
  const [total, used, free, pct, pressure, hog_mb, hog_name] = parts;
  const pctNum = parseInt(pct, 10) || 0;

  let barColor = "#34c759";
  if (pctNum >= 85) barColor = "#ff3b30";
  else if (pctNum >= 70) barColor = "#ff9500";

  return (
    <div ref={__dragRef_ram_info}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
      }}>
        <span style={{ fontWeight: 600, fontSize: 11, letterSpacing: 0.5, opacity: 0.6, textTransform: "uppercase" }}>
          Memory
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            onClick={(e) => {
              e.stopPropagation();
              run(`osascript -e 'do shell script "purge" with administrator privileges' && osascript -e 'display notification "Inactive memory purged" with title "Memory" sound name "Pop"'`);
            }}
            style={{
              fontSize: 9,
              padding: "2px 6px",
              background: "rgba(52,199,89,0.15)",
              border: "1px solid rgba(52,199,89,0.35)",
              borderRadius: 4,
              color: "#34c759",
              cursor: "pointer",
              fontWeight: 600,
              letterSpacing: 0.3,
              textTransform: "uppercase",
            }}
          >
            Purge
          </span>
          <span style={{ fontWeight: 700, fontSize: 14, color: barColor }}>
            {pct}%
          </span>
        </span>
      </div>

      <div style={{
        height: 6,
        background: "rgba(255,255,255,0.1)",
        borderRadius: 3,
        overflow: "hidden",
        marginBottom: 10,
      }}>
        <div style={{
          width: `${pctNum}%`,
          height: "100%",
          background: barColor,
          borderRadius: 3,
          transition: "width 0.5s ease, background 0.3s ease",
        }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.85 }}>
        <span>Free</span>
        <span style={{ fontWeight: 600 }}>{free} GB</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.6, marginTop: 2 }}>
        <span>Used</span>
        <span>{used} / {total} GB</span>
      </div>
      {hog_name && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)", opacity: 0.7, fontSize: 11 }}>
          <span style={{ opacity: 0.6 }}>Top: </span>
          <span style={{ fontWeight: 600 }}>{hog_name}</span>
          <span style={{ opacity: 0.5 }}> · {hog_mb} MB</span>
        </div>
      )}
    </div>
  );
};
