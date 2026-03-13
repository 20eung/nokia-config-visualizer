# Plan: Vendor Backup Status Display

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 대시보드에서 전체 백업 상태는 표시되지만 벤더별(Nokia, Arista 등) 세부 현황을 파악하기 어려움 |
| **Solution** | Dashboard에 벤더별 백업 VRF 수량을 집계하여 표시, 벤더별 필터링 및 상세 현황 제공 |
| **Function & UX Effect** | 통계 카드 섹션에 벤더별 백업 상태 표시 추가, 클릭 시 해당 벤더 기기 필터링 |
| **Core Value** | 네트워크 관리자가 벤더별 백업 인프라 현황을 한눈에 파악, 장애 대응 시 벤더별 분리 관리 가능 |

## 1. Feature Overview

### 1.1 Background
- 현재 Dashboard는 서비스 타입별(Epipe, VPLS, VPRN, IES) 통계만 제공
- Config 파일에 백업 관련 VRF(SKENS_Backup_Dispersion 등)가 존재하지만 집계되지 않음
- 벤더별 장비 현황(Nokia, Arista 등)을 구분하여 관리 필요

### 1.2 Goals
- **Primary**: Dashboard에 벤더별 백업 VRF 수량 표시
- **Secondary**: 벤더 정보 자동 탐지 (hostname 패턴, show command 출력 분석)
- **UX**: 통계 카드 형태로 시각화, 클릭 시 해당 벤더 기기로 필터링

### 1.3 Non-Goals
- 백업 상태의 실시간 모니터링 (설정 파일 기반 분석만)
- 벤더별 상세 성능 메트릭 수집
- 백업 정책 자동 설정 기능

## 2. Requirements

### 2.1 Functional Requirements
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | Config 파일에서 벤더 정보 추출 (Nokia, Arista 등) | P0 |
| FR-02 | 백업 관련 VRF/서비스 자동 탐지 (이름에 "backup" 포함) | P0 |
| FR-03 | Dashboard에 벤더별 백업 수량 표시 (카드 형태) | P0 |
| FR-04 | 벤더 카드 클릭 시 해당 벤더 기기 필터링 | P1 |
| FR-05 | 벤더 미지정 기기는 "Unknown" 항목에 집계 | P1 |

### 2.2 Non-Functional Requirements
| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-01 | Config 파싱 성능 영향 최소화 (< 100ms 추가) | P0 |
| NFR-02 | 기존 Dashboard 레이아웃과 일관성 유지 | P0 |
| NFR-03 | 다크 모드 지원 | P1 |

### 2.3 Constraints
- 벤더 정보는 Config 파일 헤더 또는 hostname 패턴에서만 추출
- 실시간 SNMP 조회 없이 정적 분석만 수행

## 3. Technical Approach

### 3.1 Vendor Detection Strategy
```typescript
// Config 파일 헤더 분석
// Example: "device: SKNet-PDC3F-MMR-7020SR-leaf-1 (DCS-7020SR-32C2, EOS-4.27.6M)"
//          -> Vendor: Arista (EOS detected)

// Nokia Config 예시:
// "# TiMOS-B-23.3.R1 both/x86_64 Nokia 7750 SR"
//          -> Vendor: Nokia

function detectVendor(config: string): string {
  if (config.includes('EOS-') || config.includes('DCS-')) return 'Arista';
  if (config.includes('TiMOS') || config.includes('Nokia')) return 'Nokia';
  if (config.includes('Cisco IOS')) return 'Cisco';
  return 'Unknown';
}
```

### 3.2 Backup VRF Detection
```typescript
// VRF 이름 또는 description에 "backup" 키워드 포함 여부 확인
function isBackupService(service: NokiaService): boolean {
  const desc = service.description?.toLowerCase() || '';
  const name = service.serviceName?.toLowerCase() || '';
  return desc.includes('backup') || name.includes('backup');
}
```

### 3.3 Data Flow
```
Config Files (*.txt)
  ↓
parserV3.ts (기존)
  ↓
+ vendorDetector.ts (신규)
  ↓
ParsedConfigV3 { hostname, vendor, services[] }
  ↓
Dashboard.tsx (기존)
  ↓
+ vendorBackupAggregator.ts (신규)
  ↓
{ nokia: 12, arista: 8, unknown: 2 }
  ↓
VendorBackupCards (신규 컴포넌트)
```

## 4. UI/UX Design

### 4.1 Dashboard Layout (Before)
```
┌─────────────────────────────────────────┐
│ [Epipe: 45] [VPLS: 32] [VPRN: 18] [IES: 12] │
│                                           │
│ 107 services | 24 devices | 8 HA pairs   │
│ [Search...]                               │
├─────────────────────────────────────────┤
│ Site Cards Grid...                        │
└─────────────────────────────────────────┘
```

### 4.2 Dashboard Layout (After)
```
┌─────────────────────────────────────────┐
│ [Epipe: 45] [VPLS: 32] [VPRN: 18] [IES: 12] │
│                                           │
│ **Backup Status by Vendor** (신규)       │
│ [Nokia: 12] [Arista: 8] [Cisco: 3] [Unknown: 2] │
│                                           │
│ 107 services | 24 devices | 8 HA pairs   │
│ [Search...]                               │
├─────────────────────────────────────────┤
│ Site Cards Grid...                        │
└─────────────────────────────────────────┘
```

### 4.3 Vendor Card Design
- **색상**: Nokia (cyan-500), Arista (orange-500), Cisco (blue-500), Unknown (gray-400)
- **호버 효과**: shadow-md, border-color 변경
- **클릭 동작**: 해당 벤더 기기만 표시하도록 필터 적용

## 5. Implementation Plan

### 5.1 Phase 1: Vendor Detection (Day 1)
- [ ] `src/utils/vendorDetector.ts` 생성
- [ ] Config 파일 헤더에서 벤더 정보 추출 로직 구현
- [ ] Unit Test 작성 (Nokia, Arista, Cisco 샘플)

### 5.2 Phase 2: Backup Service Aggregation (Day 1)
- [ ] `src/utils/backupAggregator.ts` 생성
- [ ] VRF/Service description에서 "backup" 키워드 탐지
- [ ] 벤더별 백업 수량 집계 함수 구현

### 5.3 Phase 3: UI Integration (Day 2)
- [ ] `Dashboard.tsx` 수정: 벤더별 백업 카드 섹션 추가
- [ ] `VendorBackupCard` 컴포넌트 생성
- [ ] 클릭 이벤트 핸들러 구현 (벤더 필터링)

### 5.4 Phase 4: Testing & Polish (Day 2)
- [ ] 실제 Config 파일로 통합 테스트
- [ ] 다크 모드 색상 확인
- [ ] 반응형 레이아웃 검증 (모바일/태블릿)

## 6. Test Plan

### 6.1 Unit Tests
- `vendorDetector.spec.ts`: Nokia/Arista/Cisco 탐지 정확도
- `backupAggregator.spec.ts`: 백업 서비스 집계 로직

### 6.2 Integration Tests
- Dashboard 렌더링 시 벤더 카드 표시 확인
- 벤더 카드 클릭 시 필터링 동작 확인

### 6.3 E2E Tests (Optional)
- Playwright로 Dashboard 로딩 → 벤더 카드 클릭 → 필터링 결과 확인

## 7. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| 벤더 탐지 실패 (비표준 Config) | Medium | Low | Unknown 항목에 집계, 로그에 경고 출력 |
| 백업 VRF 이름 규칙 불일치 | Medium | Medium | 설정 가능한 키워드 목록 제공 (config.json) |
| Dashboard 레이아웃 복잡도 증가 | Low | Low | 벤더 카드를 접을 수 있는 토글 버튼 추가 |

## 8. Success Metrics
- **Functional**: 90% 이상의 Config 파일에서 벤더 정보 정확히 추출
- **Performance**: Config 파싱 시간 100ms 이하 증가
- **UX**: 사용자가 3클릭 이내에 특정 벤더 백업 현황 확인 가능

## 9. Future Enhancements (Out of Scope)
- 백업 상태 실시간 모니터링 (SNMP/gNMI)
- 벤더별 백업 정책 비교 분석
- 백업 실패 알림 기능
