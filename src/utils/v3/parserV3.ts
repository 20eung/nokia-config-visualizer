import type {
    NokiaService,
    EpipeService,
    VPLSService,
    VPRNService,
    L3Interface,
    StaticRoute,
    SAP,
    SDP,
    SpokeSDP,
    MeshSDP,
    QosPolicy,
    AdminState,
    DeliveryType,
} from '../../types/v2';

// Force IES Type Definition for v3 (Temporary until types/v2 is updated or v3 types created)
export interface IESService extends Omit<VPRNService, 'serviceType'> {
    serviceType: 'ies';
}

// Extend NokiaService union locally for v3
export type NokiaServiceV3 = EpipeService | VPLSService | VPRNService | IESService;

export interface ParsedConfigV3 {
    hostname: string;
    systemIp: string;
    services: NokiaServiceV3[];
    sdps: SDP[];
    connections: any[];
}

/**
 * 설정 파일에서 특정 섹션 추출
 */
/**
 * 설정 파일에서 특정 섹션 추출 (Indentation 기반)
 */
export function extractSection(configText: string, sectionName: string): string {
    const lines = configText.split('\n');
    let sectionLines: string[] = [];
    let inSection = false;
    let sectionIndent = -1;

    // Regex to find start of section (e.g., "    service")
    // Note: We need to match the exact line logic or just partial
    const sectionStartRegex = new RegExp(`^(\\s*)${sectionName}\\s*$`, 'i');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip comments/echo
        if (line.trim().startsWith('#') || line.trim().startsWith('echo')) {
            if (inSection) sectionLines.push(line);
            continue;
        }

        if (!inSection) {
            const match = line.match(sectionStartRegex);
            if (match) {
                inSection = true;
                sectionIndent = match[1].length;
                sectionLines.push(line);
            }
        } else {
            // We are in section
            if (!line.trim()) {
                sectionLines.push(line);
                continue;
            }

            const currentIndent = line.length - line.trimStart().length;

            // If we find an 'exit' at the same indentation as the section start, we are done
            if (line.trim() === 'exit' && currentIndent === sectionIndent) {
                sectionLines.push(line);
                break;
            }

            // If indentation is less than section start (and not matched above), likely we exited implicitly (rare in Nokia)
            // But we'll assume Nokia config is well formed with 'exit'.
            // Safety check: if indentation became LESS than sectionIndent, we clearly left the block.
            if (currentIndent < sectionIndent) {
                break;
            }

            sectionLines.push(line);
        }
    }

    return sectionLines.join('\n');
}

/**
 * 호스트명 추출
 */
export function extractHostname(configText: string): string {
    const match = configText.match(/^\s*name\s+"([^"]+)"/im);
    return match ? match[1] : 'Unknown';
}

/**
 * 시스템 IP 추출
 */
export function extractSystemIp(configText: string): string {
    const match = configText.match(/interface\s+"system"[\s\S]*?address\s+([\d.]+)/i);
    return match ? match[1] : '';
}

/**
 * QoS 정책 파싱
 */
function parseQosPolicy(content: string, direction: 'ingress' | 'egress'): QosPolicy | undefined {
    const regex = new RegExp(`${direction}\\s+qos\\s+(\\d+)`, 'i');
    const match = content.match(regex);

    if (match) {
        const policyId = parseInt(match[1]);
        return {
            policyId,
            policyName: `qos-${policyId}`,
        };
    }

    return undefined;
}

/**
 * SAP 파싱
 */
export function parseSAPs(serviceContent: string): SAP[] {
    const saps: SAP[] = [];

    // SAP 블록 추출: sap <id> create ... exit
    // Fix: Support SAP ID without colon (e.g., "1/1/2")
    const sapRegex = /sap\s+([\w\/-]+(?::\d+)?)\s+create([\s\S]*?)(?=\s+(?:sap|spoke-sdp|mesh-sdp|exit\s*$))/gi;
    const matches = serviceContent.matchAll(sapRegex);

    for (const match of matches) {
        const [, sapId, content] = match;

        // SAP ID 파싱 (예: "1/1/1:100" → port: "1/1/1", vlan: 100)
        // If no colon, vlan is 0 or undefined.
        const parts = sapId.split(':');
        const portId = parts[0];
        const vlanId = parts.length > 1 ? parseInt(parts[1]) : 0;

        // Description 추출
        const descMatch = content.match(/description\s+"([^"]+)"/i);
        const description = descMatch ? descMatch[1] : '';

        // QoS 정책 추출
        const ingressQos = parseQosPolicy(content, 'ingress');
        const egressQos = parseQosPolicy(content, 'egress');

        // Admin state (기본값: up)
        const adminState: AdminState = content.includes('shutdown') ? 'down' : 'up';

        saps.push({
            sapId,
            portId,
            vlanId,
            description,
            adminState,
            ingressQos,
            egressQos,
        });
    }

    return saps;
}

/**
 * Spoke SDP 파싱
 */
export function parseSpokeSDP(serviceContent: string): SpokeSDP[] {
    const spokeSdps: SpokeSDP[] = [];

    // spoke-sdp <sdpId>:<vcId> create ... exit
    const regex = /spoke-sdp\s+(\d+):(\d+)\s+create([\s\S]*?)(?=\s+(?:sap|spoke-sdp|mesh-sdp|exit\s*$))/gi;
    const matches = serviceContent.matchAll(regex);

    for (const match of matches) {
        const [, sdpIdStr, vcIdStr, content] = match;

        const descMatch = content.match(/description\s+"([^"]+)"/i);
        const description = descMatch ? descMatch[1] : '';

        spokeSdps.push({
            sdpId: parseInt(sdpIdStr),
            vcId: parseInt(vcIdStr),
            description,
        });
    }

    return spokeSdps;
}

/**
 * Mesh SDP 파싱
 */
export function parseMeshSDP(serviceContent: string): MeshSDP[] {
    const meshSdps: MeshSDP[] = [];

    // mesh-sdp <sdpId>:<vcId> create ... exit
    const regex = /mesh-sdp\s+(\d+):(\d+)\s+create([\s\S]*?)(?=\s+(?:sap|spoke-sdp|mesh-sdp|exit\s*$))/gi;
    const matches = serviceContent.matchAll(regex);

    for (const match of matches) {
        const [, sdpIdStr, vcIdStr, content] = match;

        const descMatch = content.match(/description\s+"([^"]+)"/i);
        const description = descMatch ? descMatch[1] : '';

        meshSdps.push({
            sdpId: parseInt(sdpIdStr),
            vcId: parseInt(vcIdStr),
            description,
        });
    }

    return meshSdps;
}

/**
 * Epipe 서비스 파싱
 */
export function parseEpipe(
    serviceId: number,
    customerId: number,
    content: string,
    serviceName?: string
): EpipeService {
    // Description 추출
    const descMatch = content.match(/description\s+"([^"]+)"/i);
    const description = descMatch ? descMatch[1] : '';

    // Service Name 추출 (Explicit command inside block: service-name "...")
    const nameMatch = content.match(/service-name\s+"([^"]+)"/i);
    // If passed via arg (rarely used now) or found in content
    const finalServiceName = nameMatch ? nameMatch[1] : serviceName;

    // Service MTU 추출
    const mtuMatch = content.match(/service-mtu\s+(\d+)/i);
    const serviceMtu = mtuMatch ? parseInt(mtuMatch[1]) : undefined;

    // Admin state
    const adminState: AdminState = content.includes('shutdown') && !content.includes('no shutdown') ? 'down' : 'up';

    // SAP 파싱
    const saps = parseSAPs(content);

    // Spoke SDP 파싱
    const spokeSdps = parseSpokeSDP(content);

    // Using finalServiceName variable to assign to serviceName property
    // (In TypeScript, we need to ensure the variable name matches or use assignment)

    return {
        serviceType: 'epipe',
        serviceId,
        serviceName: finalServiceName,
        customerId,
        description,
        adminState,
        serviceMtu,
        saps,
        spokeSdps: spokeSdps.length > 0 ? spokeSdps : undefined,
    };
}

/**
 * VPLS 서비스 파싱
 */
export function parseVPLS(
    serviceId: number,
    customerId: number,
    content: string,
    serviceName?: string
): VPLSService {
    // Description 추출
    const descMatch = content.match(/description\s+"([^"]+)"/i);
    const description = descMatch ? descMatch[1] : '';

    // Service Name 추출
    const nameMatch = content.match(/service-name\s+"([^"]+)"/i);
    const finalServiceName = nameMatch ? nameMatch[1] : serviceName;

    // Service MTU 추출
    const mtuMatch = content.match(/service-mtu\s+(\d+)/i);
    const serviceMtu = mtuMatch ? parseInt(mtuMatch[1]) : undefined;

    // FDB table size 추출
    const fdbMatch = content.match(/fdb-table-size\s+(\d+)/i);
    const fdbSize = fdbMatch ? parseInt(fdbMatch[1]) : undefined;

    // Admin state
    const adminState: AdminState = content.includes('shutdown') && !content.includes('no shutdown') ? 'down' : 'up';

    // SAP 파싱
    const saps = parseSAPs(content);

    // Spoke SDP 파싱
    const spokeSdps = parseSpokeSDP(content);

    // Mesh SDP 파싱
    const meshSdps = parseMeshSDP(content);

    return {
        serviceType: 'vpls',
        serviceId,
        serviceName: finalServiceName,
        customerId,
        description,
        adminState,
        serviceMtu,
        fdbSize,
        saps,
        spokeSdps: spokeSdps.length > 0 ? spokeSdps : undefined,
        meshSdps: meshSdps.length > 0 ? meshSdps : undefined,
    };
}

/**
 * VPRN 서비스 파싱
 */
export function parseVPRN(
    serviceId: number,
    customerId: number,
    content: string,
    serviceName?: string
): VPRNService {
    // Description 추출
    const descMatch = content.match(/description\s+"([^"]+)"/i);
    const description = descMatch ? descMatch[1] : '';

    // Service Name 추출
    const nameMatch = content.match(/service-name\s+"([^"]+)"/i);
    const finalServiceName = nameMatch ? nameMatch[1] : serviceName;

    // AS & RD 추출
    const asMatch = content.match(/autonomous-system\s+(\d+)/i);
    const rdMatch = content.match(/route-distinguisher\s+([\d:.]+)/i);
    const vrfMatch = content.match(/vrf-target\s+(?:target:)?([\d:.]+)/i) || content.match(/vrf-target\s+([^\s]+)/i);

    // Admin state
    const adminState: AdminState = content.includes('shutdown') && !content.includes('no shutdown') ? 'down' : 'up';

    // Interface 파싱
    const interfaces: L3Interface[] = [];
    const interfaceRegex = /interface\s+"([^"]+)"\s+create([\s\S]*?)(?=\s+(?:interface|bgp|ospf|static-route-entry|exit\s*$))/gi;
    const ifMatches = content.matchAll(interfaceRegex);

    for (const match of ifMatches) {
        const [, ifName, ifContent] = match;

        const ipMatch = ifContent.match(/address\s+([\d.\/]+)/i);
        const portMatch = ifContent.match(/sap\s+([\w\/-]+:\d+)/i) || ifContent.match(/port\s+([\w\/-]+)/i);
        const descMatch = ifContent.match(/description\s+"([^"]+)"/i);
        const mtuMatch = ifContent.match(/mtu\s+(\d+)/i);
        const vplsMatch = ifContent.match(/vpls\s+"([^"]+)"/i); // Routed VPLS binding
        const spokeSdpMatch = ifContent.match(/spoke-sdp\s+(\d+:\d+)/i);

        const vrrpMatch = ifContent.match(/vrrp\s+(\d+)/i);
        const vrrpBackupMatch = ifContent.match(/backup\s+([\d.]+)/i);
        const vrrpPriorityMatch = ifContent.match(/priority\s+(\d+)/i);

        interfaces.push({
            interfaceName: ifName,
            description: descMatch ? descMatch[1] : undefined,
            ipAddress: ipMatch ? ipMatch[1] : undefined,
            portId: portMatch ? portMatch[1] : undefined,
            mtu: mtuMatch ? parseInt(mtuMatch[1]) : undefined,
            vplsName: vplsMatch ? vplsMatch[1] : undefined,
            spokeSdpId: spokeSdpMatch ? spokeSdpMatch[1] : undefined,
            vrrpGroupId: vrrpMatch ? parseInt(vrrpMatch[1]) : undefined,
            vrrpBackupIp: vrrpBackupMatch ? vrrpBackupMatch[1] : undefined,
            vrrpPriority: vrrpPriorityMatch ? parseInt(vrrpPriorityMatch[1]) : undefined,
            adminState: ifContent.includes('shutdown') && !ifContent.includes('no shutdown') ? 'down' : 'up'
        });
    }

    // BGP Neighbor 파싱 (Enhanced)
    const bgpNeighbors: { neighborIp: string; autonomousSystem?: number }[] = [];
    let bgpRouterId: string | undefined;

    const bgpMatch = content.match(/bgp([\s\S]*?)exit/i); // First exit usually closes bgp
    if (bgpMatch) {
        const bgpContent = bgpMatch[1];

        // Router ID
        const routerIdMatch = bgpContent.match(/router-id\s+([\d.]+)/i);
        if (routerIdMatch) bgpRouterId = routerIdMatch[1];

        // Neighbors
        const neighborBlockRegex = /neighbor\s+([\d.]+)([\s\S]*?)exit/g;
        for (const nm of bgpContent.matchAll(neighborBlockRegex)) {
            const nip = nm[1];
            const nbody = nm[2];
            const asMatch = nbody.match(/peer-as\s+(\d+)/i);
            bgpNeighbors.push({
                neighborIp: nip,
                autonomousSystem: asMatch ? parseInt(asMatch[1]) : undefined
            });
        }
    }

    // Static Route 파싱 (Enhanced)
    const staticRoutes: StaticRoute[] = [];

    // 1. One-line format: static-route <prefix> next-hop <ip>
    const oneLineRegex = /static-route\s+([\d.\/]+)\s+next-hop\s+([\d.]+)/g;
    for (const m of content.matchAll(oneLineRegex)) {
        staticRoutes.push({ prefix: m[1], nextHop: m[2] });
    }

    // 2. Block format: static-route-entry <prefix> ... next-hop <ip> ... exit
    // Iterate lines to handle nested 'next-hop ... exit' blocks correctly
    const lines = content.split('\n');
    let currentPrefix: string | null = null;
    let entryIndent = -1;

    for (const line of lines) {
        // static-route-entry start
        const entryMatch = line.match(/static-route-entry\s+([\d.\/]+)/);
        if (entryMatch) {
            currentPrefix = entryMatch[1];
            entryIndent = line.search(/\S/); // Count leading spaces
            continue;
        }

        if (currentPrefix) {
            // Check if block ended (exit at same indent)
            const trimLine = line.trim();
            const currentIndent = line.search(/\S/);

            // Note: Sometimes indentation might vary or empty lines.
            // If we see 'exit' at exact indent, we close.
            if (trimLine === 'exit' && currentIndent === entryIndent) {
                currentPrefix = null;
                continue;
            }

            // Look for next-hop
            const nhMatch = trimLine.match(/next-hop\s+([\d.]+)/);
            if (nhMatch) {
                staticRoutes.push({ prefix: currentPrefix, nextHop: nhMatch[1] });
            }
        }
    }

    return {
        serviceType: 'vprn',
        serviceId,
        serviceName: finalServiceName,
        customerId,
        description,
        adminState,
        autonomousSystem: asMatch ? parseInt(asMatch[1]) : undefined,
        bgpRouterId,
        routeDistinguisher: rdMatch ? rdMatch[1] : undefined,
        vrfTarget: vrfMatch ? vrfMatch[1] : undefined,
        interfaces,
        bgpNeighbors,
        staticRoutes
    };
}

/**
 * L2/L3 VPN 서비스 파싱
 */
export function parseL2VPNServices(configText: string): NokiaServiceV3[] {
    const services: NokiaService[] = [];
    const serviceSection = extractSection(configText, 'service');

    if (!serviceSection) return services;

    const lines = serviceSection.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Identify service start
        // 7750 SR: epipe 1026 name "..." customer 1 create
        // 7210 SAS: epipe 1543 customer 1 svc-sap-type any create
        const match = trimmed.match(/^(epipe|vpls|vprn)\s+(\d+)(?:\s+name\s+"([^"]+)")?\s+customer\s+(\d+).*\s+create/i);
        if (match) {
            const type = match[1].toLowerCase();
            const serviceId = parseInt(match[2]);
            const name = match[3] || ''; // Might be undefined
            const customerId = parseInt(match[4]);

            // Extract block by indentation
            const startIndent = line.length - line.trimStart().length;
            const blockLines: string[] = [line];

            let j = i + 1;
            while (j < lines.length) {
                const innerLine = lines[j];
                const innerTrimmed = innerLine.trim();

                // Allow empty lines inside block
                if (!innerTrimmed) {
                    blockLines.push(innerLine);
                    j++;
                    continue;
                }

                const innerIndent = innerLine.length - innerLine.trimStart().length;

                // End of block: 'exit' at same indentation
                if (innerTrimmed === 'exit' && innerIndent === startIndent) {
                    blockLines.push(innerLine); // Include exit
                    j++; // Consume exit
                    break;
                }

                // Safety: if indentation drops below start, we lost the block
                // This handles cases where exit might be missing (rare) or malformed
                if (innerIndent < startIndent) {
                    // Do NOT consume this line, it belongs to outer block
                    break;
                }

                blockLines.push(innerLine);
                j++;
            }

            // Advance main loop (j points to next line to process)
            i = j - 1;

            const fullBlock = blockLines.join('\n');
            const content = fullBlock; // Use full block as content

            // Note: Parser functions below might extract Description again from content. 
            // We pass 'name' logic if needed, but currently parseEpipe etc don't take it.
            // We'll rely on parseEpipe extracting description from the body.

            if (type === 'epipe') {
                const newService = parseEpipe(serviceId, customerId, content, name);
                const existingIndex = services.findIndex(s => s.serviceId === serviceId && s.serviceType === 'epipe');
                if (existingIndex !== -1) {
                    // Merge
                    const existing = services[existingIndex] as EpipeService;
                    services[existingIndex] = {
                        ...existing,
                        ...newService,
                        serviceName: existing.serviceName || newService.serviceName, // Prefer existing unless empty
                        saps: [...existing.saps, ...newService.saps], // Simple concat for SAPs (could be smarter)
                        spokeSdps: [...(existing.spokeSdps || []), ...(newService.spokeSdps || [])],
                        description: existing.description || newService.description // Prefer existing unless empty
                    };
                } else {
                    services.push(newService);
                }
            } else if (type === 'vpls') {
                const newService = parseVPLS(serviceId, customerId, content, name);
                const existingIndex = services.findIndex(s => s.serviceId === serviceId && s.serviceType === 'vpls');
                if (existingIndex !== -1) {
                    const existing = services[existingIndex] as VPLSService;
                    services[existingIndex] = {
                        ...existing,
                        ...newService,
                        serviceName: existing.serviceName || newService.serviceName,
                        saps: [...existing.saps, ...newService.saps],
                        meshSdps: [...(existing.meshSdps || []), ...(newService.meshSdps || [])],
                        spokeSdps: [...(existing.spokeSdps || []), ...(newService.spokeSdps || [])],
                        description: existing.description || newService.description
                    };
                } else {
                    services.push(newService);
                }
            } else if (type === 'vprn') {
                const newService = parseVPRN(serviceId, customerId, content, name);
                const existingIndex = services.findIndex(s => s.serviceId === serviceId && s.serviceType === 'vprn');
                if (existingIndex !== -1) {
                    const existing = services[existingIndex] as VPRNService;
                    // Merge interfaces by name
                    const mergedInterfaces = [...existing.interfaces];
                    newService.interfaces.forEach(newIf => {
                        const idx = mergedInterfaces.findIndex(iface => iface.interfaceName === newIf.interfaceName);
                        if (idx !== -1) {
                            // Merge interface details (prefer non-empty)
                            mergedInterfaces[idx] = {
                                ...mergedInterfaces[idx],
                                ...newIf,
                                ipAddress: mergedInterfaces[idx].ipAddress || newIf.ipAddress,
                                portId: mergedInterfaces[idx].portId || newIf.portId,
                                vrrpGroupId: mergedInterfaces[idx].vrrpGroupId || newIf.vrrpGroupId
                            };
                        } else {
                            mergedInterfaces.push(newIf);
                        }
                    });

                    services[existingIndex] = {
                        ...existing,
                        ...newService,
                        serviceName: existing.serviceName || newService.serviceName,
                        description: existing.description || newService.description,
                        autonomousSystem: existing.autonomousSystem || newService.autonomousSystem,
                        routeDistinguisher: existing.routeDistinguisher || newService.routeDistinguisher,
                        interfaces: mergedInterfaces,
                        bgpNeighbors: [...new Set([...existing.bgpNeighbors, ...newService.bgpNeighbors])],
                        staticRoutes: [...new Set([...existing.staticRoutes, ...newService.staticRoutes])]
                    };
                } else {
                    services.push(newService);
                }
            }
        }
    }

    return services as NokiaServiceV3[];
}

/**
 * Port Description 추출 (Global)
 */
export function extractPortDescriptions(configText: string): Map<string, string> {
    const portMap = new Map<string, string>();
    // const portSection = extractSection(configText, 'port'); // Not used, removed to fix build error

    // Config often has top-level "port 1/1/1"
    // or inside a card/mda context? No, usually top level or just "port X".
    // Let's iterate lines or regex.
    // Regex: port <id> ... description "..." ... exit

    // We can use a simpler approach: finding "port <id>" blocks and looking for description inside.
    // Or scan specific lines:
    // port 1/1/1
    //     description "..."

    const lines = configText.split('\n');
    let currentPort = '';

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('port ')) {
            const match = trimmed.match(/^port\s+([\w\/-]+)/);
            if (match) {
                currentPort = match[1];
            }
        } else if (trimmed === 'exit') {
            currentPort = ''; // Simple validation, though nested exits might exist, port blocks are usually flat in this view
        } else if (currentPort && trimmed.startsWith('description ')) {
            const descMatch = trimmed.match(/^description\s+"([^"]+)"/);
            if (descMatch) {
                portMap.set(currentPort, descMatch[1]);
            }
        }
    }

    return portMap;
}

/**
 * SDP 파싱
 */
export function parseSDPs(configText: string): SDP[] {
    const sdps: SDP[] = [];

    const serviceSection = extractSection(configText, 'service');

    // sdp <id> <type> create ... exit
    const sdpRegex = /sdp\s+(\d+)\s+(mpls|gre)\s+create([\s\S]*?)(?=\n\s*(?:sdp|epipe|vpls|customer|qos|exit\s*$))/gi;
    const matches = serviceSection.matchAll(sdpRegex);

    for (const match of matches) {
        const [, sdpIdStr, deliveryType, content] = match;

        // Far-End IP 추출
        const farEndMatch = content.match(/far-end\s+([\d.]+)/i);
        const farEnd = farEndMatch ? farEndMatch[1] : '';

        // LSP 이름 추출
        const lspMatch = content.match(/lsp\s+"([^"]+)"/i);
        const lspName = lspMatch ? lspMatch[1] : undefined;

        // Description 추출
        const descMatch = content.match(/description\s+"([^"]+)"/i);
        const description = descMatch ? descMatch[1] : '';

        // Admin state
        const adminState: AdminState = content.includes('shutdown') && !content.includes('no shutdown') ? 'down' : 'up';

        sdps.push({
            sdpId: parseInt(sdpIdStr),
            description,
            farEnd,
            lspName,
            deliveryType: deliveryType as DeliveryType,
            adminState,
        });
    }

    return sdps;
}

/**
 * L2 VPN 설정 파싱 (메인 함수)
 */
export function parseL2VPNConfig(configText: string): ParsedConfigV3 {
    const hostname = extractHostname(configText);
    const systemIp = extractSystemIp(configText);
    const services = parseL2VPNServices(configText);
    const sdps = parseSDPs(configText);

    // Enrich SAPs with Port Descriptions
    const portDescriptions = extractPortDescriptions(configText);

    services.forEach(service => {
        if ('saps' in service) {
            service.saps.forEach(sap => {
                if (portDescriptions.has(sap.portId)) {
                    sap.portDescription = portDescriptions.get(sap.portId);
                }
            });
        }

        // VPRN Interfaces also map to Ports?
        if (service.serviceType === 'vprn') {
            // Logic for VPRN if needed
        }
    });

    // ---------------------------------------------------------
    // v3 Integration: Extract Base Router as IES Service (ID: 0)
    // ---------------------------------------------------------
    const baseInterfaces: L3Interface[] = [];
    const lines = configText.split('\n');

    // Pass 1: Identify Service Block Ranges to exclude (Epipe, VPLS, VPRN)
    // We do NOT exclude 'ies' here because standard L2VPN parser doesn't handle them,
    // so we want them merged into Base Router (IES 0) or we need to update L2VPN parser.
    // For now, let's treat explicit IES services as part of Base Router.
    const serviceRanges: { start: number; end: number }[] = [];
    const serviceStartRegex = /^\s*(epipe|vpls|vprn)\s+\d+(?:\s+name\s+"[^"]+")?\s+customer\s+\d+.*create/i;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (serviceStartRegex.test(line)) {
            const startIndent = line.length - line.trimStart().length;
            // Find end
            let j = i + 1;
            while (j < lines.length) {
                const inner = lines[j];
                // Check for exit
                const innerTrimmed = inner.trim();
                const innerIndent = inner.length - inner.trimStart().length;

                if (innerTrimmed === 'exit' && innerIndent === startIndent) {
                    break;
                }

                // Safety: if indent drops below start and line is not empty, we likely exited
                if (innerIndent < startIndent && innerTrimmed !== '') {
                    j--; // The current line belongs to outer block
                    break;
                }
                j++;
            }
            serviceRanges.push({ start: i, end: j });
            i = j; // Skip content
        }
    }

    // Pass 2: Find Interfaces NOT in Service Ranges
    const interfacePattern = /^\s*interface\s+"([^"]+)"(?:\s+create)?/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(interfacePattern);

        if (match) {
            // Check if inside any service range
            const isInsideService = serviceRanges.some(range => i > range.start && i < range.end);

            if (!isInsideService) {
                const ifName = match[1];
                const startIndent = line.length - line.trimStart().length;

                // Parse Block
                const blockStart = i;
                let blockEnd = i;
                // Find exit
                for (let j = i + 1; j < lines.length; j++) {
                    const sub = lines[j];
                    const subTrimmed = sub.trim();
                    const subIndent = sub.length - sub.trimStart().length;

                    if (subTrimmed === 'exit' && subIndent === startIndent) {
                        blockEnd = j;
                        break;
                    }
                    // Implicit exit safety
                    if (subIndent < startIndent && subTrimmed !== '') {
                        blockEnd = j - 1;
                        break;
                    }
                    blockEnd = j; // extend block
                }

                const ifContent = lines.slice(blockStart, blockEnd + 1).join('\n');

                // Parsing Regex
                const ipMatch = ifContent.match(/address\s+([\d.\/]+)/i);
                const portMatch = ifContent.match(/port\s+([\w\/-]+)/i) || ifContent.match(/sap\s+([\w\/-]+:?\d*)/i);
                const descMatch = ifContent.match(/description\s+"?([^"\n]+)"?/);

                // Valid interface check (must have IP or Port to be useful)
                if (ipMatch || portMatch) {
                    baseInterfaces.push({
                        interfaceName: ifName,
                        ipAddress: ipMatch?.[1],
                        portId: portMatch?.[1],
                        description: descMatch ? descMatch[1] : undefined,
                        adminState: 'up'
                    });
                }

                i = blockEnd; // Skip block
            }
        }
    }

    // Static Routes (Global)
    const staticRoutes: StaticRoute[] = [];
    const srRegex = /^\s*static-route\s+([\d.\/]+)\s+next-hop\s+([\d.]+)/gm;
    let srMatch;
    while ((srMatch = srRegex.exec(configText)) !== null) {
        staticRoutes.push({ prefix: srMatch[1], nextHop: srMatch[2] });
    }

    // static-route-entry block support (Global)
    // Reuse parseVPRN logic or extract global blocks
    // For now, simpler regex support for v1 parity.

    if (baseInterfaces.length > 0 || staticRoutes.length > 0) {
        const iesService: IESService = {
            serviceType: 'ies',
            serviceId: 0,
            serviceName: 'Base Router',
            customerId: 0,
            description: 'Global Base Routing Table',
            adminState: 'up',
            interfaces: baseInterfaces,
            staticRoutes: staticRoutes,
            bgpNeighbors: [] // TODO: Extract Global BGP if needed
        };
        // Add to services list
        // Casting to any to allow IES injection if types conflict temporarily
        (services as any[]).push(iesService);
    }


    return {
        hostname,
        systemIp,
        services,
        sdps,
        connections: [], // 나중에 구현
    };
}
