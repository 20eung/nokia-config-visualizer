---
feature: ncv-ai-platform
version: v4.8.0
status: design
created: 2026-02-21
author: Claude Sonnet 4.6 (Enterprise Team)
---

# NCV AI Collaboration Platform - Design Document

> **Feature**: NCV AI 협업 플랫폼 (JSON API + MCP Server + RAG Indexing)
> **Version**: v4.8.0
> **Status**: 🎨 Design
> **Type**: Platform Extension (AI-First Architecture)

## Plan 참조
[ncv-ai-platform.plan.md](../../01-plan/features/ncv-ai-platform.plan.md)

---

## 1. 개요 (Overview)

3개 Feature를 순차적으로 구현하여 NCV를 AI 협업 미들웨어로 전환합니다.

| Feature | 목표 | 의존성 |
|---------|------|------|
| F1: JSON REST API | Config 파싱 결과를 외부에 표준 JSON으로 노출 | 없음 (신규) |
| F2: MCP Server | AI 에이전트가 NCV 도구를 직접 호출 | F1의 ConfigStore |
| F3: RAG Indexing | 시맨틱 검색 + AI 챗봇 품질 향상 | F1의 ConfigStore |

### 핵심 원칙

1. **기존 코드 최소 수정**: 현재 Express 백엔드, parserV3.ts, fileWatcher 재활용
2. **Config Store가 허브**: 백엔드에 파싱 결과를 저장하는 단일 저장소
3. **단계적 구현**: F1 → F2 → F3 순서 (각 Feature 독립 배포 가능)
4. **프론트엔드 동기화**: `useConfigSync` 훅으로 React state → 백엔드 자동 동기화

---

## 2. 전체 아키텍처 (Architecture)

### 2.1 데이터 흐름

```
프론트엔드                           백엔드 (Express)
┌─────────────────────┐             ┌───────────────────────────────┐
│                     │             │                               │
│  Config Upload      │──parse──→   │   (프론트에서만 파싱됨)        │
│  (parserV3.ts)      │             │                               │
│  ParsedConfigV3[]   │──POST──────→│  /api/ncv/analyze             │
│                     │  (F1 신규)  │       ↓                       │
│  useConfigSync      │             │  ConfigStore (In-Memory Map)  │
│  (F1 신규 훅)       │             │       ↓                       │
│                     │             │  ┌────────────────────────┐   │
│  AIChatPanel        │←─────────── │  │  /api/ncv/* (F1)       │   │
│  (F3: RAG 개선)     │             │  │  MCP Server (F2)       │   │
└─────────────────────┘             │  │  RAG Indexer (F3)      │   │
                                    │  └────────────────────────┘   │
                                    └───────────────────────────────┘
                                              ↑
                                    AI Agent (Claude Desktop, etc.)
                                         MCP call: get_services()
```

### 2.2 서버 디렉토리 구조 (추가/변경)

```
server/src/
├── index.ts                    ← 수정: ncvRouter, MCP 엔드포인트 추가
├── config.ts                   ← 수정: RAG 관련 설정 추가
├── types.ts                    ← 수정: NCV API 타입 추가
│
├── routes/
│   ├── chat.ts                 (기존 유지)
│   ├── config.ts               (기존 유지)
│   ├── dictionary.ts           (기존 유지)
│   └── ncv.ts                  ← 신규 (F1): NCV REST API 라우터
│
├── services/
│   ├── claudeClient.ts         ← 수정 (F3): RAG 컨텍스트 주입 파라미터 추가
│   ├── configStore.ts          ← 신규 (F1): In-Memory Config Store
│   ├── mcpTools.ts             ← 신규 (F2): MCP 도구 정의
│   ├── ragIndexer.ts           ← 신규 (F3): vectra 기반 벡터 인덱서
│   ├── chunkBuilder.ts         ← 신규 (F3): 서비스 → 텍스트 청크 변환
│   └── embeddingService.ts     ← 신규 (F3): Bedrock Titan 임베딩
│
└── mcp-server.ts               ← 신규 (F2): stdio MCP 서버 진입점

프론트엔드 (src/)
└── hooks/
    └── useConfigSync.ts        ← 신규 (F1): React state → 백엔드 동기화
```

---

## 3. Feature 1: JSON REST API

### 3.1 ConfigStore 설계

```typescript
// server/src/services/configStore.ts

import type { ConfigSummary } from '../types';

export interface StoredConfig {
  filename: string;
  hostname: string;
  systemIp: string;
  configSummary: ConfigSummary;    // AI용 축약 데이터 (기존 타입 재활용)
  rawServiceCount: number;
  uploadedAt: Date;
  indexedAt?: Date;                // RAG 인덱싱 완료 시간 (F3)
}

class ConfigStore {
  private readonly store = new Map<string, StoredConfig>();

  set(filename: string, config: StoredConfig): void {
    this.store.set(filename, config);
  }

  get(filename: string): StoredConfig | undefined {
    return this.store.get(filename);
  }

  getAll(): StoredConfig[] {
    return Array.from(this.store.values());
  }

  getAllServices(): Array<ConfigSummary['devices'][0]['services'][0] & { hostname: string }> {
    const result = [];
    for (const stored of this.store.values()) {
      for (const device of stored.configSummary.devices) {
        for (const svc of device.services) {
          result.push({ ...svc, hostname: device.hostname });
        }
      }
    }
    return result;
  }

  searchServices(query: string): typeof this.getAllServices extends () => infer R ? R : never {
    const lower = query.toLowerCase();
    return this.getAllServices().filter(svc =>
      svc.description?.toLowerCase().includes(lower)
      || svc.serviceName?.toLowerCase().includes(lower)
      || String(svc.serviceId).includes(lower)
      || svc.serviceType.includes(lower)
      || svc.hostname.toLowerCase().includes(lower)
    );
  }

  clear(): void {
    this.store.clear();
  }

  getStats(): { configCount: number; serviceCount: number; lastUpdated: Date | null } {
    return {
      configCount: this.store.size,
      serviceCount: this.getAllServices().length,
      lastUpdated: this.store.size > 0
        ? new Date(Math.max(...Array.from(this.store.values()).map(c => c.uploadedAt.getTime())))
        : null,
    };
  }
}

// 싱글톤 인스턴스
export const configStore = new ConfigStore();
```

**설계 결정**: `ParsedConfigV3` 대신 기존 `ConfigSummary` 타입 재활용.
- `configSummaryBuilder.ts`가 이미 `ParsedConfigV3 → ConfigSummary` 변환 담당
- 백엔드에서 `parserV3.ts` 를 서버 사이드로 이식하지 않아도 됨 (프론트에서 파싱 후 전달)

### 3.2 API 라우터 (`server/src/routes/ncv.ts`)

```typescript
// 엔드포인트 목록

POST /api/ncv/analyze
  Request:  { filename: string, configSummary: ConfigSummary, hostname: string, systemIp: string }
  Response: { success: boolean, filename: string, serviceCount: number }

GET  /api/ncv/services
  Query:    ?type=epipe|vpls|vprn|ies  ?hostname=  ?q=
  Response: { version, timestamp, configCount, serviceCount, services: [...] }

GET  /api/ncv/services/:serviceKey
  Params:   serviceKey = "epipe-100" | "vpls-200" | ...
  Response: { service: ServiceSummary & { hostname: string } }

GET  /api/ncv/topology
  Response: { nodes: TopologyNode[], edges: TopologyEdge[], mermaid?: string }

GET  /api/ncv/devices
  Response: { devices: [{ hostname, systemIp, serviceCount, services: [...] }] }

GET  /api/ncv/search?q={query}
  Response: { query, results: [...], count: number }

GET  /api/ncv/export
  Query:    ?format=json|mermaid
  Response: JSON 전체 또는 Mermaid 텍스트

GET  /api/ncv/stats
  Response: { configCount, serviceCount, lastUpdated, indexedAt? }
```

### 3.3 응답 타입 (`server/src/types.ts`에 추가)

```typescript
// 추가할 타입들

export interface NcvServiceItem {
  serviceType: 'epipe' | 'vpls' | 'vprn' | 'ies';
  serviceId: number;
  selectionKey: string;
  description: string;
  serviceName?: string;
  hostname: string;
  systemIp: string;
  saps?: SapSummary[];
  interfaces?: InterfaceSummary[];
  bgpNeighbors?: string[];
  staticRoutes?: string[];
}

export interface NcvServicesResponse {
  version: string;
  timestamp: string;
  configCount: number;
  serviceCount: number;
  services: NcvServiceItem[];
}

export interface NcvAnalyzeRequest {
  filename: string;
  hostname: string;
  systemIp: string;
  configSummary: ConfigSummary;
}

export interface NcvTopologyNode {
  id: string;        // "router-a"
  label: string;
  type: 'device' | 'service';
  serviceType?: 'epipe' | 'vpls' | 'vprn' | 'ies';
}

export interface NcvTopologyEdge {
  from: string;
  to: string;
  label?: string;    // "epipe-100"
  serviceType?: string;
}

export interface NcvTopologyResponse {
  nodes: NcvTopologyNode[];
  edges: NcvTopologyEdge[];
  mermaid?: string;  // ?format=mermaid 요청 시
}
```

### 3.4 프론트엔드 동기화 훅 (`src/hooks/useConfigSync.ts`)

```typescript
// src/hooks/useConfigSync.ts

import { useEffect, useRef } from 'react';
import { buildConfigSummary } from '../utils/configSummaryBuilder';
import type { ParsedConfigV3 } from '../utils/v3/parserV3';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true';

/**
 * ParsedConfigV3[] 변경 시 백엔드 ConfigStore에 자동 동기화
 * Demo 모드에서는 비활성화
 */
export function useConfigSync(configs: ParsedConfigV3[]) {
  const prevFilenamesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (IS_DEMO || configs.length === 0) return;

    const currentFilenames = new Set(configs.map(c => c.filename ?? c.hostname));

    // 변경된 경우에만 동기화
    const hasChanges =
      currentFilenames.size !== prevFilenamesRef.current.size ||
      [...currentFilenames].some(f => !prevFilenamesRef.current.has(f));

    if (!hasChanges) return;

    prevFilenamesRef.current = currentFilenames;

    // 각 Config를 백엔드에 동기화 (fire-and-forget)
    const configSummary = buildConfigSummary(configs);
    const deviceMap = new Map(configs.map(c => [c.hostname, c]));

    for (const device of configSummary.devices) {
      const raw = deviceMap.get(device.hostname);
      const filename = raw?.filename ?? `${device.hostname}.txt`;

      fetch(`${API_BASE}/api/ncv/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          hostname: device.hostname,
          systemIp: device.systemIp,
          configSummary: { devices: [device] },
        } satisfies import('../../../server/src/types').NcvAnalyzeRequest),
      }).catch(() => {
        // 백엔드 미연결 시 조용히 무시 (선택 기능)
      });
    }
  }, [configs]);
}
```

**사용 위치**: `src/pages/V3Page.tsx`

```typescript
// V3Page.tsx 내부 (기존 parsedConfigs state 활용)
import { useConfigSync } from '../hooks/useConfigSync';

// 컴포넌트 내부
useConfigSync(parsedConfigs);  // 한 줄 추가로 동기화 활성화
```

---

## 4. Feature 2: MCP Server

### 4.1 의존성

```json
// server/package.json에 추가
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  }
}
```

### 4.2 MCP 도구 정의 (`server/src/services/mcpTools.ts`)

```typescript
// server/src/services/mcpTools.ts

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const NCV_MCP_TOOLS: Tool[] = [
  {
    name: 'get_services',
    description: '파싱된 Nokia Config에서 네트워크 서비스 목록을 조회합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['epipe', 'vpls', 'vprn', 'ies'],
          description: '서비스 타입 필터 (생략 시 전체)',
        },
        hostname: { type: 'string', description: '장비 hostname 필터' },
        query: { type: 'string', description: '설명/이름 키워드 검색' },
      },
    },
  },
  {
    name: 'get_service_detail',
    description: '특정 서비스의 상세 정보를 조회합니다.',
    inputSchema: {
      type: 'object',
      required: ['serviceKey'],
      properties: {
        serviceKey: {
          type: 'string',
          description: '서비스 키 (예: "epipe-100", "vpls-200", "vprn-300")',
        },
      },
    },
  },
  {
    name: 'get_topology',
    description: '서비스 토폴로지를 조회합니다. Mermaid 형식으로 시각화 가능.',
    inputSchema: {
      type: 'object',
      properties: {
        serviceKey: { type: 'string', description: '특정 서비스만 조회 (생략 시 전체)' },
        format: {
          type: 'string',
          enum: ['json', 'mermaid'],
          description: '반환 형식 (기본: json)',
        },
      },
    },
  },
  {
    name: 'search_config',
    description: '자연어 또는 키워드로 Config 내용을 검색합니다.',
    inputSchema: {
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string', description: '검색 쿼리 (키워드 또는 자연어)' },
        limit: { type: 'number', description: '최대 결과 수 (기본: 10)' },
      },
    },
  },
  {
    name: 'get_devices',
    description: '로드된 Nokia 장비 목록을 조회합니다.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_ha_pairs',
    description: 'HA(High Availability) Pair로 구성된 장비 쌍을 조회합니다.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'analyze_config',
    description: 'Nokia Config 텍스트를 직접 파싱합니다. (POST /api/ncv/analyze 연동)',
    inputSchema: {
      type: 'object',
      required: ['configText', 'filename'],
      properties: {
        configText: { type: 'string', description: '파싱할 Config 텍스트' },
        filename: { type: 'string', description: '파일명 (메타데이터용)' },
      },
    },
  },
];
```

### 4.3 MCP 서버 구현 (`server/src/mcp-server.ts`)

```typescript
// server/src/mcp-server.ts (stdio transport)

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { NCV_MCP_TOOLS } from './services/mcpTools';
import { configStore } from './services/configStore';

const server = new Server(
  { name: 'ncv-mcp-server', version: '4.8.0' },
  { capabilities: { tools: {} } }
);

// 도구 목록 반환
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: NCV_MCP_TOOLS,
}));

// 도구 실행
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'get_services': {
      const { type, hostname, query } = args as Record<string, string>;
      let services = configStore.getAllServices();
      if (type) services = services.filter(s => s.serviceType === type);
      if (hostname) services = services.filter(s => s.hostname === hostname);
      if (query) services = services.filter(s =>
        s.description?.toLowerCase().includes(query.toLowerCase()) ||
        s.serviceName?.toLowerCase().includes(query.toLowerCase())
      );
      return {
        content: [{ type: 'text', text: JSON.stringify(services, null, 2) }],
      };
    }

    case 'get_service_detail': {
      const { serviceKey } = args as { serviceKey: string };
      const all = configStore.getAllServices();
      const svc = all.find(s => s.selectionKey === serviceKey);
      if (!svc) {
        return { content: [{ type: 'text', text: `서비스를 찾을 수 없습니다: ${serviceKey}` }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(svc, null, 2) }] };
    }

    case 'get_devices': {
      const configs = configStore.getAll();
      const devices = configs.map(c => ({
        hostname: c.hostname,
        systemIp: c.systemIp,
        serviceCount: c.rawServiceCount,
        uploadedAt: c.uploadedAt,
      }));
      return { content: [{ type: 'text', text: JSON.stringify(devices, null, 2) }] };
    }

    case 'search_config': {
      const { query, limit = 10 } = args as { query: string; limit?: number };
      const results = configStore.searchServices(query).slice(0, limit as number);
      return {
        content: [{
          type: 'text',
          text: `검색어 "${query}"에 대한 결과 ${results.length}건:\n\n${JSON.stringify(results, null, 2)}`,
        }],
      };
    }

    case 'get_topology': {
      const configs = configStore.getAll();
      const nodes: Array<{ id: string; type: string }> = [];
      const edges: Array<{ from: string; to: string; label: string }> = [];

      for (const stored of configs) {
        for (const device of stored.configSummary.devices) {
          nodes.push({ id: device.hostname, type: 'device' });
          for (const svc of device.services) {
            const svcId = `${svc.serviceType}-${svc.serviceId}`;
            nodes.push({ id: svcId, type: svc.serviceType });
            edges.push({ from: device.hostname, to: svcId, label: svc.description });
          }
        }
      }

      return {
        content: [{ type: 'text', text: JSON.stringify({ nodes, edges }, null, 2) }],
      };
    }

    default:
      return { content: [{ type: 'text', text: `알 수 없는 도구: ${name}` }] };
  }
});

// stdio 전송으로 시작
const transport = new StdioServerTransport();
await server.connect(transport);
```

### 4.4 HTTP Transport (`server/src/index.ts`에 추가)

```typescript
// server/src/index.ts에 추가 (HTTP MCP 엔드포인트)

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

// MCP HTTP 엔드포인트 (웹 기반 클라이언트용)
app.all('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  // MCP 서버 인스턴스를 재활용 (별도 함수로 분리)
  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, req.body);
});
```

### 4.5 Claude Desktop 설정 (README-MCP.md)

```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "ncv": {
      "command": "node",
      "args": ["/path/to/nokia-config-visualizer/server/dist/mcp-server.js"],
      "env": {
        "AWS_REGION": "ap-northeast-2",
        "AWS_PROFILE": "default"
      }
    }
  }
}
```

---

## 5. Feature 3: RAG Indexing

### 5.1 의존성

```json
// server/package.json에 추가
{
  "dependencies": {
    "vectra": "^0.5.0",
    "@aws-sdk/client-bedrock-runtime": "^3.700.0"   // 기존 유지
  }
}
```

### 5.2 청크 빌더 (`server/src/services/chunkBuilder.ts`)

Config 서비스 데이터를 임베딩 가능한 텍스트로 변환합니다.

```typescript
// server/src/services/chunkBuilder.ts

import type { NcvServiceItem } from '../types';

export interface ConfigChunk {
  id: string;          // "hostname::selectionKey"
  text: string;        // 임베딩할 텍스트
  metadata: {
    hostname: string;
    serviceType: string;
    serviceId: number;
    selectionKey: string;
    description: string;
  };
}

export function buildChunks(
  services: NcvServiceItem[]
): ConfigChunk[] {
  return services.map(svc => {
    const parts: string[] = [
      `Device: ${svc.hostname} (${svc.systemIp})`,
      `Service: ${svc.serviceType} ${svc.serviceId}`,
      `Description: ${svc.description}`,
    ];

    if (svc.serviceName) parts.push(`Name: ${svc.serviceName}`);

    if (svc.saps && svc.saps.length > 0) {
      const sapText = svc.saps
        .map(s => `  SAP ${s.sapId}: ${s.description}, port ${s.portId}${s.ingressRate ? `, QoS ${s.ingressRate}/${s.egressRate}` : ''}`)
        .join('\n');
      parts.push(`SAPs:\n${sapText}`);
    }

    if (svc.interfaces && svc.interfaces.length > 0) {
      const intfText = svc.interfaces
        .map(i => `  ${i.name}: ${i.description || ''} ${i.ipAddress || ''}${i.ingressRate ? ` QoS ${i.ingressRate}/${i.egressRate}` : ''}`)
        .join('\n');
      parts.push(`Interfaces:\n${intfText}`);
    }

    if (svc.bgpNeighbors?.length) {
      parts.push(`BGP Neighbors: ${svc.bgpNeighbors.join(', ')}`);
    }

    if (svc.staticRoutes?.length) {
      parts.push(`Static Routes: ${svc.staticRoutes.join(', ')}`);
    }

    return {
      id: `${svc.hostname}::${svc.selectionKey}`,
      text: parts.join('\n'),
      metadata: {
        hostname: svc.hostname,
        serviceType: svc.serviceType,
        serviceId: svc.serviceId,
        selectionKey: svc.selectionKey,
        description: svc.description,
      },
    };
  });
}
```

### 5.3 임베딩 서비스 (`server/src/services/embeddingService.ts`)

```typescript
// server/src/services/embeddingService.ts

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { config } from '../config';

const client = new BedrockRuntimeClient({ region: config.aws.region });

const EMBEDDING_MODEL = 'amazon.titan-embed-text-v2:0';
const EMBEDDING_DIMENSION = 1024;

export { EMBEDDING_DIMENSION };

export async function getEmbedding(text: string): Promise<number[]> {
  const command = new InvokeModelCommand({
    modelId: EMBEDDING_MODEL,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({ inputText: text }),
  });

  const response = await client.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body)) as {
    embedding: number[];
  };

  return body.embedding;
}

export async function getEmbeddings(
  texts: string[],
  batchSize = 5
): Promise<number[][]> {
  const results: number[][] = [];

  // 배치 처리 (Bedrock 스로틀링 방지)
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(getEmbedding));
    results.push(...batchResults);

    // 배치 간 100ms 대기
    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}
```

### 5.4 RAG 인덱서 (`server/src/services/ragIndexer.ts`)

```typescript
// server/src/services/ragIndexer.ts

import { LocalIndex } from 'vectra';
import path from 'path';
import { buildChunks, type ConfigChunk } from './chunkBuilder';
import { getEmbeddings, EMBEDDING_DIMENSION } from './embeddingService';
import { configStore } from './configStore';

const INDEX_PATH = process.env.RAG_INDEX_PATH || path.join(process.cwd(), 'data', 'rag-index');

let index: LocalIndex | null = null;
let indexedAt: Date | null = null;

async function getIndex(): Promise<LocalIndex> {
  if (!index) {
    index = new LocalIndex(INDEX_PATH);
    if (!(await index.isIndexCreated())) {
      await index.createIndex({ version: 1, deleteIfExists: false });
    }
  }
  return index;
}

export async function buildIndex(): Promise<{ chunkCount: number; durationMs: number }> {
  const start = Date.now();
  const idx = await getIndex();

  // 기존 인덱스 재생성
  await idx.deleteIndex();
  await idx.createIndex({ version: 1, deleteIfExists: true });

  const services = configStore.getAllServices();
  const chunks = buildChunks(services);

  if (chunks.length === 0) {
    return { chunkCount: 0, durationMs: Date.now() - start };
  }

  // 배치 임베딩 생성
  const texts = chunks.map(c => c.text);
  const embeddings = await getEmbeddings(texts);

  // 인덱스에 삽입
  for (let i = 0; i < chunks.length; i++) {
    await idx.insertItem({
      vector: embeddings[i],
      metadata: chunks[i].metadata,
    });
  }

  indexedAt = new Date();
  return { chunkCount: chunks.length, durationMs: Date.now() - start };
}

export interface SearchResult {
  selectionKey: string;
  hostname: string;
  serviceType: string;
  description: string;
  score: number;
}

export async function semanticSearch(
  query: string,
  topK = 5
): Promise<SearchResult[]> {
  const idx = await getIndex();

  // 인덱스가 비어있으면 빈 배열 반환
  if (!(await idx.isIndexCreated())) return [];

  const { getEmbedding } = await import('./embeddingService');
  const queryVector = await getEmbedding(query);

  const results = await idx.queryItems(queryVector, topK);

  return results.map(r => ({
    selectionKey: (r.item.metadata as ConfigChunk['metadata']).selectionKey,
    hostname: (r.item.metadata as ConfigChunk['metadata']).hostname,
    serviceType: (r.item.metadata as ConfigChunk['metadata']).serviceType,
    description: (r.item.metadata as ConfigChunk['metadata']).description,
    score: r.score,
  }));
}

export function getIndexedAt(): Date | null {
  return indexedAt;
}
```

### 5.5 AI 챗봇 개선 (claudeClient.ts 수정)

```typescript
// server/src/services/claudeClient.ts 수정 내용

// 기존 askClaude 시그니처에 ragContext 파라미터 추가
export async function askClaude(
  message: string,
  configSummary: ConfigSummary,
  dictionary?: DictionaryCompact,
  filterType?: 'all' | 'epipe' | 'vpls' | 'vprn' | 'ies',
  ragContext?: string,          // 신규 추가
): Promise<ChatResponse> {
  // ...

  // RAG 컨텍스트 섹션 (있는 경우만)
  const ragSection = ragContext
    ? `\n\n## 관련 Config 컨텍스트 (RAG)\n\n${ragContext}`
    : '';

  const userContent = `## ConfigSummary ...
${dictionarySection}${filterSection}${ragSection}

## 사용자 질문
${message}`;
  // ...
}
```

### 5.6 NCV 라우터에 RAG 엔드포인트 추가

```typescript
// server/src/routes/ncv.ts에 추가

// POST /api/ncv/index — 인덱스 빌드 트리거
router.post('/index', async (req, res) => {
  const result = await buildIndex();
  res.json({ success: true, ...result });
});

// POST /api/ncv/semantic-search — 시맨틱 검색
router.post('/semantic-search', async (req, res) => {
  const { query, topK = 5 } = req.body;
  if (!query) return res.status(400).json({ error: 'query 필드가 필요합니다.' });
  const results = await semanticSearch(query, topK);
  res.json({ query, results, count: results.length });
});

// GET /api/ncv/index/status
router.get('/index/status', (req, res) => {
  res.json({
    indexedAt: getIndexedAt(),
    configCount: configStore.getStats().configCount,
    serviceCount: configStore.getStats().serviceCount,
  });
});
```

---

## 6. 구성 파일 변경 (`server/src/config.ts`)

```typescript
// 추가할 설정
export const config = {
  // ... 기존 설정 유지

  // NCV AI Platform 설정 (v4.8.0)
  rag: {
    indexPath: process.env.RAG_INDEX_PATH || path.join(process.cwd(), 'data', 'rag-index'),
    embeddingModel: process.env.EMBEDDING_MODEL || 'amazon.titan-embed-text-v2:0',
    embeddingDimension: 1024,
    maxChunksPerConfig: 500,
    batchSize: 5,
  },
} as const;
```

---

## 7. Docker 변경

```dockerfile
# Dockerfile (backend)에 추가
# RAG 인덱스 저장 경로 생성
RUN mkdir -p /app/data/rag-index
```

```yaml
# docker-compose.yml에 추가
services:
  api:
    volumes:
      - ./data/rag-index:/app/data/rag-index  # RAG 인덱스 영속성

    environment:
      - RAG_INDEX_PATH=/app/data/rag-index
      - EMBEDDING_MODEL=amazon.titan-embed-text-v2:0
```

---

## 8. 구현 순서 (Implementation Order)

```
Phase 1 — ConfigStore 기반 구축 (F1 필수)
  1. server/src/services/configStore.ts
  2. server/src/types.ts (NCV 타입 추가)
  3. server/src/routes/ncv.ts (5개 엔드포인트)
  4. server/src/index.ts (ncvRouter 등록)
  5. src/hooks/useConfigSync.ts
  6. src/pages/V3Page.tsx (useConfigSync 추가)
  → 테스트: curl + 브라우저에서 API 동작 확인

Phase 2 — MCP 서버 (F2)
  7. npm install @modelcontextprotocol/sdk
  8. server/src/services/mcpTools.ts
  9. server/src/mcp-server.ts
  10. server/src/index.ts (HTTP /mcp 엔드포인트)
  11. docs/README-MCP.md
  → 테스트: Claude Desktop MCP 연동

Phase 3 — RAG 인덱싱 (F3)
  12. npm install vectra
  13. server/src/services/chunkBuilder.ts
  14. server/src/services/embeddingService.ts
  15. server/src/services/ragIndexer.ts
  16. server/src/routes/ncv.ts (RAG 엔드포인트 추가)
  17. server/src/services/claudeClient.ts (ragContext 파라미터)
  → 테스트: POST /api/ncv/index → POST /api/ncv/semantic-search
```

---

## 9. 위험 요소 및 완화 (Risks & Mitigation)

| 위험 | 완화 방법 |
|------|---------|
| `useConfigSync`가 불필요한 POST 반복 | `useRef`로 이전 파일명 Set 추적, 변경 시에만 호출 |
| Bedrock 임베딩 비용 | Config 변경 시에만 재인덱싱, 청크 수 제한(500/Config) |
| `vectra` 성능 | 최대 1000 벡터 (2 Config × 500 청크), 로컬 파일로 충분 |
| MCP SDK 버전 불일치 | `^1.0.0` 명시, CLAUDE.md에 검증 버전 기록 |
| `ParsedConfigV3` 서버 이식 | `ConfigSummary`(기존 타입) 재활용으로 이식 불필요 |
| Config Store 메모리 누수 | Map 기반으로 중복 filename 자동 덮어쓰기 |

---

## 10. 테스트 계획

### Feature 1 (JSON API)
```bash
# 서비스 목록
curl http://localhost:3001/api/ncv/services | jq '.serviceCount'

# 타입 필터
curl "http://localhost:3001/api/ncv/services?type=epipe" | jq '.services | length'

# 검색
curl "http://localhost:3001/api/ncv/search?q=Customer-A" | jq '.results'

# 통계
curl http://localhost:3001/api/ncv/stats
```

### Feature 2 (MCP)
```bash
# HTTP transport 테스트
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

### Feature 3 (RAG)
```bash
# 인덱스 빌드
curl -X POST http://localhost:3001/api/ncv/index

# 시맨틱 검색
curl -X POST http://localhost:3001/api/ncv/semantic-search \
  -H "Content-Type: application/json" \
  -d '{"query":"customer 1001 L2 VPN 서비스"}'
```

---

## 11. 파일 변경 요약

### 신규 파일 (7개)
| 파일 | Feature |
|------|---------|
| `server/src/routes/ncv.ts` | F1 |
| `server/src/services/configStore.ts` | F1 |
| `server/src/services/mcpTools.ts` | F2 |
| `server/src/mcp-server.ts` | F2 |
| `server/src/services/chunkBuilder.ts` | F3 |
| `server/src/services/embeddingService.ts` | F3 |
| `server/src/services/ragIndexer.ts` | F3 |
| `src/hooks/useConfigSync.ts` | F1 |

### 수정 파일 (4개)
| 파일 | 변경 내용 |
|------|---------|
| `server/src/index.ts` | ncvRouter, /mcp 엔드포인트 등록 |
| `server/src/config.ts` | rag 설정 추가 |
| `server/src/types.ts` | NcvServiceItem 등 타입 추가 |
| `server/src/services/claudeClient.ts` | ragContext 파라미터 추가 |
| `src/pages/V3Page.tsx` | useConfigSync 훅 1줄 추가 |
| `server/package.json` | @modelcontextprotocol/sdk, vectra 추가 |

---

**Design 작성자**: Claude Sonnet 4.6 (Enterprise Team)
**검토자**: 사용자
**작성일**: 2026-02-21

## 변경 이력

### v1 (2026-02-21)
- 초기 Design 문서 작성
- 기존 서버 코드(claudeClient.ts, configSummaryBuilder.ts, fileWatcher.ts) 분석 기반
- ConfigSummary 타입 재활용 결정 (parserV3.ts 서버 이식 불필요)
- 3 Feature의 의존 관계와 구현 순서 정의
