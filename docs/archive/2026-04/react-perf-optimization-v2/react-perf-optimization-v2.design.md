# Design - react-perf-optimization-v2

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | react-perf-optimization-v2 |
| Plan 문서 | `docs/01-plan/features/react-perf-optimization-v2.plan.md` |
| 시작일 | 2026-04-10 |
| 유형 | Performance Optimization (Patch) |
| 목표 버전 | v5.8.1 |

### Value Delivered (4-Perspective)

| 관점 | 내용 |
|------|------|
| **Problem** | v5.8.0 이후에도 JSX 내 inline reduce(), useCallback 미적용 함수 4개가 매 렌더링마다 불필요한 계산/재생성 발생 |
| **Solution** | `groupedDiagrams` useMemo 추출, `handleCopyCode/handleZoom×3` useCallback 적용, Dashboard static 상수 외부화 |
| **Function UX Effect** | 다이어그램 섹션 전환 시 리렌더링 최소화, 버튼 참조 안정화 |
| **Core Value** | 서비스 50개+ 환경에서도 다이어그램 영역 렌더링 일관성 보장 |

---

## 1. 변경 범위

총 3개 파일, 5개 지점 수정. 모두 로직 변경 없이 최적화 래핑만 적용함.

| # | 파일 | 변경 지점 | 유형 | 우선순위 |
|---|------|-----------|------|---------|
| 1 | `src/pages/V3Page.tsx` | JSX 내 `diagrams.reduce()` → `groupedDiagrams` useMemo 추출 | useMemo | HIGH |
| 2 | `src/components/v3/ServiceDiagram.tsx` | `handleCopyCode` useCallback 적용 | useCallback | MEDIUM |
| 3 | `src/components/v3/ServiceDiagram.tsx` | `handleZoomIn` useCallback 적용 | useCallback | MEDIUM |
| 4 | `src/components/v3/ServiceDiagram.tsx` | `handleZoomOut` useCallback 적용 | useCallback | MEDIUM |
| 5 | `src/components/v3/ServiceDiagram.tsx` | `handleResetZoom` useCallback 적용 | useCallback | MEDIUM |
| 6 | `src/components/v3/Dashboard.tsx` | `STAT_CARD_DEFS` 외부 상수화 + `statCards` useMemo 제거 | 리팩토링 | LOW |

---

## 2. 상세 설계

### 2.1 V3Page.tsx — groupedDiagrams useMemo 추출

**위치**: `src/pages/V3Page.tsx`

**현재 코드 (라인 605~614, JSX 내부)**:
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

**변경 후 — 상단 useMemo 선언 추가**:

삽입 위치: `const diagrams: DiagramItem[] = useMemo(...)` 선언 바로 다음 줄 (현재 라인 465 이후)

```tsx
// 다이어그램 표시용 그루핑 (serviceType + serviceId + networkType 키)
const groupedDiagrams = useMemo(() =>
  diagrams.reduce((acc, item) => {
    // v5.6.1: networkType로 ISP/MPLS 분리
    const nt = item.service.networkType && item.service.networkType !== 'unknown'
      ? `_${item.service.networkType}` : '';
    const key = `${item.service.serviceType}_${item.service.serviceId}${nt}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, typeof diagrams>),
  [diagrams]
);
```

**JSX 내 변경** (기존 `Object.entries(diagrams.reduce(...))` 교체):
```tsx
{Object.entries(groupedDiagrams).map(([groupKey, group]) => { ... })}
```

**타입**: `Record<string, DiagramItem[]>` — `typeof diagrams`와 동일한 타입으로 추론됨.

---

### 2.2 ServiceDiagram.tsx — handleCopyCode useCallback 적용

**위치**: `src/components/v3/ServiceDiagram.tsx`

**현재 코드 (라인 268~284)**:
```tsx
const handleCopyCode = async () => {
    try {
        await navigator.clipboard.writeText(diagram);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
    } catch {
        // fallback: execCommand
        const el = document.createElement('textarea');
        el.value = diagram;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
    }
};
```

**변경 후**:
```tsx
const handleCopyCode = useCallback(async () => {
    try {
        await navigator.clipboard.writeText(diagram);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
    } catch {
        // fallback: execCommand
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

**의존성**: `[diagram]` — `diagram` prop이 바뀔 때만 함수 재생성. `setCopiedCode`는 React 보장 stable.

**참고**: 동일 컴포넌트의 `handleCopyImagePNG`는 이미 `useCallback(..., [diagram, service.serviceId, hostname])` 적용됨. 같은 패턴으로 통일.

---

### 2.3 ServiceDiagram.tsx — handleZoom×3 useCallback 적용

**위치**: `src/components/v3/ServiceDiagram.tsx`

**현재 코드 (라인 286~298)**:
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

**변경 후**:
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

**의존성**: `[]` — `setZoom`은 React가 보장하는 stable dispatcher. functional updater(`prev =>`) 사용으로 외부 상태 캡처 불필요.

---

### 2.4 Dashboard.tsx — STAT_CARD_DEFS 외부 상수화

**위치**: `src/components/v3/Dashboard.tsx`

**현재 코드 (라인 75~80)**:
```tsx
const statCards = useMemo(() => [
    { label: 'Epipe', count: totalStats.epipe, color: 'bg-blue-500', darkColor: 'dark:bg-blue-600' },
    { label: 'VPLS', count: totalStats.vpls, color: 'bg-emerald-500', darkColor: 'dark:bg-emerald-600' },
    { label: 'VPRN', count: totalStats.vprn, color: 'bg-violet-500', darkColor: 'dark:bg-violet-600' },
    { label: 'IES', count: totalStats.ies, color: 'bg-amber-500', darkColor: 'dark:bg-amber-600' },
], [totalStats]);
```

**변경 후 — 컴포넌트 외부 상수 선언**:

삽입 위치: `export function Dashboard(...)` 선언 바로 위

```tsx
// 서비스 타입별 통계 카드 정적 설정 (렌더링과 무관한 상수)
const STAT_CARD_DEFS = [
    { key: 'epipe' as const, label: 'Epipe', color: 'bg-blue-500', darkColor: 'dark:bg-blue-600' },
    { key: 'vpls' as const, label: 'VPLS', color: 'bg-emerald-500', darkColor: 'dark:bg-emerald-600' },
    { key: 'vprn' as const, label: 'VPRN', color: 'bg-violet-500', darkColor: 'dark:bg-violet-600' },
    { key: 'ies' as const, label: 'IES', color: 'bg-amber-500', darkColor: 'dark:bg-amber-600' },
];
```

**컴포넌트 내부 변경** (useMemo 제거):
```tsx
// totalStats가 바뀔 때만 리렌더 자체가 발생하므로 useMemo 불필요
const statCards = STAT_CARD_DEFS.map(def => ({ ...def, count: totalStats[def.key] }));
```

**JSX 사용부 변경**: `{statCards.map(card => (` — `card.count` 접근 방식은 동일. `card.label.toLowerCase()`는 `card.key`로 교체.

**타입 보장**: `key: 'epipe' | 'vpls' | 'vprn' | 'ies'` — `as const` + TypeScript `keyof typeof totalStats`로 타입 안전.

---

## 3. 구현 순서

```
1. V3Page.tsx — groupedDiagrams useMemo (HIGH, 독립)
2. ServiceDiagram.tsx — handleCopyCode useCallback (MEDIUM)
3. ServiceDiagram.tsx — handleZoom×3 useCallback (MEDIUM)
4. Dashboard.tsx — STAT_CARD_DEFS 상수화 (LOW)
```

모든 변경은 독립적이므로 순서 무관하게 적용 가능.

---

## 4. 검증 체크리스트

### 기능 회귀 없음
- [ ] Copy PNG 버튼 동작 확인
- [ ] Copy Code 버튼 동작 확인 (clipboard + fallback)
- [ ] Zoom In/Out/Reset 버튼 동작 확인
- [ ] Dashboard 통계 카드 4개 수치 정상 표시
- [ ] 다이어그램 그룹핑 (ISP/MPLS 분리) 정상 동작

### 성능 개선 확인
- [ ] React DevTools Profiler: 다이어그램 영역 리렌더 횟수 감소
- [ ] `groupedDiagrams`: state 변경 시 diagrams 미변경이면 재계산 없음

### TypeScript 컴파일
- [ ] `npm run build` 오류 없음
- [ ] `STAT_CARD_DEFS` key 타입 추론 정상

---

## 5. 코드 변경 요약

| 파일 | 추가 줄 | 변경 줄 | 성격 |
|------|---------|---------|------|
| `V3Page.tsx` | +7 | +1 (JSX 교체) | useMemo 추가 |
| `ServiceDiagram.tsx` | +0 | +8 (래핑 변경) | useCallback 적용 |
| `Dashboard.tsx` | +5 (외부 상수) | -1 (useMemo 제거) | 리팩토링 |
