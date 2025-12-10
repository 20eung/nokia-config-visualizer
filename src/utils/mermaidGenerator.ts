import type { NokiaDevice, NokiaInterface } from '../types';

export const generateMermaidDiagram = (device: NokiaDevice, selectedInterfaces: string[]): string => {
    let mermaidCode = 'graph TD\n';
    mermaidCode += `  Device["${device.hostname}<br/>(This Device)"]\n`;
    mermaidCode += '  classDef default fill:#fff,stroke:#333,stroke-width:2px;\n';
    mermaidCode += '  classDef device fill:#4285f4,stroke:#333,stroke-width:2px,color:white;\n';
    mermaidCode += '  classDef neighbor fill:#34a853,stroke:#333,stroke-width:2px,color:white;\n';
    mermaidCode += '  class Device device;\n';

    const relevantInterfaces = device.interfaces.filter((i) => selectedInterfaces.includes(i.name));

    relevantInterfaces.forEach((intf, index) => {
        const safeId = `Node_${index}`;
        const neighborName = intf.toDevice || 'Unknown_Neighbor';

        // Label Construction
        // Request: Port Info ABOVE Interface Info
        let label = '';

        // 1. Port
        if (intf.portId) label += `Port: ${intf.portId}<br/>`;

        // 2. Interface Name
        label += `Interface: ${intf.name}`;

        // 3. IP Addresses
        if (intf.ipAddress) {
            label += `<br/>IP: ${intf.ipAddress}`;
        }

        // 4. QoS
        if (intf.qos) label += `<br/>QoS: ${intf.qos}`;

        // 5. Service ID
        if (intf.serviceId) label += `<br/>Svc: ${intf.serviceId}`;

        // 6. Static Routes (NextHop reachable via this interface)
        if (intf.ipAddress && device.staticRoutes && device.staticRoutes.length > 0) {
            const associatedRoutes = device.staticRoutes.filter(route => {
                return isIpInSubnet(route.nextHop, intf.ipAddress!);
            });

            if (associatedRoutes.length > 0) {
                label += '<br/>Static Routes:';
                associatedRoutes.forEach(r => label += `<br/>- Dst: ${r.prefix} (NH: ${r.nextHop})`);
            }
        }

        mermaidCode += `  ${safeId}["${neighborName}"]\n`;
        mermaidCode += `  class ${safeId} neighbor;\n`;
        mermaidCode += `  Device -- "${label}" --> ${safeId}\n`;
    });

    return mermaidCode;
};

// Helper to check if IP is in subnet
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
