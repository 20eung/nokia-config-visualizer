# Plan: React 성능 최적화

## 기능 ID
`react-performance-optimization` (v5.8.0)

## 작성일
2026-04-10

## 문제 정의 (Problem Statement)

### 현재 상황
Vercel React Best Practices 기준으로 코드베이스를 점검한 결과, 4가지 범주의 성능 이슈가 발견됨.
특히 이벤트 리스너 메모리 누수는 장시간 사용 시 실제 성능 저하를 유발할 수 있음.

### 발견된 문제 요약

| 심각도 | 항목 | 파일 | 라인 |
|--------|------|------|------|
| 높음 | 이벤트 리스너 메모리 누수 (useCallback 누락) | `V3Page.tsx` | 119, 177, 208, 255 |
| 높음 | Stale closure (WebSocket handleMessage) | `useConfigWebSocket.ts` | 131 |
| 중간 | 정규식 매 호출마다 재생성 | `Dashboard.tsx`, `ServiceListV3.tsx` | 23, 64 |
| 중간 | `normalizeSearchString` 함수 중복 정의 | `Dashboard.tsx`, `ServiceListV3.tsx` | 23, 64 |
| 중간 | `handleCopyImagePNG` useCallback 누락 | `ServiceDiagram.tsx` | 120 |
| 낮음 | `statCards` 배열 useMemo 누락 | `Dashboard.tsx` | 85 |

---

## 문제 상세

### 1. 이벤트 리스너 메모리 누수 (`V3Page.tsx`)

`useEffect` 내부에서 이벤트 핸들러 함수를 매번 새로 생성하고 있어,
`removeEventListener` 호출 시 다른 함수 참조를 전달하게 됨.
결과적으로 리스너가 실제로 해제되지 않아 메모리 누수 발생.

**영향을 받는 핸들러:**
- `handleFileToggle` (line 119) — `config-file-selected`, `config-file-removed` 이벤트
- `handleLoadAll` (line 177) — `config-files-load-all` 이벤트
- `handleFileChanged` (line 208) — `config-file-changed` 이벤트
- `resize`, `stopResizing` (line 255) — `mousemove`, `mouseup` 이벤트

```typescript
// 현재 (버그): cleanup 시 다른 함수 참조 → 리스너 해제 실패
useEffect(() => {
  const handleFileToggle = async (event: Event) => { ... }; // 매번 새 함수
  window.addEventListener('config-file-selected', handleFileToggle);
  return () => window.removeEventListener('config-file-selected', handleFileToggle); // ❌
}, [configs]);

// 목표: useCallback으로 참조 안정화
const handleFileToggle = useCallback(async (event: Event) => { ... }, [configs]);
useEffect(() => {
  window.addEventListener('config-file-selected', handleFileToggle);
  return () => window.removeEventListener('config-file-selected', handleFileToggle); // ✅
}, [handleFileToggle]);
```

### 2. Stale Closure — WebSocket handleMessage (`useConfigWebSocket.ts:131`)

`handleMessage`가 `activeFiles`에 의존하는 `useCallback`으로 정의되어 있으나,
WebSocket 인스턴스의 `ws.onmessage`는 생성 시점의 클로저를 캡처함.
`activeFiles` 변경 이후에도 이전 값을 참조하는 stale closure 버그 발생 가능.

```typescript
// 현재 (버그): ws.onmessage가 최초 handleMessage만 참조
ws.onmessage = (event) => {
  handleMessage(JSON.parse(event.data)); // ❌ 이전 activeFiles 사용 가능
};

// 목표: useRef로 항상 최신 handleMessage 참조
const handleMessageRef = useRef(handleMessage);
useEffect(() => { handleMessageRef.current = handleMessage; }, [handleMessage]);

ws.onmessage = (event) => {
  handleMessageRef.current(JSON.parse(event.data)); // ✅
};
```

### 3. 정규식 매 호출마다 재생성 (`Dashboard.tsx:23`, `ServiceListV3.tsx:64`)

`normalizeSearchString` 함수가 두 파일에 동일하게 정의되어 있고,
내부의 정규식 리터럴이 함수 호출마다 새 `RegExp` 객체로 컴파일됨.
검색 입력 시마다 반복 호출되는 함수이므로 불필요한 오버헤드 발생.

**추가 문제**: 동일 함수가 두 파일에 중복 정의 → 공유 유틸로 추출 필요.

```typescript
// 현재 (비효율): 호출마다 RegExp 생성
function normalizeSearchString(str: string): string {
  return str.replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-'); // ❌
}

// 목표: 모듈 레벨 상수 + 공유 유틸
// src/utils/stringUtils.ts
const RE_UNICODE_HYPHEN = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g;
export function normalizeSearchString(str: string): string {
  return str.normalize('NFKD').replace(RE_UNICODE_HYPHEN, '-').toLowerCase(); // ✅
}
```

### 4. `handleCopyImagePNG` useCallback 누락 (`ServiceDiagram.tsx:120`)

약 150줄 규모의 이미지 처리 함수가 `useCallback` 없이 컴포넌트 내 직접 정의됨.
`ServiceDiagram`이 리렌더링될 때마다 함수 객체가 재생성되어 하위 컴포넌트 props 비교 실패 가능.

### 5. `statCards` useMemo 누락 (`Dashboard.tsx:85`)

`totalStats`로부터 파생되는 배열이 매 렌더링마다 새 객체로 생성됨.
`totalStats`가 변경되지 않았더라도 참조 동등성이 깨져 하위 컴포넌트 불필요 리렌더 유발.

---

## 목표 (Goals)

1. **메모리 누수 제거**: 이벤트 리스너가 정상적으로 해제되도록 수정
2. **Stale closure 방지**: WebSocket 핸들러가 항상 최신 상태를 참조하도록 수정
3. **연산 중복 제거**: 정규식 및 공통 유틸 함수 모듈화
4. **불필요한 리렌더 감소**: useMemo/useCallback 적용으로 참조 안정성 확보

---

## 비목표 (Non-Goals)

- 아이콘 import 방식 변경 (lucide-react 직접 경로 import는 이미 최적화된 상태)
- React.lazy 추가 적용 (DictionaryEditor 등 이미 적용됨)
- 번들 분할 구조 변경

---

## 구현 범위

### 수정 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `src/utils/stringUtils.ts` | 신규 생성 — `normalizeSearchString` 공유 유틸 |
| `src/pages/V3Page.tsx` | 이벤트 핸들러 4개 useCallback 적용 |
| `src/hooks/useConfigWebSocket.ts` | handleMessage useRef 패턴 적용 |
| `src/components/v3/ServiceDiagram.tsx` | `handleCopyImagePNG` useCallback 적용 |
| `src/components/v3/Dashboard.tsx` | 정규식 호이스팅, `statCards` useMemo, import 수정 |
| `src/components/v3/ServiceListV3.tsx` | 정규식 호이스팅, import 수정 |

### 우선순위

1. `src/utils/stringUtils.ts` 생성 (다른 수정의 기반)
2. `V3Page.tsx` 이벤트 리스너 수정 (가장 높은 영향)
3. `useConfigWebSocket.ts` stale closure 수정
4. `ServiceDiagram.tsx` useCallback 적용
5. `Dashboard.tsx` 정규식 + useMemo 수정
6. `ServiceListV3.tsx` 정규식 수정

---

## 검증 기준 (Acceptance Criteria)

- [ ] 브라우저 DevTools Memory 탭에서 config 파일 교체 반복 시 메모리 증가 없음
- [ ] WebSocket 연결 중 다른 파일 선택/해제 시 파일 목록 정상 동기화
- [ ] 검색창 입력 시 정상 필터링 동작 (기존 동작 변경 없음)
- [ ] Copy PNG 기능 정상 동작
- [ ] TypeScript 컴파일 에러 없음

---

## 버전
`v5.8.0` (patch: react-performance-optimization)
