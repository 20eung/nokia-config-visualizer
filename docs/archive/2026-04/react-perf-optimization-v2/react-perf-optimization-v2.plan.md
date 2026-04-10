# Plan - react-perf-optimization-v2

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | react-perf-optimization-v2 |
| 시작일 | 2026-04-10 |
| 예상 기간 | 1일 |
| 유형 | Performance Optimization |

### Value Delivered (4-Perspective)

| 관점 | 내용 |
|------|------|
| **Problem** | v5.8.0 성능 최적화 이후에도 render 중 무거운 계산, useCallback 누락, 불필요한 리렌더링이 잔존함 |
| **Solution** | diagrams 그루핑 useMemo 적용, handleCopyCode/handleZoom useCallback 적용, Dashboard static config 외부화 |
| **Function UX Effect** | 다이어그램 전환 시 화면 끊김 감소, 버튼 클릭 응답성 향상 |
| **Core Value** | React 렌더링 사이클 최적화 → 서비스 50개 이상 로드 시에도 일관된 UX |

---

## 1. 배경 및 문제 정의

### 1.1 분석 배경

v5.8.0에서 React 성능 최적화(useCallback/useMemo, 메모리 누수, Stale Closure, 정규식 호이스팅)를 완료했으나, 추가 점검을 통해 3개의 잔존 문제를 발견함.

### 1.2 기준

Vercel React Best Practices (45개 규칙, 8개 카테고리) 기준 재점검.

---

## 2. 발견된 문제 (우선순위 순)

### 🔴 HIGH-1: V3Page JSX 내부 inline reduce() 계산 — useMemo 누락

**파일**: `src/pages/V3Page.tsx:605-614`

**문제 코드**:
```tsx
{Object.entries(
  diagrams.reduce((acc, item) => {
    const nt = item.service.networkType && item.service.networkType !== 'unknown'
      ? `_${item.service.networkType}` : '';
    const key = `${item.service.serviceType}_${item.service.serviceId}${nt}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, typeof diagrams>)
).map(([groupKey, group]) => { ... })}
```

**원인**: JSX 내부에서 `diagrams.reduce()` 그루핑을 직접 계산 → 부모 컴포넌트 어떤 state가 변경되든 매 렌더링마다 O(n) 계산 재실행.

**영향**: `diagrams` 배열에 항목이 많을수록(서비스 50개+) 렌더링 지연 증가.

**개선**:
```tsx
// 컴포넌트 상단에 useMemo 추가
const groupedDiagrams = useMemo(() =>
  diagrams.reduce((acc, item) => {
    const nt = item.service.networkType && item.service.networkType !== 'unknown'
      ? `_${item.service.networkType}` : '';
    const key = `${item.service.serviceType}_${item.service.serviceId}${nt}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, typeof diagrams>),
  [diagrams]
);

// JSX에서 사용
{Object.entries(groupedDiagrams).map(([groupKey, group]) => { ... })}
```

---

### 🟡 MEDIUM-1: ServiceDiagram handleCopyCode — useCallback 누락

**파일**: `src/components/v3/ServiceDiagram.tsx:268-284`

**문제 코드**:
```tsx
const handleCopyCode = async () => {    // ← useCallback 없음
    try {
        await navigator.clipboard.writeText(diagram);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
    } catch {
        // fallback execCommand
        ...
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
    }
};
```

**원인**: `handleCopyImagePNG`는 `useCallback(async () => {...}, [diagram, service.serviceId, hostname])`으로 감싸져 있으나, 같은 컴포넌트의 `handleCopyCode`는 누락됨.

**영향**: `ServiceDiagram`이 memo로 감싸진 경우 매 렌더마다 새 함수 참조 생성 → 하위 버튼 불필요한 리렌더.

**개선**:
```tsx
const handleCopyCode = useCallback(async () => {
    try {
        await navigator.clipboard.writeText(diagram);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
    } catch {
        const el = document.createElement('textarea');
        el.value = diagram;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
    }
}, [diagram]);
```

---

### 🟡 MEDIUM-2: ServiceDiagram handleZoomIn/Out/Reset — useCallback 누락

**파일**: `src/components/v3/ServiceDiagram.tsx:286-298`

**문제 코드**:
```tsx
const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.1, 2));
};

const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.1, 0.5));
};

const handleResetZoom = () => {
    setZoom(1);
};
```

**원인**: zoom 제어 3개 함수가 `useCallback` 없이 정의됨. `ServiceDiagram`이 `memo`로 감싸져 있어 props 변경 시 불필요하게 재생성.

**개선**:
```tsx
const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.1, 2));
}, []);

const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 0.1, 0.5));
}, []);

const handleResetZoom = useCallback(() => {
    setZoom(1);
}, []);
```

---

### 🟢 LOW-1: Dashboard statCards — static 설정 컴포넌트 외부화

**파일**: `src/components/v3/Dashboard.tsx:75-80`

**문제 코드**:
```tsx
const statCards = useMemo(() => [
    { label: 'Epipe', count: totalStats.epipe, color: 'bg-blue-500', darkColor: 'dark:bg-blue-600' },
    { label: 'VPLS', count: totalStats.vpls, color: 'bg-emerald-500', darkColor: 'dark:bg-emerald-600' },
    { label: 'VPRN', count: totalStats.vprn, color: 'bg-violet-500', darkColor: 'dark:bg-violet-600' },
    { label: 'IES', count: totalStats.ies, color: 'bg-amber-500', darkColor: 'dark:bg-amber-600' },
], [totalStats]);
```

**원인**: `label`, `color`, `darkColor`는 정적이고 변하지 않음. `totalStats`가 바뀔 때만 `count`가 바뀌므로 메모이제이션 자체가 적절하지만, 정적 설정을 컴포넌트 외부로 분리하면 의도가 더 명확해짐.

**개선**:
```tsx
// 컴포넌트 외부 상수
const STAT_CARD_DEFS = [
    { key: 'epipe' as const, label: 'Epipe', color: 'bg-blue-500', darkColor: 'dark:bg-blue-600' },
    { key: 'vpls' as const, label: 'VPLS', color: 'bg-emerald-500', darkColor: 'dark:bg-emerald-600' },
    { key: 'vprn' as const, label: 'VPRN', color: 'bg-violet-500', darkColor: 'dark:bg-violet-600' },
    { key: 'ies' as const, label: 'IES', color: 'bg-amber-500', darkColor: 'dark:bg-amber-600' },
] as const;

// 컴포넌트 내부: useMemo 불필요 (totalStats 변경 시만 리렌더 자체가 일어남)
const statCards = STAT_CARD_DEFS.map(def => ({ ...def, count: totalStats[def.key] }));
```

---

## 3. 제외 항목 (이미 v5.8.0에서 완료)

| 항목 | 위치 | 상태 |
|------|------|------|
| 정규식 루프 내 생성 | parserV3.ts, ServiceListV3.tsx | ✅ 완료 |
| useCallback 주요 이벤트 핸들러 | V3Page.tsx handleToggleService 등 | ✅ 완료 |
| useMemo 주요 계산 | allServices, selectedServices, diagrams 등 | ✅ 완료 |
| useRef Stale Closure 방지 | activeFilesRef | ✅ 완료 |
| Set/Map 조회 최적화 | ServiceListV3 selectedSet | ✅ 완료 |

---

## 4. 구현 계획

### 4.1 변경 파일

| 파일 | 변경 내용 | 우선순위 |
|------|-----------|---------|
| `src/pages/V3Page.tsx` | `groupedDiagrams` useMemo 추출 | HIGH |
| `src/components/v3/ServiceDiagram.tsx` | `handleCopyCode`, `handleZoomIn/Out/Reset` useCallback 적용 | MEDIUM |
| `src/components/v3/Dashboard.tsx` | `STAT_CARD_DEFS` 외부 상수화 | LOW |

### 4.2 검증 방법

1. React DevTools Profiler로 렌더링 횟수 비교 (Before/After)
2. 서비스 50개+ 로드 후 탭 전환 시 렌더링 시간 측정
3. 기능 회귀 없음 확인 (Copy PNG, Copy Code, Zoom, Dashboard 통계)

---

## 5. 위험 요소

| 위험 | 가능성 | 대응 |
|------|--------|------|
| useCallback 의존성 누락 | 낮음 | 빈 의존성 배열 활용 (setZoom은 stable) |
| diagram 의존성 변경 감지 실패 | 매우 낮음 | 기존 handleCopyImagePNG와 동일 패턴 |
| STAT_CARD_DEFS 타입 오류 | 낮음 | `as const` 사용으로 타입 추론 보장 |

---

## 6. 버전 계획

- 현재 버전: v5.8.0
- 목표 버전: v5.8.1 (patch — 성능 최적화 추가)
