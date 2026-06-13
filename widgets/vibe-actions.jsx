// Vibe Actions — 3x2 grid of quick actions with Lucide icons + rich tooltips.
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

// ---- drag + position persist ------------------------------------------------
const __dragKey = "ubersicht-pos-vibe-actions";
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

// ---- DOM-based hover --------------------------------------------------------
const __hoverEnter = (e) => {
  const cell = e.currentTarget;
  if (!cell.classList.contains('va-active')) {
    cell.style.borderColor = 'rgba(255,255,255,0.22)';
  }
  const tt = cell.querySelector('[data-va-tooltip]');
  if (tt) { tt.style.opacity = '1'; tt.style.visibility = 'visible'; tt.style.transform = 'translate(-50%, 0)'; }
};
const __hoverLeave = (e) => {
  const cell = e.currentTarget;
  if (!cell.classList.contains('va-active')) {
    cell.style.borderColor = 'rgba(255,255,255,0.06)';
  }
  const tt = cell.querySelector('[data-va-tooltip]');
  if (tt) { tt.style.opacity = '0'; tt.style.visibility = 'hidden'; tt.style.transform = 'translate(-50%, -4px)'; }
};

// ---- focus timer ------------------------------------------------------------
const FOCUS_KEY = "vibe-focus-end";
const FOCUS_MS  = 25 * 60 * 1000;
const focusEnd  = () => { try { return parseInt(localStorage.getItem(FOCUS_KEY)) || 0; } catch(e) { return 0; } };
const startFocus= () => { try { localStorage.setItem(FOCUS_KEY, String(Date.now() + FOCUS_MS)); } catch(e){} };
const stopFocus = () => { try { localStorage.removeItem(FOCUS_KEY); } catch(e){} };

// ---- shell actions ----------------------------------------------------------
const KILL_DEV_PORTS = '3000 3001 3002 3003 3030 4000 4200 4321 5000 5173 5174 5500 6006 7700 8000 8080 8081 8888 9000';

const actions = {
  killDev: () => run(`lsof -tiTCP:${KILL_DEV_PORTS.split(' ').join(',')} -sTCP:LISTEN 2>/dev/null | xargs kill -9 2>/dev/null || true`),
  snip:    () => run(`f="/tmp/snip-$(date +%s).png"; screencapture -i "$f" && [ -f "$f" ] && echo -n "$f" | pbcopy && open -R "$f"`),
  openInCursor: () => run(`dir=$(osascript -e 'try' -e 'POSIX path of (choose folder with prompt "Open in Cursor")' -e 'end try' 2>/dev/null); [ -n "$dir" ] && (open -a Cursor "$dir" 2>/dev/null || open -a "Visual Studio Code" "$dir")`),
  openClaude:  () => run(`osascript -e 'tell application "Terminal" to do script "claude"' -e 'tell application "Terminal" to activate'`),
  installClaude: () => run(`osascript -e 'tell application "Terminal" to do script "curl -fsSL https://claude.ai/install.sh | bash"' -e 'tell application "Terminal" to activate'`),
  tunnelInstall: () => run(`osascript -e 'tell application "Terminal" to do script "brew install cloudflared && echo DONE - close this window"' -e 'tell application "Terminal" to activate'`),
  tunnelStart: (port=3000) => run(`rm -f /tmp/vibe-tunnel.log && nohup cloudflared tunnel --url http://localhost:${port} > /tmp/vibe-tunnel.log 2>&1 &`),
  tunnelStop:  () => run(`pkill -f "cloudflared tunnel" 2>/dev/null || true`),
  tunnelCopyUrl: (url) => run(`echo -n ${JSON.stringify(url)} | pbcopy`),
};

// ---- Lucide SVG icons -------------------------------------------------------
const svgProps = { viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:1.75, strokeLinecap:'round', strokeLinejoin:'round' };
const Icon = ({ name, size=20, color, spin }) => {
  const style = { width:size, height:size, color, ...(spin && { animation:'va-spin 1.2s linear infinite', transformOrigin:'50% 50%' }) };
  switch (name) {
    case 'timer':
      return <svg {...svgProps} style={style}><line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/></svg>;
    case 'trash':
      return <svg {...svgProps} style={style}><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>;
    case 'globe':
      return <svg {...svgProps} style={style}><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>;
    case 'wifi':
      return <svg {...svgProps} style={style}><path d="M5 13a10 10 0 0 1 14 0"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 20 0"/><line x1="12" x2="12.01" y1="20" y2="20"/></svg>;
    case 'loader':
      return <svg {...svgProps} style={style}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>;
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

// ---- button -----------------------------------------------------------------
const Btn = ({ icon, iconSpin, label, sub, accent, color='#fff', activeColor, disabled, onClick, showDot }) => {
  const isActive = !!activeColor;
  const bgFmt = (rgb, op) => `rgba(${rgb}, ${op})`;
  // when activeColor provided, derive richer styles via inline; pulse via CSS class injected separately
  const baseStyle = {
    position:'relative',
    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    padding:'10px 6px', borderRadius:10, height:64,
    background: accent || 'rgba(255,255,255,0.04)',
    border:'1px solid rgba(255,255,255,0.06)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    transition:'border-color 120ms, background 120ms, box-shadow 120ms',
    textAlign:'center',
    gap:3,
    pointerEvents:'auto',
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
      {showDot && <span className="va-live-dot" />}
      <Icon name={icon} color={isActive ? activeColor.fg : color} spin={iconSpin} />
      <div style={{ fontSize:9.5, fontWeight: isActive ? 700 : 600, color: isActive ? activeColor.fg : color, letterSpacing:0.2, lineHeight:1.2 }}>{label}</div>
      {sub && (
        <div style={{ fontSize: isActive ? 10 : 8.5, opacity: isActive ? 0.95 : 0.7, color: isActive ? activeColor.fg : 'inherit', fontWeight: isActive ? 700 : 400, fontVariantNumeric:'tabular-nums', marginTop:1 }}>{sub}</div>
      )}
    </div>
  );
};

// ---- tooltip ----------------------------------------------------------------
const Tooltip = ({ title, desc, state, hint, color='#5ac8fa', side='below' }) => (
  <div data-va-tooltip style={{
    position:'absolute',
    [side === 'above' ? 'bottom' : 'top']: 'calc(100% + 8px)',
    left:'50%', transform:'translate(-50%, -4px)',
    background:'rgba(20,22,28,0.96)',
    border:'1px solid rgba(255,255,255,0.1)',
    borderRadius:10,
    padding:'10px 12px',
    minWidth:200, maxWidth:240,
    fontSize:10.5, lineHeight:1.45,
    boxShadow:'0 12px 36px rgba(0,0,0,0.55)',
    backdropFilter:'blur(20px)',
    pointerEvents:'none',
    zIndex:99999,
    opacity:0,
    visibility:'hidden',
    transition:'opacity 120ms ease-out, transform 120ms ease-out',
    textAlign:'left',
  }}>
    <div style={{ fontSize:10, fontWeight:700, color, letterSpacing:0.6, textTransform:'uppercase', marginBottom:4 }}>{title}</div>
    <div style={{ opacity:0.85, marginBottom: state || hint ? 6 : 0 }}>{desc}</div>
    {state && (
      <div style={{
        fontSize:10, opacity:0.65, marginTop:4, padding:'4px 6px',
        background:'rgba(255,255,255,0.04)', borderRadius:4,
        fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace',
        wordBreak:'break-all',
      }}>{state}</div>
    )}
    {hint && (
      <div style={{ fontSize:9, opacity:0.45, marginTop:6, letterSpacing:0.3 }}>↵ {hint}</div>
    )}
  </div>
);

// ---- global styles (injected once) ------------------------------------------
const GlobalStyles = () => (
  <style>{`
    @keyframes va-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
    @keyframes va-pulse-red   { 0%,100%{box-shadow:inset 0 0 0 1px rgba(255,69,58,0.15),0 0 0 1px rgba(255,69,58,0.25),0 0 18px -2px rgba(255,69,58,0.55)} 50%{box-shadow:inset 0 0 0 1px rgba(255,69,58,0.28),0 0 0 1px rgba(255,69,58,0.42),0 0 26px -2px rgba(255,69,58,0.78)} }
    @keyframes va-pulse-blue  { 0%,100%{box-shadow:inset 0 0 0 1px rgba(90,200,250,0.15),0 0 0 1px rgba(90,200,250,0.25),0 0 18px -2px rgba(90,200,250,0.55)} 50%{box-shadow:inset 0 0 0 1px rgba(90,200,250,0.3),0 0 0 1px rgba(90,200,250,0.45),0 0 26px -2px rgba(90,200,250,0.8)} }
    @keyframes va-pulse-amber { 0%,100%{box-shadow:inset 0 0 0 1px rgba(255,159,10,0.15),0 0 0 1px rgba(255,159,10,0.25),0 0 18px -2px rgba(255,159,10,0.55)} 50%{box-shadow:inset 0 0 0 1px rgba(255,159,10,0.3),0 0 0 1px rgba(255,159,10,0.45),0 0 26px -2px rgba(255,159,10,0.8)} }
    @keyframes va-dot-pulse { 0%,100%{opacity:1; transform:scale(1)} 50%{opacity:0.55; transform:scale(0.82)} }
    .va-active.va-pulse-red   { animation: va-pulse-red 2s ease-in-out infinite; }
    .va-active.va-pulse-blue  { animation: va-pulse-blue 1.4s ease-in-out infinite; }
    .va-active.va-pulse-amber { animation: va-pulse-amber 1.8s ease-in-out infinite; }
    .va-live-dot {
      position: absolute; top: 6px; right: 6px;
      width: 6px; height: 6px; border-radius: 50%;
      background: #34c759;
      box-shadow: 0 0 0 2px rgba(20,22,28,0.95), 0 0 8px rgba(52,199,89,0.9);
      animation: va-dot-pulse 1.4s ease-in-out infinite;
    }
    @keyframes va-tt-in { from { opacity:0; transform:translate(-50%,-4px); } to { opacity:1; transform:translate(-50%,0); } }
  `}</style>
);

// ---- active color presets ---------------------------------------------------
const ACTIVE = {
  red:   { rgb:'255,69,58',   fg:'#ff8a7e',  pulseClass:'va-pulse-red'   },
  green: { rgb:'52,199,89',   fg:'#5dd17e',  pulseClass:''               }, // no pulse, has dot
  blue:  { rgb:'90,200,250',  fg:'#7fd6ff',  pulseClass:'va-pulse-blue'  },
  amber: { rgb:'255,159,10',  fg:'#ffb340',  pulseClass:'va-pulse-amber' },
};

// ---- render -----------------------------------------------------------------
export const render = ({ output }) => {
  const [cfRaw='off||', claudeRaw='ok'] = (output || '').split('##');
  const [cfStatus, cfUrl, cfPort] = cfRaw.split('|');
  const claudeStatus = (claudeRaw || 'ok').trim();

  const end = focusEnd();
  const now = Date.now();
  const remaining = end > now ? end - now : 0;
  const focusActive = remaining > 0;
  const mm = String(Math.floor(remaining / 60000)).padStart(2,'0');
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2,'0');
  if (end > 0 && remaining === 0) stopFocus();

  // tunnel state
  let tunnel;
  if (cfStatus === 'missing') {
    tunnel = {
      id:'tunnel', icon:'alert', label:'Install', sub:'cloudflared',
      accent:'rgba(255,159,10,0.10)',
      activeColor: ACTIVE.amber,
      tip:{ title:'Install Cloudflared', desc:'Tunnel feature needs the cloudflared CLI. Click to install via Homebrew.', state:'not found in $PATH', hint:'click → opens Terminal', color:'#ff9f0a' },
      onClick: (e) => __clickGuard(e.currentTarget, () => actions.tunnelInstall())(e),
    };
  } else if (cfStatus === 'on' && cfUrl) {
    tunnel = {
      id:'tunnel', icon:'wifi', label:'Tunnel live', sub:`:${cfPort||'?'}`,
      accent:'rgba(52,199,89,0.10)',
      activeColor: ACTIVE.green, showDot: true,
      tip:{ title:'Tunnel Live', desc:'Public HTTPS URL is up. Click copies URL to clipboard. Shift-click stops the tunnel.', state:cfUrl, hint:'click → copy · shift+click → stop', color:'#34c759' },
      onClick: (e) => __clickGuard(e.currentTarget, () => e.shiftKey ? actions.tunnelStop() : actions.tunnelCopyUrl(cfUrl))(e),
    };
  } else if (cfStatus === 'on') {
    tunnel = {
      id:'tunnel', icon:'loader', iconSpin:true, label:'Booting…', sub:'tunnel',
      accent:'rgba(90,200,250,0.10)',
      activeColor: ACTIVE.blue,
      tip:{ title:'Tunnel Starting', desc:'Cloudflared is booting. Public URL appears in ~10s once tunnel is registered with the edge.', state:'reading /tmp/vibe-tunnel.log', hint:'shift+click → cancel', color:'#5ac8fa' },
      onClick: (e) => __clickGuard(e.currentTarget, () => e.shiftKey && actions.tunnelStop())(e),
    };
  } else {
    tunnel = {
      id:'tunnel', icon:'globe', label:'Share', sub:':3000',
      accent:'rgba(90,200,250,0.10)',
      tip:{ title:'Share localhost', desc:'Starts a Cloudflared tunnel exposing http://localhost:3000 as a public HTTPS URL. Great for sharing dev previews fast.', state:'target: http://localhost:3000', hint:'click → start tunnel', color:'#5ac8fa' },
      onClick: (e) => __clickGuard(e.currentTarget, () => actions.tunnelStart(3000))(e),
    };
  }

  // claude state
  const claudeMissing = claudeStatus === 'missing';
  const claude = claudeMissing
    ? {
        id:'claude', icon:'alert', label:'Install', sub:'claude CLI',
        accent:'rgba(255,159,10,0.10)',
        activeColor: ACTIVE.amber,
        tip:{ title:'Install Claude Code', desc:'Claude CLI not found in $PATH. Click to install via official installer in Terminal.', state:'claude → not found', hint:'click → opens Terminal', color:'#ff9f0a' },
        onClick: (e) => __clickGuard(e.currentTarget, () => actions.installClaude())(e),
      }
    : {
        id:'claude', icon:'terminal', label:'Claude Code', sub:'in Terminal',
        accent:'rgba(255,255,255,0.04)',
        tip:{ title:'Open Claude Code', desc:'Opens a new Terminal window and runs the Claude Code CLI. Drops you straight into a session.', state:'$ claude', hint:'click → open + run', color:'#fff' },
        onClick: (e) => __clickGuard(e.currentTarget, () => actions.openClaude())(e),
      };

  const buttons = [
    {
      id:'focus', icon:'timer',
      label: focusActive ? 'Focus' : 'Pomodoro',
      sub:   focusActive ? `${mm}:${ss}` : '25 min',
      accent: 'rgba(255,255,255,0.04)',
      activeColor: focusActive ? ACTIVE.red : null,
      tip: focusActive
        ? { title:'Focus Active', desc:'25-minute deep work timer running. Click to stop and reset. State survives Übersicht restart.', state:`${mm}:${ss} remaining`, hint:'click → stop', color:'#ff6b5e' }
        : { title:'Pomodoro Timer', desc:'Start a 25-minute focus block. Countdown shows on the button. State stored in localStorage.', state:'idle', hint:'click → start 25 min', color:'#ff6b5e' },
      onClick: (e) => __clickGuard(e.currentTarget, () => focusActive ? stopFocus() : startFocus())(e),
    },
    {
      id:'kill', icon:'trash', label:'Kill dev', sub:'servers',
      accent:'rgba(255,69,58,0.10)',
      tip:{ title:'Kill Dev Servers', desc:'Force-kills any process listening on common dev ports. Use when Vite/Next/Bun gets stuck and refuses to die.', state:'ports: 3000-3, 4000, 4200, 4321, 5000, 5173-4, 5500, 6006, 7700, 8000-1, 8888, 9000', hint:'click → kill all', color:'#ff453a' },
      onClick: (e) => __clickGuard(e.currentTarget, () => actions.killDev())(e),
    },
    tunnel,
    {
      id:'snip', icon:'camera', label:'Region', sub:'screenshot',
      accent:'rgba(90,200,250,0.10)',
      tip:{ title:'Region Screenshot', desc:'Native macOS region picker. Saves PNG to /tmp, copies the file path to clipboard, reveals the file in Finder.', state:'/tmp/snip-<timestamp>.png', hint:'click → drag region', color:'#5ac8fa' },
      onClick: (e) => __clickGuard(e.currentTarget, () => actions.snip())(e),
    },
    {
      id:'open', icon:'folder', label:'Open in', sub:'Cursor',
      accent:'rgba(52,199,89,0.10)',
      tip:{ title:'Open Folder in Cursor', desc:'Opens a native folder picker. Selected folder opens in Cursor (falls back to VS Code if Cursor not installed). Cancel-safe.', state:'picker → open -a Cursor', hint:'click → pick folder', color:'#34c759' },
      onClick: (e) => __clickGuard(e.currentTarget, () => actions.openInCursor())(e),
    },
    claude,
  ];

  return (
    <div ref={__drag} style={{ position:'relative', overflow:'visible' }}>
      <GlobalStyles />
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:6 }}>
        {buttons.map((b, i) => {
          const row = Math.floor(i / 3);
          const side = row === 0 ? 'below' : 'above';
          return (
            <div
              key={b.id}
              style={{ position:'relative' }}
              onMouseEnter={__hoverEnter}
              onMouseLeave={__hoverLeave}
            >
              <Btn
                icon={b.icon}
                iconSpin={b.iconSpin}
                label={b.label}
                sub={b.sub}
                accent={b.accent}
                color={b.color}
                activeColor={b.activeColor}
                disabled={b.disabled}
                showDot={b.showDot}
                onClick={b.onClick}
              />
              {b.tip && <Tooltip {...b.tip} side={side} />}
            </div>
          );
        })}
      </div>
    </div>
  );
};
