# Design: search-global-config

## 기능 ID
`search-global-config` (v5.9.0)

## 작성일
2026-04-10

## Plan 참조
[search-global-config.plan.md](../../01-plan/features/search-global-config.plan.md)

---

## 개요 (Overview)

watchFolder 내 전체 `.txt` 파일을 대상으로 텍스트 검색하는 백엔드 API를 추가하고,
`ServiceListV3`에 "파일에서도 발견됨" 섹션을 붙여 미로드 파일을 즉시 발견·로드할 수 있게 한다.

### 수정/신규 파일 목록

| 파일 | 유형 | 주요 변경 |
|------|------|-----------|
| `server/src/routes/config.ts` | 수정 | `GET /api/config/search-files` 엔드포인트 추가 |
| `server/src/services/configStore.ts` | 수정 | `getLoadedFilenames()` 메서드 추가 |
| `src/services/configApi.ts` | **신규 생성** | `searchConfigFiles()` 클라이언트 함수 |
| `src/components/v3/ServiceListV3.tsx` | 수정 | 파일 검색 상태·UI 섹션 추가 |
| `src/pages/V3Page.tsx` | 수정 | `onLoadFile` prop 및 핸들러 추가 |

---

## 1. Backend — `configStore.ts` 수정

### 1.1 추가 메서드: `getLoadedFilenames()`

`configStore`는 filename을 키로 하는 `Map<string, StoredConfig>`를 관리한다.
현재 로드된 파일명 목록을 조회하는 메서드를 추가한다.

```typescript
// server/src/services/configStore.ts
// 기존 getAll() 아래에 추가

/** 현재 로드된 파일명 Set 반환 (isLoaded 판정용) */
getLoadedFilenames(): Set<string> {
  return new Set(this.store.keys());
}
```

**수정 위치**: `getStats()` 메서드(line 88) 바로 앞에 삽입.

---

## 2. Backend — `config.ts` 엔드포인트 추가

### 2.1 엔드포인트 스펙

```
GET /api/config/search-files?q={query}
```

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `q` | string | 검색어 (3자 미만 시 400 반환) |

**Response 타입**:
```typescript
interface FileSearchResult {
  filename: string;    // "SK-Net_Gyowon_7750SR-a8_MPLS_2.txt"
  matches: number;     // 매칭된 라인 수
  snippets: string[];  // 매칭 라인 미리보기 (최대 3개, trim 처리)
  isLoaded: boolean;   // configStore에 있는지 여부
}

// 성공 응답
{ success: true; results: FileSearchResult[]; watchPath: string; totalFiles: number }

// 실패 응답
{ success: false; error: string }
```

### 2.2 구현 코드

```typescript
// server/src/routes/config.ts — 기존 라우터 마지막 export 전에 추가

import { configStore } from '../services/configStore';

/**
 * GET /api/config/search-files
 * watchFolder 내 전체 파일 텍스트 검색
 */
router.get('/search-files', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();

    if (q.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Query must be at least 3 characters'
      });
    }

    const watchPath = fileWatcher.getWatchPath();
    if (!watchPath || !fileWatcher.isWatching()) {
      return res.json({ success: true, results: [], watchPath: '', totalFiles: 0 });
    }

    const allFiles = await fileWatcher.getAllFiles();
    const loadedSet = configStore.getLoadedFilenames();
    const queryLower = q.toLowerCase();

    const results: FileSearchResult[] = [];
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    for (const filename of allFiles) {
      const filePath = fileWatcher.getFilePath(filename);
      if (!filePath) continue;

      // 파일 크기 제한
      try {
        const stat = await fs.stat(filePath);
        if (stat.size > MAX_FILE_SIZE) continue;
      } catch { continue; }

      // 라인별 검색
      let matchCount = 0;
      const snippets: string[] = [];

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        for (const line of content.split('\n')) {
          if (line.toLowerCase().includes(queryLower)) {
            matchCount++;
            if (snippets.length < 3) {
              snippets.push(line.trim().slice(0, 120)); // 120자 제한
            }
          }
        }
      } catch { continue; }

      if (matchCount > 0) {
        results.push({
          filename,
          matches: matchCount,
          snippets,
          isLoaded: loadedSet.has(filename),
        });
      }
    }

    // 미로드 파일 먼저, 그 다음 로드된 파일 (사용자 관심 순)
    results.sort((a, b) => {
      if (a.isLoaded !== b.isLoaded) return a.isLoaded ? 1 : -1;
      return b.matches - a.matches;
    });

    res.json({
      success: true,
      results,
      watchPath,
      totalFiles: allFiles.length,
    });
  } catch (error: any) {
    console.error('[API] Error searching config files:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
```

**import 추가**: `configStore` 싱글톤 import 필요.

```typescript
// config.ts 상단에 추가
import { configStore } from '../services/configStore';
```

---

## 3. Frontend — `src/services/configApi.ts` 신규 생성

chatApi.ts 패턴을 따라 작성한다.

```typescript
// src/services/configApi.ts

export interface FileSearchResult {
  filename: string;
  matches: number;
  snippets: string[];
  isLoaded: boolean;
}

interface FileSearchResponse {
  success: boolean;
  results: FileSearchResult[];
  watchPath: string;
  totalFiles: number;
  error?: string;
}

/**
 * watchFolder 내 전체 파일 텍스트 검색
 * @param query 검색어 (3자 이상)
 * @param signal AbortSignal (debounce 취소용)
 */
export async function searchConfigFiles(
  query: string,
  signal?: AbortSignal,
): Promise<FileSearchResult[]> {
  const params = new URLSearchParams({ q: query });
  const res = await fetch(`/api/config/search-files?${params}`, { signal });

  if (!res.ok) {
    // 400 (query too short) → 빈 배열 반환 (에러 표시 불필요)
    if (res.status === 400) return [];
    throw new Error(`파일 검색 실패 (${res.status})`);
  }

  const data: FileSearchResponse = await res.json();
  return data.success ? data.results : [];
}
```

---

## 4. Frontend — `ServiceListV3.tsx` 수정

### 4.1 import 추가

```typescript
// 기존 chatApi import 아래에 추가
import { searchConfigFiles, type FileSearchResult } from '../../services/configApi';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import Download from 'lucide-react/dist/esm/icons/download';
```

### 4.2 Props 변경

```typescript
interface ServiceListProps {
  services: NokiaServiceV3[];
  configs: ParsedConfigV3[];
  selectedServiceIds: string[];
  onToggleService: (serviceKey: string) => void;
  onSetSelected: (updater: string[] | ((prev: string[]) => string[])) => void;
  onLoadFile?: (filename: string) => void;  // ← 추가 (미로드 파일 로드 콜백)
}
```

### 4.3 상태 추가

```typescript
// 기존 state 선언부 (aiEnabled, aiQuery 등 근처) 아래에 추가
const [fileSearchResults, setFileSearchResults] = useState<FileSearchResult[]>([]);
const [fileSearchLoading, setFileSearchLoading] = useState(false);
const fileSearchAbortRef = useRef<AbortController | null>(null);
```

### 4.4 파일 검색 useEffect (debounce 500ms)

```typescript
// 기존 "키보드 단축키 useEffect" 아래에 추가
useEffect(() => {
  // 3자 미만 또는 AI 모드 시 파일 검색 미실행
  if (!searchQuery || searchQuery.length < 3 || aiEnabled) {
    setFileSearchResults([]);
    return;
  }

  // 이전 요청 취소
  fileSearchAbortRef.current?.abort();
  const controller = new AbortController();
  fileSearchAbortRef.current = controller;

  const timer = setTimeout(async () => {
    setFileSearchLoading(true);
    try {
      const results = await searchConfigFiles(searchQuery, controller.signal);
      // 이미 로드된 파일 제외 (로드된 서비스 섹션과 중복 방지)
      setFileSearchResults(results.filter(r => !r.isLoaded));
    } catch (err: unknown) {
      // AbortError는 정상 취소이므로 무시
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.warn('[ServiceListV3] File search failed:', err);
    } finally {
      setFileSearchLoading(false);
    }
  }, 500);

  return () => {
    clearTimeout(timer);
    controller.abort();
  };
}, [searchQuery, aiEnabled]);
```

### 4.5 로드 핸들러

```typescript
const handleLoadFile = useCallback((filename: string) => {
  onLoadFile?.(filename);
  // 로드 후 해당 파일을 결과에서 제거
  setFileSearchResults(prev => prev.filter(r => r.filename !== filename));
}, [onLoadFile]);
```

### 4.6 UI 섹션 추가

서비스 목록 `</div>` 닫는 태그 바로 위(서비스 그룹 렌더링 최하단)에 추가한다.

```tsx
{/* 파일에서도 발견됨 섹션 */}
{!aiEnabled && searchQuery.length >= 3 && (fileSearchResults.length > 0 || fileSearchLoading) && (
  <div className="mt-2 border-t border-gray-200 dark:border-gray-700">
    <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700 flex items-center gap-2">
      <FileText size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
      <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
        파일에서도 발견됨
      </span>
      {fileSearchLoading && (
        <span className="text-[10px] text-amber-500 dark:text-amber-400 ml-auto">검색 중...</span>
      )}
    </div>

    {fileSearchResults.map(result => (
      <div
        key={result.filename}
        className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-start gap-3"
      >
        <FileText size={14} className="text-gray-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
              {result.filename}
            </span>
            <span className="text-[10px] text-gray-400 shrink-0">
              {result.matches}줄 매칭
            </span>
          </div>
          {result.snippets.map((snippet, i) => (
            <div
              key={i}
              className="mt-1 text-[11px] font-mono text-gray-500 dark:text-gray-400 truncate"
              title={snippet}
            >
              {snippet}
            </div>
          ))}
        </div>
        {onLoadFile && (
          <button
            className="shrink-0 flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            onClick={() => handleLoadFile(result.filename)}
            title={`${result.filename} 로드`}
          >
            <Download size={11} />
            로드
          </button>
        )}
      </div>
    ))}
  </div>
)}
```

---

## 5. Frontend — `V3Page.tsx` 수정

### 5.1 `onLoadFile` 핸들러 추가

기존 `handleFileToggle` 패턴을 참고하되, 단일 파일을 **현재 configs에 추가**한다.

```typescript
// handleToggleService 근처에 추가
const handleLoadFile = useCallback(async (filename: string) => {
  try {
    const res = await fetch(`/api/config/file/${encodeURIComponent(filename)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const networkType = res.headers.get('X-Network-Type') || undefined;
    const text = await res.text();
    handleConfigLoaded([text], [{ filename, networkType }]);
  } catch (error) {
    console.error('[V3Page] Failed to load file:', error);
    alert(`파일 로드 실패: ${filename}`);
  }
}, [handleConfigLoaded]);  // handleConfigLoaded 의존
```

**주의**: `handleConfigLoaded`가 현재 `useCallback`으로 감싸져 있는지 확인 필요. 아닐 경우 의존성 배열을 `[]`로 두고 `handleConfigLoaded`를 useRef로 참조하는 방식 사용.

### 5.2 `ServiceListV3` props 전달

```tsx
// V3Page.tsx 내 <ServiceListV3> 렌더링에 prop 추가
<ServiceListV3
  services={allServices}
  configs={configs}
  selectedServiceIds={selectedServiceIds}
  onToggleService={handleToggleService}
  onSetSelected={handleSetSelected}
  onLoadFile={handleLoadFile}   {/* ← 추가 */}
/>
```

---

## 6. 아키텍처 흐름

```
사용자 입력 "1640" (searchQuery.length >= 3)
    ↓ debounce 500ms
ServiceListV3 useEffect
    ↓
GET /api/config/search-files?q=1640
    ↓
config.ts 라우터
    ├─ fileWatcher.getAllFiles() → ["SK-Net_Gyowon_7750SR-a8_MPLS_2.txt", ...]
    ├─ configStore.getLoadedFilenames() → Set{"SKNet_PangyoITC2F_7750SR_MPLS_2.txt"}
    └─ 각 파일 라인별 검색 → FileSearchResult[]
    ↓
Response: [{ filename: "SK-Net_Gyowon_7750SR-a8_MPLS_2.txt", isLoaded: false, matches: 2, snippets: [...] }]
    ↓
ServiceListV3: fileSearchResults.filter(r => !r.isLoaded)
    ↓
UI: "파일에서도 발견됨" 섹션 표시
    ↓
[로드] 클릭
    ↓
V3Page.handleLoadFile("SK-Net_Gyowon_7750SR-a8_MPLS_2.txt")
    ↓
GET /api/config/file/SK-Net_Gyowon_7750SR-a8_MPLS_2.txt
    ↓
handleConfigLoaded([text], [metadata])
    ↓
configs에 추가 → Epipe 1640 그룹 length:2 → "정상 (2개 장비)" 표시
```

---

## 7. 타입 정의

신규 타입은 `src/services/configApi.ts`에 정의하며 별도 `src/types/` 파일 분리 불필요.
서버 측은 라우터 파일 내 로컬 interface로 정의 (NCV 기존 패턴과 동일).

---

## 8. 구현 순서

| 순서 | 파일 | 이유 |
|------|------|------|
| 1 | `server/src/services/configStore.ts` | Backend API의 선행 조건 |
| 2 | `server/src/routes/config.ts` | Backend API 구현 |
| 3 | `src/services/configApi.ts` | Frontend API 클라이언트 |
| 4 | `src/components/v3/ServiceListV3.tsx` | UI 및 상태 추가 |
| 5 | `src/pages/V3Page.tsx` | prop 및 핸들러 연결 |

---

## 9. 테스트 시나리오

| TC | 시나리오 | 기대 결과 |
|----|---------|---------|
| TC-01 | "1640" 검색, 1개 파일만 로드됨 | "파일에서도 발견됨" 섹션에 `SK-Net_Gyowon_7750SR-a8_MPLS_2.txt` 표시 |
| TC-02 | [로드] 클릭 후 | configs에 추가, Epipe 1640 그룹 "정상 (2개 장비)" 전환, 섹션에서 해당 파일 제거 |
| TC-03 | "1640" 검색, 2개 파일 모두 로드됨 | `isLoaded:true` → 섹션 미표시 |
| TC-04 | 검색어 "16" (2자) | API 미호출, 섹션 미표시 |
| TC-05 | watchFolder 미설정 | API 응답 `results:[]` → 섹션 미표시 |
| TC-06 | 검색어 빠르게 변경 (debounce 확인) | 마지막 입력에 대해서만 API 호출 |
| TC-07 | 검색어 초기화 (X 버튼) | 섹션 즉시 숨김 |
| TC-08 | TypeScript 빌드 | 에러 없음 |

---

## 10. 체크리스트

### 구현 전
- [x] Plan 문서 작성 완료 (v5.8.0 최적화 사항 반영)
- [x] 현재 코드 상태 확인 (stringUtils, useCallback 패턴 등)
- [x] configStore.getLoadedFilenames() 추가 위치 확인

### 구현 중
- [ ] `configStore.ts` — `getLoadedFilenames()` 추가
- [ ] `config.ts` — `/search-files` 엔드포인트 추가
- [ ] `configApi.ts` — 신규 생성
- [ ] `ServiceListV3.tsx` — 상태·useEffect·UI 추가
- [ ] `V3Page.tsx` — `handleLoadFile` 추가, prop 전달

### 구현 후
- [ ] "1640" 검색 시 미로드 파일 표시 확인
- [ ] [로드] 버튼으로 파일 추가 후 그룹 "정상" 전환 확인
- [ ] debounce 동작 확인 (빠른 입력 시 마지막만 호출)
- [ ] TypeScript 빌드 에러 없음

---

**Design 작성자**: Claude Sonnet 4.6
**작성일**: 2026-04-10
