/**
 * NCV AI Platform - REST API 라우터 (v4.8.0)
 *
 * Feature 1: Structured JSON Output
 * Feature 3: Semantic Search (RAG) 엔드포인트 포함
 */

import { Router, type Request, type Response } from 'express';
import { configStore } from '../services/configStore';
import type {
  NcvAnalyzeRequest,
  NcvAnalyzeResponse,
  NcvServicesResponse,
  NcvTopologyNode,
  NcvTopologyEdge,
  NcvTopologyResponse,
  NcvStatsResponse,
  NcvSemanticSearchRequest,
} from '../types';

const router = Router();

// ─────────────────────────────────────────────────────────
// Feature 1: Config 업로드 & 파싱 결과 저장
// ─────────────────────────────────────────────────────────

/**
 * POST /api/ncv/analyze
 * 프론트엔드에서 파싱한 ConfigSummary를 백엔드에 저장
 */
router.post('/analyze', (req: Request, res: Response): void => {
  try {
    const body = req.body as NcvAnalyzeRequest;

    if (!body.filename || !body.hostname || !body.configSummary) {
      res.status(400).json({ error: 'filename, hostname, configSummary 필드가 필요합니다.' });
      return;
    }

    const serviceCount = body.configSummary.devices.reduce(
      (sum, d) => sum + d.services.length, 0
    );

    configStore.set(body.filename, {
      filename: body.filename,
      hostname: body.hostname,
      systemIp: body.systemIp || '',
      configSummary: body.configSummary,
      serviceCount,
      uploadedAt: new Date(),
    });

    const response: NcvAnalyzeResponse = {
      success: true,
      filename: body.filename,
      hostname: body.hostname,
      serviceCount,
      uploadedAt: new Date().toISOString(),
    };
    res.json(response);
  } catch (err: unknown) {
    console.error('[POST /api/ncv/analyze] Error:', (err as Error).message);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ─────────────────────────────────────────────────────────
// Feature 1: 서비스 조회
// ─────────────────────────────────────────────────────────

/**
 * GET /api/ncv/services
 * 쿼리: ?type=epipe|vpls|vprn|ies  &hostname=  &q=
 */
router.get('/services', (req: Request, res: Response): void => {
  try {
    let services = configStore.getAllServices();

    const { type, hostname, q } = req.query as Record<string, string | undefined>;

    if (type && ['epipe', 'vpls', 'vprn', 'ies'].includes(type)) {
      services = services.filter(s => s.serviceType === type);
    }
    if (hostname) {
      services = services.filter(s => s.hostname.toLowerCase().includes(hostname.toLowerCase()));
    }
    if (q) {
      const lower = q.toLowerCase();
      services = services.filter(s =>
        (s.description ?? '').toLowerCase().includes(lower)
        || (s.serviceName ?? '').toLowerCase().includes(lower)
        || String(s.serviceId).includes(q)
        || s.serviceType.includes(lower)
      );
    }

    const stats = configStore.getStats();
    const response: NcvServicesResponse = {
      version: '4.8.0',
      timestamp: new Date().toISOString(),
      configCount: stats.configCount,
      serviceCount: services.length,
      services,
    };
    res.json(response);
  } catch (err: unknown) {
    console.error('[GET /api/ncv/services] Error:', (err as Error).message);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

/**
 * GET /api/ncv/services/:serviceKey
 * serviceKey 예: "epipe-100", "vpls-200", "vprn-300"
 */
router.get('/services/:serviceKey', (req: Request, res: Response): void => {
  try {
    const { serviceKey } = req.params;
    const all = configStore.getAllServices();
    const svc = all.find(s => s.selectionKey === serviceKey);

    if (!svc) {
      res.status(404).json({ error: `서비스를 찾을 수 없습니다: ${serviceKey}` });
      return;
    }

    res.json({ service: svc });
  } catch (err: unknown) {
    console.error('[GET /api/ncv/services/:key] Error:', (err as Error).message);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ─────────────────────────────────────────────────────────
// Feature 1: 토폴로지
// ─────────────────────────────────────────────────────────

/**
 * GET /api/ncv/topology
 * 쿼리: ?serviceKey=  &format=json|mermaid
 */
router.get('/topology', (req: Request, res: Response): void => {
  try {
    const { serviceKey, format } = req.query as Record<string, string | undefined>;
    const configs = configStore.getAll();

    const nodes: NcvTopologyNode[] = [];
    const edges: NcvTopologyEdge[] = [];
    const addedDevices = new Set<string>();

    for (const stored of configs) {
      for (const device of stored.configSummary.devices) {
        // serviceKey 필터 적용
        const services = serviceKey
          ? device.services.filter(s => s.selectionKey === serviceKey)
          : device.services;
        if (services.length === 0) continue;

        if (!addedDevices.has(device.hostname)) {
          nodes.push({
            id: device.hostname,
            label: device.hostname,
            type: 'device',
            systemIp: device.systemIp,
          });
          addedDevices.add(device.hostname);
        }

        for (const svc of services) {
          const svcNodeId = `${svc.serviceType}-${svc.serviceId}`;
          nodes.push({
            id: svcNodeId,
            label: `${svc.serviceType.toUpperCase()} ${svc.serviceId}`,
            type: svc.serviceType,
            serviceId: svc.serviceId,
          });
          edges.push({
            from: device.hostname,
            to: svcNodeId,
            label: svc.description || svc.selectionKey,
            serviceType: svc.serviceType,
          });
        }
      }
    }

    // Mermaid 형식 변환
    let mermaid: string | undefined;
    if (format === 'mermaid') {
      const lines = ['graph LR'];
      for (const n of nodes) {
        if (n.type === 'device') {
          lines.push(`  ${n.id.replace(/-/g, '_')}["${n.label}"]`);
        } else {
          lines.push(`  ${n.id.replace(/-/g, '_')}(["${n.label}"])`);
        }
      }
      for (const e of edges) {
        const from = e.from.replace(/-/g, '_');
        const to = e.to.replace(/-/g, '_');
        const label = e.label ? `|${e.label}|` : '';
        lines.push(`  ${from} -->${label} ${to}`);
      }
      mermaid = lines.join('\n');
    }

    const response: NcvTopologyResponse = { nodes, edges, ...(mermaid ? { mermaid } : {}) };
    res.json(response);
  } catch (err: unknown) {
    console.error('[GET /api/ncv/topology] Error:', (err as Error).message);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ─────────────────────────────────────────────────────────
// Feature 1: 장비 조회
// ─────────────────────────────────────────────────────────

/** GET /api/ncv/devices */
router.get('/devices', (req: Request, res: Response): void => {
  try {
    const configs = configStore.getAll();
    const devices = configs.map(c => ({
      hostname: c.hostname,
      systemIp: c.systemIp,
      serviceCount: c.serviceCount,
      uploadedAt: c.uploadedAt.toISOString(),
      indexedAt: c.indexedAt?.toISOString() ?? null,
    }));
    res.json({ devices });
  } catch (err: unknown) {
    console.error('[GET /api/ncv/devices] Error:', (err as Error).message);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ─────────────────────────────────────────────────────────
// Feature 1: 검색 & 내보내기
// ─────────────────────────────────────────────────────────

/** GET /api/ncv/search?q={query} */
router.get('/search', (req: Request, res: Response): void => {
  try {
    const q = req.query['q'] as string | undefined;
    if (!q) {
      res.status(400).json({ error: 'q 파라미터가 필요합니다.' });
      return;
    }
    const results = configStore.searchServices(q);
    res.json({ query: q, results, count: results.length });
  } catch (err: unknown) {
    console.error('[GET /api/ncv/search] Error:', (err as Error).message);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

/** GET /api/ncv/export?format=json|mermaid */
router.get('/export', (req: Request, res: Response): void => {
  try {
    const format = (req.query['format'] as string | undefined) ?? 'json';
    const configs = configStore.getAll();

    if (format === 'mermaid') {
      // 간단한 Mermaid 전체 export
      const lines = ['graph LR'];
      for (const c of configs) {
        for (const d of c.configSummary.devices) {
          for (const s of d.services) {
            const from = d.hostname.replace(/-/g, '_');
            const to = `${s.serviceType}_${s.serviceId}`;
            lines.push(`  ${from} --> ${to}["${s.serviceType.toUpperCase()} ${s.serviceId}"]`);
          }
        }
      }
      res.setHeader('Content-Type', 'text/plain');
      res.send(lines.join('\n'));
      return;
    }

    // JSON 형식
    const data = {
      version: '4.8.0',
      exportedAt: new Date().toISOString(),
      configs: configs.map(c => ({
        filename: c.filename,
        hostname: c.hostname,
        systemIp: c.systemIp,
        serviceCount: c.serviceCount,
        uploadedAt: c.uploadedAt.toISOString(),
        configSummary: c.configSummary,
      })),
    };
    res.json(data);
  } catch (err: unknown) {
    console.error('[GET /api/ncv/export] Error:', (err as Error).message);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

/** GET /api/ncv/stats */
router.get('/stats', (req: Request, res: Response): void => {
  try {
    // RAG 인덱싱 시간: 가장 최근 indexedAt
    const allConfigs = configStore.getAll();
    const indexedDates = allConfigs
      .filter(c => c.indexedAt)
      .map(c => c.indexedAt!.getTime());
    const lastIndexedAt = indexedDates.length > 0
      ? new Date(Math.max(...indexedDates)).toISOString()
      : null;

    const stats = configStore.getStats();
    const response: NcvStatsResponse = {
      configCount: stats.configCount,
      serviceCount: stats.serviceCount,
      lastUpdated: stats.lastUpdated?.toISOString() ?? null,
      indexedAt: lastIndexedAt,
    };
    res.json(response);
  } catch (err: unknown) {
    console.error('[GET /api/ncv/stats] Error:', (err as Error).message);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ─────────────────────────────────────────────────────────
// Feature 3: RAG 인덱싱 & 시맨틱 검색 (vectra 설치 필요)
// ─────────────────────────────────────────────────────────

/**
 * POST /api/ncv/index
 * vectra 인덱스 빌드 트리거 (Bedrock Titan Embeddings 사용)
 */
router.post('/index', async (req: Request, res: Response): Promise<void> => {
  try {
    // RAG 모듈은 선택적으로 로드 (vectra, embeddingService 설치 전에는 건너뜀)
    let buildIndex: (() => Promise<{ chunkCount: number; durationMs: number }>) | null = null;
    try {
      ({ buildIndex } = await import('../services/ragIndexer'));
    } catch {
      res.status(503).json({
        error: 'RAG 모듈이 설치되지 않았습니다. npm install vectra 를 실행하세요.',
      });
      return;
    }

    const result = await buildIndex();
    res.json({ success: true, ...result });
  } catch (err: unknown) {
    console.error('[POST /api/ncv/index] Error:', (err as Error).message);
    res.status(500).json({ error: '인덱싱 중 오류가 발생했습니다.' });
  }
});

/**
 * POST /api/ncv/semantic-search
 * Body: { query: string, topK?: number }
 */
router.post('/semantic-search', async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, topK = 5 } = req.body as NcvSemanticSearchRequest;
    if (!query) {
      res.status(400).json({ error: 'query 필드가 필요합니다.' });
      return;
    }

    let semanticSearch: ((q: string, k: number) => Promise<unknown[]>) | null = null;
    try {
      ({ semanticSearch } = await import('../services/ragIndexer'));
    } catch {
      res.status(503).json({
        error: 'RAG 모듈이 설치되지 않았습니다. npm install vectra 를 실행하세요.',
      });
      return;
    }

    const results = await semanticSearch(query, topK ?? 5);
    res.json({ query, results, count: results.length });
  } catch (err: unknown) {
    console.error('[POST /api/ncv/semantic-search] Error:', (err as Error).message);
    res.status(500).json({ error: '검색 중 오류가 발생했습니다.' });
  }
});

/** GET /api/ncv/index/status */
router.get('/index/status', (req: Request, res: Response): void => {
  try {
    const allConfigs = configStore.getAll();
    const indexedDates = allConfigs
      .filter(c => c.indexedAt)
      .map(c => c.indexedAt!.getTime());
    const indexedAt = indexedDates.length > 0
      ? new Date(Math.max(...indexedDates)).toISOString()
      : null;

    res.json({
      indexedAt,
      configCount: configStore.getStats().configCount,
      serviceCount: configStore.getStats().serviceCount,
    });
  } catch (err: unknown) {
    console.error('[GET /api/ncv/index/status] Error:', (err as Error).message);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

export default router;
