// v2.x L2 VPN Service Types

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
 * QoS 정책
 */
export interface QosPolicy {
    policyId: number;
    policyName: string;
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

    // VPLS 특화 설정
    fdbSize?: number;           // FDB 테이블 크기
    macLearning?: 'enabled' | 'disabled';
    macAging?: number;          // MAC aging time (초)
}

/**
 * L3 Interface (for VPRN)
 */
export interface L3Interface {
    interfaceName: string;
    description: string;
    ipAddress?: string;         // IP/Prefix
    portId?: string;            // Physical Port or SAP
    vrrpGroupId?: number;
    vrrpBackupIp?: string;
    vrrpPriority?: number;
    adminState: AdminState;
}

/**
 * VPRN Service (L3 VPN)
 */
export interface VPRNService extends BaseService {
    serviceType: 'vprn';
    autonomousSystem?: number;
    routeDistinguisher?: string;
    interfaces: L3Interface[];
    bgpNeighbors: string[];     // Neighbor IPs
    staticRoutes: string[];     // Prefix/NextHop summaries
}

/**
 * 통합 L2 VPN 서비스 타입
 */
/**
 * 통합 서비스 타입 (L2 + L3)
 */
export type NokiaService = EpipeService | VPLSService | VPRNService;

// Legacy alias for backward compatibility
export type L2VPNService = NokiaService;

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
 * 파싱된 Nokia 설정 (L2 + L3)
 */
export interface ParsedL2VPNConfig {
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

/**
 * 파싱 결과 (확장)
 */
export interface ExtendedParsedL2VPNConfig extends ParsedL2VPNConfig {
    customers: Customer[];
    parseDate: Date;
    parseOptions?: ParseOptions;
    errors?: string[];
    warnings?: string[];
}
