// AVEVA Architecture Micro SVG Renderer — v1.0 (ESM)
// Public API: StyleTokens, extractAvevaBlock, parseAvevaArch, renderAvevaArch, renderFromLLM

export const StyleTokens = {
  color: {
    bg: '#0E1220', surface: '#141A2A', primary: '#5CC8F6', secondary: '#9DE2D5',
    accent: '#F6B35C', muted: '#93A1B5', text: '#E7ECF4', grid: '#1F2742',
    warn: '#F3A33C', danger: '#FF6B6B', success: '#4FD1A1'
  },
  type: {
    title: '700 12px Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
    nodeTitle: '600 14px Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
    nodeSub: '500 12px Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
    badge: '700 10px Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
  },
  geom: { grid: 8, nodeRadius: 12, nodeStroke: 1.25, edgeStroke: 1, arrowSize: 7 }
};

function esc(s){ return (s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// --- Parsing helpers ---
export function extractAvevaBlock(text){
  const re = /```aveva-arch\n([\s\S]*?)\n```/m;
  const m = text.match(re);
  if(!m) throw new Error('No ```aveva-arch fenced block found.');
  return m[1];
}

export function parseAvevaArch(block){ // JSON-only to avoid extra deps
  const trimmed = block.trim();
  if(!trimmed.startsWith('{')) throw new Error('Expecting JSON inside the `aveva-arch` fence.');
  return JSON.parse(trimmed);
}

export function renderFromLLM(llmText, options){
  const data = parseAvevaArch(extractAvevaBlock(llmText));
  return renderAvevaArch(data, options);
}

// --- SVG bits ---
function defaultCSS(t=StyleTokens){
  return `.lane{fill:${t.color.surface};stroke:${t.color.grid};stroke-width:1}
.node{fill:${t.color.surface};stroke:${t.color.primary};stroke-width:${t.geom.nodeStroke};rx:${t.geom.nodeRadius}}
.edge{stroke:${t.color.muted};stroke-width:${t.geom.edgeStroke};fill:none}
.edge-dashed{stroke-dasharray:6 4}
.title{fill:${t.color.text}}`;
}

function defaultDefs(t=StyleTokens){
  const arrow = `<marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="${t.geom.arrowSize}" markerHeight="${t.geom.arrowSize}" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="${t.color.muted}"/></marker>`;
  const symCloud = `<symbol id="sym-cloud" viewBox="0 0 24 24"><path d="M7 17h10a4 4 0 0 0 0-8 5 5 0 0 0-9.8 1.5A3.5 3.5 0 0 0 7 17z" fill="none" stroke="${t.color.primary}" stroke-width="${t.geom.nodeStroke}" stroke-linejoin="round"/></symbol>`;
  const symDB = `<symbol id="sym-database" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="8" ry="3" fill="none" stroke="${t.color.primary}" stroke-width="${t.geom.nodeStroke}"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" fill="none" stroke="${t.color.primary}" stroke-width="${t.geom.nodeStroke}"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" fill="none" stroke="${t.color.primary}" stroke-width="${t.geom.nodeStroke}"/></symbol>`;
  const symEdge = `<symbol id="sym-edge" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3" fill="none" stroke="${t.color.primary}" stroke-width="${t.geom.nodeStroke}"/><path d="M8 8h8v8H8z" fill="none" stroke="${t.color.primary}" stroke-width="${t.geom.nodeStroke}"/></symbol>`;
  const symApp = `<symbol id="sym-app" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2" fill="none" stroke="${t.color.primary}" stroke-width="${t.geom.nodeStroke}"/><circle cx="12" cy="12" r="3" fill="none" stroke="${t.color.primary}" stroke-width="${t.geom.nodeStroke}"/></symbol>`;
  return arrow + symCloud + symDB + symEdge + symApp;
}

function iconForKind(kind){ return kind==='database'?'sym-database':kind==='cloud'?'sym-cloud':kind==='edge'?'sym-edge':'sym-app'; }
function manhattanPath(a,b){
  const ax=a.x+a.w, ay=a.y+a.h/2, bx=b.x, by=b.y+b.h/2;
  const mx=ax+20, nx=bx-20;
  return `M ${ax} ${ay} L ${mx} ${ay} L ${mx} ${by} L ${nx} ${by} L ${bx} ${by}`;
}
function midpoint(d){
  const nums=(d.match(/[-\d.]+/g)||[]).map(Number);
  const i=Math.floor(nums.length/2);
  return {x:nums[i-2]||0,y:nums[i-1]||0};
}

// --- Main renderer ---
export function renderAvevaArch(data, opts={}){
  const width = opts.width ?? 1400, height = opts.height ?? 720;
  const laneGap = opts.laneGap ?? 16, lanePadding = opts.lanePadding ?? 16;

  const lanes = data.lanes || [];
  const laneH = Math.floor((height - laneGap*(lanes.length+1)) / Math.max(1,lanes.length));

  const laneMap = new Map();
  let y = laneGap;
  for(const l of lanes){ laneMap.set(l.id,{ y, title:l.title }); y += laneH + laneGap; }

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
  parts.push(`<style>${defaultCSS()}</style><defs>${defaultDefs()}</defs>`);
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="${StyleTokens.color.bg}"/>`);

  const title = data.metadata?.title || 'Architecture';
  const subtitle = data.metadata?.subtitle || '';
  const env = data.metadata?.env;
  parts.push(`<g transform="translate(${laneGap},${laneGap/2})">`);
  parts.push(`<text class="title" x="0" y="0" dominant-baseline="hanging" style="font:${StyleTokens.type.title}; text-transform:uppercase; letter-spacing:.08em;">${esc(title)}</text>`);
  if(subtitle) parts.push(`<text x="0" y="18" style="font:${StyleTokens.type.nodeSub}; fill:${StyleTokens.color.muted};">${esc(subtitle)}</text>`);
  if(env){
    const color = env==='prod'?StyleTokens.color.success:env==='nonprod'?StyleTokens.color.warn:StyleTokens.color.danger;
    parts.p
