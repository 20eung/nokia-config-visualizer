import type { NokiaService, EpipeService, VPLSService, VPRNService, SAP, SDP, SpokeSDP, MeshSDP, PortEthernetConfig } from '../../types/services';
export type NokiaServiceV3 = NokiaService;
export interface ParsedConfigV3 {
    hostname: string;
    systemIp: string;
    services: NokiaServiceV3[];
    sdps: SDP[];
    connections: any[];
}
/**
 * 설정 파일에서 특정 섹션 추출
 */
/**
 * 설정 파일에서 특정 섹션 추출 (Indentation 기반)
 */
export declare function extractSection(configText: string, sectionName: string): string;
/**
 * 호스트명 추출
 */
export declare function extractHostname(configText: string): string;
/**
 * 시스템 IP 추출
 */
export declare function extractSystemIp(configText: string): string;
/**
 * sap-ingress / sap-egress 정책 정의 파싱 (line-by-line)
 * 정책 블록에서 rate 정보를 추출하여 Map<'ingress-{id}' | 'egress-{id}', { rate?, rateMax? }> 반환
 */
export declare function parseQosPolicyDefinitions(configText: string): Map<string, {
    rate?: number;
    rateMax?: boolean;
}>;
/**
 * SAP 파싱
 *
 * 위치 기반 추출 방식:
 * 1. 모든 `sap ... create` 시작 위치를 찾음
 * 2. 각 SAP의 내용 = 현재 create ~ 다음 SAP 시작 (또는 문자열 끝)
 * 이전 lookahead 방식은 마지막 SAP 뒤에 `no shutdown`이 오면 매칭 실패하는 버그가 있었음.
 */
export declare function parseSAPs(serviceContent: string): SAP[];
/**
 * Spoke SDP 파싱
 */
export declare function parseSpokeSDP(serviceContent: string): SpokeSDP[];
/**
 * Mesh SDP 파싱
 */
export declare function parseMeshSDP(serviceContent: string): MeshSDP[];
/**
 * Epipe 서비스 파싱
 */
export declare function parseEpipe(serviceId: number, customerId: number, content: string, serviceName?: string): EpipeService;
/**
 * VPLS 서비스 파싱
 */
export declare function parseVPLS(serviceId: number, customerId: number, content: string, serviceName?: string): VPLSService;
/**
 * VPRN 서비스 파싱
 */
export declare function parseVPRN(serviceId: number, customerId: number, content: string, serviceName?: string): VPRNService;
/**
 * L2/L3 VPN 서비스 파싱
 */
export declare function parseL2VPNServices(configText: string): NokiaServiceV3[];
/**
 * Port 정보 (Description + Ethernet config) 추출
 */
export interface PortInfo {
    description: string;
    ethernet?: PortEthernetConfig;
}
export declare function extractPortInfo(configText: string): Map<string, PortInfo>;
/**
 * Port Description 추출 (Global) - backward compatible wrapper
 */
export declare function extractPortDescriptions(configText: string): Map<string, string>;
/**
 * SDP 파싱
 */
export declare function parseSDPs(configText: string): SDP[];
/**
 * L2 VPN 설정 파싱 (메인 함수)
 */
export declare function parseL2VPNConfig(configText: string): ParsedConfigV3;
//# sourceMappingURL=parserV3.d.ts.map