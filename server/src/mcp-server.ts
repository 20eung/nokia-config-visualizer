/**
 * NCV AI Platform - MCP 서버 진입점 (v4.8.0)
 *
 * stdio transport 방식으로 Claude Desktop, Cursor 등에서 직접 사용 가능.
 *
 * 실행 방법:
 *   node dist/mcp-server.js
 *
 * Claude Desktop 설정 (~/.config/claude/claude_desktop_config.json):
 * {
 *   "mcpServers": {
 *     "ncv": {
 *       "command": "node",
 *       "args": ["/path/to/server/dist/mcp-server.js"],
 *       "env": { "NCV_API_URL": "http://localhost:3001" }
 *     }
 *   }
 * }
 *
 * 요구사항: npm install @modelcontextprotocol/sdk
 */

import http from 'http';
import { NCV_MCP_TOOLS, mcpTextResult } from './services/mcpTools';

/** NCV HTTP API 기반 조회 (stdlib http 모듈 사용) */
const NCV_API = process.env['NCV_API_URL'] ?? 'http://localhost:3001';

function ncvGet(path: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const url = new URL(NCV_API + path);
    const options = {
      hostname: url.hostname,
      port: url.port || 3001,
      path: url.pathname + url.search,
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function ncvPost(path: string, body: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const url = new URL(NCV_API + path);
    const options = {
      hostname: url.hostname,
      port: url.port || 3001,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/** MCP 도구 실행 핸들러 */
async function handleToolCall(name: string, args: Record<string, string>): Promise<ReturnType<typeof mcpTextResult>> {
  switch (name) {
    case 'get_services': {
      const params = new URLSearchParams();
      if (args['type']) params.set('type', args['type']);
      if (args['hostname']) params.set('hostname', args['hostname']);
      if (args['query']) params.set('q', args['query']);
      const data = await ncvGet(`/api/ncv/services?${params.toString()}`);
      return mcpTextResult(JSON.stringify(data, null, 2));
    }

    case 'get_service_detail': {
      const data = await ncvGet(`/api/ncv/services/${encodeURIComponent(args['serviceKey'] ?? '')}`);
      return mcpTextResult(JSON.stringify(data, null, 2));
    }

    case 'get_topology': {
      const params = new URLSearchParams();
      if (args['serviceKey']) params.set('serviceKey', args['serviceKey']);
      if (args['format']) params.set('format', args['format']);
      const data = await ncvGet(`/api/ncv/topology?${params.toString()}`);
      return mcpTextResult(JSON.stringify(data, null, 2));
    }

    case 'search_config': {
      const limit = args['limit'] ?? '10';
      const data = await ncvGet(`/api/ncv/search?q=${encodeURIComponent(args['query'] ?? '')}&limit=${limit}`);
      return mcpTextResult(JSON.stringify(data, null, 2));
    }

    case 'get_devices': {
      const data = await ncvGet('/api/ncv/devices');
      return mcpTextResult(JSON.stringify(data, null, 2));
    }

    case 'get_stats': {
      const data = await ncvGet('/api/ncv/stats');
      return mcpTextResult(JSON.stringify(data, null, 2));
    }

    case 'get_ha_pairs': {
      // HA Pair 정보는 현재 topology에서 추출
      const data = await ncvGet('/api/ncv/devices');
      return mcpTextResult(`HA Pair 정보:\n${JSON.stringify(data, null, 2)}`);
    }

    default:
      return mcpTextResult(`알 수 없는 도구: ${name}`);
  }
}

/**
 * MCP JSON-RPC over stdio
 *
 * @modelcontextprotocol/sdk 없이도 작동하는 순수 구현.
 * SDK가 설치되어 있으면 아래 주석 처리된 SDK 버전으로 교체 권장.
 */
async function runStdioServer(): Promise<void> {
  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
    params: {},
  }) + '\n');

  const readline = await import('readline');
  const rl = readline.createInterface({ input: process.stdin });

  rl.on('line', async (line: string) => {
    let request: { jsonrpc: string; id?: unknown; method: string; params?: Record<string, unknown> };
    try {
      request = JSON.parse(line) as typeof request;
    } catch {
      return;
    }

    const { id, method, params = {} } = request;

    try {
      if (method === 'initialize') {
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0', id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'ncv-mcp-server', version: '4.8.0' },
          },
        }) + '\n');

      } else if (method === 'tools/list') {
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0', id,
          result: { tools: NCV_MCP_TOOLS },
        }) + '\n');

      } else if (method === 'tools/call') {
        const toolName = (params['name'] as string | undefined) ?? '';
        const toolArgs = (params['arguments'] as Record<string, string> | undefined) ?? {};
        const result = await handleToolCall(toolName, toolArgs);
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');

      } else {
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0', id,
          error: { code: -32601, message: `Unknown method: ${method}` },
        }) + '\n');
      }
    } catch (err: unknown) {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0', id,
        error: { code: -32603, message: (err as Error).message },
      }) + '\n');
    }
  });
}

runStdioServer().catch(console.error);
