// Panel Info — 2x4 grid combining clock, stay-awake, battery, gpu, disk, ram, cpu, net
// Refresh every 3s. Stay-awake toggle, Disk CLR cleanup menu, Memory MEM menu (pressure/swap + top apps). Drag to reposition.
//
// Coexists with the 7 individual widgets — disable them in Übersicht menu if desired.

import { run } from 'uebersicht';

export const command = `
  # ---- clock ----
  hour=$(date +"%H"); minute=$(date +"%M"); second=$(date +"%S")
  day_name=$(date +"%A"); date_full=$(date +"%d %b %Y")

  # ---- stay-awake ----
  caf_pid=$(pgrep -f "caffeinate -dimsu" | head -1 | tr -d '\\n')

  # ---- battery ----
  BATT=$(pmset -g batt 2>/dev/null)
  bat_pct=$(echo "$BATT" | grep -oE '[0-9]+%' | head -1 | tr -d '%')
  bat_state=$(echo "$BATT" | grep -oE '(charged|charging|discharging|finishing charge|AC attached; not charging)' | head -1)
  bat_time=$(echo "$BATT" | grep -oE '[0-9]+:[0-9]+ remaining' | head -1 | awk '{print $1}')
  bat_pct=\${bat_pct:-0}; bat_state=\${bat_state:-unknown}; bat_time=\${bat_time:-}

  # ---- disk (via Swift helper, falls back to df) ----
  DISK_OUT=$(swift "$HOME/Library/Application Support/Übersicht/widgets/disk-info.swift" 2>/dev/null)
  [ -z "$DISK_OUT" ] && DISK_OUT="0|0|0|0"

  # ---- ram ----
  PAGE_SIZE=$(vm_stat | head -1 | grep -oE '[0-9]+')
  VM=$(vm_stat)
  rfree=$(echo "$VM" | awk '/Pages free/ {gsub("\\\\.","",$3); print $3}')
  rinactive=$(echo "$VM" | awk '/Pages inactive/ {gsub("\\\\.","",$3); print $3}')
  total_b=$(sysctl -n hw.memsize)
  ram_total=$(echo "scale=1; $total_b / 1073741824" | bc)
  ram_free=$(echo "scale=1; ($rfree + $rinactive) * $PAGE_SIZE / 1073741824" | bc)
  ram_used=$(echo "scale=1; $ram_total - $ram_free" | bc)
  ram_pct=$(echo "scale=0; $ram_used * 100 / $ram_total" | bc)
  ram_hog=$(ps -axo rss,comm | sort -rn | head -1 | awk '{full=""; for(i=2;i<=NF;i++) full = full (i>2?" ":"") $i; n=split(full, p, "/"); name=p[n]; if(length(name)>16) name=substr(name,1,16)"…"; printf "%s", name}')
  # memory pressure level (1=normal 2=warning 4=critical) + swap used (the metrics that actually matter on modern macOS)
  mem_press=$(sysctl -n kern.memorystatus_vm_pressure_level 2>/dev/null)
  mem_press=\${mem_press:-1}
  swap_gb=$(sysctl -n vm.swapusage 2>/dev/null | awk '{for(i=1;i<=NF;i++){if($i=="used"){val=$(i+2); u=substr(val,length(val),1); n=val+0; if(u=="M")n=n/1024; else if(u=="K")n=n/1048576; printf "%.1f", n}}}')
  swap_gb=\${swap_gb:-0}

  # ---- cpu ----
  CPU_LINE=$(top -l 2 -n 0 -s 1 2>/dev/null | grep "CPU usage" | tail -1)
  cpu_idle=$(echo "$CPU_LINE" | awk '{print $7}' | tr -d '%')
  cpu_idle=\${cpu_idle:-0}
  cpu_total=$(echo "scale=0; (100 - $cpu_idle) / 1" | bc 2>/dev/null)
  cpu_total=\${cpu_total:-0}
  cpu_hog=$(ps -axo pcpu,comm | sort -rn | head -1 | awk '{full=""; for(i=2;i<=NF;i++) full = full (i>2?" ":"") $i; n=split(full, p, "/"); name=p[n]; if(length(name)>16) name=substr(name,1,16)"…"; printf "%s", name}')

  # ---- gpu + net (sample 500ms window) ----
  get_busy() {
    ioreg -r -k "PerformanceStatistics" -d 1 2>/dev/null | head -1 \\
      | grep -oE 'busy [0-9]+ \\([0-9]+ ms\\)' | grep -oE '\\([0-9]+' | tr -d '('
  }
  get_net() {
    # Aggregate physical en* and VPN utun* (Palo Alto GlobalProtect, etc.) excluding Link rows.
    netstat -ibn 2>/dev/null | awk 'NR>1 && $1 ~ /^(en|utun)[0-9]+$/ && $4!~/Link/ {ib+=$7; ob+=$10} END {printf "%s|%s", ib+0, ob+0}'
  }

  T0=$(get_busy); T0=\${T0:-0}
  N0=$(get_net)
  sleep 0.5
  T1=$(get_busy); T1=\${T1:-0}
  N1=$(get_net)

  delta=$((T1 - T0))
  gpu_util=$((delta * 100 / 500))
  [ $gpu_util -gt 100 ] && gpu_util=100
  [ $gpu_util -lt 0 ] && gpu_util=0

  PERF=$(ioreg -r -k "PerformanceStatistics" -d 1 2>/dev/null | grep -oE '"PerformanceStatistics" = \\{[^}]+\\}' | head -1)
  vram_used=$(echo "$PERF" | grep -oE '"In use system memory"=[0-9]+' | head -1 | sed 's/.*=//')
  vram_alloc=$(echo "$PERF" | grep -oE '"Alloc system memory"=[0-9]+' | head -1 | sed 's/.*=//')
  vram_used=\${vram_used:-0}; vram_alloc=\${vram_alloc:-0}
  vram_used_mb=$(( vram_used / 1048576 ))
  vram_alloc_mb=$(( vram_alloc / 1048576 ))

  ib0=$(echo "$N0" | cut -d'|' -f1); ob0=$(echo "$N0" | cut -d'|' -f2)
  ib1=$(echo "$N1" | cut -d'|' -f1); ob1=$(echo "$N1" | cut -d'|' -f2)
  ib0=\${ib0:-0}; ob0=\${ob0:-0}; ib1=\${ib1:-0}; ob1=\${ob1:-0}
  down_kbps=$(( (ib1 - ib0) * 2 / 1024 ))
  up_kbps=$(( (ob1 - ob0) * 2 / 1024 ))
  [ $down_kbps -lt 0 ] && down_kbps=0
  [ $up_kbps -lt 0 ] && up_kbps=0
  net_ip=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "—")

  echo "$hour|$minute|$second|$day_name|$date_full##$caf_pid##$bat_pct|$bat_state|$bat_time##$gpu_util|$vram_used_mb|$vram_alloc_mb##$DISK_OUT##$ram_total|$ram_used|$ram_free|$ram_pct|$ram_hog|$mem_press|$swap_gb##$cpu_total|$cpu_hog##$down_kbps|$up_kbps|$net_ip"
`;

export const refreshFrequency = 3000;

export const className = `
  top: 20px;
  left: 20px;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
  color: #fff;
  background: linear-gradient(135deg, rgba(22, 22, 28, 0.86) 0%, rgba(30, 22, 38, 0.80) 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 14px;
  width: 720px;
  box-sizing: border-box;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
  font-size: 12px;
  line-height: 1.35;
`;

// ---- drag + snap ----
const __snapPos_panel = (left, top, w) => {
  const elW = w.offsetWidth, elH = w.offsetHeight;
  const winW = window.innerWidth, winH = window.innerHeight;
  const EDGE = 16, ALIGN = 8, GRID = 20;
  let sL = left, sT = top, sx = false, sy = false;
  if (Math.abs(left) < EDGE) { sL = 0; sx = true; }
  else if (Math.abs(left + elW - winW) < EDGE) { sL = winW - elW; sx = true; }
  if (Math.abs(top) < EDGE) { sT = 0; sy = true; }
  else if (Math.abs(top + elH - winH) < EDGE) { sT = winH - elH; sy = true; }
  const cX = (winW - elW) / 2, cY = (winH - elH) / 2;
  if (!sx && Math.abs(left - cX) < EDGE) { sL = cX; sx = true; }
  if (!sy && Math.abs(top - cY) < EDGE) { sT = cY; sy = true; }
  document.querySelectorAll('[id$="-jsx"]').forEach(o => {
    if (o === w) return;
    const r = o.getBoundingClientRect();
    if (!sy) {
      if (Math.abs(top - r.top) < ALIGN) { sT = r.top; sy = true; }
      else if (Math.abs(top + elH - (r.top + r.height)) < ALIGN) { sT = r.top + r.height - elH; sy = true; }
      else if (Math.abs(top - (r.top + r.height + 12)) < ALIGN) { sT = r.top + r.height + 12; sy = true; }
      else if (Math.abs(top + elH + 12 - r.top) < ALIGN) { sT = r.top - elH - 12; sy = true; }
    }
    if (!sx) {
      if (Math.abs(left - r.left) < ALIGN) { sL = r.left; sx = true; }
      else if (Math.abs(left + elW - (r.left + r.width)) < ALIGN) { sL = r.left + r.width - elW; sx = true; }
      else if (Math.abs(left - (r.left + r.width + 12)) < ALIGN) { sL = r.left + r.width + 12; sx = true; }
      else if (Math.abs(left + elW + 12 - r.left) < ALIGN) { sL = r.left - elW - 12; sx = true; }
    }
  });
  if (!sx) sL = Math.round(left / GRID) * GRID;
  if (!sy) sT = Math.round(top / GRID) * GRID;
  return { left: sL, top: sT };
};

const __dragKey_panel = "ubersicht-pos-panel-info";
const __dragRef_panel = (el) => {
  if (!el) return;
  let w = el.parentElement;
  while (w && w !== document.body) {
    const cs = window.getComputedStyle(w);
    if (cs.position === "absolute" || cs.position === "fixed") break;
    w = w.parentElement;
  }
  if (!w) return;
  if (w.__dragInit_panel) return;
  w.__dragInit_panel = true;
  w.style.overflow = 'visible';
  try {
    const saved = localStorage.getItem(__dragKey_panel);
    if (saved) {
      const p = JSON.parse(saved);
      w.style.top = p.top + "px";
      w.style.left = p.left + "px";
      w.style.right = "auto";
      w.style.bottom = "auto";
    }
  } catch (e) {}
  let dragging = false, moved = false, ox = 0, oy = 0, sX = 0, sY = 0;
  w.addEventListener("mousedown", (e) => {
    dragging = true; moved = false;
    const r = w.getBoundingClientRect();
    ox = e.clientX - r.left; oy = e.clientY - r.top;
    sX = e.clientX; sY = e.clientY;
    w.style.transition = "none"; w.style.zIndex = "9999";
  });
  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    if (Math.abs(e.clientX - sX) > 4 || Math.abs(e.clientY - sY) > 4) {
      if (!moved) { moved = true; w.style.opacity = "0.85"; w.style.outline = "2px solid rgba(0,122,255,0.4)"; }
    }
    if (!moved) return;
    const sn = __snapPos_panel(e.clientX - ox, e.clientY - oy, w);
    w.style.left = sn.left + "px"; w.style.top = sn.top + "px";
    w.style.right = "auto"; w.style.bottom = "auto";
  });
  document.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    w.style.opacity = "1"; w.style.outline = "";
    if (moved) {
      const r = w.getBoundingClientRect();
      try { localStorage.setItem(__dragKey_panel, JSON.stringify({ top: Math.round(r.top), left: Math.round(r.left) })); } catch (e) {}
    }
    w.__panelMoved = moved;
  });
};

// ---- helpers ----
const fmtGB = (bytes) => {
  const gb = bytes / 1e9;
  return gb >= 100 ? `${gb.toFixed(0)}` : `${gb.toFixed(1)}`;
};
const pctColor = (p) => p >= 90 ? "#ff3b30" : p >= 75 ? "#ff9500" : "#34c759";

const Cell = ({ children, label, value, accent, action, onAction }) => (
  <div style={{
    position: "relative",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 10,
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    minHeight: 78,
    boxSizing: "border-box",
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
      <span style={{ fontWeight: 600, fontSize: 10, letterSpacing: 0.6, opacity: 0.55, textTransform: "uppercase" }}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {action && (
          <span
            onClick={(e) => { e.stopPropagation(); onAction && onAction(); }}
            style={{
              fontSize: 8.5, padding: "1px 5px",
              background: `${accent}26`, border: `1px solid ${accent}59`,
              borderRadius: 3, color: accent, cursor: "pointer",
              fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase",
            }}
          >{action}</span>
        )}
        {value && <span style={{ fontWeight: 700, fontSize: 13, color: accent }}>{value}</span>}
      </span>
    </div>
    {children}
  </div>
);

const Bar = ({ pct, color, height = 4 }) => (
  <div style={{
    height, background: "rgba(255,255,255,0.08)",
    borderRadius: height / 2, overflow: "hidden", marginBottom: 6,
  }}>
    <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", background: color, transition: "width 0.4s ease, background 0.3s ease" }} />
  </div>
);

const toggleStay = (isOn) => (e) => {
  e.stopPropagation();
  const w = e.currentTarget;
  if (w.__panelMoved) { w.__panelMoved = false; return; }
  if (isOn) run(`pkill -f "caffeinate -dimsu"`);
  else run(`nohup caffeinate -dimsu > /dev/null 2>&1 & disown`);
};

// ---- memory menu ----
const MEM_SH = `bash "$HOME/Library/Application Support/Übersicht/widgets/panel-mem.sh"`;
const runMem = (action) => run(`${MEM_SH} ${action}`);

let __memVisible = false;
const __setMem = (visible) => {
  __memVisible = visible;
  const popup = document.querySelector('[data-pi-mem]');
  if (popup) popup.style.display = visible ? 'block' : 'none';
};
const __toggleMem = () => { __closeCleanup(); __setMem(!__memVisible); };
const __closeMem = () => __setMem(false);

const MemRow = ({ label, hint, action, danger }) => (
  <div
    onClick={(e) => { e.stopPropagation(); runMem(action); __closeMem(); }}
    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      gap: 12, padding: "6px 10px", borderRadius: 6, cursor: "pointer",
      fontSize: 11, whiteSpace: "nowrap", color: danger ? "#ff6b6b" : "#fff",
      borderTop: danger ? "1px solid rgba(255,255,255,0.08)" : "none", marginTop: danger ? 2 : 0,
    }}
  >
    <span>{label}</span>
    {hint && <span style={{ opacity: 0.45, fontSize: 9.5 }}>{hint}</span>}
  </div>
);

// ---- cleanup menu ----
const CLEAN_SH = `bash "$HOME/Library/Application Support/Übersicht/widgets/panel-cleanup.sh"`;
const runCleanup = (action) => run(`${CLEAN_SH} ${action}`);

let __cleanupVisible = false;

const __setCleanup = (visible) => {
  __cleanupVisible = visible;
  const popup = document.querySelector('[data-pi-cleanup]');
  if (popup) popup.style.display = visible ? 'block' : 'none';
};

const __toggleCleanup = () => { __closeMem(); __setCleanup(!__cleanupVisible); };
const __closeCleanup = () => __setCleanup(false);

// Close the menus on any click outside their popups. The chips and the menu rows
// call stopPropagation, so their own clicks never reach this listener.
if (typeof window !== 'undefined' && !window.__piCleanupBound) {
  window.__piCleanupBound = true;
  document.addEventListener('click', () => {
    if (__cleanupVisible) __closeCleanup();
    if (__memVisible) __closeMem();
  });
}

const CleanRow = ({ label, hint, action, danger }) => (
  <div
    onClick={(e) => { e.stopPropagation(); runCleanup(action); __closeCleanup(); }}
    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      gap: 12, padding: "6px 10px", borderRadius: 6, cursor: "pointer",
      fontSize: 11, whiteSpace: "nowrap", color: danger ? "#ff6b6b" : "#fff",
      borderTop: danger ? "1px solid rgba(255,255,255,0.08)" : "none", marginTop: danger ? 2 : 0,
    }}
  >
    <span>{label}</span>
    {hint && <span style={{ opacity: 0.45, fontSize: 9.5 }}>{hint}</span>}
  </div>
);

// ---- render ----
export const render = ({ output }) => {
  if (!output) return <div ref={__dragRef_panel}>Loading…</div>;
  const sections = output.trim().split("##");
  if (sections.length < 8) return <div ref={__dragRef_panel}>Loading…</div>;

  const [hour, minute, second, dayName, dateFull] = sections[0].split("|");
  const cafPid = sections[1].trim();
  const [batPct, batState, batTime] = sections[2].split("|");
  const [gpuUtil, vramUsedMb, vramAllocMb] = sections[3].split("|");
  const [diskTotal, diskUsed, diskFree, diskPurge] = sections[4].split("|").map(Number);
  const [ramTotal, ramUsed, ramFree, ramPct, ramHog, memPress, swapGb] = sections[5].split("|");
  const [cpuTotal, cpuHog] = sections[6].split("|");
  const [downKbps, upKbps, netIp] = sections[7].split("|");

  // ---- derived ----
  const stayOn = cafPid.length > 0;
  const batNum = parseInt(batPct, 10) || 0;
  const isCharging = /charging|finishing/.test(batState) && !/not charging/.test(batState);
  const isFull = /charged/.test(batState);
  let batColor = pctColor(100 - batNum * (batNum <= 20 ? 5 : 1));
  if (batNum > 50) batColor = "#34c759";
  else if (batNum > 20) batColor = "#ff9500";
  else batColor = "#ff3b30";
  if (isCharging || isFull) batColor = "#34c759";

  const diskPct = diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0;
  const diskPurgePct = diskTotal > 0 ? (diskPurge / diskTotal) * 100 : 0;
  const diskColor = pctColor(diskPct);
  const hasPurgeable = diskPurge > 100 * 1e6;

  const ramPctNum = parseInt(ramPct, 10) || 0;
  // On modern macOS, memory pressure (not "% used") is the real health signal.
  const pressNum = parseInt(memPress, 10) || 1;
  const swapNum = parseFloat(swapGb) || 0;
  const pressInfo = pressNum >= 4
    ? { label: "Crítico", color: "#ff3b30" }
    : pressNum >= 2
      ? { label: "Atenção", color: "#ff9500" }
      : { label: "Normal", color: "#34c759" };
  const ramColor = pressInfo.color;

  const cpuPctNum = parseInt(cpuTotal, 10) || 0;
  const cpuColor = pctColor(cpuPctNum);

  const gpuPctNum = parseInt(gpuUtil, 10) || 0;
  const gpuColor = pctColor(gpuPctNum);

  const downNum = parseInt(downKbps, 10) || 0;
  const upNum = parseInt(upKbps, 10) || 0;
  const fmtRate = (kbps) => kbps >= 1024 ? `${(kbps/1024).toFixed(1)} MB` : `${kbps} KB`;

  return (
    <div ref={__dragRef_panel}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 8,
      }}>
        {/* row 1: clock | stay | battery | gpu */}

        {/* CLOCK */}
        <Cell label={dayName}>
          <div style={{ fontSize: 26, fontWeight: 200, letterSpacing: -1, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {hour}<span style={{ opacity: 0.4 }}>:</span>{minute}
            <span style={{ fontSize: 13, opacity: 0.5, marginLeft: 4 }}>{second}</span>
          </div>
          <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4 }}>{dateFull}</div>
        </Cell>

        {/* STAY AWAKE */}
        <div
          onClick={toggleStay(stayOn)}
          style={{
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${stayOn ? "rgba(52,199,89,0.3)" : "rgba(255,255,255,0.06)"}`,
            borderRadius: 10, padding: "10px 12px",
            display: "flex", flexDirection: "column", minHeight: 78,
            cursor: "pointer", userSelect: "none", boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 10, letterSpacing: 0.6, opacity: 0.55, textTransform: "uppercase" }}>Stay Awake</span>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: stayOn ? "#34c759" : "rgba(255,255,255,0.25)",
              boxShadow: stayOn ? "0 0 6px #34c759" : "none",
            }} />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: stayOn ? "#34c759" : "rgba(255,255,255,0.5)" }}>
              {stayOn ? "ON" : "OFF"}
            </span>
            <span style={{ fontSize: 18, opacity: 0.7 }}>{stayOn ? "☕" : "💤"}</span>
          </div>
          <div style={{ fontSize: 9.5, opacity: 0.45, marginTop: 4 }}>
            {stayOn ? "click off" : "click activate"}
          </div>
        </div>

        {/* BATTERY */}
        <Cell label="Battery" value={`${batNum}%${isCharging ? " ⚡" : ""}`} accent={batColor}>
          <Bar pct={batNum} color={batColor} height={5} />
          <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>
            {isFull ? "Charged" : isCharging ? "Charging" : "On battery"}
          </div>
          {batTime && batTime !== "0:00" && !isFull && (
            <div style={{ fontSize: 10, opacity: 0.5, marginTop: 1, fontVariantNumeric: "tabular-nums" }}>
              {isCharging ? "Until full " : "Remaining "}{batTime}
            </div>
          )}
        </Cell>

        {/* GPU */}
        <Cell label="GPU" value={`${gpuPctNum}%`} accent={gpuColor}>
          <Bar pct={gpuPctNum} color={gpuColor} height={5} />
          <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>
            VRAM
          </div>
          <Bar pct={vramAllocMb > 0 ? (vramUsedMb / vramAllocMb) * 100 : 0} color="#0a84ff" height={3} />
          <div style={{ fontSize: 9.5, opacity: 0.5, fontVariantNumeric: "tabular-nums" }}>
            {vramUsedMb} / {vramAllocMb} MB
          </div>
        </Cell>

        {/* row 2: disk | ram | cpu | net */}

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
              zIndex: 99999,
            }}
          >
            <div style={{ fontSize: 9, opacity: 0.4, textTransform: "uppercase", letterSpacing: 0.5, padding: "4px 10px 2px" }}>
              Limpar espaço
            </div>
            {hasPurgeable && <CleanRow label="Snapshots APFS" hint={`${fmtGB(diskPurge)} GB`} action="snapshots" />}
            <CleanRow label="Caches de apps" hint="Chrome · Cursor · Claude" action="appcaches" />
            <CleanRow label="Modelos Ollama" action="ollama" />
            <CleanRow label="Downloads (maiores)" action="downloads" />
            <CleanRow label="Esvaziar Lixeira" action="trash" danger />
          </div>
        </Cell>

        {/* RAM */}
        <Cell label="Memory" value={pressInfo.label} accent={ramColor} action="MEM" onAction={__toggleMem}>
          <Bar pct={ramPctNum} color={ramColor} height={5} />
          <div style={{ fontSize: 10, opacity: 0.6, fontVariantNumeric: "tabular-nums" }}>
            {ramUsed} / {ramTotal} GB
          </div>
          <div style={{ fontSize: 9.5, opacity: 0.5, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
            swap {swapNum.toFixed(1)} GB{ramHog ? ` · ${ramHog}` : ""}
          </div>

          {/* memory popup */}
          <div
            data-pi-mem
            onClick={(e) => e.stopPropagation()}
            style={{
              display: __memVisible ? "block" : "none",
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: 6,
              minWidth: 210,
              padding: 4,
              background: "rgba(28,28,34,0.98)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              zIndex: 99999,
            }}
          >
            <div style={{ fontSize: 9, opacity: 0.4, textTransform: "uppercase", letterSpacing: 0.5, padding: "4px 10px 2px" }}>
              Memória · {pressInfo.label}
            </div>
            <MemRow label="Apps que mais usam memória" hint="fechar app" action="hogs" />
            <MemRow label="Purge (efeito limitado)" hint="admin" action="purge" />
          </div>
        </Cell>

        {/* CPU */}
        <Cell label="CPU" value={`${cpuPctNum}%`} accent={cpuColor}>
          <Bar pct={cpuPctNum} color={cpuColor} height={5} />
          <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>load</div>
          {cpuHog && (
            <div style={{ fontSize: 9.5, opacity: 0.55, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              top: {cpuHog}
            </div>
          )}
        </Cell>

        {/* NET */}
        <Cell label="Network" value={netIp} accent="#5ac8fa">
          <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, opacity: 0.55, letterSpacing: 0.4 }}>↓ DOWN</div>
              <div style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmtRate(downNum)}/s</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, opacity: 0.55, letterSpacing: 0.4 }}>↑ UP</div>
              <div style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmtRate(upNum)}/s</div>
            </div>
          </div>
        </Cell>
      </div>
      <div style={{
        marginTop: 8,
        textAlign: "right",
        fontSize: 9,
        opacity: 0.3,
        letterSpacing: 0.3,
        fontWeight: 400,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 6,
      }}>
        by Julio Ferracini
        <svg
          onClick={() => run("open https://github.com/jferracini/ubersicht-panel-monitoring")}
          style={{ cursor: "pointer", display: "block", flexShrink: 0 }}
          width="12" height="12" viewBox="0 0 98 96"
          fill="currentColor" xmlns="http://www.w3.org/2000/svg"
        >
          <path fillRule="evenodd" clipRule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"/>
        </svg>
      </div>
    </div>
  );
};
