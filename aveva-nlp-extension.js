// aveva-nlp-extension.js - World-Class Flexible Natural Language Processing

import { coerceToSchema, renderAvevaArch } from './aveva-renderer-1.js';

// Comprehensive component recognition with flexible matching
const COMPONENT_PATTERNS = {
  // Database/Storage Components
  database: {
    patterns: [
      /\b(?:database|db|historian|pi\s*historian|data\s*store|repository|sql|nosql|oracle|postgres|mysql|mongodb?)\b/gi,
      /\b(?:historian|pi)\s*(?:server|system)?\b/gi
    ],
    aliases: ['historian', 'pi historian', 'data store', 'repository', 'db']
  },
  
  // Server Components  
  server: {
    patterns: [
      /\b(?:object\s*servers?|redundant\s*object\s*servers?|io\s*servers?|telemetry\s*servers?)\b/gi,
      /\b(?:servers?|backend|api|service|microservice|worker|processor|compute|vm|instance)\b/gi,
      /\b(?:rmc|lofs|cgss|rpop|lhfs)\s*(?:server|system)?\b/gi
    ],
    aliases: ['server', 'object server', 'io server', 'telemetry server', 'redundant object server']
  },
  
  // Edge/Client Components
  edge: {
    patterns: [
      /\b(?:clients?|gateways?|proxies?|load\s*balancers?|edges?|engineering\s*(?:clients?|workstations?))\b/gi,
      /\b(?:workstations?|desktops?|mobiles?|apps?|frontends?|analytics\s*clients?|rds\s*clients?)\b/gi
    ],
    aliases: ['client', 'gateway', 'workstation', 'engineering client', 'analytics client']
  },
  
  // Network/Device Components
  network: {
    patterns: [
      /\b(?:plcs?|rtus?|safety\s*systems?|networks?|routers?|switches?|firewalls?)\b/gi,
      /\b(?:dmz|vpn|device\s*communication|field\s*devices?)\b/gi
    ],
    aliases: ['plc', 'rtu', 'safety', 'network', 'router', 'switch']
  },
  
  // Cloud/External Components
  cloud: {
    patterns: [
      /\b(?:aveva\s*connect|cloud|aws|azure|gcp|saas|paas|connect|hub|online|remote)\b/gi
    ],
    aliases: ['cloud', 'aveva connect', 'saas', 'remote service']
  }
};

// Enhanced zone detection with flexible patterns
const ZONE_PATTERNS = {
  future_expansion: {
    patterns: [
      /\b(?:future\s*expansion|expansion|future|recommended\s*architecture)\b/gi,
      /\b(?:aveva\s*connect|cloud\s*services?)\b/gi
    ],
    title: 'Future Expansion',
    color: '#EEF2FF'
  },
  
  perimeter_network: {
    patterns: [
      /\b(?:perimeter\s*network|dmz|external|public|internet|perimeter)\b/gi,
      /\b(?:pi\s*historian|external\s*historian)\b/gi
    ],
    title: 'Perimeter Network (DMZ)', 
    color: '#FEF2F2'
  },
  
  process_lan: {
    patterns: [
      /\b(?:process\s*lan|process\s*network|secured|certificate|tls|process)\b/gi,
      /\b(?:object\s*servers?|redundant\s*object\s*servers?|historian)\b/gi
    ],
    title: 'Process LAN (TLS 1.2+ Secured)',
    color: '#FFFBEB'
  },
  
  supervisory_network: {
    patterns: [
      /\b(?:supervisory\s*network|supervisory|control\s*network|control)\b/gi,
      /\b(?:io\s*servers?|telemetry\s*servers?)\b/gi
    ],
    title: 'Supervisory Network',
    color: '#F0F9FF'
  },
  
  device_communication: {
    patterns: [
      /\b(?:device\s*(?:network|communication)|field|device|plcs?|rtus?)\b/gi,
      /\b(?:field\s*devices?|control\s*devices?)\b/gi
    ],
    title: 'Device Communication Network',
    color: '#F0FDF4'
  }
};

// Intelligent component extractor
function extractComponents(text) {
  const components = [];
  const sentences = text.split(/[.!?;]+/).filter(s => s.trim());
  
  sentences.forEach((sentence, sentenceIndex) => {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) return;
    
    // Extract quantities and component names
    const quantityMatches = [...trimmedSentence.matchAll(/(?:we\s+have\s+)?(?:(\d+)\s+)?([^,.]+?)(?:\s+(?:in|on|at)\s+the\s+([^,.]+?))?(?:[,.]\s*|$)/gi)];
    
    quantityMatches.forEach(match => {
      const quantity = parseInt(match[1]) || 1;
      const componentPhrase = match[2]?.trim();
      const locationPhrase = match[3]?.trim();
      
      if (!componentPhrase) return;
      
      // Determine component type and create instances
      const componentType = determineComponentType(componentPhrase);
      const lane = determineLane(componentPhrase, locationPhrase, text);
      
      // Create multiple instances if quantity > 1
      for (let i = 0; i < quantity; i++) {
        const suffix = quantity > 1 ? ` ${String.fromCharCode(65 + i)}` : ''; // A, B, C...
        const title = cleanComponentName(componentPhrase) + suffix;
        
        components.push({
          id: `${componentType.kind}_${slugify(title)}_${components.length}`,
          lane: lane,
          kind: componentType.kind,
          title: title,
          sub: componentType.sub || determineSubtitle(componentPhrase, locationPhrase)
        });
      }
    });
  });
  
  return components;
}

// Intelligent component type determination
function determineComponentType(phrase) {
  const lowerPhrase = phrase.toLowerCase();
  
  for (const [kind, config] of Object.entries(COMPONENT_PATTERNS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(phrase)) {
        return {
          kind: kind,
          sub: getSubtitle(kind, phrase)
        };
      }
    }
  }
  
  // Default fallback
  return { kind: 'app', sub: 'Component' };
}

// Intelligent lane determination
function determineLane(componentPhrase, locationPhrase, fullText) {
  const searchText = `${componentPhrase} ${locationPhrase || ''} ${fullText}`.toLowerCase();
  
  let bestMatch = { lane: 'process_lan', score: 0 };
  
  for (const [laneId, config] of Object.entries(ZONE_PATTERNS)) {
    let score = 0;
    
    for (const pattern of config.patterns) {
      const matches = searchText.match(pattern);
      if (matches) {
        score += matches.length * 10;
      }
    }
    
    // Bonus for location context
    if (locationPhrase) {
      const locationScore = config.patterns.some(p => p.test(locationPhrase)) ? 20 : 0;
      score += locationScore;
    }
    
    if (score > bestMatch.score) {
      bestMatch = { lane: laneId, score };
    }
  }
  
  return bestMatch.lane;
}

// Helper functions
function getSubtitle(kind, phrase) {
  const subtitles = {
    database: 'Data Storage',
    server: 'Processing',
    edge: 'Interface',
    network: 'Control',
    cloud: 'External'
  };
  
  if (phrase.toLowerCase().includes('redundant')) return 'Redundant';
  if (phrase.toLowerCase().includes('primary')) return 'Primary';
  if (phrase.toLowerCase().includes('secondary')) return 'Secondary';
  if (phrase.toLowerCase().includes('telemetry')) return 'Telemetry';
  
  return subtitles[kind] || 'Active';
}

function cleanComponentName(phrase) {
  return phrase
    .replace(/^\d+\s+/, '') // Remove leading numbers
    .replace(/\b(?:redundant|primary|secondary)\s+/gi, '') // Remove status words
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function determineSubtitle(componentPhrase, locationPhrase) {
  const phrase = `${componentPhrase} ${locationPhrase || ''}`.toLowerCase();
  
  if (phrase.includes('redundant')) return 'Redundant';
  if (phrase.includes('primary')) return 'Primary'; 
  if (phrase.includes('secondary')) return 'Secondary';
  if (phrase.includes('telemetry')) return 'Telemetry';
  if (phrase.includes('future')) return 'Future';
  
  return 'Active';
}

// Main natural language parser
function parseNaturalLanguage(text) {
  console.log('Parsing text:', text);
  
  // Create standard lane structure
  const lanes = Object.entries(ZONE_PATTERNS).map(([id, config]) => ({
    id,
    title: config.title
  }));
  
  // Extract components intelligently
  const nodes = extractComponents(text);
  console.log('Extracted nodes:', nodes);
  
  // Generate basic connections between components in different lanes
  const edges = generateConnections(nodes);
  
  return {
    version: 1,
    metadata: {
      title: 'Recommended Architecture for ISDA',
      subtitle: 'Future Expansion',
      theme: 'light'
    },
    lanes,
    nodes,
    edges,
    notes: [],
    bands: [],
    busses: []
  };
}

// Generate logical connections between components
function generateConnections(nodes) {
  const edges = [];
  const laneOrder = ['future_expansion', 'perimeter_network', 'process_lan', 'supervisory_network', 'device_communication'];
  
  // Group nodes by lane
  const nodesByLane = {};
  nodes.forEach(node => {
    if (!nodesByLane[node.lane]) nodesByLane[node.lane] = [];
    nodesByLane[node.lane].push(node);
  });
  
  // Create connections between adjacent lanes
  for (let i = 0; i < laneOrder.length - 1; i++) {
    const currentLane = laneOrder[i];
    const nextLane = laneOrder[i + 1];
    
    const currentNodes = nodesByLane[currentLane] || [];
    const nextNodes = nodesByLane[nextLane] || [];
    
    if (currentNodes.length > 0 && nextNodes.length > 0) {
      edges.push({
        from: currentNodes[0].id,
        to: nextNodes[0].id,
        style: 'solid',
        label: 'connects'
      });
    }
  }
  
  return edges;
}

// Main export function
export function renderFromNaturalLanguage(input, options = {}) {
  try {
    console.log('Natural language input:', input);
    const data = parseNaturalLanguage(input);
    console.log('Parsed data:', data);
    return renderAvevaArch(data, options);
  } catch (error) {
    console.error('NLP rendering failed:', error);
    throw error;
  }
}

export { parseNaturalLanguage };
