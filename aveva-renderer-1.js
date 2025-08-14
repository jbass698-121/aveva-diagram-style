// AVEVA Architecture Micro SVG Renderer — v2.1 (COMPLETE FIXED VERSION)

export const StyleTokens = {
  color: {
    bg: '#FFFFFF',
    surface: '#FFFFFF', 
    grid: '#D1D5DB',
    text: '#1F2937',
    muted: '#6B7280',
    primary: '#3B82F6',
    secondary: '#9DE2D5',
    accent: '#F59E0B',
    warn: '#EF4444',
    danger: '#B91C1C',
    success: '#10B981'
  },
  type: {
    title: '700 20px Inter, system-ui, sans-serif',
    nodeTitle: '600 14px Inter, system-ui, sans-serif',
    nodeSub: '400 12px Inter, system-ui, sans-serif',
    badge: '700 10px Inter, system-ui, sans-serif'
  },
  geom: { grid: 8, nodeRadius: 8, nodeStroke: 2, edgeStroke: 2, arrowSize: 10 }
};

const GRID = 8;
const SNAP = (v) => Math.round((v ?? 0) / GRID) * GRID;
const esc = (s) => (s ?? '').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function resolveTokens(theme) {
  const t = JSON.parse(JSON.stringify(StyleTokens));
  if ((theme || '').toLowerCase() === 'dark') {
    t.color.bg = '#0E1220';
    t.color.surface = '#141B2D';
    t.color.grid = '#1E2A47';
    t.color.text = '#E0E7FF';
    t.color.muted = '#94A3B8';
  }
  return t;
}

export function extractAvevaBlock(text) {
  if (!text) throw new Error('Empty input');
  return String(text);
}

export function parseAvevaArch(block) {
  const t = String(block).trim();
  if (!t.startsWith('{')) throw new Error('Expecting JSON object.');
  return JSON.parse(t);
}

export function coerceToSchema(input) {
  if (typeof input === 'string') {
    try {
      return JSON.parse(input);
    } catch {
      return input;
    }
  }
  
  return {
    version: 1,
    metadata: input.metadata || {},
    lanes: input.lanes || [],
    nodes: input.nodes || [],
    edges: input.edges || [],
    notes: input.notes || [],
    bands: input.bands || [],
    busses: input.busses || []
  };
}

function normalizeData(data) {
  const lanes = data.lanes || [];
  const laneIds = new Set(lanes.map(l => l.id));
  const nodes = (data.nodes || []).filter(n => laneIds.has(n.lane));

  for (const n of nodes) {
    n.w = SNAP(n.w ?? 180);
    n.h = SNAP(n.h ?? 70);
    if (n.x != null) n.x = SNAP(n.x);
    if (n.y != null) n.y = SNAP(n.y);
  }

  return { ...data, lanes, nodes, edges: data.edges || [] };
}

export function renderAvevaArch(input, opts = {}) {
  const width = opts.width ?? 1400;
  const height = opts.height ?? 1000;
  const laneGap = 24;
  const headerHeight = 80;
  const laneHeight = 150;
  
  const coerced = coerceToSchema(input);
  const data = normalizeData(coerced);
  const theme = data.metadata?.theme || 'light';
  const T = resolveTokens(theme);
  const lanes = data.lanes || [];
  
  // Calculate lane positions
  const laneTop = new Map();
  let currentY = headerHeight;
  lanes.forEach(lane => {
    laneTop.set(lane.id, currentY);
    currentY += laneHeight + laneGap;
  });
  
  // Position nodes
  const nodesByLane = new Map();
  lanes.forEach(lane => nodesByLane.set(lane.id, []));
  data.nodes.forEach(node => {
    if (nodesByLane.has(node.lane)) {
      nodesByLane.get(node.lane).push(node);
    }
  });
  
  nodesByLane.forEach((nodes, laneId) => {
    nodes.forEach((node, index) => {
      node.x = 60 + (index * 220);
      node.y = 45;
      node.w = 180;
      node.h = 70;
    });
  });
  
  // Build SVG
  const parts = [];
  parts.push(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`);
  parts.push(`<rect width="100%" height="100%" fill="${T.color.bg}"/>`);
  
  // Header
  const title = data.metadata?.title || 'Architecture Diagram';
  const subtitle = data.metadata?.subtitle || '';
  parts.push(`<text x="40" y="30" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="${T.color.text}">${esc(title)}</text>`);
  if (subtitle) {
    parts.push(`<text x="40" y="50" font-family="Arial, sans-serif" font-size="14" fill="${T.color.muted}">${esc(subtitle)}</text>`);
  }
  
  // Lanes
  const laneColors = ['#EEF2FF', '#FEF2F2', '#FFFBEB', '#F0F9FF', '#F0FDF4'];
  lanes.forEach((lane, index) => {
    const ly = laneTop.get(lane.id);
    const color = laneColors[index % laneColors.length];
    parts.push(`<rect x="20" y="${ly}" width="${width-40}" height="${laneHeight}" fill="${color}" stroke="${T.color.grid}" stroke-width="1" rx="6"/>`);
    parts.push(`<text x="30" y="${ly + 25}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="${T.color.text}">${esc(lane.title)}</text>`);
  });
  
  // Buses
  const busColors = {
    'future_expansion': '#60A5FA',
    'perimeter_network': '#EF4444',
    'process_lan': '#F59E0B', 
    'supervisory_network': '#3B82F6',
    'device_communication': '#10B981'
  };
  
  lanes.forEach(lane => {
    const ly = laneTop.get(lane.id);
    const color = busColors[lane.id] || '#6B7280';
    parts.push(`<rect x="30" y="${ly + laneHeight - 20}" width="${width-60}" height="8" fill="${color}" rx="4"/>`);
    
    if (lane.id === 'perimeter_network') {
      parts.push(`<text x="${width/2}" y="${ly + laneHeight - 25}" font-family="Arial, sans-serif" font-size="10" fill="${T.color.text}" text-anchor="middle">RMC RMC RMC</text>`);
    }
  });
  
  // Arrow marker
  parts.push(`<defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="${T.color.muted}"/></marker></defs>`);
  
  // Edges
  data.edges?.forEach(edge => {
    const fromNode = data.nodes.find(n => n.id === edge.from);
    const toNode = data.nodes.find(n => n.id === edge.to);
    
    if (fromNode && toNode) {
      const fromLaneY = laneTop.get(fromNode.lane) || 0;
      const toLaneY = laneTop.get(toNode.lane) || 0;
      
      const x1 = fromNode.x + fromNode.w;
      const y1 = fromLaneY + fromNode.y + (fromNode.h / 2);
      const x2 = toNode.x;
      const y2 = toLaneY + toNode.y + (toNode.h / 2);
      
      parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${T.color.muted}" stroke-width="2" marker-end="url(#arrowhead)"/>`);
    }
  });
  
  // Nodes
  data.nodes.forEach(node => {
    const laneY = laneTop.get(node.lane) || 0;
    const nodeY = laneY + node.y;
    
    parts.push(`<rect x="${node.x}" y="${nodeY}" width="${node.w}" height="${node.h}" fill="${T.color.surface}" stroke="${T.color.primary}" stroke-width="2" rx="8"/>`);
    parts.push(`<text x="${node.x + 12}" y="${nodeY + 22}" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="${T.color.text}">${esc(node.title)}</text>`);
    
    if (node.sub) {
      parts.push(`<text x="${node.x + 12}" y="${nodeY + 40}" font-family="Arial, sans-serif" font-size="11" fill="${T.color.muted}">${esc(node.sub)}</text>`);
    }
    
    parts.push(`<circle cx="${node.x + node.w - 15}" cy="${nodeY + 15}" r="8" fill="${T.color.primary}" opacity="0.1"/>`);
    parts.push(`<text x="${node.x + node.w - 15}" y="${nodeY + 19}" font-family="Arial, sans-serif" font-size="10" fill="${T.color.primary}" text-anchor="middle">⚙</text>`);
  });
  
  parts.push(`</svg>`);
  return parts.join('');
}

// Export helpers
export function svgToBlob(svgString) {
  return new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
}

export function downloadSvg(svgString, filename = 'architecture.svg') {
  const blob = svgToBlob(svgString);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function svgToRasterDataURL(svgString, opts = {}) {
  const { type = 'image/png', quality = 0.92, width = 1400, height = 1000, scale = 1, background } = opts;
  const W = Math.round(width * scale);
  const H = Math.round(height * scale);
  
  const blob = svgToBlob(svgString);
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = url;
  });
  
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, W, H);
  }
  
  ctx.drawImage(img, 0, 0, W, H);
  URL.revokeObjectURL(url);
  
  return canvas.toDataURL(type, quality);
}

export async function downloadPng(svgString, filename = 'architecture.png', opts = {}) {
  const dataUrl = await svgToRasterDataURL(svgString, { type: 'image/png', ...opts, background: opts.background || '#ffffff' });
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function downloadJpg(svgString, filename = 'architecture.jpg', opts = {}) {
  const dataUrl = await svgToRasterDataURL(svgString, {
    type: 'image/jpeg',
    quality: 0.92,
    background: '#FFFFFF',
    ...opts
  });
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
