/**
 * Grafana InfluxDB 쿼리문 관련 타입 정의
 * v4.5.2 - Grafana Export 기능
 */

/**
 * 단일 InfluxDB 쿼리
 */
export interface GrafanaQuery {
  /** 장비 호스트명 (예: "BB3") */
  hostname: string;

  /** 인터페이스 이름 (VLAN 제거됨, 예: "1/1/1") */
  ifName: string;

  /** 트래픽 방향 */
  direction: 'ingress' | 'egress';

  /** InfluxDB InfluxQL 쿼리문 */
  queryText: string;
}

/**
 * 서비스별 쿼리 세트
 */
export interface GrafanaQuerySet {
  /** 서비스 타입 ("Epipe" | "VPLS" | "VPRN" | "IES") */
  serviceType: string;

  /** 서비스 ID (숫자) 또는 "hostname-IES" (IES의 경우) */
  serviceId: number | string;

  /** 생성된 모든 쿼리문 */
  queries: GrafanaQuery[];
}
