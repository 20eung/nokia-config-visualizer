import { Router, type Request, type Response } from 'express';
import { generateDictionaryEntries } from '../services/dictionaryGenerator';
import { loadDictionary, saveDictionary } from '../services/dictionaryStore';
import type { DictionaryGenerateRequest } from '../types';

const router = Router();

router.post('/dictionary/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as DictionaryGenerateRequest;

    // 요청 검증
    if (!body.descriptions || !Array.isArray(body.descriptions)) {
      res.status(400).json({ error: 'descriptions 배열이 필요합니다.' });
      return;
    }
    if (body.descriptions.length === 0) {
      res.status(400).json({ error: 'descriptions 배열이 비어있습니다.' });
      return;
    }
    if (body.descriptions.length > 2000) {
      res.status(400).json({ error: 'descriptions는 최대 2000개까지 허용됩니다.' });
      return;
    }

    const result = await generateDictionaryEntries(body.descriptions);
    res.json(result);
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[POST /api/dictionary/generate] Error:', error.message);

    // AWS 자격 증명 오류
    if (error.name === 'CredentialsProviderError'
      || error.name === 'ExpiredTokenException'
      || error.message?.includes('credentials')) {
      res.status(503).json({
        error: 'AWS 자격 증명을 확인해주세요. ~/.aws/credentials 또는 환경변수를 설정하세요.',
      });
      return;
    }

    // Bedrock 접근 권한 오류
    if (error.name === 'AccessDeniedException') {
      res.status(503).json({
        error: 'AWS Bedrock 접근 권한이 없습니다. IAM 정책을 확인하세요.',
      });
      return;
    }

    // 스로틀링
    if (error.name === 'ThrottlingException') {
      res.status(429).json({
        error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      });
      return;
    }

    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/dictionary — 사전 로드
router.get('/dictionary', (_req: Request, res: Response): void => {
  const data = loadDictionary();
  if (!data) {
    res.status(404).json({ error: '저장된 사전이 없습니다.' });
    return;
  }
  res.json(data);
});

// PUT /api/dictionary — 사전 저장
router.put('/dictionary', (req: Request, res: Response): void => {
  const body = req.body as unknown;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: '유효하지 않은 요청 본문입니다.' });
    return;
  }

  const ok = saveDictionary(body);
  if (!ok) {
    res.status(500).json({ error: '사전 저장에 실패했습니다.' });
    return;
  }

  res.json({ ok: true });
});

export default router;
