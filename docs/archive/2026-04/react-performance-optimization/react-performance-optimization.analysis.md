---
feature: react-performance-optimization
version: v5.8.0
status: check
matchRate: 100
createdAt: 2026-04-10
updatedAt: 2026-04-10
analyzer: Claude Sonnet 4.6 (Manual Gap Analysis)
---

# React 성능 최적화 - Gap Analysis

> **Feature**: React 성능 최적화 (메모리 누수, Stale Closure, 정규식 최적화, useMemo/useCallback)
> **Match Rate**: 100%
> **Design**: docs/02-design/features/react-performance-optimization.design.md
> **Phase**: Check

---

## 1. 전체 요약

| Feature | 설계 항목 수 | 구현 항목 수 | 일치 | Gap | 일치율 |
|---------|:-----------:|:-----------:|:----:|:---:|:-----:|
| F1: 공유 유틸 추출 | 3 | 3 | 3 | 0 | **100%** |
| F2: Dashboard 최적화 | 2 | 2 | 2 | 0 | **100%** |
| F3: ServiceListV3 최적화 | 2 | 2 | 2 | 0 | **100%** |
| F4: V3Page resize 수정 | 4 | 4 | 4 | 0 | **100%** |
| F5: WebSocket stale closure 수정 | 2 | 2 | 2 | 0 | **100%** |
| F6: ServiceDiagram useCallback | 2 | 2 | 2 | 0 | **100%** |
| **전체** | **15** | **15** | **15** | **0** | **100%** |

---

## 2. 파일 구조 검증

### 2.1 신규 파일 (Design: 1개)

| 파일 | 설계 | 구현 | 상태 |
|------|:----:|:----:|:----:|
| `src/utils/stringUtils.ts` | ✅ | ✅ | **일치** |

### 2.2 수정 파일 (Design: 5개)

| 파일 | 변경 내용 | 상태 |
|------|-----------|:----:|
| `src/components/v3/Dashboard.tsx` | normalizeSearchString import 교체, statCards useMemo | **일치** |
| `src/components/v3/ServiceListV3.tsx` | normalizeSearchString import 교체, 인라인 함수 삭제 | **일치** |
| `src/pages/V3Page.tsx` | resize/stopResizing useCallback, useEffect 의존성 추가 | **일치** |
| `src/hooks/useConfigWebSocket.ts` | handleMessageRef 추가, ws.onmessage 수정 | **일치** |
| `src/components/v3/ServiceDiagram.tsx` | useCallback import 추가, handleCopyImagePNG useCallback | **일치** |

---

## 3. Feature 1: 공유 유틸 추출 — `stringUtils.ts`

### 3.1 구현 내용

| 설계 항목 | 구현 내용 | 상태 | 비고 |
|---------|---------|:----:|-----|
| `RE_UNICODE_HYPHEN` 모듈 레벨 상수 | `const RE_UNICODE_HYPHEN = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g` | ✅ | 일치 |
| `normalizeSearchString` export | `export function normalizeSearchString(str: string): string` | ✅ | 일치 |
| NFKD + replace + toLowerCase 로직 | `.normalize('NFKD').replace(RE_UNICODE_HYPHEN, '-').toLowerCase()` | ✅ | 일치 |

### 3.2 코드 확인

```typescript
// src/utils/stringUtils.ts (line 14, 23-28)

const RE_UNICODE_HYPHEN = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g;  // ✅ 모듈 레벨

export function normalizeSearchString(str: string): string {
  return str
    .normalize('NFKD')
    .replace(RE_UNICODE_HYPHEN, '-')   // ✅ 컴파일된 상수 재사용
    .toLowerCase();
}
```

> 설계와 완전 일치. 정규식이 모듈 레벨에서 한 번만 컴파일되어 매 호출마다 재생성하던 기존 문제 해결.

---

## 4. Feature 2: Dashboard 최적화

### 4.1 normalizeSearchString import 교체

| 설계 항목 | 구현 내용 | 상태 |
|---------|---------|:----:|
| 인라인 `normalizeSearchString` 함수 삭제 | line 19-28 전체 삭제 확인 | ✅ |
| `stringUtils` import 추가 | `import { normalizeSearchString } from '../../utils/stringUtils'` | ✅ |

### 4.2 `statCards` useMemo 적용

| 설계 항목 | 구현 내용 | 상태 | 비고 |
|---------|---------|:----:|-----|
| `useMemo(() => [...], [totalStats])` 적용 | `const statCards = useMemo(() => [...], [totalStats])` | ✅ | 일치 |
| 의존성 배열 `[totalStats]` | `[totalStats]` | ✅ | 일치 |

### 4.3 코드 확인

```typescript
// src/components/v3/Dashboard.tsx (line 18, 75-80)

import { normalizeSearchString } from '../../utils/stringUtils';  // ✅

const statCards = useMemo(() => [                                  // ✅ useMemo 적용
  { label: 'Epipe', count: totalStats.epipe, color: 'bg-blue-500', darkColor: 'dark:bg-blue-600' },
  { label: 'VPLS',  count: totalStats.vpls,  color: 'bg-emerald-500', darkColor: 'dark:bg-emerald-600' },
  { label: 'VPRN',  count: totalStats.vprn,  color: 'bg-violet-500', darkColor: 'dark:bg-violet-600' },
  { label: 'IES',   count: totalStats.ies,   color: 'bg-amber-500', darkColor: 'dark:bg-amber-600' },
], [totalStats]);
```

---

## 5. Feature 3: ServiceListV3 최적화

### 5.1 normalizeSearchString 교체

| 설계 항목 | 구현 내용 | 상태 |
|---------|---------|:----:|
| 인라인 `normalizeSearchString` 함수 (11줄) 삭제 | 해당 블록 완전 삭제 확인 | ✅ |
| `stringUtils` import 추가 | `import { normalizeSearchString } from '../../utils/stringUtils'` | ✅ |

### 5.2 코드 확인

```typescript
// src/components/v3/ServiceListV3.tsx (line 10)

import { normalizeSearchString } from '../../utils/stringUtils';  // ✅ 공유 유틸 사용
// 이하 normalizeSearchString 호출부 동작 동일 (함수 시그니처 동일)
```

---

## 6. Feature 4: V3Page resize/stopResizing 수정

### 6.1 설계 대비 구현 비교

| 설계 항목 | 구현 내용 | 상태 | 비고 |
|---------|---------|:----:|-----|
| `stopResizing = useCallback(() => setIsResizing(false), [])` | 동일 구현 (line 253) | ✅ | 일치 |
| `resize = useCallback(...)` 적용 | 동일 구현 (line 255-260) | ✅ | 일치 |
| `resize` 내부 `isResizing` 조건 체크 제거 | 제거 확인 | ✅ | 일치 |
| `useEffect` 의존성에 `resize`, `stopResizing` 추가 | `[isResizing, resize, stopResizing]` | ✅ | 일치 |
| _(설계 미언급)_ | `startResizing`도 `useCallback` 적용 | ✨ | **설계 초과** |

### 6.2 코드 확인

```typescript
// src/pages/V3Page.tsx (line 248-274)

const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {  // ✨ 설계 초과
  mouseDownEvent.preventDefault();
  setIsResizing(true);
}, []);

const stopResizing = useCallback(() => setIsResizing(false), []);          // ✅

const resize = useCallback((mouseMoveEvent: MouseEvent) => {               // ✅
  const newWidth = mouseMoveEvent.clientX;
  if (newWidth > 200 && newWidth < 800) {
    setSidebarWidth(newWidth);
  }
}, []);  // ✅ isResizing 내부 체크 제거

useEffect(() => {
  if (isResizing) {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
  } else {
    window.removeEventListener('mousemove', resize);
    window.removeEventListener('mouseup', stopResizing);
  }
  return () => {
    window.removeEventListener('mousemove', resize);
    window.removeEventListener('mouseup', stopResizing);
  };
}, [isResizing, resize, stopResizing]);  // ✅ 의존성 배열 완전 명시
```

> **설계 초과 설명**: `startResizing`에도 `useCallback`이 적용되었습니다.
> 설계 문서에서는 `resize`, `stopResizing`만 명시했으나, `startResizing` 역시 인라인 함수였으므로 일관성 차원에서 함께 적용된 것은 타당한 결정입니다. 기능 변경 없음.

---

## 7. Feature 5: WebSocket Stale Closure 수정

### 7.1 설계 대비 구현 비교

| 설계 항목 | 구현 내용 | 상태 |
|---------|---------|:----:|
| `handleMessageRef = useRef(handleMessage)` 추가 | `const handleMessageRef = useRef(handleMessage)` (line 231) | ✅ |
| `useEffect(() => { handleMessageRef.current = handleMessage; }, [handleMessage])` | 동일 구현 (line 232-234) | ✅ |
| `ws.onmessage`에서 `handleMessageRef.current(message)` 호출 | `handleMessageRef.current(message)` (line 66) | ✅ |

### 7.2 코드 확인

```typescript
// src/hooks/useConfigWebSocket.ts (line 230-234)

// handleMessage가 교체되어도 ws.onmessage가 항상 최신 버전을 호출하도록 ref에 동기화
const handleMessageRef = useRef(handleMessage);  // ✅
useEffect(() => {
  handleMessageRef.current = handleMessage;       // ✅ activeFiles 변경 시 동기화
}, [handleMessage]);

// ws.onmessage (line 63-70)
ws.onmessage = (event) => {
  try {
    const message: WebSocketMessage = JSON.parse(event.data);
    handleMessageRef.current(message);  // ✅ 항상 최신 handleMessage 호출
  } catch (err) {
    console.error('[ConfigWebSocket] Failed to parse message:', err);
  }
};
```

> `handleMessage`는 여전히 `[activeFiles]` 의존성을 유지합니다.
> `handleMessageRef`를 통해 WebSocket 생성 이후에도 최신 `activeFiles`를 참조하게 됨으로써
> stale closure 버그가 완전히 해결되었습니다.

---

## 8. Feature 6: ServiceDiagram useCallback 적용

### 8.1 설계 대비 구현 비교

| 설계 항목 | 구현 내용 | 상태 |
|---------|---------|:----:|
| `useCallback` import 추가 | `import { memo, useEffect, useRef, useState, useCallback }` (line 1) | ✅ |
| `handleCopyImagePNG = useCallback(async () => { ... }, [...])` | 동일 구현 (line 120, 266) | ✅ |
| 의존성 배열 `[diagram, service.serviceId, hostname]` | `[diagram, service.serviceId, hostname]` | ✅ |
| `diagramRef` 의존성 제외 (ref 안정적) | 미포함 확인 | ✅ |

### 8.2 코드 확인

```typescript
// src/components/v3/ServiceDiagram.tsx (line 120, 266)

const handleCopyImagePNG = useCallback(async () => {  // ✅ useCallback 적용
  if (!diagramRef.current) return;
  // ... 기존 html2canvas + Canvas 2D 처리 로직 (변경 없음)
}, [diagram, service.serviceId, hostname]);            // ✅ 설계와 동일한 의존성
```

---

## 9. Gap 목록

### 없음

모든 설계 항목이 구현되었습니다. Gap이 존재하지 않습니다.

---

## 10. 설계 초과 구현 (Enhancements)

| 항목 | 위치 | 설명 | 영향 |
|------|------|------|------|
| `startResizing` useCallback 적용 | `V3Page.tsx:248` | 설계에서 미언급이었으나 일관성 차원에서 적용 | 긍정적 (기능 변경 없음) |

---

## 11. TypeScript 빌드 상태

| 빌드 대상 | 명령어 | 상태 |
|---------|-------|:----:|
| 프론트엔드 | `npx tsc --noEmit` | ✅ 통과 (에러 0) |

---

## 12. 최종 판정

```
Match Rate: 100%

[F1: 공유 유틸 추출]         ████████████████████ 100% ( 3/ 3)
[F2: Dashboard 최적화]       ████████████████████ 100% ( 2/ 2)
[F3: ServiceListV3 최적화]   ████████████████████ 100% ( 2/ 2)
[F4: V3Page resize 수정]     ████████████████████ 100% ( 4/ 4)
[F5: WebSocket stale closure] ████████████████████ 100% ( 2/ 2)
[F6: ServiceDiagram useCallback] ████████████████████ 100% ( 2/ 2)

Overall                      ████████████████████ 100% (15/15)
```

### 판정: ✅ Check Phase 통과 (100% ≥ 90%)

- Gap 없음
- 설계 초과 1건 (`startResizing` useCallback): 기능 동일, 일관성 개선
- TypeScript 컴파일 에러 없음

---

**분석자**: Claude Sonnet 4.6
**분석일**: 2026-04-10
**기준 Design**: docs/02-design/features/react-performance-optimization.design.md
