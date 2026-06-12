// CPU Info widget — usage %, load avg, temp (if available)
// Refresh every 2 seconds

export const command = `
  CPU_LINE=$(top -l 2 -n 0 -s 1 2>/dev/null | grep "CPU usage" | tail -1)
  user_pct=$(echo "$CPU_LINE" | awk '{print $3}' | tr -d '%')
  sys_pct=$(echo "$CPU_LINE" | awk '{print $5}' | tr -d '%')
  idle_pct=$(echo "$CPU_LINE" | awk '{print $7}' | tr -d '%')
  user_pct=\${user_pct:-0}; sys_pct=\${sys_pct:-0}; idle_pct=\${idle_pct:-0}
  total_pct=$(echo "scale=0; (100 - $idle_pct) / 1" | bc 2>/dev/null)
  total_pct=\${total_pct:-0}
  LOAD=$(sysctl -n vm.loadavg | tr -d '{}')
  load_1=$(echo "$LOAD" | awk '{print $1}')
  load_5=$(echo "$LOAD" | awk '{print $2}')
  load_15=$(echo "$LOAD" | awk '{print $3}')
  cores=$(sysctl -n hw.ncpu)
  temp=$(osx-cpu-temp 2>/dev/null | grep -oE '[0-9.]+' | head -1)
  temp=\${temp:-0}
  top_proc=$(ps -axo pcpu,comm | sort -rn | head -1 | awk '{cpu=$1; full=""; for(i=2;i<=NF;i++) full = full (i>2?" ":"") $i; n=split(full, parts, "/"); name=parts[n]; if(length(name)>22) name=substr(name,1,22)"…"; printf "%.0f|%s", cpu, name}')
  echo "$total_pct|$user_pct|$sys_pct|$load_1|$load_5|$load_15|$cores|$temp|$top_proc"
`;

export const refreshFrequency = 2000;

export const className = `
  top: 480px;
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

const __snapPos_cpu_info = (left, top, w) => {
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

const __dragKey_cpu_info = "ubersicht-pos-cpu-info";
const __dragRef_cpu_info = (el) => {
  if (!el) return;
  let w = el.parentElement;
  while (w && w !== document.body) {
    const cs = window.getComputedStyle(w);
    if (cs.position === "absolute" || cs.position === "fixed") break;
    w = w.parentElement;
  }
  if (!w) return;
  if (w.__dragInit_cpu_info) return;
  w.__dragInit_cpu_info = true;

  try {
    const saved = localStorage.getItem(__dragKey_cpu_info);
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
    const snapped = __snapPos_cpu_info(rawL, rawT, w);
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
      localStorage.setItem(__dragKey_cpu_info, JSON.stringify({ top: Math.round(r.top), left: Math.round(r.left) }));
    } catch (e) {}
  });
};


export const render = ({ output }) => {
  if (!output) return <div ref={__dragRef_cpu_info}>Loading…</div>;

  const [total, user, sys, l1, l5, l15, cores, temp, hogCpu, hogName] = output.trim().split("|");
  const totalNum = parseFloat(total) || 0;
  const tempNum = parseFloat(temp) || 0;
  const loadNum = parseFloat(l1) || 0;
  const coresNum = parseInt(cores, 10) || 1;
  const loadPctOfCores = (loadNum / coresNum) * 100;

  let barColor = "#34c759";
  if (totalNum >= 80) barColor = "#ff3b30";
  else if (totalNum >= 50) barColor = "#ff9500";

  return (
    <div ref={__dragRef_cpu_info}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
      }}>
        <span style={{ fontWeight: 600, fontSize: 11, letterSpacing: 0.5, opacity: 0.6, textTransform: "uppercase" }}>
          CPU
        </span>
        <span style={{ fontWeight: 700, fontSize: 14, color: barColor }}>
          {totalNum.toFixed(0)}%
        </span>
      </div>

      <div style={{
        height: 6,
        background: "rgba(255,255,255,0.1)",
        borderRadius: 3,
        overflow: "hidden",
        marginBottom: 10,
        display: "flex",
      }}>
        <div style={{
          width: `${parseFloat(user) || 0}%`,
          height: "100%",
          background: barColor,
          transition: "width 0.3s ease",
        }} />
        <div style={{
          width: `${parseFloat(sys) || 0}%`,
          height: "100%",
          background: "rgba(255,255,255,0.4)",
          transition: "width 0.3s ease",
        }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.85, fontSize: 11 }}>
        <span>User</span>
        <span style={{ fontWeight: 600 }}>{parseFloat(user).toFixed(1)}%</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.6, marginTop: 2, fontSize: 11 }}>
        <span>System</span>
        <span>{parseFloat(sys).toFixed(1)}%</span>
      </div>

      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", opacity: 0.7, fontSize: 11 }}>
        <span style={{ opacity: 0.6 }}>Load avg</span>
        <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {l1} <span style={{ opacity: 0.4 }}>· {l5} · {l15}</span>
        </span>
      </div>

      {tempNum > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.7, marginTop: 2, fontSize: 11 }}>
          <span style={{ opacity: 0.6 }}>Temp</span>
          <span style={{ fontWeight: 600 }}>{tempNum.toFixed(1)}°C</span>
        </div>
      )}

      {hogName && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)", opacity: 0.7, fontSize: 11 }}>
          <span style={{ opacity: 0.6 }}>Top: </span>
          <span style={{ fontWeight: 600 }}>{hogName}</span>
          <span style={{ opacity: 0.5 }}> · {hogCpu}%</span>
        </div>
      )}
    </div>
  );
};
