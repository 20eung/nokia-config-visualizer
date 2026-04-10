# Report - react-perf-optimization-v2

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | react-perf-optimization-v2 |
| 시작일 | 2026-04-10 |
| 완료일 | 2026-04-10 |
| 소요 기간 | 1일 |
| 유형 | Performance Optimization (Patch) |
| 목표 버전 | v5.8.1 |
| Match Rate | **100% (8/8)** |

### 1.3 Value Delivered (4-Perspective)

| 관점 | 내용 |
|------|------|
| **Problem** | v5.8.0 이후에도 JSX 내 inline reduce(), useCallback 미적용 함수 4개가 매 렌더링마다 불필요한 계산/재생성 발생 |
| **Solution** | 3개 파일 6개 지점 수정 — `groupedDiagrams` useMemo 추출, `handleCopyCode/handleZoom×3` useCallback 적용, Dashboard static 상수 외부화 |
| **Function UX Effect** | 다이어그램 전환 시 불필요한 O(n) 재계산 제거, 버튼 함수 참조 안정화로 리렌더 최소화 |
| **Core Value** | 서비스 50개+ 환경에서도 다이어그램 영역 렌더링 일관성 보장 — Vercel React Best Practices 완전 준수 |

---

## 1. 구현 결과

### 1.1 변경 파일 요약

| 파일 | 변경 내용 | 효과 |
|------|-----------|------|
| `src/pages/V3Page.tsx` | `groupedDiagrams` useMemo 추출 (JSX inline reduce 제거) | diagrams 미변경 시 그루핑 재계산 없음 |
| `src/components/v3/ServiceDiagram.tsx` | `handleCopyCode`, `handleZoom×3` useCallback 적용 | 함수 참조 안정화, 불필요한 리렌더 방지 |
| `src/components/v3/Dashboard.tsx` | `STAT_CARD_DEFS` 외부 상수화, `statCards` useMemo 제거 | 정적 설정 명확화, 불필요한 메모이제이션 제거 |

### 1.2 세부 변경

**V3Page.tsx — groupedDiagrams useMemo**
```tsx
// Before: JSX 내부 inline reduce() — 매 렌더마다 O(n) 재계산
{Object.entries(diagrams.reduce((acc, item) => { ... }, {})).map(...)}

// After: useMemo로 추출 — diagrams 변경 시에만 재계산
const groupedDiagrams = useMemo(() =>
  diagrams.reduce((acc, item) => { ... }, {} as Record<string, typeof diagrams>),
  [diagrams]
);
{Object.entries(groupedDiagrams).map(...)}
```

**ServiceDiagram.tsx — useCallback 4개 적용**
```tsx
// Before
const handleCopyCode = async () => { ... };
const handleZoomIn = () => { setZoom(prev => Math.min(prev + 0.1, 2)); };
const handleZoomOut = () => { setZoom(prev => Math.max(prev - 0.1, 0.5)); };
const handleResetZoom = () => { setZoom(1); };

// After
const handleCopyCode = useCallback(async () => { ... }, [diagram]);
const handleZoomIn = useCallback(() => { setZoom(prev => Math.min(prev + 0.1, 2)); }, []);
const handleZoomOut = useCallback(() => { setZoom(prev => Math.max(prev - 0.1, 0.5)); }, []);
const handleResetZoom = useCallback(() => { setZoom(1); }, []);
```

**Dashboard.tsx — STAT_CARD_DEFS 외부 상수화**
```tsx
// Before: 컴포넌트 내부 useMemo (정적 설정 + 동적 count 혼합)
const statCards = useMemo(() => [
  { label: 'Epipe', count: totalStats.epipe, color: 'bg-blue-500', ... },
  ...
], [totalStats]);

// After: 정적 설정 외부 상수 + 단순 map()
const STAT_CARD_DEFS = [
  { key: 'epipe' as const, label: 'Epipe', color: 'bg-blue-500', ... },
  ...
];
const statCards = STAT_CARD_DEFS.map(def => ({ ...def, count: totalStats[def.key] }));
```

---

## 2. Gap Analysis 결과

| 항목 | 체크 | 결과 |
|------|------|------|
| `groupedDiagrams` useMemo `[diagrams]` 의존성 | V3Page.tsx:468-478 | PASS |
| JSX `Object.entries(groupedDiagrams)` 사용 | V3Page.tsx:618 | PASS |
| `handleCopyCode` `useCallback([diagram])` | ServiceDiagram.tsx:268 | PASS |
| `handleZoomIn` `useCallback([])` | ServiceDiagram.tsx:286 | PASS |
| `handleZoomOut` `useCallback([])` | ServiceDiagram.tsx:290 | PASS |
| `handleResetZoom` `useCallback([])` | ServiceDiagram.tsx:294 | PASS |
| `STAT_CARD_DEFS` 컴포넌트 외부 선언 | Dashboard.tsx:26-31 | PASS |
| `statCards` plain `.map()` (useMemo 제거) | Dashboard.tsx:83 | PASS |

**Match Rate: 100% (8/8)**

---

## 3. 빌드 검증

```
✓ built in 9.57s
```

TypeScript 컴파일 오류 없음, 번들 크기 변동 없음.

---

## 4. 누적 성능 최적화 현황 (v5.8.0 + v5.8.1)

| 최적화 항목 | 버전 | 위치 |
|------------|------|------|
| 정규식 루프 내 생성 제거 | v5.8.0 | parserV3.ts, ServiceListV3.tsx |
| 주요 이벤트 핸들러 useCallback | v5.8.0 | V3Page.tsx |
| 주요 계산 useMemo | v5.8.0 | V3Page.tsx (allServices, selectedServices 등) |
| useRef Stale Closure 방지 | v5.8.0 | activeFilesRef |
| Set/Map O(1) 조회 | v5.8.0 | ServiceListV3 selectedSet |
| diagrams 그루핑 useMemo 추출 | **v5.8.1** | V3Page.tsx |
| handleCopyCode useCallback | **v5.8.1** | ServiceDiagram.tsx |
| handleZoom×3 useCallback | **v5.8.1** | ServiceDiagram.tsx |
| STAT_CARD_DEFS 외부 상수화 | **v5.8.1** | Dashboard.tsx |

---

## 5. 학습된 패턴

- JSX 내부 `.reduce()`, `.filter()` 등 계산이 있으면 항상 `useMemo`로 추출해야 함
- `memo()`로 감싼 컴포넌트의 모든 함수는 `useCallback` 적용 대상
- 정적 설정(색상, 라벨)과 동적 데이터(count)가 섞인 `useMemo`는 정적 부분을 외부 상수로 분리 가능
- functional updater(`prev =>`)를 사용하는 setState는 의존성 배열이 `[]`로 안전함

---

## 6. 다음 단계

- 버전 v5.8.1로 bump 후 commit
- `/pdca archive react-perf-optimization-v2` 아카이브
