// Stay Awake widget — toggle caffeinate to bypass profile sleep
// Click widget to toggle ON/OFF
// Refresh every 3 seconds to keep state fresh

import { run } from 'uebersicht';

export const command = `pgrep -f "caffeinate -dimsu" | head -1 | tr -d '\n'`;

export const refreshFrequency = 3000;

export const className = `
  top: 20px;
  right: 280px;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
  color: #fff;
  background: rgba(20, 20, 24, 0.78);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 14px 18px;
  width: 180px;
  box-sizing: border-box;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
  user-select: none;
`;

const __snapPos_stay_awake = (left, top, w) => {
  const elW = w.offsetWidth, elH = w.offsetHeight;
  const winW = window.innerWidth, winH = window.innerHeight;
  const EDGE = 16, ALIGN = 8, GRID = 20;
  let sL = left, sT = top, snappedX = false, snappedY = false;
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

const __dragKey_stay_awake = "ubersicht-pos-stay-awake";
const __dragRef_stay_awake = (el) => {
  if (!el) return;
  let w = el.parentElement;
  while (w && w !== document.body) {
    const cs = window.getComputedStyle(w);
    if (cs.position === "absolute" || cs.position === "fixed") break;
    w = w.parentElement;
  }
  if (!w) return;
  if (w.__dragInit_stay_awake) return;
  w.__dragInit_stay_awake = true;

  try {
    const saved = localStorage.getItem(__dragKey_stay_awake);
    if (saved) {
      const p = JSON.parse(saved);
      w.style.top = p.top + "px";
      w.style.left = p.left + "px";
      w.style.right = "auto";
      w.style.bottom = "auto";
    }
  } catch (e) {}

  let dragging = false, moved = false, ox = 0, oy = 0, startX = 0, startY = 0;

  w.addEventListener("mousedown", (e) => {
    dragging = true;
    moved = false;
    const r = w.getBoundingClientRect();
    ox = e.clientX - r.left;
    oy = e.clientY - r.top;
    startX = e.clientX;
    startY = e.clientY;
    w.style.transition = "none";
    w.style.zIndex = "9999";
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    if (Math.abs(e.clientX - startX) > 4 || Math.abs(e.clientY - startY) > 4) {
      moved = true;
      w.style.opacity = "0.85";
      w.style.outline = "2px solid rgba(0,122,255,0.4)";
    }
    if (!moved) return;
    const rawL = e.clientX - ox;
    const rawT = e.clientY - oy;
    const snapped = __snapPos_stay_awake(rawL, rawT, w);
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
    if (moved) {
      const r = w.getBoundingClientRect();
      try {
        localStorage.setItem(__dragKey_stay_awake, JSON.stringify({ top: Math.round(r.top), left: Math.round(r.left) }));
      } catch (e) {}
    }
    w.__lastMoved = moved;
  });
};

const toggle = (isOn) => (e) => {
  e.stopPropagation();
  const w = e.currentTarget;
  if (w.__lastMoved) { w.__lastMoved = false; return; }
  if (isOn) {
    run(`pkill -f "caffeinate -dimsu"`);
  } else {
    run(`nohup caffeinate -dimsu > /dev/null 2>&1 & disown`);
  }
};

export const render = ({ output }) => {
  const pid = (output || "").trim();
  const isOn = pid.length > 0;
  const dotColor = isOn ? "#34c759" : "rgba(255,255,255,0.25)";
  const labelColor = isOn ? "#34c759" : "rgba(255,255,255,0.5)";

  return (
    <div ref={__dragRef_stay_awake} onClick={toggle(isOn)}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
      }}>
        <span style={{ fontWeight: 600, fontSize: 11, letterSpacing: 0.5, opacity: 0.6, textTransform: "uppercase" }}>
          Stay Awake
        </span>
        <span style={{
          width: 10, height: 10, borderRadius: "50%",
          background: dotColor,
          boxShadow: isOn ? "0 0 8px #34c759" : "none",
          transition: "all 0.3s ease",
        }} />
      </div>

      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 4,
      }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: labelColor }}>
          {isOn ? "ON" : "OFF"}
        </span>
        <span style={{ fontSize: 22, opacity: 0.7 }}>
          {isOn ? "☕" : "💤"}
        </span>
      </div>

      <div style={{ fontSize: 10, opacity: 0.45, marginTop: 6 }}>
        {isOn ? `caffeinate ${pid}` : "click to activate"}
      </div>
    </div>
  );
};
