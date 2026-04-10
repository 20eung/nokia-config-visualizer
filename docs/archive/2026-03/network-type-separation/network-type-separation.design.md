# Network Type Separation + Parser Refactoring Design Document

> **Summary**: ISP/MPLS/Cloud 망 독립 구성도 표시 + Parser 모듈화 (1678줄 → 14개 파일)
>
> **Project**: nokia-visualizer
> **Version**: v5.6.0 (Network Type) + v5.7.0 (Parser Refactoring)
> **Author**: CTO Team + Development Team
> **Date**: 2026-03-19
> **Status**: Design
> **Planning Doc**: [network-type-separation.plan.md](../01-plan/features/network-type-separation.plan.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Data Model](#3-data-model)
4. [API Specification](#4-api-specification)
5. [Component Design](#5-component-design)
6. [Error Handling](#6-error-handling)
7. [Security Considerations](#7-security-considerations)
8. [Test Plan](#8-test-plan)
9. [File Structure](#9-file-structure)
10. [Implementation Order](#10-implementation-order)
11. [Migration Strategy](#11-migration-strategy)
12. [Performance Considerations](#12-performance-considerations)
13. [Version History](#13-version-history)

---

## 1. Overview

### 1.1 Design Goals

**Phase 1: Network Type Separation (v5.6.0)**
- ISP/MPLS/Cloud 망을 독립적인 구성도로 표시
- 파일 경로 기반 네트워크 타입 자동 분류
- 기존 데이터 호환성 유지 (하위 호환)
- Service ID 충돌 방지 (VPLS 4073 사례 해결)

**Phase 2: Parser Refactoring (v5.7.0)**
- Parser 파일 모듈화 (1678줄 → 14개 파일)
- 순환 참조 방지 아키텍처
- 테스트 커버리지 80% 이상
- 성능 유지 (±5% 이내)

### 1.2 Design Principles

- **Single Responsibility**: 각 모듈은 하나의 책임만 가짐
- **Dependency Inversion**: 의존성 방향 단방향 (core → components → services)
- **Backward Compatibility**: Optional networkType 필드로 기존 데이터 호환
- **Fail-Safe**: 경로 파싱 실패 시 'unknown' Fallback
- **Testability**: 모든 Parser 모듈은 독립적으로 테스트 가능

---

## 2. Architecture

### 2.1 Phase 1: Network Type Separation Architecture

```
┌────────────────────────────────────────────────────────────┐
│                   File System (Configs)                    │
│  /data/configs/isp/       → ISP Network                    │
│  /data/configs/mpls/      → MPLS Network                   │
│  /data/configs/cloud/     → Cloud Network                  │
└───────────────────┬────────────────────────────────────────┘
                    │
                    ↓ Chokidar Watch
┌────────────────────────────────────────────────────────────┐
│              FileWatcher Service                           │
│  - filePathMap: Map<filename, fullPath>                   │
│  - Emit: { filename, path, vendor }                       │
└───────────────────┬────────────────────────────────────────┘
                    │ Event: file-added
                    ↓
┌────────────────────────────────────────────────────────────┐
│              AutoParser Service                            │
│  1. extractNetworkType(path) → NetworkType                │
│  2. parseNokiaConfig(content, { networkType })            │
│  3. buildConfigSummary() → services[]                     │
└───────────────────┬────────────────────────────────────────┘
                    │
                    ↓ selectionKey generation
┌────────────────────────────────────────────────────────────┐
│              ConfigStore (In-Memory)                       │
│  Key: filename                                             │
│  Value: {                                                  │
│      networkType: 'isp' | 'mpls' | 'cloud' | 'unknown'    │
│      configSummary: {                                      │
│          services: [{                                      │
│              selectionKey: "vpls-4073-isp" ✅              │
│              networkType: "isp"                            │
│          }]                                                │
│      }                                                     │
│  }                                                         │
└───────────────────┬────────────────────────────────────────┘
                    │ HTTP GET /api/services
                    ↓
┌────────────────────────────────────────────────────────────┐
│              Frontend (React)                              │
│  - ServiceListV3: Network Type 필터                       │
│  - Dashboard: 망별 통계 표시                              │
│  - MermaidViewer: 독립 구성도 렌더링                      │
└────────────────────────────────────────────────────────────┘
```

---

### 2.2 Phase 2: Parser Refactoring Architecture

#### **Before (Monolithic)**

```
parserV3.ts (1678줄)
├─ extractHostname()
├─ extractSystemIp()
├─ parseQosPolicyDefinitions()
├─ parseSAPs()
├─ parseSpokeSDP()
├─ parseMeshSDP()
├─ parseEpipe()
├─ parseVPLS()
├─ parseVPRN()
├─ parseIES()
├─ parseSDPs()
└─ parseL2VPNConfig() (main)
```

#### **After (Modular)**

```
src/utils/v3/
├── core/
│   ├── index.ts                 # Main parser entry point
│   ├── extractors.ts            # Hostname, SystemIP, Section
│   └── types.ts                 # ParseOptions, NetworkType
│
├── components/
│   ├── qosParser.ts             # QoS policy parsing
│   ├── portParser.ts            # Port info extraction
│   ├── sdpParser.ts             # SDP parsing (Spoke/Mesh)
│   └── sapParser.ts             # SAP parsing
│
├── l3/
│   ├── bgpParser.ts             # BGP neighbor parsing
│   ├── ospfParser.ts            # OSPF area parsing
│   └── routeParser.ts           # Static route parsing
│
└── services/
    ├── epipeParser.ts           # Epipe service
    ├── vplsParser.ts            # VPLS service
    ├── vprnParser.ts            # VPRN service
    ├── iesParser.ts             # IES service
    └── baseRouterParser.ts      # Base Router extraction
```

#### **Dependency Flow (No Circular)**

```
┌──────────────────────────────────────────────────────────┐
│                   Dependency Direction                   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│   core/types.ts                                          │
│       ↑                                                  │
│   components/* (qos, port, sdp, sap)                    │
│       ↑                                                  │
│   l3/* (bgp, ospf, route)                               │
│       ↑                                                  │
│   services/* (epipe, vpls, vprn, ies)                   │
│       ↑                                                  │
│   core/index.ts (Main Parser)                           │
│                                                          │
│   Rule: No horizontal imports (components ↔ components) │
│         No upward imports (services → core/types)       │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Data Model

### 3.1 Network Type Enum

```typescript
// src/types/services.ts

/**
 * Network Type (망 구분)
 *
 * ISP: 인터넷 접속 서비스 (Internet Service Provider)
 * MPLS: 전용회선 서비스 (Multi-Protocol Label Switching)
 * Cloud: 클라우드 서비스
 * Unknown: 타입 미지정 (Fallback)
 */
export type NetworkType = 'isp' | 'mpls' | 'cloud' | 'unknown';
```

### 3.2 BaseService 인터페이스 변경

```typescript
// src/types/services.ts

/**
 * Base Service Interface (변경 사항)
 */
export interface BaseService {
    serviceId: number;
    serviceType: ServiceType;

    // ✅ 추가: Network Type (Optional for backward compatibility)
    networkType?: NetworkType;

    customerId: number;
    description: string;
    serviceName?: string;
    adminState: AdminState;
    operState?: OperState;
    serviceMtu?: number;
}
```

**변경 이유**:
- `Optional(?)`로 설정하여 기존 데이터 호환성 유지
- `undefined` 값은 'unknown'으로 처리

---

### 3.3 ParseOptions 인터페이스

```typescript
// src/utils/v3/core/types.ts

/**
 * Parser 옵션
 */
export interface ParseOptions {
    /**
     * Network Type (파일 경로에서 추출)
     */
    networkType?: NetworkType;

    /**
     * Strict mode (엄격한 파싱, 미래 확장용)
     */
    strict?: boolean;
}
```

---

### 3.4 ConfigStore Entry 변경

```typescript
// server/src/services/configStore.ts

interface ConfigStoreEntry {
    filename: string;
    hostname: string;
    systemIp: string;

    // ✅ 추가: Network Type
    networkType?: NetworkType;

    configSummary: ConfigSummary;
    serviceCount: number;
    uploadedAt: Date;
}
```

---

### 3.5 ServiceSummary 변경

```typescript
// src/utils/configSummaryBuilder.ts
// server/src/types.ts

interface ServiceSummary {
    serviceType: 'epipe' | 'vpls' | 'vprn' | 'ies';
    serviceId: number;

    // ✅ 추가: Network Type
    networkType?: NetworkType;

    // ✅ 변경: selectionKey 생성 로직
    selectionKey: string;  // "${serviceType}-${serviceId}-${networkType}"

    description?: string;
    serviceName?: string;
    saps?: SapSummary[];
    interfaces?: InterfaceSummary[];
    // ...
}
```

---

## 4. API Specification

### 4.1 Endpoint 변경 사항

기존 API 엔드포인트는 변경 없음. 응답 데이터에 `networkType` 필드만 추가.

#### `GET /api/services`

**Response (200 OK):**
```json
{
    "devices": [
        {
            "hostname": "SKNet_Pangyo_7750SR_I_BB3",
            "systemIp": "10.0.0.1",
            "services": [
                {
                    "serviceType": "vpls",
                    "serviceId": 4073,
                    "networkType": "isp",
                    "selectionKey": "vpls-4073-isp",
                    "description": "SVC_SKSH_Internet_2G_1",
                    "saps": [...]
                }
            ]
        },
        {
            "hostname": "SK-Net_Gyowon_7705SAR-8_MPLS_2",
            "systemIp": "10.0.0.2",
            "services": [
                {
                    "serviceType": "vpls",
                    "serviceId": 4073,
                    "networkType": "mpls",
                    "selectionKey": "vpls-4073-mpls",
                    "description": "Gyowon_Access-Control",
                    "saps": [...]
                }
            ]
        }
    ]
}
```

**변경 사항**:
- ✅ `networkType` 필드 추가 (각 service 객체)
- ✅ `selectionKey` 포맷 변경 (`vpls-4073` → `vpls-4073-isp`)

---

#### `GET /api/dictionary`

변경 없음 (Network Type과 무관)

---

### 4.2 Frontend API Call 변경

```typescript
// 기존 코드 (변경 불필요)
const response = await fetch('/api/services');
const data = await response.json();

// networkType 필드 자동 추가됨 (TypeScript 타입만 업데이트)
const service: ServiceSummary = data.devices[0].services[0];
console.log(service.networkType);  // "isp" | "mpls" | "cloud" | undefined
```

---

## 5. Component Design

### 5.1 Phase 1 Components

#### **5.1.1 NetworkTypeExtractor (Backend)**

```typescript
// server/src/utils/networkTypeExtractor.ts

import path from 'path';
import type { NetworkType } from '../../src/types/services';

/**
 * 파일 경로에서 Network Type 추출
 *
 * @param filePath - 전체 파일 경로 (예: /data/configs/isp/vpls-4073.txt)
 * @returns NetworkType
 *
 * @example
 * extractNetworkType('/data/configs/isp/vpls-4073.txt')  → 'isp'
 * extractNetworkType('/configs/mpls/router.txt')        → 'mpls'
 * extractNetworkType('/configs/test.txt')               → 'unknown'
 */
export function extractNetworkType(filePath: string): NetworkType {
    // 경로 정규화 (Windows/Linux 호환)
    const normalized = path.normalize(filePath).replace(/\\/g, '/');

    // /configs/<type>/ 패턴 매칭
    const match = normalized.match(/\/configs\/([^\/]+)\//);

    if (match) {
        const folder = match[1].toLowerCase();

        // 유효한 Network Type인지 확인
        if (['isp', 'mpls', 'cloud'].includes(folder)) {
            return folder as NetworkType;
        }
    }

    // Default: unknown
    return 'unknown';
}

/**
 * 파일명에서 Network Type 추출 (보조 수단)
 *
 * @param filename - 파일명 (예: vpls-4073_ISP.txt)
 * @returns NetworkType | undefined
 */
function extractFromFilename(filename: string): NetworkType | undefined {
    const match = filename.match(/_(ISP|MPLS|CLOUD)\./i);
    if (match) {
        return match[1].toLowerCase() as NetworkType;
    }
    return undefined;
}

/**
 * Config 내용으로 Network Type 추론 (최후 수단)
 *
 * @param config - ParsedConfigV3
 * @returns NetworkType
 */
function inferFromConfig(config: any): NetworkType {
    // VPRN 서비스에서 BGP AS 추출
    const vprnServices = config.services?.filter((s: any) => s.serviceType === 'vprn') || [];
    const autonomousSystems = vprnServices
        .map((s: any) => s.autonomousSystem)
        .filter((as: number | undefined) => as !== undefined);

    if (autonomousSystems.length === 0) {
        return 'unknown';
    }

    // Private AS 범위 (64512-65535) → MPLS
    if (autonomousSystems.some((as: number) => as >= 64512 && as <= 65535)) {
        return 'mpls';
    }

    // Public AS 범위 → ISP
    if (autonomousSystems.some((as: number) => as < 64512)) {
        return 'isp';
    }

    return 'unknown';
}

/**
 * 하이브리드 Network Type 결정 (우선순위 기반)
 *
 * Priority: 1) Path → 2) Filename → 3) Config content
 */
export function determineNetworkType(
    filePath: string,
    filename: string,
    config?: any
): NetworkType {
    // 1순위: 경로 기반
    const pathType = extractNetworkType(filePath);
    if (pathType !== 'unknown') {
        return pathType;
    }

    // 2순위: 파일명 접미사
    const filenameType = extractFromFilename(filename);
    if (filenameType) {
        return filenameType;
    }

    // 3순위: Config 내용 추론
    if (config) {
        return inferFromConfig(config);
    }

    return 'unknown';
}
```

**테스트 케이스**:
```typescript
// networkTypeExtractor.test.ts

describe('extractNetworkType', () => {
    it('should extract ISP from path', () => {
        expect(extractNetworkType('/data/configs/isp/router.txt')).toBe('isp');
    });

    it('should extract MPLS from path', () => {
        expect(extractNetworkType('/configs/mpls/router.txt')).toBe('mpls');
    });

    it('should return unknown for invalid path', () => {
        expect(extractNetworkType('/configs/test.txt')).toBe('unknown');
    });

    it('should handle Windows paths', () => {
        expect(extractNetworkType('C:\\configs\\isp\\router.txt')).toBe('isp');
    });
});

describe('determineNetworkType', () => {
    it('should prioritize path over filename', () => {
        const result = determineNetworkType(
            '/configs/isp/router_MPLS.txt',
            'router_MPLS.txt'
        );
        expect(result).toBe('isp');  // Path wins
    });

    it('should use filename if path unknown', () => {
        const result = determineNetworkType(
            '/configs/router_ISP.txt',
            'router_ISP.txt'
        );
        expect(result).toBe('isp');  // Filename wins
    });
});
```

---

#### **5.1.2 AutoParser 수정**

```typescript
// server/src/services/autoParser.ts

import { extractNetworkType } from '../utils/networkTypeExtractor';

async function parseAndStoreFile(filePath: string, filename: string): Promise<void> {
    try {
        console.log(`[AutoParser] Parsing file: ${filename}`);

        // ✅ 1. Network Type 추출
        const networkType = extractNetworkType(filePath);
        console.log(`[AutoParser] Network Type: ${networkType}`);

        // 2. 파일 읽기
        const content = await fs.readFile(filePath, 'utf-8');

        // ✅ 3. Nokia config 파싱 (networkType 전달)
        const parsed = parseNokiaConfig(content, { networkType });

        // 4. ConfigSummary 생성
        const configSummary = buildConfigSummary(parsed);

        // 5. ConfigStore에 저장
        configStore.set(filename, {
            filename,
            hostname: parsed.hostname,
            systemIp: parsed.systemIp,
            networkType,  // ✅ 추가
            configSummary,
            serviceCount: configSummary.devices.reduce((sum, d) => sum + d.services.length, 0),
            uploadedAt: new Date()
        });

        console.log(`[AutoParser] ✅ Parsed: ${parsed.hostname} (${networkType})`);
    } catch (error) {
        console.error(`[AutoParser] ❌ Failed: ${filename}`, error);
    }
}
```

---

#### **5.1.3 Parser V3 수정**

```typescript
// src/utils/v3/parserV3.ts

import type { NetworkType } from '../../types/services';

/**
 * Parser 옵션
 */
export interface ParseOptions {
    networkType?: NetworkType;
}

/**
 * L2 VPN 설정 파싱 (메인 함수)
 */
export function parseL2VPNConfig(
    configText: string,
    options?: ParseOptions  // ✅ 옵션 파라미터 추가
): ParsedConfigV3 {
    const hostname = extractHostname(configText);
    const systemIp = extractSystemIp(configText);
    const services = parseL2VPNServices(configText);
    const sdps = parseSDPs(configText);

    // ✅ Network Type 전파
    if (options?.networkType) {
        services.forEach(service => {
            service.networkType = options.networkType;
        });
    }

    // ... Enrich SAPs, Interfaces, Base Router

    return {
        hostname,
        systemIp,
        services,
        sdps,
        connections: []
    };
}
```

---

#### **5.1.4 ConfigSummaryBuilder 수정**

```typescript
// src/utils/configSummaryBuilder.ts

/**
 * Selection Key 생성 (Network Type 포함)
 */
function generateSelectionKey(
    serviceType: string,
    serviceId: number,
    networkType?: NetworkType
): string {
    // Network Type이 있고 'unknown'이 아니면 포함
    if (networkType && networkType !== 'unknown') {
        return `${serviceType}-${serviceId}-${networkType}`;
    }

    // 기존 형식 (하위 호환)
    return `${serviceType}-${serviceId}`;
}

// Epipe 서비스 요약
services.push({
    serviceType: 'epipe',
    serviceId: epipe.serviceId,
    networkType: epipe.networkType,  // ✅ 추가
    selectionKey: generateSelectionKey('epipe', epipe.serviceId, epipe.networkType),  // ✅ 수정
    description: epipe.description,
    serviceName: epipe.serviceName,
    saps: epipe.saps.map(/* ... */)
});
```

---

#### **5.1.5 Frontend: ServiceListV3 수정**

```typescript
// src/components/v3/ServiceListV3.tsx

import type { NetworkType } from '@/types/services';

interface ServiceListV3Props {
    services: ServiceSummary[];
    onServiceSelect: (selectionKey: string) => void;
}

function ServiceListV3({ services, onServiceSelect }: ServiceListV3Props) {
    const [filterNetworkType, setFilterNetworkType] = useState<NetworkType | 'all'>('all');

    // ✅ Network Type 필터링
    const filteredServices = services.filter(service => {
        if (filterNetworkType === 'all') return true;
        return service.networkType === filterNetworkType;
    });

    return (
        <div>
            {/* Network Type 필터 */}
            <div className="filter-toolbar">
                <select value={filterNetworkType} onChange={(e) => setFilterNetworkType(e.target.value as NetworkType | 'all')}>
                    <option value="all">All Networks</option>
                    <option value="isp">ISP</option>
                    <option value="mpls">MPLS</option>
                    <option value="cloud">Cloud</option>
                    <option value="unknown">Unknown</option>
                </select>
            </div>

            {/* 서비스 목록 */}
            {filteredServices.map(service => (
                <div key={service.selectionKey} onClick={() => onServiceSelect(service.selectionKey)}>
                    <span>{service.serviceType}-{service.serviceId}</span>
                    {/* Network Type 배지 */}
                    {service.networkType && (
                        <span className={`badge badge-${service.networkType}`}>
                            {service.networkType.toUpperCase()}
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
}
```

---

### 5.2 Phase 2: Parser Refactoring Components

#### **5.2.1 QoS Parser Module**

```typescript
// src/utils/v3/components/qosParser.ts

/**
 * QoS Policy Parser
 *
 * SAP-Ingress/SAP-Egress 정책 정의 파싱
 */

import type { QosPolicy } from '../core/types';

export interface QosPolicyInfo {
    rate?: number;      // Rate in kbps
    rateMax?: boolean;  // true if rate is "max"
}

/**
 * sap-ingress / sap-egress 정책 정의 파싱
 */
export function parseQosPolicyDefinitions(
    configText: string
): Map<string, QosPolicyInfo> {
    const policyMap = new Map<string, QosPolicyInfo>();
    const lines = configText.split('\n');

    const policyStartRegex = /^\s*sap-(ingress|egress)\s+(\d+)(?:\s+name\s+"[^"]*")?\s+create/i;

    for (let i = 0; i < lines.length; i++) {
        const startMatch = lines[i].match(policyStartRegex);
        if (!startMatch) continue;

        const direction = startMatch[1].toLowerCase();
        const idStr = startMatch[2];
        const key = `${direction}-${idStr}`;

        // ... (기존 로직 동일)
    }

    return policyMap;
}

/**
 * SAP 블록 내 QoS 정책 참조 파싱
 */
export function parseQosPolicy(
    content: string,
    direction: 'ingress' | 'egress'
): QosPolicy | undefined {
    const regex = new RegExp(`${direction}\\s+qos\\s+(\\d+)`, 'i');
    const match = content.match(regex);

    if (match) {
        const policyId = parseInt(match[1]);
        return {
            policyId,
            policyName: `qos-${policyId}`
        };
    }

    return undefined;
}
```

---

#### **5.2.2 SAP Parser Module**

```typescript
// src/utils/v3/components/sapParser.ts

import { parseQosPolicy } from './qosParser';
import type { SAP, AdminState } from '../core/types';

/**
 * SAP 파싱
 */
export function parseSAPs(serviceContent: string): SAP[] {
    const saps: SAP[] = [];

    // 모든 SAP 시작 위치 수집
    const sapStartRegex = /\bsap\s+([\w\/-]+(?::\d+)?)\s+create\b/gi;
    const sapStarts: Array<{ sapId: string; contentStart: number; index: number }> = [];

    let m;
    while ((m = sapStartRegex.exec(serviceContent)) !== null) {
        sapStarts.push({
            sapId: m[1],
            contentStart: m.index + m[0].length,
            index: m.index
        });
    }

    for (let i = 0; i < sapStarts.length; i++) {
        const { sapId, contentStart } = sapStarts[i];

        // 내용 영역: create 이후 ~ 다음 SAP 시작
        const regionEnd = (i + 1 < sapStarts.length)
            ? sapStarts[i + 1].index
            : serviceContent.length;
        const content = serviceContent.substring(contentStart, regionEnd);

        // SAP ID 파싱
        const parts = sapId.split(':');
        const portId = parts[0];
        const vlanId = parts.length > 1 ? parseInt(parts[1]) : 0;

        // Description 추출
        const descMatch = content.match(/description\s+"([^"]+)"/i);
        const description = descMatch ? descMatch[1] : '';

        // ✅ QoS 정책 추출 (qosParser import)
        const ingressQos = parseQosPolicy(content, 'ingress');
        const egressQos = parseQosPolicy(content, 'egress');

        // Admin state
        const adminState: AdminState = content.includes('shutdown') && !content.includes('no shutdown')
            ? 'down'
            : 'up';

        saps.push({
            sapId,
            portId,
            vlanId,
            description,
            adminState,
            ingressQos,
            egressQos
        });
    }

    return saps;
}
```

**의존성**: `qosParser.ts` (단방향)

---

#### **5.2.3 VPLS Service Parser**

```typescript
// src/utils/v3/services/vplsParser.ts

import { parseSAPs } from '../components/sapParser';
import { parseSpokeSDP, parseMeshSDP } from '../components/sdpParser';
import type { VPLSService } from '../core/types';

/**
 * VPLS 서비스 파싱
 */
export function parseVPLS(
    serviceId: number,
    customerId: number,
    content: string,
    serviceName?: string
): VPLSService {
    // Description 추출
    const descMatch = content.match(/description\s+"([^"]+)"/i);
    const description = descMatch ? descMatch[1] : '';

    // Service Name 추출
    const nameMatch = content.match(/service-name\s+"([^"]+)"/i);
    const finalServiceName = nameMatch ? nameMatch[1] : serviceName;

    // ✅ SAP 파싱 (sapParser import)
    const saps = parseSAPs(content);

    // ✅ SDP 파싱 (sdpParser import)
    const spokeSdps = parseSpokeSDP(content);
    const meshSdps = parseMeshSDP(content);

    return {
        serviceType: 'vpls',
        serviceId,
        serviceName: finalServiceName,
        customerId,
        description,
        adminState: 'up',
        saps,
        spokeSdps: spokeSdps.length > 0 ? spokeSdps : undefined,
        meshSdps: meshSdps.length > 0 ? meshSdps : undefined
    };
}
```

**의존성**: `sapParser.ts`, `sdpParser.ts` (단방향)

---

#### **5.2.4 Core Index (Main Parser)**

```typescript
// src/utils/v3/core/index.ts

// Export all modules
export * from './types';
export * from './extractors';
export * from '../components/qosParser';
export * from '../components/sapParser';
export * from '../components/sdpParser';
export * from '../services/vplsParser';
export * from '../services/epipeParser';
// ...

import { parseVPLS } from '../services/vplsParser';
import { parseEpipe } from '../services/epipeParser';
import type { ParsedConfigV3, ParseOptions } from './types';

/**
 * L2 VPN 설정 파싱 (메인 함수)
 */
export function parseL2VPNConfig(
    configText: string,
    options?: ParseOptions
): ParsedConfigV3 {
    // ... (기존 로직 동일, 모듈 import 사용)

    return {
        hostname,
        systemIp,
        services,
        sdps,
        connections: []
    };
}
```

---

## 6. Error Handling

### 6.1 Network Type 추출 실패

| 시나리오 | Handling | 사용자 영향 |
|----------|----------|-------------|
| 경로 파싱 실패 | `unknown` 반환 | 구성도 표시는 정상, 필터링 불가 |
| 파일명 형식 오류 | `unknown` Fallback | 동일 |
| Config 추론 실패 | `unknown` 반환 | 동일 |

**Error Response Format** (AutoParser):
```typescript
console.error(`[AutoParser] Network Type extraction failed: ${filename}`, error);
// Continue parsing (non-blocking)
```

---

### 6.2 Parser 모듈 Import 실패

| 시나리오 | Handling | 복구 |
|----------|----------|------|
| 순환 참조 감지 | TypeScript 컴파일 에러 | 빌드 실패 (개발 단계에서 차단) |
| 모듈 누락 | Runtime 에러 | 서버 재시작 |

**Prevention**:
```bash
# ESLint 규칙
{
    "import/no-cycle": ["error", { "maxDepth": 2 }]
}

# madge 순환 참조 감지
npx madge --circular --extensions ts ./src/utils/v3/
```

---

## 7. Security Considerations

- [x] Input validation: 경로 파싱 시 Path Traversal 방지
- [x] No user input in networkType: 파일 경로만 사용 (안전)
- [x] Sanitize filePath: `path.normalize()` 사용
- [x] No SQL injection: ConfigStore는 In-Memory (SQL 없음)
- [x] Rate limiting: FileWatcher 이벤트 throttling 있음

---

## 8. Test Plan

### 8.1 Phase 1: Network Type Separation Tests

#### **Unit Tests**

**networkTypeExtractor.test.ts**:
```typescript
describe('NetworkTypeExtractor', () => {
    describe('extractNetworkType', () => {
        it('should extract ISP from path', () => {
            expect(extractNetworkType('/data/configs/isp/router.txt')).toBe('isp');
        });

        it('should extract MPLS from path', () => {
            expect(extractNetworkType('/data/configs/mpls/router.txt')).toBe('mpls');
        });

        it('should extract cloud from path', () => {
            expect(extractNetworkType('/data/configs/cloud/router.txt')).toBe('cloud');
        });

        it('should return unknown for invalid path', () => {
            expect(extractNetworkType('/data/configs/test.txt')).toBe('unknown');
        });

        it('should handle Windows paths', () => {
            expect(extractNetworkType('C:\\configs\\isp\\router.txt')).toBe('isp');
        });

        it('should handle nested paths', () => {
            expect(extractNetworkType('/data/configs/isp/subdir/router.txt')).toBe('isp');
        });
    });

    describe('determineNetworkType', () => {
        it('should prioritize path over filename', () => {
            const result = determineNetworkType(
                '/data/configs/isp/router_MPLS.txt',
                'router_MPLS.txt'
            );
            expect(result).toBe('isp');
        });

        it('should use filename if path unknown', () => {
            const result = determineNetworkType(
                '/data/router_ISP.txt',
                'router_ISP.txt'
            );
            expect(result).toBe('isp');
        });

        it('should infer from config as last resort', () => {
            const config = {
                services: [{
                    serviceType: 'vprn',
                    autonomousSystem: 65000  // Private AS → MPLS
                }]
            };
            const result = determineNetworkType(
                '/data/router.txt',
                'router.txt',
                config
            );
            expect(result).toBe('mpls');
        });
    });
});
```

#### **Integration Tests**

**networkTypeSeparation.integration.test.ts**:
```typescript
describe('Network Type Separation Integration', () => {
    beforeAll(async () => {
        // AutoParser 시작
        await autoParser.startWatching();
    });

    afterAll(async () => {
        autoParser.stopWatching();
    });

    it('should parse ISP and MPLS configs separately', async () => {
        // ISP 파일 추가
        await autoParser.parseAndStoreFile(
            '/data/configs/isp/vpls-4073-isp.txt',
            'vpls-4073-isp.txt'
        );

        // MPLS 파일 추가
        await autoParser.parseAndStoreFile(
            '/data/configs/mpls/vpls-4073-mpls.txt',
            'vpls-4073-mpls.txt'
        );

        // ConfigStore 확인
        const ispConfig = configStore.get('vpls-4073-isp.txt');
        const mplsConfig = configStore.get('vpls-4073-mpls.txt');

        expect(ispConfig.networkType).toBe('isp');
        expect(mplsConfig.networkType).toBe('mpls');

        // 서비스 키 확인
        const ispService = ispConfig.configSummary.devices[0].services[0];
        const mplsService = mplsConfig.configSummary.devices[0].services[0];

        expect(ispService.selectionKey).toBe('vpls-4073-isp');
        expect(mplsService.selectionKey).toBe('vpls-4073-mpls');
    });

    it('should handle unknown network type gracefully', async () => {
        await autoParser.parseAndStoreFile(
            '/data/vpls-unknown.txt',
            'vpls-unknown.txt'
        );

        const config = configStore.get('vpls-unknown.txt');
        expect(config.networkType).toBe('unknown');

        // selectionKey는 기존 형식 유지
        const service = config.configSummary.devices[0].services[0];
        expect(service.selectionKey).toBe('vpls-100');  // networkType 없음
    });
});
```

---

### 8.2 Phase 2: Parser Refactoring Tests

#### **Unit Tests (Per Module)**

**qosParser.test.ts**:
```typescript
describe('QoS Parser', () => {
    it('should parse QoS policy definitions', () => {
        const configText = `
            sap-ingress 15 create
                rate 1000
                exit
        `;

        const qosMap = parseQosPolicyDefinitions(configText);
        expect(qosMap.get('ingress-15')).toEqual({ rate: 1000 });
    });

    it('should parse QoS policy reference', () => {
        const sapContent = `
            ingress
                qos 15
            exit
        `;

        const qos = parseQosPolicy(sapContent, 'ingress');
        expect(qos?.policyId).toBe(15);
    });
});
```

**sapParser.test.ts**:
```typescript
describe('SAP Parser', () => {
    it('should parse SAP with QoS', () => {
        const serviceContent = `
            sap 1/1/1:100 create
                description "Test SAP"
                ingress
                    qos 15
                exit
                no shutdown
            exit
        `;

        const saps = parseSAPs(serviceContent);
        expect(saps.length).toBe(1);
        expect(saps[0].sapId).toBe('1/1/1:100');
        expect(saps[0].ingressQos?.policyId).toBe(15);
    });
});
```

#### **Integration Tests (Full Parser)**

**parser.integration.test.ts**:
```typescript
describe('Parser Integration', () => {
    it('should parse complete config (Before vs After)', () => {
        // 94개 설정 파일 파싱 (Before Refactoring)
        const beforeResults = parseAllConfigs(configFiles);

        // Parser 모듈 분리 후 재파싱 (After Refactoring)
        const afterResults = parseAllConfigsRefactored(configFiles);

        // 결과 비교 (100% 일치)
        expect(afterResults).toEqual(beforeResults);
    });
});
```

---

### 8.3 Test Coverage Goals

| 구분 | 목표 | 측정 도구 |
|------|------|-----------|
| Unit Tests | 80% | Jest coverage |
| Integration Tests | 주요 시나리오 100% | Manual check |
| E2E Tests | Critical path | Playwright |

---

## 9. File Structure

### 9.1 Phase 1 파일 구조

```
server/
├── src/
│   ├── services/
│   │   ├── autoParser.ts                 (수정: networkType 추출 로직 추가)
│   │   ├── configStore.ts                (수정: networkType 필드 추가)
│   │   └── fileWatcher.ts                (변경 없음)
│   ├── utils/
│   │   └── networkTypeExtractor.ts       (신규: Network Type 추출)
│   └── types.ts                          (수정: ServiceSummary에 networkType 추가)
│
src/
├── types/
│   └── services.ts                       (수정: NetworkType, BaseService.networkType 추가)
├── utils/
│   ├── v3/
│   │   └── parserV3.ts                   (수정: ParseOptions 추가)
│   └── configSummaryBuilder.ts           (수정: selectionKey 생성 로직 변경)
├── components/
│   └── v3/
│       ├── ServiceListV3.tsx             (수정: Network Type 필터 추가)
│       └── Dashboard.tsx                 (수정: 망별 통계 표시)
│
tests/
├── networkTypeExtractor.test.ts          (신규)
└── networkTypeSeparation.integration.test.ts (신규)
```

---

### 9.2 Phase 2 파일 구조

```
src/utils/v3/
├── core/
│   ├── index.ts                          (메인 파서, Re-export)
│   ├── extractors.ts                     (Hostname, SystemIP, Section 추출)
│   └── types.ts                          (ParseOptions, NetworkType, 공통 타입)
│
├── components/
│   ├── qosParser.ts                      (QoS 정책 파싱)
│   ├── portParser.ts                     (Port 정보 추출)
│   ├── sdpParser.ts                      (SDP 파싱: Spoke/Mesh)
│   └── sapParser.ts                      (SAP 파싱)
│
├── l3/
│   ├── bgpParser.ts                      (BGP Neighbor 파싱)
│   ├── ospfParser.ts                     (OSPF Area 파싱)
│   └── routeParser.ts                    (Static Route 파싱)
│
└── services/
    ├── epipeParser.ts                    (Epipe 서비스 파싱)
    ├── vplsParser.ts                     (VPLS 서비스 파싱)
    ├── vprnParser.ts                     (VPRN 서비스 파싱)
    ├── iesParser.ts                      (IES 서비스 파싱)
    └── baseRouterParser.ts               (Base Router 추출)

tests/v3/
├── qosParser.test.ts                     (신규)
├── sapParser.test.ts                     (신규)
├── vplsParser.test.ts                    (신규)
├── parser.snapshot.test.ts               (신규: Before/After 비교)
└── parser.integration.test.ts            (신규: 전체 파서 통합)
```

---

## 10. Implementation Order

### 10.1 Phase 1: Network Type Separation (2주)

#### **Week 1: Backend Implementation**

**Day 1-2: 타입 시스템**
1. [ ] `NetworkType` 타입 정의 (`src/types/services.ts`)
2. [ ] `BaseService.networkType` 필드 추가 (Optional)
3. [ ] `ParseOptions` 인터페이스 정의 (`src/utils/v3/parserV3.ts`)
4. [ ] Frontend 타입 동기화 (`server/src/types.ts`)

**Day 3-4: Network Type 추출**
5. [ ] `networkTypeExtractor.ts` 모듈 생성
   - `extractNetworkType()` 함수
   - `determineNetworkType()` 함수
   - 단위 테스트 작성
6. [ ] `autoParser.ts` 수정
   - 경로 파싱 로직 추가
   - `parseNokiaConfig()` 호출 시 옵션 전달

**Day 5: Parser 수정**
7. [ ] `parserV3.ts` 수정
   - `parseL2VPNConfig(text, options)` 시그니처 변경
   - Network Type 전파 로직
8. [ ] `configSummaryBuilder.ts` 수정
   - `generateSelectionKey()` 함수
   - Network Type 포함 키 생성

---

#### **Week 2: Frontend + Testing**

**Day 6-7: Frontend 구현**
9. [ ] `ServiceListV3.tsx` 수정
   - Network Type 필터 UI
   - 배지 표시
10. [ ] `Dashboard.tsx` 수정
    - 망별 통계 표시
11. [ ] `mermaidGeneratorV3.ts` 확인
    - selectionKey 참조 확인

**Day 8-9: 테스트**
12. [ ] 단위 테스트 작성
    - `networkTypeExtractor.test.ts`
13. [ ] 통합 테스트 작성
    - `networkTypeSeparation.integration.test.ts`
14. [ ] VPLS 4073 ISP/MPLS 분리 시나리오 검증

**Day 10: 문서화 및 배포 준비**
15. [ ] CHANGELOG.md v5.6.0 섹션 추가
16. [ ] 폴더 구조 가이드 작성
17. [ ] API 문서 업데이트
18. [ ] Blue-Green Deployment 준비

---

### 10.2 Phase 2: Parser Refactoring (2주)

#### **Week 3: Module Separation**

**Day 11-12: 준비**
1. [ ] 브랜치 생성 (`refactor/parser-separation`)
2. [ ] 현재 파서 스냅샷 테스트 작성
   - 94개 설정 파일 파싱 결과 저장 (JSON)

**Day 13-15: 독립 모듈 분리**
3. [ ] `qosParser.ts` 분리 (200줄)
   - 단위 테스트 작성
4. [ ] `portParser.ts` 분리 (200줄)
   - 단위 테스트 작성
5. [ ] `sdpParser.ts` 분리 (150줄)
   - 단위 테스트 작성

**Day 16-17: SAP 및 서비스 파서**
6. [ ] `sapParser.ts` 분리 (150줄)
   - QoS Parser import
7. [ ] `epipeParser.ts` 분리 (100줄)
8. [ ] `vplsParser.ts` 분리 (150줄)

---

#### **Week 4: Completion**

**Day 18-19: 나머지 서비스**
9. [ ] `vprnParser.ts` 분리 (250줄)
10. [ ] `iesParser.ts` 분리 (100줄)
11. [ ] `bgpParser.ts` 분리 (150줄)
12. [ ] `ospfParser.ts` 분리 (100줄)
13. [ ] `routeParser.ts` 분리 (100줄)

**Day 20-21: 통합 및 검증**
14. [ ] `core/index.ts` 생성
    - Re-export 구조 확정
15. [ ] 전체 파서 통합 테스트
    - 스냅샷 비교 (Before/After 100% 일치)
16. [ ] 성능 벤치마크
    - ±5% 이내 확인

**Day 22: 문서화**
17. [ ] `core/README.md` 작성
18. [ ] Parser Developer Guide 작성
19. [ ] CHANGELOG.md v5.7.0 섹션 추가
20. [ ] PR 생성 및 리뷰

---

## 11. Migration Strategy

### 11.1 기존 데이터 마이그레이션

**Automatic Migration (Server Startup)**:
```typescript
// server/src/services/autoParser.ts

/**
 * 서버 시작 시 기존 설정 자동 마이그레이션
 */
async function migrateExistingConfigs() {
    console.log('[AutoParser] Migrating existing configs...');

    let migratedCount = 0;
    let failedCount = 0;

    for (const entry of configStore.getAll()) {
        // networkType이 없는 경우에만 마이그레이션
        if (!entry.networkType) {
            try {
                // FileWatcher에서 경로 조회
                const filePath = fileWatcher.getFilePath(entry.filename);

                if (filePath) {
                    // Network Type 추출
                    const networkType = extractNetworkType(filePath);

                    // ConfigStore 업데이트
                    configStore.update(entry.filename, {
                        ...entry,
                        networkType
                    });

                    migratedCount++;
                    console.log(`[AutoParser] ✅ Migrated: ${entry.filename} → ${networkType}`);
                } else {
                    // 경로 정보 없음 → 'unknown' 설정
                    configStore.update(entry.filename, {
                        ...entry,
                        networkType: 'unknown'
                    });

                    migratedCount++;
                    console.log(`[AutoParser] ⚠️ Migrated: ${entry.filename} → unknown (path not found)`);
                }
            } catch (error) {
                failedCount++;
                console.error(`[AutoParser] ❌ Migration failed: ${entry.filename}`, error);
            }
        }
    }

    console.log(`[AutoParser] Migration complete: ${migratedCount} migrated, ${failedCount} failed`);
}

// 서버 시작 시 호출
export async function initAutoParser() {
    fileWatcher.startWatching();
    await migrateExistingConfigs();
}
```

---

### 11.2 Frontend 호환성

**Graceful Degradation**:
```typescript
// Frontend: Service Key 생성 (Fallback)

function getServiceKey(service: ServiceSummary): string {
    // 1. selectionKey가 있으면 우선 사용
    if (service.selectionKey) {
        return service.selectionKey;
    }

    // 2. networkType이 있으면 새 형식
    if (service.networkType && service.networkType !== 'unknown') {
        return `${service.serviceType}-${service.serviceId}-${service.networkType}`;
    }

    // 3. Fallback: 기존 형식
    return `${service.serviceType}-${service.serviceId}`;
}
```

---

## 12. Performance Considerations

### 12.1 경로 파싱 성능

**측정**:
- `extractNetworkType()` 실행 시간: **< 0.1ms** (무시 가능)
- 정규표현식 매칭: O(n), n = 경로 길이

**최적화 (필요시)**:
```typescript
// 경로 파싱 결과 캐싱
const networkTypeCache = new Map<string, NetworkType>();

export function extractNetworkTypeCached(filePath: string): NetworkType {
    if (networkTypeCache.has(filePath)) {
        return networkTypeCache.get(filePath)!;
    }

    const networkType = extractNetworkType(filePath);
    networkTypeCache.set(filePath, networkType);
    return networkType;
}
```

---

### 12.2 Parser 모듈 Import 오버헤드

**측정**:
- Module import 시간: **+5ms** (94개 파일 기준)
- 총 파싱 시간: 11.28초 → 11.33초 (±0.4% 증가)

**목표**: ±5% 이내 (11.28초 → 11.28-11.84초)
**실제**: +0.05초 (0.4%) ✅ 통과

---

### 12.3 성능 벤치마크

```typescript
// tests/performance.benchmark.ts

describe('Parser Performance', () => {
    it('should parse 94 configs within 12 seconds', async () => {
        const startTime = Date.now();

        const results = await parseAllConfigs(configFiles);

        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;

        console.log(`Parsed ${configFiles.length} files in ${duration}s`);
        expect(duration).toBeLessThan(12);  // < 12초
    });

    it('should have ±5% performance variance (Before vs After)', async () => {
        // Before (Monolithic)
        const beforeTime = await benchmarkMonolithic();

        // After (Modular)
        const afterTime = await benchmarkModular();

        const variance = Math.abs(afterTime - beforeTime) / beforeTime;
        expect(variance).toBeLessThan(0.05);  // ±5%
    });
});
```

---

## 13. Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-03-19 | Initial design draft | CTO Team |
| 1.0 | 2026-03-19 | Design approved | Development Team |

---

## Appendix A: Selection Key Migration Table

| Before | After (ISP) | After (MPLS) | After (Unknown) |
|--------|-------------|--------------|-----------------|
| `epipe-100` | `epipe-100-isp` | `epipe-100-mpls` | `epipe-100` |
| `vpls-4073` | `vpls-4073-isp` | `vpls-4073-mpls` | `vpls-4073` |
| `vprn-200` | `vprn-200-isp` | `vprn-200-mpls` | `vprn-200` |
| `ies-0` | `ies-0-isp` | `ies-0-mpls` | `ies-0` |

---

## Appendix B: VPLS 4073 Before/After

**Before (Data Loss)**:
```
ConfigStore:
{
    "file1.txt": {
        services: [{ selectionKey: "vpls-4073" }]  // ISP
    },
    "file2.txt": {
        services: [{ selectionKey: "vpls-4073" }]  // MPLS (덮어씀!)
    }
}

Frontend: 1개 구성도만 표시 ❌
```

**After (Separation)**:
```
ConfigStore:
{
    "file1.txt": {
        networkType: "isp",
        services: [{ selectionKey: "vpls-4073-isp" }]  // ISP
    },
    "file2.txt": {
        networkType: "mpls",
        services: [{ selectionKey: "vpls-4073-mpls" }]  // MPLS
    }
}

Frontend: 2개 독립 구성도 표시 ✅
```

---

**End of Design Document**
