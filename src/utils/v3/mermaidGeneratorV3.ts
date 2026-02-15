import type { EpipeService, VPLSService, VPRNService, SDP, SAP, L3Interface } from '../../types/v2';
import type { ParsedConfigV3, NokiaServiceV3 } from './parserV3';

/**
 * Mermaid 노드 ID 생성 (특수문자 제거)
 */
function sanitizeNodeId(id: string): string {
    // Replace all non-alphanumeric characters (except underscore and hyphen) with underscore
    // This prevents Mermaid syntax errors when Hostnames contain (), ., etc.
    return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

// -----------------------------------------------------------------------------
// IES (Base Router) Diagram Generation (V1 Style Port)
// -----------------------------------------------------------------------------

/**
 * @deprecated V3 IES는 이제 V1 방식으로 처리됩니다.
 * V1의 검증된 다이어그램 생성 로직을 재사용합니다.
 * 자세한 내용은 /src/utils/v1IESAdapter.ts를 참조하세요.
 *
 * This function is no longer used and kept only for backward compatibility.
 */
export function generateIESDiagram(_services: NokiaServiceV3[], _hostnames: string[]): string {
    console.warn('⚠️ generateIESDiagram is deprecated. Use v1IESAdapter instead.');
    return 'graph LR\n    Deprecated["This function is deprecated. Use V1 IES Adapter."]';
}

// Helper: Non-wrapping text (from V1)
const noWrap = (text: string): string => {
    return text
        .replace(/&/g, '&amp;')
        .replace(/ /g, '\u00A0')
        .replace(/-/g, '\u2011');
};

// Helper: IP address를 32-bit 정수로 변환
function ipToLong(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

// Helper: IP가 CIDR 서브넷에 포함되는지 확인
function isIpInSubnet(ip: string, cidr: string): boolean {
    const parts = cidr.split('/');
    if (parts.length !== 2) return false;
    const subnetIp = parts[0];
    const prefixLen = parseInt(parts[1], 10);
    if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 32) return false;
    const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
    return (ipToLong(ip) & mask) === (ipToLong(subnetIp) & mask);
}

// Helper: QoS rate를 KMG 단위로 변환 (kbps → K/M/G)
// rate 파싱 성공 시: "100M", "2G", "500K", "Max"
// rate 파싱 실패 시 (정책 정의 없음): policy ID만 표시 "15"
function formatRateKMG(qos: { policyId: number; rate?: number; rateMax?: boolean }): string {
    if (qos.rateMax) return 'Max';
    if (!qos.rate) return `${qos.policyId}`;
    const kbps = qos.rate;
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


/**
 * Epipe 서비스 다이어그램 생성 (단일 또는 다중 서비스 지원)
 */
export function generateEpipeDiagram(
    epipes: EpipeService | EpipeService[],
    hostname: string | string[],
    _sdps: SDP[] = [],
    _remoteDeviceMap?: Map<string, string>
): string {
    // 배열로 정규화 + shutdown SAP 필터링
    const rawEpipeArray = Array.isArray(epipes) ? epipes : [epipes];
    const hostnameArray = Array.isArray(hostname) ? hostname : [hostname];
    const epipeArray = rawEpipeArray.map(e => ({ ...e, saps: e.saps.filter(s => s.adminState !== 'down') }));

    // SDP 기반 그룹화 로직 (User Request: Verify SDP)
    // 1. SDP Target(ID:VC)별로 서비스를 분류
    // 2. 만약 하나라도 동일 SDP Target을 공유하는 서비스가 2개 이상 있다면 (Hub/Spoke 구조 등),
    //    이질적인 SDP를 가진 놈들을 분리해서 그리기 위해 'Split Mode' 진입
    // 3. 그렇지 않다면 (모두 1:1이거나 SDP 없음) 기존처럼 'Merge Mode' (하나의 Service Box)

    const sdpGroups = new Map<string, { epipes: EpipeService[], hostnames: string[] }>();
    const noSdpGroup: { epipes: EpipeService[], hostnames: string[] } = { epipes: [], hostnames: [] };

    epipeArray.forEach((epipe, idx) => {
        const host = hostnameArray[idx] || hostnameArray[0];

        if (epipe.spokeSdps && epipe.spokeSdps.length > 0) {
            // Use first SDP for grouping (Primary path)
            const primarySdp = epipe.spokeSdps[0];
            const sdpKey = `${primarySdp.sdpId}:${primarySdp.vcId}`;

            if (!sdpGroups.has(sdpKey)) {
                sdpGroups.set(sdpKey, { epipes: [], hostnames: [] });
            }
            sdpGroups.get(sdpKey)!.epipes.push(epipe);
            sdpGroups.get(sdpKey)!.hostnames.push(host);
        } else {
            noSdpGroup.epipes.push(epipe);
            noSdpGroup.hostnames.push(host);
        }
    });

    // Check Trigger Condition: Always group by SDP for consistency
    // User Request: "Host=1 should look like Host>=2 format"
    // We remove the fallback 'Merge Mode' and always use the 'Split/Group Mode' 
    // which generates consistent Service Labels and separates discongruent SDPs.

    // SPLIT MODE: Generate separate diagrams for each SDP Group + NoSDP Group
    const lines: string[] = ['graph LR'];
    lines.push('classDef default fill:#ffffff,stroke:#333,stroke-width:2px,color:#000,text-align:left;');
    lines.push('classDef service fill:#e3f2fd,stroke:#1976d2,stroke-width:3px,color:#000;');
    // QoS는 SAP 노드 내부에 표시 (엣지 라벨 사용 안 함)
    lines.push('');

    let groupCounter = 0;

    // Helper to render a subset
    const renderSubset = (subsetEpipes: EpipeService[], subsetHosts: string[], _groupLabel: string) => {
        const first = subsetEpipes[0];
        const svcNodeId = `SERVICE_${first.serviceId}_G${groupCounter}`;

        // Render Hosts
        subsetEpipes.forEach((epipe, idx) => {
            const host = subsetHosts[idx];
            const safeHost = sanitizeNodeId(host);
            const hostId = `HOST_${safeHost}_G${groupCounter}_${idx}`;

            lines.push(`subgraph ${hostId} ["\u003cb\u003e${noWrap(host)}\u003c/b\u003e"]`);
            lines.push('direction TB');

            epipe.saps.forEach((sap, sapIdx) => {
                const sapNodeId = `SAP_${safeHost}_G${groupCounter}_${idx}_${sapIdx}`;
                let label = `\u003cdiv style=\"text-align: left\"\u003e`;
                // SAP + QoS (SAP 하위 항목)
                label += `\u003cb\u003eSAP:\u003c/b\u003e ${sap.sapId}<br/>`;
                if (sap.ingressQos) label += `\u00A0\u00A0\u2011\u00A0In\u2011QoS:\u00A0${formatRateKMG(sap.ingressQos)}<br/>`;
                if (sap.egressQos) label += `\u00A0\u00A0\u2011\u00A0Out\u2011QoS:\u00A0${formatRateKMG(sap.egressQos)}<br/>`;
                // Port
                label += `\u003cb\u003ePort:\u003c/b\u003e ${sap.portId}<br/>`;
                if (sap.portDescription) {
                    label += `\u003cb\u003ePort\u00A0Desc:\u003c/b\u003e ${noWrap(sap.portDescription)}<br/>`;
                }
                // Ethernet sub-fields (only show fields that have values)
                const pe = sap.portEthernet;
                const ethItems: string[] = [];
                if (pe?.mode) ethItems.push(`\u00A0\u00A0\u2011\u00A0Mode:\u00A0${pe.mode}`);
                if (pe?.mtu) ethItems.push(`\u00A0\u00A0\u2011\u00A0MTU:\u00A0${pe.mtu}`);
                if (pe?.speed) ethItems.push(`\u00A0\u00A0\u2011\u00A0SPEED:\u00A0${pe.speed}`);
                if (pe?.autonegotiate) ethItems.push(`\u00A0\u00A0\u2011\u00A0AUTONEGO:\u00A0${pe.autonegotiate}`);
                if (pe?.networkQueuePolicy) ethItems.push(`\u00A0\u00A0\u2011\u00A0NETWORK:\u00A0${pe.networkQueuePolicy}`);
                if (sap.llf) ethItems.push(`\u00A0\u00A0\u2011\u00A0LLF:\u00A0On`);
                if (pe?.lldp) ethItems.push(`\u00A0\u00A0\u2011\u00A0LLDP:\u00A0${pe.lldp}`);
                if (ethItems.length > 0) {
                    label += `\u003cb\u003eEthernet:\u003c/b\u003e<br/>`;
                    label += ethItems.join('<br/>') + '<br/>';
                }
                label += `\u003c/div\u003e`;
                lines.push(`${sapNodeId}[\"${label}\"]`);
            });
            lines.push('end');
        });

        // Render Service Node
        let svcLabel = `\u003cdiv style=\"text-align: left\"\u003e`;
        svcLabel += `\u003cb\u003eService:\u003c/b\u003e EPIPE ${first.serviceId}<br/>`;

        if (first.serviceName) {
            svcLabel += `\u003cb\u003eEPIPE Name:\u003c/b\u003e ${noWrap(first.serviceName)}<br/>`;
        }
        if (first.description) {
            svcLabel += `\u003cb\u003eEPIPE Desc:\u003c/b\u003e ${first.description}<br/>`;
        }
        // Spoke-SDP Info
        if (first.spokeSdps && first.spokeSdps.length > 0) {
            const sdp = first.spokeSdps[0];
            svcLabel += `\u003cb\u003eSpoke\u2011Sdp:\u003c/b\u003e ${sdp.sdpId}:${sdp.vcId}<br/>`;
        }
        svcLabel += `\u003c/div\u003e`;

        lines.push(`${svcNodeId}[\"${svcLabel}\"]`);
        lines.push(`class ${svcNodeId} service;`);

        // Links: plain arrows (QoS는 SAP 노드 안에 표시)
        subsetEpipes.forEach((epipe, idx) => {
            const host = subsetHosts[idx];
            const safeHost = sanitizeNodeId(host);
            epipe.saps.forEach((_sap, sapIdx) => {
                const sapNodeId = `SAP_${safeHost}_G${groupCounter}_${idx}_${sapIdx}`;
                lines.push(`${sapNodeId} --> ${svcNodeId}`);
            });
        });

        groupCounter++;
    };

    // Render each SDP Group
    sdpGroups.forEach((val, key) => {
        renderSubset(val.epipes, val.hostnames, `Link: ${key}`);
    });

    // Render No SDP Group
    if (noSdpGroup.epipes.length > 0) {
        renderSubset(noSdpGroup.epipes, noSdpGroup.hostnames, 'No SDP');
    }

    return lines.join('\n');
}

/**
 * VPLS 서비스 다이어그램 생성
 *
 * Hub-Spoke 레이아웃 자동 감지:
 * - Mesh-Sdp가 가장 많은 호스트 = Hub (코어 장비) → 오른쪽 배치
 * - 나머지 호스트 = Spoke (액세스 장비) → 왼쪽 배치
 * - Hub가 명확하지 않으면 (동률 등) 기존 Flat 레이아웃 사용
 */
export function generateVPLSDiagram(
    vpls: VPLSService | VPLSService[],
    hostname: string | string[],
    _sdps: SDP[] = [],
    _remoteDeviceMap?: Map<string, string>
): string {
    // 배열로 정규화 + shutdown SAP 필터링
    const rawVplsArray = Array.isArray(vpls) ? vpls : [vpls];
    const hostnameArray = Array.isArray(hostname) ? hostname : [hostname];
    const vplsArray = rawVplsArray.map(v => ({ ...v, saps: v.saps.filter(s => s.adminState !== 'down') }));

    const lines: string[] = [];
    lines.push('graph LR');
    lines.push('classDef default fill:#ffffff,stroke:#333,stroke-width:2px,color:#000,text-align:left;');
    lines.push('classDef vpls fill:#e3f2fd,stroke:#1976d2,stroke-width:3px,color:#000;');
    // QoS는 SAP 노드 내부에 텍스트로 표시 (엣지 라벨 사용 안 함)
    lines.push('classDef svcinfo fill:#fff9c4,stroke:#f9a825,stroke-width:2px,color:#000,text-align:left;');
    lines.push('');

    const firstVpls = vplsArray[0];
    const vplsNodeId = `VPLS_${firstVpls.serviceId}`;

    // --- Helper: SAP 노드 라벨 생성 (SAP + QoS + Port + Ethernet) ---
    // Config 구조: SAP 블록 안에 ingress/egress qos가 있으므로 QoS는 SAP 하위 항목으로 표시
    const buildSapLabel = (sap: SAP): string => {
        let label = `\u003cdiv style=\"text-align: left\"\u003e`;
        // SAP + QoS (SAP 하위 항목)
        label += `\u003cb\u003eSAP:\u003c/b\u003e ${sap.sapId}<br/>`;
        if (sap.ingressQos) label += `\u00A0\u00A0\u2011\u00A0In\u2011QoS:\u00A0${formatRateKMG(sap.ingressQos)}<br/>`;
        if (sap.egressQos) label += `\u00A0\u00A0\u2011\u00A0Out\u2011QoS:\u00A0${formatRateKMG(sap.egressQos)}<br/>`;
        // Port
        label += `\u003cb\u003ePort:\u003c/b\u003e ${sap.portId}<br/>`;
        if (sap.portDescription) {
            label += `\u003cb\u003ePort\u00A0Desc:\u003c/b\u003e ${noWrap(sap.portDescription)}<br/>`;
        }
        if (sap.vlanId) {
            label += `\u003cb\u003eVLAN:\u003c/b\u003e ${sap.vlanId}<br/>`;
        }
        // Ethernet 하위 필드
        const pe = sap.portEthernet;
        const ethItems: string[] = [];
        if (pe?.mode) ethItems.push(`\u00A0\u00A0\u2011\u00A0Mode:\u00A0${pe.mode}`);
        if (pe?.mtu) ethItems.push(`\u00A0\u00A0\u2011\u00A0MTU:\u00A0${pe.mtu}`);
        if (pe?.speed) ethItems.push(`\u00A0\u00A0\u2011\u00A0SPEED:\u00A0${pe.speed}`);
        if (pe?.autonegotiate) ethItems.push(`\u00A0\u00A0\u2011\u00A0AUTONEGO:\u00A0${pe.autonegotiate}`);
        if (pe?.networkQueuePolicy) ethItems.push(`\u00A0\u00A0\u2011\u00A0NETWORK:\u00A0${pe.networkQueuePolicy}`);
        if (sap.llf) ethItems.push(`\u00A0\u00A0\u2011\u00A0LLF:\u00A0On`);
        if (pe?.lldp) ethItems.push(`\u00A0\u00A0\u2011\u00A0LLDP:\u00A0${pe.lldp}`);
        if (ethItems.length > 0) {
            label += `\u003cb\u003eEthernet:\u003c/b\u003e<br/>`;
            label += ethItems.join('<br/>') + '<br/>';
        }
        label += `\u003c/div\u003e`;
        return label;
    };

    // QoS는 SAP 노드 안에 표시하므로 엣지 라벨에는 사용하지 않음

    // --- Helper: 호스트 서브그래프 렌더링 (SAP 노드 ID 배열 반환) ---
    const renderHost = (currentVpls: VPLSService, vplsIdx: number, hostName: string): string[] => {
        const safeHost = sanitizeNodeId(hostName);
        const hostId = `HOST_${safeHost}_${vplsIdx}`;
        lines.push(`subgraph ${hostId}["\u003cb\u003e${noWrap(hostName)}\u003c/b\u003e"]`);
        lines.push('direction TB');

        // SAP 노드들 (포트 정보만)
        const sapIds: string[] = [];
        currentVpls.saps.forEach((sap, sapIdx) => {
            const sapNodeId = `SAP_${safeHost}_${vplsIdx}_${sapIdx}`;
            sapIds.push(sapNodeId);
            const label = buildSapLabel(sap);
            lines.push(`${sapNodeId}["${label}"]`);
        });

        // SDP 정보 노드 (서비스 레벨: Spoke-Sdp, Mesh-Sdp, MAC-Move)
        const sdpItems: string[] = [];
        const spokeSet = new Set<string>();
        const meshSet = new Set<string>();
        if (currentVpls.spokeSdps) currentVpls.spokeSdps.forEach(s => spokeSet.add(`${s.sdpId}:${s.vcId}`));
        if (currentVpls.meshSdps) currentVpls.meshSdps.forEach(m => meshSet.add(`${m.sdpId}:${m.vcId}`));
        spokeSet.forEach(key => {
            sdpItems.push(`\u003cb\u003eSpoke\u2011Sdp:\u003c/b\u003e ${key}`);
        });
        meshSet.forEach(key => {
            sdpItems.push(`\u003cb\u003eMesh\u2011Sdp:\u003c/b\u003e ${key}`);
        });
        if (currentVpls.macMoveShutdown) {
            sdpItems.push(`\u003cb\u003eMAC\u2011MOVE:\u003c/b\u003e Detected`);
        }
        if (sdpItems.length > 0) {
            const sdpNodeId = `SDP_${safeHost}_${vplsIdx}`;
            const sdpLabel = `\u003cdiv style=\"text-align: left\"\u003e${sdpItems.join('<br/>')}\u003c/div\u003e`;
            lines.push(`${sdpNodeId}["${sdpLabel}"]`);
            lines.push(`class ${sdpNodeId} svcinfo;`);
        }

        lines.push('end');
        return sapIds;
    };

    // --- Helper: VPLS 서비스 노드 렌더링 ---
    const renderServiceNode = () => {
        lines.push('');
        let vplsLabel = `\u003cdiv style=\"text-align: left\"\u003e`;
        vplsLabel += `\u003cb\u003eService:\u003c/b\u003e VPLS ${firstVpls.serviceId}<br/>`;
        if (firstVpls.serviceName) {
            vplsLabel += `\u003cb\u003eVPLS\u00A0Name:\u003c/b\u003e ${noWrap(firstVpls.serviceName)}<br/>`;
        }
        if (firstVpls.description) {
            vplsLabel += `\u003cb\u003eVPLS\u00A0Desc:\u003c/b\u003e ${noWrap(firstVpls.description)}<br/>`;
        }
        vplsLabel += `\u003c/div\u003e`;
        lines.push(`${vplsNodeId}["${vplsLabel}"]`);
        lines.push(`class ${vplsNodeId} vpls;`);
    };

    // --- Hub 감지: SDP(Mesh + Spoke) 합산이 가장 많은 호스트 ---
    let hubIndex = -1;
    if (vplsArray.length >= 2) {
        let maxCount = 0;
        let maxIdx = -1;
        let tied = false;
        vplsArray.forEach((v, idx) => {
            const count = (v.meshSdps?.length || 0) + (v.spokeSdps?.length || 0);
            if (count > maxCount) {
                maxCount = count;
                maxIdx = idx;
                tied = false;
            } else if (count === maxCount && count > 0) {
                tied = true;
            }
        });
        // Hub는 유일해야 하고, SDP가 1개 이상이어야 하고, SAP이 있어야 함
        if (!tied && maxCount > 0 && vplsArray[maxIdx].saps.length > 0) {
            hubIndex = maxIdx;
        }
    }

    if (hubIndex !== -1) {
        // ===== Hub-Spoke 레이아웃 =====
        // Spoke(액세스 장비) → Hub(코어 장비) → VPLS 서비스
        const spokeIndices = vplsArray.map((_, i) => i).filter(i => i !== hubIndex);

        // 1. Spoke 서브그래프 (왼쪽)
        const spokeSapMap: { idx: number; sapIds: string[] }[] = [];
        spokeIndices.forEach(idx => {
            const sapIds = renderHost(vplsArray[idx], idx, hostnameArray[idx] || hostnameArray[0]);
            spokeSapMap.push({ idx, sapIds });
        });

        // 2. Hub 서브그래프 (중간)
        const hubSapIds = renderHost(vplsArray[hubIndex], hubIndex, hostnameArray[hubIndex] || hostnameArray[0]);

        // 3. VPLS 서비스 노드 (오른쪽)
        renderServiceNode();

        // 4. 연결: Spoke SAPs → Hub 첫 번째 SAP (QoS는 SAP 노드 안에 표시)
        const hubTarget = hubSapIds[0];
        spokeSapMap.forEach(({ sapIds }) => {
            sapIds.forEach((sapId) => {
                lines.push(`${sapId} --> ${hubTarget}`);
            });
        });

        // 5. 연결: Hub SAPs → VPLS 서비스 (QoS는 SAP 노드 안에 표시)
        hubSapIds.forEach((sapId) => {
            lines.push(`${sapId} --> ${vplsNodeId}`);
        });

    } else {
        // ===== Flat 레이아웃 (Hub 미감지) =====
        // 모든 호스트 왼쪽, VPLS 서비스 오른쪽
        const allSapMap: { idx: number; sapIds: string[] }[] = [];
        vplsArray.forEach((currentVpls, vplsIdx) => {
            const sapIds = renderHost(currentVpls, vplsIdx, hostnameArray[vplsIdx] || hostnameArray[0]);
            allSapMap.push({ idx: vplsIdx, sapIds });
        });

        renderServiceNode();

        allSapMap.forEach(({ sapIds }) => {
            sapIds.forEach((sapId) => {
                lines.push(`${sapId} --> ${vplsNodeId}`);
            });
        });
    }

    return lines.join('\n');
}

// Helper: L3Interface QoS rate를 KMG 단위로 변환
function formatL3QosRate(iface: L3Interface, direction: 'ingress' | 'egress'): string | undefined {
    if (direction === 'ingress') {
        if (iface.ingressQosRateMax) return 'Max';
        if (iface.ingressQosRate) {
            const kbps = iface.ingressQosRate;
            if (kbps >= 1000000) { const g = kbps / 1000000; return `${Number.isInteger(g) ? g : g.toFixed(1)}G`; }
            if (kbps >= 1000) { const m = kbps / 1000; return `${Number.isInteger(m) ? m : m.toFixed(1)}M`; }
            return `${kbps}K`;
        }
        return iface.ingressQosId || undefined;
    } else {
        if (iface.egressQosRateMax) return 'Max';
        if (iface.egressQosRate) {
            const kbps = iface.egressQosRate;
            if (kbps >= 1000000) { const g = kbps / 1000000; return `${Number.isInteger(g) ? g : g.toFixed(1)}G`; }
            if (kbps >= 1000) { const m = kbps / 1000; return `${Number.isInteger(m) ? m : m.toFixed(1)}M`; }
            return `${kbps}K`;
        }
        return iface.egressQosId || undefined;
    }
}

/**
 * VPRN 서비스 다이어그램 생성
 *
 * 라우팅 중간 노드:
 *   Interface → BGP/OSPF/STATIC Node → Service Node
 *   (매칭 없는 인터페이스는 Service에 직접 연결)
 */
export function generateVPRNDiagram(
    vprn: VPRNService | VPRNService[],
    hostname: string | string[]
): string {
    // 배열로 정규화 + shutdown 인터페이스 필터링
    const rawVprnArray = Array.isArray(vprn) ? vprn : [vprn];
    const hostnameArray = Array.isArray(hostname) ? hostname : [hostname];
    const vprnArray = rawVprnArray.map(v => ({ ...v, interfaces: v.interfaces.filter(i => i.adminState !== 'down') }));

    const lines: string[] = [];

    lines.push('graph LR');
    lines.push('classDef default fill:#ffffff,stroke:#333,stroke-width:2px,color:#000,text-align:left;');
    lines.push('classDef service fill:#e3f2fd,stroke:#1976d2,stroke-width:3px,color:#000;');
    lines.push('classDef routing fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,color:#000,text-align:left;');
    lines.push('');

    const firstVprn = vprnArray[0];
    const serviceNodeId = `VPRN_SERVICE_${firstVprn.serviceId}`;

    // ========== Aggregate routing info from all hosts ==========

    // --- BGP ---
    let bgpRouterId = '';
    const allBgpGroups: { groupName: string; peerAs?: number; neighbors: { neighborIp: string; peerAs?: number }[] }[] = [];
    const allBgpNeighbors: { neighborIp: string; autonomousSystem?: number }[] = [];
    let bgpSplitHorizon = false;

    vprnArray.forEach(v => {
        if (v.bgpRouterId && !bgpRouterId) bgpRouterId = v.bgpRouterId;
        if (v.bgpSplitHorizon) bgpSplitHorizon = true;
        if (v.bgpGroups) {
            v.bgpGroups.forEach(g => {
                if (!allBgpGroups.find(eg => eg.groupName === g.groupName)) {
                    allBgpGroups.push({ ...g, neighbors: [...g.neighbors] });
                }
            });
        }
        if (v.bgpNeighbors) {
            v.bgpNeighbors.forEach(n => {
                if (!allBgpNeighbors.find(en => en.neighborIp === n.neighborIp)) {
                    allBgpNeighbors.push(n);
                }
            });
        }
    });

    const hasBgp = !!(bgpRouterId || allBgpGroups.length > 0 || allBgpNeighbors.length > 0);

    // Collect all BGP peer IPs for subnet matching
    const allBgpPeerIps: string[] = [];
    allBgpGroups.forEach(g => g.neighbors.forEach(n => allBgpPeerIps.push(n.neighborIp)));
    allBgpNeighbors.forEach(n => allBgpPeerIps.push(n.neighborIp));

    // --- OSPF ---
    const allOspfAreas: { areaId: string; interfaces: { interfaceName: string; interfaceType?: string }[] }[] = [];
    vprnArray.forEach(v => {
        if (v.ospf && v.ospf.areas) {
            v.ospf.areas.forEach(a => {
                const existing = allOspfAreas.find(ea => ea.areaId === a.areaId);
                if (existing) {
                    a.interfaces.forEach(i => {
                        if (!existing.interfaces.find(ei => ei.interfaceName === i.interfaceName)) {
                            existing.interfaces.push(i);
                        }
                    });
                } else {
                    allOspfAreas.push({ areaId: a.areaId, interfaces: [...a.interfaces] });
                }
            });
        }
    });

    const hasOspf = allOspfAreas.length > 0;

    // Collect all OSPF interface names for matching
    const allOspfIfNames = new Set<string>();
    allOspfAreas.forEach(a => a.interfaces.forEach(i => allOspfIfNames.add(i.interfaceName)));

    // --- STATIC ---
    const allStaticRoutes: { prefix: string; nextHop: string }[] = [];
    vprnArray.forEach(v => {
        if (v.staticRoutes) {
            v.staticRoutes.forEach(r => {
                if (!allStaticRoutes.find(er => er.prefix === r.prefix && er.nextHop === r.nextHop)) {
                    allStaticRoutes.push(r);
                }
            });
        }
    });

    // Group static routes by next-hop
    const staticByNextHop = new Map<string, string[]>();
    allStaticRoutes.forEach(r => {
        if (!staticByNextHop.has(r.nextHop)) {
            staticByNextHop.set(r.nextHop, []);
        }
        staticByNextHop.get(r.nextHop)!.push(r.prefix);
    });

    const hasStatic = allStaticRoutes.length > 0;

    // ========== Build routing match map per interface ==========
    // Key: "hostIdx_ifIdx", Value: { bgpMatched, ospfMatched, staticNextHops[] }
    interface RoutingMatch {
        bgpMatched: boolean;
        ospfMatched: boolean;
        staticNextHops: string[];
    }

    const routingMatchMap = new Map<string, RoutingMatch>();

    vprnArray.forEach((currentVprn, idx) => {
        if (!currentVprn.interfaces) return;
        currentVprn.interfaces.forEach((iface, ifIdx) => {
            const key = `${idx}_${ifIdx}`;
            const match: RoutingMatch = { bgpMatched: false, ospfMatched: false, staticNextHops: [] };

            // BGP matching: peer IP in interface subnet
            if (hasBgp && iface.ipAddress) {
                for (const peerIp of allBgpPeerIps) {
                    if (isIpInSubnet(peerIp, iface.ipAddress)) {
                        match.bgpMatched = true;
                        break;
                    }
                }
            }

            // OSPF matching: OSPF area interface name matches L3 interface name
            if (hasOspf) {
                if (allOspfIfNames.has(iface.interfaceName)) {
                    match.ospfMatched = true;
                }
            }

            // STATIC matching: next-hop in interface subnet
            if (hasStatic && iface.ipAddress) {
                for (const nextHop of staticByNextHop.keys()) {
                    if (isIpInSubnet(nextHop, iface.ipAddress)) {
                        match.staticNextHops.push(nextHop);
                    }
                }
            }

            routingMatchMap.set(key, match);
        });
    });

    // ========== 왼쪽: Host 서브그래프 (Interface 중심) ==========
    vprnArray.forEach((currentVprn, idx) => {
        const host = hostnameArray[idx] || hostnameArray[0];
        const safeHost = sanitizeNodeId(host);
        const hostId = `HOST_${safeHost}_${idx}`;

        lines.push(`subgraph ${hostId} ["\u003cb\u003e${noWrap(host)}\u003c/b\u003e"]`);
        lines.push('direction TB');

        if (currentVprn.interfaces) {
            currentVprn.interfaces.forEach((iface, ifIdx) => {
                const ifId = `IF_${safeHost}_${idx}_${ifIdx}`;

                let label = `\u003cdiv style=\"text-align: left\"\u003e`;

                // Interface (최상위 헤더)
                label += `\u003cb\u003eInterface:\u003c/b\u003e ${noWrap(iface.interfaceName)}<br/>`;

                // Int Desc
                if (iface.description) {
                    label += `\u00A0\u00A0\u2011\u00A0Int\u00A0Desc:\u00A0${noWrap(iface.description)}<br/>`;
                }

                // IP
                if (iface.ipAddress) {
                    label += `\u00A0\u00A0\u2011\u00A0IP:\u00A0${iface.ipAddress}<br/>`;
                }

                // VRRP: priority >= 100 → MASTER, < 100 → BACKUP
                if (iface.vrrpBackupIp) {
                    const role = (iface.vrrpPriority !== undefined && iface.vrrpPriority >= 100) ? 'MASTER' : 'BACKUP';
                    label += `\u00A0\u00A0\u2011\u00A0VRRP:\u00A0${iface.vrrpBackupIp}\u00A0(${role})<br/>`;
                }

                // VPLS binding
                if (iface.vplsName) {
                    label += `\u00A0\u00A0\u2011\u00A0VPLS:\u00A0${noWrap(iface.vplsName)}<br/>`;
                }

                // SAP + QoS (하위 항목)
                if (iface.portId) {
                    label += `\u003cb\u003eSAP:\u003c/b\u003e ${iface.portId}<br/>`;
                    // In-QoS
                    const inRate = formatL3QosRate(iface, 'ingress');
                    if (inRate) {
                        label += `\u00A0\u00A0\u2011\u00A0In\u2011QoS:\u00A0${inRate}<br/>`;
                    }
                    // Out-QoS
                    const outRate = formatL3QosRate(iface, 'egress');
                    if (outRate) {
                        label += `\u00A0\u00A0\u2011\u00A0Out\u2011QoS:\u00A0${outRate}<br/>`;
                    }
                }

                // Port (sapId에서 ':' 이전 부분)
                if (iface.portId) {
                    const portOnly = iface.portId.split(':')[0];
                    label += `\u003cb\u003ePort:\u003c/b\u003e ${portOnly}<br/>`;
                }

                // Port Desc
                if (iface.portDescription) {
                    label += `\u003cb\u003ePort\u00A0Desc:\u003c/b\u003e ${noWrap(iface.portDescription)}<br/>`;
                }

                // IP-MTU
                if (iface.mtu) {
                    label += `\u003cb\u003eIP\u2011MTU:\u003c/b\u003e ${iface.mtu}<br/>`;
                }

                // Spoke-Sdp
                if (iface.spokeSdpId) {
                    label += `\u003cb\u003eSpoke\u2011Sdp:\u003c/b\u003e ${iface.spokeSdpId}<br/>`;
                }

                label += `\u003c/div\u003e`;
                lines.push(`${ifId}["${label}"]`);
            });
        }

        lines.push('end');
    });

    // ========== 중간: Routing Nodes ==========

    const bgpNodeId = `ROUTING_BGP_${firstVprn.serviceId}`;
    const ospfNodeId = `ROUTING_OSPF_${firstVprn.serviceId}`;

    // --- BGP Node ---
    if (hasBgp) {
        let bgpLabel = `\u003cdiv style=\"text-align: left\"\u003e`;
        bgpLabel += `\u003cb\u003eBGP:\u003c/b\u003e<br/>`;
        if (bgpRouterId) {
            bgpLabel += `\u00A0\u00A0\u2011\u00A0Router\u2011ID:\u00A0${bgpRouterId}<br/>`;
        }
        if (bgpSplitHorizon) {
            bgpLabel += `\u00A0\u00A0\u2011\u00A0Split\u2011Horizon:\u00A0On<br/>`;
        }
        if (allBgpGroups.length > 0) {
            allBgpGroups.forEach(g => {
                bgpLabel += `\u00A0\u00A0\u2011\u00A0GROUP:\u00A0${noWrap(g.groupName)}<br/>`;
                g.neighbors.forEach(n => {
                    const peerAs = n.peerAs || g.peerAs;
                    bgpLabel += `\u00A0\u00A0\u00A0\u00A0\u2011\u00A0Peer:\u00A0${n.neighborIp}<br/>`;
                    if (peerAs) {
                        bgpLabel += `\u00A0\u00A0\u00A0\u00A0\u2011\u00A0Peer\u2011AS:\u00A0${peerAs}<br/>`;
                    }
                });
            });
        } else if (allBgpNeighbors.length > 0) {
            allBgpNeighbors.forEach(n => {
                bgpLabel += `\u00A0\u00A0\u2011\u00A0Peer:\u00A0${n.neighborIp}`;
                if (n.autonomousSystem) bgpLabel += `\u00A0(AS\u00A0${n.autonomousSystem})`;
                bgpLabel += `<br/>`;
            });
        }
        bgpLabel += `\u003c/div\u003e`;
        lines.push(`${bgpNodeId}["${bgpLabel}"]`);
        lines.push(`class ${bgpNodeId} routing;`);
    }

    // --- OSPF Node ---
    if (hasOspf) {
        let ospfLabel = `\u003cdiv style=\"text-align: left\"\u003e`;
        ospfLabel += `\u003cb\u003eOSPF:\u003c/b\u003e<br/>`;
        allOspfAreas.forEach(a => {
            ospfLabel += `\u00A0\u00A0\u2011\u00A0AREA:\u00A0${a.areaId}<br/>`;
            if (a.interfaces.length > 0) {
                ospfLabel += `\u00A0\u00A0\u00A0\u00A0\u2011\u00A0Interface:<br/>`;
                a.interfaces.forEach(i => {
                    const typeStr = i.interfaceType ? `:\u00A0${i.interfaceType}` : '';
                    ospfLabel += `\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u2011\u00A0${noWrap(i.interfaceName)}${typeStr}<br/>`;
                });
            }
        });
        ospfLabel += `\u003c/div\u003e`;
        lines.push(`${ospfNodeId}["${ospfLabel}"]`);
        lines.push(`class ${ospfNodeId} routing;`);
    }

    // --- STATIC Nodes (one per next-hop) ---
    const staticNodeIds = new Map<string, string>(); // nextHop → nodeId
    if (hasStatic) {
        let staticCounter = 0;
        staticByNextHop.forEach((prefixes, nextHop) => {
            const nodeId = `ROUTING_STATIC_${firstVprn.serviceId}_${staticCounter}`;
            staticNodeIds.set(nextHop, nodeId);
            let staticLabel = `\u003cdiv style=\"text-align: left\"\u003e`;
            staticLabel += `\u003cb\u003eSTATIC:\u003c/b\u003e<br/>`;
            staticLabel += `Next\u2011Hop:\u00A0${nextHop}<br/>`;
            prefixes.forEach(p => {
                staticLabel += `\u00A0\u00A0\u2011\u00A0${p}<br/>`;
            });
            staticLabel += `\u003c/div\u003e`;
            lines.push(`${nodeId}["${staticLabel}"]`);
            lines.push(`class ${nodeId} routing;`);
            staticCounter++;
        });
    }

    // ========== 오른쪽: Service Node (BGP/OSPF/STATIC 제거) ==========
    let svcLabel = `\u003cdiv style=\"text-align: left\"\u003e`;

    // Service header
    if (firstVprn.serviceName) {
        svcLabel += `\u003cb\u003eService:\u003c/b\u003e ${noWrap(firstVprn.serviceName)}<br/>`;
    }
    svcLabel += `\u003cb\u003eVPRN:\u003c/b\u003e ${firstVprn.serviceId}<br/>`;
    if (firstVprn.description) {
        svcLabel += `\u003cb\u003eVPRN\u00A0Desc:\u003c/b\u003e ${noWrap(firstVprn.description)}<br/>`;
    }

    // ECMP
    if (firstVprn.ecmp) {
        svcLabel += `\u003cb\u003eECMP:\u003c/b\u003e ${firstVprn.ecmp}<br/>`;
    }

    // AS NO
    if (firstVprn.autonomousSystem) {
        svcLabel += `\u003cb\u003eAS\u00A0NO:\u003c/b\u003e ${firstVprn.autonomousSystem}<br/>`;
    }

    // RD
    if (firstVprn.routeDistinguisher) {
        svcLabel += `\u003cb\u003eRD:\u003c/b\u003e ${firstVprn.routeDistinguisher}<br/>`;
    }

    // VRF-TARGET
    if (firstVprn.vrfTarget) {
        svcLabel += `\u003cb\u003eVRF\u2011TARGET:\u003c/b\u003e ${noWrap(firstVprn.vrfTarget)}<br/>`;
    }

    svcLabel += `\u003c/div\u003e`;

    lines.push('');
    lines.push(`${serviceNodeId}["${svcLabel}"]`);
    lines.push(`class ${serviceNodeId} service;`);

    // ========== 연결선 ==========

    // Routing nodes → Service node
    if (hasBgp) {
        lines.push(`${bgpNodeId} --> ${serviceNodeId}`);
    }
    if (hasOspf) {
        lines.push(`${ospfNodeId} --> ${serviceNodeId}`);
    }
    staticNodeIds.forEach((nodeId) => {
        lines.push(`${nodeId} --> ${serviceNodeId}`);
    });

    // Interface → Routing nodes / Service node
    vprnArray.forEach((currentVprn, idx) => {
        if (!currentVprn.interfaces) return;
        const host = hostnameArray[idx] || hostnameArray[0];
        const safeHost = sanitizeNodeId(host);

        currentVprn.interfaces.forEach((_iface, ifIdx) => {
            const ifId = `IF_${safeHost}_${idx}_${ifIdx}`;
            const key = `${idx}_${ifIdx}`;
            const match = routingMatchMap.get(key);

            let hasAnyMatch = false;

            if (match) {
                if (match.bgpMatched && hasBgp) {
                    lines.push(`${ifId} --> ${bgpNodeId}`);
                    hasAnyMatch = true;
                }
                if (match.ospfMatched && hasOspf) {
                    lines.push(`${ifId} --> ${ospfNodeId}`);
                    hasAnyMatch = true;
                }
                if (match.staticNextHops.length > 0) {
                    match.staticNextHops.forEach(nh => {
                        const staticNodeId = staticNodeIds.get(nh);
                        if (staticNodeId) {
                            lines.push(`${ifId} --> ${staticNodeId}`);
                            hasAnyMatch = true;
                        }
                    });
                }
            }

            // 매칭 없으면 서비스 노드에 직접 연결
            if (!hasAnyMatch) {
                lines.push(`${ifId} --> ${serviceNodeId}`);
            }
        });
    });

    return lines.join('\n');
}


export function generateServiceDiagram(
    service: NokiaServiceV3 | NokiaServiceV3[],
    hostname: string | string[],
    sdps: SDP[] = [], // Parent Config's SDPs
    remoteDeviceMap?: Map<string, string> // System IP -> Hostname map
): string {
    // 배열로 정규화
    const serviceArray = Array.isArray(service) ? service : [service];
    const firstService = serviceArray[0];

    if (firstService.serviceType === 'epipe') {
        const epipes = serviceArray.filter(s => s.serviceType === 'epipe') as EpipeService[];
        return generateEpipeDiagram(
            epipes.length === 1 ? epipes[0] : epipes,
            hostname,
            sdps,
            remoteDeviceMap
        );
    } else if (firstService.serviceType === 'vpls') {
        const vplsServices = serviceArray.filter(s => s.serviceType === 'vpls') as VPLSService[];
        return generateVPLSDiagram(
            vplsServices.length === 1 ? vplsServices[0] : vplsServices,
            hostname,
            sdps,
            remoteDeviceMap
        );
    } else if (firstService.serviceType === 'vprn') {
        const vprnServices = serviceArray.filter(s => s.serviceType === 'vprn') as VPRNService[];
        return generateVPRNDiagram(
            vprnServices.length === 1 ? vprnServices[0] : vprnServices,
            hostname
        );
    } else if (firstService.serviceType === 'ies') {
        const iesServices = serviceArray.filter(s => s.serviceType === 'ies') as unknown as VPRNService[];
        return generateVPRNDiagram(
            iesServices.length === 1 ? iesServices[0] : iesServices,
            hostname
        );
    }

    return '';
}

/**
 * 여러 서비스의 다이어그램 생성
 */
export function generateMultipleServiceDiagrams(
    services: NokiaServiceV3[],
    hostname: string
): Array<{ serviceId: number; serviceType: string; diagram: string; description: string }> {
    return services.map(service => ({
        serviceId: service.serviceId,
        serviceType: service.serviceType,
        diagram: generateServiceDiagram(service, hostname),
        description: service.description,
    }));
}

/**
 * 전체 L2 VPN 토폴로지 다이어그램 생성 (모든 서비스 통합)
 */
export function generateFullL2VPNTopology(
    config: ParsedConfigV3
): string {
    const lines: string[] = [];

    lines.push('graph TB');
    lines.push('');

    // 라우터 노드
    const routerId = `ROUTER_${sanitizeNodeId(config.hostname)}`;
    lines.push(`${routerId}["🖥️ ${config.hostname}<br/>System IP: ${config.systemIp}"]`);

    // 각 서비스 표시
    config.services.forEach(service => {
        const serviceId = `SERVICE_${service.serviceId}`;
        const serviceLabel = `${service.serviceType.toUpperCase()} ${service.serviceId}<br/>${service.description}`;

        if (service.serviceType === 'epipe') {
            lines.push(`${serviceId}{{"🔗 ${serviceLabel}"}}`);
        } else if (service.serviceType === 'vpls') {
            lines.push(`${serviceId}{{"🌐 ${serviceLabel}"}}`);
        }

        lines.push(`${routerId} --> ${serviceId}`);
    });

    // 스타일
    lines.push('');
    lines.push(`style ${routerId} fill:#e3f2fd,stroke:#1565c0,stroke-width:3px`);

    return lines.join('\n');
}
