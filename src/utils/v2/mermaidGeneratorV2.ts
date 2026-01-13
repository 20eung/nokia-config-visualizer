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

// Helper: Format descriptions (from V1)
const fmtDesc = (desc?: string): string => {
    if (!desc) return '';
    return `<br/>(${noWrap(desc)})`;
};


/**
 * Epipe 서비스 다이어그램 생성
 */
export function generateEpipeDiagram(
    epipe: EpipeService,
    hostname: string,
    sdps: SDP[] = [],
    remoteDeviceMap?: Map<string, string>
): string {
    const lines: string[] = [];

    lines.push('graph LR');

    // Define clean styles (V1 style)
    lines.push('classDef default fill:#ffffff,stroke:#333,stroke-width:2px,color:#000,text-align:left;');
    lines.push('classDef remote fill:#e6f3ff,stroke:#0066cc,stroke-width:2px,color:#000;');

    lines.push('');

    // Hostname Subgraph
    const safeHost = sanitizeNodeId(hostname);
    const hostId = `HOST_${safeHost}`;
    lines.push(`subgraph ${hostId} ["<b>${noWrap(hostname)}</b>"]`);
    lines.push('direction LR');

    // Build Single Detailed Node for Local Side (V1 Style)
    const localNodes: string[] = [];

    epipe.saps.forEach((sap, idx) => {
        // Unique Node ID per diagram (Host + Service + Index)
        const sapNodeId = `LOC_${safeHost}_${epipe.serviceId}_${idx}`;
        localNodes.push(sapNodeId);

        let label = `<div style="text-align: left">`;
        label += `<b>Service:</b> EPIPE ${epipe.serviceId}${fmtDesc(epipe.description)}<br/>`;
        if (epipe.serviceName) {
            label += `<b>Name:</b> ${noWrap(epipe.serviceName)}<br/>`;
        }
        label += `<br/>`;

        // Port Description
        // Using SAP description if Port description is not distinct, but now we have portDescription.

        label += `<b>Port:</b> ${sap.portId}${fmtDesc(sap.portDescription)}`;
        label += `<br/>`;

        label += `<b>VLAN:</b> ${sap.vlanId}<br/>`;

        label += `<b>SAP:</b> ${sap.sapId}${fmtDesc(sap.description)}<br/>`;
        label += `</div>`;

        lines.push(`${sapNodeId}["${label}"]`);
    });

    lines.push('end'); // End Host Subgraph

    // Remote / SDP Connection
    if (epipe.spokeSdps) {
        epipe.spokeSdps.forEach((sdp, idx) => {
            const sdpId = `REM_${safeHost}_${idx}`; // Using distinct ID

            // Resolve Remote Hostname
            let farEnd: string | undefined;
            if (sdps && sdps.length > 0) {
                const sdpDef = sdps.find(s => s.sdpId === sdp.sdpId);
                if (sdpDef) farEnd = sdpDef.farEnd;
            }

            // Remote / SDP Connection logic
            // Simplified: Use a single Node for the Remote End instead of a Subgraph to prevent layout overlapping issues.
            let remoteTitle = 'Remote Device';
            if (remoteDeviceMap && farEnd && remoteDeviceMap.has(farEnd)) {
                remoteTitle = remoteDeviceMap.get(farEnd)!;
            } else if (farEnd) {
                remoteTitle = farEnd;
            } else {
                remoteTitle = 'Unknown Remote';
            }

            let remoteLabel = `<div style="text-align: left">`;
            remoteLabel += `<b>${noWrap(remoteTitle)}</b><hr/>`; // Title inside the node
            remoteLabel += `<b>SDP:</b> ${sdp.sdpId}:${sdp.vcId}<br/>`;

            if (farEnd) {
                remoteLabel += `<b>Target IP:</b> ${farEnd}<br/>`;
            }
            remoteLabel += `</div>`;

            // Just the Node, no wrapping Subgraph
            lines.push(`${sdpId}["${remoteLabel}"]`);
            lines.push(`class ${sdpId} remote;`);

            // Connect Local SAPs to this SDP
            localNodes.forEach((loc, locIdx) => {
                // Determine QoS label from corresponding SAP
                // localNodes maps 1:1 to epipe.saps if we created one node per SAP.
                // epipe.saps[locIdx] should be the one.
                const sap = epipe.saps[locIdx];
                let linkLabel = "";

                // User requested "Ingress QoS: 10" format on the link.
                // Check if we have ingress or egress qos
                if (sap.ingressQos?.policyId) {
                    linkLabel += `In-QoS: ${sap.ingressQos.policyId}`;
                }
                if (sap.egressQos?.policyId) {
                    if (linkLabel) linkLabel += '<br/>';
                    linkLabel += `Out-QoS: ${sap.egressQos.policyId}`;
                }

                if (linkLabel) {
                    lines.push(`${loc} -->|"${linkLabel}"| ${sdpId}`);
                } else {
                    lines.push(`${loc} --> ${sdpId}`);
                }
            });
        });
    }

    // SAP-to-SAP direct (if no SDPs)
    if ((!epipe.spokeSdps || epipe.spokeSdps.length === 0) && localNodes.length === 2) {
        lines.push(`${localNodes[0]} --- ${localNodes[1]}`);
    }

    return lines.join('\n');
}

/**
 * VPLS 서비스 다이어그램 생성
 */
export function generateVPLSDiagram(
    vpls: VPLSService,
    hostname: string,
    sdps: SDP[] = [],
    remoteDeviceMap?: Map<string, string>
): string {
    const lines: string[] = [];

    lines.push('graph LR'); // Changed to LR for better V1 look

    // Define clean styles (V1 style)
    lines.push('classDef default fill:#ffffff,stroke:#333,stroke-width:2px,color:#000,text-align:left;');
    lines.push('classDef remote fill:#e6f3ff,stroke:#0066cc,stroke-width:2px,color:#000;');

    lines.push('');

    // Hostname Subgraph
    const safeHost = sanitizeNodeId(hostname);
    const hostId = `HOST_${safeHost}`;
    lines.push(`subgraph ${hostId} ["<b>${noWrap(hostname)}</b>"]`);
    lines.push('direction LR');

    // Main VPLS Node
    const vplsNodeId = `VPLS_${safeHost}_${vpls.serviceId}`;
    let vplsLabel = `<div style="text-align: left">`;
    vplsLabel += `<b>Service:</b> VPLS ${vpls.serviceId}${fmtDesc(vpls.description)}<br/>`;
    if (vpls.serviceName) {
        vplsLabel += `<b>Name:</b> ${noWrap(vpls.serviceName)}<br/>`;
    }
    vplsLabel += `<b>Customer:</b> ${vpls.customerId}<br/>`;
    if (vpls.fdbSize) vplsLabel += `<b>FDB Size:</b> ${vpls.fdbSize}<br/>`;
    vplsLabel += `</div>`;

    // Create VPLS Central Node
    lines.push(`${vplsNodeId}["${vplsLabel}"]`);

    // SAPs attached to VPLS node
    vpls.saps.forEach((sap) => {
        const sapId = `SAP_${safeHost}_${sanitizeNodeId(sap.sapId)}`;
        let sapLabel = `<div style="text-align: left">`;
        sapLabel += `<b>SAP:</b> ${sap.sapId}${fmtDesc(sap.description)}<br/>`;

        // Port Description Check
        // Currently SAP object has 'description', but we don't have separate portDescription.
        // We will just put Port and VLAN.
        sapLabel += `<b>Port:</b> ${sap.portId}${fmtDesc(sap.portDescription)}<br/>`;
        sapLabel += `<b>VLAN:</b> ${sap.vlanId}<br/>`;
        sapLabel += `</div>`;

        lines.push(`${sapId}["${sapLabel}"]`);
        lines.push(`${sapId} --- ${vplsNodeId}`);
    });

    lines.push('end'); // End Host

    // SDPs (Spoke/Mesh)
    const allSdps = [
        ...(vpls.spokeSdps || []).map(s => ({ ...s, type: 'Spoke' })),
        ...(vpls.meshSdps || []).map(s => ({ ...s, type: 'Mesh' }))
    ];

    allSdps.forEach((sdp, idx) => {
        const sdpNodeId = `SDP_REM_${safeHost}_${idx}`;

        // Resolve Far-End
        let farEnd: string | undefined;
        if (sdps && sdps.length > 0) {
            const sdpDef = sdps.find(s => s.sdpId === sdp.sdpId);
            if (sdpDef) farEnd = sdpDef.farEnd;
        }

        let remoteTitle = 'Remote Device';
        if (remoteDeviceMap && farEnd && remoteDeviceMap.has(farEnd)) {
            remoteTitle = remoteDeviceMap.get(farEnd)!;
        } else if (farEnd) {
            remoteTitle = farEnd;
        } else {
            remoteTitle = 'Unknown Remote';
        }

        let remoteLabel = `<div style="text-align: left">`;
        remoteLabel += `<b>${noWrap(remoteTitle)}</b><hr/>`;
        remoteLabel += `<b>${sdp.type} SDP:</b> ${sdp.sdpId}:${sdp.vcId}<br/>`;

        if (farEnd) {
            remoteLabel += `<b>Target IP:</b> ${farEnd}<br/>`;
        }
        remoteLabel += `</div>`;

        lines.push(`${sdpNodeId}["${remoteLabel}"]`);
        lines.push(`class ${sdpNodeId} remote;`);

        // VPLS Link Label with QoS
        // For VPLS, the link is from the Central VPLS Node to the Remote SDP.
        // Which SAP's QoS determines this? 
        // In VPLS, traffic to a Spoke SDP might not be tied to a SINGLE SAP's QoS policy directly in the same way (it's a switch).
        // However, if the user wants to see QoS, usually it's the QoS applied to the SDP itself or the SAPs.
        // The image showed a Point-to-Point Epipe where SAP maps to SDP.
        // For VPLS, SAPs connect to the VPLS Cloud, and SDPs connect to the VPLS Cloud.
        // The QoS on the link from VPLS Node to SDP Node... strictly speaking, SDPs can have their own QoS policies too (network-ingress/egress), but currently our type only has QoS on SAP.
        // If the user wants SAP QoS, it is already on the SAP->VPLS link (lines.push(`${sapId} -->|"${sap.portId}:${sap.vlanId}${qos}"| ${vplsId}`); inside generateVPLSDiagram line 124 in previous view).
        // Let's check generateVPLSDiagram again.

        // In previous `generateVPLSDiagram` code (around line 120-138):
        /*
        lines.push(`${sapId} -->|"${sap.portId}:${sap.vlanId}${qos}"| ${vplsId}`);
        */
        // So SAP-side QoS is already handled in VPLS?
        // Let's verify if I need to add anything to the SDP link. 
        // SDPs in V2 types DO NOT have qos fields currently. 
        // So I can't add QoS to the SDP link for VPLS unless I map it from a SAP (which is semantically incorrect for Multipoint).
        // I will leave VPLS SDP links as is, unless I find QoS on SDP.

        lines.push(`${vplsNodeId} -.-> ${sdpNodeId}`);
    });

    return lines.join('\n');
}

/**
 * VPRN 서비스 다이어그램 생성
 */
export function generateVPRNDiagram(
    vprn: VPRNService,
    hostname: string
): string {
    const lines: string[] = [];
    const safeHost = sanitizeNodeId(hostname);

    lines.push('graph LR');
    lines.push('');

    // Hostname Subgraph
    const hostId = `HOST_${safeHost}`;
    // Increase font size for hostname visibility
    lines.push(`subgraph ${hostId} ["<b><span style='font-size:16px; white-space: nowrap'>🖥️ ${noWrap(hostname)}</span></b>"]`);
    lines.push('direction LR');

    // VPRN 인스턴스 중심 노드
    const vprnId = `VPRN_${safeHost}_${vprn.serviceId}`;
    let vprnLabel = `<div style="text-align: left">`;
    vprnLabel += `<b>Service:</b> VPRN ${vprn.serviceId}${fmtDesc(vprn.description)}<br/>`;
    if (vprn.serviceName) {
        vprnLabel += `<b>Name:</b> ${noWrap(vprn.serviceName)}<br/>`;
    }
    vprnLabel += `<b>Customer:</b> ${vprn.customerId}<br/>`;
    vprnLabel += `<b>AS:</b> ${vprn.autonomousSystem || 'N/A'}`;
    vprnLabel += `</div>`;

    lines.push(`${vprnId}["${vprnLabel}"]`);

    // 인터페이스 연결
    vprn.interfaces.forEach((iface, index) => {
        const ifId = `IF_${safeHost}_${vprn.serviceId}_${index}`;
        // Sanitize interface name for display
        const ifName = iface.interfaceName;
        // Interface details
        let details = '';
        if (iface.ipAddress) details += `<br/>IP: ${iface.ipAddress}`;
        if (iface.portId) details += `<br/>Port: ${iface.portId}`;
        if (iface.vrrpGroupId) details += `<br/>VRRP: ${iface.vrrpGroupId} (Pri: ${iface.vrrpPriority})`;

        lines.push(`${ifId}["🔌 ${ifName}${details}"]`);
        lines.push(`${vprnId} --> ${ifId}`);
        lines.push(`style ${ifId} fill:#fff3e0,stroke:#e65100,stroke-width:1px`);
    });

    // BGP Neighbors
    if (vprn.bgpNeighbors && vprn.bgpNeighbors.length > 0) {
        const bgpId = `BGP_${safeHost}_${vprn.serviceId}`;
        const neighborsList = vprn.bgpNeighbors.join('<br/>');
        lines.push(`${bgpId}["🤝 BGP Neighbors<br/>${neighborsList}"]`);
        lines.push(`${vprnId} -.-> ${bgpId}`);
        lines.push(`style ${bgpId} fill:#e1f5fe,stroke:#0277bd,stroke-width:1px`);
    }

    // Static Routes
    if (vprn.staticRoutes && vprn.staticRoutes.length > 0) {
        // Show summary or limit
        const routeCount = vprn.staticRoutes.length;
        const routeId = `ROUTES_${safeHost}_${vprn.serviceId}`;
        lines.push(`${routeId}["🛣️ Static Routes: ${routeCount}"]`);
        lines.push(`${vprnId} -.-> ${routeId}`);
        lines.push(`style ${routeId} fill:#f3e5f5,stroke:#7b1fa2,stroke-width:1px`);
    }

    lines.push('end'); // End Host

    // 스타일
    lines.push('');
    lines.push(`style ${vprnId} fill:#e8eaf6,stroke:#1a237e,stroke-width:2px`);
    lines.push(`style ${hostId} fill:#f5f5f5,stroke:#999,stroke-width:2px,stroke-dasharray: 5 5`);

    return lines.join('\n');
}

export function generateServiceDiagram(
    service: L2VPNService,
    hostname: string,
    sdps: SDP[] = [], // Parent Config's SDPs
    remoteDeviceMap?: Map<string, string> // System IP -> Hostname map
): string {
    if (service.serviceType === 'epipe') {
        return generateEpipeDiagram(service as EpipeService, hostname, sdps, remoteDeviceMap);
    } else if (service.serviceType === 'vpls') {
        return generateVPLSDiagram(service as VPLSService, hostname, sdps, remoteDeviceMap);
    } else if (service.serviceType === 'vprn') {
        return generateVPRNDiagram(service as VPRNService, hostname);
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
