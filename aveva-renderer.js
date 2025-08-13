// AVEVA Architecture Micro SVG Renderer — v1.6 (ESM)
// - Tolerant parsing of `aveva-arch`/`json` fences or raw JSON
// - Auto-layout (ranked left→right), grid snapping
// - Safe lane-local Y clamp (prevents stacking), better scaling
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
  geom: { grid: 8, nodeRadius: 12, nodeStroke: 1.25, edgeStroke: 1.25, arrowSize: 7 }
};

const GRID = 8;
const SNAP = (v) => Math.round(v / GRID) * GRID;
const esc = (s) => (s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// ---------- tolerant parsing ----------
export function extractAvevaBlock(text){
  if (!text) throw new Error('Empty input');
  const str = String(text);
  let m = str.match(/```aveva-arch\s*([\s\S]*?)\s*```/m); if (m) return m[1];
  m = str.match(/```json\s*([\s\S]*?)\s*```/m);          if (m) return m[1];
  m = str.match(/```\s*([\s\S]*?)\s*```/m);
  if (m && m[1].trim().startsWith('{') && m[1].trim().endsWith('}')) return m[1];
  const t = str.trim();
  if (t.startsWith('{') && t.endsWith('}')) return t;
  throw new Error('No ```aveva-arch fenced block found.');
}
export function parseAvevaArch(block){
  const t = String(block).trim();
  if (!t.startsWith('{')) throw new Error('Expecting JSON object.');
  return JSON.parse(t);
}
export function renderFromLLM(llmText, options){
  const data = parseAvevaArch(extractAvevaBlock(llmText));
  return renderAvevaArch(data, options);
}

// ---------- style ----------
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
  const symDB    = `<symbol id="sym-database" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="8" ry="3" fill="none" stroke="${t.color.primary}" stroke-width="${t.geom.nodeStroke}"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" fill="none" stroke="${t.color.primary}" stroke-width="${t.geom.nodeStroke}"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" fill="none" stroke="${t.color.primary}" stroke-width="${t.geom.nodeStroke}"/></symbol>`;
  const symEdge  = `<symbol id="sym-edge" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3" fill="none" stroke="${t.color.primary}" stroke-width="${t.geom.nodeStroke}"/><path d="M8 8h8v8H8z" fill="none" stroke="${t.color.primary}" stroke-width="${t.geom.nodeStroke}"/></symbol>`;
  const symApp   = `<symbol id="sym-app" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2" fill="none" stroke="${t.color.primary}" stroke-width="${t.geom.nodeStroke}"/><circle cx="12" cy="12" r="3" fill="none" stroke="${t.color.primary}" stroke-width="${t.geom.nodeStroke}"/></symbol>`;
  return arrow + symCloud + symDB + symEdge + symApp;
}
const iconForKind = (k) => k==='database' ? 'sym-database' : k==='cloud' ? 'sym-cloud' : k==='edge' ? 'sym-edge' : 'sym-app';

// ---------- normalization & layout ----------
function normalizeData(data){
  const lanes = data.lanes || [];
  const laneIds = new Set(lanes.map(l => l.id));
  const nodes = (data.nodes || []).filter(n => laneIds.has(n.lane));
  for (const n of nodes){
    n.w = SNAP(n.w ?? 240);
    n.h = SNAP(n.h ?? 80);
    if (n.x != null) n.x = SNAP(n.x);
    if (n.y != null) n.y = SNAP(n.y);
  }
  return { ...data, lanes, nodes, edges: data.edges || [], notes: data.notes || [] };
}

function computeRanks(nodes, edges){
  const byId = new Map(nodes.map(n => [n.id, n]));
  const out = new Map();
  const indeg = Object.fromEntries(nodes.map(n => [n.id, 0]));
  for (const e of edges){
    if (byId.has(e.from) && byId.has(e.to)){
      if (!out.has(e.from)) out.set(e.from, []);
      out.get(e.from).push(e.to);
      indeg[e.to]++;
    }
  }
  const q = [], rank = {};
  for (const id in indeg) if (indeg[id] === 0) { q.push(id); rank[id] = 0; }
  while (q.length){
    const a = q.shift(), r = rank[a];
    for (const b of (out.get(a) || [])){
      rank[b] = Math.max(rank[b] ?? 0, r + 1);
      if (--indeg[b] === 0) q.push(b);
    }
  }
  for (const n of nodes) if (rank[n.id] == null) rank[n.id] = 1;
  return rank;
}

function autoLayoutRank(model, width){
  const { lanes, nodes, edges } = model;
  const rank = computeRanks(nodes, edges);
  const x0 = 80, col = 280, gapX = 120;   // columns ~ 80, 480, 880, ...
  const yStart = 48, rowGap = 24;

  const perLane = new Map(lanes.map(l => [l.id, []]));
  for (const n of nodes) perLane.get(n.lane).push(n);
  for (const arr of perLane.values())
    arr.sort((a,b) => (rank[a.id]-rank[b.id]) || a.title.localeCompare(b.title));

  for (const [laneId, arr] of perLane){
    const rowsByRank = new Map();
    for (const n of arr){ const r = rank[n.id]; rowsByRank.set(r, (rowsByRank.get(r) || 0) + 1); }
    const seen = new Map();
    for (const n of arr){
      const r = rank[n.id];
      const idx = seen.get(r) || 0; seen.set(r, idx + 1);
      n.x = SNAP(x0 + r * (col + gapX));
      n.y = SNAP(yStart + idx * (n.h + rowGap));
    }
  }

  // scale horizontally if we overflow
  const maxX = Math.max(...nodes.map(n => n.x + n.w));
  const margin = 80;
  if (maxX > width - margin){
    const scale = (width - margin - x0) / (maxX - x0);
    for (const n of nodes) n.x = SNAP(x0 + (n.x - x0) * scale);
  }
}

function manhattanPath(a,b){
  const ax = a.x + a.w, ay = a.y + a.h/2, bx = b.x, by = b.y + b.h/2;
  const mx = ax + 20, nx = bx - 20;
  return `M ${ax} ${ay} L ${mx} ${ay} L ${mx} ${by} L ${nx} ${by} L ${bx} ${by}`;
}
function midpoint(d){
  const nums = (d.match(/[-\d.]+/g) || []).map(Number);
  const i = Math.floor(nums.length/2);
  return { x: nums[i-2] || 0, y: nums[i-1] || 0 };
}

// ---------- renderer ----------
export function renderAvevaArch(input, opts = {}){
  const width = opts.width ?? 1400;
  const height = opts.height ?? 960;         // taller default
  const laneGap = opts.laneGap ?? 16;
  const lanePadding = opts.lanePadding ?? 16;
  const useAuto = opts.autolayout !== false; // default ON

  const data = normalizeData(input);

  // If any node lacks x/y OR auto is forced, run auto-layout
  const missingXY = data.nodes.some(n => n.x == null || n.y == null);
  if (useAuto || missingXY) autoLayoutRank(data, width);

  const lanes = data.lanes || [];
  const laneH = Math.floor((height - laneGap * (lanes.length + 1)) / Math.max(1, lanes.length));

  // Build lane Y positions
  const laneTop = new Map();
  let ty = laneGap;
  for (const l of lanes){ laneTop.set(l.id, ty); ty += laneH + laneGap; }

  // Safe lane-local Y clamp (no stacking)
  const padY = 16;
  for (const n of data.nodes){
    const top = laneTop.get(n.lane) ?? laneGap;
    // Treat "big" values as absolute Y and convert; otherwise assume already lane-local
    if ((n.y ?? 0) > laneH) n.y = n.y - top;
    const maxLocal = Math.max(padY, laneH - (n.h ?? 80) - padY);
    const local = (n.y ?? padY);
    n.y = Math.min(Math.max(local, padY), maxLocal);
  }

  // SVG
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
  parts.push(`<style>${defaultCSS()}</style><defs>${defaultDefs()}</defs>`);
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="${StyleTokens.color.bg}"/>`);

  // Header
  const title = data.metadata?.title || 'Architecture';
  const subtitle = data.metadata?.subtitle || '';
  const env = data.metadata?.env;
  parts.push(`<g transform="translate(${laneGap},${laneGap/2})">`);
  parts.push(`<text class="title" x="0" y="0" dominant-baseline="hanging" style="font:${StyleTokens.type.title}; text-transform:uppercase; letter-spacing:.08em;">${esc(title)}</text>`);
  if (subtitle) parts.push(`<text x="0" y="18" style="font:${StyleTokens.type.nodeSub}; fill:${StyleTokens.color.muted};">${esc(subtitle)}</text>`);
  if (env){
    const color = env === 'prod' ? StyleTokens.color.success : env === 'nonprod' ? StyleTokens.color.warn : StyleTokens.color.danger;
    const badgeW = Math.max(54, env.length*8 + 20);
    parts.push(`<g transform="translate(${Math.min(420, width*0.3)},-2)"><rect rx="10" ry="10" x="0" y="0" height="18" width="${badgeW}" fill="${color}"/><text x="${badgeW/2}" y="9" text-anchor="middle" dominant-baseline="middle" style="font:${StyleTokens.type.badge}; fill:#0A0E1A; text-transform:uppercase; letter-spacing:.08em;">${esc(env)}</text></g>`);
  }
  parts.push(`</g>`);

  // Lanes
  for (const l of lanes){
    const ly = laneTop.get(l.id);
    parts.push(`<rect class="lane" x="${laneGap}" y="${ly}" width="${width - laneGap*2}" height="${laneH}" rx="8"/>`);
    parts.push(`<text class="title" x="${laneGap + lanePadding}" y="${ly + 10}" style="font:${StyleTokens.type.title}; text-transform:uppercase; letter-spacing:.08em;">${esc(l.title)}</text>`);
  }

  // Node map
  const nodeBy = new Map();
  for (const n of data.nodes) nodeBy.set(n.id, n);

  // Edges underneath nodes
  for (const e of (data.edges || [])){
    const a = nodeBy.get(e.from), b = nodeBy.get(e.to); if (!a || !b) continue;
    const ay = (laneTop.get(a.lane) || 0) + a.y;
    const by = (laneTop.get(b.lane) || 0) + b.y;
    const A = { x: a.x, y: ay, w: a.w, h: a.h };
    const B = { x: b.x, y: by, w: b.w, h: b.h };
    const d = manhattanPath(A,B);
    const dashed = e.style === 'dashed';
    parts.push(`<path class="edge${dashed?' edge-dashed':''}" d="${d}" marker-end="url(#arrow)"/>`);
    if (e.label){ const m = midpoint(d); parts.push(`<text x="${m.x}" y="${m.y-4}" text-anchor="middle" style="font:${StyleTokens.type.nodeSub}; fill:${StyleTokens.color.muted};">${esc(e.label)}</text>`); }
  }

  // Nodes
  for (const n of data.nodes){
    const ly = (laneTop.get(n.lane) ?? laneGap) + n.y;
    parts.push(`<g data-node="${esc(n.id)}" transform="translate(${n.x},${ly})">`);
    parts.push(`<rect class="node" x="0" y="0" width="${n.w}" height="${n.h}" rx="${StyleTokens.geom.nodeRadius}"/>`);
    const icon = n.icon || iconForKind(n.kind);
    parts.push(`<g transform="translate(${n.w-28},10) scale(0.9)"><use href="#${icon}" stroke="${StyleTokens.color.primary}"/></g>`);
    parts.push(`<text x="12" y="18" style="font:${StyleTokens.type.nodeTitle}; fill:${StyleTokens.color.text};">${esc(n.title)}</text>`);
    if (n.sub) parts.push(`<text x="12" y="36" style="font:${StyleTokens.type.nodeSub}; fill:${StyleTokens.color.muted};">${esc(n.sub)}</text>`);
    parts.push(`</g>`);
  }

  // Notes (absolute within lane)
  for (const note of (data.notes || [])){
    const ly = note.lane ? (laneTop.get(note.lane) || 0) : 0;
    parts.push(`<text x="${laneGap + note.x}" y="${ly + note.y}" style="font:${StyleTokens.type.nodeSub}; fill:${StyleTokens.color.muted};">${esc(note.text)}</text>`);
  }

  parts.push(`</svg>`);
  return parts.join('');
}
