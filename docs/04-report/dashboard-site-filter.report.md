# Report - dashboard-site-filter

> **Date**: 2026-04-10
> **Branch**: `main`
> **Type**: UX Enhancement

---

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | dashboard-site-filter |
| 시작일 | 2026-04-10 |
| 완료일 | 2026-04-10 |
| 소요 기간 | 0.5일 |
| Match Rate | 100% (8/8) |
| 수정 파일 | 1개 (`V3Page.tsx`) |
| 추가 코드 | ~30줄 |

### Value Delivered (4-Perspective)

| 관점 | 내용 |
|------|------|
| **Problem** | Dashboard 카드 클릭 후 Services 전환 시 왼쪽 패널이 전체 348개 서비스를 표시해 특정 장비 분석이 불가능했음 |
| **Solution** | `dashboardFilterHostnames` 상태 + `displayedServices` useMemo로 해당 장비 서비스만 필터링해서 전달 |
| **Function UX Effect** | 카드 클릭 즉시 해당 장비 서비스만 패널에 표시되며, 배너로 필터 상태를 시각화하고 X로 즉시 해제 가능 |
| **Core Value** | Dashboard → Services 전환 흐름이 자연스럽게 연결되어 장애 분석 시 관련 서비스만 집중해서 볼 수 있음 |

---

## 1. 구현 결과

### 1.1 변경 파일

| 파일 | 변경 유형 | 변경 내용 요약 |
|------|---------|--------------|
| `src/pages/V3Page.tsx` | 수정 | 7군데 수정, ~30줄 추가 |

### 1.2 구현된 항목

| # | 항목 | 구현 위치 |
|---|------|-----------|
| 1 | `import X` (lucide 직접 경로) | line 34 |
| 2 | `dashboardFilterHostnames` state | line 51 |
| 3 | `displayedServices` useMemo | line 296-301 |
| 4 | `handleSiteClick` 필터 저장 | line 247 |
| 5 | Services 버튼 수동 클릭 시 필터 초기화 | line 558 |
| 6 | 사이드바 필터 배너 (조건부) | line 608-620 |
| 7 | X 버튼: 필터 + 선택 동시 초기화 | line 614 |
| 8 | `ServiceListV3`에 `displayedServices` 전달 | line 623 |

### 1.3 핵심 로직

```typescript
// 필터 상태
const [dashboardFilterHostnames, setDashboardFilterHostnames] = useState<string[]>([]);

// 파생 서비스 목록 (allServices 원본 보존)
const displayedServices = useMemo(() =>
  dashboardFilterHostnames.length > 0
    ? allServices.filter(s => dashboardFilterHostnames.includes((s as any)._hostname))
    : allServices,
  [allServices, dashboardFilterHostnames]
);
```

---

## 2. 검증 결과

### 2.1 Gap Analysis

| 카테고리 | 점수 |
|----------|:----:|
| 설계 일치도 | 100% |
| 아키텍처 준수 | 100% |
| 컨벤션 준수 | 100% |
| **전체 Match Rate** | **100%** |

### 2.2 FR 검증

| FR | 요구사항 | 구현 여부 |
|----|---------|---------|
| FR-01 | Dashboard 카드 클릭 시 해당 장비 서비스만 표시 | ✅ |
| FR-02 | 필터 활성 배너 시각적 표시 | ✅ |
| FR-03 | X 버튼으로 전체 서비스 복귀 | ✅ |
| FR-04 | 헤더 Services 탭 클릭 시 필터 초기화 | ✅ |
| FR-05 | 필터 해제 시 선택 서비스 ID 초기화 | ✅ |
| FR-06 | HA 페어(2개 hostname) 모두 표시 | ✅ |

### 2.3 빌드 검증

```
✓ built in 9.92s  (TypeScript 오류 없음)
```

---

## 3. 아키텍처 결정 기록

### ADR-01: `allServices` 원본 보존
- **결정**: `allServices`를 변경하지 않고 `displayedServices`를 파생 상태로 분리
- **이유**: `allServices`는 다이어그램 생성(`selectedServices`, `serviceGroups`)에서 계속 사용되므로 원본 보존 필수
- **결과**: 필터가 다이어그램 렌더링에 영향을 주지 않음

### ADR-02: `ServiceListV3` 인터페이스 무변경
- **결정**: `ServiceListV3`의 props interface를 변경하지 않고 `services` prop만 다른 값 전달
- **이유**: 최소 변경 원칙. 필터 로직은 호출 측(V3Page)의 책임
- **결과**: `ServiceListV3` 내부 로직 전체 재활용 (카운터, 검색, 타입 버튼 모두 자동 필터 적용)

### ADR-03: X 버튼 클릭 시 선택 ID도 함께 초기화
- **결정**: 필터 해제 시 `setSelectedServiceIds([])` 함께 호출
- **이유**: 이전 필터 상태의 선택 서비스가 전체 뷰에서 유령처럼 남아있는 것을 방지
- **결과**: 깔끔한 초기 상태로 복귀

---

## 4. 관련 문서

- Plan: `docs/01-plan/features/dashboard-site-filter.plan.md`
- Design: `docs/02-design/features/dashboard-site-filter.design.md`
- Analysis: `docs/03-analysis/dashboard-site-filter.analysis.md`
