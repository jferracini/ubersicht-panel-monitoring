// Vibe Actions — 3x2 grid of quick actions with Lucide icons.
// Companion to vibe-code.jsx. Drag to reposition. Position persists in localStorage.

import { run, React } from 'uebersicht';

export const refreshFrequency = 1000;

export const command = `bash "$HOME/Library/Application Support/Übersicht/widgets/vibe-actions.sh"`;

export const className = `
  top: 20px;
  left: 20px;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
  color: #fff;
  background: rgba(16, 18, 24, 0.82);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  padding: 14px;
  width: 380px;
  box-sizing: border-box;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  font-size: 11px;
  user-select: none;
  overflow: visible;
`;

// ---- drag + position persist + help popup wiring ----------------------------
const __dragKey = "ubersicht-pos-vibe-actions";
let __helpVisible = false;
const __drag = (el) => {
  if (!el) return;
  let w = el.parentElement;
  while (w && w !== document.body) {
    if (['absolute','fixed'].includes(window.getComputedStyle(w).position)) break;
    w = w.parentElement;
  }
  if (!w || w.__dragInit_va) return;
  w.__dragInit_va = true;
  w.style.overflow = 'visible';
  try {
    const p = JSON.parse(localStorage.getItem(__dragKey));
    const winW = window.innerWidth, winH = window.innerHeight;
    if (p && p.top >= 0 && p.top < winH - 40 && p.left >= 0 && p.left < winW - 40) {
      w.style.top = p.top+'px'; w.style.left = p.left+'px'; w.style.right='auto'; w.style.bottom='auto';
    } else {
      localStorage.removeItem(__dragKey);
    }
  } catch(e){}
  let drag=false, moved=false, ox=0, oy=0, sx=0, sy=0;
  w.addEventListener('mousedown', e => { drag=true; moved=false; const r=w.getBoundingClientRect(); ox=e.clientX-r.left; oy=e.clientY-r.top; sx=e.clientX; sy=e.clientY; w.style.transition='none'; w.style.zIndex='9999'; });
  document.addEventListener('mousemove', e => {
    if (!drag) return;
    if (!moved && (Math.abs(e.clientX-sx)>4||Math.abs(e.clientY-sy)>4)) { moved=true; w.style.opacity='0.85'; w.style.outline='2px solid rgba(0,122,255,0.4)'; }
    if (!moved) return;
    w.style.left=(e.clientX-ox)+'px'; w.style.top=(e.clientY-oy)+'px'; w.style.right='auto'; w.style.bottom='auto';
  });
  document.addEventListener('mouseup', () => {
    if (!drag) return; drag=false; w.style.opacity='1'; w.style.outline='';
    if (moved) { const r=w.getBoundingClientRect(); try { localStorage.setItem(__dragKey, JSON.stringify({top:Math.round(r.top),left:Math.round(r.left)})); } catch(e){} }
    w.__vaMoved = moved;
  });
  // close help popup on outside click
  document.addEventListener('click', (e) => {
    if (!__helpVisible) return;
    const popup = w.querySelector('[data-va-help]');
    const btn = w.querySelector('[data-va-help-btn]');
    if (popup && (popup.contains(e.target) || (btn && btn.contains(e.target)))) return;
    __helpVisible = false;
    if (popup) popup.style.display = 'none';
  });
};

const __clickGuard = (el, fn) => (e) => {
  let w = el?.parentElement;
  while (w && w !== document.body) {
    if (['absolute','fixed'].includes(window.getComputedStyle(w).position)) break;
    w = w.parentElement;
  }
  if (w?.__vaMoved) { w.__vaMoved = false; return; }
  e.stopPropagation();
  fn(e);
};

// ---- DOM-based hover ---------------------------------------------------------
const __hoverEnter = (e) => {
  const cell = e.currentTarget;
  if (!cell.classList.contains('va-active')) cell.style.borderColor = 'rgba(255,255,255,0.22)';
};
const __hoverLeave = (e) => {
  const cell = e.currentTarget;
  if (!cell.classList.contains('va-active')) cell.style.borderColor = 'rgba(255,255,255,0.06)';
};

// ---- help popup toggle --------------------------------------------------------
const __toggleHelp = (e) => {
  e.stopPropagation();
  let w = e.currentTarget.parentElement;
  while (w && w !== document.body) {
    if (['absolute','fixed'].includes(window.getComputedStyle(w).position)) break;
    w = w.parentElement;
  }
  const popup = w?.querySelector('[data-va-help]');
  if (!popup) return;
  __helpVisible = !__helpVisible;
  popup.style.display = __helpVisible ? 'block' : 'none';
};

// ---- shell actions ------------------------------------------------------------
const KILL_DEV_PORTS = '3000 3001 3002 3003 3030 4000 4200 4321 5000 5173 5174 5500 6006 7700 8000 8080 8081 8888 9000';

const actions = {
  killDev: () => run(`lsof -tiTCP:${KILL_DEV_PORTS.split(' ').join(',')} -sTCP:LISTEN 2>/dev/null | xargs kill -9 2>/dev/null || true`),
  snip:    () => run(`f="/tmp/snip-$(date +%s).png"; screencapture -i "$f" && [ -f "$f" ] && echo -n "$f" | pbcopy && open -R "$f"`),
  record:  () => run(`f="/tmp/vibe-rec-$(date +%s).mov"; screencapture -v "$f" && [ -f "$f" ] && echo -n "$f" | pbcopy && open -R "$f"`),
  responsivePreview: () => run(`for w in "390x844" "834x1112" "1440x900"; do open -na "Google Chrome" --args --new-window --window-size=$w "http://localhost:3000" 2>/dev/null; sleep 0.4; done`),
  openInCursor: () => run(`dir=$(osascript -e 'try' -e 'POSIX path of (choose folder with prompt "Open in Cursor")' -e 'end try' 2>/dev/null); [ -n "$dir" ] && (open -a Cursor "$dir" 2>/dev/null || open -a "Visual Studio Code" "$dir")`),
  openClaude:  () => run(`osascript -e 'tell application "Terminal" to do script "claude"' -e 'tell application "Terminal" to activate'`),
  installClaude: () => run(`osascript -e 'tell application "Terminal" to do script "curl -fsSL https://claude.ai/install.sh | bash"' -e 'tell application "Terminal" to activate'`),
};

// ---- Lucide-style SVG icons ----------------------------------------------------
const svgProps = { viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:1.75, strokeLinecap:'round', strokeLinejoin:'round' };
const Icon = ({ name, size=20, color }) => {
  const style = { width:size, height:size, color };
  switch (name) {
    case 'record':
      return <svg {...svgProps} style={style}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></svg>;
    case 'trash':
      return <svg {...svgProps} style={style}><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>;
    case 'devices':
      return <svg {...svgProps} style={style}><rect x="2" y="4" width="13" height="9" rx="1"/><line x1="6" x2="11" y1="16.5" y2="16.5"/><line x1="8.5" x2="8.5" y1="13" y2="16.5"/><rect x="15" y="9" width="7" height="12" rx="1.5"/><line x1="17" x2="20" y1="18.5" y2="18.5"/></svg>;
    case 'alert':
      return <svg {...svgProps} style={style}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>;
    case 'camera':
      return <svg {...svgProps} style={style}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>;
    case 'folder':
      return <svg {...svgProps} style={style}><path d="M6 14l1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"/></svg>;
    case 'terminal':
      return <svg {...svgProps} style={style}><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>;
    default:
      return null;
  }
};

// ---- button ----------------------------------------------------------------
const Btn = ({ icon, label, sub, accent, color='#fff', activeColor, disabled, onClick }) => {
  const isActive = !!activeColor;
  const bgFmt = (rgb, op) => `rgba(${rgb}, ${op})`;
  const baseStyle = {
    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    padding:'10px 6px', borderRadius:10, height:64,
    background: accent || 'rgba(255,255,255,0.04)',
    border:'1px solid rgba(255,255,255,0.06)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    transition:'border-color 120ms, background 120ms, box-shadow 120ms',
    textAlign:'center',
    gap:3,
  };
  const activeStyles = isActive ? {
    background: bgFmt(activeColor.rgb, 0.22),
    border: `1.5px solid ${bgFmt(activeColor.rgb, 0.55)}`,
    boxShadow: `inset 0 0 0 1px ${bgFmt(activeColor.rgb, 0.15)}, 0 0 0 1px ${bgFmt(activeColor.rgb, 0.25)}, 0 0 18px -2px ${bgFmt(activeColor.rgb, 0.55)}`,
  } : {};
  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={isActive ? `va-active ${activeColor.pulseClass || ''}` : ''}
      style={{ ...baseStyle, ...activeStyles }}
    >
      <Icon name={icon} color={isActive ? activeColor.fg : color} />
      <div style={{ fontSize:9.5, fontWeight: isActive ? 700 : 600, color: isActive ? activeColor.fg : color, letterSpacing:0.2, lineHeight:1.2 }}>{label}</div>
      {sub && (
        <div style={{ fontSize: isActive ? 10 : 8.5, opacity: isActive ? 0.95 : 0.7, color: isActive ? activeColor.fg : 'inherit', fontWeight: isActive ? 700 : 400, fontVariantNumeric:'tabular-nums', marginTop:1 }}>{sub}</div>
      )}
    </div>
  );
};

// ---- global styles (injected once) ------------------------------------------
const GlobalStyles = () => (
  <style>{`
    @keyframes va-pulse-amber { 0%,100%{box-shadow:inset 0 0 0 1px rgba(255,159,10,0.15),0 0 0 1px rgba(255,159,10,0.25),0 0 18px -2px rgba(255,159,10,0.55)} 50%{box-shadow:inset 0 0 0 1px rgba(255,159,10,0.3),0 0 0 1px rgba(255,159,10,0.45),0 0 26px -2px rgba(255,159,10,0.8)} }
    .va-active.va-pulse-amber { animation: va-pulse-amber 1.8s ease-in-out infinite; }
  `}</style>
);

// ---- active color presets ---------------------------------------------------
const ACTIVE = {
  amber: { rgb:'255,159,10', fg:'#ffb340', pulseClass:'va-pulse-amber' },
};

// ---- help popup content -------------------------------------------------------
const HELP_ITEMS = [
  { title:'Record', desc:'Pick a screen area, click Record in the on-screen controls, stop from the menu bar icon. Saved as .mov to /tmp, path copied to clipboard, file revealed in Finder.', color:'#ff453a' },
  { title:'Kill Dev', desc:'Force-kills processes on common dev ports (3000-3, 4000, 4200, 4321, 5000, 5173-4, 5500, 6006, 7700, 8000-1, 8888, 9000). Use when Vite/Next/Bun gets stuck.', color:'#ff453a' },
  { title:'Responsive Preview', desc:'Opens http://localhost:3000 in 3 Chrome windows sized for mobile (390x844), tablet (834x1112) and desktop (1440x900). Requires Google Chrome.', color:'#5ac8fa' },
  { title:'Region Screenshot', desc:'Native macOS region picker. Saves PNG to /tmp, copies the file path to clipboard, reveals it in Finder.', color:'#5ac8fa' },
  { title:'Open in Cursor', desc:'Folder picker opens, selected folder opens in Cursor (falls back to VS Code).', color:'#34c759' },
  { title:'Claude Code', desc:'Opens a new Terminal window and runs the Claude Code CLI. If not installed, runs the official installer instead.', color:'#fff' },
];

const GITHUB_PATH = "M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z";

// ---- render -----------------------------------------------------------------
export const render = ({ output }) => {
  const claudeStatus = (output || 'ok').trim();

  // claude state
  const claudeMissing = claudeStatus === 'missing';
  const claude = claudeMissing
    ? {
        id:'claude', icon:'alert', label:'Install', sub:'claude CLI',
        accent:'rgba(255,159,10,0.10)',
        activeColor: ACTIVE.amber,
        onClick: (e) => __clickGuard(e.currentTarget, () => actions.installClaude())(e),
      }
    : {
        id:'claude', icon:'terminal', label:'Claude Code', sub:'in Terminal',
        accent:'rgba(255,255,255,0.04)',
        onClick: (e) => __clickGuard(e.currentTarget, () => actions.openClaude())(e),
      };

  const buttons = [
    {
      id:'record', icon:'record', label:'Record', sub:'demo clip',
      accent:'rgba(255,69,58,0.10)',
      onClick: (e) => __clickGuard(e.currentTarget, () => actions.record())(e),
    },
    {
      id:'kill', icon:'trash', label:'Kill dev', sub:'servers',
      accent:'rgba(255,69,58,0.10)',
      onClick: (e) => __clickGuard(e.currentTarget, () => actions.killDev())(e),
    },
    {
      id:'responsive', icon:'devices', label:'Responsive', sub:'preview',
      accent:'rgba(90,200,250,0.10)',
      onClick: (e) => __clickGuard(e.currentTarget, () => actions.responsivePreview())(e),
    },
    {
      id:'snip', icon:'camera', label:'Region', sub:'screenshot',
      accent:'rgba(90,200,250,0.10)',
      onClick: (e) => __clickGuard(e.currentTarget, () => actions.snip())(e),
    },
    {
      id:'open', icon:'folder', label:'Open in', sub:'Cursor',
      accent:'rgba(52,199,89,0.10)',
      onClick: (e) => __clickGuard(e.currentTarget, () => actions.openInCursor())(e),
    },
    claude,
  ];

  return (
    <div ref={__drag} style={{ position:'relative', overflow:'visible' }}>
      <GlobalStyles />
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:6 }}>
        {buttons.map((b) => (
          <div
            key={b.id}
            onMouseEnter={__hoverEnter}
            onMouseLeave={__hoverLeave}
          >
            <Btn
              icon={b.icon}
              label={b.label}
              sub={b.sub}
              accent={b.accent}
              color={b.color}
              activeColor={b.activeColor}
              disabled={b.disabled}
              onClick={b.onClick}
            />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ marginTop:10, display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:9, opacity:0.25 }}>
        <span
          data-va-help-btn
          onClick={__toggleHelp}
          style={{ cursor:'pointer', textDecoration:'underline', textDecorationStyle:'dotted' }}
        >
          ? help
        </span>
        <span style={{ display:'flex', alignItems:'center', gap:5 }}>
          by Julio Ferracini
          <svg onClick={() => run('open https://github.com/jferracini/ubersicht-panel-monitoring')}
            style={{ cursor:'pointer', display:'block' }} width="10" height="10" viewBox="0 0 98 96" fill="currentColor">
            <path fillRule="evenodd" clipRule="evenodd" d={GITHUB_PATH}/>
          </svg>
        </span>
      </div>

      {/* Help popup */}
      <div data-va-help style={{
        display:'none',
        position:'absolute', top:'calc(100% + 8px)', left:0, right:0,
        background:'rgba(20,22,28,0.97)',
        border:'1px solid rgba(255,255,255,0.1)',
        borderRadius:12,
        padding:'12px 14px',
        fontSize:10.5, lineHeight:1.5,
        boxShadow:'0 12px 36px rgba(0,0,0,0.55)',
        backdropFilter:'blur(20px)',
        zIndex:99999,
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <span style={{ fontWeight:700, letterSpacing:0.6, textTransform:'uppercase', fontSize:10, opacity:0.7 }}>Vibe Actions — Help</span>
          <span onClick={__toggleHelp} style={{ cursor:'pointer', opacity:0.5, fontSize:14, lineHeight:1 }}>×</span>
        </div>
        {HELP_ITEMS.map((h, i) => (
          <div key={i} style={{ marginBottom: i < HELP_ITEMS.length - 1 ? 8 : 0 }}>
            <div style={{ fontWeight:700, color:h.color, marginBottom:2 }}>{h.title}</div>
            <div style={{ opacity:0.75 }}>{h.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
