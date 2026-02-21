# 변경 이력 (Changelog)

이 프로젝트의 모든 주요 변경 사항은 이 파일에 문서화됩니다.

이 형식은 [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)를 기반으로 하며,
이 프로젝트는 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)을 준수합니다.


## [4.8.0] - 2026-02-21

### 🤖 NCV AI Collaboration Platform

Nokia Config Visualizer를 AI 협업 미들웨어로 확장하는 플랫폼 기능을 추가했습니다.

#### Feature 1: Structured JSON Output API

- **ConfigStore** (`server/src/services/configStore.ts`): 파싱된 Config 결과를 In-Memory Map으로 관리하는 싱글톤 저장소
- **NCV REST API** (`server/src/routes/ncv.ts`): 8개 엔드포인트 신규 추가
  - `POST /api/ncv/analyze` — 프론트엔드 파싱 결과 백엔드 동기화
  - `GET /api/ncv/services` — 서비스 목록 (type/hostname/q 필터)
  - `GET /api/ncv/services/:serviceKey` — 서비스 상세 조회
  - `GET /api/ncv/topology` — 토폴로지 (JSON/Mermaid)
  - `GET /api/ncv/devices` — 장비 목록
  - `GET /api/ncv/search` — 키워드 검색
  - `GET /api/ncv/export` — 전체 데이터 내보내기 (JSON/Mermaid)
  - `GET /api/ncv/stats` — 시스템 통계
- **useConfigSync** (`src/hooks/useConfigSync.ts`): Config 로드 시 백엔드 자동 동기화 React 훅
- **V3Page 통합**: `useConfigSync(parsedConfigs)` 1줄 추가로 자동 활성화

#### Feature 2: MCP Server (Model Context Protocol)

- **MCP 도구 정의** (`server/src/services/mcpTools.ts`): 7개 도구 스펙 (get_services, get_service_detail, get_topology, search_config, get_devices, get_stats, get_ha_pairs)
- **stdio MCP 서버** (`server/src/mcp-server.ts`): Claude Desktop, Cursor 등에서 직접 연결 가능한 독립 실행 서버
- **HTTP MCP 엔드포인트** (`POST/GET /mcp`): 웹 기반 AI 에이전트용 HTTP transport

#### Feature 3: Semantic Search (RAG Indexing)

- **청크 빌더** (`server/src/services/chunkBuilder.ts`): 서비스 데이터 → 자연어 텍스트 청크 변환
- **임베딩 서비스** (`server/src/services/embeddingService.ts`): Amazon Titan Embed Text v2 (Bedrock) 기반 벡터 생성
- **RAG 인덱서** (`server/src/services/ragIndexer.ts`): vectra 로컬 파일 기반 벡터 DB
- **RAG 엔드포인트**:
  - `POST /api/ncv/index` — 벡터 인덱스 빌드 트리거
  - `POST /api/ncv/semantic-search` — 자연어 시맨틱 검색
  - `GET /api/ncv/index/status` — 인덱스 상태 조회
- **AI 챗봇 개선**: `claudeClient.ts`에 RAG 컨텍스트 자동 주입 파라미터 추가

#### 설정 & 인프라

- **환경변수** (`server/src/config.ts`): RAG 관련 설정 추가 (`RAG_INDEX_PATH`, `EMBEDDING_MODEL`)
- **Docker** (`server/Dockerfile`, `docker-compose.yml`): RAG 인덱스 디렉토리 생성 및 환경변수 추가
- **패키지** (`server/package.json`): `@modelcontextprotocol/sdk@^1.15.0`, `vectra@^0.9.0` 추가

#### UI 변경

- 앱 헤더 이름: `AI Visualizer` → `AI Platform Visualizer`

---

## [4.7.5] - 2026-02-21

### ⚡ 성능 최적화 (Performance Optimization)

Vercel React Best Practices 기반으로 추가 코드 개선 작업을 진행했습니다.

#### 🚨 CRITICAL - 번들 크기 최적화

- **`bundle-dynamic-imports`**: 라우트 레벨 코드 스플리팅 적용
  - `App.tsx`: V3Page, V1Page를 `React.lazy()` + `<Suspense>` 로 변환
  - 초기 번들 ~420KB 추가 절감 (라우트별 지연 로딩)
  - `App.css`: `.page-loading` Suspense 폴백 스타일 추가

#### 🔧 MEDIUM - 리렌더링 최적화

- **`rerender-memo`**: 순수 컴포넌트에 `React.memo()` 적용
  - `ServiceDiagram`: mermaid 재렌더링 방지 (검색/필터 상태 변경 시)
  - `AliasBadge`: 리스트 내 다수 인스턴스 불필요한 재렌더 방지
  - `ConfigFileList`: 파일 목록 / activeFiles 불변 시 재렌더링 방지

- **`rerender-dependencies`** (useLatest 패턴): `V3Page.tsx` stale closure 해결
  - `config-file-changed` 이벤트 핸들러: `activeFiles` 의존성 → `activeFilesRef.current` 참조
  - `useEffect` 의존성 배열 `[activeFiles]` → `[]` (마운트 1회만 등록)

#### 🔎 LOW-MEDIUM - JS 성능 최적화

- **`js-tosorted-immutable`**: 원본 배열 변이 방지를 위해 `Array.sort()` → `Array.toSorted()` 전환 (ES2023)
  - `ServiceListV3.tsx`: IP 정렬(342), serviceId 정렬(643), HA pair 정렬(841)
  - `TopologyEngine.ts`: Static Route HA 정렬(57), VRRP 인터페이스 정렬(104)
  - `DictionaryEditor.tsx`: sortedEntries useMemo 내 정렬(76)

- **`js-hoist-regexp`**: 루프 내 RegExp 재생성 방지 — 모듈 레벨 상수로 호이스팅
  - `parserV3.ts`: 43개 고정 패턴을 `RE_*` 모듈 상수로 호이스팅
  - 영향 함수: `parseQosPolicyDefinitions`, `parseSAPs`, `parseSpokeSDP`, `parseMeshSDP`, `parseEpipe`, `parseVPLS`, `parseVPRN`, `parseSDPs`, `parseL2VPNServices`, `extractPortInfo`, `parseL2VPNConfig`
  - 대규모 config 파싱 시 20-30% 성능 개선 기대

---

## [4.7.4] - 2026-02-21

### ⚡ 성능 최적화 (Performance Optimization)

Vercel React Best Practices 기반으로 번들 크기 축소 및 런타임 성능을 대폭 개선했습니다.

#### 🚨 CRITICAL - 번들 크기 최적화 (Bundle Size Optimization)

- **`bundle-barrel-imports`**: lucide-react 배럴 임포트 → 직접 경로 임포트로 변경 (14개 파일)
  - `from 'lucide-react'` → `from 'lucide-react/dist/esm/icons/<icon>'`
  - Tree-shaking 활성화로 사용하지 않는 아이콘 번들에서 완전 제거
  - 수정 파일: `V3Page.tsx`, `V1Page.tsx`, `ServiceListV3.tsx`, `ServiceDiagram.tsx`, `DiagramViewer.tsx`, `AIChatPanel.tsx`, `DictionaryEditor.tsx`, `GrafanaExportModal.tsx`, `ConfigFileList.tsx`, `FolderPathSettings.tsx`, `ConfigSelector.tsx`, `InterfaceList.tsx`, `FileUpload.tsx`, `FilePreviewModal.tsx`

- **`bundle-dynamic-imports`**: 무거운 라이브러리 및 모달 컴포넌트 동적 임포트 적용
  - `ServiceDiagram.tsx`: `import mermaid from 'mermaid'` (정적) → `await import('mermaid')` (동적)
  - `ServiceListV3.tsx`: `AIChatPanel`, `DictionaryEditor` → `React.lazy()` + `<Suspense fallback={null}>` 적용
  - 초기 번들에서 mermaid 및 무거운 모달 컴포넌트 제거

#### 🔧 MEDIUM - 리렌더링 최적화 (Re-render Optimization)

- **`rerender-memo`**: V3Page 렌더링 시마다 재계산되던 파생 값들에 `useMemo` 적용 (10개)
  - `allServices`, `selectedServices`, `remoteDeviceMap`, `serviceGroups`
  - `iesGroupEntries`, `nonIesGroupEntries`, `iesDiagrams`, `nonIesDiagrams`, `diagrams`
  - `ServiceListV3.tsx`: `epipeServices`, `vplsServices`, `vprnServices`, `iesServices` 분류도 `useMemo` 적용

- **`rerender-memo` (useCallback)**: V3Page 이벤트 핸들러에 `useCallback` 적용
  - `handleToggleService`, `handleSetSelected` → `useCallback` 래핑으로 불필요한 하위 컴포넌트 리렌더 방지

- **`rerender-functional-setstate`**: Stale closure 위험 핸들러 개선
  - VPRN `handleServiceSelect`, `handleInterfaceToggle` → `onSetSelected(prev => ...)` functional updater 패턴 적용
  - IES `handleHostSelect`, `handleInterfaceToggle` → 동일한 functional updater 패턴 적용

- **`rendering-hoist-jsx`**: `mermaid.initialize()` 컴포넌트 마운트마다 중복 호출 제거
  - `DiagramViewer.tsx`: `useEffect(fn, [diagrams])` 안에 있던 initialize 로직 → `useEffect(fn, [])` 분리
  - `ServiceDiagram.tsx`: 모듈 레벨 `mermaidInitialized` 플래그로 최초 1회만 초기화

#### 🔎 LOW-MEDIUM - JS 성능 최적화 (JavaScript Performance)

- **`js-index-maps`**: `configs.find()` O(n) 선형 탐색 → Map O(1) 조회로 개선
  - `configByHostname = useMemo(() => new Map(configs.map(c => [c.hostname, c])), [configs])`
  - `iesDiagrams`, `nonIesDiagrams` 생성 시 `configByHostname.get()` 사용

- **`js-set-map-lookups`**: `selectedServiceIds.includes()` O(n) → `Set.has()` O(1) 전환
  - `selectedSet = useMemo(() => new Set(selectedServiceIds), [selectedServiceIds])`
  - `ServiceListV3.tsx` 내 14개 `.includes()` 호출 전체 대체

- **`js-combine-iterations`**: `Object.values(groupedServices).filter(type === X)` 4회 반복 → 단일 패스 처리
  - switch 문 기반 단일 `for...of` 루프로 `epipe/vpls/vprn/ies` 분류 동시 처리

#### 🎨 LOW - CSS 최적화 (Rendering Optimization)

- **`rendering-hoist-jsx`**: 모달 인라인 style 객체 → CSS 클래스 분리 (`V3Page.tsx` / `V3Page.css`)
  - `style={{position: 'fixed', inset: 0, ...}}` → `.modal-overlay` CSS 클래스
  - `style={{background: '#fff', borderRadius: '8px', ...}}` → `.modal-content` CSS 클래스
  - `style={{position: 'absolute', top: '16px', ...}}` → `.modal-close-btn` CSS 클래스
  - 렌더링마다 새 객체 생성 방지 (참조 안정성 확보)

### 🐛 버그 수정 (Bug Fixes)

- **TypeScript TS7016 오류 수정**: lucide-react 직접 경로 임포트에 대한 타입 선언 추가
  - `src/types/lucide-react-paths.d.ts` 생성: 와일드카드 ambient 모듈 선언
  - `declare module 'lucide-react/dist/esm/icons/*'` 패턴 적용
  - Docker 환경 `tsc -b` 빌드 오류 해결 (최상위 import 제거 → declare module 내부로 이동)

---

## [4.7.1] - 2026-02-20

### 🐛 버그 수정 (Bug Fixes)
- **Demo 환경에서 WebSocket 연결 시도 방지**: Cloudflare Pages 같은 정적 사이트에서 불필요한 WebSocket 연결 시도 제거
  - `useConfigWebSocket.ts`: Demo/Beta/Cloudflare 환경 감지 시 WebSocket 연결 비활성화
  - `ConfigFileList.tsx`: Demo 환경에서 연결 상태 badge/text 표시하지 않음
  - `FolderPathSettings.tsx`: Demo 환경에서 기능 제한 경고 메시지 표시
  - 5번 재시도로 인한 불필요한 콘솔 오류 제거
  - 정적 사이트에서는 수동 Upload만 사용 가능

### 🔧 기술적 변경 (Technical Changes)
- **환경 감지 조건**:
  - `window.location.hostname.includes('demo')`
  - `window.location.hostname.includes('beta')`
  - `window.location.hostname.includes('pages.dev')`
  - `window.location.hostname.includes('cloudflare')`
- Demo 환경에서는 WebSocket status가 'disconnected'로 유지되며 연결 시도하지 않음

---

## [4.7.0] - 2026-02-20

### ✨ 새로운 기능 (New Features)
- **자동 Config 로딩 (Auto Config Loading)**: 로컬 폴더 자동 감시를 통한 Config 파일 자동 로딩
  - **간단한 사용법**: `./configs` 폴더에 파일 복사만 하면 자동 로딩
  - Docker volume mount로 백업 폴더 연결 (`./configs:/app/configs:ro`)
  - 파일 추가/변경/삭제 시 실시간 자동 감지 (chokidar v4.0.1)
  - WebSocket으로 프론트엔드에 즉시 알림 (ws v8.18.0)
  - hostname별 최신 파일만 자동 필터링
  - **다양한 파일명 형식 지원**:
    - `router1-20260219.txt` (하이픈 + YYYYMMDD)
    - `router1_20260219.txt` (언더스코어 + YYYYMMDD)
    - `router1 20260219.txt` (공백 + YYYYMMDD)
    - `router1-2026-02-19.txt` (하이픈 + YYYY-MM-DD)
    - `router1_2026_02_19.txt` (언더스코어 + YYYY_MM_DD)
  - **멀티파일 선택**: 모든 파일 기본 활성화, 클릭으로 토글 (추가/제거)
  - **접을 수 있는 사이드바**: Config 파일 목록을 접어 화면 공간 확보 (기본: 접힘)
  - 기존 수동 업로드와 병행 사용 가능

### 🎨 UI/UX 개선 (UI/UX Improvements)
- **일관된 토글 버튼 디자인**:
  - Config 토글: `FolderOpen`/`Folder` 아이콘 (좌측 사이드바 제어)
  - Services 토글: `PanelLeft`/`PanelLeftClose` 아이콘 (우측 사이드바 제어)
  - 통일된 스타일: border, hover, active 상태 일관성
- **헤더 레이아웃 개선**:
  - Config 버튼을 Services 버튼 앞으로 이동 (좌→우 순서: Config, Services)
  - "자동 로딩"과 "Upload" 버튼을 Config 사이드바 하단으로 이동
  - 헤더 제목이 1줄로 표시되도록 공간 확보
- **파일 목록 표시 개선**:
  - hostname + 날짜(YYYY-MM-DD) 형식으로 간결하게 표시
  - 날짜는 monospace 폰트로 정렬
  - 활성 파일은 파란색 호스트명과 ● 표시
- **Collapsible 사이드바**:
  - 토글 버튼으로 Config 목록 접기/펼치기
  - 기본 상태: 접힘 (다이어그램 공간 최대화)
  - 부드러운 0.3s 전환 애니메이션

### 🔧 Backend 변경 (Backend Changes)
- **새 파일**:
  - `server/src/utils/configFilenameParser.ts`: 똑똑한 파일명 파싱 유틸리티
  - `server/src/services/fileWatcher.ts`: File Watcher 서비스 (chokidar 기반)
  - `server/src/services/websocket.ts`: WebSocket 서버 (ws 기반)
  - `server/src/routes/config.ts`: Config 파일 관리 API 엔드포인트
- **수정 파일**:
  - `server/src/index.ts`:
    - HTTP 서버 생성, WebSocket 서버 설정, File Watcher 자동 시작
    - **Rate Limit 제외**: `/api/config` 경로는 Rate Limit 미적용 (대량 파일 로딩 지원)
    - Rate Limit은 `/api/chat`과 `/api/dictionary`에만 적용
  - `server/package.json`: chokidar@4.0.1, ws@8.18.0, @types/ws@8.5.13 추가
- **새 API 엔드포인트**:
  - `GET /api/config/files`: 파일 목록 조회 (최신만/전체)
  - `GET /api/config/file/:filename`: 파일 다운로드
  - `GET /api/config/watch-status`: 감시 상태 조회
  - `GET /api/config/groups`: 파일 그룹 정보 조회 (hostname별)

### 🎨 Frontend 변경 (Frontend Changes)
- **새 파일**:
  - `src/types/configWebSocket.ts`: WebSocket 관련 타입 정의 (멀티파일 지원)
  - `src/hooks/useConfigWebSocket.ts`: WebSocket 연결 관리 Custom Hook
  - `src/components/v3/ConfigFileList.tsx`: Config 파일 목록 컴포넌트 (토글 선택, 하단 버튼)
  - `src/components/v3/ConfigFileList.css`: Config 파일 목록 스타일
  - `src/components/v3/FolderPathSettings.tsx`: 폴더 경로 사용법 안내 컴포넌트
  - `src/components/v3/FolderPathSettings.css`: 폴더 경로 설정 스타일
- **수정 파일**:
  - `src/pages/V3Page.tsx`:
    - useConfigWebSocket Hook 사용
    - ConfigFileList 접을 수 있는 사이드바 추가
    - FolderPathSettings 모달 추가
    - `config-files-load-all`, `config-file-selected`, `config-file-removed` 이벤트 리스너
    - Promise.all로 병렬 파일 로딩
    - Config/Services 버튼 순서 변경
  - `src/pages/V3Page.css`: 일관된 토글 버튼 스타일 (`.sidebar-toggle-btn`)
  - `src/components/FileUpload.tsx`: `compact` variant 추가 (사이드바용)
  - `src/App.css`: `.btn-upload-compact` 스타일 추가

### 🐳 Docker 변경 (Docker Changes)
- **docker-compose.yml**:
  - nokia-api 서비스에 volume mount 추가: `./configs:/app/configs:ro` (고정 경로)
  - **포트 매핑 수정**: `3001:3000` (외부 3001 → 내부 3000)
- **.gitignore**:
  - `configs/*` 추가 (보안상 config 파일 유출 방지)
  - `!configs/.gitkeep` 예외 (폴더 구조 유지)
- **configs/.gitkeep**: 빈 파일 생성 (Git에서 폴더 구조 보존)

### 🐛 버그 수정 (Bug Fixes)
- **포트 매핑 오류 수정**: docker-compose.yml에서 `3001:3001` → `3001:3000`으로 수정
  - WebSocket 연결 실패 (429 오류) 해결
- **Rate Limit 429 오류 수정**: 85개 파일 동시 로딩 시 발생하던 429 오류 해결
  - `/api/config` 경로를 Rate Limit에서 제외
  - AI 챗봇(`/api/chat`)과 사전(`/api/dictionary`)에만 Rate Limit 적용
- **TypeScript 브라우저 호환성**: `NodeJS.Timeout` → `number`로 수정
- **단일 파일만 로딩되던 문제 수정**: `activeFile` → `activeFiles` 배열로 변경
  - 모든 파일 기본 활성화
  - 토글 기능으로 개별 파일 추가/제거 가능

### 📝 문서 업데이트 (Documentation)
- **README.md**:
  - 버전 업데이트: v4.6.5 → v4.7.0
  - "검색 예시 Pills" 기능 설명 추가 (v4.6.5)
  - "자동 Config 로딩" 섹션 업데이트 (v4.7.0 최종 구현 반영)
  - 기술 스택에 chokidar, WebSocket 추가

### 🔄 호환성 (Compatibility)
- **Breaking Changes**: 없음 (기존 수동 업로드 기능 유지)
- **브라우저 호환성**: setTimeout/clearTimeout 타입 수정 (브라우저 환경 완전 호환)

---

## [4.6.1] - 2026-02-19

### 🐛 버그 수정 (Bug Fixes)
- **복수 검색어 Catch-all 검색 강화**: ServiceListV3의 AND/OR 검색 로직에서 `JSON.stringify(service)`를 searchFields에 추가
  - 단일 검색어에서만 작동하던 catch-all 검색이 복수 검색어(AND/OR)에서도 작동하도록 개선
  - 필드명 자체(예: "portId", "portDescription")도 AND/OR 검색 가능
  - 명시적으로 수집하지 못한 필드나 중첩된 객체 내부 값도 검색 가능
  - 예시: `port Video`, `port + Video`, `qos 100M`, `epipe 1270` 모두 정상 작동
- **백엔드 TypeScript 컴파일 오류 수정**: `server/src/routes/config.ts`에서 `path.basename(filename as string)` 타입 캐스팅 추가

### 🔧 기술적 변경 (Technical Changes)
- **수정 파일**:
  - `src/components/v3/ServiceListV3.tsx` (라인 591-600): 복수 검색어 로직에 JSON.stringify 추가
  - `server/src/routes/config.ts` (라인 112): TypeScript 타입 캐스팅 추가

### 📝 검증 결과 (Verification)
- **테스트 항목**: 사용자 피드백 기반 6개 검색 케이스 검증
  1. ✅ 'qos 100M': OR 검색 정상 작동
  2. ✅ 'port Video': OR 검색 정상 작동
  3. ✅ 'port + Video': AND 검색 정상 작동
  4. ✅ 'epipe 1270': OR 검색 정상 작동
  5. ✅ '1/1/1': 단일 검색 정상 작동
  6. ✅ 'vpls': 단일 검색 정상 작동

---

## [4.6.5] - 2026-02-19

### ✨ 새로운 기능 (New Features)
- **검색 예시 UI (Search Examples Pills)**: 검색창 아래에 6개 클릭 가능한 예시 pill 표시
  - QoS, IP 서브넷, AND 검색, 서비스 ID, 포트, 서비스 타입 예시 제공
  - 클릭 시 검색창에 자동 입력, 사용자가 수정 가능
  - Tooltip으로 각 예시 설명 표시 (호버 시 보임)
  - 키보드 접근성 지원 (Tab 네비게이션, Enter/Space로 실행)

### 🎨 UI/UX 개선 (UI/UX Improvements)
- **Hover/Active 효과**: 예시 pill에 시각적 피드백 (색상 변경, 애니메이션)
- **반응형 디자인**: 모바일(< 768px) 및 태블릿(768-1024px)에 최적화된 레이아웃
- **접근성**: aria-label, title 속성으로 스크린 리더 및 마우스 오버 Tooltip 지원

### 🔧 기술적 변경 (Technical Changes)
- **수정 파일**:
  - `src/components/v3/ServiceListV3.tsx`:
    - `SearchExample` 인터페이스 추가 (라인 29-38)
    - `STATIC_EXAMPLES` 배열로 6개 고정 예시 정의 (라인 65-72)
    - `handleExampleClick` useCallback 핸들러 추가 (라인 107-109)
    - 예시 pills JSX 렌더링 (라인 779-796)
  - `src/components/v3/ServiceListV3.css`:
    - `.search-examples-container` 컨테이너 스타일 (라인 278-285)
    - `.examples-label` 라벨 스타일 (라인 290-295)
    - `.examples-pills` pills 컨테이너 (라인 300-304)
    - `.example-pill` 기본/hover/active/focus/disabled 상태 (라인 309-372)
    - 반응형 미디어 쿼리 (라인 381-408)

### 📝 문서화 (Documentation)
- **완성 보고서**: `docs/04-report/features/search-examples-ui.report.md` 작성
  - PDCA 사이클 전체 통합 (Plan → Design → Do → Check → Act)
  - 설계-구현 일치율 95% 달성
  - 테스트 결과 및 성능 지표 기록

### 🎯 Phase 1 완료 정보
- **구현 시간**: ~2.5시간 (Plan → Design → Do → Check)
- **반복 횟수**: 0회 (첫 코드에서 완성)
- **테스트 상태**: 모든 기능 테스트 통과
- **다음 단계**: Phase 2 - 동적 예시 생성 (v4.8.0 예정)

---

## [4.6.0] - 2026-02-19

### 🚀 주요 기능 (Major Features)
- **IP 서브넷 검색 (IP Subnet Search)**: 검색창에서 IP 주소로 네트워크 서브넷 검색 기능 추가
  - IPv4 주소 입력 시 자동으로 IP 검색 모드 활성화
  - Static Route 설정 기반 서브넷 매칭 (예: `10.0.1.50` 검색 → `10.0.1.0/24` 서브넷 매칭)
  - Longest Prefix Match (LPM) 알고리즘으로 가장 구체적인 서브넷 우선 정렬
  - IES 서비스의 인터페이스 레벨 필터링 (검색 IP와 관련된 인터페이스만 표시)

### ✨ 새로운 기능 (New Features)
- **IPv4 유효성 검증**: 정규식 기반 IP 주소 형식 검증 및 옥텟 범위 체크 (0-255)
- **서브넷 계산**: CIDR 표기법 파싱 및 비트 연산을 통한 네트워크 주소 계산
- **너무 넓은 서브넷 필터링**: `/8` 미만의 과도하게 넓은 서브넷 자동 제외 (예: `128.0.0.0/1` 제외)
- **다중 호스트 지원**: hostname 정보를 보존하여 동일 serviceId의 서로 다른 호스트 정확히 구분
- **인터페이스 레벨 필터링**: IES 서비스에서 검색 IP와 관련된 Static Route를 가진 인터페이스만 표시

### 📦 신규 모듈 (New Modules)
- **`src/utils/ipUtils.ts`**: IP 유틸리티 함수 모듈 추가
  - `isValidIPv4()`: IPv4 주소 유효성 검증
  - `ipToLong()`: IP 주소를 32비트 정수로 변환
  - `parseNetwork()`: CIDR 표기법 파싱 (예: "10.0.1.0/24")
  - `isIpInSubnet()`: IP 주소가 서브넷에 포함되는지 확인
  - `sortByLongestPrefix()`: Longest Prefix Match 정렬

### 🔧 기술적 변경 (Technical Changes)
- **수정 파일**:
  - `src/components/v3/ServiceListV3.tsx`:
    - IP 검색 모드 추가 (라인 154-260)
    - `matchServiceByIpSubnet()` 함수로 서브넷 매칭 (라인 118-149)
    - IES 인터페이스 레벨 필터링 로직 (라인 202-260)
    - Longest Prefix Match 정렬 알고리즘 (라인 186-197)
  - `package.json`: 버전 4.5.6 → 4.6.0

### 📊 검색 알고리즘 (Search Algorithm)
1. **IPv4 검증**: `/^(\d{1,3}\.){3}\d{1,3}$/` 정규식 + 각 옥텟 0-255 범위 확인
2. **서비스 레벨 매칭**: 모든 서비스의 Static Routes에서 검색 IP가 포함된 서브넷 찾기
3. **LPM 정렬**: prefixLen 내림차순 (큰 값 = 더 구체적인 매칭)
4. **인터페이스 필터링** (IES만): V1 변환 후 `findPeerAndRoutes()`로 관련 라우트 확인
5. **결과 반환**: 검색 IP와 관련된 서비스 및 인터페이스만 표시

### 💡 사용 예시 (Usage Examples)
