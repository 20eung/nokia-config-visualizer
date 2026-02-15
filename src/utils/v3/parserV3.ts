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
    OSPF,
    OSPFInterface,
    IESService,
    PortEthernetConfig,
    BGPGroup
} from '../../types/v2';

// Use NokiaService from v2 types which now includes IES
export type NokiaServiceV3 = NokiaService;

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
    // Robust regex from v2 (nokiaParser.ts) parsing logic
    // Handles 'system ... name "HOST"' context and optional quotes
    const match = configText.match(/system[\s\S]*?name\s+"?([^"\n]+)"?/i);
    return match ? match[1].trim() : 'Unknown';
}

/**
 * 시스템 IP 추출
 */
export function extractSystemIp(configText: string): string {
    const match = configText.match(/interface\s+"system"[\s\S]*?address\s+([\d.]+)/i);
    return match ? match[1] : '';
}

/**
 * QoS 정책 파싱 (SAP 블록 내 ingress/egress qos 참조)
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
 * sap-ingress / sap-egress 정책 정의 파싱 (line-by-line)
 * 정책 블록에서 rate 정보를 추출하여 Map<'ingress-{id}' | 'egress-{id}', { rate?, rateMax? }> 반환
 */
export function parseQosPolicyDefinitions(configText: string): Map<string, { rate?: number; rateMax?: boolean }> {
    const policyMap = new Map<string, { rate?: number; rateMax?: boolean }>();
    const lines = configText.split('\n');

    // "sap-ingress 15 create" 또는 "sap-ingress 15 name "15" create" 모두 매칭
    const policyStartRegex = /^\s*sap-(ingress|egress)\s+(\d+)(?:\s+name\s+"[^"]*")?\s+create/i;

    for (let i = 0; i < lines.length; i++) {
        const startMatch = lines[i].match(policyStartRegex);
        if (!startMatch) continue;

        const direction = startMatch[1].toLowerCase();
        const idStr = startMatch[2];
        const key = `${direction}-${idStr}`;
        const startIndent = lines[i].search(/\S/);

        // 블록 내 rate 수집 (동일 indent의 exit까지)
        let maxRate = 0;
        let isMax = false;

        for (let j = i + 1; j < lines.length; j++) {
            const line = lines[j];
            const trimmed = line.trim();
            if (trimmed === '') continue;

            const indent = line.search(/\S/);
            // 동일 indent에서 exit → 블록 종료
            if (trimmed === 'exit' && indent === startIndent) break;

            // rate 라인 파싱
            // 패턴: "rate 45000", "rate 45000 cir 45000", "rate cir 2000 pir 2000",
            //        "rate cir max", "rate max cir max"
            const rateMatch = trimmed.match(/^rate\s+(.*)/i);
            if (rateMatch) {
                const rateStr = rateMatch[1];
                if (rateStr.includes('max')) {
                    isMax = true;
                }
                // PIR 추출: "pir <number>" 우선
                const pirMatch = rateStr.match(/pir\s+(\d+)/i);
                if (pirMatch) {
                    const rate = parseInt(pirMatch[1]);
                    if (rate > maxRate) maxRate = rate;
                    continue;
                }
                // "rate <number>" (첫 번째 숫자 = PIR)
                const numMatch = rateStr.match(/^(\d+)/);
                if (numMatch) {
                    const rate = parseInt(numMatch[1]);
                    if (rate > maxRate) maxRate = rate;
                }
            }
        }

        if (isMax && maxRate === 0) {
            policyMap.set(key, { rateMax: true });
        } else if (maxRate > 0) {
            policyMap.set(key, { rate: maxRate });
        }
    }

    return policyMap;
}

/**
 * 서비스 블록의 adminState 판정
 *
 * 서비스 블록 최상위 들여쓰기에 있는 shutdown/no shutdown만 확인합니다.
 * stp, sap, spoke-sdp 등 하위 블록 내부의 shutdown은 무시합니다.
 */
function detectServiceAdminState(content: string): AdminState {
    const lines = content.split('\n');
    if (lines.length === 0) return 'up';

    // 첫 번째 비어있지 않은 줄(서비스 선언)의 들여쓰기를 기준으로
    // 그 다음 레벨(+4 spaces)이 서비스 최상위 속성 레벨
    let baseIndent = -1;
    for (const line of lines) {
        if (line.trim() === '') continue;
        baseIndent = line.search(/\S/);
        break;
    }
    if (baseIndent < 0) return 'up';

    // 서비스 내부 속성의 들여쓰기 레벨 (서비스 선언 + 4)
    const propIndent = baseIndent + 4;

    let hasShutdown = false;
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === '') continue;

        const indent = line.search(/\S/);

        // 서비스 최상위 레벨에서만 shutdown/no shutdown 확인
        if (indent === propIndent) {
            if (trimmed === 'shutdown') {
                hasShutdown = true;
            } else if (trimmed === 'no shutdown') {
                hasShutdown = false;
            }
        }
    }

    return hasShutdown ? 'down' : 'up';
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

        // LLF (Link Loss Forwarding) 감지
        const llf = /ethernet\s[\s\S]*?llf/i.test(content);

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
            ...(llf ? { llf: true } : {}),
        });
    }

    return saps;
}

/**
 * SDP 배열 중복 제거 (sdpId:vcId 기준)
 */
function deduplicateSdps<T extends { sdpId: number; vcId: number }>(sdps: T[]): T[] {
    const seen = new Set<string>();
    return sdps.filter(s => {
        const key = `${s.sdpId}:${s.vcId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
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

    // Admin state - 서비스 최상위 레벨의 shutdown/no shutdown만 확인
    const adminState = detectServiceAdminState(content);

    // SAP 파싱
    const saps = parseSAPs(content);

    // Spoke SDP 파싱
    const spokeSdps = parseSpokeSDP(content);

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

    // MAC-MOVE 감지
    const macMoveShutdown = /mac-move\b/i.test(content);

    // Admin state - 서비스 최상위 레벨의 shutdown/no shutdown만 확인
    const adminState = detectServiceAdminState(content);

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
        ...(macMoveShutdown ? { macMoveShutdown: true } : {}),
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

    // ECMP 파싱
    const ecmpMatch = content.match(/ecmp\s+(\d+)/i);
    const ecmp = ecmpMatch ? parseInt(ecmpMatch[1]) : undefined;

    // Admin state - 서비스 최상위 레벨의 shutdown/no shutdown만 확인
    const adminState = detectServiceAdminState(content);

    // Interface 파싱
    const interfaces: L3Interface[] = [];
    const interfaceRegex = /interface\s+"([^"]+)"\s+create([\s\S]*?)(?=\s+(?:interface|bgp|ospf|static-route-entry|exit\s*$))/gi;
    const ifMatches = content.matchAll(interfaceRegex);

    for (const match of ifMatches) {
        const [, ifName, ifContent] = match;

        const ipMatch = ifContent.match(/address\s+([\d.\/]+)/i);
        const sapMatch = ifContent.match(/sap\s+([\w\/-]+(?::\d+)?)\s+create/i);
        const portMatch = sapMatch || ifContent.match(/port\s+([\w\/-]+)/i);
        const descMatch = ifContent.match(/description\s+"([^"]+)"/i);
        const mtuMatch = ifContent.match(/mtu\s+(\d+)/i);
        const vplsMatch = ifContent.match(/vpls\s+"([^"]+)"/i); // Routed VPLS binding
        const spokeSdpMatch = ifContent.match(/spoke-sdp\s+(\d+:\d+)/i);

        const vrrpMatch = ifContent.match(/vrrp\s+(\d+)/i);
        const vrrpBackupMatch = ifContent.match(/backup\s+([\d.]+)/i);
        const vrrpPriorityMatch = ifContent.match(/priority\s+(\d+)/i);

        // SAP 블록 내 ingress/egress QoS ID 파싱
        const ingressQosMatch = ifContent.match(/ingress[\s\S]*?qos\s+(\d+)/i);
        const egressQosMatch = ifContent.match(/egress[\s\S]*?qos\s+(\d+)/i);

        interfaces.push({
            interfaceName: ifName,
            description: descMatch ? descMatch[1] : undefined,
            ipAddress: ipMatch ? ipMatch[1] : undefined,
            portId: portMatch ? portMatch[1] : undefined,
            sapId: sapMatch ? sapMatch[1] : undefined,
            mtu: mtuMatch ? parseInt(mtuMatch[1]) : undefined,
            vplsName: vplsMatch ? vplsMatch[1] : undefined,
            spokeSdpId: spokeSdpMatch ? spokeSdpMatch[1] : undefined,
            ingressQosId: ingressQosMatch ? ingressQosMatch[1] : undefined,
            egressQosId: egressQosMatch ? egressQosMatch[1] : undefined,
            vrrpGroupId: vrrpMatch ? parseInt(vrrpMatch[1]) : undefined,
            vrrpBackupIp: vrrpBackupMatch ? vrrpBackupMatch[1] : undefined,
            vrrpPriority: vrrpPriorityMatch ? parseInt(vrrpPriorityMatch[1]) : undefined,
            adminState: ifContent.includes('shutdown') && !ifContent.includes('no shutdown') ? 'down' : 'up'
        });
    }


    // BGP Neighbor 파싱 (Enhanced with extractSection + Group/Split-Horizon support)
    const bgpNeighbors: { neighborIp: string; autonomousSystem?: number }[] = [];
    let bgpRouterId: string | undefined;
    let bgpSplitHorizon: boolean | undefined;
    const bgpGroups: BGPGroup[] = [];

    const bgpBlock = extractSection(content, 'bgp');
    if (bgpBlock) {
        // Router ID
        const routerIdMatch = bgpBlock.match(/router-id\s+([\d.]+)/i);
        if (routerIdMatch) bgpRouterId = routerIdMatch[1];

        // Line-by-line parsing for groups, split-horizon, neighbors
        const bgpLines = bgpBlock.split('\n');
        let currentGroup: BGPGroup | null = null;
        let groupIndent = -1;
        let currentNeighborIp: string | null = null;
        let neighborIndent = -1;
        let groupPeerAs: number | undefined;

        for (let i = 0; i < bgpLines.length; i++) {
            const line = bgpLines[i];
            const trimmed = line.trim();
            const indent = line.search(/\S/);
            if (indent < 0) continue; // empty line

            // split-horizon detection
            if (trimmed === 'split-horizon') {
                bgpSplitHorizon = true;
                continue;
            }

            // Group start: group "name"
            const groupMatch = trimmed.match(/^group\s+"([^"]+)"/);
            if (groupMatch) {
                // Save previous group if any
                if (currentGroup) {
                    bgpGroups.push(currentGroup);
                }
                currentGroup = { groupName: groupMatch[1], neighbors: [] };
                groupIndent = indent;
                groupPeerAs = undefined;
                currentNeighborIp = null;
                continue;
            }

            // Inside a group block
            if (currentGroup && indent > groupIndent) {
                // Group exit
                if (trimmed === 'exit' && indent === groupIndent + 4) {
                    // This could be a sub-block exit, not group exit
                    // We check if current neighbor is active
                    if (currentNeighborIp && indent === neighborIndent) {
                        currentNeighborIp = null;
                        neighborIndent = -1;
                    }
                    continue;
                }

                // Group-level peer-as
                const groupPeerAsMatch = trimmed.match(/^peer-as\s+(\d+)/);
                if (groupPeerAsMatch && !currentNeighborIp) {
                    groupPeerAs = parseInt(groupPeerAsMatch[1]);
                    currentGroup.peerAs = groupPeerAs;
                    continue;
                }

                // Neighbor inside group
                const nbrMatch = trimmed.match(/^neighbor\s+([\d.]+)/);
                if (nbrMatch) {
                    currentNeighborIp = nbrMatch[1];
                    neighborIndent = indent;
                    currentGroup.neighbors.push({
                        neighborIp: currentNeighborIp,
                        peerAs: undefined // will be overridden if neighbor has own peer-as
                    });
                    // Also add to flat bgpNeighbors for backward compatibility
                    bgpNeighbors.push({
                        neighborIp: currentNeighborIp,
                        autonomousSystem: groupPeerAs // default to group-level
                    });
                    continue;
                }

                // Neighbor-level peer-as override
                if (currentNeighborIp && groupPeerAsMatch) {
                    // This won't match because we already consumed it above when !currentNeighborIp
                }
                const nbrPeerAsMatch = trimmed.match(/^peer-as\s+(\d+)/);
                if (nbrPeerAsMatch && currentNeighborIp) {
                    const nbrAs = parseInt(nbrPeerAsMatch[1]);
                    // Update last neighbor in group
                    const lastNbr = currentGroup.neighbors[currentGroup.neighbors.length - 1];
                    if (lastNbr) lastNbr.peerAs = nbrAs;
                    // Update flat bgpNeighbors
                    const lastFlat = bgpNeighbors[bgpNeighbors.length - 1];
                    if (lastFlat) lastFlat.autonomousSystem = nbrAs;
                    continue;
                }

                continue;
            }

            // Group exit at group indent level
            if (currentGroup && trimmed === 'exit' && indent === groupIndent) {
                bgpGroups.push(currentGroup);
                currentGroup = null;
                groupIndent = -1;
                currentNeighborIp = null;
                neighborIndent = -1;
                continue;
            }

            // Top-level neighbor (outside group) - fallback
            if (!currentGroup) {
                const nbrMatch = trimmed.match(/^neighbor\s+([\d.]+)/);
                if (nbrMatch) {
                    const nip = nbrMatch[1];
                    const startIndent = indent;

                    // Parse neighbor block for peer-as
                    let nBlock = '';
                    let j = i + 1;
                    while (j < bgpLines.length) {
                        const sub = bgpLines[j];
                        const subTrimmed = sub.trim();
                        const subIndent = sub.search(/\S/);

                        if (subTrimmed === 'exit' && subIndent === startIndent) {
                            break;
                        }
                        if (subIndent < startIndent && subTrimmed !== '') {
                            break;
                        }
                        nBlock += sub + '\n';
                        j++;
                    }

                    const nbrAsMatch = nBlock.match(/peer-as\s+(\d+)/i);
                    bgpNeighbors.push({
                        neighborIp: nip,
                        autonomousSystem: nbrAsMatch ? parseInt(nbrAsMatch[1]) : undefined
                    });

                    i = j; // Advance
                }
            }
        }

        // Push last group if not yet pushed
        if (currentGroup) {
            bgpGroups.push(currentGroup);
        }
    }


    // OSPF Parsing
    let ospf: OSPF | undefined;
    // Proper block extraction for OSPF
    const ospfBlock = extractSection(content, 'ospf');
    if (ospfBlock) {
        const areas: { areaId: string; interfaces: OSPFInterface[] }[] = [];

        // Iterate manually to handle nested blocks safely using indentation-based approach
        const ospfLines = ospfBlock.split('\n');
        let currentAreaId: string | null = null;
        let currentAreaInterfaces: OSPFInterface[] = [];

        for (let i = 0; i < ospfLines.length; i++) {
            const line = ospfLines[i];
            const trimmed = line.trim();

            const areaMatch = trimmed.match(/^area\s+([\d.]+)/);
            if (areaMatch) {
                // Save previous area if any
                if (currentAreaId) {
                    areas.push({ areaId: currentAreaId, interfaces: currentAreaInterfaces });
                }
                currentAreaId = areaMatch[1];
                currentAreaInterfaces = [];
                continue;
            }

            // Interface inside area
            // interface "p3/2/23"
            const intMatch = trimmed.match(/^interface\s+"([^"]+)"/);
            if (currentAreaId && intMatch) {
                const intName = intMatch[1];
                let intType = undefined;
                let intAdmin = 'up'; // default

                // Look ahead for properties until 'exit' or next interface
                let j = i + 1;
                while (j < ospfLines.length) {
                    const inner = ospfLines[j].trim();
                    if (inner.startsWith('interface') || inner.startsWith('area') || (inner === 'exit' && ospfLines[j].search(/\S/) <= line.search(/\S/))) {
                        break;
                    }

                    const typeMatch = inner.match(/interface-type\s+([\w-]+)/);
                    if (typeMatch) intType = typeMatch[1];

                    if (inner === 'shutdown') intAdmin = 'down';
                    if (inner === 'no shutdown') intAdmin = 'up';

                    j++;
                }

                currentAreaInterfaces.push({
                    interfaceName: intName,
                    interfaceType: intType,
                    adminState: intAdmin as 'up' | 'down'
                });
            }
        }

        // Push last area
        if (currentAreaId) {
            areas.push({ areaId: currentAreaId, interfaces: currentAreaInterfaces });
        }

        ospf = {
            areas,
            adminState: ospfBlock.includes('shutdown') && !ospfBlock.includes('no shutdown') ? 'down' : 'up'
        };
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
        ecmp,
        bgpSplitHorizon,
        bgpGroups: bgpGroups.length > 0 ? bgpGroups : undefined,
        interfaces,
        bgpNeighbors,
        staticRoutes,
        ospf
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
        // IES: ies 10 customer 1 create
        const match = trimmed.match(/^(epipe|vpls|vprn|ies)\s+(\d+)(?:\s+name\s+"([^"]+)")?\s+customer\s+(\d+).*\s+create/i);
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
                        spokeSdps: deduplicateSdps([...(existing.spokeSdps || []), ...(newService.spokeSdps || [])]),
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
                        meshSdps: deduplicateSdps([...(existing.meshSdps || []), ...(newService.meshSdps || [])]),
                        spokeSdps: deduplicateSdps([...(existing.spokeSdps || []), ...(newService.spokeSdps || [])]),
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
            } else if (type === 'ies') {
                // IES has same structure as VPRN (interfaces, staticRoutes, bgp, ospf)
                // Parse using VPRN parser, then convert to IESService
                const vprnLike = parseVPRN(serviceId, customerId, content, name);
                const iesService: IESService = {
                    serviceType: 'ies',
                    serviceId: vprnLike.serviceId,
                    serviceName: vprnLike.serviceName,
                    customerId: vprnLike.customerId,
                    description: vprnLike.description,
                    adminState: vprnLike.adminState,
                    interfaces: vprnLike.interfaces,
                    staticRoutes: vprnLike.staticRoutes,
                    bgpNeighbors: vprnLike.bgpNeighbors
                };

                const existingIndex = services.findIndex(s => s.serviceId === serviceId && s.serviceType === 'ies');
                if (existingIndex !== -1) {
                    const existing = services[existingIndex] as IESService;
                    // Merge interfaces by name
                    const mergedInterfaces = [...existing.interfaces];
                    iesService.interfaces.forEach(newIf => {
                        const idx = mergedInterfaces.findIndex(iface => iface.interfaceName === newIf.interfaceName);
                        if (idx !== -1) {
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
                        ...iesService,
                        serviceName: existing.serviceName || iesService.serviceName,
                        description: existing.description || iesService.description,
                        interfaces: mergedInterfaces,
                        bgpNeighbors: [...new Set([...existing.bgpNeighbors, ...iesService.bgpNeighbors])],
                        staticRoutes: [...new Set([...existing.staticRoutes, ...iesService.staticRoutes])]
                    };
                } else {
                    services.push(iesService);
                }
            }
        }
    }

    // Filter out shutdown services (adminState === 'down')
    const activeServices = services.filter(s => s.adminState !== 'down');

    return activeServices as NokiaServiceV3[];
}

/**
 * Port 정보 (Description + Ethernet config) 추출
 */
export interface PortInfo {
    description: string;
    ethernet?: PortEthernetConfig;
}

export function extractPortInfo(configText: string): Map<string, PortInfo> {
    const portMap = new Map<string, PortInfo>();

    const lines = configText.split('\n');
    let currentPort = '';
    let currentPortIndent = -1;
    let inEthernet = false;
    let ethernetIndent = -1;
    let portDescription = '';
    let ethernet: PortEthernetConfig | undefined;

    const flushPort = () => {
        if (currentPort && (portDescription || ethernet)) {
            portMap.set(currentPort, {
                description: portDescription,
                ...(ethernet ? { ethernet } : {}),
            });
        }
        currentPort = '';
        currentPortIndent = -1;
        inEthernet = false;
        ethernetIndent = -1;
        portDescription = '';
        ethernet = undefined;
    };

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const indent = line.length - line.trimStart().length;

        // Detect port block start
        const portMatch = trimmed.match(/^port\s+([\w\/-]+)/);
        if (portMatch && !currentPort) {
            currentPort = portMatch[1];
            currentPortIndent = indent;
            portDescription = '';
            ethernet = undefined;
            inEthernet = false;
            continue;
        }

        if (currentPort) {
            // Exit port block
            if (trimmed === 'exit' && indent === currentPortIndent) {
                flushPort();
                continue;
            }

            // Port-level description
            if (!inEthernet && trimmed.startsWith('description ')) {
                const descMatch = trimmed.match(/^description\s+"([^"]+)"/);
                if (descMatch) {
                    portDescription = descMatch[1];
                }
                continue;
            }

            // Enter ethernet sub-block
            if (trimmed === 'ethernet' && !inEthernet) {
                inEthernet = true;
                ethernetIndent = indent;
                ethernet = {};
                continue;
            }

            // Inside ethernet block
            if (inEthernet) {
                if (trimmed === 'exit' && indent === ethernetIndent) {
                    inEthernet = false;
                    continue;
                }

                const modeMatch = trimmed.match(/^mode\s+(\S+)/);
                if (modeMatch && ethernet) ethernet.mode = modeMatch[1];

                const encapMatch = trimmed.match(/^encap-type\s+(\S+)/);
                if (encapMatch && ethernet) ethernet.encapType = encapMatch[1];

                const mtuMatch = trimmed.match(/^mtu\s+(\d+)/);
                if (mtuMatch && ethernet) ethernet.mtu = parseInt(mtuMatch[1]);

                const speedMatch = trimmed.match(/^speed\s+(\S+)/);
                if (speedMatch && ethernet) ethernet.speed = speedMatch[1];

                const autoMatch = trimmed.match(/^autonegotiate\s+(\S+)/);
                if (autoMatch && ethernet) ethernet.autonegotiate = autoMatch[1];

                // network sub-block: queue-policy
                const nqpMatch = trimmed.match(/^queue-policy\s+"?([^"]+)"?/);
                if (nqpMatch && ethernet) ethernet.networkQueuePolicy = nqpMatch[1];

                // lldp sub-block: admin-status
                const lldpMatch = trimmed.match(/^admin-status\s+(\S+)/);
                if (lldpMatch && ethernet) ethernet.lldp = lldpMatch[1];
            }
        }
    }

    // Flush last port if file ends without exit
    flushPort();

    return portMap;
}

/**
 * Port Description 추출 (Global) - backward compatible wrapper
 */
export function extractPortDescriptions(configText: string): Map<string, string> {
    const portInfo = extractPortInfo(configText);
    const portMap = new Map<string, string>();
    portInfo.forEach((info, portId) => {
        if (info.description) {
            portMap.set(portId, info.description);
        }
    });
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

    // Enrich SAPs and Interfaces with Port Info (Description + Ethernet config)
    const portInfoMap = extractPortInfo(configText);

    // Parse QoS policy definitions (sap-ingress/sap-egress) for rate info
    const qosPolicyMap = parseQosPolicyDefinitions(configText);

    services.forEach(service => {
        if ('saps' in service) {
            service.saps.forEach(sap => {
                const info = portInfoMap.get(sap.portId);
                if (info) {
                    if (info.description) sap.portDescription = info.description;
                    if (info.ethernet) sap.portEthernet = info.ethernet;
                }
                // Inject QoS rate info from policy definitions
                if (sap.ingressQos) {
                    const policyInfo = qosPolicyMap.get(`ingress-${sap.ingressQos.policyId}`);
                    if (policyInfo) {
                        sap.ingressQos.rate = policyInfo.rate;
                        sap.ingressQos.rateMax = policyInfo.rateMax;
                    }
                }
                if (sap.egressQos) {
                    const policyInfo = qosPolicyMap.get(`egress-${sap.egressQos.policyId}`);
                    if (policyInfo) {
                        sap.egressQos.rate = policyInfo.rate;
                        sap.egressQos.rateMax = policyInfo.rateMax;
                    }
                }
            });
        }

        // Enrich L3 Interfaces (VPRN, IES) with Port info and QoS rate
        if ('interfaces' in service && (service.serviceType === 'vprn' || service.serviceType === 'ies')) {
            const l3Service = service as VPRNService | IESService;
            l3Service.interfaces.forEach(intf => {
                if (intf.portId) {
                    // portId for L3 interfaces can be "1/1/1:100" (SAP format)
                    const rawPort = intf.portId.split(':')[0];
                    const info = portInfoMap.get(rawPort);
                    if (info) {
                        if (info.description && !intf.portDescription) intf.portDescription = info.description;
                        if (info.ethernet) intf.portEthernet = info.ethernet;
                    }
                }
                // Inject QoS rate info from policy definitions
                if (intf.ingressQosId) {
                    const p = qosPolicyMap.get(`ingress-${intf.ingressQosId}`);
                    if (p) {
                        intf.ingressQosRate = p.rate;
                        intf.ingressQosRateMax = p.rateMax;
                    }
                }
                if (intf.egressQosId) {
                    const p = qosPolicyMap.get(`egress-${intf.egressQosId}`);
                    if (p) {
                        intf.egressQosRate = p.rate;
                        intf.egressQosRateMax = p.rateMax;
                    }
                }
            });
        }
    });

    // ---------------------------------------------------------
    // Helpers for IP subnet matching (used by IES 0 filtering)
    // ---------------------------------------------------------
    function ipToLong(ip: string): number {
        return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
    }

    function isIpInSubnet(ip: string, cidr: string): boolean {
        const parts = cidr.split('/');
        if (parts.length !== 2) return false;
        const subnetIp = parts[0];
        const prefixLen = parseInt(parts[1], 10);
        if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 32) return false;
        const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
        return (ipToLong(ip) & mask) === (ipToLong(subnetIp) & mask);
    }

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
    const serviceStartRegex = /^\s*(epipe|vpls|vprn|ies)\s+\d+(?:\s+name\s+"[^"]+")?\s+customer\s+\d+.*create/i;

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

    // Pass 2: Find Interfaces NOT in Service Ranges (Base Router only)
    const interfacePattern = /^\s*interface\s+"([^"]+)"(?:\s+create)?/;
    const parsedInterfaceNames = new Set<string>(); // 중복 방지

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(interfacePattern);

        if (match) {
            // Check if inside any service range
            const isInsideService = serviceRanges.some(range => i > range.start && i < range.end);

            if (!isInsideService) {
                const ifName = match[1];

                // 중복 체크: 이미 파싱된 인터페이스는 건너뛰기
                if (parsedInterfaceNames.has(ifName)) {
                    continue;
                }
                parsedInterfaceNames.add(ifName);
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
                const sapMatch = ifContent.match(/sap\s+([\w\/-]+(?::\d+)?)\s+create/i);
                const portMatch = ifContent.match(/port\s+([\w\/-]+)/i) || sapMatch;
                const descMatch = ifContent.match(/description\s+"?([^"\n]+)"?/);
                const mtuMatch = ifContent.match(/mtu\s+(\d+)/i);
                const vplsMatch = ifContent.match(/vpls\s+"([^"]+)"/i);
                const spokeSdpMatch = ifContent.match(/spoke-sdp\s+(\d+:\d+)/i);

                // QoS Parsing (Ingress/Egress separation)
                let inQos: string | undefined;
                let outQos: string | undefined;

                // Try to capture ingress block
                const ingressBlock = ifContent.match(/ingress\s+([\s\S]*?)\s+exit/i);
                if (ingressBlock) {
                    const qMatch = ingressBlock[1].match(/qos\s+(\d+)/i);
                    if (qMatch) inQos = qMatch[1];
                } else {
                    const qMatch = ifContent.match(/ingress\s+qos\s+(\d+)/i);
                    if (qMatch) inQos = qMatch[1];
                }

                // Try to capture egress block
                const egressBlock = ifContent.match(/egress\s+([\s\S]*?)\s+exit/i);
                if (egressBlock) {
                    const qMatch = egressBlock[1].match(/qos\s+(\d+)/i);
                    if (qMatch) outQos = qMatch[1];
                } else {
                    const qMatch = ifContent.match(/egress\s+qos\s+(\d+)/i);
                    if (qMatch) outQos = qMatch[1];
                }

                // Fallback generic qos if specific direction not found
                if (!inQos && !outQos) {
                    const genericQos = ifContent.match(/qos\s+(\d+)/i);
                    if (genericQos) inQos = genericQos[1];
                }

                // V1 호환: 모든 인터페이스 수집 (IP/Port 정보가 없어도 포함)
                // 이렇게 해야 LAG 멤버, 설정 중인 인터페이스 등도 표시됨
                const pId = portMatch?.[1];
                let pDesc = undefined;
                let pEthernet = undefined;

                if (pId) {
                    const pInfo = portInfoMap.get(pId);
                    if (pInfo) {
                        pDesc = pInfo.description || undefined;
                        pEthernet = pInfo.ethernet;
                    }
                }

                baseInterfaces.push({
                    interfaceName: ifName,
                    ipAddress: ipMatch?.[1],
                    portId: pId,
                    sapId: sapMatch ? sapMatch[1] : undefined,
                    description: descMatch ? descMatch[1] : undefined,
                    portDescription: pDesc,
                    portEthernet: pEthernet,
                    mtu: mtuMatch ? parseInt(mtuMatch[1]) : undefined,
                    vplsName: vplsMatch ? vplsMatch[1] : undefined,
                    spokeSdpId: spokeSdpMatch ? spokeSdpMatch[1] : undefined,
                    ingressQosId: inQos,
                    egressQosId: outQos,
                    adminState: 'up'
                });

                i = blockEnd; // Skip block
            }
        }
    }

    // Enrich Base Router interfaces with QoS rate info from policy definitions
    baseInterfaces.forEach(intf => {
        if (intf.ingressQosId) {
            const p = qosPolicyMap.get(`ingress-${intf.ingressQosId}`);
            if (p) {
                intf.ingressQosRate = p.rate;
                intf.ingressQosRateMax = p.rateMax;
            }
        }
        if (intf.egressQosId) {
            const p = qosPolicyMap.get(`egress-${intf.egressQosId}`);
            if (p) {
                intf.egressQosRate = p.rate;
                intf.egressQosRateMax = p.rateMax;
            }
        }
    });

    // Static Routes (Global)
    const staticRoutes: StaticRoute[] = [];

    // 1. One-line format: static-route <prefix> next-hop <ip>
    const srRegex = /^\s*static-route\s+([\d.\/]+)\s+next-hop\s+([\d.]+)/gm;
    let srMatch;
    while ((srMatch = srRegex.exec(configText)) !== null) {
        staticRoutes.push({ prefix: srMatch[1], nextHop: srMatch[2] });
    }

    // 2. Block format: static-route-entry <prefix> ... next-hop <ip> ... exit
    // Parse directly from configText (works for both router management and router Base)
    const allLines = configText.split('\n');
    let currentPrefix: string | null = null;
    let entryIndent = -1;

    for (const line of allLines) {
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

            if (trimLine === 'exit' && currentIndent === entryIndent) {
                currentPrefix = null;
                continue;
            }

            // Look for next-hop
            const nhMatch = trimLine.match(/next-hop\s+([\d.]+)/);
            if (nhMatch) {
                staticRoutes.push({ prefix: currentPrefix, nextHop: nhMatch[1] });
                // Note: Do NOT reset currentPrefix here, as there might be multiple next-hops
            }
        }
    }

    // ---------------------------------------------------------
    // Rule 1: Filter Base Router interfaces for IES 0
    // Only include interfaces that:
    //   1. Name is NOT "system"
    //   2. Have an IP address
    //   3. Have at least one static route whose next-hop falls in the interface's subnet
    // ---------------------------------------------------------
    const filteredBaseInterfaces = baseInterfaces.filter(intf => {
        // Exclude "system" interface
        if (intf.interfaceName.toLowerCase() === 'system') return false;
        // Must have IP address
        if (!intf.ipAddress) return false;
        // Must have at least one associated static route
        const hasAssociatedRoute = staticRoutes.some(route =>
            isIpInSubnet(route.nextHop, intf.ipAddress!)
        );
        return hasAssociatedRoute;
    });

    // ---------------------------------------------------------
    // Rule 2: Propagate global static routes to explicit IES services
    // If there are explicit IES services (serviceId > 0) in this config,
    // merge global static routes into them (deduplicated).
    // ---------------------------------------------------------
    const explicitIesServices = services.filter(
        s => s.serviceType === 'ies' && s.serviceId !== 0
    ) as IESService[];

    if (explicitIesServices.length > 0 && staticRoutes.length > 0) {
        for (const ies of explicitIesServices) {
            const existingKeys = new Set(
                ies.staticRoutes.map(r => `${r.prefix}|${r.nextHop}`)
            );
            for (const route of staticRoutes) {
                const key = `${route.prefix}|${route.nextHop}`;
                if (!existingKeys.has(key)) {
                    ies.staticRoutes.push(route);
                    existingKeys.add(key);
                }
            }
        }
    }

    // ---------------------------------------------------------
    // IES 0 creation: only if filtered interfaces remain
    // ---------------------------------------------------------
    if (filteredBaseInterfaces.length > 0) {
        const iesService: IESService = {
            serviceType: 'ies',
            serviceId: 0,
            serviceName: 'Base Router',
            customerId: 0,
            description: 'Global Base Routing Table',
            adminState: 'up',
            interfaces: filteredBaseInterfaces,
            staticRoutes: staticRoutes,
            bgpNeighbors: []
        };
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


