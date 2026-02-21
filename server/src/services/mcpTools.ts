/**
 * NCV AI Platform - MCP 도구 정의 (v4.8.0)
 *
 * NCV가 AI 에이전트에게 제공하는 7개 도구 스펙.
 * @modelcontextprotocol/sdk 설치 필요.
 */

/** MCP Tool 스펙 타입 (SDK 설치 전 로컬 정의) */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

export const NCV_MCP_TOOLS: McpTool[] = [
  {
    name: 'get_services',
    description: '파싱된 Nokia Config에서 네트워크 서비스 목록을 조회합니다. 서비스 타입, hostname, 키워드로 필터링 가능.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['epipe', 'vpls', 'vprn', 'ies'],
          description: '서비스 타입 필터 (생략 시 전체)',
        },
        hostname: {
          type: 'string',
          description: '장비 hostname 필터 (부분 일치)',
        },
        query: {
          type: 'string',
          description: '설명(description) 또는 이름(serviceName) 키워드 검색',
        },
      },
    },
  },
  {
    name: 'get_service_detail',
    description: '특정 서비스의 상세 정보(SAP, Interface, BGP, 라우팅 등)를 조회합니다.',
    inputSchema: {
      type: 'object',
      required: ['serviceKey'],
      properties: {
        serviceKey: {
          type: 'string',
          description: '서비스 키 (예: "epipe-100", "vpls-200", "vprn-300", "ies-400")',
        },
      },
    },
  },
  {
    name: 'get_topology',
    description: '서비스 토폴로지를 조회합니다. 장비-서비스 연결 관계를 JSON 또는 Mermaid 형식으로 반환.',
    inputSchema: {
      type: 'object',
      properties: {
        serviceKey: {
          type: 'string',
          description: '특정 서비스만 조회 (생략 시 전체 토폴로지)',
        },
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
    description: '키워드로 Config 내용을 검색합니다. description, serviceName, serviceId, hostname에서 검색.',
    inputSchema: {
      type: 'object',
      required: ['query'],
      properties: {
        query: {
          type: 'string',
          description: '검색 키워드 (예: "Customer-A", "epipe", "10.0.0.1")',
        },
        limit: {
          type: 'string',
          description: '최대 결과 수 (기본: 10)',
        },
      },
    },
  },
  {
    name: 'get_devices',
    description: '현재 로드된 Nokia 장비 목록을 조회합니다.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_stats',
    description: 'NCV 시스템 통계를 조회합니다. Config 수, 서비스 수, 마지막 업데이트 시간 등.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_ha_pairs',
    description: 'HA(High Availability) Pair로 구성된 장비 쌍을 조회합니다.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

/** 도구 실행 결과 헬퍼 */
export function mcpTextResult(text: string): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text }] };
}
