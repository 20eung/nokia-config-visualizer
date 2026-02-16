/** 서비스 요약 (AI에 전달되는 축약 데이터) */

export interface SapSummary {
  sapId: string;
  description: string;
  portId: string;
  portDescription?: string;
  ingressRate?: string;
  egressRate?: string;
}

export interface InterfaceSummary {
  name: string;
  description?: string;
  ipAddress?: string;
  portId?: string;
  portDescription?: string;
  ingressRate?: string;
  egressRate?: string;
  vrrpBackupIp?: string;
}

export interface ServiceSummary {
  serviceType: 'epipe' | 'vpls' | 'vprn' | 'ies';
  serviceId: number;
  description: string;
  serviceName?: string;
  selectionKey: string;
  saps?: SapSummary[];
  interfaces?: InterfaceSummary[];
  bgpNeighbors?: string[];
  ospfAreas?: string[];
  staticRoutes?: string[];
  autonomousSystem?: number;
  routeDistinguisher?: string;
}

export interface DeviceSummary {
  hostname: string;
  systemIp: string;
  services: ServiceSummary[];
}

export interface ConfigSummary {
  devices: DeviceSummary[];
}

/** Dictionary 관련 타입 - v4.4.0 */

export interface DictionaryCompact {
  entries: {
    /** name (group representative name) */
    n: string;
    /** configKeywords (Config search targets) */
    k: string[];
    /** searchAliases (user search terms) */
    a: string[];
  }[];
}

export interface DictionaryGenerateRequest {
  descriptions: string[];
}

export interface DictionaryGenerateResponse {
  entries: {
    name: string;
    configKeywords: string[];
    searchAliases: string[];
  }[];
}

/** API 요청/응답 */

export interface MatchedEntry {
  /** 실제로 매칭된 키워드 (예: "SK쉴더스", "Bizen") */
  matchedAlias: string;
  /** Config 검색에 사용될 키워드들 (예: ["Bizen", "ADTCAPS", "SKShielders", "Infosec"]) */
  configKeywords: string[];
  /** 그룹 대표 이름 (예: "SK쉴더스") */
  groupName: string;
}

export interface ChatRequest {
  message: string;
  configSummary: ConfigSummary;
  dictionary?: DictionaryCompact;
  filterType?: 'all' | 'epipe' | 'vpls' | 'vprn' | 'ies';
}

export interface ChatResponse {
  selectedKeys: string[];
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
  filterType?: 'all' | 'epipe' | 'vpls' | 'vprn' | 'ies';
  matchedEntries?: MatchedEntry[];
}
