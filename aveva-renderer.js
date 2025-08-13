// AVEVA Architecture Micro SVG Renderer — v1.4 (ESM)
// Tolerant parsing + auto-layout + converters:
//  - "lan/components" → canonical schema
//  - "zones/subnets/nodes" (+ connections) → canonical schema
// Public API: StyleTokens, extractAvevaBlock, parseAvevaArch, coerceToSchema,
//             renderAvevaArch, renderFromLLM

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
const slug = (s) => String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
function esc(s){ return (s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ---------- tolerant parsing ----------
export function extractAvevaBlock(text){
  if (!text) throw new Error('Empty input');
  let m = String(text).match(/```aveva-arch\s*([\s\S]*?)\s*```/m); if (m) return m[1];
  m = String(text).match(/```json\s*([\s\S]*?)\s*```/m); if (m) return m[1];
  m = String(text).match(/```\s*([\s\S]*?)\s*```/m);
  if (m && m[1].trim().startsWith('{') && m[1].trim().endsWith('}')) return m[1];
  const t = String(text).trim(); if (t.startsWith('{') && t.endsWith('}')) return t;
  throw new Error('No ```aveva-arch fenced block found.');
}
export function parseAvevaArch(block){
  const t = String(block).trim();
  if(!t.startsWith('{')) throw new Error('Expecting JSON object.');
  return JSON.parse(t);
}

// ---------- converters ----------
function kindFrom(str=''){
  const s = String(str).toLowerCase();
  if (/historian|repository|database|sql|db|pi\s*server/.test(s)) return 'database';
  if (/cloud|connect/.test(s)) return 'cloud';
  if (/client|hmi|web/.test(s)) return 'edge';
  return 'app';
}
function uniqPush(arr, edge){
  if (!arr.some(e => e.from===edge.from && e.to===edge.to && (e.label||'')===(edge.label||''))) arr.push(edge);
}

// A) "lan/components" → canonical
function fromLanComponents(input){
  const out = { version: 1, metadata: { title: input.name || 'Architecture' }, lanes: [], nodes: [], edges: [], notes: [] };
  const lan = Array.isArray(input.lan) ? input.lan : [];
  const nodesByComponent = new Map();
  lan.forEach((lane, li)=>{
    const laneId = slug(lane.id || lane.name || `lane-${li+1}`) || `l${li+1}`;
    out.lanes.push({ id: laneId, title: lane.name || `Lane ${li+1}` });
    (lane.components||[]).forEach((c, ci)=>{
      const baseTitle = c.name || c.type || `Component ${ci+1}`;
      const baseKind = kindFrom(c.type||c.name);
      const insts = Array.isArray(c.instances) && c.instances.length ? c.instances : [ { name: baseTitle } ];
      const ids = [];
      insts.forEach((inst, ii)=>{
        const title = inst.name || `${baseTitle} ${ii+1}`;
        const id = slug(`${laneId}-${title}`) || `n${out.nodes.length+1}`;
        out.nodes.push({ id, lane: laneId, kind: baseKind, title, sub: (c.group||c.type||'').toString().slice(0,40), w: 240, h: 80 });
        ids.push(id);
      });
      nodesByComponent.set(c, ids);
    });
  });
  const byTitle = new Map(out.nodes.map(n=>[n.title.toLowerCase(), n.id]));
  const findIdsByName = (name) => {
    const q = String(name||'').toLowerCase();
    const exact = byTitle.get(q); if (exact) return [exact];
    return out.nodes.filter(n=> n.title.toLowerCase().includes(q)).map(n=>n.id);
  };
  (input.lan||[]).forEach(l => (l.components||[]).forEach(c=>{
    const fromIds = nodesByComponent.get(c)||[];
    const list = [];
    if (Array.isArray(c.connections)) list.push(...c.connections);
    if (typeof c.connection === 'string') list.push(c.connection);
    if (typeof c.feeds === 'string') list.push(c.feeds);
    list.forEach(name => findIdsByName(name).forEach(to => fromIds.forEach(from => uniqPush(out.edges, { from, to, style: 'solid', label: '' }))));
  }));
  return out;
}

// B) "zones/subnets/nodes (+ connections)" → canonical
function fromZonesSubnets(input){
  const out = {
    version: 1,
    metadata: { title: input.title || input.name || 'Architecture' },
    lanes: [], nodes: [], edges: [], notes: []
  };
  const lanesByName = new Map();
  const nodeIndex = new Map();

  // lanes + nodes
  const zones = Array.isArray(input.zones) ? input.zones : [];
  zones.forEach((zone, zi)=>{
    const laneId = slug(zone.id || zone.name || `lane-${zi+1}`) || `l${zi+1}`;
    lanesByName.set(zone.name||laneId, laneId);
    out.lanes.push({ id: laneId, title: zone.name || `Lane ${zi+1}` });

    (zone.subnets||[]).forEach(sub=>{
      (sub.nodes||[]).forEach(node=>{
        const id = String(node.id || slug(`${laneId}-${node.name||node.type||'node'}`) || `n${out.nodes.length+1}`);
        const title = node.name || node.type || id;
        const subTxt = (node.type || node.role || '').toString().slice(0,60);
        const kind = kindFrom(node.type || title);
        const n = { id, lane: laneId, kind, title, sub: subTxt, w: 240, h: 80 };
        out.nodes.push(n);
        nodeIndex.set(id, n);

        // inline interfaces → edges
        (node.interfaces||[]).forEach(ifc=>{
          const to = String(ifc.to || '').trim();
          if (to) uniqPush(out.edges, { from: id, to, style: 'solid', label: (ifc.type || '').toString() });
        });
      });
    });
  });

  // top-level connections
  (input.connections||[]).forEach(c=>{
    const from = String(c.from||'').trim();
    const to   = String(c.to||'').trim();
    if (from && to){
      if (c.via){
        uniqPush(out.edges, { from, to: String(c.via), style: 'solid', label: String(c.protocol||'') });
        uniqPush(out.edges, { from: String(c.via), to, style: 'solid', label: String(c.description||'') });
      } else {
        uniqPush(out.edges, { from, to, style: 'solid', label: String(c.protocol||'') });
      }
    }
  });

  // optional lane overrides
  const lp = input.labels && Array.isArray(input.labels.lanPlacement) ? input.labels.lanPlacement : [];
  lp.forEach(entry=>{
    const laneId = lanesByName.get(entry.zone) || Array.from(lanesByName.values())[0];
    (entry.nodeIds||[]).forEach(nid=>{
      const n = nodeIndex.get(String(nid)); if (n) n.lane = laneId;
    });
  });

  // filter bad edges + shorten labels
  const idSet = new Set(out.nodes.map(n=>n.id));
  out.edges = out.edges.filter(e => idSet.has(e.from) && idSet.has(e.to))
                       .map(e => ({ ...e, label: (e.label||'').slice(0,40) }));

  // AVEVA heuristics (add common links if missing)
  const byPredicate = (kw) => out.nodes.filter(n => (n.title + ' ' + (n.sub||'')).toLowerCase().includes(kw));
  const repo = byPredicate('repository');
  const obj  = byPredicate('object server');
  const omi  = byPredicate('omi');
  const web  = byPredicate('client');
  const hist = byPredicate('historian');
  const pi   = byPredicate('pi server');
  const hub  = out.nodes.filter(n=> /connect|cloud/i.test(n.title));

  const ensure = (a,b,label) => {
    if (!a||!b) return;
    if (!out.edges.some(e=>e.from===a.id && e.to===b.id)) out.edges.push({ from:a.id, to:b.id, style:'solid', label: label||'' });
  };
  repo.forEach(r=> obj.forEach(o=> ensure(r,o,'Config')));
  for(let i=0;i<Math.min(obj.length, omi.length);i++) ensure(obj[i],omi[i],'Real-time');
  omi.forEach(o=> web.forEach(w=> ensure(o,w,'Web HMI')));
  obj.forEach(o=> hist.forEach(h=> ensure(o,h,'Process Data')));
  hist.forEach(h=> pi.forEach(p=> ensure(h,p,'Historical Data')));
  pi.forEach(p=> hub.forEach(h=> ensure(p,h,'Enterprise')));

  return out;
}

export function coerceToSchema(input){
  if (input && Array.isArray(input.lanes) && Array.isArray(input.nodes)) return input; // already canonical
  if (input && Array.isArray(input.lan))   return fromLanComponents(input);
  if (input && Array.isArray(input.zones)) return fromZonesSubnets(input);
  return { version: 1, metadata: { title: input?.title || input?.name || 'Architecture' }, lanes: [], nodes: [], edges: [], notes: [] };
}

// ---------- layout & svg ----------
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
function iconForKind(kind){ return kind==='database'?'sym-database':kind==='cloud'?'sym-cloud':'edge'===kind?'sym-edge':'sym-app'; }

function normalizeData(data){
  const lanes = data.lanes || [];
  const laneIds = new Set(lanes.map(l=>l.id));
  const nodes = (data.nodes||[]).filter(n=> laneIds.has(n.lane));
  for(const n of nodes){ n.w = SNAP(n.w ?? 240); n.h = SNAP(n.h ?? 80); }
  return { ...data, lanes, nodes, edges: data.edges||[], notes: data.notes||[] };
}
function computeRanks(nodes, edges){
  const byId = new Map(nodes.map(n=>[n.id,n]));
  const out = new Map();
  const indeg = Object.fromEntries(nodes.map(n=>[n.id,0]));
  for(const e of (edges||[])){ if(byId.has(e.from) && byId.has(e.to)){ (out.get(e.from) || out.set(e.from,[]), out.get(e.from)).push(e.to); indeg[e.to]++; } }
  const q=[]; const rank={};
  for(const id in indeg){ if(indeg[id]===0){ q.push(id); rank[id]=0; } }
  while(q.length){ const a=q.shift(); const r=rank[a]; for(const b of (out.get(a)||[])){ rank[b]=Math.max(rank[b]??0, r+1); if(--indeg[b]===0) q.push(b); } }
  for(const n of nodes){ if(rank[n.id]==null) rank[n.id]=1; }
  return rank;
}
function autoLayoutRank(model, width){
  const { lanes, nodes } = model;
  const rank = computeRanks(nodes, model.edges||[]);
  const x0 = 80, col = 280, gapX = 120;
  const yStart = 48, rowGap = 24;
  const perLane = new Map(lanes.map(l=>[l.id, []]));
  for(const n of nodes) perLane.get(n.lane).push(n);
  for(const arr of perLane.values()) arr.sort((a,b)=> (rank[a.id]-rank[b.id]) || a.title.localeCompare(b.title));
  for(const [laneId, arr] of perLane){
    const seenByRank = new Map();
    for(const n of arr){
      const r=rank[n.id]; const idx = seenByRank.get(r)||0; seenByRank.set(r, idx+1);
      n.x = SNAP(x0 + r*(col+gapX));
      n.y = SNAP(yStart + idx*(n.h + rowGap));
    }
  }
  const maxX = Math.max(...nodes.map(n=>n.x + n.w));
  const margin = 80;
  if (maxX > width - margin){
    const scale = (width - margin - x0) / (maxX - x0);
    for(const n of nodes){ n.x = SNAP(x0 + (n.x - x0) * scale); }
  }
}
function manhattanPath(a,b){
  const ax=a.x+a.w, ay=a.y+a.h/2, bx=b.x, by=b.y+b.h/2;
  const mx=ax+20, nx=bx-20;
  return `M ${ax} ${ay} L ${mx} ${ay} L ${mx} ${by} L ${nx} ${by} L ${bx} ${by}`;
}
function midpoint(d){ const nums=(d.match(/[-\d.]+/g)||[]).map(Number); const i=Math.floor(nums.length/2); return {x:nums[i-2]||0,y:nums[i-1]||0}; }

// ---------- main API ----------
export function renderFromLLM(llmText, options){
  let data = parseAvevaArch(extractAvevaBlock(llmText));
  data = coerceToSchema(data);
  return renderAvevaArch(data, options);
}
export function renderAvevaArch(input, opts={}){
  const width = opts.width ?? 1400, height = opts.height ?? 720;
  const laneGap = opts.laneGap ?? 16, lanePadding = opts.lanePadding ?? 16;
  const useAuto = opts.autolayout !== false;

  let data = coerceToSchema(input);
  data = normalizeData(data);

  const missingXY = data.nodes.some(n => n.x==null || n.y==null);
  if (useAuto || missingXY) autoLayoutRank(data, width);

  const lanes = data.lanes || [];
  const laneH = Math.floor((height - laneGap*(lanes.length+1)) / Math.max(1,lanes.length));

  const laneTop = new Map();
  let ty = laneGap; for(const l of lanes){ laneTop.set(l.id, ty); ty += laneH + laneGap; }
  for(const n of data.nodes){
    const top = laneTop.get(n.lane) ?? laneGap;
    if (n.y >= top && n.y <= top + laneH) n.y = n.y - top; // absolute → lane-local
    n.y = Math.max(24, Math.min(laneH - n.h - 24, n.y));   // clamp
  }

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
    const color = env==='prod'?StyleTokens.color.success:env==='nonprod'?StyleTokens.color.warn:(/test|dev/i.test(env)?StyleTokens.color.accent:StyleTokens.color.muted);
    parts.push(`<g transform="translate(${Math.min(380,width*0.27)},-2)"><rect rx="10" ry="10" x="0" y="0" height="18" width="${env.length*8+20}" fill="${color}"/><text x="10" y="9" dominant-baseline="middle" style="font:${StyleTokens.type.badge}; fill:#0A0E1A; text-transform:uppercase; letter-spacing:.08em;">${esc(env)}</text></g>`);
  }
  parts.push(`</g>`);

  // lanes
  for(const l of lanes){
    const ly = laneTop.get(l.id);
    parts.push(`<rect class="lane" x="${laneGap}" y="${ly}" width="${width-laneGap*2}" height="${laneH}" rx="8"/>`);
    parts.push(`<text class="title" x="${laneGap+lanePadding}" y="${ly+10}" style="font:${StyleTokens.type.title}; text-transform:uppercase; letter-spacing:.08em;">${esc(l.title)}</text>`);
  }

  // edges (below nodes)
  const nodeBy = new Map(); for(const n of (data.nodes||[])) nodeBy.set(n.id,n);
  for(const e of (data.edges||[])){
    const a=nodeBy.get(e.from), b=nodeBy.get(e.to); if(!a||!b) continue;
    const ay = (laneTop.get(a.lane)||0) + a.y; const by = (laneTop.get(b.lane)||0) + b.y;
    const A = { x: a.x, y: ay, w: a.w, h: a.h }; const B = { x: b.x, y: by, w: b.w, h: b.h };
    const path = manhattanPath(A,B); const dashed = e.style==='dashed';
    parts.push(`<path class="edge${dashed?' edge-dashed':''}" d="${path}" marker-end="url(#arrow)"/>`);
    if(e.label){ const m = midpoint(path); parts.push(`<text x="${m.x}" y="${m.y-4}" text-anchor="middle" style="font:${StyleTokens.type.nodeSub}; fill:${StyleTokens.color.muted};">${esc(e.label)}</text>`); }
  }

  // nodes
  for(const n of (data.nodes||[])){
    const ly = (laneTop.get(n.lane)??laneGap) + n.y;
    parts.push(`<g data-node="${esc(n.id)}" transform="translate(${n.x},${ly})">`);
    parts.push(`<rect class="node" x="0" y="0" width="${n.w}" height="${n.h}" rx="${StyleTokens.geom.nodeRadius}"/>`);
    const icon = n.icon || iconForKind(n.kind);
    parts.push(`<g transform="translate(${n.w-28},10) scale(0.9)"><use href="#${icon}" stroke="${StyleTokens.color.primary}"/></g>`);
    parts.push(`<text x="12" y="18" style="font:${StyleTokens.type.nodeTitle}; fill:${StyleTokens.color.text};">${esc(n.title)}</text>`);
    if(n.sub) parts.push(`<text x="12" y="36" style="font:${StyleTokens.type.nodeSub}; fill:${StyleTokens.color.muted};">${esc(n.sub)}</text>`);
    parts.push(`</g>`);
  }

  // notes (absolute)
  for(const note of (data.notes||[])){
    const ly = note.lane ? ((laneTop.get(note.lane)||0)) : 0;
    parts.push(`<text x="${laneGap+note.x}" y="${ly+note.y}" style="font:${StyleTokens.type.nodeSub}; fill:${StyleTokens.color.muted};">${esc(note.text)}</text>`);
  }

  parts.push(`</svg>`);
  return parts.join('');
}
