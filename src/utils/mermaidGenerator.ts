import type { NokiaDevice, NokiaInterface } from '../types';

export const generateMermaidDiagram = (device: NokiaDevice, selectedInterfaces: string[]): string => {
  const relevantInterfaces = device.interfaces.filter((i) => selectedInterfaces.includes(i.name));

  // Generate a diagram for each selected interface
  const diagrams = relevantInterfaces.map((intf) => generateSingleInterfaceDiagram(device, intf));

  return diagrams.join('\n\n');
};

function generateSingleInterfaceDiagram(device: NokiaDevice, intf: NokiaInterface): string {
  const mermaid: string[] = ['graph LR'];

  // Helper function to format descriptions
  const fmtDesc = (desc?: string): string => {
    return desc ? `<br/>( ${desc})` : '';
  };

  // Extract data
  const portId = intf.portId || 'N/A';
  const portDesc = intf.portDescription || '';
  const ifName = intf.name;
  const ifDesc = intf.description || '';
  const ipAddr = intf.ipAddress || 'N/A';
  const svcType = intf.serviceType || 'Unknown Svc';
  const svcDesc = intf.serviceDescription || '';
  const ingressQos = intf.ingressQos || 'Default';
  const egressQos = intf.egressQos || 'Default';

  // Find peer IP and related routes
  const { peerIp, relatedRoutes } = findPeerAndRoutes(device, intf);

  // Build Left Node (Host) - matching Python exactly
  const leftLabel =
    `<div style='text-align: left'>` +
    `<b>Port:</b> ${portId}${fmtDesc(portDesc)}<br/><br/>` +
    `<b>Interface:</b> ${ifName}${fmtDesc(ifDesc)}<br/><br/>` +
    `<b>IP:</b> ${ipAddr}<br/><br/>` +
    `<b>Service:</b> ${svcType}${fmtDesc(svcDesc)}` +
    `</div>`;

  // Build Host Subgraph
  mermaid.push(`    subgraph Host ["${device.hostname}"]`);
  mermaid.push(`        A["${leftLabel}"]`);
  mermaid.push(`    end`);

  // Build Right Subgraph (Remote) - matching Python exactly
  const rightTitle = portDesc || 'Remote Connected Device';
  mermaid.push(`    subgraph Remote ["${rightTitle}"]`);
  mermaid.push(`        B["<b>Next-Hop</b><br/>${peerIp}"]`);

  // Customer Network node - matching Python exactly
  let cLabel: string;
  if (relatedRoutes.length > 0) {
    const routesStr = relatedRoutes.join('<br/>');
    cLabel = `<b>Customer Network</b><br/>${routesStr}`;
  } else {
    cLabel = '<b>Customer Network</b>';
  }

  mermaid.push(`        C["${cLabel}"]`);
  mermaid.push(`    end`);

  // Links - matching Python exactly
  const qosLabel = `In-QoS: ${ingressQos}<br/>Out-QoS: ${egressQos}`;
  mermaid.push(`    A -->|"${qosLabel}"| B`);
  mermaid.push(`    B -.-> C`);

  // Styles - matching Python exactly
  mermaid.push('    style A fill:#ffffff,stroke:#333,stroke-width:2px,color:#000,text-align:left');
  mermaid.push('    style B fill:#e6f3ff,stroke:#0066cc,stroke-width:2px,color:#000');
  mermaid.push('    style C fill:#ffffff,stroke:#333,stroke-width:2px,stroke-dasharray: 5 5,color:#000');

  return mermaid.join('\n');
}

// Helper: Find peer IP and related routes
function findPeerAndRoutes(device: NokiaDevice, intf: NokiaInterface): { peerIp: string; relatedRoutes: string[] } {
  let peerIp = 'Unknown';
  const relatedRoutes: string[] = [];

  if (!intf.ipAddress) {
    return { peerIp, relatedRoutes };
  }

  const network = parseNetwork(intf.ipAddress);
  if (!network) {
    return { peerIp, relatedRoutes };
  }

  // Find static routes with next-hop in this subnet
  const interfaceIp = intf.ipAddress as string;
  device.staticRoutes.forEach(route => {
    if (interfaceIp && isIpInSubnet(route.nextHop, interfaceIp)) {
      const nextHopIp = route.nextHop;
      if (nextHopIp !== network.ip) {
        peerIp = nextHopIp;
        relatedRoutes.push(route.prefix);
      }
    }
  });

  // If no peer found and /30 network, infer the other host
  if (peerIp === 'Unknown' && network.prefixLen === 30) {
    const hosts = getHostsInNetwork(network.ip, network.prefixLen);
    for (const h of hosts) {
      if (h !== network.ip) {
        peerIp = h;
        break;
      }
    }
  }

  return { peerIp, relatedRoutes };
}

// Helper: Parse network from IP/CIDR
function parseNetwork(ipWithCidr: string): { ip: string; prefixLen: number; networkAddr: number } | null {
  const parts = ipWithCidr.split('/');
  if (parts.length !== 2) return null;

  const ip = parts[0];
  const prefixLen = parseInt(parts[1], 10);

  if (isNaN(prefixLen)) return null;

  const ipLong = ipToLong(ip);
  if (ipLong === -1) return null;

  const mask = ~((1 << (32 - prefixLen)) - 1) >>> 0;
  const networkAddr = (ipLong & mask) >>> 0;

  return { ip, prefixLen, networkAddr };
}

// Helper: Get host IPs in a network
function getHostsInNetwork(ip: string, prefixLen: number): string[] {
  const networkData = parseNetwork(`${ip}/${prefixLen}`);
  if (!networkData) return [];

  // numHosts variable removed as it was unused
  const hosts: string[] = [];

  // For /30, there are 2 usable hosts (indices 1 and 2)
  if (prefixLen === 30) {
    hosts.push(longToIp(networkData.networkAddr + 1));
    hosts.push(longToIp(networkData.networkAddr + 2));
  }

  return hosts;
}

// Helper: Check if IP is in subnet
function isIpInSubnet(targetIp: string, interfaceIpWithCidr: string): boolean {
  if (!interfaceIpWithCidr || !targetIp) return false;

  try {
    const parts = interfaceIpWithCidr.split('/');
    if (parts.length !== 2) return false;

    const ip = parts[0];
    const cidr = parseInt(parts[1], 10);

    const ipLong = ipToLong(ip);
    const targetLong = ipToLong(targetIp);

    if (ipLong === -1 || targetLong === -1) return false;

    const mask = ~((1 << (32 - cidr)) - 1);

    return (ipLong & mask) === (targetLong & mask);
  } catch (e) {
    return false;
  }
}

function ipToLong(ip: string): number {
  const parts = ip.split('.');
  if (parts.length !== 4) return -1;
  return parts.reduce((acc, octet) => {
    const val = parseInt(octet, 10);
    return isNaN(val) ? -1 : (acc << 8) + val;
  }, 0) >>> 0;
}

function longToIp(num: number): string {
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255
  ].join('.');
}
