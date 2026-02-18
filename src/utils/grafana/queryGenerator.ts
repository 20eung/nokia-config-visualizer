/**
 * Grafana InfluxDB 쿼리문 생성 로직
 * v4.5.2 - Grafana Export 기능
 */

import type {
  NokiaService,
  EpipeService,
  VPLSService,
  VPRNService,
  IESService,
} from '../../types/v2';
import type { GrafanaQuery, GrafanaQuerySet } from '../../types/grafana';

/**
 * SAP ID 또는 포트 ID에서 물리 포트명 추출 (VLAN 제거)
 * @param sapIdOrPortId - SAP ID (예: "1/1/1:100") 또는 포트 ID (예: "1/1/1")
 * @returns 물리 포트명 (예: "1/1/1")
 *
 * @example
 * extractPortId("1/1/1:100") // => "1/1/1"
 * extractPortId("lag-1:200") // => "lag-1"
 * extractPortId("1/1/1") // => "1/1/1"
 */
function extractPortId(sapIdOrPortId: string): string {
  // VLAN 포함: "1/1/1:100" → "1/1/1"
  // LAG 포트: "lag-1:200" → "lag-1"
  // 물리 포트: "1/1/1" → "1/1/1" (그대로)
  return sapIdOrPortId.split(':')[0];
}

/**
 * InfluxDB InfluxQL 쿼리문 생성
 * @param hostname - 장비 호스트명
 * @param ifName - 인터페이스 이름 (VLAN 제거됨)
 * @param metric - InfluxDB 메트릭 ('ifHCInOctets' | 'ifHCOutOctets')
 * @returns InfluxQL 쿼리문
 */
function buildInfluxQuery(
  hostname: string,
  ifName: string,
  metric: 'ifHCInOctets' | 'ifHCOutOctets'
): string {
  return `SELECT non_negative_derivative("${metric}", 1s) *8 FROM "snmp" WHERE ("hostname" = '${hostname}' AND "ifName" = '${ifName}') AND $timeFilter`;
}

/**
 * Epipe 서비스 쿼리문 생성
 * @param service - Epipe 서비스 객체
 * @param hostname - 장비 호스트명 (fallback용)
 * @returns Grafana 쿼리 세트
 */
function generateEpipeQueries(
  service: EpipeService,
  hostname: string
): GrafanaQuerySet {
  const queries: GrafanaQuery[] = [];

  // adminState='down' SAP 제외 (다이어그램과 동일한 필터링)
  const activeSaps = service.saps.filter((sap) => sap.adminState !== 'down');

  activeSaps.forEach((sap) => {
    const portId = extractPortId(sap.sapId);

    // SAP별 hostname 사용 (HA 구성 지원)
    const sapHostname = (sap as any)._hostname || hostname;

    // Ingress 쿼리
    queries.push({
      hostname: sapHostname,
      ifName: portId,
      direction: 'ingress',
      queryText: buildInfluxQuery(sapHostname, portId, 'ifHCInOctets'),
    });

    // Egress 쿼리
    queries.push({
      hostname: sapHostname,
      ifName: portId,
      direction: 'egress',
      queryText: buildInfluxQuery(sapHostname, portId, 'ifHCOutOctets'),
    });
  });

  return {
    serviceType: 'Epipe',
    serviceId: service.serviceId,
    queries,
  };
}

/**
 * VPLS 서비스 쿼리문 생성
 * @param service - VPLS 서비스 객체
 * @param hostname - 장비 호스트명 (fallback용)
 * @returns Grafana 쿼리 세트
 */
function generateVPLSQueries(
  service: VPLSService,
  hostname: string
): GrafanaQuerySet {
  const queries: GrafanaQuery[] = [];

  // adminState='down' SAP 제외
  const activeSaps = service.saps.filter((sap) => sap.adminState !== 'down');

  activeSaps.forEach((sap) => {
    const portId = extractPortId(sap.sapId);

    // SAP별 hostname 사용 (HA 구성 지원)
    const sapHostname = (sap as any)._hostname || hostname;

    // Ingress 쿼리
    queries.push({
      hostname: sapHostname,
      ifName: portId,
      direction: 'ingress',
      queryText: buildInfluxQuery(sapHostname, portId, 'ifHCInOctets'),
    });

    // Egress 쿼리
    queries.push({
      hostname: sapHostname,
      ifName: portId,
      direction: 'egress',
      queryText: buildInfluxQuery(sapHostname, portId, 'ifHCOutOctets'),
    });
  });

  return {
    serviceType: 'VPLS',
    serviceId: service.serviceId,
    queries,
  };
}

/**
 * VPRN 서비스 쿼리문 생성
 * @param service - VPRN 서비스 객체
 * @param hostname - 장비 호스트명 (fallback용)
 * @returns Grafana 쿼리 세트
 */
function generateVPRNQueries(
  service: VPRNService,
  hostname: string
): GrafanaQuerySet {
  const queries: GrafanaQuery[] = [];

  // adminState='down' 인터페이스 제외
  const activeInterfaces = service.interfaces.filter(
    (intf) => intf.adminState !== 'down'
  );

  activeInterfaces.forEach((intf) => {
    // portId가 없으면 스킵 (loopback 인터페이스 등)
    if (!intf.portId) return;

    // sapId가 있으면 우선 사용, 없으면 portId 사용
    const portId = extractPortId(intf.sapId || intf.portId);

    // 인터페이스별 hostname 사용 (HA 구성 지원)
    const interfaceHostname = (intf as any)._hostname || hostname;

    // Ingress 쿼리
    queries.push({
      hostname: interfaceHostname,
      ifName: portId,
      direction: 'ingress',
      queryText: buildInfluxQuery(interfaceHostname, portId, 'ifHCInOctets'),
    });

    // Egress 쿼리
    queries.push({
      hostname: interfaceHostname,
      ifName: portId,
      direction: 'egress',
      queryText: buildInfluxQuery(interfaceHostname, portId, 'ifHCOutOctets'),
    });
  });

  return {
    serviceType: 'VPRN',
    serviceId: service.serviceId,
    queries,
  };
}

/**
 * IES 서비스 쿼리문 생성
 * @param service - IES 서비스 객체
 * @param hostname - 장비 호스트명 (fallback용, HA 구성 시 "BB1 + BB2" 형태)
 * @returns Grafana 쿼리 세트
 */
function generateIESQueries(
  service: IESService,
  hostname: string
): GrafanaQuerySet {
  const queries: GrafanaQuery[] = [];

  // adminState='down' 인터페이스 제외
  const activeInterfaces = service.interfaces.filter(
    (intf) => intf.adminState !== 'down'
  );

  activeInterfaces.forEach((intf) => {
    // portId가 없으면 스킵
    if (!intf.portId) return;

    const portId = extractPortId(intf.sapId || intf.portId);

    // 인터페이스별 hostname 사용 (HA 구성 지원)
    // V3Page에서 IES 인터페이스 병합 시 각 인터페이스에 _hostname 추가됨
    const interfaceHostname = (intf as any)._hostname || hostname.split(' + ')[0];

    // Ingress 쿼리
    queries.push({
      hostname: interfaceHostname,
      ifName: portId,
      direction: 'ingress',
      queryText: buildInfluxQuery(interfaceHostname, portId, 'ifHCInOctets'),
    });

    // Egress 쿼리
    queries.push({
      hostname: interfaceHostname,
      ifName: portId,
      direction: 'egress',
      queryText: buildInfluxQuery(interfaceHostname, portId, 'ifHCOutOctets'),
    });
  });

  return {
    serviceType: 'IES',
    serviceId: `${hostname}-IES`, // IES는 hostname 기반 ID
    queries,
  };
}

/**
 * 서비스 타입별 Grafana 쿼리문 생성 (메인 함수)
 * @param service - Nokia 서비스 객체
 * @param hostname - 장비 호스트명
 * @returns Grafana 쿼리 세트
 * @throws {Error} 지원하지 않는 서비스 타입인 경우
 */
export function generateGrafanaQueries(
  service: NokiaService,
  hostname: string
): GrafanaQuerySet {
  switch (service.serviceType) {
    case 'epipe':
      return generateEpipeQueries(service as EpipeService, hostname);
    case 'vpls':
      return generateVPLSQueries(service as VPLSService, hostname);
    case 'vprn':
      return generateVPRNQueries(service as VPRNService, hostname);
    case 'ies':
      return generateIESQueries(service as IESService, hostname);
    default:
      throw new Error(
        `Unsupported service type: ${(service as NokiaService).serviceType}`
      );
  }
}
