// nlp-to-json.js - Convert natural language to JSON format
export function convertNaturalLanguageToJSON(text) {
  const result = {
    version: 1,
    metadata: {
      title: "Recommended Architecture for ISDA", 
      subtitle: "Future Expansion",
      theme: "light"
    },
    lanes: [],
    nodes: [],
    edges: [],
    notes: [],
    bands: [],
    busses: []
  };
  
  // Define standard lanes based on your target image
  const standardLanes = [
    { id: 'future_expansion', title: 'Future Expansion' },
    { id: 'perimeter_network', title: 'Perimeter Network (DMZ)' },
    { id: 'process_lan', title: 'Process LAN (TLS 1.2+ Secured)' },
    { id: 'supervisory_network', title: 'Supervisory Network' },
    { id: 'device_communication', title: 'Device Communication Network' }
  ];
  
  result.lanes = standardLanes;
  
  // Component recognition patterns
  const componentPatterns = {
    // Future Expansion
    'analytics': { lane: 'future_expansion', kind: 'edge', title: 'Analytics Clients', sub: 'Future' },
    'rds': { lane: 'future_expansion', kind: 'database', title: 'RDS Clients', sub: 'Future' },
    
    // Perimeter Network  
    'historian': { lane: 'perimeter_network', kind: 'database', title: 'Historian B', sub: 'Active' },
    
    // Process LAN
    'engineering': { lane: 'process_lan', kind: 'edge', title: 'Engineering Client 2', sub: 'Active' },
    'client': { lane: 'process_lan', kind: 'edge', title: 'Engineering Client', sub: 'Active' },
    
    // Supervisory Network
    'io server': { lane: 'supervisory_network', kind: 'server', title: 'IO Server', sub: 'Primary' },
    'server': { lane: 'supervisory_network', kind: 'server', title: 'IO Server', sub: 'Secondary' },
    
    // Device Communication
    'safety': { lane: 'device_communication', kind: 'app', title: 'Safety', sub: 'Critical' },
    'lofs': { lane: 'device_communication', kind: 'server', title: 'LOFS', sub: 'Active' },
    'cgss': { lane: 'device_communication', kind: 'server', title: 'CGSS', sub: 'Active' },
    'rpop': { lane: 'device_communication', kind: 'server', title: 'RPOP', sub: 'Active' },
    'lhfs': { lane: 'device_communication', kind: 'server', title: 'LHFS', sub: 'Active' }
  };
  
  // Extract components from text
  const lowerText = text.toLowerCase();
  let nodeCounter = 0;
  
  Object.entries(componentPatterns).forEach(([keyword, config]) => {
    if (lowerText.includes(keyword)) {
      result.nodes.push({
        id: `${config.kind}_${keyword.replace(/\s+/g, '_')}_${nodeCounter++}`,
        lane: config.lane,
        kind: config.kind,
        title: config.title,
        sub: config.sub
      });
    }
  });
  
  // If no components found, add defaults from your target image
  if (result.nodes.length === 0) {
    result.nodes = [
      { id: 'analytics_clients', lane: 'future_expansion', kind: 'edge', title: 'Analytics Clients', sub: 'Future' },
      { id: 'rds_clients', lane: 'future_expansion', kind: 'database', title: 'RDS Clients', sub: 'Future' },
      { id: 'historian_b', lane: 'perimeter_network', kind: 'database', title: 'Historian B', sub: 'Active' },
      { id: 'engineering_client', lane: 'process_lan', kind: 'edge', title: 'Engineering Client 2', sub: 'Active' },
      { id: 'clients', lane: 'process_lan', kind: 'edge', title: 'Clients (N...)', sub: 'Active' },
      { id: 'io_server_b', lane: 'supervisory_network', kind: 'server', title: 'IO Server B', sub: 'Primary' },
      { id: 'io_server_c', lane: 'supervisory_network', kind: 'server', title: 'IO Server C', sub: 'Secondary' },
      { id: 'safety', lane: 'device_communication', kind: 'app', title: 'Safety', sub: 'Critical' },
      { id: 'lofs', lane: 'device_communication', kind: 'server', title: 'LOFS', sub: 'Active' },
      { id: 'cgss', lane: 'device_communication', kind: 'server', title: 'CGSS', sub: 'Active' },
      { id: 'rpop', lane: 'device_communication', kind: 'server', title: 'RPOP', sub: 'Active' },
      { id: 'lhfs', lane: 'device_communication', kind: 'server', title: 'LHFS', sub: 'Active' }
    ];
  }
  
  // Add some basic connections
  if (result.nodes.length > 1) {
    result.edges = [
      { from: 'engineering_client', to: 'io_server_b', style: 'solid', label: 'connects' },
      { from: 'io_server_b', to: 'io_server_c', style: 'dashed', label: 'sync' },
      { from: 'io_server_b', to: 'safety', style: 'solid', label: 'data' }
    ];
  }
  
  return result;
}
