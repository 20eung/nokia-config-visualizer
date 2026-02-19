/**
 * IP 주소 유틸리티 함수 모듈
 * IPv4 주소 검증, 서브넷 계산, Longest Prefix Match 정렬 지원
 */

/**
 * 서브넷 매칭 결과 인터페이스
 */
export interface SubnetMatch {
  subnet: string;
  prefixLen: number;
  serviceId: number;
}

/**
 * IPv4 주소 유효성 검증
 * @param ip - 검증할 IP 주소 문자열
 * @returns 유효한 IPv4 주소인 경우 true
 */
export function isValidIPv4(ip: string): boolean {
  // 기본 형식 검증: 숫자와 점으로만 구성
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Pattern.test(ip)) {
    return false;
  }

  // 각 옥텟이 0-255 범위인지 검증
  const octets = ip.split('.');
  return octets.every(octet => {
    const num = parseInt(octet, 10);
    return num >= 0 && num <= 255;
  });
}

/**
 * IP 주소 문자열을 32비트 정수로 변환
 * @param ip - IP 주소 문자열 (예: "192.168.1.1")
 * @returns 32비트 정수 표현, 실패 시 -1
 */
export function ipToLong(ip: string): number {
  const parts = ip.split('.');
  if (parts.length !== 4) return -1;
  return parts.reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
}

/**
 * CIDR 표기법을 파싱하여 네트워크 주소와 프리픽스 길이 추출
 * @param ipWithCidr - CIDR 표기법 문자열 (예: "10.0.1.0/24")
 * @returns 네트워크 주소(32비트 정수)와 프리픽스 길이, 실패 시 null
 */
export function parseNetwork(ipWithCidr: string): { networkAddr: number; prefixLen: number } | null {
  const parts = ipWithCidr.split('/');
  if (parts.length !== 2) return null;

  const ip = parts[0];
  const prefixLen = parseInt(parts[1], 10);

  if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 32) return null;

  const ipLong = ipToLong(ip);
  if (ipLong === -1) return null;

  // 서브넷 마스크 계산
  const mask = ~((1 << (32 - prefixLen)) - 1) >>> 0;
  const networkAddr = (ipLong & mask) >>> 0;

  return { networkAddr, prefixLen };
}

/**
 * IP 주소가 특정 서브넷에 포함되는지 확인
 * @param targetIp - 확인할 IP 주소 (예: "10.0.1.50")
 * @param subnet - 서브넷 CIDR (예: "10.0.1.0/24")
 * @returns 서브넷에 포함되면 true
 */
export function isIpInSubnet(targetIp: string, subnet: string): boolean {
  const net = parseNetwork(subnet);
  if (!net) return false;

  const targetLong = ipToLong(targetIp);
  if (targetLong === -1) return false;

  // 서브넷 마스크 재계산
  const mask = ~((1 << (32 - net.prefixLen)) - 1) >>> 0;

  // 타겟 IP의 네트워크 주소가 서브넷의 네트워크 주소와 일치하는지 확인
  return (targetLong & mask) >>> 0 === net.networkAddr;
}

/**
 * Longest Prefix Match 알고리즘으로 서브넷 매칭 결과 정렬
 * 프리픽스 길이가 긴 것(더 구체적인 매칭)이 앞에 오도록 정렬
 * @param matches - 서브넷 매칭 결과 배열
 * @returns 정렬된 매칭 결과 (prefixLen 내림차순)
 */
export function sortByLongestPrefix(matches: SubnetMatch[]): SubnetMatch[] {
  return [...matches].sort((a, b) => {
    // prefixLen이 큰 것이 더 구체적 (우선순위 높음)
    if (a.prefixLen !== b.prefixLen) {
      return b.prefixLen - a.prefixLen;
    }
    // prefixLen이 같으면 serviceId로 정렬 (안정성)
    return a.serviceId - b.serviceId;
  });
}
