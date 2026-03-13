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
    serviceName?: string;
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
    rate?: number;
    rateMax?: boolean;
}
/**
 * SAP (Service Access Point)
 */
export interface PortEthernetConfig {
    mode?: string;
    encapType?: string;
    mtu?: number;
    speed?: string;
    autonegotiate?: string;
    networkQueuePolicy?: string;
    lldp?: string;
}
export interface SAP {
    sapId: string;
    portId: string;
    vlanId: number;
    description: string;
    portDescription?: string;
    adminState: AdminState;
    llf?: boolean;
    portEthernet?: PortEthernetConfig;
    ingressQos?: QosPolicy;
    egressQos?: QosPolicy;
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
    farEnd: string;
    lspName?: string;
    deliveryType: DeliveryType;
    adminState: AdminState;
    operState?: OperState;
    keepAlive?: KeepAlive;
}
/**
 * Spoke SDP (Point-to-Point)
 */
export interface SpokeSDP {
    sdpId: number;
    vcId: number;
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
    saps: SAP[];
    spokeSdps?: SpokeSDP[];
}
/**
 * VPLS Service (Multipoint L2 VPN)
 */
export interface VPLSService extends BaseService {
    serviceType: 'vpls';
    saps: SAP[];
    meshSdps?: MeshSDP[];
    spokeSdps?: SpokeSDP[];
    macMoveShutdown?: boolean;
    fdbSize?: number;
    macLearning?: 'enabled' | 'disabled';
    macAging?: number;
}
/**
 * L3 Interface (for VPRN)
 */
export interface StaticRoute {
    prefix: string;
    nextHop: string;
}
export interface L3Interface {
    interfaceName: string;
    description?: string;
    ipAddress?: string;
    portId?: string;
    vlanId?: number;
    mtu?: number;
    vplsName?: string;
    sapId?: string;
    spokeSdpId?: string;
    qosPolicyId?: string;
    ingressQosId?: string;
    egressQosId?: string;
    ingressQosRate?: number;
    ingressQosRateMax?: boolean;
    egressQosRate?: number;
    egressQosRateMax?: boolean;
    portDescription?: string;
    portEthernet?: PortEthernetConfig;
    vrrpGroupId?: number;
    vrrpBackupIp?: string;
    vrrpPriority?: number;
    adminState: AdminState;
}
export interface OSPFInterface {
    interfaceName: string;
    interfaceType?: string;
    adminState: AdminState;
}
export interface OSPF {
    areas: Array<{
        areaId: string;
        interfaces: OSPFInterface[];
    }>;
    adminState: AdminState;
}
export interface BGPGroup {
    groupName: string;
    peerAs?: number;
    neighbors: {
        neighborIp: string;
        peerAs?: number;
    }[];
}
export interface VPRNService extends BaseService {
    serviceType: 'vprn';
    autonomousSystem?: number;
    bgpRouterId?: string;
    routeDistinguisher?: string;
    vrfTarget?: string;
    ecmp?: number;
    bgpSplitHorizon?: boolean;
    bgpGroups?: BGPGroup[];
    interfaces: L3Interface[];
    bgpNeighbors: {
        neighborIp: string;
        autonomousSystem?: number;
    }[];
    staticRoutes: StaticRoute[];
    ospf?: OSPF;
}
/**
 * 통합 L2 VPN 서비스 타입
 */
/**
 * 통합 서비스 타입 (L2 + L3)
 */
/**
 * IES 서비스 (VPRN과 유사하지만 L3 전용)
 */
export interface IESService extends Omit<VPRNService, 'serviceType'> {
    serviceType: 'ies';
}
/**
 * 통합 IP/MPLS 서비스 타입 (L2 + L3)
 */
export type NokiaService = EpipeService | VPLSService | VPRNService | IESService;
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
    sourceNode: string;
    targetNode?: string;
    connectionType: ConnectionType;
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
    strict?: boolean;
    includeStats?: boolean;
    validateSyntax?: boolean;
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
//# sourceMappingURL=services.d.ts.map