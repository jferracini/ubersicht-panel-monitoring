// GPU Info widget — Apple Silicon GPU utilization (delta-sampled) + VRAM usage
// Apple Silicon "Device Utilization %" reports 0 when GPU sleeps deeply,
// so we sample cumulative busy_ms over 500ms window for real activity.
// Refresh every 2 seconds

export const command = `
  SAMPLE_MS=500
  get_busy() {
    ioreg -r -k "PerformanceStatistics" -d 1 2>/dev/null | head -1 \\
      | grep -oE 'busy [0-9]+ \\([0-9]+ ms\\)' | grep -oE '\\([0-9]+' | tr -d '('
  }
  T0=$(get_busy); T0=\${T0:-0}
  sleep 0.5
  T1=$(get_busy); T1=\${T1:-0}
  delta=$((T1 - T0))
  util=$((delta * 100 / SAMPLE_MS))
  [ $util -gt 100 ] && util=100
  [ $util -lt 0 ] && util=0

  STATS=$(ioreg -r -k "PerformanceStatistics" -d 1 2>/dev/null | grep -oE '"PerformanceStatistics" = \\{[^}]+\\}' | head -1)
  tiler=$(echo "$STATS" | grep -oE '"Tiler Utilization %"=[0-9]+' | head -1 | sed 's/.*=//')
  renderer=$(echo "$STATS" | grep -oE '"Renderer Utilization %"=[0-9]+' | head -1 | sed 's/.*=//')
  vram_used=$(echo "$STATS" | grep -oE '"In use system memory"=[0-9]+' | head -1 | sed 's/.*=//')
  vram_alloc=$(echo "$STATS" | grep -oE '"Alloc system memory"=[0-9]+' | head -1 | sed 's/.*=//')
  tiler=\${tiler:-0}; renderer=\${renderer:-0}
  vram_used=\${vram_used:-0}; vram_alloc=\${vram_alloc:-0}
  vram_used_mb=$(( vram_used / 1048576 ))
  vram_alloc_mb=$(( vram_alloc / 1048576 ))
  echo "$util|$tiler|$renderer|$vram_used_mb|$vram_alloc_mb"
`;

export const refreshFrequency = 2000;

export const className = `
  top: 320px;
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

const __snapPos_gpu_info = (left, top, w) => {
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

const __dragKey_gpu_info = "ubersicht-pos-gpu-info";
const __dragRef_gpu_info = (el) => {
  if (!el) return;
  let w = el.parentElement;
  while (w && w !== document.body) {
    const cs = window.getComputedStyle(w);
    if (cs.position === "absolute" || cs.position === "fixed") break;
    w = w.parentElement;
  }
  if (!w) return;
  if (w.__dragInit_gpu_info) return;
  w.__dragInit_gpu_info = true;

  try {
    const saved = localStorage.getItem(__dragKey_gpu_info);
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
    const snapped = __snapPos_gpu_info(rawL, rawT, w);
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
      localStorage.setItem(__dragKey_gpu_info, JSON.stringify({ top: Math.round(r.top), left: Math.round(r.left) }));
    } catch (e) {}
  });
};


export const render = ({ output }) => {
  if (!output) return <div ref={__dragRef_gpu_info}>Loading…</div>;

  const [util, tiler, renderer, vramUsed, vramAlloc] = output.trim().split("|");
  const utilNum = parseInt(util, 10) || 0;

  let barColor = "#34c759";
  if (utilNum >= 80) barColor = "#ff3b30";
  else if (utilNum >= 50) barColor = "#ff9500";

  const SubBar = ({ label, value }) => {
    const v = parseInt(value, 10) || 0;
    return (
      <div ref={__dragRef_gpu_info} style={{ marginTop: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, opacity: 0.6, marginBottom: 2 }}>
          <span>{label}</span>
          <span>{v}%</span>
        </div>
        <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            width: `${v}%`,
            height: "100%",
            background: "rgba(255,255,255,0.5)",
            borderRadius: 2,
            transition: "width 0.3s ease",
          }} />
        </div>
      </div>
    );
  };

  return (
    <div ref={__dragRef_gpu_info}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
      }}>
        <span style={{ fontWeight: 600, fontSize: 11, letterSpacing: 0.5, opacity: 0.6, textTransform: "uppercase" }}>
          GPU
        </span>
        <span style={{ fontWeight: 700, fontSize: 14, color: barColor }}>
          {utilNum}%
        </span>
      </div>

      <div style={{
        height: 6,
        background: "rgba(255,255,255,0.1)",
        borderRadius: 3,
        overflow: "hidden",
        marginBottom: 4,
      }}>
        <div style={{
          width: `${utilNum}%`,
          height: "100%",
          background: barColor,
          borderRadius: 3,
          transition: "width 0.3s ease, background 0.3s ease",
        }} />
      </div>

      <SubBar label="Tiler" value={tiler} />
      <SubBar label="Renderer" value={renderer} />

      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, opacity: 0.6, marginBottom: 2 }}>
          <span>VRAM</span>
          <span>{vramUsed} / {vramAlloc} MB</span>
        </div>
        <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            width: `${Math.min(100, (parseInt(vramUsed,10) / Math.max(1, parseInt(vramAlloc,10))) * 100)}%`,
            height: "100%",
            background: "#5ac8fa",
            borderRadius: 2,
            transition: "width 0.3s ease",
          }} />
        </div>
      </div>
    </div>
  );
};
