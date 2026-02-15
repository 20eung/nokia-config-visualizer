/** 서비스 요약 (AI에 전달되는 축약 데이터) */

export interface SapSummary {
  sapId: string;
  description: string;
  portId: string;
  ingressRate?: string;
  egressRate?: string;
}

export interface InterfaceSummary {
  name: string;
  description?: string;
  ipAddress?: string;
  portId?: string;
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

/** API 요청/응답 */

export interface ChatRequest {
  message: string;
  configSummary: ConfigSummary;
}

export interface ChatResponse {
  selectedKeys: string[];
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
  filterType?: 'all' | 'epipe' | 'vpls' | 'vprn' | 'ies';
}
