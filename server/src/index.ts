import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import chatRouter from './routes/chat';
import dictionaryRouter from './routes/dictionary';
import configRouter from './routes/config';
import ncvRouter from './routes/ncv';
import { config } from './config';
import { setupWebSocket } from './services/websocket';
import { fileWatcher } from './services/fileWatcher';
import { NCV_MCP_TOOLS, mcpTextResult } from './services/mcpTools';
import { configStore } from './services/configStore';

const app = express();

// nginx 프록시 뒤에서 동작하므로 trust proxy 설정
app.set('trust proxy', 1);

// 미들웨어
app.use(helmet());
app.use(cors({
  origin: config.corsOrigin,
}));
app.use(express.json({ limit: '2mb' }));

// Rate limiting (AI 챗봇과 사전 API에만 적용)
app.use('/api/chat', rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: { error: '요청이 너무 많습니다. 1분 후 다시 시도해주세요.' },
  validate: { xForwardedForHeader: false },
}));

app.use('/api/dictionary', rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: { error: '요청이 너무 많습니다. 1분 후 다시 시도해주세요.' },
  validate: { xForwardedForHeader: false },
}));

// 라우트
app.use('/api', chatRouter);
app.use('/api', dictionaryRouter);
app.use('/api/config', configRouter); // Config 파일 다운로드는 Rate Limit 제외
app.use('/api/ncv', ncvRouter);       // NCV AI Platform API (v4.8.0)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    region: config.aws.region,
    model: config.bedrock.modelId,
  });
});

// ─────────────────────────────────────────────────────────
// MCP HTTP 엔드포인트 (v4.8.0)
// AI 에이전트가 HTTP로 NCV 도구를 직접 호출
// ─────────────────────────────────────────────────────────
app.all('/mcp', async (req, res) => {
  type McpRequest = { jsonrpc: string; id?: unknown; method: string; params?: Record<string, unknown> };
  const request = req.body as McpRequest;
  const { id, method, params = {} } = request;

  try {
    if (method === 'initialize') {
      res.json({
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'ncv-mcp-server', version: '4.8.0' },
        },
      });
    } else if (method === 'tools/list') {
      res.json({ jsonrpc: '2.0', id, result: { tools: NCV_MCP_TOOLS } });

    } else if (method === 'tools/call') {
      const toolName = (params['name'] as string | undefined) ?? '';
      const toolArgs = (params['arguments'] as Record<string, string> | undefined) ?? {};

      let result: ReturnType<typeof mcpTextResult>;
      switch (toolName) {
        case 'get_services': {
          let services = configStore.getAllServices();
          if (toolArgs['type']) services = services.filter(s => s.serviceType === toolArgs['type']);
          if (toolArgs['hostname']) services = services.filter(s => s.hostname.includes(toolArgs['hostname']!));
          if (toolArgs['query']) {
            const lower = toolArgs['query'].toLowerCase();
            services = services.filter(s =>
              (s.description ?? '').toLowerCase().includes(lower) ||
              (s.serviceName ?? '').toLowerCase().includes(lower)
            );
          }
          result = mcpTextResult(JSON.stringify(services, null, 2));
          break;
        }
        case 'get_service_detail': {
          const svc = configStore.getAllServices().find(s => s.selectionKey === toolArgs['serviceKey']);
          result = svc
            ? mcpTextResult(JSON.stringify(svc, null, 2))
            : mcpTextResult(`서비스를 찾을 수 없습니다: ${toolArgs['serviceKey'] ?? ''}`);
          break;
        }
        case 'get_devices': {
          const devices = configStore.getAll().map(c => ({
            hostname: c.hostname, systemIp: c.systemIp, serviceCount: c.serviceCount,
          }));
          result = mcpTextResult(JSON.stringify(devices, null, 2));
          break;
        }
        case 'search_config': {
          const results = configStore.searchServices(toolArgs['query'] ?? '');
          result = mcpTextResult(JSON.stringify(results, null, 2));
          break;
        }
        case 'get_stats': {
          result = mcpTextResult(JSON.stringify(configStore.getStats(), null, 2));
          break;
        }
        default:
          result = mcpTextResult(`알 수 없는 도구: ${toolName}`);
      }
      res.json({ jsonrpc: '2.0', id, result });
    } else {
      res.json({
        jsonrpc: '2.0', id,
        error: { code: -32601, message: `Unknown method: ${method}` },
      });
    }
  } catch (err: unknown) {
    res.status(500).json({
      jsonrpc: '2.0', id,
      error: { code: -32603, message: (err as Error).message },
    });
  }
});

// HTTP 서버 생성 (WebSocket 지원)
const server = http.createServer(app);

// WebSocket 서버 설정
setupWebSocket(server);

// File Watcher 자동 시작 (환경변수에서 경로 읽기)
const defaultWatchPath = process.env.WATCH_FOLDER_PATH || '/app/configs';
console.log(`[nokia-api] Default watch path: ${defaultWatchPath}`);

// 폴더가 존재하면 자동 감시 시작
import fs from 'fs';
if (fs.existsSync(defaultWatchPath)) {
  fileWatcher.startWatching(defaultWatchPath);
  console.log(`[nokia-api] Auto-started file watcher: ${defaultWatchPath}`);
} else {
  console.warn(`[nokia-api] Watch path does not exist: ${defaultWatchPath}`);
  console.warn(`[nokia-api] File watcher not started. Use POST /api/config/watch-folder to set path.`);
}

// 서버 시작
server.listen(config.port, '0.0.0.0', () => {
  console.log(`[nokia-api] Server running on port ${config.port}`);
  console.log(`[nokia-api] AWS Region: ${config.aws.region}`);
  console.log(`[nokia-api] Model: ${config.bedrock.modelId}`);
  console.log(`[nokia-api] WebSocket server: ws://localhost:${config.port}/ws`);
});
