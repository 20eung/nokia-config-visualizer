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

/** ===== NCV AI Platform API 타입 (v4.8.1) ===== */

export interface NcvAnalyzeRequest {
  filename: string;
  hostname: string;
  systemIp: string;
  configSummary: ConfigSummary;
}

export interface NcvAnalyzeResponse {
  success: boolean;
  filename: string;
  hostname: string;
  serviceCount: number;
  uploadedAt: string;
}

export interface NcvServiceItem extends ServiceSummary {
  hostname: string;
  systemIp: string;
}

export interface NcvServicesResponse {
  version: string;
  timestamp: string;
  configCount: number;
  serviceCount: number;
  services: NcvServiceItem[];
}

export interface NcvTopologyNode {
  id: string;
  label: string;
  type: 'device' | 'epipe' | 'vpls' | 'vprn' | 'ies';
  systemIp?: string;
  serviceId?: number;
}

export interface NcvTopologyEdge {
  from: string;
  to: string;
  label?: string;
  serviceType?: string;
}

export interface NcvTopologyResponse {
  nodes: NcvTopologyNode[];
  edges: NcvTopologyEdge[];
  mermaid?: string;
}

export interface NcvStatsResponse {
  configCount: number;
  serviceCount: number;
  lastUpdated: string | null;
  indexedAt: string | null;
}

export interface NcvSemanticSearchRequest {
  query: string;
  topK?: number;
}

export interface NcvSemanticSearchResult {
  selectionKey: string;
  hostname: string;
  serviceType: string;
  description: string;
  score: number;
}

/** ===== Nokia Config Parser Types (v5.5.0) ===== */

/**
 * L2 VPN 서비스 타입
 */
export type ServiceType = 'epipe' | 'vpls' | 'ies' | 'vprn';

/**
 * 관리 상태
 */
export type AdminState = 'up' | 'down';

/**
 * 운영 상태
 */
export type OperState = 'up' | 'down';

/**
 * SDP 전송 타입
 */
export type DeliveryType = 'mpls' | 'gre';

/**
 * QoS 정책
 */
export interface QosPolicy {
  policyId: number;
  policyName: string;
  rate?: number;          // Rate in kbps (from sap-ingress/sap-egress policy definition)
  rateMax?: boolean;      // true if rate is "max" (unlimited)
}

/**
 * Port Ethernet 설정
 */
export interface PortEthernetConfig {
  mode?: string;              // access or network
  encapType?: string;         // e.g., dot1q
  mtu?: number;               // Port MTU
  speed?: string;             // e.g., "10000"
  autonegotiate?: string;     // e.g., "limited"
  networkQueuePolicy?: string; // network queue-policy
  lldp?: string;              // LLDP admin-status (e.g., "tx-rx")
}

/**
 * SAP (Service Access Point)
 */
export interface SAP {
  sapId: string;              // 예: "1/1/1:100"
  portId: string;             // 예: "1/1/1" 또는 "lag-1"
  vlanId: number;             // 예: 100
  description: string;
  portDescription?: string;   // Physical Port description
  adminState: AdminState;
  llf?: boolean;              // Link Loss Forwarding

  // Port Ethernet config (from physical port)
  portEthernet?: PortEthernetConfig;

  // QoS 정보
  ingressQos?: QosPolicy;
  egressQos?: QosPolicy;

  // 통계 정보 (선택)
  stats?: {
    ingressPackets?: number;
    egressPackets?: number;
    ingressBytes?: number;
    egressBytes?: number;
  };
}

/**
 * Keep-Alive 설정
 */
export interface KeepAlive {
  enabled: boolean;
  interval?: number;
  timeout?: number;
}

/**
 * SDP (Service Distribution Point)
 */
export interface SDP {
  sdpId: number;
  description: string;
  farEnd: string;             // Far-End IP 주소
  lspName?: string;           // LSP 이름
  deliveryType: DeliveryType;
  adminState: AdminState;
  operState?: OperState;

  // Keep-alive 정보
  keepAlive?: KeepAlive;
}

/**
 * Spoke SDP (Point-to-Point)
 */
export interface SpokeSDP {
  sdpId: number;
  vcId: number;               // VC ID
  description: string;
}

/**
 * Mesh SDP (Multipoint)
 */
export interface MeshSDP {
  sdpId: number;
  vcId: number;
  description: string;
}

/**
 * Static Route
 */
export interface StaticRoute {
  prefix: string;
  nextHop: string;
}

/**
 * OSPF Interface
 */
export interface OSPFInterface {
  interfaceName: string;
  interfaceType?: string; // e.g., "point-to-point"
  adminState: AdminState;
}

/**
 * OSPF 설정
 */
export interface OSPF {
  areas: Array<{
    areaId: string;
    interfaces: OSPFInterface[];
  }>;
  adminState: AdminState;
}

/**
 * BGP Group
 */
export interface BGPGroup {
  groupName: string;
  peerAs?: number;            // Group-level peer-as
  neighbors: {
    neighborIp: string;
    peerAs?: number;        // Neighbor-level override
  }[];
}

/**
 * L3 Interface (for VPRN/IES)
 */
export interface L3Interface {
  interfaceName: string;
  description?: string;
  ipAddress?: string;
  portId?: string;
  vlanId?: number; // if sap 1/1/1:100
  mtu?: number;
  vplsName?: string; // routed-vpls 연동 시
  sapId?: string;
  spokeSdpId?: string;

  // QoS & Port Info
  qosPolicyId?: string;       // Generic/Deprecated
  ingressQosId?: string;      // Ingress QoS
  egressQosId?: string;       // Egress QoS
  ingressQosRate?: number;    // Ingress QoS rate (kbps)
  ingressQosRateMax?: boolean; // true if ingress rate is "max"
  egressQosRate?: number;     // Egress QoS rate (kbps)
  egressQosRateMax?: boolean;  // true if egress rate is "max"
  portDescription?: string;   // Physical Port description
  portEthernet?: PortEthernetConfig; // Port ethernet config

  // VRRP
  vrrpGroupId?: number;
  vrrpBackupIp?: string;
  vrrpPriority?: number;

  adminState: AdminState;
}

/**
 * 기본 서비스 인터페이스
 */
export interface BaseService {
  serviceId: number;
  serviceType: ServiceType;
  customerId: number;
  description: string;
  serviceName?: string;       // Service Name (e.g., "EPIPE_NAME")
  adminState: AdminState;
  operState?: OperState;
  serviceMtu?: number;
}

/**
 * Epipe Service (Point-to-Point L2 VPN)
 */
export interface EpipeService extends BaseService {
  serviceType: 'epipe';
  saps: SAP[];                // 정확히 2개 (Point-to-Point)
  spokeSdps?: SpokeSDP[];     // Spoke SDP (선택)
}

/**
 * VPLS Service (Multipoint L2 VPN)
 */
export interface VPLSService extends BaseService {
  serviceType: 'vpls';
  saps: SAP[];                // 여러 개 (Multipoint)
  meshSdps?: MeshSDP[];       // Mesh SDP
  spokeSdps?: SpokeSDP[];     // Spoke SDP
  macMoveShutdown?: boolean;  // MAC Move detected

  // VPLS 특화 설정
  fdbSize?: number;           // FDB 테이블 크기
  macLearning?: 'enabled' | 'disabled';
  macAging?: number;          // MAC aging time (초)
}

/**
 * VPRN Service (L3 VPN)
 */
export interface VPRNService extends BaseService {
  serviceType: 'vprn';
  autonomousSystem?: number;
  bgpRouterId?: string;       // BGP Router ID
  routeDistinguisher?: string;
  vrfTarget?: string;
  ecmp?: number;              // ecmp 16
  bgpSplitHorizon?: boolean;  // bgp > split-horizon
  bgpGroups?: BGPGroup[];     // bgp > group "name" > neighbor
  interfaces: L3Interface[];
  bgpNeighbors: { neighborIp: string; autonomousSystem?: number }[];
  staticRoutes: StaticRoute[];
  ospf?: OSPF;
}

/**
 * IES Service (L3 전용, VPRN과 유사)
 */
export interface IESService extends Omit<VPRNService, 'serviceType'> {
  serviceType: 'ies';
}

/**
 * 통합 Nokia 서비스 타입 (L2 + L3)
 */
export type NokiaService = EpipeService | VPLSService | VPRNService | IESService;

/**
 * 서비스 연결 타입
 */
export type ConnectionType = 'sap-sap' | 'sap-sdp' | 'sdp-sdp' | 'interface-interface';

/**
 * 연결 엔드포인트
 */
export interface ConnectionEndpoint {
  type: 'sap' | 'sdp' | 'interface';
  id: string;
  description: string;
}

/**
 * 서비스 연결 관계
 */
export interface ServiceConnection {
  serviceId: number;
  serviceType: ServiceType;
  sourceNode: string;         // 호스트명
  targetNode?: string;        // Far-End 기반 추론
  connectionType: ConnectionType;

  // 연결 상세 정보
  source: ConnectionEndpoint;
  target: ConnectionEndpoint;
}

/**
 * 파싱된 Nokia Config (v3 Parser 출력)
 */
export interface ParsedConfigV3 {
  hostname: string;
  systemIp: string;
  services: NokiaService[];
  sdps: SDP[];

  // 연결 관계 (계산된 값)
  connections: ServiceConnection[];
}

/**
 * Customer 정보
 */
export interface Customer {
  customerId: number;
  description: string;
}

/**
 * 파싱 옵션
 */
export interface ParseOptions {
  strict?: boolean;           // 엄격 모드 (기본: false)
  includeStats?: boolean;     // 통계 정보 포함 (기본: false)
  validateSyntax?: boolean;   // 문법 검증 (기본: true)
}
