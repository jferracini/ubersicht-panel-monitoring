// Battery Info widget — %, charging state, time, cycle, health
// Refresh every 10 seconds

export const command = `
  BATT=$(pmset -g batt 2>/dev/null)
  pct=$(echo "$BATT" | grep -oE '[0-9]+%' | head -1 | tr -d '%')
  state=$(echo "$BATT" | grep -oE '(charged|charging|discharging|finishing charge|AC attached; not charging)' | head -1)
  time_rem=$(echo "$BATT" | grep -oE '[0-9]+:[0-9]+ remaining' | head -1 | awk '{print $1}')
  power_src=$(echo "$BATT" | grep -oE "AC Power|Battery Power" | head -1)
  IOREG=$(ioreg -rn AppleSmartBattery 2>/dev/null)
  cycle=$(echo "$IOREG" | awk -F'= ' '/^[[:space:]]+"CycleCount"[[:space:]]*=/ {gsub(/[^0-9]/,"",$2); print $2; exit}')
  max_cap=$(echo "$IOREG" | awk -F'= ' '/^[[:space:]]+"AppleRawMaxCapacity"[[:space:]]*=/ {gsub(/[^0-9]/,"",$2); print $2; exit}')
  design_cap=$(echo "$IOREG" | awk -F'= ' '/^[[:space:]]+"DesignCapacity"[[:space:]]*=/ {gsub(/[^0-9]/,"",$2); print $2; exit}')
  cycle=\${cycle:-0}; max_cap=\${max_cap:-0}; design_cap=\${design_cap:-0}
  if [ "$design_cap" -gt 0 ]; then
    health=$(echo "scale=0; $max_cap * 100 / $design_cap" | bc)
  else
    health=100
  fi
  pct=\${pct:-0}; state=\${state:-unknown}; time_rem=\${time_rem:-}
  echo "$pct|$state|$time_rem|$power_src|$cycle|$health"
`;

export const refreshFrequency = 10000;

export const className = `
  top: 200px;
  left: 20px;
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

const __snapPos_battery_info = (left, top, w) => {
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

const __dragKey_battery_info = "ubersicht-pos-battery-info";
const __dragRef_battery_info = (el) => {
  if (!el) return;
  let w = el.parentElement;
  while (w && w !== document.body) {
    const cs = window.getComputedStyle(w);
    if (cs.position === "absolute" || cs.position === "fixed") break;
    w = w.parentElement;
  }
  if (!w) return;
  if (w.__dragInit_battery_info) return;
  w.__dragInit_battery_info = true;

  try {
    const saved = localStorage.getItem(__dragKey_battery_info);
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
    const snapped = __snapPos_battery_info(rawL, rawT, w);
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
      localStorage.setItem(__dragKey_battery_info, JSON.stringify({ top: Math.round(r.top), left: Math.round(r.left) }));
    } catch (e) {}
  });
};


export const render = ({ output }) => {
  if (!output) return <div ref={__dragRef_battery_info}>Loading…</div>;

  const [pct, state, timeRem, powerSrc, cycle, health] = output.trim().split("|");
  const pctNum = parseInt(pct, 10) || 0;
  const isCharging = /charging|finishing/.test(state) && !/not charging/.test(state);
  const isFull = /charged/.test(state);
  const onAC = /AC Power/.test(powerSrc);

  let barColor = "#34c759";
  if (pctNum <= 10) barColor = "#ff3b30";
  else if (pctNum <= 20) barColor = "#ff9500";
  if (isCharging) barColor = "#30d158";

  let statusLabel = state;
  if (isFull) statusLabel = "Charged";
  else if (isCharging) statusLabel = "Charging";
  else if (onAC) statusLabel = "AC · Not charging";
  else statusLabel = "On battery";

  let healthColor = "#34c759";
  const healthNum = parseInt(health, 10);
  if (healthNum < 80) healthColor = "#ff9500";
  if (healthNum < 70) healthColor = "#ff3b30";

  return (
    <div ref={__dragRef_battery_info}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
      }}>
        <span style={{ fontWeight: 600, fontSize: 11, letterSpacing: 0.5, opacity: 0.6, textTransform: "uppercase" }}>
          Battery
        </span>
        <span style={{ fontWeight: 700, fontSize: 14, color: barColor }}>
          {pctNum}% {isCharging ? "⚡" : ""}
        </span>
      </div>

      <div style={{
        height: 8,
        background: "rgba(255,255,255,0.1)",
        borderRadius: 4,
        overflow: "hidden",
        marginBottom: 10,
        position: "relative",
      }}>
        <div style={{
          width: `${pctNum}%`,
          height: "100%",
          background: barColor,
          borderRadius: 4,
          transition: "width 0.5s ease, background 0.3s ease",
        }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.85, fontSize: 11 }}>
        <span>Status</span>
        <span style={{ fontWeight: 600 }}>{statusLabel}</span>
      </div>

      {timeRem && timeRem !== "0:00" && !isFull && (
        <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.7, marginTop: 2, fontSize: 11 }}>
          <span style={{ opacity: 0.6 }}>{isCharging ? "Until full" : "Remaining"}</span>
          <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{timeRem}</span>
        </div>
      )}

      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", opacity: 0.7, fontSize: 11 }}>
        <span style={{ opacity: 0.6 }}>Cycles</span>
        <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{cycle}</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.7, marginTop: 2, fontSize: 11 }}>
        <span style={{ opacity: 0.6 }}>Health</span>
        <span style={{ fontWeight: 600, color: healthColor }}>{health}%</span>
      </div>
    </div>
  );
};
