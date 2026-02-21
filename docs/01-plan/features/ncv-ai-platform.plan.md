# Plan: NCV AI Collaboration Platform

## 기능 ID
`ncv-ai-platform` (v4.8.0)

## 작성일
2026-02-21

---

## 문제 정의 (Problem Statement)

### 현재 상황

NCV(Nokia Config Visualizer)는 현재 **Human-First** 도구입니다.

- Config 파일을 파싱하여 **Mermaid 다이어그램**(시각화)으로 변환
- 사람이 직접 웹 UI를 통해 결과를 확인하는 구조
- AI 에이전트(NotebookLM, Claude, Gemini, MCP 클라이언트 등)가 접근할 수 있는 **표준 인터페이스 없음**

### 핵심 한계

1. **데이터 고립 (Data Silos)**: 파싱된 네트워크 지식이 웹 UI 안에만 존재
2. **AI 접근 불가**: AI는 Mermaid 이미지보다 구조화된 텍스트(JSON)로 훨씬 정확한 추론 수행
3. **자동화 불가**: CI/CD 파이프라인, 모니터링 시스템이 NCV 분석 결과를 활용할 수 없음
4. **검색 한계**: 현재 키워드 검색만 가능; 자연어로 "A 고객사 ePipe 경로 알려줘" 같은 질문 불가

### 목표 상태

```
NCV = 네트워크 지식(Knowledge)을 만드는 미들웨어

Raw Config (텍스트)
    ↓ NCV Engine
┌─────────────────────────────────────────────┐
│  For Humans:  Mermaid → Grafana Dashboard   │ ← 현재 (v4.7.x)
│  For Tools:   JSON API / Zabbix LLD         │ ← Feature 1 (v4.8.0)
│  For AI:      MCP Server / RAG Knowledge    │ ← Feature 2 & 3 (v4.8.0)
└─────────────────────────────────────────────┘
```

---

## 목표 (Goals)

### 주요 목표

1. **API-First 전환**: 모든 파싱 결과를 구조화된 JSON으로 외부에 노출
2. **AI Agent 협업**: MCP 서버로 동작하여 Claude, Gemini 등 AI가 NCV 데이터를 직접 쿼리
3. **자연어 검색**: 파싱된 Config를 벡터 DB에 인덱싱, RAG 기반 시맨틱 검색 지원

### 성공 지표

- AI 에이전트가 MCP 도구를 통해 네트워크 서비스 정보를 실시간 조회 가능
- "A 고객사의 모든 VPRN 서비스를 나열해줘" → NCV가 JSON 응답 반환
- REST API로 GET 요청 한 번으로 서비스 토폴로지 JSON 반환

---

## 전체 아키텍처 (System Architecture)

```
┌─────────────────── NCV: The Brain of Network Observability ────────────────────┐
│                                                                                  │
│  Input Layer                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                          │
│  │  Manual      │  │  Auto Watch  │  │  SSH / Git   │                          │
│  │  Upload      │  │  (Folder)    │  │  (Future)    │                          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                          │
│         └─────────────────┴─────────────────┘                                   │
│                           │ Config Files                                         │
│  Processing Layer (NCV Engine)                                                   │
│  ┌────────────────────────▼────────────────────────────────────────────────┐    │
│  │  Parser (parserV3.ts) → Service Model → Topology Engine                 │    │
│  │  Nokia SR-OS Config → Epipe / VPLS / VPRN / IES                        │    │
│  └────────────────────────┬────────────────────────────────────────────────┘    │
│                           │ ParsedConfigV3[]                                     │
│  Output Layer             │                                                      │
│  ┌────────────────────────┼────────────────────────────────────────────────┐    │
│  │                        │                                                  │    │
│  │  For Humans            │  For Tools            For AI                    │    │
│  │  ┌─────────────┐       │  ┌─────────────┐     ┌──────────────────────┐  │    │
│  │  │  Mermaid    │       │  │  REST JSON  │     │  MCP Server           │  │    │
│  │  │  → Grafana  │       │  │  API        │     │  (Feature 2)          │  │    │
│  │  └─────────────┘       │  │  (Feature 1)│     ├──────────────────────┤  │    │
│  │                        │  └─────────────┘     │  RAG / Semantic       │  │    │
│  │  (현재 구현)            │                      │  Index (Feature 3)    │  │    │
│  │                        │  Zabbix LLD          └──────────────────────┘  │    │
│  │                        │  InfluxDB Query                                 │    │
│  └────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 기능 상세 (Feature Details)

### Feature 1: Structured JSON Output (REST API)

#### 개요
현재 Express 백엔드에 네트워크 서비스 분석 결과를 JSON으로 반환하는 REST API 엔드포인트 추가.

#### 제안 API 스펙

```
GET  /api/ncv/services              → 로드된 모든 서비스 목록
GET  /api/ncv/services/:serviceId   → 특정 서비스 상세
GET  /api/ncv/topology              → 서비스 토폴로지 관계도
GET  /api/ncv/topology/:serviceId   → 특정 서비스 토폴로지
GET  /api/ncv/devices               → 장비 목록 (hostname, model)
GET  /api/ncv/devices/:hostname     → 특정 장비 상세
GET  /api/ncv/search?q={query}      → 키워드 검색
GET  /api/ncv/export?format=json    → 전체 데이터 내보내기
GET  /api/ncv/export?format=mermaid → Mermaid 코드 내보내기
POST /api/ncv/analyze               → Config 텍스트 업로드 + 즉시 파싱
```

#### 응답 예시

```json
// GET /api/ncv/services
{
  "version": "4.8.0",
  "timestamp": "2026-02-21T10:00:00Z",
  "deviceCount": 2,
  "services": [
    {
      "id": 100,
      "type": "epipe",
      "name": "Customer-A-L2VPN",
      "customerId": 1001,
      "endpoints": [
        { "device": "router-a", "sap": "1/1/1:100", "qos": {"ingress": 10, "egress": 10} },
        { "device": "router-b", "sap": "1/1/2:100", "qos": {"ingress": 10, "egress": 10} }
      ],
      "sdp": { "id": "1:100", "farEnd": "10.0.0.2", "lsp": "to-router-b" }
    }
  ]
}
```

#### 상태 관리
현재 Config 파싱 결과는 React state(프론트엔드)에만 존재. 백엔드에 **In-Memory Store** 또는 **JSON 파일 캐시**로 파싱 결과 저장 필요.

```typescript
// server/src/services/configStore.ts
interface ConfigStore {
  configs: Map<string, ParsedConfigV3>;  // filename → parsed data
  lastUpdated: Date;
}
```

---

### Feature 2: MCP Server (Model Context Protocol)

#### 개요
NCV를 MCP 서버로 동작하게 하여, AI 에이전트(Claude Desktop, Cursor, Zed 등)가 네트워크 Config 분석 결과를 직접 도구(tool)로 호출할 수 있도록 구현.

#### MCP 도구 정의

```
Tools (NCV가 AI에게 제공하는 도구):
┌────────────────────────────────────────────────────────────────────────┐
│ get_services(filter?)          → 서비스 목록 조회                       │
│ get_service_detail(serviceId)  → 특정 서비스 상세 조회                  │
│ get_topology(serviceId?)       → 토폴로지 다이어그램 (Mermaid 코드)      │
│ search_config(query)           → 자연어/키워드 검색                     │
│ get_devices()                  → 장비 목록 조회                         │
│ analyze_config(configText)     → Config 텍스트 직접 파싱                │
│ get_ha_pairs()                 → HA Pair 목록 조회                     │
└────────────────────────────────────────────────────────────────────────┘
```

#### 예시 시나리오

```
AI: "현재 로드된 Config에서 customer 1001의 모든 서비스를 나열해줘"
    → MCP call: get_services({ customerId: 1001 })
    → NCV 응답: [{ id: 100, type: "epipe", name: "..." }, ...]

AI: "router-a의 1/1/1 포트에 연결된 서비스 경로를 보여줘"
    → MCP call: search_config({ query: "1/1/1" })
    → NCV 응답: Mermaid 코드 + 서비스 JSON
```

#### 기술 구현

```typescript
// MCP 서버 구현 방식 (두 가지 옵션)
Option A: stdio transport  → Claude Desktop, Cursor 직접 연동
          명령: node server/dist/mcp-server.js

Option B: HTTP transport   → 웹 기반 MCP 클라이언트 연동
          엔드포인트: POST /mcp
```

#### 의존성

```
@modelcontextprotocol/sdk  → MCP 서버 SDK (공식 패키지)
```

---

### Feature 3: Semantic Indexing (RAG Support)

#### 개요
파싱된 Config 조각(서비스, SAP, 포트 등)을 벡터 DB에 인덱싱하여, 자연어 질문으로 관련 Config 컨텍스트를 검색하는 RAG(Retrieval-Augmented Generation) 파이프라인 구성.

#### RAG 아키텍처

```
Config 파싱 결과 (ParsedConfigV3)
    ↓ Chunking (서비스 단위, 포트 단위, SAP 단위로 분할)
텍스트 청크 + 메타데이터
    ↓ Embedding (AWS Bedrock Titan Embeddings)
벡터 표현 (float[1536])
    ↓ Upsert
Local Vector Store (vectra.js) 또는 외부 (Pinecone, Weaviate)
    ↑
자연어 쿼리 → 임베딩 → 유사도 검색(Top-K) → LLM 컨텍스트 주입
```

#### 청크 전략 (Chunking Strategy)

```
서비스 청크:
  "service epipe 100: Customer-A L2VPN
   customer: 1001
   sap: 1/1/1:100 on router-a, qos ingress 10 egress 10
   sdp: 1:100 far-end 10.0.0.2 lsp to-router-b"

포트 청크:
  "port 1/1/1 on router-a
   mode: access, encap: dot1q
   description: Customer-A Uplink
   mtu: 9000"
```

#### API 추가

```
POST /api/ncv/index          → Config 인덱싱 트리거
POST /api/ncv/semantic-search → 시맨틱 검색
  body: { query: "customer A의 L2 서비스", topK: 5 }

GET  /api/ncv/index/status   → 인덱싱 상태 확인
```

#### 스코프 제한 (Phase 1)

RAG 기능은 복잡도가 높으므로 초기 버전에서는 다음으로 제한:
- **벡터 DB**: `vectra` (로컬 파일 기반, 서버 불필요)
- **임베딩**: AWS Bedrock Titan Embeddings (기존 Bedrock 인프라 활용)
- **검색**: cosine similarity, Top-5 반환
- **LLM 연동**: 검색 결과를 Claude API에 컨텍스트로 주입 (기존 AI 챗봇 개선)

---

## 구현 범위 (Scope)

### Phase 1: JSON REST API (v4.8.0 — Feature 1)
- [ ] `server/src/services/configStore.ts` — In-Memory Config Store
- [ ] `server/src/routes/ncv.ts` — NCV API 라우터
- [ ] POST `/api/ncv/analyze` — Config 업로드 + 파싱 + 저장
- [ ] GET `/api/ncv/services` — 서비스 목록 반환
- [ ] GET `/api/ncv/services/:id` — 서비스 상세 반환
- [ ] GET `/api/ncv/topology` — 토폴로지 JSON 반환
- [ ] GET `/api/ncv/devices` — 장비 목록 반환
- [ ] GET `/api/ncv/search?q=` — 키워드 검색
- [ ] GET `/api/ncv/export` — JSON/Mermaid 내보내기
- [ ] Frontend: 기존 Config 파싱 결과를 백엔드에도 동기화하는 훅 (`useConfigSync`)

### Phase 2: MCP Server (v4.8.0 — Feature 2)
- [ ] `npm install @modelcontextprotocol/sdk`
- [ ] `server/src/mcp-server.ts` — MCP 서버 진입점
- [ ] `server/src/services/mcpTools.ts` — 도구 정의 (7개)
- [ ] stdio transport 지원 (Claude Desktop 연동)
- [ ] HTTP transport 지원 (POST /mcp)
- [ ] `README-MCP.md` — Claude Desktop 설정 가이드

### Phase 3: RAG Indexing (v4.8.0 — Feature 3)
- [ ] `npm install vectra`
- [ ] `server/src/services/ragIndexer.ts` — 벡터 인덱서
- [ ] `server/src/services/chunkBuilder.ts` — 서비스/포트 청크 생성
- [ ] `server/src/services/embeddingService.ts` — Bedrock Titan 임베딩
- [ ] POST `/api/ncv/index` — 인덱싱 트리거
- [ ] POST `/api/ncv/semantic-search` — 시맨틱 검색
- [ ] AI 챗봇 개선: RAG 검색 결과를 컨텍스트로 활용

### 제외 사항 (v4.8.0)
- SSH/Git 자동 수집 (별도 Feature)
- 외부 Vector DB (Pinecone, Weaviate) 연동 — vectra 로컬로 충분
- Multi-tenant / 인증 (현재 내부 툴 용도)
- WebSocket 기반 실시간 인덱싱 알림 (폴링으로 대체)

---

## 기술 상세 (Technical Details)

### 파일 변경 목록

#### 신규 파일 (서버)
```
server/src/routes/ncv.ts               — API 라우터
server/src/services/configStore.ts     — In-Memory Store
server/src/services/mcpTools.ts        — MCP 도구 정의
server/src/mcp-server.ts               — MCP 서버 진입점
server/src/services/ragIndexer.ts      — RAG 인덱서
server/src/services/chunkBuilder.ts    — 청크 빌더
server/src/services/embeddingService.ts — Bedrock 임베딩
```

#### 수정 파일 (서버)
```
server/src/index.ts      — ncv 라우터 등록, /mcp 엔드포인트 추가
server/src/config.ts     — RAG 설정 (embeddingModel, vectorDimension) 추가
server/package.json      — @modelcontextprotocol/sdk, vectra 의존성 추가
```

#### 신규 파일 (프론트엔드)
```
src/hooks/useConfigSync.ts  — Config 파싱 결과 → 백엔드 동기화 훅
```

#### 수정 파일 (프론트엔드)
```
src/pages/V3Page.tsx    — useConfigSync 훅 통합
src/components/v3/AIChatPanel.tsx — RAG 검색 결과 활용 (Phase 3)
```

### 의존성 추가

```json
// server/package.json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.x",
    "vectra": "^0.x"
  }
}
```

### Config Store 설계

```typescript
// server/src/services/configStore.ts
interface StoredConfig {
  filename: string;
  parsedData: ParsedConfigV3;
  uploadedAt: Date;
  indexedAt?: Date;
}

class ConfigStore {
  private configs: Map<string, StoredConfig> = new Map();

  set(filename: string, data: ParsedConfigV3): void
  get(filename: string): StoredConfig | undefined
  getAll(): StoredConfig[]
  getAllServices(): NokiaServiceV3[]
  search(query: string): NokiaServiceV3[]
  clear(): void
}
```

### MCP 도구 스키마 예시

```typescript
// server/src/services/mcpTools.ts
{
  name: "get_services",
  description: "Nokia 네트워크 Config에서 파싱된 서비스 목록을 반환합니다",
  inputSchema: {
    type: "object",
    properties: {
      type: { type: "string", enum: ["epipe", "vpls", "vprn", "ies"] },
      customerId: { type: "number" },
      deviceName: { type: "string" }
    }
  }
}
```

---

## 위험 요소 (Risks)

### 기술적 위험

1. **Config Store 동기화**: React 프론트엔드 ↔ Express 백엔드 간 Config 상태 동기화
   - **완화**: `useConfigSync` 훅에서 파싱 성공 시 POST `/api/ncv/analyze` 자동 호출

2. **MCP SDK 호환성**: `@modelcontextprotocol/sdk` 버전과 Claude Desktop 버전 불일치
   - **완화**: 최신 stable 버전 명시, CLAUDE Desktop 설정 문서화

3. **임베딩 비용**: Bedrock Titan Embeddings 호출 비용 (대용량 Config 시)
   - **완화**: Config 변경 시에만 재인덱싱, 청크 수 제한 (최대 500개/Config)

4. **vectra 성능**: 로컬 파일 기반 벡터 DB의 검색 성능 (대용량)
   - **완화**: Config 파일당 최대 500개 청크 → 총 1000개 벡터 → vectra 충분

### 아키텍처 위험

5. **현재 Config가 프론트에만 존재**: 백엔드가 파싱 결과를 모름
   - **완화**: Feature 1 (JSON API)에서 ConfigStore 구현 시 해결

---

## 의존성 (Dependencies)

### 내부 의존성
- **v4.7.x 완료**: Auto Config Loading (WebSocket + chokidar) — 이미 완료
- **Express 백엔드 존재**: `server/` 디렉토리에 이미 운영 중
- **AWS Bedrock**: Claude AI 챗봇에서 이미 사용 중 (임베딩에 재활용)

### 외부 의존성
- `@modelcontextprotocol/sdk`: MCP 서버 구현
- `vectra`: 로컬 벡터 DB
- AWS Bedrock Titan Embeddings: 텍스트 임베딩 생성

---

## 테스트 계획 (Testing Plan)

### Feature 1 (JSON API)
- `curl http://localhost:3001/api/ncv/services` → 서비스 목록 JSON 반환 확인
- Config 업로드 후 GET 조회 → 동일 데이터 확인
- 키워드 검색 `?q=epipe` → 필터링된 결과 확인

### Feature 2 (MCP Server)
- Claude Desktop에 MCP 서버 등록 후 "NCV 서비스 목록 알려줘" 질문
- `get_services()` 도구 호출 → 정상 JSON 응답 확인
- HTTP transport: `curl -X POST /mcp` 로 도구 호출 테스트

### Feature 3 (RAG)
- Config 업로드 → POST `/api/ncv/index` 트리거 → 인덱싱 완료 확인
- POST `/api/ncv/semantic-search` body: `{"query": "customer 1001의 L2 서비스"}` → 관련 청크 반환
- AI 챗봇에서 RAG 컨텍스트 활용 시 응답 품질 향상 확인

---

## 마일스톤 (Milestones)

| 단계 | 작업 | 담당 | 상태 |
|-----|------|------|------|
| 1 | Design 문서 작성 | architect | Pending |
| 2 | Feature 1: ConfigStore + API 라우터 | developer | Pending |
| 3 | Feature 1: 5개 API 엔드포인트 구현 | developer | Pending |
| 4 | Feature 1: Frontend useConfigSync 훅 | frontend | Pending |
| 5 | Feature 2: MCP 서버 구현 (stdio) | developer | Pending |
| 6 | Feature 2: MCP 도구 7개 정의 + 테스트 | developer | Pending |
| 7 | Feature 3: ChunkBuilder + EmbeddingService | developer | Pending |
| 8 | Feature 3: RAG Indexer + vectra 통합 | developer | Pending |
| 9 | Feature 3: Semantic Search API | developer | Pending |
| 10 | QA: 전체 API 테스트 + MCP 통합 테스트 | qa | Pending |
| 11 | Docs: README-MCP.md, API 문서 | developer | Pending |

---

## 대안 고려 (Alternatives Considered)

### Feature 2: MCP 서버 대안

**Option A: GraphQL API** (비채택)
- 장점: 유연한 쿼리, 타입 안전성
- 단점: AI 에이전트 통합에 MCP가 표준으로 부상, 추가 라이브러리 필요
- 결론: ❌ MCP로 통일

**Option B: gRPC** (비채택)
- 장점: 고성능, 스키마 강제
- 단점: AI 에이전트 통합 복잡, 설정 부담
- 결론: ❌ REST + MCP로 충분

### Feature 3: 벡터 DB 대안

**Option A: Pinecone / Weaviate** (Phase 2로 이연)
- 장점: 클라우드 관리형, 대용량
- 단점: 외부 서비스 의존성, 비용, 설정 복잡
- 결론: ⏳ Phase 2에서 검토

**Option B: vectra (Local)** (채택)
- 장점: 서버 설치 불필요, Node.js 네이티브, 소규모 데이터(< 10,000 벡터)에 충분
- 단점: 수평 확장 불가
- 결론: ✅ Phase 1에 적합

---

## 우선순위 (Priority)

```
Feature 1 (JSON API)  →  Feature 2 (MCP)  →  Feature 3 (RAG)
   [필수]                   [고우선순위]          [중우선순위]

이유:
- Feature 1이 없으면 Feature 2, 3의 기반(ConfigStore)이 없음
- Feature 2는 AI 협업의 핵심 가치
- Feature 3는 검색 품질 향상 (AI 챗봇 개선)
```

---

## 참고 자료 (References)

### MCP (Model Context Protocol)
- [공식 문서](https://modelcontextprotocol.io/)
- [Node.js SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Claude Desktop MCP 설정](https://docs.anthropic.com/mcp)

### RAG / Vector DB
- [vectra - Local Vector DB](https://github.com/Stevenic/vectra)
- [AWS Bedrock Titan Embeddings](https://docs.aws.amazon.com/bedrock/latest/userguide/embeddings.html)

### 기존 NCV 코드
- `server/src/services/claudeClient.ts`: Bedrock Converse API (재활용)
- `src/utils/configSummaryBuilder.ts`: ParsedConfigV3 → AI용 JSON 변환 (참고)
- `server/src/index.ts`: Express 라우터 등록 패턴 (참고)

---

## 승인 (Approval)

- [x] 요구사항 검토 완료 (사용자 승인)
- [x] 기술적 실현 가능성 확인 (기존 인프라 재활용)
- [ ] Design 문서 작성 시작
- [ ] 다음 단계: `/pdca design ncv-ai-platform`

---

**Plan 작성자**: Claude Sonnet 4.6 (Enterprise Team Lead)
**검토자**: 사용자
**작성일**: 2026-02-21
**최종 수정일**: 2026-02-21

## 변경 이력 (Change Log)

### v1 (2026-02-21)
- 초기 Plan 작성
- 3개 Feature 정의: JSON API, MCP Server, RAG Indexing
- 전체 아키텍처 다이어그램 작성
- Enterprise Team PDCA 프로세스 시작
