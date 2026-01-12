import type { EpipeService, VPLSService, L2VPNService, ParsedL2VPNConfig } from '../../types/v2';

/**
 * Mermaid 노드 ID 생성 (특수문자 제거)
 */
function sanitizeNodeId(id: string): string {
    return id.replace(/[/:]/g, '_').replace(/\s+/g, '_');
}

/**
 * Epipe 서비스 다이어그램 생성
 */
export function generateEpipeDiagram(
    epipe: EpipeService,
    _hostname: string
): string {
    const lines: string[] = [];

    lines.push('graph LR');
    lines.push('');

    // SAP 노드 생성
    if (epipe.saps.length >= 2) {
        const sap1 = epipe.saps[0];
        const sap2 = epipe.saps[1];

        const sap1Id = `SAP_${sanitizeNodeId(sap1.sapId)}`;
        const sap2Id = `SAP_${sanitizeNodeId(sap2.sapId)}`;

        // SAP 노드 정의
        lines.push(`${sap1Id}["📍 ${sap1.description}<br/>SAP: ${sap1.sapId}<br/>Port: ${sap1.portId} | VLAN: ${sap1.vlanId}"]`);
        lines.push(`${sap2Id}["📍 ${sap2.description}<br/>SAP: ${sap2.sapId}<br/>Port: ${sap2.portId} | VLAN: ${sap2.vlanId}"]`);

        // Epipe 서비스 노드
        const serviceId = `EPIPE_${epipe.serviceId}`;
        const serviceLabel = `🔗 Epipe ${epipe.serviceId}<br/>${epipe.description}<br/>Customer: ${epipe.customerId}`;
        lines.push(`${serviceId}{{"${serviceLabel}"}}`);

        // 연결 (SAP1 → Epipe → SAP2)
        let qos1 = '';
        if (sap1.ingressQos || sap1.egressQos) {
            const qosParts = [];
            if (sap1.ingressQos) qosParts.push(`In:${sap1.ingressQos.policyId}`);
            if (sap1.egressQos) qosParts.push(`Out:${sap1.egressQos.policyId}`);
            qos1 = `<br/>QoS: ${qosParts.join(', ')}`;
        }

        let qos2 = '';
        if (sap2.ingressQos || sap2.egressQos) {
            const qosParts = [];
            if (sap2.ingressQos) qosParts.push(`In:${sap2.ingressQos.policyId}`);
            if (sap2.egressQos) qosParts.push(`Out:${sap2.egressQos.policyId}`);
            qos2 = `<br/>QoS: ${qosParts.join(', ')}`;
        }

        lines.push(`${sap1Id} -->|"${sap1.portId}:${sap1.vlanId}${qos1}"| ${serviceId}`);
        lines.push(`${serviceId} -->|"${sap2.portId}:${sap2.vlanId}${qos2}"| ${sap2Id}`);
    }

    // Spoke SDP가 있는 경우
    if (epipe.spokeSdps && epipe.spokeSdps.length > 0) {
        const sap = epipe.saps[0];
        const sapId = `SAP_${sanitizeNodeId(sap.sapId)}`;

        lines.push(`${sapId}["📍 ${sap.description}<br/>SAP: ${sap.sapId}<br/>Port: ${sap.portId} | VLAN: ${sap.vlanId}"]`);

        const serviceId = `EPIPE_${epipe.serviceId}`;
        const serviceLabel = `🔗 Epipe ${epipe.serviceId}<br/>${epipe.description}<br/>Customer: ${epipe.customerId}`;
        lines.push(`${serviceId}{{"${serviceLabel}"}}`);

        epipe.spokeSdps.forEach(sdp => {
            const sdpId = `SDP_${sdp.sdpId}_${sdp.vcId}`;
            lines.push(`${sdpId}["🔀 SDP ${sdp.sdpId}:${sdp.vcId}<br/>${sdp.description}"]`);
            lines.push(`${serviceId} -.->|"VC: ${sdp.vcId}"| ${sdpId}`);
        });

        let qos = '';
        if (sap.ingressQos || sap.egressQos) {
            const qosParts = [];
            if (sap.ingressQos) qosParts.push(`In:${sap.ingressQos.policyId}`);
            if (sap.egressQos) qosParts.push(`Out:${sap.egressQos.policyId}`);
            qos = `<br/>QoS: ${qosParts.join(', ')}`;
        }

        lines.push(`${sapId} -->|"${sap.portId}:${sap.vlanId}${qos}"| ${serviceId}`);
    }

    // 스타일
    lines.push('');
    lines.push(`style EPIPE_${epipe.serviceId} fill:#e1f5ff,stroke:#01579b,stroke-width:2px`);

    // SAP 스타일
    epipe.saps.forEach(sap => {
        const sapId = `SAP_${sanitizeNodeId(sap.sapId)}`;
        lines.push(`style ${sapId} fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px`);
    });

    // SDP 스타일
    if (epipe.spokeSdps) {
        epipe.spokeSdps.forEach(sdp => {
            const sdpId = `SDP_${sdp.sdpId}_${sdp.vcId}`;
            lines.push(`style ${sdpId} fill:#f3e5f5,stroke:#6a1b9a,stroke-width:2px`);
        });
    }

    return lines.join('\n');
}

/**
 * VPLS 서비스 다이어그램 생성
 */
export function generateVPLSDiagram(
    vpls: VPLSService,
    _hostname: string
): string {
    const lines: string[] = [];

    lines.push('graph TB');
    lines.push('');

    // VPLS 인스턴스 중심 노드
    const vplsId = `VPLS_${vpls.serviceId}`;
    const vplsLabel = `🌐 VPLS ${vpls.serviceId}<br/>${vpls.description}<br/>Customer: ${vpls.customerId}`;
    if (vpls.fdbSize) {
        lines.push(`${vplsId}{{"${vplsLabel}<br/>FDB Size: ${vpls.fdbSize}"}}`);
    } else {
        lines.push(`${vplsId}{{"${vplsLabel}"}}`);
    }

    // 각 SAP를 VPLS에 연결
    vpls.saps.forEach((sap) => {
        const sapId = `SAP_${sanitizeNodeId(sap.sapId)}`;

        lines.push(`${sapId}["📍 ${sap.description}<br/>SAP: ${sap.sapId}<br/>Port: ${sap.portId} | VLAN: ${sap.vlanId}"]`);

        let qos = '';
        if (sap.ingressQos || sap.egressQos) {
            const qosParts = [];
            if (sap.ingressQos) qosParts.push(`In:${sap.ingressQos.policyId}`);
            if (sap.egressQos) qosParts.push(`Out:${sap.egressQos.policyId}`);
            qos = `<br/>QoS: ${qosParts.join(', ')}`;
        }

        lines.push(`${sapId} -->|"${sap.portId}:${sap.vlanId}${qos}"| ${vplsId}`);
    });

    // Spoke SDP 연결
    if (vpls.spokeSdps) {
        vpls.spokeSdps.forEach(sdp => {
            const sdpId = `SDP_${sdp.sdpId}_${sdp.vcId}`;
            lines.push(`${sdpId}["🔀 SDP ${sdp.sdpId}:${sdp.vcId}<br/>${sdp.description}"]`);
            lines.push(`${vplsId} -.->|"VC: ${sdp.vcId}"| ${sdpId}`);
        });
    }

    // Mesh SDP 연결
    if (vpls.meshSdps) {
        vpls.meshSdps.forEach(sdp => {
            const sdpId = `MESH_SDP_${sdp.sdpId}_${sdp.vcId}`;
            lines.push(`${sdpId}["🔀 Mesh SDP ${sdp.sdpId}:${sdp.vcId}<br/>${sdp.description}"]`);
            lines.push(`${vplsId} <-.->|"VC: ${sdp.vcId}"| ${sdpId}`);
        });
    }

    // 스타일
    lines.push('');
    lines.push(`style ${vplsId} fill:#fff3e0,stroke:#e65100,stroke-width:2px`);

    // SAP 스타일
    vpls.saps.forEach(sap => {
        const sapId = `SAP_${sanitizeNodeId(sap.sapId)}`;
        lines.push(`style ${sapId} fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px`);
    });

    // SDP 스타일
    if (vpls.spokeSdps) {
        vpls.spokeSdps.forEach(sdp => {
            const sdpId = `SDP_${sdp.sdpId}_${sdp.vcId}`;
            lines.push(`style ${sdpId} fill:#f3e5f5,stroke:#6a1b9a,stroke-width:2px`);
        });
    }

    if (vpls.meshSdps) {
        vpls.meshSdps.forEach(sdp => {
            const sdpId = `MESH_SDP_${sdp.sdpId}_${sdp.vcId}`;
            lines.push(`style ${sdpId} fill:#f3e5f5,stroke:#6a1b9a,stroke-width:2px`);
        });
    }

    return lines.join('\n');
}

/**
 * 서비스 다이어그램 생성 (Epipe 또는 VPLS)
 */
export function generateServiceDiagram(
    service: L2VPNService,
    hostname: string
): string {
    if (service.serviceType === 'epipe') {
        return generateEpipeDiagram(service, hostname);
    } else if (service.serviceType === 'vpls') {
        return generateVPLSDiagram(service, hostname);
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
