import { Request, Response, NextFunction } from 'express';

/**
 * API Key 인증 미들웨어
 * X-API-Key 헤더를 검증하여 인증되지 않은 요청을 차단합니다.
 * API_KEY 환경변수가 설정되지 않으면 인증을 건너뜁니다 (개발 환경).
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = process.env.API_KEY;

  // API_KEY 미설정 시 인증 건너뜀 (개발 환경)
  if (!apiKey) {
    next();
    return;
  }

  const providedKey = req.headers['x-api-key'] as string | undefined;

  if (!providedKey || providedKey !== apiKey) {
    res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
    return;
  }

  next();
}
