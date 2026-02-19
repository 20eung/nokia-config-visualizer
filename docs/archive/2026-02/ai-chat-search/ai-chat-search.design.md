---
template: design
version: 1.2
description: AI Chatbot Service Search and Diagram Visualization - Design Specification
variables:
  feature: ai-chat-search
  date: 2026-02-15
  author: Claude Code (AI Assistant)
  project: Nokia Config Visualizer
  version: v3.2.0
---

# AI Chatbot Service Search Design Document

> **Summary**: Natural language service search powered by AWS Bedrock Claude, with automatic diagram visualization
>
> **Project**: Nokia Config Visualizer
> **Version**: v3.2.0
> **Branch**: v3-development
> **Author**: Claude Code (AI Assistant)
> **Date**: 2026-02-15
> **Status**: Implementation Complete (95%)
> **Planning Doc**: [ai-chat-search.plan.md](../01-plan/features/ai-chat-search.plan.md)

### Implementation Status

| Component | Status | Location |
|-----------|:------:|----------|
| AIChatPanel UI | ✅ Complete | `src/components/v3/AIChatPanel.tsx` |
| ServiceListV3 Integration | ✅ Complete | `src/components/v3/ServiceListV3.tsx` |
| Backend API | ✅ Complete | `server/src/` |
| AWS Bedrock Client | ✅ Complete | `server/src/services/claudeClient.ts` |
| ConfigSummary Builder | ✅ Complete | `src/utils/configSummaryBuilder.ts` |
| Docker Compose | ✅ Complete | `docker-compose.yml` |
| Nginx Proxy | ✅ Complete | `nginx.conf` |
| `.env.example` | ⏳ Pending | Root directory |
| System Prompt Optimization | 🔄 Ongoing | `server/src/prompts/systemPrompt.ts` |

---

## 1. Overview

### 1.1 Design Goals

1. **Natural Language Interface**: 사용자가 네트워크 서비스를 자연어로 질문
2. **Accurate Service Matching**: AI가 ConfigSummary를 분석하여 관련 서비스를 정확히 선택
3. **Automatic Visualization**: 선택된 서비스의 다이어그램을 자동으로 표시
4. **Seamless UX**: AI 검색과 기존 수동 검색을 토글로 전환 가능
5. **Production Ready**: Docker + Nginx로 프론트엔드와 백엔드 통합 배포

### 1.2 Design Principles

- **Zero-Config for Users**: AWS 자격 증명만 설정하면 즉시 사용 가능
- **Progressive Enhancement**: 기존 수동 검색 기능을 완전히 유지하면서 AI 기능 추가
- **Type Safety**: TypeScript strict mode로 모든 데이터 구조 타입 안전성 보장
- **Error Resilience**: AWS 연결 실패, 타임아웃, 권한 오류 등 명확한 에러 처리
- **Performance**: ConfigSummary 메모이제이션으로 불필요한 재계산 방지

---

## 2. Architecture

### 2.1 System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                           User (Browser)                             │
└──────────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
          ┌─────────▼─────────┐    ┌─────────▼─────────┐
          │  Manual Search    │    │   AI Search       │
          │  (Checkbox +      │    │   (Natural        │
          │   Search Input)   │    │    Language)      │
          └─────────┬─────────┘    └─────────┬─────────┘
                    │                         │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   ServiceListV3.tsx     │
                    │   - aiEnabled state     │
                    │   - configSummary memo  │
                    │   - handleAIResponse()  │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    V3Page.tsx           │
                    │    - selectedServiceIds │
                    │    - onSetSelected()    │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │  Diagram Rendering     │
                    │  - Topology Engine     │
                    │  - Mermaid Generator   │
                    └────────────────────────┘
```

### 2.2 Backend Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                     Frontend (React + Vite)                          │
│  AIChatPanel.tsx → chatApi.ts (fetch /api/chat)                     │
└──────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ HTTP POST /api/chat
                                 │ {message, configSummary}
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Nginx Reverse Proxy (Port 80)                     │
│  - /api/* → http://nokia-api:3000                                   │
│  - /* → SPA static files                                             │
└──────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  Express Server (Port 3000)                          │
│  server/src/index.ts                                                 │
│  - CORS, Helmet, Rate Limiting (30 req/min)                         │
│  - POST /api/chat → routes/chat.ts                                  │
│  - GET /api/health → health check                                   │
└──────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│              services/claudeClient.ts                                │
│  - BedrockRuntimeClient (AWS SDK v3)                                │
│  - ConverseCommand (Claude API)                                     │
│  - System Prompt + ConfigSummary → Claude                           │
└──────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ AWS API Call
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     AWS Bedrock (Claude Sonnet 4)                    │
│  - Model: apac.anthropic.claude-sonnet-4-20250514-v1:0             │
│  - Region: ap-northeast-2 (or env var)                              │
│  - Credentials: ~/.aws/credentials or IAM Role                      │
└──────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ JSON Response
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│  ChatResponse { selectedKeys, explanation, confidence }              │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.3 Component Diagram

```
src/components/v3/
├── ServiceListV3.tsx          (Container)
│   ├── aiEnabled: boolean
│   ├── configSummary: ConfigSummary | null
│   ├── handleAIResponse: (response: ChatResponse) => void
│   │
│   └── Children:
│       ├── AIChatPanel.tsx    (AI Interface)
│       │   ├── Bot Icon Toggle
│       │   ├── Text Input
│       │   ├── Loading Spinner
│       │   ├── Response Display
│       │   └── Error Display
│       │
│       └── Search Input        (Manual Interface)
│           ├── Text Input
│           └── Type Filter Buttons

src/pages/
└── V3Page.tsx                  (Page Container)
    ├── configs: ParsedConfigV3[]
    ├── selectedServiceIds: string[]
    ├── handleSetSelected: (keys: string[]) => void
    │
    └── Children:
        ├── FileUpload
        ├── ServiceListV3 (Sidebar)
        └── ServiceDiagram (Main Area)

src/utils/
├── configSummaryBuilder.ts     (Config → AI Format)
│   └── buildConfigSummary(configs: ParsedConfigV3[]): ConfigSummary
│
└── v3/
    ├── parserV3.ts             (Config Parser)
    └── mermaidGeneratorV3.ts   (Diagram Generator)

src/services/
└── chatApi.ts                  (API Client)
    ├── sendChatMessage()
    └── checkApiHealth()
```

### 2.4 Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ Step 1: Config Upload                                               │
│ User uploads Nokia config files → parseL2VPNConfig() → configs[]    │
└─────────────────────────────────────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Step 2: ConfigSummary Generation (Memoized)                         │
│ configs[] → buildConfigSummary() → ConfigSummary                    │
│ - Extract essential data (hostname, serviceId, description, etc.)   │
│ - Filter out shutdown services/interfaces                           │
│ - Calculate selectionKey (matches ServiceListV3 keys)              │
└─────────────────────────────────────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Step 3: User Query                                                   │
│ User types natural language question in AIChatPanel                 │
│ Example: "172.16으로 시작하는 VPRN 서비스 보여줘"                    │
└─────────────────────────────────────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Step 4: API Request                                                  │
│ sendChatMessage(message, configSummary) → POST /api/chat            │
│ Body: { message: string, configSummary: ConfigSummary }             │
│ Timeout: 60 seconds                                                  │
└─────────────────────────────────────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Step 5: Backend Processing                                           │
│ Express → claudeClient.askClaude()                                  │
│ - Build prompt: System Prompt + ConfigSummary JSON + User Question  │
│ - Call AWS Bedrock ConverseCommand                                  │
│ - Parse JSON response                                                │
│ - Validate selectedKeys against actual configSummary                │
└─────────────────────────────────────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Step 6: AI Response                                                  │
│ ChatResponse {                                                       │
│   selectedKeys: ["vprn-3093", "vprn-3099"],                         │
│   explanation: "172.16으로 시작하는 IP를 가진 VPRN 2개를 찾았습니다.",│
│   confidence: "high",                                                │
│   filterType: "vprn"                                                 │
│ }                                                                    │
└─────────────────────────────────────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Step 7: UI Update                                                    │
│ handleAIResponse() → onSetSelected(selectedKeys)                    │
│ - Update V3Page selectedServiceIds                                  │
│ - Trigger diagram generation                                        │
└─────────────────────────────────────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Step 8: Diagram Rendering                                            │
│ V3Page filters selectedServices → generateServiceDiagram()          │
│ → Mermaid code → DiagramViewer → PNG/SVG export                    │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.5 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| AIChatPanel | chatApi, ConfigSummary | AI 인터페이스 UI |
| ServiceListV3 | AIChatPanel, configSummaryBuilder | AI/수동 검색 통합 |
| V3Page | ServiceListV3, parserV3, mermaidGeneratorV3 | 메인 페이지 |
| chatApi | Backend API | HTTP 클라이언트 |
| claudeClient | AWS Bedrock SDK | AI 모델 호출 |
| configSummaryBuilder | ParsedConfigV3 | Config 요약 |

---

## 3. Data Model

### 3.1 Frontend Data Structures

#### ConfigSummary (AI 전달용 데이터)

```typescript
// src/utils/configSummaryBuilder.ts

interface SapSummary {
  sapId: string;           // e.g., "1/1/1:100"
  description: string;
  portId: string;
  ingressRate?: string;    // e.g., "100M", "1G"
  egressRate?: string;
}

interface InterfaceSummary {
  name: string;            // e.g., "to-Customer-A"
  description?: string;
  ipAddress?: string;      // e.g., "192.168.1.1/30"
  portId?: string;
  ingressRate?: string;
  egressRate?: string;
  vrrpBackupIp?: string;   // VRRP VIP
}

interface ServiceSummary {
  serviceType: 'epipe' | 'vpls' | 'vprn' | 'ies';
  serviceId: number;
  description: string;
  serviceName?: string;
  selectionKey: string;    // e.g., "epipe-100", "vprn-3093", "ies-nokia-1"
  saps?: SapSummary[];     // For epipe, vpls
  interfaces?: InterfaceSummary[];  // For vprn, ies
  bgpNeighbors?: string[]; // For vprn
  ospfAreas?: string[];    // For vprn
  staticRoutes?: string[]; // For vprn, ies
  autonomousSystem?: number;
  routeDistinguisher?: string;
}

interface DeviceSummary {
  hostname: string;        // e.g., "nokia-1"
  systemIp: string;        // e.g., "10.0.0.1"
  services: ServiceSummary[];
}

export interface ConfigSummary {
  devices: DeviceSummary[];
}
```

#### ChatResponse (AI 응답)

```typescript
// src/services/chatApi.ts

export interface ChatResponse {
  selectedKeys: string[];  // e.g., ["epipe-100", "vprn-3093"]
  explanation: string;     // 사용자에게 표시할 설명
  confidence: 'high' | 'medium' | 'low';
  filterType?: 'all' | 'epipe' | 'vpls' | 'vprn' | 'ies';
}
```

### 3.2 Backend Data Structures

#### ChatRequest

```typescript
// server/src/types.ts

export interface ChatRequest {
  message: string;         // User question (max 2000 chars)
  configSummary: ConfigSummary;
}
```

#### System Prompt Structure

```typescript
// server/src/prompts/systemPrompt.ts

export const SYSTEM_PROMPT = `
You are an AI assistant specialized in analyzing Nokia network configurations.

## Your Role
- Analyze ConfigSummary JSON (parsed Nokia network data)
- Respond to user queries about services, interfaces, routing
- Return selectedKeys (service selection keys) in JSON format

## Response Format (MUST be valid JSON):
{
  "selectedKeys": ["service-key-1", "service-key-2"],
  "explanation": "User-friendly explanation in Korean",
  "confidence": "high" | "medium" | "low",
  "filterType": "all" | "epipe" | "vpls" | "vprn" | "ies"
}

## Selection Key Format:
- Epipe: "epipe-{serviceId}"
- VPLS: "vpls-{serviceId}"
- VPRN: "vprn-{serviceId}" or "vprn___{serviceId}___{hostname}___{interfaceName}"
- IES: "ies-{hostname}" or "ies___{hostname}___{interfaceName}"

## Examples:
- "172.16으로 시작하는 VPRN 찾아줘" → Filter by IP address, return matching VPRN keys
- "nokia-1의 모든 서비스" → Filter by hostname
- "BGP를 사용하는 서비스" → Filter by bgpNeighbors presence
`;
```

### 3.3 Entity Relationships

```
ConfigSummary
    └── devices: DeviceSummary[]
            ├── hostname: string
            ├── systemIp: string
            └── services: ServiceSummary[]
                    ├── serviceType: enum
                    ├── serviceId: number
                    ├── selectionKey: string ← **핵심 필드**
                    ├── saps?: SapSummary[]
                    └── interfaces?: InterfaceSummary[]
```

**selectionKey의 중요성**:
- ServiceListV3.tsx와 V3Page.tsx에서 사용하는 선택 키와 동일한 형식
- AI가 반환하는 selectedKeys가 이 형식과 일치해야 자동 선택 가능
- claudeClient.ts에서 유효성 검증 수행

---

## 4. API Specification

### 4.1 Endpoint List

| Method | Path | Description | Auth | Rate Limit |
|--------|------|-------------|------|------------|
| POST | /api/chat | AI 서비스 검색 | None | 30 req/min |
| GET | /api/health | Health check | None | Unlimited |

### 4.2 POST /api/chat

자연어 질문을 받아 관련 서비스를 AI로 검색합니다.

**Request:**
```json
{
  "message": "172.16으로 시작하는 VPRN 서비스 보여줘",
  "configSummary": {
    "devices": [
      {
        "hostname": "nokia-1",
        "systemIp": "10.0.0.1",
        "services": [
          {
            "serviceType": "vprn",
            "serviceId": 3093,
            "description": "Customer-A VPRN",
            "selectionKey": "vprn-3093",
            "interfaces": [
              {
                "name": "to-CustomerA",
                "ipAddress": "172.16.1.1/30",
                "portId": "1/1/1"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

**Response (200 OK):**
```json
{
  "selectedKeys": ["vprn-3093", "vprn-3099"],
  "explanation": "172.16으로 시작하는 IP 주소를 가진 VPRN 서비스 2개를 찾았습니다: VPRN 3093 (Customer-A), VPRN 3099 (Customer-B)",
  "confidence": "high",
  "filterType": "vprn"
}
```

**Error Responses:**

**400 Bad Request** - Input validation failed
```json
{
  "error": "message 필드가 필요합니다."
}
```

**429 Too Many Requests** - Rate limit exceeded
```json
{
  "error": "요청이 너무 많습니다. 1분 후 다시 시도해주세요."
}
```

**503 Service Unavailable** - AWS Bedrock connection failed
```json
{
  "error": "AWS 자격 증명을 확인해주세요. ~/.aws/credentials 또는 환경변수를 설정하세요."
}
```

**500 Internal Server Error** - Server error
```json
{
  "error": "서버 오류가 발생했습니다."
}
```

### 4.3 GET /api/health

Backend API 및 AWS Bedrock 연결 상태를 확인합니다.

**Response (200 OK):**
```json
{
  "status": "ok",
  "region": "ap-northeast-2",
  "model": "apac.anthropic.claude-sonnet-4-20250514-v1:0"
}
```

---

## 5. UI/UX Design

### 5.1 Screen Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Header: Nokia Config Visualizer v3.2.0                             │
│  [Upload Config] [V1 Page] [V2 Page] [V3 Page ✓]                    │
└──────────────────────────────────────────────────────────────────────┘
│
├───────────────────────┬──────────────────────────────────────────────┤
│                       │                                              │
│  Sidebar (320px)      │  Main Area                                   │
│  ┌─────────────────┐  │  ┌────────────────────────────────────────┐ │
│  │ [🤖] AI Toggle  │  │  │  Service Group Header                  │ │
│  ├─────────────────┤  │  │  VPRN 3093: Customer-A VPRN            │ │
│  │                 │  │  ├────────────────────────────────────────┤ │
│  │ [AI Mode]       │  │  │                                        │ │
│  │ ┌─────────────┐ │  │  │  Mermaid Diagram                       │ │
│  │ │ AI에게      │ │  │  │  ┌──────┐   ┌──────┐   ┌──────┐       │ │
│  │ │ 질문하세요  │ │  │  │  │nokia1│──▶│ BGP  │──▶│Service│      │ │
│  │ └─────────────┘ │  │  │  └──────┘   └──────┘   └──────┘       │ │
│  │                 │  │  │                                        │ │
│  │ 높음 | 2개 선택 │  │  ├────────────────────────────────────────┤ │
│  │ 172.16으로...   │  │  │  [Zoom In] [Zoom Out] [PNG] [SVG]     │ │
│  │                 │  │  └────────────────────────────────────────┘ │
│  │ [x] Clear       │  │                                              │
│  └─────────────────┘  │                                              │
│                       │                                              │
│  [OR Manual Mode]     │                                              │
│  ┌─────────────────┐  │                                              │
│  │ Search...       │  │                                              │
│  ├─────────────────┤  │                                              │
│  │ [All] [Epipe]   │  │                                              │
│  │ [VPLS] [VPRN]   │  │                                              │
│  │ [IES]           │  │                                              │
│  ├─────────────────┤  │                                              │
│  │ ☐ nokia-1       │  │                                              │
│  │   ☐ epipe-100   │  │                                              │
│  │   ☐ vprn-3093   │  │                                              │
│  └─────────────────┘  │                                              │
│                       │                                              │
└───────────────────────┴──────────────────────────────────────────────┘
```

### 5.2 User Flow

#### AI Search Flow
```
1. User uploads config files
   ↓
2. User clicks Bot icon to enable AI mode
   ↓
3. User types natural language question
   ↓
4. [Enter] or Click submit
   ↓
5. Loading spinner (AI가 서비스를 검색하고 있습니다...)
   ↓
6. AI response appears:
   - Confidence badge (높음/보통/낮음)
   - Count badge (N개 선택)
   - Explanation text
   ↓
7. Selected services automatically highlighted in list
   ↓
8. Diagrams automatically rendered in main area
   ↓
9. [Optional] User clicks [x] Clear to reset
```

#### Manual Search Flow (기존)
```
1. User uploads config files
   ↓
2. User types keyword in search input (or uses filter buttons)
   ↓
3. Service list filters in real-time
   ↓
4. User checks checkboxes to select services
   ↓
5. Diagrams render in main area
```

### 5.3 Component Hierarchy

```
V3Page
├── FileUpload
│
├── Sidebar (ServiceListV3)
│   ├── AI Mode
│   │   └── AIChatPanel
│   │       ├── Bot Toggle Button
│   │       ├── Input Field (when enabled)
│   │       ├── Loading Spinner
│   │       ├── Response Panel
│   │       │   ├── Confidence Badge
│   │       │   ├── Count Badge
│   │       │   ├── Explanation Text
│   │       │   └── Clear Button
│   │       └── Error Panel
│   │
│   └── Manual Mode
│       ├── Search Input
│       ├── Filter Buttons
│       └── Service Tree
│           ├── Device Node (collapsible)
│           └── Service Checkboxes
│
└── Main Area (ServiceDiagram)
    ├── Service Group Header
    ├── Mermaid Diagram
    └── Control Buttons
        ├── Zoom In/Out
        ├── PNG Export
        └── SVG Export
```

### 5.4 State Management

**V3Page.tsx**:
```typescript
const [configs, setConfigs] = useState<ParsedConfigV3[]>([]);
const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
// No AI-specific state here - delegated to ServiceListV3
```

**ServiceListV3.tsx**:
```typescript
const [searchQuery, setSearchQuery] = useState('');
const [filterType, setFilterType] = useState<'all' | 'epipe' | 'vpls' | 'vprn' | 'ies'>('all');
const [aiEnabled, setAiEnabled] = useState(false); // AI/Manual toggle

// ConfigSummary memoization (only recalculate when configs change)
const configSummary = useMemo<ConfigSummary | null>(() => {
  if (configs.length === 0) return null;
  return buildConfigSummary(configs);
}, [configs]);

// AI response handler
const handleAIResponse = useCallback((response: ChatResponse) => {
  onSetSelected(response.selectedKeys);  // Update parent state
  if (response.filterType && response.filterType !== 'all') {
    setFilterType(response.filterType);  // Apply filter
  }
}, [onSetSelected]);
```

**AIChatPanel.tsx**:
```typescript
const [query, setQuery] = useState('');
const [loading, setLoading] = useState(false);
const [response, setResponse] = useState<ChatResponse | null>(null);
const [error, setError] = useState<string | null>(null);
const abortRef = useRef<AbortController | null>(null);
```

---

## 6. Error Handling

### 6.1 Error Code Definition

| Code | Message | Cause | Handling |
|------|---------|-------|----------|
| 400 | "message 필드가 필요합니다." | Missing message field | Show error in AIChatPanel |
| 400 | "configSummary.devices 필드가 필요합니다." | Missing configSummary | Show error in AIChatPanel |
| 400 | "질문은 2000자 이내여야 합니다." | Message too long | Show error in AIChatPanel |
| 429 | "요청이 너무 많습니다. 1분 후 다시 시도해주세요." | Rate limit exceeded | Show error + suggest retry |
| 500 | "서버 오류가 발생했습니다." | Unexpected server error | Show generic error |
| 503 | "AWS 자격 증명을 확인해주세요. ~/.aws/credentials 또는 환경변수를 설정하세요." | AWS credentials missing/invalid | Show error + guide to `.env.example` |
| 503 | "AWS Bedrock 접근 권한이 없습니다. IAM 정책을 확인하세요." | IAM permission denied | Show error + IAM policy example |
| 503 | "Bedrock 모델에 접근할 수 없습니다. 모델 ID와 리전을 확인하세요." | Model not available | Show error + suggest model ID check |
| TIMEOUT | "요청이 취소되었거나 시간이 초과되었습니다." | Network timeout (60s) | Show error + suggest retry |

### 6.2 Error Response Format

**Frontend (chatApi.ts)**:
```typescript
try {
  const res = await fetch('/api/chat', { ... });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `서버 오류 (${res.status})`);
  }
  return await res.json();
} catch (err: unknown) {
  if (err instanceof DOMException && err.name === 'AbortError') {
    throw new Error('요청이 취소되었거나 시간이 초과되었습니다.');
  }
  throw err;
}
```

**Backend (routes/chat.ts)**:
```typescript
try {
  const result = await askClaude(body.message, body.configSummary);
  res.json(result);
} catch (err: unknown) {
  const error = err as Error;
  console.error('[POST /api/chat] Error:', error.message);

  if (error.name === 'CredentialsProviderError') {
    res.status(503).json({
      error: 'AWS 자격 증명을 확인해주세요. ~/.aws/credentials 또는 환경변수를 설정하세요.',
    });
    return;
  }

  // ... (기타 에러 타입 처리)

  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
}
```

### 6.3 Error UI Display

```tsx
// AIChatPanel.tsx

{error && !loading && (
  <div className="ai-error">{error}</div>
)}
```

**CSS Styling** (AIChatPanel.css):
```css
.ai-error {
  padding: 12px;
  background-color: #fee;
  color: #c00;
  border-radius: 8px;
  font-size: 14px;
}
```

---

## 7. Security Considerations

### 7.1 Security Checklist

- [x] **Input Validation**: Express body validation (message max 2000 chars)
- [x] **Rate Limiting**: 30 requests/minute per IP
- [x] **CORS**: Configured via `cors` middleware (env var `CORS_ORIGIN`)
- [x] **Security Headers**: Helmet middleware enabled
- [x] **AWS Credentials**: Stored in ~/.aws/ (not in code), mounted read-only in Docker
- [x] **Nginx Proxy**: X-Real-IP, X-Forwarded-For headers for accurate rate limiting
- [x] **HTTPS**: Production deployment should use HTTPS (Nginx + SSL cert)
- [ ] **DDoS Protection**: Consider Cloudflare or AWS WAF for production

### 7.2 AWS IAM Policy (Least Privilege)

**Minimum required permissions**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": "arn:aws:bedrock:ap-northeast-2::foundation-model/apac.anthropic.claude-sonnet-4-*"
    }
  ]
}
```

**DO NOT GRANT**:
- `bedrock:*` (too broad)
- `bedrock:CreateModelCustomizationJob` (not needed)
- Other AWS services (S3, EC2, etc.)

### 7.3 Environment Variable Security

**NEVER commit to git**:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN`

**Safe to commit** (with placeholders):
- `.env.example` with placeholder values
- `docker-compose.yml` with `${ENV_VAR}` references

**Docker Security**:
- Mount ~/.aws as **read-only** (`:ro` flag)
- Use `AWS_PROFILE` instead of hardcoding credentials
- Consider AWS ECS/EKS with IAM Roles for production

---

## 8. Test Plan

### 8.1 Test Scope

| Type | Target | Tool | Priority |
|------|--------|------|:--------:|
| Manual Test | Happy path scenarios | Browser DevTools | High |
| Manual Test | Error scenarios | Browser DevTools | High |
| Manual Test | Edge cases | Browser DevTools | Medium |
| Unit Test | configSummaryBuilder | Jest/Vitest | Low |
| Integration Test | /api/chat endpoint | Supertest | Medium |
| E2E Test | Full user flow | Playwright | Low |

### 8.2 Test Cases

#### Happy Path
- [x] User uploads config1.txt, config2.txt
- [x] User enables AI mode (Bot icon)
- [x] User types "172.16으로 시작하는 VPRN 찾아줘"
- [x] AI returns selectedKeys with high confidence
- [x] Diagrams render automatically
- [x] User clicks Clear to reset

#### Error Scenarios
- [ ] User types question without uploading config → "ConfigSummary가 없습니다" 에러
- [ ] User uploads invalid config → Parser error
- [ ] Backend server down → Network error
- [ ] AWS credentials invalid → 503 error with clear message
- [ ] AWS Bedrock throttling → 429 error with retry suggestion
- [ ] User types 2001-character question → 400 error

#### Edge Cases
- [ ] User types ambiguous question → AI returns medium/low confidence
- [ ] AI returns empty selectedKeys → "서비스를 찾을 수 없습니다" message
- [ ] AI returns invalid selectionKey → Backend filters out invalid keys
- [ ] User switches AI/Manual mode mid-search → State resets correctly
- [ ] User uploads 10+ config files → ConfigSummary size, performance

### 8.3 Performance Test

| Metric | Target | Measurement |
|--------|--------|-------------|
| AI Response Time | < 10s | AWS Bedrock latency |
| ConfigSummary Build | < 100ms | useMemo performance |
| Diagram Render | < 2s | Mermaid.js render time |
| API Rate Limit | 30 req/min | Express rate-limit |

---

## 9. Clean Architecture

### 9.1 Layer Structure

| Layer | Responsibility | Location |
|-------|---------------|----------|
| **Presentation** | UI components, hooks, pages | `src/components/`, `src/pages/` |
| **Application** | Business logic, state management | `src/components/v3/ServiceListV3.tsx` (AI logic) |
| **Domain** | Core types, entities | `src/types/`, `src/types/v2.ts`, `server/src/types.ts` |
| **Infrastructure** | API clients, parsers, generators | `src/services/chatApi.ts`, `src/utils/`, `server/src/services/` |

### 9.2 Dependency Rules

```
┌─────────────────────────────────────────────────────────────┐
│                    Dependency Direction                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Presentation ──→ Application ──→ Domain ←── Infrastructure│
│   (AIChatPanel)    (ServiceListV3)  (Types)   (chatApi)    │
│                          │                                  │
│                          └──→ Infrastructure                │
│                            (configSummaryBuilder)           │
│                                                             │
│   Rule: Inner layers MUST NOT depend on outer layers        │
│         Domain is independent (pure types)                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 9.3 File Import Rules

| From | Can Import | Cannot Import |
|------|-----------|---------------|
| AIChatPanel.tsx | chatApi, ConfigSummary | parserV3, mermaidGeneratorV3 |
| ServiceListV3.tsx | AIChatPanel, configSummaryBuilder, Types | Backend code |
| V3Page.tsx | ServiceListV3, parserV3, mermaidGeneratorV3 | chatApi directly |
| chatApi.ts | Types only | React components |
| configSummaryBuilder.ts | Types only | React components |

### 9.4 This Feature's Layer Assignment

| Component | Layer | Location |
|-----------|-------|----------|
| AIChatPanel | Presentation | `src/components/v3/AIChatPanel.tsx` |
| ServiceListV3 | Application | `src/components/v3/ServiceListV3.tsx` |
| V3Page | Presentation | `src/pages/V3Page.tsx` |
| chatApi | Infrastructure | `src/services/chatApi.ts` |
| configSummaryBuilder | Infrastructure | `src/utils/configSummaryBuilder.ts` |
| claudeClient | Infrastructure | `server/src/services/claudeClient.ts` |
| ChatResponse, ConfigSummary | Domain | `src/services/chatApi.ts`, `src/utils/configSummaryBuilder.ts` |

---

## 10. Coding Convention Reference

### 10.1 Naming Conventions (from CLAUDE.md)

| Target | Rule | Example |
|--------|------|---------|
| Components | PascalCase | `AIChatPanel`, `ServiceListV3` |
| Functions | camelCase | `buildConfigSummary()`, `handleAIResponse()` |
| Types/Interfaces | PascalCase | `ConfigSummary`, `ChatResponse` |
| Files (component) | PascalCase.tsx | `AIChatPanel.tsx` |
| Files (utility) | camelCase.ts | `configSummaryBuilder.ts`, `chatApi.ts` |
| Folders | kebab-case | `components/v3/` |

### 10.2 Import Order

```typescript
// 1. External libraries
import { useState, useMemo, useCallback } from 'react';
import { Bot, X } from 'lucide-react';

// 2. Internal absolute imports (types)
import type { ParsedConfigV3 } from '../../utils/v3/parserV3';
import type { ChatResponse } from '../../services/chatApi';

// 3. Relative imports (utils)
import { buildConfigSummary, type ConfigSummary } from '../../utils/configSummaryBuilder';
import { sendChatMessage } from '../../services/chatApi';

// 4. Relative imports (components)
import { AIChatPanel } from './AIChatPanel';

// 5. Styles
import './ServiceList.css';
```

### 10.3 Environment Variables

#### Frontend (.env)
| Variable | Purpose | Scope | Example |
|----------|---------|-------|---------|
| `VITE_API_URL` | Backend API URL (development) | Client | `http://localhost:3000/api` |

**Note**: Production에서는 Nginx 프록시로 `/api` 경로 사용

#### Backend (.env)
| Variable | Purpose | Scope | Example |
|----------|---------|-------|---------|
| `PORT` | Server port | Server | `3000` |
| `AWS_REGION` | AWS region | Server | `ap-northeast-2` |
| `AWS_DEFAULT_REGION` | Fallback AWS region | Server | `ap-northeast-2` |
| `AWS_PROFILE` | AWS profile name | Server | `default` (optional) |
| `BEDROCK_MODEL_ID` | Bedrock model ID | Server | `apac.anthropic.claude-sonnet-4-20250514-v1:0` |
| `CORS_ORIGIN` | CORS allowed origin | Server | `*` (dev), `https://your-domain.com` (prod) |

### 10.4 This Feature's Conventions

| Item | Convention Applied |
|------|-------------------|
| Component naming | PascalCase (AIChatPanel, ServiceListV3) |
| File organization | Feature-based (components/v3/, services/, utils/) |
| State management | React useState + useMemo + useCallback |
| Error handling | Try-catch + user-friendly error messages |
| Type safety | TypeScript strict mode + explicit types |
| CSS styling | Vanilla CSS (AIChatPanel.css) |

---

## 11. Implementation Guide

### 11.1 File Structure (Current State)

```
src/
├── components/
│   └── v3/
│       ├── AIChatPanel.tsx       ✅ Implemented
│       ├── AIChatPanel.css       ✅ Implemented
│       └── ServiceListV3.tsx     ✅ Implemented (AI integrated)
│
├── services/
│   └── chatApi.ts                ✅ Implemented
│
├── utils/
│   └── configSummaryBuilder.ts   ✅ Implemented
│
├── pages/
│   └── V3Page.tsx                ✅ Implemented
│
└── types/
    └── v2.ts                     ✅ Implemented

server/
├── src/
│   ├── index.ts                  ✅ Implemented
│   ├── routes/
│   │   └── chat.ts               ✅ Implemented
│   ├── services/
│   │   └── claudeClient.ts       ✅ Implemented
│   ├── prompts/
│   │   └── systemPrompt.ts       ✅ Implemented
│   └── types.ts                  ✅ Implemented
│
├── package.json                  ✅ Implemented
├── tsconfig.json                 ✅ Implemented
└── Dockerfile                    ✅ Implemented

Root:
├── docker-compose.yml            ✅ Implemented
├── nginx.conf                    ✅ Implemented
└── .env.example                  ⏳ TO DO
```

### 11.2 Implementation Order (95% Complete)

1. [x] Define data model
   - [x] ConfigSummary interface
   - [x] ChatResponse interface
   - [x] ChatRequest interface

2. [x] Implement Backend API
   - [x] Express server setup
   - [x] AWS Bedrock client (claudeClient.ts)
   - [x] System Prompt
   - [x] POST /api/chat endpoint
   - [x] GET /api/health endpoint
   - [x] Error handling
   - [x] Rate limiting

3. [x] Implement Frontend API Client
   - [x] chatApi.ts (sendChatMessage, checkApiHealth)
   - [x] configSummaryBuilder.ts

4. [x] Implement UI Components
   - [x] AIChatPanel.tsx (Bot toggle, input, response display)
   - [x] AIChatPanel.css
   - [x] ServiceListV3.tsx integration (aiEnabled, handleAIResponse)

5. [x] Implement Integration
   - [x] V3Page.tsx (onSetSelected callback)
   - [x] ConfigSummary memoization
   - [x] AI response → auto service selection

6. [x] Implement Deployment
   - [x] Docker Compose (frontend + backend)
   - [x] Nginx reverse proxy
   - [x] AWS credentials mounting

7. [ ] Implement Documentation
   - [ ] `.env.example` with all env vars
   - [ ] README update with AI feature guide

8. [ ] Testing
   - [x] Manual testing with config1.txt, config2.txt
   - [ ] Error scenario testing
   - [ ] Performance testing

### 11.3 Remaining Tasks (5%)

#### Task 1: Create `.env.example`
**Priority**: High
**Location**: `/Users/20eung/Project/nokia-config-visualizer/.env.example`
**Content**:
```bash
# ===================================
# Nokia Config Visualizer - AI Search
# ===================================

# Backend API (Express Server)
PORT=3000
AWS_REGION=ap-northeast-2
AWS_DEFAULT_REGION=ap-northeast-2
AWS_PROFILE=default
BEDROCK_MODEL_ID=apac.anthropic.claude-sonnet-4-20250514-v1:0
CORS_ORIGIN=*

# Frontend (React + Vite)
# Note: In production, /api is proxied by Nginx
# VITE_API_URL=http://localhost:3000/api

# Docker Compose
FRONTEND_PORT=3301
BACKEND_PORT=3000

# ===================================
# AWS Credentials Setup
# ===================================
# Option 1: Use ~/.aws/credentials (Recommended)
# [default]
# aws_access_key_id = YOUR_ACCESS_KEY
# aws_secret_access_key = YOUR_SECRET_KEY
#
# Option 2: Use environment variables (Not recommended for production)
# AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY
# AWS_SECRET_ACCESS_KEY=YOUR_SECRET_KEY
#
# Option 3: Use IAM Role (EC2/ECS/EKS)
# No manual configuration needed - automatic
```

#### Task 2: System Prompt Optimization (Optional)
**Priority**: Medium
**Location**: `server/src/prompts/systemPrompt.ts`
**Improvement Areas**:
- Add more examples for edge cases
- Improve confidence judgment criteria
- Add support for complex queries (multiple filters)

#### Task 3: README Update
**Priority**: Low
**Location**: `README.md`
**Add section**:
```markdown
## AI Service Search (v3.3+)

AI 챗봇을 사용하여 자연어로 네트워크 서비스를 검색할 수 있습니다.

### Quick Start
1. AWS 자격 증명 설정: `~/.aws/credentials`
2. Docker Compose 실행: `docker-compose up -d`
3. 브라우저 열기: `http://localhost:3301`
4. Config 파일 업로드
5. Bot 아이콘 클릭하여 AI 모드 활성화
6. 자연어 질문 입력 (예: "172.16으로 시작하는 VPRN 찾아줘")

### Environment Variables
See `.env.example` for all available options.
```

---

## 12. Performance Optimization

### 12.1 Frontend Optimizations

**ConfigSummary Memoization**:
```typescript
// ServiceListV3.tsx
const configSummary = useMemo<ConfigSummary | null>(() => {
  if (configs.length === 0) return null;
  return buildConfigSummary(configs);
}, [configs]); // Only recalculate when configs change
```

**Benefits**:
- Prevents unnecessary ConfigSummary rebuilds (expensive operation)
- Reduces re-renders in AIChatPanel
- Improves UI responsiveness

**Callback Memoization**:
```typescript
const handleAIResponse = useCallback((response: ChatResponse) => {
  onSetSelected(response.selectedKeys);
  if (response.filterType && response.filterType !== 'all') {
    setFilterType(response.filterType);
  }
}, [onSetSelected]); // Only recreate when dependency changes
```

### 12.2 Backend Optimizations

**AWS Bedrock Configuration**:
```typescript
// server/src/services/claudeClient.ts
inferenceConfig: {
  maxTokens: 1024,      // Limit response size for faster generation
  temperature: 0.1,     // Low temperature for deterministic responses
}
```

**Rate Limiting**:
```typescript
// server/src/index.ts
app.use('/api/', rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 30,              // 30 requests per IP
}));
```

**Timeout Handling**:
```typescript
// src/services/chatApi.ts
const CHAT_TIMEOUT_MS = 60_000; // 60 seconds

// Prevents indefinite waiting
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
```

### 12.3 Network Optimizations

**Nginx Gzip Compression**:
```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
```

**Static Asset Caching**:
```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}
```

---

## 13. Monitoring and Logging

### 13.1 Backend Logging

**Current Implementation**:
```typescript
// server/src/routes/chat.ts
console.error('[POST /api/chat] Error:', error.message);

// server/src/index.ts
console.log(`[nokia-api] Server running on port ${PORT}`);
console.log(`[nokia-api] AWS Region: ${process.env.AWS_REGION || 'ap-northeast-2'}`);
console.log(`[nokia-api] Model: ${process.env.BEDROCK_MODEL_ID || 'apac.anthropic.claude-sonnet-4-...'}`);
```

**Future Improvements**:
- Structured logging (Winston, Pino)
- Log aggregation (CloudWatch, Datadog)
- Request ID tracking
- Performance metrics (latency, error rate)

### 13.2 Frontend Error Tracking

**Current Implementation**:
```typescript
// AIChatPanel.tsx
catch (err: unknown) {
  const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
  setError(message);
}
```

**Future Improvements**:
- Error tracking service (Sentry, Rollbar)
- User session replay
- Performance monitoring (Web Vitals)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-02-15 | Initial design - discovered 95% implementation complete | Claude Code |
| 0.2 | 2026-02-15 | Added remaining tasks (`.env.example`, System Prompt) | Claude Code |
