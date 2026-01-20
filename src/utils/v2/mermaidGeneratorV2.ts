import type { EpipeService, VPLSService, VPRNService, L2VPNService, ParsedL2VPNConfig, SDP } from '../../types/v2';

/**
 * Mermaid 노드 ID 생성 (특수문자 제거)
 */
/**
 * Mermaid 노드 ID 생성 (특수문자 제거)
 */
function sanitizeNodeId(id: string): string {
    // Replace all non-alphanumeric characters (except underscore and hyphen) with underscore
    // This prevents Mermaid syntax errors when Hostnames contain (), ., etc.
    return id.replace(/[^a-zA-Z0-9_-]/g, '_');
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

// Helper: Format descriptions (from V1)
const fmtDesc = (desc?: string): string => {
    if (!desc) return '';
    return `<br/>(${noWrap(desc)})`;
};


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

    const lines: string[] = [];

    lines.push('graph LR');

    // Define clean styles
    lines.push('classDef default fill:#ffffff,stroke:#333,stroke-width:2px,color:#000,text-align:left;');
    lines.push('classDef service fill:#e3f2fd,stroke:#1976d2,stroke-width:3px,color:#000;');

    lines.push('');

    // 왼쪽: 각 호스트별 서브그래프
    const firstEpipe = epipeArray[0];
    const serviceNodeId = `SERVICE_${firstEpipe.serviceId}`;

    epipeArray.forEach((epipe, idx) => {
        const host = hostnameArray[idx] || hostnameArray[0];
        const safeHost = sanitizeNodeId(host);
        const hostId = `HOST_${safeHost}_${idx}`;

        // Host Subgraph
        lines.push(`subgraph ${hostId} ["\u003cb\u003e${noWrap(host)}\u003c/b\u003e"]`);
        lines.push('direction TB'); // 세로 배치

        epipe.saps.forEach((sap, sapIdx) => {
            const sapNodeId = `SAP_${safeHost}_${idx}_${sapIdx}`;

            let label = `\u003cdiv style=\"text-align: left\"\u003e`;
            label += `\u003cb\u003eSAP:\u003c/b\u003e ${sap.sapId}<br/>`;
            label += `\u003cb\u003ePort:\u003c/b\u003e ${sap.portId}${fmtDesc(sap.portDescription)}<br/>`;
            label += `\u003cb\u003eVLAN:\u003c/b\u003e ${sap.vlanId}<br/>`;

            // SDP 정보 (SAP 박스 안에 포함)
            if (epipe.spokeSdps && epipe.spokeSdps.length > 0) {
                // Epipe는 보통 1개의 Active SDP를 가짐, 모두 표시
                epipe.spokeSdps.forEach(sdp => {
                    label += `\u003cb\u003eSDP:\u003c/b\u003e ${sdp.sdpId}:${sdp.vcId}<br/>`;
                });
            }

            label += `\u003c/div\u003e`;
            lines.push(`${sapNodeId}[\"${label}\"]`);
        });

        lines.push('end'); // End Host Subgraph
    });

    // 오른쪽: 서비스 정보 노드
    lines.push('');
    let serviceLabel = `\u003cdiv style=\"text-align: left\"\u003e`;
    serviceLabel += `\u003cb\u003eService:\u003c/b\u003e EPIPE ${firstEpipe.serviceId}<br/>`;

    // 괄호 안에 Service Name 표시 (사용자 샘플 참조: (SKENS_Pangyo_DDC_1G_1))
    // 샘플에는 Service Name이 괄호 안에 있고, 그 아래에 EPIPE Name: ... 이 있음. 중복될 수 있음.
    // 기존 VPLS 로직: Service: ID <br> Name: ... <br> Description: ...
    // 사용자 샘플: Service: EPIPE 7 <br> (Name) <br> EPIPE Name: Name <br> Description: ...
    // VPLS와 통일성을 위해:
    // Service: EPIPE <ID>
    // EPIPE Name: <Name>
    // EPIPE Description: <Description>

    if (firstEpipe.serviceName) {
        serviceLabel += `\u003cb\u003eEPIPE Name:\u003c/b\u003e ${noWrap(firstEpipe.serviceName)}<br/>`;
    }
    if (firstEpipe.description) {
        serviceLabel += `\u003cb\u003eEPIPE Description:\u003c/b\u003e ${firstEpipe.description}<br/>`;
    }
    serviceLabel += `\u003c/div\u003e`;

    lines.push(`${serviceNodeId}[\"${serviceLabel}\"]`);
    lines.push(`class ${serviceNodeId} service;`);

    // 연결선: SAP -> Service (QoS 포함)
    epipeArray.forEach((epipe, idx) => {
        const host = hostnameArray[idx] || hostnameArray[0];
        const safeHost = sanitizeNodeId(host);

        epipe.saps.forEach((sap, sapIdx) => {
            const sapNodeId = `SAP_${safeHost}_${idx}_${sapIdx}`;

            let qosLabel = '';
            // Ingress QoS
            if (sap.ingressQos?.policyId) {
                qosLabel += `In-QoS: ${sap.ingressQos.policyId}`;
            }
            // Egress QoS (Merged Diagram에서는 usually bidirectional implicaiton, but here link is SAP->Service)
            // 사용자 요청: "QoS 정보는 연결선에 넣기" (Epipe 샘플 이미지에는 In-QoS만 보임)
            // VPLS에서는 In-QoS만 표시했음.
            // Epipe 연결선은 양방향을 의미하므로 In/Out 둘 다 표시하는 게 좋을 수 있음.
            // 하지만 공간 제약 상 In-QoS 우선 표시, 필요시 Out-QoS 추가.
            // 사용자 샘플 텍스트에는 명시 안됨. 이미지에는 In-QoS: 400 등.

            if (sap.egressQos?.policyId) {
                if (qosLabel) qosLabel += '<br/>';
                qosLabel += `Out-QoS: ${sap.egressQos.policyId}`; // Out-QoS도 표시
            }

            if (qosLabel) {
                lines.push(`${sapNodeId} ---|\"${qosLabel}\"| ${serviceNodeId}`);
            } else {
                lines.push(`${sapNodeId} --- ${serviceNodeId}`);
            }
        });
    });

    return lines.join('\n');

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

    // Define clean styles
    lines.push('classDef default fill:#ffffff,stroke:#333,stroke-width:2px,color:#000,text-align:left;');
    lines.push('classDef vpls fill:#e3f2fd,stroke:#1976d2,stroke-width:3px,color:#000;');

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
            sapLabel += `<b>Port:</b> ${sap.portId}${fmtDesc(sap.portDescription)}<br/>`;
            sapLabel += `<b>VLAN:</b> ${sap.vlanId}<br/>`;

            // 해당 SAP의 SDP 정보 (첫 번째 SAP에만 표시)
            if (sapIdx === 0) {
                if (currentVpls.spokeSdps && currentVpls.spokeSdps.length > 0) {
                    currentVpls.spokeSdps.forEach(sdp => {
                        sapLabel += `<b>Spoke SDP:</b> ${sdp.sdpId}:${sdp.vcId}<br/>`;
                    });
                }
                if (currentVpls.meshSdps && currentVpls.meshSdps.length > 0) {
                    currentVpls.meshSdps.forEach(sdp => {
                        sapLabel += `<b>Mesh SDP:</b> ${sdp.sdpId}:${sdp.vcId}<br/>`;
                    });
                }
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
        vplsLabel += `<b>VPLS Description:</b> ${firstVpls.description}<br/>`;
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

            // QoS 라벨 생성
            let linkLabel = '';
            if (sap.ingressQos?.policyId) {
                linkLabel = `In-QoS: ${sap.ingressQos.policyId}`;
            }

            if (linkLabel) {
                lines.push(`${sapNodeId} ---|"${linkLabel}"| ${vplsNodeId}`);
            } else {
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

    if (firstVprn.autonomousSystem) {
        vprnLabel += `<b>AS:</b> ${firstVprn.autonomousSystem}<br/>`;
    }
    if (firstVprn.routeDistinguisher) {
        vprnLabel += `<b>RD:</b> ${firstVprn.routeDistinguisher}<br/>`;
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
        if (currentVprn.bgpNeighbors && currentVprn.bgpNeighbors.length > 0) {
            const bgpId = `BGP_${safeHost}_${idx}`;

            let bgpLabel = `<div style="text-align: left"><b>BGP</b><br/>`;
            if (currentVprn.bgpRouterId) bgpLabel += `Router-ID: ${currentVprn.bgpRouterId}<br/>`;

            currentVprn.bgpNeighbors.forEach(nbr => {
                bgpLabel += `Neighbor: ${nbr.neighborIp}<br/>`;
                if (nbr.autonomousSystem) bgpLabel += `- AS: ${nbr.autonomousSystem}<br/>`;
            });
            bgpLabel += `</div>`;

            lines.push(`${bgpId}["${bgpLabel}"]`);
            lines.push(`class ${bgpId} bgp;`);
        }

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
        // Interfaces
        if (currentVprn.interfaces) {
            currentVprn.interfaces.forEach((_, ifIdx) => {
                const ifId = `IF_${safeHost}_${idx}_${ifIdx}`;
                lines.push(`${ifId} --> ${serviceNodeId}`);
            });
        }
        // BGP (Invisible or Dotted link to ensure layout if no interfaces)
        if (currentVprn.bgpNeighbors && currentVprn.bgpNeighbors.length > 0) {
            const bgpId = `BGP_${safeHost}_${idx}`;
            lines.push(`${bgpId} -.- ${serviceNodeId}`);
        }
    });

    // 서비스 노드 추가 (오른쪽)
    lines.push('');
    lines.push(`${serviceNodeId}["${vprnLabel}"]`);
    lines.push(`class ${serviceNodeId} service;`);



    return lines.join('\n');
}


export function generateServiceDiagram(
    service: L2VPNService | L2VPNService[],
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
    }

    return '';
}

/**
 * 여러 서비스의 다이어그램 생성
 */
export function generateMultipleServiceDiagrams(
    services: L2VPNService[],
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
    config: ParsedL2VPNConfig
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
