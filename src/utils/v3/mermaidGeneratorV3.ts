import type { EpipeService, VPLSService, VPRNService, SDP } from '../../types/v2';
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

// Helper: IP Logic
function ipToLong(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function isIpInSubnet(ip: string, cidr: string): boolean {
    if (!ip || !cidr || !cidr.includes('/')) return false;
    try {
        const [rangeIp, prefixStr] = cidr.split('/');
        const prefix = parseInt(prefixStr, 10);
        const mask = prefix === 0 ? 0 : (~((1 << (32 - prefix)) - 1)) >>> 0; // Fix standard bitwise issue
        // However JS bitwise operations are 32-bit signed. 
        // Using >>> 0 ensures unsigned.
        const ipLong = ipToLong(ip);
        const rangeIpLong = ipToLong(rangeIp);
        return (ipLong & mask) === (rangeIpLong & mask);
    } catch (e) {
        return false;
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
    // 배열로 정규화
    const epipeArray = Array.isArray(epipes) ? epipes : [epipes];
    const hostnameArray = Array.isArray(hostname) ? hostname : [hostname];

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
    lines.push('classDef qos fill:#4caf50,stroke:#2e7d32,stroke-width:2px,color:#fff,text-align:center,padding:5px;');
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
                label += `\u003cb\u003eSAP:\u003c/b\u003e ${sap.sapId}<br/>`;
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

        // Links with QoS as intermediate nodes
        subsetEpipes.forEach((epipe, idx) => {
            const host = subsetHosts[idx];
            const safeHost = sanitizeNodeId(host);
            epipe.saps.forEach((sap, sapIdx) => {
                const sapNodeId = `SAP_${safeHost}_G${groupCounter}_${idx}_${sapIdx}`;

                // QoS - Always show both In/Out with Default fallback
                const inQos = sap.ingressQos?.policyId ?? 'Default';
                const outQos = sap.egressQos?.policyId ?? 'Default';
                const qosLabelContent = `In\u2011QoS: ${inQos}<br/>Out\u2011QoS: ${outQos}`;
                const qosLabel = `<div class='qos-label'>${qosLabelContent}</div>`;
                lines.push(`${sapNodeId} -->|"${qosLabel}"| ${svcNodeId}`);
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
 */
export function generateVPLSDiagram(
    vpls: VPLSService | VPLSService[],
    hostname: string | string[],
    _sdps: SDP[] = [],
    _remoteDeviceMap?: Map<string, string>
): string {
    // 배열로 정규화
    const vplsArray = Array.isArray(vpls) ? vpls : [vpls];
    const hostnameArray = Array.isArray(hostname) ? hostname : [hostname];

    const lines: string[] = [];

    lines.push('graph LR');

    // Define clean styles (matching EPIPE)
    lines.push('classDef default fill:#ffffff,stroke:#333,stroke-width:2px,color:#000,text-align:left;');
    lines.push('classDef vpls fill:#e3f2fd,stroke:#1976d2,stroke-width:3px,color:#000;');
    lines.push('classDef qos fill:#4caf50,stroke:#2e7d32,stroke-width:2px,color:#fff,padding:5px,border-radius:5px;');

    lines.push('');

    // 왼쪽: 각 호스트별 서브그래프 (각 SAP를 개별 박스로 표시)
    const firstVpls = vplsArray[0];
    const vplsNodeId = `VPLS_${firstVpls.serviceId}`;

    vplsArray.forEach((currentVpls, vplsIdx) => {
        const currentHostname = hostnameArray[vplsIdx] || hostnameArray[0];
        const safeHost = sanitizeNodeId(currentHostname);
        const hostId = `HOST_${safeHost}_${vplsIdx}`;

        // 호스트 서브그래프 시작
        lines.push(`subgraph ${hostId}["<b>${noWrap(currentHostname)}</b>"]`);
        lines.push('direction TB');  // 세로 방향

        // 각 SAP를 개별 노드로 생성
        currentVpls.saps.forEach((sap, sapIdx) => {
            const sapNodeId = `SAP_${safeHost}_${vplsIdx}_${sapIdx}`;

            let sapLabel = `<div style="text-align: left">`;
            sapLabel += `<b>SAP:</b> ${sap.sapId}<br/>`;
            if (sap.description) {
                sapLabel += `<b>SAP Desc:</b> ${noWrap(sap.description)}<br/>`;
            }
            sapLabel += `<b>Port:</b> ${sap.portId}<br/>`;
            if (sap.portDescription) {
                sapLabel += `<b>Port Desc:</b> ${noWrap(sap.portDescription)}<br/>`;
            }
            sapLabel += `<b>VLAN:</b> ${sap.vlanId}<br/>`;
            if (sap.portEthernet) {
                const pe = sap.portEthernet;
                if (pe.mode || pe.encapType) {
                    sapLabel += `<b>Ethernet:</b> ${pe.mode || ''}${pe.encapType ? ` / encap\u2011type: ${pe.encapType}` : ''}<br/>`;
                }
                if (pe.mtu) {
                    sapLabel += `<b>Port\u00A0MTU:</b> ${pe.mtu}<br/>`;
                }
            }
            if (sap.llf) {
                sapLabel += `<b>LLF:</b> Enabled<br/>`;
            }
            sapLabel += `</div>`;

            lines.push(`${sapNodeId}["${sapLabel}"]`);
        });

        lines.push('end');  // 서브그래프 종료
    });

    // 오른쪽: 공통 VPLS 서비스 정보 (호스트 이후에 선언)
    lines.push('');
    let vplsLabel = `<div style="text-align: left">`;
    vplsLabel += `<b>Service:</b> VPLS ${firstVpls.serviceId}<br/>`;
    if (firstVpls.serviceName) {
        vplsLabel += `<b>VPLS Name:</b> ${noWrap(firstVpls.serviceName)}<br/>`;
    }
    if (firstVpls.description) {
        vplsLabel += `<b>VPLS Desc:</b> ${noWrap(firstVpls.description)}<br/>`;
    }
    if (firstVpls.macMoveShutdown) {
        vplsLabel += `<b>MAC\u2011MOVE:</b> Detected<br/>`;
    }
    vplsLabel += `</div>`;

    lines.push(`${vplsNodeId}["${vplsLabel}"]`);
    lines.push(`class ${vplsNodeId} vpls;`);

    // 연결선: 각 SAP에서 VPLS로 (QoS 정보 포함)
    vplsArray.forEach((currentVpls, vplsIdx) => {
        const currentHostname = hostnameArray[vplsIdx] || hostnameArray[0];
        const safeHost = sanitizeNodeId(currentHostname);

        currentVpls.saps.forEach((sap, sapIdx) => {
            const sapNodeId = `SAP_${safeHost}_${vplsIdx}_${sapIdx}`;

            // QoS 정보 수집
            const qosParts: string[] = [];
            if (sap.ingressQos?.policyId) {
                qosParts.push(`In-QoS: ${sap.ingressQos.policyId}`);
            }
            if (sap.egressQos?.policyId) {
                qosParts.push(`Out-QoS: ${sap.egressQos.policyId}`);
            }

            if (qosParts.length > 0) {
                // V1 Style: QoS as link label (more compact)
                const qosLabelContent = qosParts.join('<br/>');
                const qosLabel = `<div class='qos-label'>${qosLabelContent}</div>`;
                lines.push(`${sapNodeId} -->|"${qosLabel}"| ${vplsNodeId}`);
            } else {
                // No QoS: direct connection
                lines.push(`${sapNodeId} --- ${vplsNodeId}`);
            }
        });
    });

    return lines.join('\n');
}

/**
 * VPRN 서비스 다이어그램 생성
 */
export function generateVPRNDiagram(
    vprn: VPRNService | VPRNService[],
    hostname: string | string[]
): string {
    // 배열로 정규화  
    const vprnArray = Array.isArray(vprn) ? vprn : [vprn];
    const hostnameArray = Array.isArray(hostname) ? hostname : [hostname];

    const lines: string[] = [];

    lines.push('graph LR');

    // Define clean styles
    lines.push('classDef default fill:#ffffff,stroke:#333,stroke-width:2px,color:#000,text-align:left;');
    lines.push('classDef service fill:#e8eaf6,stroke:#1a237e,stroke-width:2px,color:#000;');
    lines.push('classDef iface fill:#fff3e0,stroke:#e65100,stroke-width:1px;');
    lines.push('classDef bgp fill:#e1f5fe,stroke:#0277bd,stroke-width:1px;');
    lines.push('classDef route fill:#f3e5f5,stroke:#7b1fa2,stroke-width:1px;');
    lines.push('classDef redBox fill:#ffffff,stroke:#ff0000,stroke-width:2px,color:#ff0000;');
    lines.push('classDef qos fill:#4caf50,stroke:#2e7d32,stroke-width:2px,color:#fff,text-align:center,padding:5px;');

    lines.push('');

    // 오른쪽: 공통 VPRN 서비스 노드
    const firstVprn = vprnArray[0];
    const serviceNodeId = `VPRN_SERVICE_${firstVprn.serviceId}`;

    let vprnLabel = `<div style="text-align: left">`;
    vprnLabel += `<b>Service:</b> VPRN ${firstVprn.serviceId}<br/>`;

    // Service Name & Description
    if (firstVprn.serviceName) {
        vprnLabel += `<b>VPRN Service Name:</b> ${noWrap(firstVprn.serviceName)}<br/>`;
    }
    if (firstVprn.description) {
        // 사용자 요청: VPRN Desc: ...
        vprnLabel += `<b>VPRN Desc:</b> ${firstVprn.description}<br/>`;
    }


    if (firstVprn.vrfTarget) {
        vprnLabel += `<b>VRF:</b> ${firstVprn.vrfTarget}<br/>`;
    }

    vprnLabel += `<b>Customer:</b> ${firstVprn.customerId}`;
    vprnLabel += `</div>`;

    // 서브그래프들 먼저 그리기 (왼쪽)
    vprnArray.forEach((currentVprn, idx) => {
        const host = hostnameArray[idx] || hostnameArray[0];
        const safeHost = sanitizeNodeId(host);

        const hostId = `HOST_${safeHost}_${idx}`;

        lines.push(`subgraph ${hostId} ["<b>${noWrap(host)}</b>"]`);
        lines.push('direction TB');

        // Pre-process Static Routes
        const routesMap = new Map<string, string[]>();
        if (currentVprn.staticRoutes) {
            currentVprn.staticRoutes.forEach(r => {
                const nh = r.nextHop || 'Unknown';
                if (!routesMap.has(nh)) routesMap.set(nh, []);
                routesMap.get(nh)!.push(r.prefix);
            });
        }

        // 1. Interfaces
        if (currentVprn.interfaces) {
            currentVprn.interfaces.forEach((iface, ifIdx) => {
                const ifId = `IF_${safeHost}_${idx}_${ifIdx}`;
                const ifName = iface.interfaceName;

                let details = `<div style="text-align: left">`;
                details += `<b>Interface:</b> ${ifName}<br/>`;
                if (iface.description) details += `Desc: ${iface.description}<br/>`;

                let staticRoutesHtml = '';

                if (iface.ipAddress) {
                    details += `IP: ${iface.ipAddress}`;
                    // VRRP Info: Group ID hidden per user request
                    details += `<br/>`;

                    // MERGE CHECK: Static Routes
                    // Prepare HTML but append LATER
                    const matchedNextHops: string[] = [];
                    routesMap.forEach((_, nextHop) => {
                        if (isIpInSubnet(nextHop, iface.ipAddress!)) {
                            matchedNextHops.push(nextHop);
                        }
                    });

                    if (matchedNextHops.length > 0) {
                        staticRoutesHtml += `<hr/>`; // Separator
                        matchedNextHops.forEach(nh => {
                            const prefixes = routesMap.get(nh)!;
                            staticRoutesHtml += `<b>Static Route:</b> ${nh}<br/>`;
                            staticRoutesHtml += `Customer Network: ${prefixes.length}<br/>`;
                            prefixes.forEach(p => staticRoutesHtml += `${p}<br/>`);
                            // staticRoutesHtml += `<br/>`; 
                            routesMap.delete(nh); // Mark as handled
                        });
                    }
                }

                if (iface.vrrpBackupIp) details += `(VIP: ${iface.vrrpBackupIp})<br/>`;
                if (iface.portId) details += `SAP: ${iface.portId}<br/>`;
                if (iface.portDescription) details += `Port Desc: ${iface.portDescription}<br/>`;
                if (iface.portEthernet) {
                    const pe = iface.portEthernet;
                    if (pe.mode || pe.encapType) {
                        details += `Ethernet: ${pe.mode || ''}${pe.encapType ? ` / encap\u2011type: ${pe.encapType}` : ''}<br/>`;
                    }
                    if (pe.mtu) {
                        details += `Port\u00A0MTU: ${pe.mtu}<br/>`;
                    }
                }
                if (iface.vplsName) details += `VPLS: ${iface.vplsName}<br/>`;
                if (iface.spokeSdpId) details += `SPOKE-SDP: ${iface.spokeSdpId}<br/>`;
                if (iface.mtu) details += `MTU: ${iface.mtu}`;

                // Append Static Routes LAST
                if (staticRoutesHtml) {
                    details += staticRoutesHtml;
                }

                details += `</div>`;

                lines.push(`${ifId}["${details}"]`);
                lines.push(`class ${ifId} iface;`);
            });
        }

        // 2. BGP Neighbors


        // 3. Remaining Static Routes (Orphans)
        const orphanRoutes: string[] = [];
        if (routesMap.size > 0) {
            let routeIdx = 0;
            routesMap.forEach((prefixes, nextHop) => {
                const routeId = `ROUTES_${safeHost}_${idx}_${routeIdx++}`;
                let routeLabel = `<div style="text-align: left">`;
                routeLabel += `<b>Static Route:</b> ${nextHop}<br/>`;
                routeLabel += `Customer Network: ${prefixes.length}<br/>`;

                prefixes.forEach(p => {
                    routeLabel += `${p}<br/>`;
                });
                routeLabel += `</div>`;

                lines.push(`${routeId}["${routeLabel}"]`);
                lines.push(`class ${routeId} route;`);

                // Collect ID for linking outside subgraph
                orphanRoutes.push(routeId);
            });
        }

        lines.push('end'); // End Host

        // Orphan Static Route Connections (Outside Subgraph)
        orphanRoutes.forEach(rId => {
            lines.push(`${rId} -.- ${serviceNodeId}`);
        });

        // 연결선 추가 (서브그래프 밖에서 처리)
        // Interfaces with QoS labels
        if (currentVprn.interfaces) {
            currentVprn.interfaces.forEach((iface, ifIdx) => {
                const ifId = `IF_${safeHost}_${idx}_${ifIdx}`;
                const qosParts: string[] = [];
                if (iface.ingressQosId) qosParts.push(`In\u2011QoS: ${iface.ingressQosId}`);
                if (iface.egressQosId) qosParts.push(`Out\u2011QoS: ${iface.egressQosId}`);

                if (qosParts.length > 0) {
                    const qosLabelContent = qosParts.join('<br/>');
                    const qosLabel = `<div class='qos-label'>${qosLabelContent}</div>`;
                    lines.push(`${ifId} -->|"${qosLabel}"| ${serviceNodeId}`);
                } else {
                    lines.push(`${ifId} --> ${serviceNodeId}`);
                }
            });
        }
        // BGP (Invisible or Dotted link to ensure layout if no interfaces)
    });

    // Aggregate BGP and OSPF info for the Service Node
    // We'll take unique BGP router-ids and neighbors, and OSPF areas.
    // For simplicity, considering visualization focus, we iterate all and append if not empty?
    // User request implies one block for BGP, one for OSPF.
    // If multiple hosts have diff configs, we might need multiple blocks or merged list.
    // Let's assume single view or append all found configurations.

    const allBgpNeighbors: { neighborIp: string; autonomousSystem?: number }[] = [];
    const allOspfAreas: { areaId: string; interfaces: any[] }[] = []; // Reuse logic
    let bgpRouterId = '';

    vprnArray.forEach(v => {
        if (v.bgpRouterId && !bgpRouterId) bgpRouterId = v.bgpRouterId; // Take first for now
        if (v.bgpNeighbors) allBgpNeighbors.push(...v.bgpNeighbors);
        if (v.ospf && v.ospf.areas) {
            v.ospf.areas.forEach(a => {
                // Check if area already exists? OSPF structure is complex to merge visually.
                // Let's just push for now, duplicate areas visually might be ok if different hosts
                // But better to merge by Area ID?
                const existing = allOspfAreas.find(ea => ea.areaId === a.areaId);
                if (existing) {
                    existing.interfaces.push(...a.interfaces);
                } else {
                    // Clone to avoid mutation issues if deep copy needed?
                    allOspfAreas.push({ areaId: a.areaId, interfaces: [...a.interfaces] });
                }
            });
        }
    });

    let bpgHtml = '';

    // User requested AS/RD only in BGP section. Show BGP box if any BGP info exists (AS, RD, RouterID, Neighbors)
    if (firstVprn.autonomousSystem || firstVprn.routeDistinguisher || bgpRouterId || allBgpNeighbors.length > 0) {

        bpgHtml += `<div style="border: 2px solid #ff0000; padding: 5px; margin-top: 5px; text-align: left;">`;
        bpgHtml += `<b>BGP:</b><br/>`;
        if (firstVprn.autonomousSystem) bpgHtml += `AS: ${firstVprn.autonomousSystem}<br/>`;
        if (firstVprn.routeDistinguisher) bpgHtml += `RD: ${firstVprn.routeDistinguisher}<br/>`;
        if (bgpRouterId) bpgHtml += `Router-id: ${bgpRouterId}<br/>`;
        if (allBgpNeighbors.length > 0) {
            bpgHtml += `Neighbor<br/>`;
            allBgpNeighbors.forEach(n => {
                bpgHtml += `- ${n.neighborIp}`;
                if (n.autonomousSystem) bpgHtml += `(AS ${n.autonomousSystem})`;
                bpgHtml += `<br/>`;
            });
        }
        bpgHtml += `</div>`;
    }

    let ospfHtml = '';
    if (allOspfAreas.length > 0) {
        ospfHtml += `<div style="border: 2px solid #ff0000; padding: 5px; margin-top: 5px; text-align: left;">`;
        ospfHtml += `<b>OSPF:</b><br/>`;
        allOspfAreas.forEach(a => {
            ospfHtml += `Area ${a.areaId}<br/>`;
            a.interfaces.forEach(i => {
                ospfHtml += `- int: ${i.interfaceName}`;
                // Simplified type display as per user request example? "- int: ..."
                // User example: "- int: p3/2/23"
                // If types exist, maybe useful? User example didn't show type explicitly, just "- int: ..."
                // Let's keep it simple or match user? User provided "- int: p3/2/23". 
                // My previous code added type. I'll include type if present but maybe less verbose.
                // User example: "- int: TO-..."
                ospfHtml += `<br/>`;
            });
        });
        ospfHtml += `</div>`;
    }

    vprnLabel += bpgHtml + ospfHtml;

    // 서비스 노드 추가 (오른쪽)
    lines.push('');
    lines.push(`${serviceNodeId}["${vprnLabel}"]`);
    lines.push(`class ${serviceNodeId} service;`);



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
