# Plan - search-global-config

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | search-global-config |
| 시작일 | 2026-04-10 |
| 예상 기간 | 1-2일 |
| 유형 | Feature Enhancement |

### Value Delivered (4-Perspective)

| 관점 | 내용 |
|------|------|
| **Problem** | 앱 검색 결과가 실제 파일시스템 grep 결과와 달라 신뢰성 저하. 로드되지 않은 파일에 있는 서비스가 검색에서 누락됨 |
| **Solution** | 백엔드 전체 파일 검색 API + 프론트엔드 "파일에서도 발견됨" 섹션 추가로 로드 여부와 관계없이 검색 결과 제공 |
| **Function UX Effect** | 검색 시 "로드된 서비스 N개 + 파일에서 추가 M개 발견" 표시로 사용자가 누락된 config 파일을 즉시 파악 가능 |
| **Core Value** | grep 동등 수준의 전수 검색 + 클릭 한 번으로 누락 파일 로드 → 장애 대응 시 완전한 회선 추적 보장 |

---

## 1. 배경 및 문제 정의

### 1.1 현상

`1640`으로 검색 시 앱은 1개 결과만 반환하지만, 실제 `/data/configs/mpls` 폴더에서 grep 실행 시 2개 파일에서 발견됨:

```
SK-Net_Gyowon_7750SR-a8_MPLS_2.txt:    epipe 1640 name "SKHC_PanGyo-Naeoe_50M_2"
SKNet_PangyoITC2F_7750SR_MPLS_2.txt:   epipe 1640 name "SKHC_PanGyo-Naeoe_50M_2"
```

앱 결과: `Epipe 1640 MPLS ⚠️ 현행화 필요 (1개 장비)` — SKNet_PangyoITC2F_7750SR_MPLS_2만 표시

### 1.2 근본 원인 분석

```
[파일시스템]
  SK-Net_Gyowon_7750SR-a8_MPLS_2.txt   ← 앱에 미로드
  SKNet_PangyoITC2F_7750SR_MPLS_2.txt  ← 앱에 로드됨

[앱 내부]
  allServices = configs.flatMap(c => c.services)
                       ↑ 로드된 configs만 대상
  groupedServices key = "epipe-1640-mpls"
                       ↑ 1개 파일 = length:1 = "1개 장비 이상"
```

**핵심**: `ServiceListV3`의 검색은 `props.services` (로드된 것만)를 대상으로 함. 로드되지 않은 파일은 검색 대상에 포함되지 않음.

### 1.3 검색 아키텍처 현황

```
[현재]
사용자 검색 → filteredServices (메모리 내 로드된 서비스만)

[목표]
사용자 검색 → filteredServices (메모리 내) + 파일시스템 grep (watchFolder 내 전체)
                                                ↓
                                          "파일에서 추가 발견" 섹션 표시
```

---

## 2. 요구사항

### 2.1 Functional Requirements

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-01 | 검색 시 watchFolder 내 전체 `.txt` 파일 대상 텍스트 검색 실행 | P0 |
| FR-02 | 로드된 서비스와 미로드 파일 결과를 구분하여 표시 | P0 |
| FR-03 | 검색 결과에서 미로드 파일을 클릭하면 해당 파일 로드 | P1 |
| FR-04 | watchFolder 미설정 시 파일 검색 섹션 숨김 | P0 |
| FR-05 | 파일 검색은 비동기 (로컬 검색 결과 먼저 표시, 파일 결과는 지연 표시) | P1 |
| FR-06 | 검색어 3자 미만 시 파일 검색 미실행 (성능) | P0 |

### 2.2 Non-Functional Requirements

- 응답 시간: 파일 검색 1초 이내 (100개 파일 기준)
- 텍스트 검색: 대소문자 무관 (case-insensitive)
- 파일 크기 제한: 10MB 이상 파일 건너뛰기

---

## 3. 설계 방향

### 3.1 Backend: 파일 검색 API

**새 엔드포인트**: `GET /api/config/search-files?q={query}`

```typescript
// server/src/routes/config.ts 에 추가
// Response:
interface FileSearchResult {
  filename: string;          // "SK-Net_Gyowon_7750SR-a8_MPLS_2.txt"
  matches: number;           // 매칭 라인 수
  snippets: string[];        // 매칭된 라인 미리보기 (최대 3개)
  isLoaded: boolean;         // 현재 앱에 로드됐는지
  filePath: string;          // 전체 경로 (로드용)
}
```

**구현 위치**: `server/src/routes/config.ts`
- watchFolder 경로는 `server/src/config.ts`에서 가져옴
- 각 `.txt` 파일에서 라인별 검색 (스트리밍)
- `configStore`에서 현재 로드된 파일 목록 조회 → `isLoaded` 계산

### 3.2 Frontend: 파일 검색 결과 섹션

**위치**: `ServiceListV3.tsx` — 기존 `filteredServices` 목록 하단에 추가

```
[Services]                 ← 기존 섹션 (로드된 서비스)
─────────────────────────
Epipe (1/1)
  ✅ Epipe 1640 MPLS

[파일에서도 발견됨]         ← 신규 섹션
─────────────────────────
📄 SK-Net_Gyowon_7750SR-a8_MPLS_2.txt  [로드] 버튼
   "epipe 1640 name "SKHC_PanGyo-Naeoe_50M_2""
```

**상태 관리** (ServiceListV3 내부):
```typescript
const [fileSearchResults, setFileSearchResults] = useState<FileSearchResult[]>([]);
const [fileSearchLoading, setFileSearchLoading] = useState(false);
```

**트리거**: `searchQuery` 길이 >= 3 이고 debounce 500ms 후 API 호출

### 3.3 파일 로드 연동

`[로드]` 버튼 클릭 시 → 기존 config 업로드 메커니즘 사용:
- `onLoadFile(filePath)` prop 추가 또는 직접 API 호출
- 파일 로드 후 `fileSearchResults` 업데이트 (`isLoaded: true`)

---

## 4. 구현 계획

### Phase 1: Backend API (우선)
1. `server/src/routes/config.ts` — `/search-files` 엔드포인트 추가
2. `configStore.ts`에서 로드된 파일 경로 목록 조회 메서드 추가
3. 파일 검색 로직 (스트리밍 라인 검색)

### Phase 2: Frontend 통합
1. `src/services/configApi.ts` — **신규 생성**, `searchConfigFiles()` 함수 추가
2. `ServiceListV3.tsx` — 파일 검색 섹션 UI 추가 (API 호출 핸들러는 `useCallback` 적용)
3. `V3Page.tsx` — `onLoadFile` prop 추가 (미로드 파일 로드 핸들러)

### Phase 3: UX 개선 (옵션)
1. 파일 검색 결과에서 서비스 타입 뱃지 표시 (epipe/vpls/vprn 키워드 감지)
2. 미로드 파일에서 발견된 서비스가 현재 선택된 서비스의 상대방 endpoint인 경우 강조 표시

---

## 5. 관련 파일

### 수정 대상
| 파일 | 변경 유형 | 내용 |
|------|---------|------|
| `server/src/routes/config.ts` | 수정 | `/search-files` API 엔드포인트 추가 |
| `server/src/services/configStore.ts` | 수정 | 로드된 파일 경로 목록 조회 메서드 추가 |
| `src/components/v3/ServiceListV3.tsx` | 수정 | 파일 검색 결과 섹션 UI 추가 |
| `src/services/configApi.ts` | **신규 생성** | `searchConfigFiles()` API 클라이언트 함수 |
| `src/pages/V3Page.tsx` | 수정 | `onLoadFile` prop 및 핸들러 추가 |

### 참조
- `server/src/services/configStore.ts` — 현재 로드 파일 관리
- `server/src/config.ts` — watchFolder 경로 설정
- `server/src/routes/ncv.ts` — 기존 NCV API 패턴 참조
- `src/utils/stringUtils.ts` — `normalizeSearchString` (v5.8.0 추가, 검색어 정규화에 활용)

### v5.8.0 최적화 작업 반영 사항
- `ServiceListV3.tsx`: `normalizeSearchString`이 `../../utils/stringUtils`에서 import됨 (로컬 정의 제거됨)
- `V3Page.tsx`: `resize`/`stopResizing` → `useCallback` 적용 완료. 신규 핸들러도 `useCallback` 패턴 준수 필요
- `src/services/configApi.ts`: 파일 미존재 → **신규 생성** 확정

---

## 6. 검증 시나리오

| 시나리오 | 기대 결과 |
|---------|---------|
| "1640" 검색, 1개 파일만 로드됨 | 로드된 결과 1개 + 파일에서 추가 1개 표시 |
| "1640" 검색, 2개 파일 모두 로드됨 | 로드된 결과 1개 (그룹화) + 파일 섹션 없음 (isLoaded:true) |
| 검색어 2자 ("16") | 파일 검색 미실행 (FR-06) |
| watchFolder 미설정 | 파일 섹션 숨김 (FR-04) |
| 미로드 파일 [로드] 클릭 | 파일 로드 후 그룹 "정상 (2개 장비)" 으로 변경 |
