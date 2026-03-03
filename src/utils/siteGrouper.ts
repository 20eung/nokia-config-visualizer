/**
 * 사이트 그룹핑 유틸리티
 *
 * Hostname에서 사이트명을 추출하고, HA 페어를 자동 감지하여
 * ParsedConfigV3[] → SiteGroup[] 변환을 수행합니다.
 */

import type { ParsedConfigV3 } from './v3/parserV3';
import type { SiteGroup } from '../types/site';

/**
 * Hostname에서 사이트명 추출
 * Nokia 장비 hostname 패턴: SITE-ROLE-NUM (예: SEOUL-PE-01, BUSAN-CR-02)
 * 마지막 숫자 부분과 역할 접미사를 제거하여 사이트명만 추출
 */
export function extractSiteName(hostname: string): string {
  if (!hostname) return 'Unknown';

  // 일반적인 패턴: 끝 숫자와 역할 코드(PE, CR, P, CE 등) 제거
  // 예: "SEOUL-PE-01" → "SEOUL", "BUSAN-CR-02" → "BUSAN"
  const cleaned = hostname
    .replace(/[-_]?\d+$/i, '')          // 끝 숫자 제거
    .replace(/[-_]?(PE|CR|P|CE|BR|AR|SR|ER|AGG|ACC|CORE|EDGE|DIST|SW)$/i, '') // 역할 코드 제거
    .replace(/[-_]?\d+$/i, '')          // 역할 코드 앞 숫자 제거
    .trim();

  return cleaned || hostname;
}

/**
 * ParsedConfigV3 배열을 SiteGroup 배열로 변환
 */
export function groupConfigsBySite(configs: ParsedConfigV3[]): SiteGroup[] {
  // 1단계: 사이트명별로 hostname 그룹화
  const siteMap = new Map<string, Set<string>>();
  const hostnameToConfig = new Map<string, ParsedConfigV3>();

  for (const config of configs) {
    const siteName = extractSiteName(config.hostname);
    if (!siteMap.has(siteName)) {
      siteMap.set(siteName, new Set());
    }
    siteMap.get(siteName)!.add(config.hostname);
    hostnameToConfig.set(config.hostname, config);
  }

  // 2단계: SiteGroup 생성
  const groups: SiteGroup[] = [];

  for (const [siteName, hostnames] of siteMap) {
    const hostnameArr = Array.from(hostnames).sort();
    const isHAPair = hostnameArr.length >= 2;

    // 서비스 카운트 집계
    const counts = { epipe: 0, vpls: 0, vprn: 0, ies: 0 };
    const countedServiceIds = new Set<string>();

    for (const hostname of hostnameArr) {
      const config = hostnameToConfig.get(hostname);
      if (!config) continue;

      for (const service of config.services) {
        const key = `${service.serviceType}-${service.serviceId}`;
        if (service.serviceType === 'ies') {
          // IES는 hostname별로 카운트
          counts.ies += (service as any).interfaces?.length || 0;
        } else if (!countedServiceIds.has(key)) {
          countedServiceIds.add(key);
          if (service.serviceType === 'epipe') counts.epipe++;
          else if (service.serviceType === 'vpls') counts.vpls++;
          else if (service.serviceType === 'vprn') counts.vprn++;
        }
      }
    }

    groups.push({
      siteName,
      hostnames: hostnameArr,
      isHAPair,
      serviceCounts: counts,
      totalServices: counts.epipe + counts.vpls + counts.vprn + counts.ies,
    });
  }

  // 사이트명 정렬
  return groups.sort((a, b) => a.siteName.localeCompare(b.siteName));
}
