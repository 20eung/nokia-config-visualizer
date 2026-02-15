# 📐 Nokia Config Visualizer v2.x 기술 스펙

> MPLS L2 VPN 서비스 토폴로지 시각화 - 상세 기술 명세

## 📋 목차

- [데이터 구조](#데이터-구조)
- [Nokia Config 파싱](#nokia-config-파싱)
- [다이어그램 생성 알고리즘](#다이어그램-생성-알고리즘)
- [API 설계](#api-설계)
- [파일 구조](#파일-구조)
- [성능 고려사항](#성능-고려사항)

---

## 🗂 데이터 구조

### TypeScript 타입 정의

#### 1. Service 기본 타입

```typescript
// src/types/v2.ts

export type ServiceType = 'epipe' | 'vpls' | 'ies' | 'vprn';

export interface BaseService {
  serviceId: number;
  serviceType: ServiceType;
  customerId: number;
  description: string;
  adminState: 'up' | 'down';
  operState: 'up' | 'down';
}
```

#### 2. SAP (Service Access Point)

```typescript
export interface SAP {
  sapId: string;              // 예: "1/1/1:100"
  portId: string;             // 예: "1/1/1" 또는 "lag-1"
  vlanId: number;             // 예: 100
  description: string;
  adminState: 'up' | 'down';
  
  // QoS 정보
  ingressQos?: {
    policyId: number;
    policyName: string;
  };
  egressQos?: {
    policyId: number;
    policyName: string;
  };
  
  // 통계 정보 (선택)
  stats?: {
    ingressPackets: number;
    egressPackets: number;
    ingressBytes: number;
    egressBytes: number;
  };
}
```

#### 3. SDP (Service Distribution Point)

```typescript
export interface SDP {
  sdpId: number;
  description: string;
  farEnd: string;             // Far-End IP 주소
  lspName?: string;           // LSP 이름
  deliveryType: 'mpls' | 'gre';
  adminState: 'up' | 'down';
  operState: 'up' | 'down';
  
  // Keep-alive 정보
  keepAlive?: {
    enabled: boolean;
    interval: number;
    timeout: number;
  };
}
```

#### 4. Epipe Service

```typescript
export interface EpipeService extends BaseService {
  serviceType: 'epipe';
  saps: SAP[];                // 정확히 2개 (Point-to-Point)
  sdps?: SpokeSDP[];          // Spoke SDP (선택)
}

export interface SpokeSDP {
  sdpId: number;
  vcId: number;               // VC ID
  description: string;
}
```

#### 5. VPLS Service

```typescript
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

export interface MeshSDP {
  sdpId: number;
  vcId: number;
  description: string;
}
```

#### 6. 통합 Service 타입

```typescript
export type L2VPNService = EpipeService | VPLSService;

export interface ParsedL2VPNConfig {
  hostname: string;
  systemIp: string;
  services: L2VPNService[];
  sdps: SDP[];
  
  // 연결 관계 (계산된 값)
  connections: ServiceConnection[];
}

export interface ServiceConnection {
  serviceId: number;
  serviceType: ServiceType;
  sourceNode: string;         // 호스트명
  targetNode: string;         // Far-End 기반 추론
  connectionType: 'sap-sap' | 'sap-sdp' | 'sdp-sdp';
  
  // 연결 상세 정보
  source: {
    type: 'sap' | 'sdp';
    id: string;
    description: string;
  };
  target: {
    type: 'sap' | 'sdp';
    id: string;
    description: string;
  };
}
```

---

## 🔍 Nokia Config 파싱

### 파싱 로직

#### 1. Service 섹션 파싱

```typescript
// src/utils/v2/l2vpnParser.ts

export function parseL2VPNServices(configText: string): L2VPNService[] {
  const services: L2VPNService[] = [];
  
  // Service 섹션 추출
  const serviceSection = extractSection(configText, 'service');
  
  // Epipe 파싱
  const epipeMatches = serviceSection.matchAll(
    /epipe\s+(\d+)\s+customer\s+(\d+)\s+create([\s\S]*?)exit/g
  );
  
  for (const match of epipeMatches) {
    const [, serviceId, customerId, content] = match;
    const epipe = parseEpipe(
      parseInt(serviceId),
      parseInt(customerId),
      content
    );
    services.push(epipe);
  }
  
  // VPLS 파싱
  const vplsMatches = serviceSection.matchAll(
    /vpls\s+(\d+)\s+customer\s+(\d+)\s+create([\s\S]*?)exit/g
  );
  
  for (const match of vplsMatches) {
    const [, serviceId, customerId, content] = match;
    const vpls = parseVPLS(
      parseInt(serviceId),
      parseInt(customerId),
      content
    );
    services.push(vpls);
  }
  
  return services;
}
```

#### 2. SAP 파싱

```typescript
function parseSAPs(serviceContent: string): SAP[] {
  const saps: SAP[] = [];
  
  const sapMatches = serviceContent.matchAll(
    /sap\s+([\w\/-]+:\d+)\s+create([\s\S]*?)exit/g
  );
  
  for (const match of sapMatches) {
    const [, sapId, content] = match;
    
    // SAP ID 파싱 (예: "1/1/1:100" → port: "1/1/1", vlan: 100)
    const [portId, vlanStr] = sapId.split(':');
    const vlanId = parseInt(vlanStr);
    
    // Description 추출
    const descMatch = content.match(/description\s+"([^"]+)"/);
    const description = descMatch ? descMatch[1] : '';
    
    // QoS 정책 추출
    const ingressQosMatch = content.match(/ingress\s+qos\s+(\d+)/);
    const egressQosMatch = content.match(/egress\s+qos\s+(\d+)/);
    
    saps.push({
      sapId,
      portId,
      vlanId,
      description,
      adminState: 'up',
      ingressQos: ingressQosMatch ? {
        policyId: parseInt(ingressQosMatch[1]),
        policyName: `qos-${ingressQosMatch[1]}`
      } : undefined,
      egressQos: egressQosMatch ? {
        policyId: parseInt(egressQosMatch[1]),
        policyName: `qos-${egressQosMatch[1]}`
      } : undefined,
    });
  }
  
  return saps;
}
```

#### 3. SDP 파싱

```typescript
export function parseSDPs(configText: string): SDP[] {
  const sdps: SDP[] = [];
  
  const serviceSection = extractSection(configText, 'service');
  const sdpMatches = serviceSection.matchAll(
    /sdp\s+(\d+)\s+(mpls|gre)\s+create([\s\S]*?)exit/g
  );
  
  for (const match of sdpMatches) {
    const [, sdpId, deliveryType, content] = match;
    
    // Far-End IP 추출
    const farEndMatch = content.match(/far-end\s+([\d.]+)/);
    const farEnd = farEndMatch ? farEndMatch[1] : '';
    
    // LSP 이름 추출
    const lspMatch = content.match(/lsp\s+"([^"]+)"/);
    const lspName = lspMatch ? lspMatch[1] : undefined;
    
    // Description 추출
    const descMatch = content.match(/description\s+"([^"]+)"/);
    const description = descMatch ? descMatch[1] : '';
    
    sdps.push({
      sdpId: parseInt(sdpId),
      description,
      farEnd,
      lspName,
      deliveryType: deliveryType as 'mpls' | 'gre',
      adminState: 'up',
      operState: 'up',
    });
  }
  
  return sdps;
}
```

---

## 🎨 다이어그램 생성 알고리즘

### Mermaid 다이어그램 생성

#### 1. Epipe 다이어그램

```typescript
// src/utils/v2/mermaidGeneratorV2.ts

export function generateEpipeDiagram(
  epipe: EpipeService,
  hostname: string
): string {
  const lines: string[] = [];
  
  lines.push('graph LR');
  lines.push('');
  
  // SAP 노드 생성
  const sap1 = epipe.saps[0];
  const sap2 = epipe.saps[1];
  
  const sap1Id = `SAP_${sap1.sapId.replace(/[/:]/g, '_')}`;
  const sap2Id = `SAP_${sap2.sapId.replace(/[/:]/g, '_')}`;
  
  // SAP 노드 정의
  lines.push(`${sap1Id}["${sap1.description}<br/>SAP: ${sap1.sapId}"]`);
  lines.push(`${sap2Id}["${sap2.description}<br/>SAP: ${sap2.sapId}"]`);
  
  // Epipe 서비스 노드
  const serviceId = `EPIPE_${epipe.serviceId}`;
  lines.push(`${serviceId}{{"Epipe ${epipe.serviceId}<br/>${epipe.description}"}}`);
  
  // 연결
  lines.push(`${sap1Id} -->|Port: ${sap1.portId}<br/>VLAN: ${sap1.vlanId}| ${serviceId}`);
  lines.push(`${serviceId} -->|Port: ${sap2.portId}<br/>VLAN: ${sap2.vlanId}| ${sap2Id}`);
  
  // 스타일
  lines.push('');
  lines.push(`style ${serviceId} fill:#e1f5ff,stroke:#01579b,stroke-width:2px`);
  
  return lines.join('\n');
}
```

#### 2. VPLS 다이어그램

```typescript
export function generateVPLSDiagram(
  vpls: VPLSService,
  hostname: string
): string {
  const lines: string[] = [];
  
  lines.push('graph TB');
  lines.push('');
  
  // VPLS 인스턴스 중심 노드
  const vplsId = `VPLS_${vpls.serviceId}`;
  lines.push(`${vplsId}{{"VPLS ${vpls.serviceId}<br/>${vpls.description}"}}`);
  
  // 각 SAP를 VPLS에 연결
  vpls.saps.forEach((sap, index) => {
    const sapId = `SAP_${sap.sapId.replace(/[/:]/g, '_')}`;
    
    lines.push(`${sapId}["${sap.description}<br/>SAP: ${sap.sapId}"]`);
    lines.push(`${sapId} -->|Port: ${sap.portId}<br/>VLAN: ${sap.vlanId}| ${vplsId}`);
  });
  
  // Spoke SDP 연결
  if (vpls.spokeSdps) {
    vpls.spokeSdps.forEach(sdp => {
      const sdpId = `SDP_${sdp.sdpId}`;
      lines.push(`${sdpId}["SDP ${sdp.sdpId}<br/>${sdp.description}"]`);
      lines.push(`${vplsId} -.->|VC: ${sdp.vcId}| ${sdpId}`);
    });
  }
  
  // 스타일
  lines.push('');
  lines.push(`style ${vplsId} fill:#fff3e0,stroke:#e65100,stroke-width:2px`);
  
  return lines.join('\n');
}
```

#### 3. Multi-hop 경로 추적

```typescript
export function generateMultiHopDiagram(
  services: L2VPNService[],
  sdps: SDP[],
  allConfigs: ParsedL2VPNConfig[]
): string {
  const lines: string[] = [];
  
  lines.push('graph LR');
  lines.push('');
  
  // 라우터 노드 맵 생성
  const routerMap = new Map<string, ParsedL2VPNConfig>();
  allConfigs.forEach(config => {
    routerMap.set(config.systemIp, config);
  });
  
  // SDP Far-End 기반 라우터 간 연결 추적
  services.forEach(service => {
    if (service.serviceType === 'epipe' && service.sdps) {
      service.sdps.forEach(spokeSdp => {
        const sdp = sdps.find(s => s.sdpId === spokeSdp.sdpId);
        if (sdp) {
          const targetRouter = routerMap.get(sdp.farEnd);
          if (targetRouter) {
            // Multi-hop 경로 표시
            lines.push(`Router_A -->|SDP ${sdp.sdpId}| Router_B`);
          }
        }
      });
    }
  });
  
  return lines.join('\n');
}
```

---

## 🔌 API 설계

### 파서 API

```typescript
// src/utils/v2/index.ts

export interface L2VPNParserAPI {
  /**
   * Nokia Config 파일에서 L2 VPN 서비스 파싱
   */
  parseL2VPNConfig(configText: string): ParsedL2VPNConfig;
  
  /**
   * 여러 Config 파일에서 서비스 연결 관계 분석
   */
  analyzeServiceConnections(
    configs: ParsedL2VPNConfig[]
  ): ServiceConnection[];
  
  /**
   * Service ID로 특정 서비스 검색
   */
  findServiceById(
    configs: ParsedL2VPNConfig[],
    serviceId: number
  ): L2VPNService | undefined;
  
  /**
   * Customer ID로 서비스 필터링
   */
  filterServicesByCustomer(
    configs: ParsedL2VPNConfig[],
    customerId: number
  ): L2VPNService[];
}
```

### 다이어그램 생성 API

```typescript
export interface DiagramGeneratorAPI {
  /**
   * Epipe 서비스 다이어그램 생성
   */
  generateEpipeDiagram(
    epipe: EpipeService,
    hostname: string
  ): string;
  
  /**
   * VPLS 서비스 다이어그램 생성
   */
  generateVPLSDiagram(
    vpls: VPLSService,
    hostname: string
  ): string;
  
  /**
   * Multi-hop 경로 다이어그램 생성
   */
  generateMultiHopDiagram(
    serviceId: number,
    configs: ParsedL2VPNConfig[]
  ): string;
  
  /**
   * 전체 L2 VPN 토폴로지 다이어그램
   */
  generateFullTopology(
    configs: ParsedL2VPNConfig[]
  ): string;
}
```

---

## 📁 파일 구조

```
src/
├── types/
│   ├── v1.ts              # v1 타입 (기존)
│   └── v2.ts              # v2 타입 (신규)
│       ├── Service types
│       ├── SAP types
│       ├── SDP types
│       └── Connection types
│
├── utils/
│   ├── v1/                # v1 유틸 (기존)
│   │   ├── nokiaParser.ts
│   │   ├── mermaidGenerator.ts
│   │   └── TopologyEngine.ts
│   │
│   └── v2/                # v2 유틸 (신규)
│       ├── l2vpnParser.ts         # L2 VPN 파서
│       ├── mermaidGeneratorV2.ts  # v2 다이어그램 생성
│       ├── serviceAnalyzer.ts     # 서비스 연결 분석
│       └── index.ts               # API 통합
│
├── components/
│   ├── common/            # 공통 컴포넌트
│   │   ├── FileUpload.tsx
│   │   └── VersionSelector.tsx
│   │
│   ├── v1/                # v1 컴포넌트 (기존)
│   │   ├── PhysicalTopologyViewer.tsx
│   │   └── InterfaceList.tsx
│   │
│   └── v2/                # v2 컴포넌트 (신규)
│       ├── L2VPNServiceList.tsx   # 서비스 목록
│       ├── EpipeViewer.tsx        # Epipe 뷰어
│       ├── VPLSViewer.tsx         # VPLS 뷰어
│       └── ServiceDiagram.tsx     # 다이어그램 표시
│
└── pages/
    ├── V1Page.tsx         # v1 페이지
    └── V2Page.tsx         # v2 페이지
```

---

## ⚡ 성능 고려사항

### 1. 파싱 최적화

```typescript
// 대용량 Config 파일 처리
export function parseL2VPNConfigOptimized(
  configText: string
): ParsedL2VPNConfig {
  // 1. 필요한 섹션만 추출 (전체 파싱 방지)
  const serviceSection = extractSection(configText, 'service');
  
  // 2. 정규식 미리 컴파일
  const epipeRegex = /epipe\s+(\d+)\s+customer\s+(\d+)\s+create([\s\S]*?)exit/g;
  
  // 3. 스트림 방식 파싱 (메모리 효율)
  const services = parseServicesStream(serviceSection);
  
  return {
    hostname: extractHostname(configText),
    systemIp: extractSystemIp(configText),
    services,
    sdps: parseSDPs(serviceSection),
    connections: [],
  };
}
```

### 2. 다이어그램 렌더링 최적화

```typescript
// 대규모 VPLS (100+ SAP) 처리
export function generateVPLSDiagramOptimized(
  vpls: VPLSService
): string {
  // SAP 개수가 많으면 그룹화
  if (vpls.saps.length > 50) {
    return generateGroupedVPLSDiagram(vpls);
  }
  
  return generateVPLSDiagram(vpls, '');
}

function generateGroupedVPLSDiagram(vpls: VPLSService): string {
  // SAP를 포트별로 그룹화
  const groupedSaps = groupSAPsByPort(vpls.saps);
  
  // 그룹 단위로 표시
  // ...
}
```

### 3. 메모리 관리

```typescript
// 여러 Config 파일 처리 시 메모리 관리
export class L2VPNConfigManager {
  private configs: Map<string, ParsedL2VPNConfig> = new Map();
  
  addConfig(hostname: string, config: ParsedL2VPNConfig) {
    this.configs.set(hostname, config);
  }
  
  // 사용하지 않는 Config 제거
  removeConfig(hostname: string) {
    this.configs.delete(hostname);
  }
  
  // 메모리 정리
  clear() {
    this.configs.clear();
  }
}
```

---

## 🧪 테스트 전략

### 단위 테스트

```typescript
// src/utils/v2/__tests__/l2vpnParser.test.ts

describe('L2VPN Parser', () => {
  test('should parse Epipe service correctly', () => {
    const config = `
      service
        epipe 100 customer 1 create
          description "Test Epipe"
          sap 1/1/1:100 create
            description "Site A"
            exit
          sap 1/1/2:100 create
            description "Site B"
            exit
          exit
    `;
    
    const result = parseL2VPNServices(config);
    
    expect(result).toHaveLength(1);
    expect(result[0].serviceType).toBe('epipe');
    expect(result[0].serviceId).toBe(100);
    expect(result[0].saps).toHaveLength(2);
  });
});
```

---

**작성일**: 2026-01-09  
**버전**: v2.0.0-spec  
**작성자**: Network Engineers
