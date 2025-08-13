// aveva-nlp-extension.js - Enhanced Natural Language Processing Extension
import { coerceToSchema, renderAvevaArch } from './aveva-renderer.js';

// Enhanced component recognition patterns
const COMPONENT_PATTERNS = {
  database: /\b(database|db|historian|analytics|rds|data\s*store|repository|sql|nosql|oracle|postgres|mysql|mongo|pi)\b/i,
  cloud: /\b(cloud|aws|azure|gcp|saas|paas|connect|hub|online|remote)\b/i,
  edge: /\b(client|gateway|proxy|load\s*balancer|edge|engineering|workstation|desktop|mobile|app|frontend)\b/i,
  server: /\b(server|backend|api|service|microservice|worker|processor|compute|vm|instance|io|rmc|lofs|cgss|rpop|lhfs)\b/i,
  network: /\b(network|router|switch|firewall|dmz|vpn|safety)\b/i,
  storage: /\b(storage|file\s*system|nas|san|s3|blob|disk|volume)\b/i,
  security: /\b(security|auth|authentication|authorization|sso|ldap|active\s*directory|certificate|ssl|tls)\b/i,
  monitoring: /\b(monitor|logging|metrics|alerts|observability|telemetry|dashboard)\b/i
};

// Enhanced zone patterns matching the architecture image
const ZONE_PATTERNS = {
  future_expansion: {
    pattern: /\b(future\s*expansion|recommended\s*architecture|expansion)\b/i,
    color: '#E8F4FD', // Light blue background
    title: 'Future Expansion'
  },
  perimeter_network: {
    pattern: /\b(perimeter|dmz|external|public|internet)\b/i,
    color: '#FFE6E6', // Light red background  
    title: 'Perimeter Network (DMZ)'
  },
  process_lan: {
    pattern: /\b(process\s*lan|secured|certificate|tls)\b/i,
    color: '#FFF2E6', // Light orange background
    title: 'Process LAN (TLS 1.2+ Secured)'
  },
  supervisory_network: {
    pattern: /\b(supervisory|control|network)\b/i,
    color: '#F0F8FF', // Light blue background
    title: 'Supervisory Network'  
  },
  device_communication: {
    pattern: /\b(device\s*communication|field|communication)\b/i,
    color: '#E8F5E8', // Light green background
    title: 'Device Communication Network'
  }
};

// Enhanced natural language parser
function parseNaturalLanguage(text) {
  const lanes = [];
  const nodes = [];
  const edges = [];
  const bands = [];
  const busses = [];
  
  let currentLane = 'default';
  const sentences = text.split(/[.!?]+/);
  
  // Extract zones/lanes first with enhanced styling
  for (const [zoneId, zoneInfo] of Object.entries(ZONE_PATTERNS)) {
    if (zoneInfo.pattern.test(text)) {
      lanes.push({
        id: zoneId,
        title: zoneInfo.title
      });
      
      // Add colored background band for each lane
      bands.push({
        id: `${zoneId}_bg`,
        lane: zoneId,
        y: 10,
        h: 120,
        color: zoneInfo.color,
        label: ''
      });
    }
  }
  
  // If no zones found, create default lanes like the architecture image
  if (lanes.length === 0) {
    const defaultLanes = [
      { id: 'future_expansion', title: 'Future Expansion' },
      { id: 'perimeter_network', title: 'Perimeter Network (DMZ)' }, 
      { id: 'process_lan', title: 'Process LAN (TLS 1.2+ Secured)' },
      { id: 'supervisory_network', title: 'Supervisory Network' },
      { id: 'device_communication', title: 'Device Communication Network' }
    ];
    lanes.push(...defaultLanes);
    
    // Add background bands for default lanes
    defaultLanes.forEach((lane, index) => {
      const colors = ['#E8F4FD', '#FFE6E6', '#FFF2E6', '#F0F8FF', '#E8F5E8'];
      bands.push({
        id: `${lane.id}_bg`,
        lane: lane.id,
        y: 10,
        h: 120,
        color: colors[index % colors.length],
        label: ''
      });
    });
  }
  
  // Extract components with enhanced recognition
  sentences.forEach((sentence, idx) => {
    for (const [kind, pattern] of Object.entries(COMPONENT_PATTERNS)) {
      if (pattern.test(sentence)) {
        const words = sentence.split(/\s+/);
        const matchingWords = words.filter(word => pattern.test(word));
        
        matchingWords.forEach((word, wordIdx) => {
          const cleanWord = word.replace(/[^\w\s]/g, '');
          const id = `${kind}_${cleanWord.toLowerCase()}_${nodes.length}`;
          
          if (!nodes.find(n => n.title.toLowerCase() === cleanWord.toLowerCase())) {
            // Assign to appropriate lane based on component type
            let assignedLane = lanes[0]?.id || 'default';
            
            if (kind === 'database' || kind === 'storage') {
              assignedLane = lanes.find(l => l.id.includes('device') || l.id.includes('supervisory'))?.id || assignedLane;
            } else if (kind === 'edge' || kind === 'network') {
              assignedLane = lanes.find(l => l.id.includes('perimeter') || l.id.includes('dmz'))?.id || assignedLane;  
            } else if (kind === 'server') {
              assignedLane = lanes.find(l => l.id.includes('supervisory'))?.id || assignedLane;
            }
            
            nodes.push({
              id,
              lane: assignedLane,
              kind,
              title: cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1),
              sub: extractComponentDetails(sentence) || `${kind} component`
            });
          }
        });
      }
    }
  });
  
  // Create some default nodes if none found
  if (nodes.length === 0) {
    const defaultNodes = [
      { id: 'analytics_clients', lane: 'future_expansion', kind: 'edge', title: 'Analytics Clients', sub: 'Future' },
      { id: 'rds_clients', lane: 'future_expansion', kind: 'database', title: 'RDS Clients', sub: 'Future' },
      { id: 'historian_b', lane: 'perimeter_network', kind: 'database', title: 'Historian B', sub: 'Active' },
      { id: 'engineering_client', lane: 'process_lan', kind: 'edge', title: 'Engineering Client 2', sub: 'Active' },
      { id: 'io_server_b', lane: 'supervisory_network', kind: 'server', title: 'IO server B', sub: 'Primary' },
      { id: 'io_server_c', lane: 'supervisory_network', kind: 'server', title: 'IO server C', sub: 'Secondary' },
      { id: 'safety', lane: 'device_communication', kind: 'network', title: 'Safety', sub: 'Critical' },
      { id: 'lofs', lane: 'device_communication', kind: 'server', title: 'LOFS', sub: 'Active' },
      { id: 'cgss', lane: 'device_communication', kind: 'server', title: 'CGSS', sub: 'Active' },
      { id: 'rpop', lane: 'device_communication', kind: 'server', title: 'RPOP', sub: 'Active' },
      { id: 'lhfs', lane: 'device_communication', kind: 'server', title: 'LHFS', sub: 'Active' }
    ];
    nodes.push(...defaultNodes);
  }
  
  // Add colored busses for network connections (like in the architecture image)
  const networkBusses = [
    { id: 'perimeter_bus', lane: 'perimeter_network', y: 80, h: 8, color: '#FF4444', label: 'RMC RMC RMC' },
    { id: 'process_bus', lane: 'process_lan', y: 80, h: 8, color: '#FFA500', label: 'Process LAN (Certificate Based TLS 1.2 Secured)' },
    { id: 'device_bus', lane: 'device_communication', y: 80, h: 8, color: '#00AA44', label: 'Device Communication' }
  ];
  busses.push(...networkBusses);
  
  // Infer basic connections
  inferConnections(nodes, edges, text);
  
  return {
    version: 1,
    metadata: { 
      title: 'Recommended Architecture for ISDA',
      subtitle: 'Future Expansion',
      theme: 'light' // Use light theme to match the architecture image
    },
    lanes,
    nodes,
    edges,
    notes: [],
    bands,
    busses
  };
}

// Helper functions
function extractComponentDetails(sentence) {
  const detailPattern = /\(([^)]+)\)|"([^"]+)"|'([^']+)'/;
  const match = sentence.match(detailPattern);
  return match ? match[1] || match[2] || match[3] : null;
}

function inferConnections(nodes, edges, originalText) {
  const connectionPatterns = [
    /(\w+)\s+connects?\s+to\s+(\w+)/gi,
    /(\w+)\s+talks?\s+to\s+(\w+)/gi,
    /(\w+)\s+sends?\s+to\s+(\w+)/gi,
    /(\w+)\s+→\s+(\w+)/gi,
    /(\w+)\s+->\s+(\w+)/gi
  ];
  
  connectionPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(originalText)) !== null) {
      const fromNode = findNodeByName(nodes, match[1]);
      const toNode = findNodeByName(nodes, match[2]);
      
      if (fromNode && toNode) {
        edges.push({
          from: fromNode.id,
          to: toNode.id,
          style: 'solid',
          label: 'connects'
        });
      }
    }
  });
  
  // Add some default connections if none found
  if (edges.length === 0 && nodes.length > 1) {
    for (let i = 0; i < nodes.length - 1; i++) {
      const from = nodes[i];
      const to = nodes[i + 1];
      if (from.lane !== to.lane) {
        edges.push({
          from: from.id,
          to: to.id,
          style: Math.random() > 0.5 ? 'solid' : 'dashed',
          label: from.lane.includes('network') ? 'network' : 'data'
        });
      }
    }
  }
}

function findNodeByName(nodes, name) {
  const cleanName = name.toLowerCase();
  return nodes.find(n => 
    n.title.toLowerCase().includes(cleanName) ||
    n.id.toLowerCase().includes(cleanName)
  );
}

// Enhanced renderer function
export function renderFromNaturalLanguage(input, options = {}) {
  try {
    // First try existing coercion (handles JSON and structured formats)
    const data = coerceToSchema(input);
    return renderAvevaArch(data, options);
  } catch (error) {
    // Fall back to natural language processing
    console.log('Trying enhanced natural language parsing...');
    const data = parseNaturalLanguage(input);
    return renderAvevaArch(data, options);
  }
}

export { parseNaturalLanguage, COMPONENT_PATTERNS, ZONE_PATTERNS };
