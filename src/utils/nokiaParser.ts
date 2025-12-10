import type { NokiaDevice, NokiaInterface, NokiaPort } from '../types';

export const parseNokiaConfig = (configText: string): NokiaDevice => {
    const lines = configText.split('\n');
    const device: NokiaDevice = {
        hostname: 'Unknown',
        ports: [],
        interfaces: [],
        staticRoutes: [],
    };

    let currentContext: string[] = [];
    let currentPort: NokiaPort | null = null;
    let currentInterface: NokiaInterface | null = null;
    let currentServiceId: string | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (!line || line.startsWith('#')) continue;

        if (line === 'exit') {
            if (currentContext.length > 0) {
                const exitedContext = currentContext.pop();

                if (exitedContext === 'port' && currentPort) {
                    device.ports.push(currentPort);
                    currentPort = null;
                } else if (exitedContext === 'interface' && currentInterface) {
                    if (currentServiceId) currentInterface.serviceId = currentServiceId;

                    if (!currentInterface.toDevice && currentInterface.description) {
                        const match = currentInterface.description.match(/To[-_](\w+)/i);
                        if (match) currentInterface.toDevice = match[1];
                    }
                    device.interfaces.push(currentInterface);
                    currentInterface = null;
                } else if (exitedContext?.startsWith('vprn')) {
                    currentServiceId = null;
                }
            }
            continue;
        }

        // Hostname parsing - check both context-based and direct line (robustness)
        if (line.startsWith('name "')) {
            // Often inside 'system' block
            const nameMatch = line.match(/name "([^"]+)"/);
            if (nameMatch) {
                // Verify we are likely in a system block or it is a top level system name
                // But strictly, 'name' command is specific.
                if (currentContext.includes('system') || currentContext.length === 0) {
                    device.hostname = nameMatch[1];
                }
            }
        }

        // Ports
        if (line.startsWith('port ')) {
            currentContext.push('port');
            const portId = line.split(' ')[1];
            currentPort = { id: portId };
            continue;
        }

        if (currentPort) {
            if (line.startsWith('description ')) {
                const descMatch = line.match(/description "([^"]+)"/);
                if (descMatch) currentPort.description = descMatch[1];
            }
            if (line.startsWith('mode ')) {
                currentPort.mode = line.split(' ')[1];
            }
        }

        // Static Routes (router context)
        // Format: static-route {prefix} next-hop {ip} ...
        if (line.startsWith('static-route ')) {
            // Usually under 'router Base' or vprn, but we can capture globally or check context
            // Simplification: Capture all static routes found
            const parts = line.split(' ');
            // parts[0] = static-route, parts[1] = prefix/entry
            if (parts.length >= 4) {
                const prefix = parts[1];
                let nextHop = '';

                // Find next-hop keyword
                const nhIndex = parts.indexOf('next-hop');
                if (nhIndex !== -1 && nhIndex + 1 < parts.length) {
                    nextHop = parts[nhIndex + 1];
                    device.staticRoutes.push({
                        prefix,
                        nextHop
                    });
                }
            }
            // static-route is typically a one-liner cmd, does not enter context usually
            // UNLESS it has options on next lines? Nokia SR OS static-route is strictly hierarchical?
            // "static-route 0.0.0.0/0 next-hop 1.1.1.1" -> Single line
            // "static-route 1.2.3.4/32" -> enter context?
            // Usually single line. We assume single line for now as per common configs.
            continue;
        }

        if (line.startsWith('interface ')) {
            const parentContext = currentContext[currentContext.length - 1];

            // Fix: Use blocklist instead of allowlist to support snippets (undefined parent)
            // while still preventing duplicates from protocol references.
            const isProtocolContext = parentContext === 'protocol' || parentContext === 'area';

            if (!isProtocolContext) {
                currentContext.push('interface');
                const nameMatch = line.match(/interface "([^"]+)"/);
                currentInterface = { name: nameMatch ? nameMatch[1] : 'unknown' };
            } else {
                currentContext.push('ignored_interface');
            }
            continue;
        }

        // ... (rest of context pushing: router, vprn, system, configure, protocols)
        if (line.startsWith('router ')) { currentContext.push('router'); continue; }
        if (line.startsWith('vprn ')) {
            currentContext.push('vprn');
            const parts = line.split(' ');
            if (parts.length > 1) currentServiceId = parts[1];
            continue;
        }
        if (line === 'system') { currentContext.push('system'); continue; }
        if (line === 'configure') { currentContext.push('configure'); continue; }

        const protocolList = ['ospf', 'isis', 'mpls', 'rsvp', 'ldp', 'bgp'];
        const isProtocolLine = protocolList.some(proto => line === proto || line.startsWith(proto + ' '));
        if (isProtocolLine) { currentContext.push('protocol'); continue; }

        if (line.startsWith('area ')) { currentContext.push('area'); continue; }

        if (currentInterface) {
            if (line.startsWith('address ')) {
                const addrParts = line.split(' ');
                if (addrParts.length > 1) currentInterface.ipAddress = addrParts[1];
            }
            if (line.startsWith('port ')) {
                currentInterface.portId = line.split(' ')[1];
            }
            if (line.startsWith('description ')) {
                const descMatch = line.match(/description "([^"]+)"/);
                if (descMatch) currentInterface.description = descMatch[1];
            }
            if (line.startsWith('qos ')) {
                currentInterface.qos = line.split(' ')[1];
            }
        }
    }

    // Post-processing: Deduplicate interfaces by name
    const uniqueInterfaces = new Map<string, NokiaInterface>();

    device.interfaces.forEach(intf => {
        if (uniqueInterfaces.has(intf.name)) {
            const existing = uniqueInterfaces.get(intf.name)!;
            // Merge attributes, preferring existing if already set, or new if not
            // Actually, we usually want the most "complete" one. 
            // If we encounter a second definition, it might be additional info or an empty reference.
            // Let's merge non-empty values.
            existing.ipAddress = existing.ipAddress || intf.ipAddress;
            existing.portId = existing.portId || intf.portId;
            existing.description = existing.description || intf.description;
            existing.qos = existing.qos || intf.qos;
            existing.serviceId = existing.serviceId || intf.serviceId;
            existing.toDevice = existing.toDevice || intf.toDevice;
        } else {
            uniqueInterfaces.set(intf.name, intf);
        }
    });

    device.interfaces = Array.from(uniqueInterfaces.values());

    // Post-processing: Link interfaces to ports to get "toDevice" from port description if missing on interface
    device.interfaces.forEach(intf => {
        if (!intf.toDevice && intf.portId) {
            const port = device.ports.find(p => p.id === intf.portId);
            if (port && port.description) {
                const match = port.description.match(/To[-_](\w+)/i);
                if (match) intf.toDevice = match[1];
            }
        }
    });

    return device;
};
