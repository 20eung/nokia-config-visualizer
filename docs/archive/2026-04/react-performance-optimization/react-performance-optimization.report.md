# 완성 보고서: React 성능 최적화

> **기능명**: `react-performance-optimization` (v5.8.0)
>
> **작성일**: 2026-04-10
> **업데이트일**: 2026-04-10
> **상태**: ✅ 완료 (Match Rate: 100%)
> **반복**: 0회 (1차 완성)

---

## 1. 실행 요약 (Executive Summary)

### 1.1 기능명
**React 성능 최적화** — Vercel React Best Practices 기준 점검을 통해 발견된 메모리 누수, Stale Closure, 정규식 반복 생성, 불필요한 리렌더링 문제를 일괄 해결

### 1.2 문제점

| 심각도 | 항목 | 영향 |
|--------|------|------|
| 🔴 높음 | `resize`/`stopResizing` useCallback 누락 → 이벤트 리스너 해제 실패 | 패널 리사이즈 시 `mousemove` 리스너 메모리 누수 |
| 🔴 높음 | WebSocket `handleMessage` stale closure | `activeFiles` 변경 후에도 이전 상태로 파일 변경 감지 오작동 |
| 🟡 중간 | `normalizeSearchString` 정규식 매 호출마다 재생성 | 검색 입력 시마다 `RegExp` 객체 반복 컴파일 |
| 🟡 중간 | `normalizeSearchString` 두 파일 중복 정의 | 코드 중복, 수정 시 양쪽 모두 변경 필요 |
| 🟡 중간 | `handleCopyImagePNG` useCallback 누락 | 매 렌더마다 150줄 함수 재생성 |
| 🟢 낮음 | `statCards` useMemo 누락 | 매 렌더마다 배열 객체 재생성 |

### 1.3 해결책

| 해결 방향 | 구체적 조치 |
|-----------|-------------|
| 공유 유틸 추출 | `src/utils/stringUtils.ts` 신규 생성 — `RE_UNICODE_HYPHEN` 모듈 레벨 상수 + `normalizeSearchString` export |
| 이벤트 리스너 안정화 | `resize`, `stopResizing`, `startResizing` 모두 `useCallback` 적용, `useEffect` deps 완전 명시 |
| Stale Closure 제거 | `handleMessageRef = useRef(handleMessage)` 패턴으로 WebSocket이 항상 최신 핸들러 호출 |
| 불필요한 리렌더 제거 | `handleCopyImagePNG` useCallback, `statCards` useMemo 적용 |

### 1.4 주요 성과

| 지표 | 목표 | 달성 |
|------|------|------|
| 설계-구현 일치율 | ≥ 90% | **100%** ✅ |
| 반복 횟수 | ≤ 5 | **0회** ✅ |
| TypeScript 컴파일 에러 | 0 | **0** ✅ |
| Docker 재빌드 | 성공 | **성공** ✅ |
| 수정 파일 수 | 6 | **6** ✅ |
| 신규 파일 수 | 1 | **1** ✅ |

---

## 2. 프로젝트 개요 (Project Overview)

### 2.1 초기 목표 (Plan 단계)

| 목표 | 설명 |
|------|------|
| 메모리 누수 제거 | 이벤트 리스너가 `removeEventListener`로 정상 해제되도록 보장 |
| Stale Closure 방지 | WebSocket 핸들러가 항상 최신 `activeFiles` 상태 참조 |
| 연산 중복 제거 | 정규식 및 공통 함수를 모듈 레벨로 호이스팅, 두 파일 중복 통합 |
| 불필요한 리렌더 감소 | useMemo/useCallback 적용으로 참조 안정성 확보 |

### 2.2 성공 기준 (Acceptance Criteria)

| 기준 | 목표 | 달성 | 상태 |
|------|------|------|------|
| Match Rate | ≥ 90% | 100% | ✅ Pass |
| TypeScript 컴파일 | 에러 0 | 에러 0 | ✅ Pass |
| 패널 리사이즈 정상 동작 | 메모리 누수 없음 | 확인 | ✅ Pass |
| 검색 필터링 동작 유지 | 기존과 동일 | 유지 | ✅ Pass |
| Copy PNG 동작 유지 | 기존과 동일 | 유지 | ✅ Pass |
| Docker 재빌드 | 성공 | 성공 | ✅ Pass |

---

## 3. 구현 요약 (Implementation Summary)

### 3.1 신규 파일

#### `src/utils/stringUtils.ts`
```typescript
// 정규식을 모듈 레벨에서 한 번만 컴파일
const RE_UNICODE_HYPHEN = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g;

// 두 파일에 중복 정의되어 있던 함수를 공유 유틸로 추출
export function normalizeSearchString(str: string): string {
  return str.normalize('NFKD').replace(RE_UNICODE_HYPHEN, '-').toLowerCase();
}
```

### 3.2 수정 파일 목록

| 파일 | 변경 내용 | 핵심 코드 |
|------|-----------|-----------|
| `src/components/v3/Dashboard.tsx` | 인라인 함수 삭제 → `stringUtils` import, `statCards` useMemo 적용 | `useMemo(() => [...], [totalStats])` |
| `src/components/v3/ServiceListV3.tsx` | 인라인 함수 삭제 → `stringUtils` import | `import { normalizeSearchString }` |
| `src/pages/V3Page.tsx` | `resize`, `stopResizing`, `startResizing` useCallback 적용, `useEffect` deps 완전 명시 | `useCallback(() => ..., [])` |
| `src/hooks/useConfigWebSocket.ts` | `handleMessageRef` 추가, `ws.onmessage` 수정 | `handleMessageRef.current(message)` |
| `src/components/v3/ServiceDiagram.tsx` | `useCallback` import 추가, `handleCopyImagePNG` useCallback 적용 | `useCallback(async () => ..., [diagram, ...])` |

### 3.3 기술 스택

| 항목 | 내용 |
|------|------|
| 프레임워크 | React 19 + TypeScript |
| 최적화 패턴 | `useCallback`, `useMemo`, `useRef` |
| 정규식 최적화 | 모듈 레벨 상수 호이스팅 (`parserV3.ts` 패턴 일관성) |
| 공유 유틸 | `src/utils/stringUtils.ts` (신규) |

---

## 4. 설계 vs 구현 비교 (Design vs Implementation)

### 4.1 완벽한 일치 항목 (15개)

| # | Feature | 설계 항목 | 구현 | 상태 |
|---|---------|-----------|------|------|
| 1 | F1 공유 유틸 | `RE_UNICODE_HYPHEN` 모듈 레벨 상수 | ✅ `line 14` | 🟢 완벽 |
| 2 | F1 공유 유틸 | `normalizeSearchString` export 함수 | ✅ `line 23` | 🟢 완벽 |
| 3 | F1 공유 유틸 | NFKD + replace + toLowerCase 로직 | ✅ 일치 | 🟢 완벽 |
| 4 | F2 Dashboard | 인라인 함수 제거 → `stringUtils` import | ✅ `line 18` | 🟢 완벽 |
| 5 | F2 Dashboard | `statCards` useMemo 적용 | ✅ `line 75` | 🟢 완벽 |
| 6 | F3 ServiceListV3 | 인라인 함수 제거 → `stringUtils` import | ✅ `line 10` | 🟢 완벽 |
| 7 | F3 ServiceListV3 | 11줄 중복 함수 완전 삭제 | ✅ 삭제 확인 | 🟢 완벽 |
| 8 | F4 V3Page | `stopResizing` useCallback 적용 | ✅ `line 253` | 🟢 완벽 |
| 9 | F4 V3Page | `resize` useCallback + isResizing 체크 제거 | ✅ `line 255` | 🟢 완벽 |
| 10 | F4 V3Page | `useEffect` deps `[isResizing, resize, stopResizing]` | ✅ `line 274` | 🟢 완벽 |
| 11 | F4 V3Page | `resize` 내부 `isResizing` 조건 중복 체크 제거 | ✅ 제거 확인 | 🟢 완벽 |
| 12 | F5 WebSocket | `handleMessageRef = useRef(handleMessage)` | ✅ `line 231` | 🟢 완벽 |
| 13 | F5 WebSocket | `useEffect` → `handleMessageRef.current` 동기화 | ✅ `line 232` | 🟢 완벽 |
| 14 | F6 ServiceDiagram | `useCallback` import 추가 | ✅ `line 1` | 🟢 완벽 |
| 15 | F6 ServiceDiagram | `handleCopyImagePNG` useCallback `[diagram, serviceId, hostname]` | ✅ `line 120, 266` | 🟢 완벽 |

### 4.2 설계 초과 구현 (1개 — 긍정적)

| # | 항목 | 설명 | 영향 |
|---|------|------|------|
| 1 | `startResizing` useCallback 적용 | 설계 미언급이었으나 일관성 차원에서 함께 적용 | 🟢 긍정적 (기능 변경 없음) |

### 4.3 Match Rate 계산

```
Match Rate = 구현된 설계 항목 / 전체 설계 항목 × 100%
           = 15 / 15 × 100%
           = 100% ✅
```

---

## 5. 기술적 상세 (Technical Details)

### 5.1 이벤트 리스너 메모리 누수 수정

**버그 원인**: `isResizing` 변화 시 useEffect 재실행 → 새 렌더 사이클의 `resize`/`stopResizing` 참조로 `removeEventListener` 호출 → 이전 렌더에서 등록된 리스너 해제 실패

```typescript
// 수정 전 (버그): 매 렌더마다 새 함수 생성 → removeEventListener 실패
const resize = (e: MouseEvent) => { if (isResizing) { ... } };  // ❌

// 수정 후: useCallback으로 참조 안정화 + isResizing 중복 체크 제거
const resize = useCallback((e: MouseEvent) => {
  const newWidth = e.clientX;
  if (newWidth > 200 && newWidth < 800) setSidebarWidth(newWidth);
}, []);  // ✅ 안정된 참조
```

### 5.2 WebSocket Stale Closure 수정

**버그 원인**: `connect()`는 최초 1회 실행(`useCallback([], [])`). 내부 `ws.onmessage`가 초기 `handleMessage` 클로저 캡처. 이후 `activeFiles` 변경 시 `handleMessage` 교체되지만 `ws.onmessage`는 구버전 유지.

```typescript
// handleMessage가 교체되어도 ws.onmessage가 항상 최신 버전 호출
const handleMessageRef = useRef(handleMessage);
useEffect(() => {
  handleMessageRef.current = handleMessage;  // activeFiles 변경 시 동기화
}, [handleMessage]);

ws.onmessage = (event) => {
  handleMessageRef.current(JSON.parse(event.data));  // ✅ 항상 최신
};
```

### 5.3 정규식 최적화 및 중복 제거

**기존**: `Dashboard.tsx:23`, `ServiceListV3.tsx:64` 두 파일에 동일한 11줄 함수 정의.
함수 내부 정규식 리터럴이 호출 시마다 새 `RegExp` 객체로 컴파일.

**수정**: 공유 유틸 `stringUtils.ts`로 단일화. 정규식은 모듈 레벨에서 한 번만 컴파일.
(`parserV3.ts`의 `RE_*` 패턴과 일관성 유지)

---

## 6. 주요 성과 (Key Achievements)

- ✅ **0회 반복**: 첫 시도에 100% Match Rate 달성
- ✅ **메모리 누수 제거**: `mousemove`/`mouseup` 이벤트 리스너 정상 해제 보장
- ✅ **Stale Closure 제거**: WebSocket 파일 변경 감지 정확도 향상
- ✅ **코드 중복 제거**: `normalizeSearchString` 2개 파일 → 공유 유틸 1개
- ✅ **정규식 최적화**: 모듈 레벨 상수로 반복 컴파일 제거 (`parserV3.ts` 패턴 일관성)
- ✅ **TypeScript 0 에러**: `npx tsc --noEmit` 통과
- ✅ **Docker 재빌드 성공**: 프로덕션 배포 완료 (포트 3301, 3001)

---

## 7. 배우게 된 점 (Lessons Learned)

### 7.1 잘 된 점

1. **Vercel React Best Practices 점검**: 코드 리뷰 전 체계적인 체크리스트 기반 점검으로 놓치기 쉬운 이슈 발굴
2. **우선순위 분류**: 🔴/🟡/🟢 3단계 심각도 분류로 높은 영향 항목부터 처리
3. **실제 라인 번호 확인**: Design 문서 작성 전 코드를 직접 읽어 정확한 라인 번호와 코드 스니펫 포함
4. **일괄 처리 효율**: 관련 항목 5개를 한 PDCA 사이클로 묶어 처리 (개별 사이클 대비 오버헤드 감소)
5. **parserV3.ts 패턴 참조**: 이미 잘 적용된 패턴(`RE_*` 상수)을 다른 파일로 일관성 있게 확장

### 7.2 개선 가능 항목

1. **이벤트 핸들러 일부 미수정**: `handleFileToggle`, `handleLoadAll`, `handleFileChanged`는 `useEffect` 내부 정의라 실질적 메모리 누수는 없으나, empty deps(`[]`)로 인한 stale closure는 잠재적 위험 — 별도 검토 필요
2. **테스트 자동화 부재**: 메모리 누수 수정은 DevTools로만 검증 — 자동화된 메모리 프로파일링 도구 도입 고려
3. **번들 분석 미실시**: 정규식 최적화가 번들 크기에 미치는 영향 미측정

### 7.3 다음 프로젝트에 적용할 점

1. ✅ 새 기능 구현 전 주기적인 Vercel React Best Practices 점검 습관화
2. ✅ 정규식은 처음부터 모듈 레벨 상수로 선언 (`RE_` 접두어 컨벤션)
3. ✅ 공통 유틸 함수는 컴포넌트 내 중복 정의 금지 → `src/utils/` 즉시 추출
4. ⏳ 이벤트 리스너 등록/해제 패턴 — useCallback 의존성 항상 확인
5. ⏳ WebSocket/외부 연결 핸들러 — useRef 패턴 표준화

---

## 8. 미래 개선 사항 (Future Enhancements)

### 잠재적 stale closure 추가 검토 (v5.8.1 후보)

`handleFileToggle`, `handleLoadAll`, `handleFileChanged` 세 핸들러는 현재 `useEffect` 내부에서 정의되어 cleanup이 동일 참조를 사용하므로 메모리 누수는 없음. 그러나 empty deps(`[]`)로 인해 내부에서 사용하는 `handleConfigLoaded` 함수가 변경될 경우 stale closure 가능성 존재.

```typescript
// 잠재적 개선 대상 (현재는 기능상 정상 동작)
useEffect(() => {
  const handleFileToggle = async (event: Event) => {
    // handleConfigLoaded 호출 — empty deps로 인한 stale 가능성
  };
  window.addEventListener('config-file-selected', handleFileToggle);
  return () => window.removeEventListener('config-file-selected', handleFileToggle);
}, []); // ← handleConfigLoaded 의존성 누락
```

### 번들 크기 모니터링

현재 `V3Page-*.js` 청크: **153.46 kB** (gzip: 41.86 kB). 향후 기능 추가 시 번들 분할 전략 검토 권장.

---

## 9. 통계 (Metrics)

| 메트릭 | 목표 | 실제 | 상태 |
|--------|------|------|------|
| **설계-구현 일치율** | ≥ 90% | 100% | ✅ Pass |
| **반복 횟수** | ≤ 5 | 0회 | ✅ Pass |
| **TypeScript 에러** | 0 | 0 | ✅ Pass |
| **Docker 빌드** | 성공 | 성공 | ✅ Pass |
| **신규 파일** | 1 | 1 | ✅ Exact |
| **수정 파일** | 5 | 5 | ✅ Exact |
| **설계 항목** | 15 | 15/15 구현 | ✅ Exact |
| **설계 초과** | - | 1건 (`startResizing`) | ✨ 긍정적 |
| **삭제된 중복 코드** | - | 22줄 (함수 2개) | ✨ 추가 성과 |
| **Vite 빌드 모듈** | - | 1,863개 정상 변환 | ✅ Pass |

---

## 10. 결론 및 권장사항 (Conclusion & Recommendations)

### 결론

**react-performance-optimization** 기능은 **완벽하게 완성**되었습니다.

- ✅ **100%** 설계-구현 일치율
- ✅ **0회** 반복 (첫 시도에 완성)
- ✅ 모든 성공 기준 충족
- ✅ 프로덕션 배포 완료 (Docker 재빌드)

### 즉시 조치 사항

1. ✅ **서비스 점검 완료** — 사용자가 직접 검증 수행
2. ✅ **문서화 완료** — Plan / Design / Analysis / Report 4단계 문서 작성
3. ⏳ **버전 태그** — `v5.8.0` 커밋 및 태그 생성 고려

### 향후 작업

1. **잠재적 stale closure 추가 검토** (v5.8.1): `handleFileToggle` 등 3개 핸들러의 empty deps 의존성 재검토
2. **번들 크기 모니터링**: `V3Page` 청크 153KB — 기능 추가 시 코드 스플리팅 전략 수립
3. **정기 점검 루틴화**: Vercel React Best Practices 점검을 주요 기능 개발 완료 후 정기 수행

---

**보고서 작성자**: Claude Sonnet 4.6
**분석 기준**: Vercel React Best Practices (45 rules / 8 categories)
**작성일**: 2026-04-10
**기준 버전**: v5.8.0
**PDCA 문서**:
- Plan: `docs/01-plan/features/react-performance-optimization.plan.md`
- Design: `docs/02-design/features/react-performance-optimization.design.md`
- Analysis: `docs/03-analysis/react-performance-optimization.analysis.md`
