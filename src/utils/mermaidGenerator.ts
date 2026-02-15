
import type { NokiaDevice, NokiaInterface, NetworkTopology, HAPair } from '../types';

interface DiagramGroup {
  id: string;
  haPair?: HAPair;
  items: Array<{
    device: NokiaDevice;
    intf: NokiaInterface;
    peerIp: string;
    relatedRoutes: string[];
  }>;
}

export function findPeerAndRoutes(device: NokiaDevice, intf: NokiaInterface): { peerIp: string; relatedRoutes: string[] } {
  let peerIp = 'Unknown';
  const relatedRoutes: string[] = [];

  if (!intf.ipAddress) return { peerIp, relatedRoutes };
  const network = parseNetwork(intf.ipAddress);
  if (!network) return { peerIp, relatedRoutes };

  device.staticRoutes.forEach(route => {
    if (isIpInSubnet(route.nextHop, intf.ipAddress!)) {
      if (route.nextHop !== network.ip) {
        peerIp = route.nextHop;
        relatedRoutes.push(route.prefix);
      }
    }
  });

  // /30 Inference
  if (peerIp === 'Unknown' && network.prefixLen === 30) {
    const hosts = getHostsInNetwork(network.ip, network.prefixLen);
    for (const h of hosts) {
      if (h !== network.ip) {
        peerIp = h;
        break;
      }
    }
  }

  // VRRP-based peer inference
  if (peerIp === 'Unknown' && intf.vrrpVip) {
    const hosts = getHostsInNetwork(network.ip, network.prefixLen);
    for (const h of hosts) {
      // Find IP that is not our own IP and not the VIP
      if (h !== network.ip && h !== intf.vrrpVip) {
        peerIp = h;
        break;
      }
    }
  }

  return { peerIp, relatedRoutes };
}

export const generateMermaidDiagram = (
  topology: NetworkTopology,
  selectedIds: string[]
): Array<{ name: string; code: string; description: string }> => {
  console.log("Generating Mermaid Diagram. Selected IDs:", selectedIds);
  const groups: Map<string, DiagramGroup> = new Map();

  // Collect all selected interfaces with their routes
  const selectedInterfaces: Array<{
    qId: string;
    device: NokiaDevice;
    intf: NokiaInterface;
    peerIp: string;
    relatedRoutes: string[];
  }> = [];

  // 1. Collect selected interfaces and their routes
  topology.devices.forEach(device => {
    device.interfaces.forEach(intf => {
      const qId = `${device.hostname}:${intf.name}`;

      if (selectedIds.includes(qId)) {
        console.log(`Match found for: ${qId}`);
        const { peerIp, relatedRoutes } = findPeerAndRoutes(device, intf);
        console.log(`Interface ${qId} -> Peer: ${peerIp}, Routes: ${relatedRoutes}`);

        selectedInterfaces.push({ qId, device, intf, peerIp, relatedRoutes });
      }
    });
  });

  // 2. Group interfaces by common routes (HA detection)
  const processed = new Set<string>();

  selectedInterfaces.forEach((item1, idx1) => {
    if (processed.has(item1.qId)) return;

    // Find if this interface shares routes with another interface
    let haPair: HAPair | undefined;
    let groupItems = [item1];

    for (let idx2 = idx1 + 1; idx2 < selectedInterfaces.length; idx2++) {
      const item2 = selectedInterfaces[idx2];
      if (processed.has(item2.qId)) continue;

      // Check if they share any common routes (Customer Network)
      const commonRoutes = item1.relatedRoutes.filter(r => item2.relatedRoutes.includes(r));

      if (commonRoutes.length > 0) {
        console.log(`🔗 [HA Detection] Found HA pair via common routes:`, commonRoutes);
        console.log(`  - ${item1.qId} (${item1.peerIp})`);
        console.log(`  - ${item2.qId} (${item2.peerIp})`);

        // Create dynamic HA pair
        haPair = {
          device1: item1.peerIp,
          device2: item2.peerIp,
          type: 'interface-based',
          commonNetwork: commonRoutes[0] // Use first common route
        };

        groupItems.push(item2);
        processed.add(item2.qId);
      }
    }

    // Create group
    const groupId = haPair
      ? `HA:${[haPair.device1, haPair.device2].sort().join('-')}:${haPair.commonNetwork || 'dynamic'}`
      : `SINGLE:${item1.qId}`;

    if (!groups.has(groupId)) {
      groups.set(groupId, { id: groupId, haPair, items: [] });
    }

    groupItems.forEach(item => {
      groups.get(groupId)!.items.push({
        device: item.device,
        intf: item.intf,
        peerIp: item.peerIp,
        relatedRoutes: item.relatedRoutes
      });
    });

    processed.add(item1.qId);
  });

  const result: Array<{ name: string; code: string; description: string }> = [];

  // 2. Generate Diagrams for each group
  groups.forEach((group) => {
    if (group.haPair) {
      // Sort items by hostname ascending
      group.items.sort((a, b) => a.device.hostname.localeCompare(b.device.hostname));

      // Combined HA Diagram
      const title = group.items.map(i => `${i.device.hostname}:${i.intf.name}`).join(' & ');
      result.push({
        name: `이중화: ${title}`,
        code: generateCombinedHaDiagram(group, topology),
        description: '이중화 토폴로지'
      });
    } else {
      // Single Diagram (Original behavior)
      group.items.forEach(item => {
        result.push({
          name: `${item.device.hostname} - ${item.intf.name}`,
          code: generateSingleInterfaceDiagram(item.device, item.intf, topology),
          description: item.intf.portDescription || ''
        });
      });
    }
  });

  return result;
};

// Helper: Non-wrapping text
const noWrap = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/ /g, '\u00A0')
    .replace(/-/g, '\u2011');
};

// Format QoS rate for edge labels (KMG conversion)
function formatQosEdgeRate(policyIdStr: string, rate?: number, rateMax?: boolean): string {
  if (rateMax) return 'Max';
  if (rate) {
    const kbps = rate;
    if (kbps >= 1000000) {
      const g = kbps / 1000000;
      return `${Number.isInteger(g) ? g : g.toFixed(1)}G`;
    } else if (kbps >= 1000) {
      const m = kbps / 1000;
      return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
    } else {
      return `${kbps}K`;
    }
  }
  return policyIdStr;
}

// Build QoS edge label for IES diagrams
function buildQosEdgeLabel(intf: NokiaInterface): string {
  const inQos = formatQosEdgeRate(intf.ingressQos || 'Default', intf.ingressQosRate, intf.ingressQosRateMax);
  const outQos = formatQosEdgeRate(intf.egressQos || 'Default', intf.egressQosRate, intf.egressQosRateMax);
  const content = `In\u2011QoS:\u00A0${inQos}\u003cbr/\u003eOut\u2011QoS:\u00A0${outQos}`;
  return `\u003cdiv class='qos-label'\u003e${content}\u003c/div\u003e`;
}

// Build node label per DIAGRAM_RULES.md 5.3
function buildNodeLabel(device: NokiaDevice, intf: NokiaInterface): string {
  const nbsp = '\u00A0';
  const nbhy = '\u2011';
  const indent1 = `${nbsp}${nbsp}${nbhy}${nbsp}`;
  const indent2 = `${nbsp}${nbsp}${nbsp}${nbsp}${nbhy}${nbsp}`;

  let label = `<div style="text-align: left">`;
  label += `<b>Host:</b>${nbsp}${noWrap(device.hostname)}<br/><br/>`;

  // Interface (top-level)
  label += `<b>Interface:</b>${nbsp}${noWrap(intf.name)}<br/>`;

  // Desc
  if (intf.description) {
    label += `${indent1}<b>Desc:</b>${nbsp}${noWrap(intf.description)}<br/>`;
  }

  // IP
  if (intf.ipAddress) {
    label += `${indent1}<b>IP:</b>${nbsp}${noWrap(intf.ipAddress)}<br/>`;
  }

  // VRRP
  if (intf.vrrpVip) {
    const role = (intf.vrrpPriority && intf.vrrpPriority >= 100) ? 'MASTER' : 'BACKUP';
    label += `${indent1}<b>VRRP:</b>${nbsp}${intf.vrrpVip}${nbsp}(${role})<br/>`;
  }

  // VPLS
  if (intf.vplsName) {
    label += `${indent1}<b>VPLS:</b>${nbsp}${noWrap(intf.vplsName)}<br/>`;
  }

  // SAP
  const sapId = intf.sapId || (intf.portId && intf.portId.includes(':') ? intf.portId : undefined);
  if (sapId) {
    label += `${indent1}<b>SAP:</b>${nbsp}${noWrap(sapId)}<br/>`;
  }

  // Port (extract from SAP ID before ":", or use portId)
  const portId = sapId ? sapId.split(':')[0] : intf.portId;
  if (portId) {
    label += `${indent1}<b>Port:</b>${nbsp}${noWrap(portId)}<br/>`;

    // Port Description
    if (intf.portDescription) {
      label += `${indent2}<b>Desc:</b>${nbsp}${noWrap(intf.portDescription)}<br/>`;
    }

    // Ethernet sub-fields
    if (intf.portEthernet) {
      const pe = intf.portEthernet;
      const ethFields: string[] = [];
      if (pe.mode) ethFields.push(`${indent2}<b>Mode:</b>${nbsp}${pe.mode}`);
      if (pe.mtu) ethFields.push(`${indent2}<b>MTU:</b>${nbsp}${pe.mtu}`);
      if (pe.speed) ethFields.push(`${indent2}<b>SPEED:</b>${nbsp}${pe.speed}`);
      if (pe.autonegotiate) ethFields.push(`${indent2}<b>AUTONEGO:</b>${nbsp}${pe.autonegotiate.toUpperCase()}`);
      if (pe.networkQueuePolicy) ethFields.push(`${indent2}<b>NETWORK:</b>${nbsp}${noWrap(pe.networkQueuePolicy)}`);
      if (pe.lldp) ethFields.push(`${indent2}<b>LLDP:</b>${nbsp}${pe.lldp}`);

      if (ethFields.length > 0) {
        label += `${indent2}<b>Ethernet:</b><br/>`;
        label += ethFields.join('<br/>') + '<br/>';
      }
    }
  }

  // IP-MTU
  if (intf.mtu) {
    label += `${indent1}<b>IP${nbhy}MTU:</b>${nbsp}${intf.mtu}<br/>`;
  }

  // Spoke-Sdp
  if (intf.spokeSdpId) {
    label += `${indent1}<b>Spoke${nbhy}Sdp:</b>${nbsp}${noWrap(intf.spokeSdpId)}<br/>`;
  }

  label += `</div>`;
  return label;
}

// Generate Combined HA Diagram
export function generateCombinedHaDiagram(group: DiagramGroup, _topology: NetworkTopology): string {
  const mermaid = ['graph LR'];

  // Local Subgraph
  mermaid.push(`    subgraph Local["<b>Local Hosts</b>"]`);
  group.items.forEach((item, idx) => {
    const nodeName = `L${idx}`;
    const label = buildNodeLabel(item.device, item.intf);
    mermaid.push(`        ${nodeName}["${label}"]`);
  });
  mermaid.push('    end');

  // Peer Subgraph - Create individual Peer nodes for each interface
  mermaid.push(`    subgraph Remote["<b>Remote HA Pair</b>"]`);
  group.items.forEach((item, idx) => {
    const peerNode = `Peer${idx}`;
    const peerIp = item.peerIp || 'Unknown';
    const peerLabel = `<b>Peer IP</b><br/>${peerIp}`;
    mermaid.push(`        ${peerNode}["${peerLabel}"]`);
  });
  mermaid.push('    end');

  // Customer Network (if common routes exist)
  const commonRoutes = group.items[0].relatedRoutes;
  if (commonRoutes.length > 0) {
    const routesStr = commonRoutes.join('<br/>');
    const cLabel = `<b>Customer Network</b><br/>${routesStr}`;
    mermaid.push(`    subgraph Network["<b>Network</b>"]`);
    mermaid.push(`        N["${cLabel}"]`);
    mermaid.push('    end');
  }

  // Links with QoS - Connect each Local to its corresponding Peer
  group.items.forEach((item, idx) => {
    const localNode = `L${idx}`;
    const peerNode = `Peer${idx}`;
    const qosLabel = buildQosEdgeLabel(item.intf);
    mermaid.push(`    ${localNode} -->|"${qosLabel}"| ${peerNode}`);
  });

  // Link Peers to Network if exists
  if (commonRoutes.length > 0) {
    group.items.forEach((_, idx) => {
      mermaid.push(`    Peer${idx} -.-> N`);
    });
  }

  // Styles
  group.items.forEach((_, idx) => {
    mermaid.push(`    style L${idx} fill:#ffffff,stroke:#333,stroke-width:2px,color:#000,text-align:left`);
    mermaid.push(`    style Peer${idx} fill:#e6f3ff,stroke:#0066cc,stroke-width:2px,color:#000`);
  });
  if (commonRoutes.length > 0) {
    mermaid.push(`    style N fill:#ffffff,stroke:#333,stroke-width:2px,stroke-dasharray: 5 5,color:#000`);
  }

  return mermaid.join('\n');
}

// Generate Single Interface Diagram (Original Beta Format)
export function generateSingleInterfaceDiagram(device: NokiaDevice, intf: NokiaInterface, _topology: NetworkTopology): string {
  const mermaid: string[] = ['graph LR'];
  const { peerIp, relatedRoutes } = findPeerAndRoutes(device, intf);

  const leftLabel = buildNodeLabel(device, intf);

  mermaid.push(`    subgraph Host ["<b>${noWrap(device.hostname)}</b>"]`);
  mermaid.push(`        A["${leftLabel}"]`);
  mermaid.push(`    end`);

  const rightTitle = intf.description || 'Remote Connected Device';
  mermaid.push(`    subgraph Remote ["<b>${noWrap(rightTitle)}</b>"]`);
  mermaid.push(`        B["<b>Next-Hop</b><br/>${peerIp}"]`);

  let cLabel: string;
  if (relatedRoutes.length > 0) {
    const routesStr = relatedRoutes.join('<br/>');
    cLabel = `<b>Customer Network</b><br/>${routesStr}`;
  } else {
    cLabel = '<b>Customer Network</b>';
  }

  mermaid.push(`        C["${cLabel}"]`);
  mermaid.push(`    end`);

  const qosLabel = buildQosEdgeLabel(intf);
  mermaid.push(`    A -->|"${qosLabel}"| B`);
  mermaid.push(`    B -.-> C`);

  mermaid.push('    style A fill:#ffffff,stroke:#333,stroke-width:2px,color:#000,text-align:left');
  mermaid.push('    style B fill:#e6f3ff,stroke:#0066cc,stroke-width:2px,color:#000');
  mermaid.push('    style C fill:#ffffff,stroke:#333,stroke-width:2px,stroke-dasharray: 5 5,color:#000');

  return mermaid.join('\n');
}

// Helper functions
function parseNetwork(ipWithCidr: string): { ip: string; prefixLen: number; networkAddr: number } | null {
  const parts = ipWithCidr.split('/');
  if (parts.length !== 2) return null;
  const ip = parts[0];
  const prefixLen = parseInt(parts[1], 10);
  if (isNaN(prefixLen)) return null;
  const ipLong = ipToLong(ip);
  if (ipLong === -1) return null;
  const mask = ~((1 << (32 - prefixLen)) - 1) >>> 0;
  return { ip, prefixLen, networkAddr: (ipLong & mask) >>> 0 };
}

function getHostsInNetwork(ip: string, prefixLen: number): string[] {
  const data = parseNetwork(`${ip}/${prefixLen}`);
  if (!data) return [];
  if (prefixLen === 30) {
    return [longToIp(data.networkAddr + 1), longToIp(data.networkAddr + 2)];
  }
  return [];
}

function isIpInSubnet(targetIp: string, interfaceIpWithCidr: string): boolean {
  const net = parseNetwork(interfaceIpWithCidr);
  if (!net) return false;
  const targetLong = ipToLong(targetIp);
  if (targetLong === -1) return false;
  const mask = ~((1 << (32 - net.prefixLen)) - 1) >>> 0;
  return (targetLong & mask) >>> 0 === net.networkAddr;
}

function ipToLong(ip: string): number {
  const parts = ip.split('.');
  if (parts.length !== 4) return -1;
  return parts.reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
}

function longToIp(num: number): string {
  return [(num >>> 24) & 255, (num >>> 16) & 255, (num >>> 8) & 255, num & 255].join('.');
}
