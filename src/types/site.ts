/**
 * 사이트 그룹핑 타입 정의
 * Config 파일들을 사이트 단위로 그룹화하는 데 사용합니다.
 */

export interface SiteGroup {
  /** 사이트명 (hostname에서 추출) */
  siteName: string;
  /** 이 사이트에 속한 hostname 목록 */
  hostnames: string[];
  /** HA 페어 여부 */
  isHAPair: boolean;
  /** 서비스 타입별 개수 */
  serviceCounts: {
    epipe: number;
    vpls: number;
    vprn: number;
    ies: number;
  };
  /** 총 서비스 수 */
  totalServices: number;
}
