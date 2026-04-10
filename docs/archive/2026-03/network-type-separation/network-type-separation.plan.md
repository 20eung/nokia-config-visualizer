# PDCA Plan: Network Type Separation + Parser Refactoring

> **Status**: 🟡 Planning
> **Version**: v5.6.0 (Network Type) + v5.7.0 (Parser Refactoring)
> **Created**: 2026-03-19
> **Project**: nokia-visualizer

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Goals and Success Criteria](#goals-and-success-criteria)
4. [Technical Analysis](#technical-analysis)
5. [Solution Design](#solution-design)
6. [Implementation Plan](#implementation-plan)
7. [Risk Management](#risk-management)
8. [Timeline and Milestones](#timeline-and-milestones)
9. [Appendix](#appendix)

---

## 1. Executive Summary

### 1.1 프로젝트 개요

**배경**: nokia-visualizer에서 ISP 망과 MPLS 망이 독립적으로 구성되어 있어 같은 Service ID를 사용할 수 있으나, 현재 파서는 이를 구분하지 못하여 하나의 구성도로 표시하는 문제 발생.

**목표**:
- **Phase 1**: Network Type Separation 구현 (ISP/MPLS/Cloud 망 분리)
- **Phase 2**: Parser 파일 분리 (1678줄 → 모듈화)

**기대 효과**:
- ✅ ISP/MPLS 망 독립적 구성도 표시
- ✅ 데이터 손실 방지 (Service ID 충돌 해결)
- ✅ 코드 유지보수성 향상 (모듈화)
- ✅ 병렬 개발 지원 (파일 분리)

### 1.2 CTO 검토 결과

**아키텍처 평가**: ✅ 승인 (타당성 9/10)
- Network Type Separation은 필수 기능
- Parser 분리는 장기 투자로 권장
- 단계적 마이그레이션 필수

**리스크 레벨**: 🟡 Medium
- 기존 데이터 호환성 주의 필요
- Frontend 구성도 키 전면 수정 필요
- Blue-Green Deployment 권장

---

## 2. Problem Statement

### 2.1 현재 문제점

#### **Problem 1: Service ID 충돌로 인한 데이터 손실**

**사례**: VPLS 4073
```
ISP 망:
- SKNet_Pangyo_7750SR_I_BB3: SVC_SKSH_Internet_2G_1
- SKNet_Pangyo_7750SR_I_BB4: SVC_SKSH_Internet_2G_2

MPLS 망:
- SK-Net_Gyowon_7705SAR-8_MPLS_2: Gyowon_Access-Control
```

**현재 동작**:
```typescript
// selectionKey 생성 (configSummaryBuilder.ts:149)
selectionKey: `vpls-4073`  // ❌ 동일한 키

// ConfigStore에 저장 시
configStore.set('file1.txt', { services: [{ selectionKey: 'vpls-4073' }] });
configStore.set('file2.txt', { services: [{ selectionKey: 'vpls-4073' }] });
// → 마지막 파일만 남고 이전 데이터 손실!
```

**영향**:
- ISP 망 또는 MPLS 망 중 하나의 구성도만 표시됨
- 사용자가 전체 네트워크를 파악할 수 없음
- 데이터 무결성 문제

---

#### **Problem 2: Parser 파일 크기 (1678줄)**

**현재 상태**: `src/utils/v3/parserV3.ts`
```typescript
// 1678줄에 모든 파싱 로직 포함
- Hostname/SystemIP 추출: 150줄
- QoS 파싱: 200줄
- Port 정보: 200줄
- SAP 파싱: 150줄
- SDP 파싱: 150줄
- Epipe/VPLS/VPRN/IES: 800줄
- Base Router: 300줄
```

**문제점**:
- ❌ 인지 부하 높음 (한 파일에서 8개 서비스 타입 파싱)
- ❌ 테스트 어려움 (단위 테스트 작성 복잡)
- ❌ 병렬 개발 불가 (Git 충돌 빈번)
- ❌ 코드 리뷰 어려움 (PR이 너무 큼)

---

### 2.2 User Pain Points

**사용자 요청**:
> "TwinTreeTower_Access-Control과 Gyowon_Access-Control 두 개가 별개인 것 같은데 같은 구성도로 표시됨."

**분석**:
- 사용자는 VPLS Name으로 별개 서비스로 인식
- 실제로는 **ISP 망**과 **MPLS 망**의 서로 다른 VPLS 4073
- 파서는 파일 경로 정보를 사용하지 않아 구분 불가

---

## 3. Goals and Success Criteria

### 3.1 Phase 1: Network Type Separation

#### **Goal 1: ISP/MPLS/Cloud 망 독립 구성도 표시**

**Success Criteria**:
- ✅ VPLS 4073 (ISP) + VPLS 4073 (MPLS) → 두 개의 독립 구성도
- ✅ `selectionKey`: `vpls-4073-isp`, `vpls-4073-mpls`
- ✅ 데이터 손실 없음 (ConfigStore 중복 키 제거)

**Acceptance Test**:
```bash
# 1. ISP 파일 파싱
curl -X POST /api/upload -F "file=@/configs/isp/vpls-4073.txt"
# → selectionKey: "vpls-4073-isp"

# 2. MPLS 파일 파싱
curl -X POST /api/upload -F "file=@/configs/mpls/vpls-4073.txt"
# → selectionKey: "vpls-4073-mpls"

# 3. 두 구성도 모두 조회 가능
curl /api/services
# → 2개 서비스 반환 (vpls-4073-isp, vpls-4073-mpls)
```

---

#### **Goal 2: 기존 데이터 호환성 유지**

**Success Criteria**:
- ✅ `networkType: undefined` 서비스는 `unknown`으로 처리
- ✅ 기존 `selectionKey` 형식 지원 (Fallback)
- ✅ 자동 마이그레이션 (경로 재파싱)

**Acceptance Test**:
```typescript
// Legacy 데이터 (networkType 없음)
const legacyService = {
    serviceId: 100,
    serviceType: 'vpls',
    // networkType: undefined
};

// Frontend에서 키 생성
const key = generateServiceKey(legacyService);
// → "vpls-100" (기존 형식 유지)
```

---

### 3.2 Phase 2: Parser Refactoring

#### **Goal 3: Parser 파일 모듈화**

**Success Criteria**:
- ✅ 파일당 150-400줄 (관리 가능한 크기)
- ✅ 논리적 분류 (services/, components/, l3/)
- ✅ 순환 참조 없음

**Target Structure**:
```
src/utils/v3/
├── core/
│   ├── index.ts             (메인 파서, 200줄)
│   ├── extractors.ts        (Hostname/SystemIP, 150줄)
│   └── types.ts             (공통 타입, 50줄)
├── services/
│   ├── epipeParser.ts       (100줄)
│   ├── vplsParser.ts        (150줄)
│   ├── vprnParser.ts        (250줄)
│   └── iesParser.ts         (100줄)
├── components/
│   ├── sapParser.ts         (150줄)
│   ├── sdpParser.ts         (150줄)
│   ├── qosParser.ts         (200줄)
│   └── portParser.ts        (200줄)
└── l3/
    ├── bgpParser.ts         (150줄)
    ├── ospfParser.ts        (100줄)
    └── routeParser.ts       (100줄)
```

**Acceptance Test**:
```bash
# 1. 기존 파싱 결과 스냅샷 저장
npm run test:parser:snapshot

# 2. 리팩토링 수행

# 3. 파싱 결과 동일성 검증
npm run test:parser:compare
# → 100% 일치
```

---

#### **Goal 4: 테스트 커버리지 향상**

**Success Criteria**:
- ✅ 단위 테스트 커버리지: 80% 이상
- ✅ 통합 테스트: 전체 Config 파싱 검증
- ✅ 성능 테스트: Before/After 비교 (±5% 이내)

---

## 4. Technical Analysis

### 4.1 현재 아키텍처 분석

#### **4.1.1 파일 경로 구조**

```bash
/data/configs/
├── isp/               # ISP 인터넷 접속 서비스
│   ├── SKNet_Pangyo_7750SR_I_BB3.txt
│   └── SKNet_Pangyo_7750SR_I_BB4.txt
├── mpls/              # MPLS 전용회선 서비스
│   ├── SK-Net_Gyowon_7705SAR-8_MPLS_2.txt
│   └── SKNet_PangyoITC2F_7750SR_MPLS_1.txt
└── cloud/             # Cloud 서비스
    └── ...
```

**관찰**:
- 파일 경로로 네트워크 타입 구분 가능
- 현재 FileWatcher는 경로 정보를 추적 중 (`filePathMap`)
- Parser는 경로 정보를 받지 못함 ❌

---

#### **4.1.2 현재 데이터 흐름**

```
FileWatcher (파일 감지)
    ↓ filename, path
autoParser.parseAndStoreFile()
    ↓ content only (경로 정보 손실!)
parseNokiaConfig(content)
    ↓ ParsedConfigV3 (networkType 없음)
buildConfigSummary()
    ↓ selectionKey: `${serviceType}-${serviceId}`
ConfigStore.set()
    → 중복 키 발생 시 덮어쓰기 ❌
```

**문제**: 경로 정보가 Parser까지 전달되지 않음

---

### 4.2 기술적 제약사항

#### **Constraint 1: TypeScript 타입 시스템**

**현재 타입**:
```typescript
// src/types/services.ts
export interface BaseService {
    serviceId: number;
    serviceType: ServiceType;
    // networkType: 없음
    ...
}
```

**영향**:
- `BaseService` 변경 → 모든 서비스 타입 영향 (Epipe, VPLS, VPRN, IES)
- Frontend/Backend 타입 동기화 필요
- 마이그레이션 복잡도 증가

---

#### **Constraint 2: 기존 데이터 호환성**

**ConfigStore 데이터**:
```typescript
{
    "filename": "vpls-100.txt",
    "hostname": "RouterA",
    "configSummary": {
        "devices": [{
            "services": [{
                "selectionKey": "vpls-100",  // networkType 없음
                "serviceId": 100,
                ...
            }]
        }]
    }
}
```

**제약**:
- 이미 파싱된 수백 개 파일 존재
- `networkType` 필드 없음
- Graceful Degradation 필요

---

### 4.3 의존성 분석

#### **영향 받는 모듈**

| 모듈 | 파일 | 수정 범위 | 복잡도 |
|------|------|-----------|--------|
| 타입 정의 | `src/types/services.ts` | NetworkType 추가 | 🟢 Low |
| 백엔드 Parser | `src/utils/v3/parserV3.ts` | options 파라미터 추가 | 🟡 Medium |
| 백엔드 AutoParser | `server/src/services/autoParser.ts` | 경로 파싱 로직 추가 | 🟡 Medium |
| 백엔드 Store | `server/src/services/configStore.ts` | selectionKey 생성 변경 | 🟡 Medium |
| 프론트엔드 List | `src/components/v3/ServiceListV3.tsx` | 키 생성 로직 변경 | 🔴 High |
| 프론트엔드 Mermaid | `src/utils/v3/mermaidGeneratorV3.ts` | 키 참조 변경 | 🟡 Medium |

---

## 5. Solution Design

### 5.1 Phase 1: Network Type Separation

#### **5.1.1 아키텍처 설계**

```
┌─────────────────────────────────────────────────┐
│           FileWatcher (Chokidar)                │
│  - Watch: /configs/**/*.txt                     │
│  - filePathMap: Map<filename, fullPath>         │
└─────────────────┬───────────────────────────────┘
                  │ Event: file-added
                  │ { filename, path, vendor }
                  ↓
┌─────────────────────────────────────────────────┐
│           AutoParser Service                    │
│  1. extractNetworkType(path) → NetworkType      │
│  2. parseNokiaConfig(content, { networkType })  │
│  3. buildConfigSummary(parsed) → selectionKey   │
└─────────────────┬───────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────┐
│           ConfigStore (In-Memory)               │
│  Key: filename                                  │
│  Value: {                                       │
│      configSummary: {                           │
│          services: [{                           │
│              selectionKey: "vpls-4073-isp" ✅   │
│              networkType: "isp"                 │
│          }]                                     │
│      }                                          │
│  }                                              │
└─────────────────┬───────────────────────────────┘
                  │ HTTP GET /api/services
                  ↓
┌─────────────────────────────────────────────────┐
│           Frontend (React)                      │
│  - ServiceListV3: 서비스 목록 표시              │
│  - MermaidViewer: 구성도 렌더링                 │
│  - Filter: Network Type 필터 (ISP/MPLS)         │
└─────────────────────────────────────────────────┘
```

---

#### **5.1.2 타입 정의**

```typescript
// src/types/services.ts

/**
 * Network Type (망 구분)
 */
export type NetworkType = 'isp' | 'mpls' | 'cloud' | 'unknown';

/**
 * Base Service Interface (모든 서비스의 공통 필드)
 */
export interface BaseService {
    serviceId: number;
    serviceType: ServiceType;
    networkType?: NetworkType;  // ✅ 추가 (Optional for compatibility)
    customerId: number;
    description: string;
    serviceName?: string;
    adminState: AdminState;
    operState?: OperState;
    serviceMtu?: number;
}
```

---

#### **5.1.3 경로 기반 Network Type 추출**

```typescript
// server/src/utils/networkTypeExtractor.ts

import path from 'path';
import type { NetworkType } from '../../src/types/services';

/**
 * 파일 경로에서 Network Type 추출
 *
 * @param filePath - 전체 파일 경로 (예: /data/configs/isp/vpls-4073.txt)
 * @returns NetworkType ('isp' | 'mpls' | 'cloud' | 'unknown')
 *
 * @example
 * extractNetworkType('/data/configs/isp/vpls-4073.txt')  → 'isp'
 * extractNetworkType('/data/configs/mpls/router.txt')    → 'mpls'
 * extractNetworkType('/data/configs/test.txt')           → 'unknown'
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
 * 하이브리드 Network Type 결정 (우선순위 기반)
 *
 * @param filePath - 파일 경로
 * @param filename - 파일명
 * @param config - 파싱된 설정 (선택)
 * @returns NetworkType
 */
export function determineNetworkType(
    filePath: string,
    filename: string,
    config?: any  // ParsedConfigV3 (순환 참조 방지)
): NetworkType {
    // 1순위: 경로 기반
    const pathType = extractNetworkType(filePath);
    if (pathType !== 'unknown') {
        return pathType;
    }

    // 2순위: 파일명 접미사 (예: vpls-4073_ISP.txt)
    const filenameMatch = filename.match(/_(ISP|MPLS|CLOUD)\./i);
    if (filenameMatch) {
        return filenameMatch[1].toLowerCase() as NetworkType;
    }

    // 3순위: Config 내용 추론 (BGP AS 범위)
    if (config) {
        return inferNetworkTypeFromConfig(config);
    }

    return 'unknown';
}

/**
 * Config 내용으로 Network Type 추론 (보조 수단)
 */
function inferNetworkTypeFromConfig(config: any): NetworkType {
    // VPRN 서비스에서 BGP AS 추출
    const vprnServices = config.services?.filter((s: any) => s.serviceType === 'vprn') || [];
    const autonomousSystems = vprnServices
        .map((s: any) => s.autonomousSystem)
        .filter((as: number | undefined) => as !== undefined);

    if (autonomousSystems.length === 0) {
        return 'unknown';
    }

    // Private AS 범위 (64512-65535) → MPLS로 추정
    if (autonomousSystems.some((as: number) => as >= 64512 && as <= 65535)) {
        return 'mpls';
    }

    // Public AS 범위 → ISP로 추정
    if (autonomousSystems.some((as: number) => as < 64512)) {
        return 'isp';
    }

    return 'unknown';
}
```

---

#### **5.1.4 Parser 옵션 전달**

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
 *
 * @param configText - Nokia 설정 파일 내용
 * @param options - 파싱 옵션 (networkType 등)
 * @returns ParsedConfigV3
 */
export function parseL2VPNConfig(
    configText: string,
    options?: ParseOptions
): ParsedConfigV3 {
    const hostname = extractHostname(configText);
    const systemIp = extractSystemIp(configText);
    const services = parseL2VPNServices(configText);
    const sdps = parseSDPs(configText);

    // Network Type 전파
    if (options?.networkType) {
        services.forEach(service => {
            service.networkType = options.networkType;
        });
    }

    // ... 나머지 로직

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

#### **5.1.5 AutoParser 수정**

```typescript
// server/src/services/autoParser.ts

import { extractNetworkType } from '../utils/networkTypeExtractor';

/**
 * 단일 파일 파싱 및 ConfigStore 업데이트
 */
async function parseAndStoreFile(filePath: string, filename: string): Promise<void> {
    try {
        console.log(`[AutoParser] Parsing file: ${filename}`);

        // 1. Network Type 추출 ✅
        const networkType = extractNetworkType(filePath);
        console.log(`[AutoParser] Network Type: ${networkType}`);

        // 2. 파일 읽기
        const content = await fs.readFile(filePath, 'utf-8');

        // 3. Nokia config 파싱 (networkType 전달) ✅
        const parsed = parseNokiaConfig(content, { networkType });

        // 4. ConfigSummary 생성
        const configSummary = buildConfigSummary(parsed);

        // 5. ConfigStore에 저장
        const serviceCount = configSummary.devices.reduce((sum, d) => sum + d.services.length, 0);

        configStore.set(filename, {
            filename,
            hostname: parsed.hostname,
            systemIp: parsed.systemIp,
            networkType,  // ✅ 추가
            configSummary,
            serviceCount,
            uploadedAt: new Date(),
        });

        console.log(`[AutoParser] ✅ Parsed: ${parsed.hostname} (${serviceCount} services, ${networkType})`);
    } catch (error) {
        console.error(`[AutoParser] ❌ Parsing failed: ${filename}`, error);
    }
}
```

---

#### **5.1.6 Selection Key 생성**

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
    // Network Type이 있으면 포함
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
    selectionKey: generateSelectionKey('epipe', epipe.serviceId, epipe.networkType),
    ...
});
```

---

### 5.2 Phase 2: Parser Refactoring

#### **5.2.1 목표 구조**

```
src/utils/v3/
├── core/
│   ├── index.ts                     # 메인 파서 (Export All)
│   ├── extractors.ts                # Hostname, SystemIP, Section 추출
│   ├── types.ts                     # 공통 타입 (ParseOptions 등)
│   └── README.md                    # 아키텍처 설명
│
├── services/
│   ├── epipeParser.ts               # Epipe 서비스 파싱
│   ├── vplsParser.ts                # VPLS 서비스 파싱
│   ├── vprnParser.ts                # VPRN 서비스 파싱
│   ├── iesParser.ts                 # IES 서비스 파싱
│   └── baseRouterParser.ts          # Base Router 추출
│
├── components/
│   ├── sapParser.ts                 # SAP 파싱
│   ├── sdpParser.ts                 # SDP 파싱 (Spoke/Mesh)
│   ├── qosParser.ts                 # QoS 정책 파싱
│   └── portParser.ts                # Port 정보 추출
│
└── l3/
    ├── bgpParser.ts                 # BGP Neighbor 파싱
    ├── ospfParser.ts                # OSPF Area 파싱
    └── routeParser.ts               # Static Route 파싱
```

**의존성 방향**:
```
core/types.ts
    ↑
components/* (qos, port, sdp, sap)
    ↑
l3/* (bgp, ospf, route)
    ↑
services/* (epipe, vpls, vprn, ies)
    ↑
core/index.ts (메인 파서)
```

**규칙**:
- `core/types.ts`는 어떤 파서도 import 안 함
- `components/` 간 import 금지 (순환 참조 방지)
- `services/`는 `components/`와 `l3/`만 import
- `core/index.ts`만 모든 파서를 import하여 re-export

---

#### **5.2.2 파일 분리 예시 (QoS Parser)**

**Before** (`parserV3.ts`):
```typescript
// 176-238줄: QoS 파싱 로직
export function parseQosPolicyDefinitions(configText: string): Map<string, { rate?: number; rateMax?: boolean }> {
    // ... 60줄 코드
}
```

**After** (`components/qosParser.ts`):
```typescript
/**
 * QoS Policy Parser
 *
 * SAP-Ingress/SAP-Egress 정책 정의 파싱
 */

import type { QosPolicy } from '../core/types';

/**
 * QoS Rate 정보
 */
export interface QosPolicyInfo {
    rate?: number;      // Rate in kbps
    rateMax?: boolean;  // true if rate is "max"
}

/**
 * sap-ingress / sap-egress 정책 정의 파싱
 *
 * @param configText - 전체 설정 파일 내용
 * @returns Map<'ingress-{id}' | 'egress-{id}', QosPolicyInfo>
 *
 * @example
 * const qosMap = parseQosPolicyDefinitions(configText);
 * const ingressInfo = qosMap.get('ingress-15');
 * // → { rate: 1000, rateMax: false }
 */
export function parseQosPolicyDefinitions(
    configText: string
): Map<string, QosPolicyInfo> {
    const policyMap = new Map<string, QosPolicyInfo>();
    const lines = configText.split('\n');

    // ... 기존 로직 동일

    return policyMap;
}

/**
 * SAP 블록 내 QoS 정책 참조 파싱
 *
 * @param content - SAP 블록 내용
 * @param direction - 'ingress' | 'egress'
 * @returns QosPolicy | undefined
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

#### **5.2.3 메인 파서 Re-Export**

```typescript
// core/index.ts

/**
 * Nokia Config Parser V3 (Modular Architecture)
 *
 * 이 파일은 모든 파서 모듈을 통합하여 단일 진입점을 제공합니다.
 */

// Core Types & Extractors
export * from './types';
export * from './extractors';

// Component Parsers
export * from '../components/qosParser';
export * from '../components/portParser';
export * from '../components/sdpParser';
export * from '../components/sapParser';

// L3 Parsers
export * from '../l3/bgpParser';
export * from '../l3/ospfParser';
export * from '../l3/routeParser';

// Service Parsers
export * from '../services/epipeParser';
export * from '../services/vplsParser';
export * from '../services/vprnParser';
export * from '../services/iesParser';
export * from '../services/baseRouterParser';

// Main Parser Function
import { parseL2VPNServices } from '../services';
import { parseSDPs } from '../components/sdpParser';
import { extractHostname, extractSystemIp } from './extractors';
import type { ParsedConfigV3, ParseOptions } from './types';

/**
 * L2 VPN 설정 파싱 (메인 함수)
 */
export function parseL2VPNConfig(
    configText: string,
    options?: ParseOptions
): ParsedConfigV3 {
    const hostname = extractHostname(configText);
    const systemIp = extractSystemIp(configText);
    const services = parseL2VPNServices(configText);
    const sdps = parseSDPs(configText);

    // Network Type 전파
    if (options?.networkType) {
        services.forEach(service => {
            service.networkType = options.networkType;
        });
    }

    // ... Enrich SAPs, Interfaces, etc.

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

## 6. Implementation Plan

### 6.1 Phase 1: Network Type Separation (2주)

#### **Sprint 1: 타입 시스템 준비 (Day 1-2)**

**Tasks**:
- [ ] `NetworkType` 타입 정의 (`src/types/services.ts`)
- [ ] `BaseService.networkType` 필드 추가 (Optional)
- [ ] `ParseOptions` 인터페이스 정의
- [ ] Frontend 타입 동기화 (`server/src/types.ts`)

**Deliverables**:
- ✅ 타입 정의 완료
- ✅ TypeScript 컴파일 에러 없음

---

#### **Sprint 2: 백엔드 구현 (Day 3-5)**

**Tasks**:
- [ ] `networkTypeExtractor.ts` 모듈 생성
  - `extractNetworkType()` 함수
  - `determineNetworkType()` 함수 (하이브리드)
  - `inferNetworkTypeFromConfig()` 함수
- [ ] `parserV3.ts` 수정
  - `parseL2VPNConfig(text, options)` 시그니처 변경
  - Network Type 전파 로직
- [ ] `autoParser.ts` 수정
  - 경로 파싱 로직 추가
  - `parseNokiaConfig()` 호출 시 옵션 전달
- [ ] `configStore.ts` 수정
  - `networkType` 필드 추가
- [ ] `configSummaryBuilder.ts` 수정
  - `generateSelectionKey()` 함수
  - Network Type 포함 키 생성

**Deliverables**:
- ✅ 백엔드 파싱 로직 완료
- ✅ 단위 테스트 작성
- ✅ VPLS 4073 ISP/MPLS 분리 확인

---

#### **Sprint 3: 프론트엔드 구현 (Day 6-8)**

**Tasks**:
- [ ] 구성도 키 생성 로직 수정
  - `ServiceListV3.tsx`
  - `Dashboard.tsx`
  - `mermaidGeneratorV3.ts`
- [ ] Network Type 필터 UI 추가
  - Dashboard에 `filterNetworkType: 'all' | 'isp' | 'mpls' | 'cloud'`
  - 필터링 로직 구현
- [ ] 망별 통계 표시
  - ISP 망 서비스 수
  - MPLS 망 서비스 수

**Deliverables**:
- ✅ 프론트엔드 UI 완료
- ✅ 구성도 분리 표시 확인

---

#### **Sprint 4: 테스트 및 문서화 (Day 9-10)**

**Tasks**:
- [ ] 통합 테스트
  - VPLS 4073 ISP/MPLS 분리 시나리오
  - `unknown` 타입 Fallback 테스트
  - 기존 데이터 호환성 테스트
- [ ] 문서 작성
  - CHANGELOG.md v5.6.0 섹션 추가
  - 폴더 구조 가이드 작성
  - API 문서 업데이트 (`/api/services` 응답 형식)

**Deliverables**:
- ✅ 테스트 통과 (모든 시나리오)
- ✅ 문서 완료

---

### 6.2 Phase 2: Parser Refactoring (2주)

#### **Sprint 5: 준비 및 독립 모듈 분리 (Day 11-15)**

**Day 11-12: 준비**
- [ ] 브랜치 생성 (`refactor/parser-separation`)
- [ ] 현재 파서 스냅샷 테스트 작성
  - 94개 설정 파일 파싱 결과 저장
  - JSON Snapshot 생성

**Day 13-15: 독립 모듈 분리**
- [ ] `qosParser.ts` 분리 (200줄)
- [ ] `portParser.ts` 분리 (200줄)
- [ ] `sdpParser.ts` 분리 (150줄)
- [ ] 각 모듈마다 단위 테스트 작성

**Deliverables**:
- ✅ 3개 독립 모듈 분리 완료
- ✅ 단위 테스트 작성

---

#### **Sprint 6: SAP 및 서비스 파서 분리 (Day 16-18)**

**Day 16: SAP 파싱 분리**
- [ ] `sapParser.ts` 분리 (150줄)
- [ ] QoS Parser import

**Day 17-18: 서비스 파서 분리**
- [ ] `epipeParser.ts` 분리 (100줄)
- [ ] `vplsParser.ts` 분리 (150줄)
- [ ] `vprnParser.ts` 분리 (250줄)
- [ ] `iesParser.ts` 분리 (100줄)

**Deliverables**:
- ✅ SAP + 4개 서비스 파서 분리 완료

---

#### **Sprint 7: L3 파싱 및 정리 (Day 19-22)**

**Day 19-20: L3 파싱 분리**
- [ ] `bgpParser.ts` 분리 (150줄)
- [ ] `ospfParser.ts` 분리 (100줄)
- [ ] `routeParser.ts` 분리 (100줄)

**Day 21: 메인 파서 정리**
- [ ] `core/index.ts` 생성
- [ ] Re-export 구조 확정
- [ ] `parserV3.ts` → `core/index.ts`로 이동

**Day 22: 검증 및 문서화**
- [ ] 전체 파서 통합 테스트
- [ ] 스냅샷 비교 (Before/After 100% 일치)
- [ ] 성능 벤치마크
- [ ] 개발자 가이드 작성

**Deliverables**:
- ✅ Parser 모듈화 완료
- ✅ 테스트 통과 (100% 일치)
- ✅ 문서 완료

---

## 7. Risk Management

### 7.1 Risk Matrix

| 리스크 | 발생 확률 | 영향도 | 완화 방안 | 책임자 |
|--------|-----------|--------|-----------|--------|
| 기존 데이터 호환성 문제 | Medium | High | Optional networkType, Fallback 키 생성 | Backend Dev |
| Frontend 구성도 키 불일치 | Medium | High | 전역 검색, 단위 테스트 | Frontend Dev |
| Parser 분리 시 순환 참조 | Low | High | 의존성 방향 명확화, ESLint 규칙 | Backend Dev |
| 성능 저하 | Low | Medium | 벤치마크, 캐싱 | Backend Dev |
| 배포 실패 | Low | High | Blue-Green Deployment | DevOps |

---

### 7.2 Risk Mitigation Details

#### **Risk 1: 기존 데이터 호환성**

**완화 방안**:
```typescript
// 1. Optional networkType 필드
interface BaseService {
    networkType?: NetworkType;  // undefined 허용
}

// 2. Fallback 키 생성
function generateSelectionKey(
    serviceType: string,
    serviceId: number,
    networkType?: NetworkType
): string {
    if (networkType && networkType !== 'unknown') {
        return `${serviceType}-${serviceId}-${networkType}`;
    }
    return `${serviceType}-${serviceId}`;  // 기존 형식
}

// 3. 자동 마이그레이션
async function migrateExistingConfigs() {
    for (const entry of configStore.getAll()) {
        if (!entry.networkType) {
            const filePath = fileWatcher.getFilePath(entry.filename);
            if (filePath) {
                const networkType = extractNetworkType(filePath);
                configStore.update(entry.filename, { ...entry, networkType });
            }
        }
    }
}
```

---

#### **Risk 2: 순환 참조**

**완화 방안**:
```json
// .eslintrc.json
{
    "rules": {
        "import/no-cycle": ["error", { "maxDepth": 2 }]
    }
}
```

```bash
# 순환 참조 감지
npx madge --circular --extensions ts ./src/utils/v3/
```

---

## 8. Timeline and Milestones

### 8.1 Gantt Chart

```
Week 1
├─ Day 1-2:   타입 시스템 준비            ████
├─ Day 3-5:   백엔드 구현                ██████
├─ Day 6-8:   프론트엔드 구현            ██████
└─ Day 9-10:  테스트 및 문서화           ████

Week 2
├─ 통합 테스트 및 버그 수정             ████████

Week 3
├─ Day 11-12: Parser 리팩토링 준비      ████
├─ Day 13-15: 독립 모듈 분리            ██████
└─ Day 16-18: SAP/서비스 파서 분리      ██████

Week 4
├─ Day 19-20: L3 파싱 분리              ████
├─ Day 21:    메인 파서 정리            ██
└─ Day 22:    검증 및 문서화            ██

Week 5
├─ 통합 테스트 및 성능 벤치마크        ████████
└─ 배포 준비 (Blue-Green)               ████
```

---

### 8.2 Milestones

| Milestone | Date | Deliverables |
|-----------|------|--------------|
| **M1: Phase 1 완료** | Week 2 | v5.6.0 (Network Type Separation) |
| **M2: Phase 2 완료** | Week 4 | v5.7.0 (Parser Refactoring) |
| **M3: 프로덕션 배포** | Week 5 | Blue-Green 배포 완료 |

---

## 9. Appendix

### 9.1 파일 수정 체크리스트

#### **Phase 1: Network Type Separation**

**타입 정의**:
- [ ] `src/types/services.ts`: NetworkType 타입 추가
- [ ] `src/types/services.ts`: BaseService.networkType 필드 추가
- [ ] `server/src/types.ts`: 타입 동기화

**백엔드**:
- [ ] `server/src/utils/networkTypeExtractor.ts`: 신규 생성
- [ ] `src/utils/v3/parserV3.ts`: parseL2VPNConfig 시그니처 변경
- [ ] `server/src/services/autoParser.ts`: 경로 파싱 로직 추가
- [ ] `server/src/services/configStore.ts`: networkType 필드 추가
- [ ] `src/utils/configSummaryBuilder.ts`: selectionKey 생성 로직 변경

**프론트엔드**:
- [ ] `src/components/v3/ServiceListV3.tsx`: 키 생성 로직 수정
- [ ] `src/components/v3/Dashboard.tsx`: 네트워크 타입 필터 추가
- [ ] `src/utils/v3/mermaidGeneratorV3.ts`: 키 참조 수정

**테스트**:
- [ ] `tests/networkType.test.ts`: 신규 생성
- [ ] `tests/parser.integration.test.ts`: VPLS 4073 시나리오

**문서**:
- [ ] `CHANGELOG.md`: v5.6.0 섹션 추가
- [ ] `docs/network-type-guide.md`: 폴더 구조 가이드

---

#### **Phase 2: Parser Refactoring**

**신규 파일 (14개)**:
- [ ] `src/utils/v3/core/index.ts`
- [ ] `src/utils/v3/core/extractors.ts`
- [ ] `src/utils/v3/core/types.ts`
- [ ] `src/utils/v3/components/qosParser.ts`
- [ ] `src/utils/v3/components/portParser.ts`
- [ ] `src/utils/v3/components/sdpParser.ts`
- [ ] `src/utils/v3/components/sapParser.ts`
- [ ] `src/utils/v3/services/epipeParser.ts`
- [ ] `src/utils/v3/services/vplsParser.ts`
- [ ] `src/utils/v3/services/vprnParser.ts`
- [ ] `src/utils/v3/services/iesParser.ts`
- [ ] `src/utils/v3/l3/bgpParser.ts`
- [ ] `src/utils/v3/l3/ospfParser.ts`
- [ ] `src/utils/v3/l3/routeParser.ts`

**삭제 파일**:
- [ ] `src/utils/v3/parserV3.ts` (→ core/index.ts로 이동)

**테스트**:
- [ ] `tests/parser.snapshot.test.ts`: 스냅샷 테스트
- [ ] `tests/qosParser.test.ts`: QoS 단위 테스트
- [ ] `tests/sapParser.test.ts`: SAP 단위 테스트
- [ ] ... (각 파서별 테스트)

**문서**:
- [ ] `CHANGELOG.md`: v5.7.0 섹션 추가
- [ ] `src/utils/v3/core/README.md`: 아키텍처 설명
- [ ] `docs/parser-developer-guide.md`: 개발자 가이드

---

### 9.2 테스트 시나리오

#### **Scenario 1: VPLS 4073 ISP/MPLS 분리**

**Given**:
- ISP 파일: `/data/configs/isp/SKNet_Pangyo_7750SR_I_BB3.txt`
- MPLS 파일: `/data/configs/mpls/SK-Net_Gyowon_7705SAR-8_MPLS_2.txt`
- 둘 다 VPLS 4073 포함

**When**:
1. FileWatcher가 두 파일 감지
2. AutoParser가 각각 파싱

**Then**:
- ConfigStore에 2개 entry 생성
- ISP selectionKey: `vpls-4073-isp`
- MPLS selectionKey: `vpls-4073-mpls`
- Frontend에서 두 구성도 모두 표시

---

#### **Scenario 2: Legacy 데이터 호환성**

**Given**:
- 기존 파싱 데이터 (networkType 없음)

**When**:
- Frontend에서 서비스 목록 조회

**Then**:
- `networkType: undefined` → `selectionKey: "vpls-100"` (기존 형식)
- 정상 표시
- 경고 메시지: "Legacy config detected"

---

#### **Scenario 3: Parser 모듈화 검증**

**Given**:
- 94개 설정 파일 파싱 결과 스냅샷 저장 (Before)

**When**:
- Parser 모듈 분리 수행

**Then**:
- 94개 파일 재파싱 (After)
- Before/After JSON diff → 100% 일치

---

### 9.3 성능 벤치마크

**테스트 환경**:
- CPU: 4 cores
- RAM: 8GB
- 설정 파일: 94개 (평균 50KB)

**Before (Monolithic Parser)**:
- 평균 파싱 시간: 120ms/file
- 총 파싱 시간: 11.28초 (94 files)
- 메모리 사용: 250MB

**After (Modular Parser, 목표)**:
- 평균 파싱 시간: 120-126ms/file (±5% 허용)
- 총 파싱 시간: 11.28-11.84초
- 메모리 사용: 250-260MB

**통과 기준**:
- ✅ 평균 파싱 시간: ±5% 이내
- ✅ 메모리 사용: +10% 이내

---

### 9.4 참고 자료

**관련 문서**:
- CTO 기술 검토 보고서 (Agent 출력)
- Nokia TiMOS CLI Reference Guide
- MPLS/ISP 네트워크 아키텍처 가이드

**코드 참조**:
- `src/utils/v3/parserV3.ts`: 현재 파서 (1678줄)
- `server/src/services/fileWatcher.ts`: 파일 경로 추적
- `server/src/services/autoParser.ts`: 자동 파싱

**외부 도구**:
- madge: 순환 참조 감지
- ts-node: TypeScript 실행
- jest: 테스트 프레임워크

---

## 10. 승인 및 서명

| 역할 | 이름 | 서명 | 일자 |
|------|------|------|------|
| 기획자 (PM) | | | |
| 개발자 (Backend) | | | |
| 개발자 (Frontend) | | | |
| CTO | | | |

---

**문서 버전**: v1.0
**최종 업데이트**: 2026-03-19
**다음 단계**: `/pdca design network-type-separation` 실행하여 설계 문서 작성
