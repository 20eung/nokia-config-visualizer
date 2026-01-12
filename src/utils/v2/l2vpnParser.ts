import type {
    ParsedL2VPNConfig,
    L2VPNService,
    EpipeService,
    VPLSService,
    SAP,
    SDP,
    SpokeSDP,
    MeshSDP,
    QosPolicy,
    AdminState,
    DeliveryType,
} from '../../types/v2';

/**
 * 설정 파일에서 특정 섹션 추출
 */
export function extractSection(configText: string, sectionName: string): string {
    const regex = new RegExp(`^\\s*${sectionName}\\s*$`, 'im');
    const match = configText.match(regex);

    if (!match || match.index === undefined) {
        return '';
    }

    const startIndex = match.index;
    const lines = configText.substring(startIndex).split('\n');
    const sectionLines: string[] = [lines[0]];

    let depth = 0;
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === 'exit' || trimmed === 'exit all') {
            if (depth === 0) {
                break;
            }
            depth--;
        } else if (trimmed.endsWith('create') || trimmed.includes(' create ')) {
            depth++;
        }

        sectionLines.push(line);
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
    const sapRegex = /sap\s+([\w\/-]+:\d+)\s+create([\s\S]*?)(?=\s+(?:sap|spoke-sdp|mesh-sdp|exit\s*$))/gi;
    const matches = serviceContent.matchAll(sapRegex);

    for (const match of matches) {
        const [, sapId, content] = match;

        // SAP ID 파싱 (예: "1/1/1:100" → port: "1/1/1", vlan: 100)
        const [portId, vlanStr] = sapId.split(':');
        const vlanId = parseInt(vlanStr);

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
    content: string
): EpipeService {
    // Description 추출
    const descMatch = content.match(/description\s+"([^"]+)"/i);
    const description = descMatch ? descMatch[1] : '';

    // Service MTU 추출
    const mtuMatch = content.match(/service-mtu\s+(\d+)/i);
    const serviceMtu = mtuMatch ? parseInt(mtuMatch[1]) : undefined;

    // Admin state
    const adminState: AdminState = content.includes('shutdown') && !content.includes('no shutdown') ? 'down' : 'up';

    // SAP 파싱
    const saps = parseSAPs(content);

    // Spoke SDP 파싱
    const spokeSdps = parseSpokeSDP(content);

    return {
        serviceType: 'epipe',
        serviceId,
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
    content: string
): VPLSService {
    // Description 추출
    const descMatch = content.match(/description\s+"([^"]+)"/i);
    const description = descMatch ? descMatch[1] : '';

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
 * L2 VPN 서비스 파싱
 */
export function parseL2VPNServices(configText: string): L2VPNService[] {
    const services: L2VPNService[] = [];

    const serviceSection = extractSection(configText, 'service');

    // Epipe 파싱
    const epipeRegex = /epipe\s+(\d+)\s+customer\s+(\d+)\s+create([\s\S]*?)(?=\n\s*(?:epipe|vpls|ies|vprn|sdp|customer|qos|exit\s*$))/gi;
    const epipeMatches = serviceSection.matchAll(epipeRegex);

    for (const match of epipeMatches) {
        const [, serviceIdStr, customerIdStr, content] = match;
        const epipe = parseEpipe(
            parseInt(serviceIdStr),
            parseInt(customerIdStr),
            content
        );
        services.push(epipe);
    }

    // VPLS 파싱
    const vplsRegex = /vpls\s+(\d+)\s+customer\s+(\d+)\s+create([\s\S]*?)(?=\n\s*(?:epipe|vpls|ies|vprn|sdp|customer|qos|exit\s*$))/gi;
    const vplsMatches = serviceSection.matchAll(vplsRegex);

    for (const match of vplsMatches) {
        const [, serviceIdStr, customerIdStr, content] = match;
        const vpls = parseVPLS(
            parseInt(serviceIdStr),
            parseInt(customerIdStr),
            content
        );
        services.push(vpls);
    }

    return services;
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
export function parseL2VPNConfig(configText: string): ParsedL2VPNConfig {
    const hostname = extractHostname(configText);
    const systemIp = extractSystemIp(configText);
    const services = parseL2VPNServices(configText);
    const sdps = parseSDPs(configText);

    return {
        hostname,
        systemIp,
        services,
        sdps,
        connections: [], // 나중에 구현
    };
}
