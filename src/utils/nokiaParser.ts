import type { NokiaDevice, NokiaInterface, NokiaPort } from '../types';

// Helper: Clean descriptions
function cleanDesc(text: string | undefined): string {
  if (!text) return '';
  return text.replace(/&/g, ' and ').replace(/"/g, "'").replace(/</g, '&lt;').replace(/>/g, '&gt;').trim();
}

// Helper: Parse QoS from SAP block
function parseNokiaQos(sapBlock: string): { ingressQos: string; egressQos: string } {
  let ingressQos = 'Default';
  let egressQos = 'Default';

  const ingressMatch = sapBlock.match(/ingress([\s\S]*?)exit/);
  if (ingressMatch) {
    const qosMatch = ingressMatch[1].match(/qos\s+(\d+)/);
    if (qosMatch) ingressQos = qosMatch[1];
  }

  const egressMatch = sapBlock.match(/egress([\s\S]*?)exit/);
  if (egressMatch) {
    const qosMatch = egressMatch[1].match(/qos\s+(\d+)/);
    if (qosMatch) egressQos = qosMatch[1];
  }

  return { ingressQos, egressQos };
}

// Helper: Extract interface block by indentation (like Python)
function getInterfaceBlockByIndent(lines: string[], targetInterface: string): string | null {
  const targetStart1 = `interface "${targetInterface}"`;
  const targetStart2 = `interface ${targetInterface} `;

  const candidates: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.includes(targetStart1) || line.includes(targetStart2)) {
      const startIndent = line.length - line.trimLeft().length;
      const blockLines: string[] = [line];

      i++;
      while (i < lines.length) {
        const nextLine = lines[i];
        if (!nextLine.trim() || nextLine.trim().startsWith('#')) {
          blockLines.push(nextLine);
          i++;
          continue;
        }

        const nextIndent = nextLine.length - nextLine.trimLeft().length;
        if (nextLine.trim() === 'exit' && nextIndent === startIndent) {
          blockLines.push(nextLine);
          break;
        }
        if (nextIndent < startIndent && nextLine.trim() !== 'exit') break;

        blockLines.push(nextLine);
        i++;
      }
      candidates.push(blockLines.join('\n'));
    }
    i++;
  }

  // Prefer block with address
  for (const block of candidates) {
    if (block.includes('address ')) return block;
  }
  return candidates.length > 0 ? candidates[candidates.length - 1] : null;
}

// Helper: Get service info by walking backward
function getServiceInfo(lines: string[], targetInterface: string): { serviceType: string; serviceDescription: string } {
  const targetStr1 = `interface "${targetInterface}"`;
  const targetStr2 = `interface ${targetInterface} `;

  let targetIdx = -1;
  for (let idx = 0; idx < lines.length; idx++) {
    if (lines[idx].includes(targetStr1) || lines[idx].includes(targetStr2)) {
      // Check if this has address in next 20 lines
      const hasAddress = lines.slice(idx, idx + 20).some(l => l.includes('address '));
      if (hasAddress) {
        targetIdx = idx;
        break;
      }
    }
  }

  if (targetIdx === -1) {
    for (let idx = 0; idx < lines.length; idx++) {
      if (lines[idx].includes(targetStr1) || lines[idx].includes(targetStr2)) {
        targetIdx = idx;
        break;
      }
    }
  }

  if (targetIdx === -1) return { serviceType: 'Unknown Svc', serviceDescription: '' };

  const ifIndent = lines[targetIdx].length - lines[targetIdx].trimLeft().length;

  // Walk backward to find service
  for (let i = targetIdx; i >= 0; i--) {
    const line = lines[i];
    const currentIndent = line.length - line.trimLeft().length;

    if (currentIndent < ifIndent) {
      const match = line.trim().match(/^(ies|vpls|vprn|epipe)\s+(\d+)/i);
      if (match) {
        const serviceType = `${match[1].toUpperCase()} ${match[2]}`;

        // Look for description in next lines
        let serviceDescription = '';
        for (let j = i + 1; j < Math.min(i + 30, lines.length); j++) {
          const subLine = lines[j];
          const subIndent = subLine.length - subLine.trimLeft().length;
          if (subIndent <= currentIndent) break;

          const descMatch = subLine.match(/description\s+"?([^"\n]+)"?/);
          if (descMatch) {
            serviceDescription = descMatch[1];
            break;
          }
        }

        return { serviceType, serviceDescription: cleanDesc(serviceDescription) };
      }
    }
  }

  return { serviceType: 'Unknown Svc', serviceDescription: '' };
}

// Helper: Get port description
function getPortDescription(configContent: string, ifBlock: string): { portId: string; portDescription: string } {
  const sapMatch = ifBlock.match(/sap\s+([0-9/]+)/);
  if (!sapMatch) return { portId: 'N/A', portDescription: '' };

  const portId = sapMatch[1];
  const portPattern = new RegExp(`^\\s*port ${portId.replace(/\//g, '\\/')}([\\s\\S]*?)^\\s*exit`, 'm');
  const portMatch = configContent.match(portPattern);

  let portDescription = '';
  if (portMatch) {
    const descMatch = portMatch[1].match(/description\s+"?([^"\n]+)"?/);
    if (descMatch) portDescription = cleanDesc(descMatch[1]);
  }

  return { portId, portDescription };
}

export const parseNokiaConfig = (configText: string): NokiaDevice => {
  const lines = configText.split('\n');
  const device: NokiaDevice = {
    hostname: 'Unknown',
    ports: [],
    interfaces: [],
    staticRoutes: [],
  };

  // Extract hostname
  const hostnameMatch = configText.match(/system[\s\S]*?name\s+"?([^"\n]+)"?/);
  if (hostnameMatch) device.hostname = hostnameMatch[1];

  // Extract all interfaces from router Base section
  const interfacePattern = /interface\s+"([^"]+)"\s+create/g;
  const interfaceMatches = [...configText.matchAll(interfacePattern)];

  for (const match of interfaceMatches) {
    const interfaceName = match[1];
    const ifBlock = getInterfaceBlockByIndent(lines, interfaceName);
    if (!ifBlock) continue;

    const intf: NokiaInterface = { name: interfaceName };

    // Extract IP address
    const ipMatch = ifBlock.match(/address\s+([\d.]+\/\d+)/);
    if (ipMatch) intf.ipAddress = ipMatch[1];

    // Extract description
    const descMatch = ifBlock.match(/description\s+"?([^"\n]+)"?/);
    if (descMatch) intf.description = cleanDesc(descMatch[1]);

    // Extract port ID and description
    const { portId, portDescription } = getPortDescription(configText, ifBlock);
    if (portId !== 'N/A') {
      intf.portId = portId;
      intf.portDescription = portDescription;
    }

    // Extract service info
    const { serviceType, serviceDescription } = getServiceInfo(lines, interfaceName);
    intf.serviceType = serviceType;
    if (serviceDescription) intf.serviceDescription = serviceDescription;

    // Extract QoS from SAP block
    const sapBlockMatch = ifBlock.match(/sap\s+[\s\S]*?create([\s\S]*?)(?=\n\s{12}exit|\n\s{8}exit)/);
    if (sapBlockMatch) {
      const qosData = parseNokiaQos(sapBlockMatch[1]);
      intf.ingressQos = qosData.ingressQos;
      intf.egressQos = qosData.egressQos;
    }

    // Extract toDevice from description
    if (intf.description) {
      const toDeviceMatch = intf.description.match(/To[-_](\w+)/i);
      if (toDeviceMatch) intf.toDevice = toDeviceMatch[1];
    }

    device.interfaces.push(intf);
  }

  // Deduplicate interfaces by name (prefer blocks with more complete data)
  const uniqueInterfaces = new Map<string, NokiaInterface>();
  device.interfaces.forEach(intf => {
    if (uniqueInterfaces.has(intf.name)) {
      const existing = uniqueInterfaces.get(intf.name)!;
      // Merge: prefer non-empty values
      existing.ipAddress = existing.ipAddress || intf.ipAddress;
      existing.portId = existing.portId || intf.portId;
      existing.description = existing.description || intf.description;
      existing.serviceType = existing.serviceType || intf.serviceType;
      existing.serviceDescription = existing.serviceDescription || intf.serviceDescription;
      existing.ingressQos = existing.ingressQos || intf.ingressQos;
      existing.egressQos = existing.egressQos || intf.egressQos;
      existing.portDescription = existing.portDescription || intf.portDescription;
      existing.toDevice = existing.toDevice || intf.toDevice;
    } else {
      uniqueInterfaces.set(intf.name, intf);
    }
  });

  device.interfaces = Array.from(uniqueInterfaces.values());

  // Extract static routes
  const routePattern = /static-route\s+([\d./]+)\s+next-hop\s+([\d.]+)/g;
  const routeMatches = [...configText.matchAll(routePattern)];
  for (const match of routeMatches) {
    device.staticRoutes.push({
      prefix: match[1],
      nextHop: match[2]
    });
  }

  // Extract ports for reference
  const portPattern = /port\s+([\d/]+)[\s\S]*?(?:description\s+"?([^"\n]+)"?)?/g;
  const portMatches = [...configText.matchAll(portPattern)];
  for (const match of portMatches) {
    device.ports.push({
      id: match[1],
      description: match[2] ? cleanDesc(match[2]) : undefined
    });
  }

  return device;
};
