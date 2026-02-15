import { Router, type Request, type Response } from 'express';
import { askClaude } from '../services/claudeClient';
import type { ChatRequest } from '../types';

const router = Router();

router.post('/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as ChatRequest;

    // 요청 검증
    if (!body.message || typeof body.message !== 'string') {
      res.status(400).json({ error: 'message 필드가 필요합니다.' });
      return;
    }
    if (!body.configSummary || !Array.isArray(body.configSummary.devices)) {
      res.status(400).json({ error: 'configSummary.devices 필드가 필요합니다.' });
      return;
    }
    if (body.message.length > 2000) {
      res.status(400).json({ error: '질문은 2000자 이내여야 합니다.' });
      return;
    }

    const result = await askClaude(body.message, body.configSummary);
    res.json(result);
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[POST /api/chat] Error:', error.message);

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

    // 모델 관련 오류
    if (error.name === 'ValidationException'
      || error.name === 'ModelNotReadyException') {
      res.status(503).json({
        error: 'Bedrock 모델에 접근할 수 없습니다. 모델 ID와 리전을 확인하세요.',
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

export default router;
