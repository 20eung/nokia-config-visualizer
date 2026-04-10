# Plan - dashboard-site-filter

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | dashboard-site-filter |
| 시작일 | 2026-04-10 |
| 예상 기간 | 0.5일 |
| 유형 | UX Enhancement |

### Value Delivered (4-Perspective)

| 관점 | 내용 |
|------|------|
| **Problem** | Dashboard 카드 클릭 후 Services 뷰로 전환하면 왼쪽 패널이 전체 장비 서비스(예: Epipe 0/348)를 표시해 특정 장비의 서비스만 볼 수 없음 |
| **Solution** | 카드 클릭 시 해당 장비 hostname을 상태로 저장하고, `ServiceListV3`에 해당 장비의 서비스만 필터링해서 전달 |
| **Function UX Effect** | Services 뷰 전환 후 왼쪽 패널에 해당 장비의 서비스 수만 표시되며, 상단 배너에 장비명과 필터 해제 버튼 제공 |
| **Core Value** | Dashboard → Services 전환 흐름이 자연스럽게 연결되어 특정 장비 장애 분석 시 불필요한 전체 서비스 노이즈 제거 |

---

## 1. 배경 및 문제 정의

### 1.1 현상

Dashboard 모드에서 사이트 카드를 클릭하면:
1. 오른쪽 다이어그램에는 해당 장비의 서비스 다이어그램이 표시됨 (올바른 동작)
2. 왼쪽 패널의 서비스 목록에는 전체 장비의 모든 서비스가 표시됨 (문제)
   - 예: `Epipe (0/348)`, `VPLS (0/67)`, `VPRN (0/19)`, `IES (0/250)`
3. All, Epipe, VPLS 등 타입 버튼을 클릭하면 해당 장비가 아닌 전체 서비스가 선택됨

### 1.2 근본 원인 분석

```
[현재 흐름]
Dashboard 카드 클릭
  → handleSiteClick(hostnames)
      → setSelectedServiceIds(keys)   ← 해당 장비 서비스 ID 선택
      → setViewMode('services')       ← 뷰 전환
  → ServiceListV3 props.services = allServices  ← 전체 서비스 그대로 전달
```

`handleSiteClick`은 선택된 서비스 ID는 올바르게 설정하지만, `ServiceListV3`에 전달되는 `services` prop은 여전히 모든 장비의 `allServices`임.

### 1.3 기대 동작

```
[개선 흐름]
Dashboard 카드 클릭
  → handleSiteClick(hostnames)
      → setSelectedServiceIds(keys)
      → setDashboardFilterHostnames(hostnames)  ← 신규
      → setViewMode('services')
  → ServiceListV3 props.services = displayedServices  ← 필터된 서비스
      displayedServices = allServices.filter(s => hostnames.includes(s._hostname))

사이드바 상단 배너: "[장비명] × (필터 해제)"
헤더 Services 버튼 수동 클릭 → 필터 초기화 → 전체 서비스 표시
```

---

## 2. 요구사항

### 2.1 Functional Requirements

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-01 | Dashboard 카드 클릭 시 해당 장비의 서비스만 왼쪽 패널에 표시 | P0 |
| FR-02 | 필터 활성 상태를 사이드바 상단 배너로 시각적으로 표시 | P0 |
| FR-03 | 배너의 X 버튼으로 필터 해제 시 전체 서비스 목록으로 복귀 | P0 |
| FR-04 | 헤더 Services 탭 수동 클릭 시 필터 초기화 (전체 서비스 표시) | P0 |
| FR-05 | 필터 해제 시 선택된 서비스 ID도 함께 초기화 | P1 |
| FR-06 | HA 페어(2개 hostname) 카드 클릭 시 두 장비 서비스 모두 표시 | P0 |

### 2.2 Non-Functional Requirements

- 기존 `allServices` 계산 로직 변경 없음 (필터는 별도 파생 상태로 처리)
- `ServiceListV3` 컴포넌트의 props interface 변경 최소화
- HA 탐지 로직은 여전히 `configs` 전체를 참조 (필터 영향 없음)

---

## 3. 설계 방향

### 3.1 상태 관리 (V3Page.tsx)

```typescript
// 신규 상태
const [dashboardFilterHostnames, setDashboardFilterHostnames] = useState<string[]>([]);

// 파생 상태 (메모)
const displayedServices = useMemo(() =>
  dashboardFilterHostnames.length > 0
    ? allServices.filter(s => dashboardFilterHostnames.includes(s._hostname))
    : allServices,
  [allServices, dashboardFilterHostnames]
);
```

### 3.2 필터 배너 UI (V3Page.tsx 사이드바)

```
┌────────────────────────────────┐
│ [장비명1, 장비명2]          ✕  │  ← 파란 배너, 장비명 + X 버튼
├────────────────────────────────┤
│ ServiceListV3 (필터된 서비스)  │
└────────────────────────────────┘
```

### 3.3 필터 초기화 시나리오

| 액션 | 동작 |
|------|------|
| X 버튼 클릭 | `dashboardFilterHostnames` 초기화 + `selectedServiceIds` 초기화 |
| 헤더 Services 탭 클릭 | `dashboardFilterHostnames` 초기화 (selectedServiceIds 유지) |
| Dashboard 탭 클릭 | 뷰 전환 (필터 상태 유지, Services 재진입 시 복원) |

---

## 4. 구현 계획

### 단일 Phase (이미 구현 완료)

1. `V3Page.tsx` — `dashboardFilterHostnames` state 추가
2. `V3Page.tsx` — `handleSiteClick`에 `setDashboardFilterHostnames(hostnames)` 추가
3. `V3Page.tsx` — `displayedServices` useMemo 추가
4. `V3Page.tsx` — 헤더 Services 버튼 onClick에 `setDashboardFilterHostnames([])` 추가
5. `V3Page.tsx` — 사이드바에 필터 배너 컴포넌트 추가 (조건부 렌더링)
6. `V3Page.tsx` — `ServiceListV3`에 `allServices` 대신 `displayedServices` 전달
7. `V3Page.tsx` — `X` 아이콘 import 추가

---

## 5. 관련 파일

### 수정 대상

| 파일 | 변경 유형 | 내용 |
|------|---------|------|
| `src/pages/V3Page.tsx` | 수정 | `dashboardFilterHostnames` 상태, `displayedServices` memo, 필터 배너 UI |

### 비수정 파일

| 파일 | 이유 |
|------|------|
| `src/components/v3/ServiceListV3.tsx` | props interface 변경 없음. `services` prop만 필터된 값으로 대체 |
| `src/components/v3/Dashboard.tsx` | `onSiteClick` callback 인터페이스 변경 없음 |

---

## 6. 검증 시나리오

| 시나리오 | 기대 결과 |
|---------|---------|
| Dashboard 카드 클릭 (단일 장비) | 왼쪽 패널에 해당 장비 서비스만 표시 |
| Dashboard 카드 클릭 (HA 페어) | 두 장비의 서비스 합산 표시 |
| 필터 배너 X 클릭 | 전체 서비스 목록 복귀 + 선택 초기화 |
| 헤더 Services 탭 직접 클릭 | 전체 서비스 목록 표시 (필터 없음) |
| 필터 상태에서 타입 버튼 클릭 | 해당 장비의 해당 타입 서비스만 선택 |
