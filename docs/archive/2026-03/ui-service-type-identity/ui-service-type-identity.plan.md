# Plan: Service Type Visual Identity 통합

## 개요

서비스 타입별 시각적 정체성(색상 + 아이콘)을 일관되게 적용합니다.
현재 Dashboard와 ServiceList의 색상 체계가 불일치하고,
VPLS와 IES가 동일한 🌐 이모지를 사용하는 문제를 해결합니다.

## 현황 분석

### 현재 색상 체계

| 위치 | Epipe | VPLS | VPRN | IES |
|------|-------|------|------|-----|
| Dashboard 통계 카드 | blue-500 | emerald-500 | violet-500 | amber-500 |
| ServiceList 타입 버튼 (활성) | blue-600 | **blue-600** | **blue-600** | **blue-600** |
| ServiceList 타입 버튼 (비활성) | gray | gray | gray | gray |

→ Dashboard는 타입별 고유 색상, ServiceList는 모두 blue 단색

### 현재 아이콘

| 서비스 | 아이콘 | 문제 |
|--------|--------|------|
| Epipe | 🔗 | 양호 (링크 연결 의미 직관적) |
| VPLS | 🌐 | **IES와 중복** |
| VPRN | 📡 | 양호 |
| IES | 🌐 | **VPLS와 중복** |

## 목표 (Goals)

- Dashboard ↔ ServiceList 색상 체계 통일
- VPLS / IES 아이콘 중복 해소
- 글로벌 네트워크 시각화 툴 표준에 근접 (색상 우선 구분)

## 요구사항 (Requirements)

### FR-01: 서비스 타입별 고유 색상 체계 (Color Token)

Dashboard의 기존 색상을 전체에 통일 적용:

| 타입 | Color Token | 활성 버튼 | 비활성 버튼 배경 | 그룹 헤더 좌측 보더 |
|------|------------|-----------|-----------------|---------------------|
| All  | gray       | gray-700  | gray-100        | - |
| Epipe | blue      | blue-600  | blue-50         | border-blue-400 |
| VPLS  | emerald   | emerald-600 | emerald-50   | border-emerald-400 |
| VPRN  | violet    | violet-600 | violet-50    | border-violet-400 |
| IES   | amber     | amber-600 | amber-50      | border-amber-400 |
| HA    | green     | green-600 | green-50      | - |

### FR-02: 서비스 타입별 고유 아이콘

글로벌 네트워크 툴 표준 기반 아이콘 선택:

| 타입 | 현재 | 변경안 | 근거 |
|------|------|--------|------|
| Epipe | 🔗 | 🔗 유지 | P2P 링크 연결 직관적 |
| VPLS | 🌐 | 🔀 변경 | L2 multipoint = 스위칭/분기 의미 |
| VPRN | 📡 | 📡 유지 | 라우팅/RF 의미 양호 |
| IES  | 🌐 | 🌍 변경 | Internet Enhanced Service = 인터넷 서비스 (지구 아이콘으로 차별화) |

> 대안: 이모지 대신 Lucide 아이콘 + 타입별 색상 조합 (FR-03 참조)

### FR-03: (옵션) Lucide 아이콘 도입

이모지보다 Lucide SVG 아이콘이 다크모드/사이즈 일관성에 유리:

| 타입 | Lucide 아이콘 | 색상 적용 |
|------|---------------|-----------|
| Epipe | `<Link2 />` | text-blue-500 |
| VPLS  | `<Share2 />` | text-emerald-500 |
| VPRN  | `<Router />` | text-violet-500 |
| IES   | `<Globe />` | text-amber-500 |

### FR-04: 타입 버튼 색상 구분

현재 모두 blue → 타입별 고유 색상으로 변경:

```tsx
// 활성 상태 색상 매핑
const typeActiveColors = {
  all:   'bg-gray-700 text-white border-gray-700',
  epipe: 'bg-blue-600 text-white border-blue-600',
  vpls:  'bg-emerald-600 text-white border-emerald-600',
  vprn:  'bg-violet-600 text-white border-violet-600',
  ies:   'bg-amber-600 text-white border-amber-600',
  ha:    'bg-green-600 text-white border-green-600',
};

// 비활성 상태 색상 매핑
const typeInactiveColors = {
  all:   'border-gray-300 bg-white text-gray-700',
  epipe: 'border-blue-200 bg-blue-50 text-blue-700',
  vpls:  'border-emerald-200 bg-emerald-50 text-emerald-700',
  vprn:  'border-violet-200 bg-violet-50 text-violet-700',
  ies:   'border-amber-200 bg-amber-50 text-amber-700',
  ha:    'border-green-200 bg-green-50 text-green-700',
};
```

### FR-05: 그룹 헤더 색상 구분

타입 버튼과 동일한 색상 체계를 그룹 헤더에도 적용:
- 그룹 헤더 좌측에 타입 색상 보더 또는 배경색 tint

## 구현 범위 (Scope)

### 변경 파일
- `src/components/v3/ServiceListV3.tsx` (주요)
- `src/components/v3/Dashboard.tsx` (색상 토큰 상수 공유 시)

### 제거/변경 항목
- 타입 버튼 `bg-blue-600` 단일 색상 → 타입별 색상 매핑 객체
- VPLS 이모지 `🌐` → `🔀` (또는 Lucide `<Share2 />`)
- IES 이모지 `🌐` → `🌍` (또는 Lucide `<Globe />`)

### 추가 항목
- `typeActiveColors` / `typeInactiveColors` 색상 맵 상수
- 그룹 헤더 색상 보더 (옵션)

## 예상 효과

| 항목 | 이전 | 이후 |
|------|------|------|
| 타입 구분 방식 | 텍스트만 | 색상 + 아이콘 + 텍스트 |
| Dashboard ↔ ServiceList 일관성 | 불일치 | 동일 색상 토큰 |
| VPLS/IES 아이콘 구분 | 불가 | 명확 구분 |
| 글로벌 표준 근접도 | 낮음 | 높음 |

## 일정

- Plan: 2026-03-03
- Design/Do: 승인 후 즉시

## 관련 참고

- 글로벌 네트워크 시각화 표준: Cisco DNA Center, Nokia 5620 SAM, Grafana Network Panel
- 색상 우선 구분이 아이콘보다 인지 속도 빠름 (Nielsen Norman Group)
- Tailwind v4 color tokens: blue/emerald/violet/amber 계열 사용 일관성
