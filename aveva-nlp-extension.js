// aveva-nlp-extension.js - Extension for natural language processing
import { coerceToSchema, renderAvevaArch } from './aveva-renderer.js';

// Enhanced component recognition patterns
const COMPONENT_PATTERNS = {
  database: /\b(database|db|historian|analytics|rds|data\s*store|repository|sql|nosql|oracle|postgres|mysql|mongo)\b/i,
  cloud: /\b(cloud|aws|azure|gcp|saas|paas|connect|hub|online|remote)\b/i,
  edge: /\b(client|gateway|proxy|load\s*balancer|edge|engineering|workstation|desktop|mobile|app|frontend)\b/i,
  server: /\b(server|backend|api|service|microservice|worker|processor|compute|vm|instance|io|rmc|lofs|cgss|rpop|lhfs)\b/i,
  network: /\b(network|router|switch|firewall|dmz|vpn|load\s*balancer|proxy)\b/i,
  storage: /\b(storage|file\s*system|nas|san|s3|blob|disk|volume)\b/i,
  security: /\b(security|auth|authentication|authorization|sso|ldap|active\s*directory|certificate|ssl|tls|safety)\b/i,
  monitoring: /\b(monitor|logging|metrics|alerts|observability|telemetry|dashboard)\b/i
};

const ZONE_PATTERNS = {
  dmz: /\b(dmz|perimeter|external|public|internet)\b/i,
  internal: /\b(internal|private|corporate|intranet|secure)\b/i,
  cloud: /\b(cloud|public\s*cloud|hybrid|multi.?cloud)\b/i,
  data: /\b(data|database|storage|persistence)\b/i,
  compute: /\b(compute|processing|application|business\s*logic)\b/i,
  presentation: /\b(presentation|ui|frontend|client|user)\b/i,
  process: /\b(process|lan|secured|certificate)\b/i,
  supervisory: /\b(supervisory|network|control)\b/i,
  device: /\b(device|communication|field)\b/i
};

// Natural language parser
function parseNaturalLanguage(text) {
  const lanes = [];
  const nodes = [];
  const edges = [];
  
  const sentences = text.split(/[.!?]+/);
  let currentLane = 'default';
  
  sentences.forEach((sentence, idx) => {
    // Detect zone/environment mentions
    for (const [zoneType, pattern] of Object.entries(ZONE_PATTERNS)) {
      if (pattern.test(sentence)) {
        if (!lanes.find(l => l.id === zoneType)) {
          lanes.push({ 
            id: zoneType, 
            title: zoneType.charAt(0).toUpperCase() + zoneType.slice(1) + ' Network' 
          });
        }
        currentLane = zoneType;
        break;
      }
    }
    
    // Extract components
    const words = sentence.toLowerCase().split(/\s+/);
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = words.slice(i, i + 3).join(' ');
      
      for (const [componentType, pattern] of Object.entries(COMPONENT_PATTERNS)) {
        if (pattern.test(phrase)) {
          const id = `${componentType}_${nodes.length + 1}`;
          nodes.push({
            id,
            lane: currentLane,
            kind: componentType,
            title: extractComponentName(sentence, phrase) || componentType,
            sub: extractComponentDetails(sentence)
          });
          break;
        }
      }
    }
  });
  
  // Ensure at least one lane exists
  if (lanes.length === 0) {
    lanes.push({ id: 'default', title: 'Application Layer' });
  }
  
  // Infer connections based on common patterns
  inferConnections(nodes, edges, text);
  
  return { version: 1, metadata: {}, lanes, nodes, edges, notes: [], bands: [], busses: [] };
}

// Helper functions
function extractComponentName(sentence, phrase) {
  const namePattern = /([A-Z][a-zA-Z0-9]*(?:\s+[A-Z][a-zA-Z0-9]*)*)/g;
  const matches = sentence.match(namePattern);
  return matches ? matches[0] : null;
}

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
          style: 'solid'
        });
      }
    }
  });
}

function findNodeByName(nodes, name) {
  const cleanName = name.toLowerCase();
  return nodes.find(n => 
    n.title.toLowerCase().includes(cleanName) ||
    n.id.toLowerCase().includes(cleanName)
  );
}

// Enhanced renderer function that tries natural language parsing
export function renderFromNaturalLanguage(input, options = {}) {
  try {
    // First try existing coercion (handles JSON and structured formats)
    const data = coerceToSchema(input);
    return renderAvevaArch(data, options);
  } catch (error) {
    // Fall back to natural language processing
    console.log('Trying natural language parsing...');
    const data = parseNaturalLanguage(input);
    return renderAvevaArch(data, options);
  }
}

export { parseNaturalLanguage, COMPONENT_PATTERNS, ZONE_PATTERNS };
