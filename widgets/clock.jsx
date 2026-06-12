// Clock widget — large time + date, top-left
// Refresh every 1 second

export const command = `
  hour=$(date +"%H")
  minute=$(date +"%M")
  second=$(date +"%S")
  day_name=$(date +"%A")
  date_full=$(date +"%d %b %Y")
  echo "$hour|$minute|$second|$day_name|$date_full"
`;

export const refreshFrequency = 1000;

export const className = `
  top: 20px;
  left: 20px;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
  color: #fff;
  background: rgba(20, 20, 24, 0.78);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 16px 22px;
  width: 240px;
  box-sizing: border-box;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
`;

const __snapPos_clock = (left, top, w) => {
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

const __dragKey_clock = "ubersicht-pos-clock";
const __dragRef_clock = (el) => {
  if (!el) return;
  let w = el.parentElement;
  while (w && w !== document.body) {
    const cs = window.getComputedStyle(w);
    if (cs.position === "absolute" || cs.position === "fixed") break;
    w = w.parentElement;
  }
  if (!w) return;
  if (w.__dragInit_clock) return;
  w.__dragInit_clock = true;

  try {
    const saved = localStorage.getItem(__dragKey_clock);
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
    const snapped = __snapPos_clock(rawL, rawT, w);
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
      localStorage.setItem(__dragKey_clock, JSON.stringify({ top: Math.round(r.top), left: Math.round(r.left) }));
    } catch (e) {}
  });
};


export const render = ({ output }) => {
  if (!output) return <div ref={__dragRef_clock}>Loading…</div>;

  const [hour, minute, second, dayName, dateFull] = output.trim().split("|");

  return (
    <div ref={__dragRef_clock} style={{ textAlign: "left" }}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 1.2,
        opacity: 0.6,
        textTransform: "uppercase",
        marginBottom: 4,
      }}>
        {dayName}
      </div>
      <div style={{
        fontSize: 44,
        fontWeight: 200,
        letterSpacing: -1.5,
        lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
      }}>
        {hour}<span style={{ opacity: 0.4, fontWeight: 100 }}>:</span>{minute}
        <span style={{ fontSize: 22, opacity: 0.5, marginLeft: 6, fontWeight: 300 }}>
          {second}
        </span>
      </div>
      <div style={{
        fontSize: 11,
        opacity: 0.55,
        marginTop: 4,
        letterSpacing: 0.5,
      }}>
        {dateFull}
      </div>
    </div>
  );
};
