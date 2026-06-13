// Vibe Code Utilities — dev tools mini-dashboard
// Refresh every 5s. Drag to reposition. Position persisted in localStorage.

import { run } from 'uebersicht';

export const refreshFrequency = 5000;

export const command = `bash "$HOME/Library/Application Support/Übersicht/widgets/vibe-code.sh"`;

export const className = `
  top: 20px;
  right: 20px;
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
  line-height: 1.35;
`;

// ---- drag + snap (same logic as panel-info) ----
const __dragKey = "ubersicht-pos-vibe-code";
const __drag = (el) => {
  if (!el) return;
  let w = el.parentElement;
  while (w && w !== document.body) {
    if (['absolute','fixed'].includes(window.getComputedStyle(w).position)) break;
    w = w.parentElement;
  }
  if (!w || w.__dragInit_vc) return;
  w.__dragInit_vc = true;
  try { const p = JSON.parse(localStorage.getItem(__dragKey)); if (p) { w.style.top=p.top+'px'; w.style.left=p.left+'px'; w.style.right='auto'; w.style.bottom='auto'; } } catch(e){}
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
    w.__vcMoved = moved;
  });
};

// ---- Port → label ----
const PORT_LABEL = {
  3000:'Next/React', 3001:'React', 3002:'React', 3003:'React',
  4000:'Gatsby', 4200:'Angular', 4321:'Astro',
  5000:'Flask', 5173:'Vite', 5174:'Vite',
  6006:'Storybook', 7700:'MeiliSearch',
  8000:'Django', 8080:'HTTP', 8081:'HTTP', 8888:'Jupyter',
  9000:'PHP', 9200:'Elastic', 11434:'Ollama',
};

// ---- helpers ----
const SectionTitle = ({ label, right }) => (
  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6, marginTop:2 }}>
    <span style={{ fontSize:9, fontWeight:700, letterSpacing:1, opacity:0.45, textTransform:'uppercase' }}>{label}</span>
    {right && <span style={{ fontSize:9, opacity:0.4 }}>{right}</span>}
  </div>
);

const Divider = () => (
  <div style={{ height:1, background:'rgba(255,255,255,0.06)', margin:'10px 0' }} />
);

const Row = ({ children, style }) => (
  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4, ...style }}>
    {children}
  </div>
);

const Tag = ({ children, color }) => (
  <span style={{
    fontSize:8, padding:'1px 5px', borderRadius:3, fontWeight:700, letterSpacing:0.4,
    background:`${color}22`, border:`1px solid ${color}55`, color,
  }}>{children}</span>
);

// ---- render ----
export const render = ({ output }) => {
  if (!output) return <div ref={__drag} style={{ opacity:0.4, fontSize:10 }}>Loading…</div>;

  const sections = output.split('##');
  if (sections.length < 4) return <div ref={__drag}>…</div>;

  const [rawPorts, rawAI, rawGit, rawDocker] = sections;

  // Ports
  const ports = rawPorts ? rawPorts.split(';').filter(Boolean).map(r => {
    const [port, proc] = r.split('|');
    return { port: parseInt(port), proc: proc?.trim() || '?' };
  }) : [];

  // AI Processes
  const aiProcs = rawAI ? rawAI.split(';').filter(Boolean).map(r => {
    const [cpu, mem, name] = r.split('|');
    return { cpu: parseFloat(cpu)||0, mem: parseFloat(mem)||0, name: name?.trim()||'?' };
  }) : [];

  // Git
  const gitRepos = rawGit ? rawGit.split(';').filter(Boolean).map(r => {
    const [name, branch, changes] = r.split('|');
    return { name: name?.trim()||'?', branch: branch?.trim()||'?', changes: parseInt(changes)||0 };
  }) : [];

  // Docker
  const [dockerCount, dockerList] = rawDocker.split('|');
  const containers = dockerList ? dockerList.split(';').filter(Boolean).map(r => {
    const [name, status] = r.split('|');
    return { name: name?.trim()||'?', status: status?.trim()||'?' };
  }) : [];
  const dockerRunning = parseInt(dockerCount) || 0;
  const dockerAvail = dockerCount !== 'n/a';

  return (
    <div ref={__drag}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <span style={{ fontSize:10, fontWeight:700, letterSpacing:0.8, opacity:0.7, textTransform:'uppercase' }}>
          ⌨ Vibe Code
        </span>
        <span style={{ fontSize:9, opacity:0.3 }}>
          {new Date().toLocaleTimeString('en', {hour:'2-digit',minute:'2-digit',second:'2-digit'})}
        </span>
      </div>

      {/* DEV PORTS */}
      <SectionTitle label="Dev Ports" right={ports.length ? `${ports.length} active` : 'none'} />
      {ports.length === 0 && (
        <div style={{ opacity:0.3, fontSize:10, marginBottom:2 }}>No dev servers running</div>
      )}
      {ports.map(({ port, proc }) => (
        <Row key={port}>
          <span style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ color:'#5ac8fa', fontWeight:600, fontVariantNumeric:'tabular-nums' }}>:{port}</span>
            <span style={{ opacity:0.55 }}>{PORT_LABEL[port] || proc}</span>
          </span>
          <span
            onClick={() => run(`lsof -ti:${port} | xargs kill -9 2>/dev/null`)}
            style={{
              fontSize:8, padding:'1px 5px', borderRadius:3, cursor:'pointer',
              color:'#ff453a', background:'rgba(255,69,58,0.12)', border:'1px solid rgba(255,69,58,0.3)',
              fontWeight:700, letterSpacing:0.3,
            }}
          >KILL</span>
        </Row>
      ))}

      <Divider />

      {/* AI PROCESSES */}
      <SectionTitle label="AI Processes" right={aiProcs.length ? `${aiProcs.length} running` : 'none'} />
      {aiProcs.length === 0 && (
        <div style={{ opacity:0.3, fontSize:10, marginBottom:2 }}>No AI tools detected</div>
      )}
      {aiProcs.map(({ cpu, mem, name }, i) => (
        <Row key={i}>
          <span style={{ opacity:0.8, fontWeight:500 }}>{name}</span>
          <span style={{ display:'flex', gap:6 }}>
            <Tag color={cpu > 20 ? '#ff9500' : '#34c759'}>{cpu.toFixed(1)}% CPU</Tag>
            <Tag color="#5ac8fa">{mem.toFixed(1)}% MEM</Tag>
          </span>
        </Row>
      ))}

      <Divider />

      {/* GIT REPOS */}
      <SectionTitle label="Git Repos" right={gitRepos.length ? `${gitRepos.length} found` : null} />
      {gitRepos.length === 0 && (
        <div style={{ opacity:0.3, fontSize:10, marginBottom:2 }}>No repos found in ~/Sites ~/dev</div>
      )}
      {gitRepos.map(({ name, branch, changes }, i) => (
        <Row key={i}>
          <span style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
            <span style={{ opacity:0.8, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:130 }}>{name}</span>
            <span style={{ color:'#bf5af2', fontSize:10, opacity:0.8 }}>{branch}</span>
          </span>
          {changes > 0
            ? <Tag color="#ff9500">{changes} change{changes !== 1 ? 's' : ''}</Tag>
            : <Tag color="#34c759">clean</Tag>
          }
        </Row>
      ))}

      {/* DOCKER (only if available) */}
      {dockerAvail && (
        <>
          <Divider />
          <SectionTitle label="Docker" right={`${dockerRunning} running`} />
          {containers.length === 0 && (
            <div style={{ opacity:0.3, fontSize:10 }}>No containers running</div>
          )}
          {containers.map(({ name, status }, i) => (
            <Row key={i}>
              <span style={{ opacity:0.8 }}>{name}</span>
              <span style={{ opacity:0.45, fontSize:10 }}>{status.replace(/^Up /,'↑ ')}</span>
            </Row>
          ))}
        </>
      )}

      {/* Footer */}
      <div style={{ marginTop:10, textAlign:'right', fontSize:9, opacity:0.25, display:'flex', alignItems:'center', justifyContent:'flex-end', gap:5 }}>
        by Julio Ferracini
        <svg onClick={() => run('open https://github.com/jferracini/ubersicht-panel-monitoring')}
          style={{ cursor:'pointer', display:'block' }} width="10" height="10" viewBox="0 0 98 96" fill="currentColor">
          <path fillRule="evenodd" clipRule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"/>
        </svg>
      </div>

    </div>
  );
};
