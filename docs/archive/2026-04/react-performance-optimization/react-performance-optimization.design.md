# Design: React 성능 최적화

## 기능 ID
`react-performance-optimization` (v5.8.0)

## 작성일
2026-04-10

## Plan 참조
[react-performance-optimization.plan.md](../../01-plan/features/react-performance-optimization.plan.md)

---

## 개요 (Overview)

Vercel React Best Practices 점검에서 발견된 5가지 성능 이슈를 수정합니다.
각 수정은 기존 동작을 변경하지 않으면서 메모리 안정성과 렌더링 효율을 개선합니다.

### 수정 대상 파일

| 파일 | 수정 유형 |
|------|-----------|
| `src/utils/stringUtils.ts` | 신규 생성 |
| `src/components/v3/Dashboard.tsx` | 정규식 호이스팅, `statCards` useMemo |
| `src/components/v3/ServiceListV3.tsx` | 정규식 호이스팅 → 공유 유틸 import |
| `src/pages/V3Page.tsx` | `resize`/`stopResizing` useCallback 적용 |
| `src/hooks/useConfigWebSocket.ts` | stale closure → useRef 패턴 |
| `src/components/v3/ServiceDiagram.tsx` | `handleCopyImagePNG` useCallback 적용 |

---

## 1. 공유 유틸 — `src/utils/stringUtils.ts` (신규)

### 목적

`normalizeSearchString` 함수가 `Dashboard.tsx`(line 23)와 `ServiceListV3.tsx`(line 64)에 동일하게 중복 정의되어 있음.
두 파일 모두 함수 내부 정규식 리터럴을 매 호출마다 새로 컴파일하는 문제도 동시에 수반됨.
공유 유틸로 추출하여 중복 제거 및 정규식을 모듈 레벨 상수로 호이스팅.

### 구현

```typescript
// src/utils/stringUtils.ts

/**
 * Unicode 하이픈 변형 문자 정규식
 * 모듈 레벨에서 한 번만 컴파일됨 (v5.8.0: 정규식 호이스팅)
 *
 * 대상: U+2010 ~ U+2015, U+2212 (minus sign), U+FE58, U+FE63, U+FF0D
 */
const RE_UNICODE_HYPHEN = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g;

/**
 * 검색어 정규화 헬퍼
 *
 * - NFKD 정규화로 호환 문자 처리
 * - Unicode 하이픈 변형 → ASCII 하이픈(U+002D) 통일
 * - 소문자 변환
 *
 * 기존 위치:
 *   - Dashboard.tsx line 23 (v5.6.2)
 *   - ServiceListV3.tsx line 64 (v5.5.2)
 */
export function normalizeSearchString(str: string): string {
  return str
    .normalize('NFKD')
    .replace(RE_UNICODE_HYPHEN, '-')
    .toLowerCase();
}
```

### 사용처 변경

**Dashboard.tsx**
```typescript
// 제거 (line 19-28): 인라인 normalizeSearchString 함수 전체 삭제
// 추가 (imports 섹션):
import { normalizeSearchString } from '../../utils/stringUtils';
```

**ServiceListV3.tsx**
```typescript
// 제거 (line 59-69): 인라인 normalizeSearchString 함수 전체 삭제
// 추가 (imports 섹션):
import { normalizeSearchString } from '../../utils/stringUtils';
```

---

## 2. `Dashboard.tsx` — `statCards` useMemo 적용

### 문제

```typescript
// 현재 (line 85-90): totalStats가 변경되지 않아도 매 렌더마다 새 배열 생성
const statCards: Array<{ label: string; count: number; color: string; darkColor: string }> = [
  { label: 'Epipe', count: totalStats.epipe, color: 'bg-blue-500', darkColor: 'dark:bg-blue-600' },
  { label: 'VPLS',  count: totalStats.vpls,  color: 'bg-emerald-500', darkColor: 'dark:bg-emerald-600' },
  { label: 'VPRN',  count: totalStats.vprn,  color: 'bg-violet-500', darkColor: 'dark:bg-violet-600' },
  { label: 'IES',   count: totalStats.ies,   color: 'bg-amber-500', darkColor: 'dark:bg-amber-600' },
];
```

### 수정

```typescript
// 수정 후: totalStats가 변경될 때만 재생성
const statCards = useMemo(() => [
  { label: 'Epipe', count: totalStats.epipe, color: 'bg-blue-500', darkColor: 'dark:bg-blue-600' },
  { label: 'VPLS',  count: totalStats.vpls,  color: 'bg-emerald-500', darkColor: 'dark:bg-emerald-600' },
  { label: 'VPRN',  count: totalStats.vprn,  color: 'bg-violet-500', darkColor: 'dark:bg-violet-600' },
  { label: 'IES',   count: totalStats.ies,   color: 'bg-amber-500', darkColor: 'dark:bg-amber-600' },
], [totalStats]);
```

### import 추가

`useState, useMemo` → `useState, useMemo` (변경 없음, 이미 import됨)

---

## 3. `V3Page.tsx` — `resize` / `stopResizing` useCallback 적용

### 문제

```typescript
// 현재 (line 253-262): 컴포넌트 body에서 매 렌더마다 새 함수 생성
const stopResizing = () => setIsResizing(false);

const resize = (mouseMoveEvent: MouseEvent) => {
  if (isResizing) {
    const newWidth = mouseMoveEvent.clientX;
    if (newWidth > 200 && newWidth < 800) {
      setSidebarWidth(newWidth);
    }
  }
};

// line 264-276: isResizing 변경 시 이전 렌더의 resize/stopResizing 참조를 제거하려 하지만
// 현재 렌더의 새 함수 참조로 removeEventListener 호출 → 실제 제거 실패
useEffect(() => {
  if (isResizing) {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
  } else {
    window.removeEventListener('mousemove', resize);      // ❌ 다른 참조
    window.removeEventListener('mouseup', stopResizing);  // ❌ 다른 참조
  }
  return () => {
    window.removeEventListener('mousemove', resize);      // ❌ 다른 참조
    window.removeEventListener('mouseup', stopResizing);  // ❌ 다른 참조
  };
}, [isResizing]);
```

**버그 시나리오**: 패널 리사이즈 후 마우스를 빠르게 이동하면 `mousemove` 리스너가 해제되지 않아 불필요한 연산 지속.

### 수정

```typescript
// 수정 후: useCallback으로 참조 안정화
const stopResizing = useCallback(() => setIsResizing(false), []);

const resize = useCallback((mouseMoveEvent: MouseEvent) => {
  const newWidth = mouseMoveEvent.clientX;
  if (newWidth > 200 && newWidth < 800) {
    setSidebarWidth(newWidth);
  }
}, []);  // isResizing 체크를 제거: useEffect가 isResizing 변화에 반응하므로 불필요

useEffect(() => {
  if (isResizing) {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
  } else {
    window.removeEventListener('mousemove', resize);      // ✅ 동일 참조
    window.removeEventListener('mouseup', stopResizing);  // ✅ 동일 참조
  }
  return () => {
    window.removeEventListener('mousemove', resize);      // ✅ 동일 참조
    window.removeEventListener('mouseup', stopResizing);  // ✅ 동일 참조
  };
}, [isResizing, resize, stopResizing]);
```

**주의**: `resize` 함수에서 `isResizing` 조건 체크를 제거함.
`useEffect`가 `isResizing === true`일 때만 리스너를 추가하므로, 함수 내부에서 중복 체크할 필요 없음.

### import 변경

```typescript
// 현재
import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
// useCallback 이미 import됨 — 변경 없음
```

---

## 4. `useConfigWebSocket.ts` — Stale Closure 수정

### 문제

`connect` 함수(line 46)는 `useCallback([], [])` — 빈 의존성 배열.
내부에서 `ws.onmessage = (event) => { handleMessage(...) }` 설정(line 63-70).

`handleMessage`는 `useCallback([activeFiles])` — `activeFiles` 변경 시 새 함수 생성.

그러나 `connect`는 최초 1회만 실행되므로 `ws.onmessage`는 최초의 `handleMessage`를 클로저로 캡처.
이후 `activeFiles`가 변경되어 `handleMessage`가 교체되어도 `ws.onmessage`는 여전히 구버전 참조.

```typescript
// 증상: file-changed 메시지 수신 시 activeFiles가 최신이 아닌 상태로 체크
case 'file-changed': {
  if (activeFiles.includes(data.filename)) { // ❌ stale activeFiles
    window.dispatchEvent(new CustomEvent('config-file-changed', ...));
  }
  break;
}
```

### 수정

`handleMessageRef`를 도입하여 `ws.onmessage`가 항상 최신 `handleMessage`를 호출하도록 수정.

```typescript
// handleMessage 정의 (기존 위치 유지, line 131)
const handleMessage = useCallback(
  (message: WebSocketMessage) => { ... },
  [activeFiles]
);

// 추가: handleMessage 최신 참조를 ref에 동기화
const handleMessageRef = useRef(handleMessage);
useEffect(() => {
  handleMessageRef.current = handleMessage;
}, [handleMessage]);

// connect 함수 내 ws.onmessage 수정 (line 63-70)
ws.onmessage = (event) => {
  try {
    const message: WebSocketMessage = JSON.parse(event.data);
    handleMessageRef.current(message);  // ✅ 항상 최신 handleMessage 호출
  } catch (err) {
    console.error('[ConfigWebSocket] Failed to parse message:', err);
  }
};
```

### 추가 import

```typescript
// 현재
import { useState, useEffect, useCallback, useRef } from 'react';
// useRef 이미 import됨 (wsRef, reconnectTimeoutRef 등에서 사용) — 변경 없음
// useEffect 이미 import됨 — 변경 없음
```

---

## 5. `ServiceDiagram.tsx` — `handleCopyImagePNG` useCallback 적용

### 문제

```typescript
// 현재 (line 120): ~150줄 규모 함수를 useCallback 없이 정의
const handleCopyImagePNG = async () => {
  if (!diagramRef.current) return;
  // ... html2canvas, Canvas 2D 처리 로직 (~150줄)
};
```

`ServiceDiagram`이 리렌더링될 때(diagram prop 변경, zoom 변경 등) 함수 객체가 매번 새로 생성됨.
"Copy PNG" 버튼에 이 함수가 직접 전달되므로 버튼 컴포넌트의 props 비교가 항상 실패.

### 수정

```typescript
// 수정 후
const handleCopyImagePNG = useCallback(async () => {
  if (!diagramRef.current) return;
  // ... 기존 로직 동일 (변경 없음)
}, [diagram, service.serviceId, hostname]);
```

**의존성 분석**:
- `diagramRef` — ref 객체, 안정적 (의존성 불필요)
- `diagram` — SVG 문자열, 변경 시 함수 재생성 필요
- `service.serviceId`, `hostname` — Canvas 파일명 생성에 사용 (`${hostname}_${serviceId}.png` 패턴)

### import 변경

```typescript
// 현재
import { useState, useEffect, useRef, useCallback } from 'react';
// useCallback 이미 import됨 — 변경 없음
```

---

## 아키텍처 변경 요약

### 의존성 변화

```
[기존]
Dashboard.tsx ─── normalizeSearchString() (로컬)
ServiceListV3.tsx ─── normalizeSearchString() (로컬, 중복)

[변경 후]
Dashboard.tsx ──────────────────────────────────────┐
                                                     ├─ src/utils/stringUtils.ts
ServiceListV3.tsx ──────────────────────────────────┘
```

### 수정 범위 요약

```
src/
├── utils/
│   └── stringUtils.ts          [신규] normalizeSearchString 공유 유틸
├── pages/
│   └── V3Page.tsx              [수정] resize/stopResizing useCallback
├── hooks/
│   └── useConfigWebSocket.ts   [수정] handleMessageRef 추가
└── components/v3/
    ├── Dashboard.tsx            [수정] normalizeSearchString import, statCards useMemo
    ├── ServiceListV3.tsx        [수정] normalizeSearchString import
    └── ServiceDiagram.tsx       [수정] handleCopyImagePNG useCallback
```

---

## 타입 정의 (Type Definitions)

신규 타입 정의 없음. 모든 수정은 기존 타입을 유지하며 구현 방식만 변경.

---

## 구현 순서 (Implementation Order)

| 순서 | 파일 | 이유 |
|------|------|------|
| 1 | `src/utils/stringUtils.ts` 생성 | Dashboard, ServiceListV3 수정의 선행 조건 |
| 2 | `src/components/v3/Dashboard.tsx` | stringUtils 의존, statCards useMemo 포함 |
| 3 | `src/components/v3/ServiceListV3.tsx` | stringUtils 의존 |
| 4 | `src/pages/V3Page.tsx` | 독립적, 가장 높은 영향 |
| 5 | `src/hooks/useConfigWebSocket.ts` | 독립적 |
| 6 | `src/components/v3/ServiceDiagram.tsx` | 독립적 |

---

## 테스트 시나리오 (Test Scenarios)

### TC-01: 패널 리사이즈 — 메모리 누수 검증
```
Given: 사이드바 리사이즈 핸들을 클릭
When: 마우스를 이동 후 버튼 해제
Then: mousemove 이벤트 리스너가 정상 해제됨
      (DevTools → Performance → Event Listeners에서 mousemove 잔류 없음)
```

### TC-02: WebSocket stale closure — 파일 변경 감지
```
Given: 2개 파일이 활성 상태로 로드됨
When: 1개 파일을 비활성화 후 해당 파일이 서버에서 변경됨
Then: 비활성 파일 변경에 대한 reload 이벤트가 발생하지 않음
      (activeFiles 최신 상태 기준으로 체크)
```

### TC-03: 대시보드 검색 — 동작 변경 없음
```
Given: configs가 로드된 상태
When: 검색창에 Unicode 하이픈 포함 사이트명 입력
Then: 기존과 동일하게 해당 사이트 카드 표시됨
      (normalizeSearchString 공유 유틸 사용 후에도 동작 동일)
```

### TC-04: Copy PNG — 정상 동작
```
Given: 서비스 다이어그램이 렌더링된 상태
When: "Copy PNG" 버튼 클릭
Then: 클립보드에 PNG 이미지 복사됨 (기존 동작 유지)
```

### TC-05: TypeScript 컴파일
```
When: npm run build 실행
Then: TypeScript 컴파일 에러 없음
```

---

## 에러 처리 (Error Handling)

추가적인 에러 처리 로직 없음.
각 수정은 기존 에러 처리 패턴을 그대로 유지.

---

## 성능 영향 예측

| 수정 | 예상 효과 |
|------|-----------|
| `resize` useCallback | 리사이즈 중 불필요한 이벤트 리스너 누적 방지 |
| `handleMessage` useRef | 파일 변경 감지 정확도 향상 (stale closure 제거) |
| 정규식 호이스팅 | 검색 입력 시마다 RegExp 컴파일 제거 |
| `statCards` useMemo | Dashboard 리렌더 시 불필요한 배열 생성 제거 |
| `handleCopyImagePNG` useCallback | Copy PNG 버튼 props 안정화 |

---

## 체크리스트 (Checklist)

### 구현 전
- [x] Plan 문서 작성 완료
- [x] 실제 코드 라인 확인 완료
- [x] 의존성 분석 완료

### 구현 중
- [ ] `src/utils/stringUtils.ts` 생성
- [ ] `Dashboard.tsx` normalizeSearchString 교체 + statCards useMemo
- [ ] `ServiceListV3.tsx` normalizeSearchString 교체
- [ ] `V3Page.tsx` resize/stopResizing useCallback
- [ ] `useConfigWebSocket.ts` handleMessageRef 추가
- [ ] `ServiceDiagram.tsx` handleCopyImagePNG useCallback

### 구현 후
- [ ] 패널 리사이즈 동작 확인
- [ ] 대시보드 검색 동작 확인
- [ ] Copy PNG 동작 확인
- [ ] WebSocket 파일 변경 감지 동작 확인
- [ ] TypeScript 컴파일 에러 없음
- [ ] `npm run build` 성공

---

**Design 작성자**: Claude Sonnet 4.6
**작성일**: 2026-04-10
**최종 수정일**: 2026-04-10
