/**
 * NCV AI Platform - Config 청크 빌더 (v4.8.0)
 *
 * 서비스 데이터를 RAG 임베딩용 텍스트 청크로 변환.
 */

import type { FlatService } from './configStore';

export interface ConfigChunk {
  id: string;       // "hostname::selectionKey" — 중복 없는 식별자
  text: string;     // 임베딩할 자연어 텍스트
  metadata: {
    hostname: string;
    serviceType: string;
    serviceId: number;
    selectionKey: string;
    description: string;
  };
}

/**
 * FlatService[] → ConfigChunk[]
 * 각 서비스를 검색 가능한 텍스트 청크로 변환.
 */
export function buildChunks(services: FlatService[]): ConfigChunk[] {
  return services.map(svc => {
    const parts: string[] = [
      `Device: ${svc.hostname} (${svc.systemIp})`,
      `Service Type: ${svc.serviceType.toUpperCase()} ID: ${svc.serviceId}`,
      `Description: ${svc.description || '(no description)'}`,
    ];

    if (svc.serviceName) {
      parts.push(`Service Name: ${svc.serviceName}`);
    }

    if (svc.saps && svc.saps.length > 0) {
      const sapLines = svc.saps.map(s => {
        const qos = (s.ingressRate || s.egressRate)
          ? ` QoS in:${s.ingressRate ?? '-'} out:${s.egressRate ?? '-'}`
          : '';
        return `  SAP ${s.sapId} port:${s.portId}${s.description ? ` desc:"${s.description}"` : ''}${qos}`;
      });
      parts.push(`SAPs:\n${sapLines.join('\n')}`);
    }

    if (svc.interfaces && svc.interfaces.length > 0) {
      const intfLines = svc.interfaces.map(i => {
        const ip = i.ipAddress ? ` ip:${i.ipAddress}` : '';
        const qos = (i.ingressRate || i.egressRate)
          ? ` QoS in:${i.ingressRate ?? '-'} out:${i.egressRate ?? '-'}`
          : '';
        return `  Interface ${i.name}${ip}${i.description ? ` desc:"${i.description}"` : ''}${qos}`;
      });
      parts.push(`Interfaces:\n${intfLines.join('\n')}`);
    }

    if (svc.bgpNeighbors && svc.bgpNeighbors.length > 0) {
      parts.push(`BGP Neighbors: ${svc.bgpNeighbors.join(', ')}`);
    }

    if (svc.ospfAreas && svc.ospfAreas.length > 0) {
      parts.push(`OSPF Areas: ${svc.ospfAreas.join(', ')}`);
    }

    if (svc.staticRoutes && svc.staticRoutes.length > 0) {
      parts.push(`Static Routes: ${svc.staticRoutes.join(', ')}`);
    }

    if (svc.autonomousSystem) {
      parts.push(`AS Number: ${svc.autonomousSystem}`);
    }

    if (svc.routeDistinguisher) {
      parts.push(`Route Distinguisher: ${svc.routeDistinguisher}`);
    }

    return {
      id: `${svc.hostname}::${svc.selectionKey}`,
      text: parts.join('\n'),
      metadata: {
        hostname: svc.hostname,
        serviceType: svc.serviceType,
        serviceId: svc.serviceId,
        selectionKey: svc.selectionKey,
        description: svc.description || '',
      },
    };
  });
}
