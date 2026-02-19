import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import chatRouter from './routes/chat';
import dictionaryRouter from './routes/dictionary';
import { config } from './config';

const app = express();

// nginx 프록시 뒤에서 동작하므로 trust proxy 설정
app.set('trust proxy', 1);

// 미들웨어
app.use(helmet());
app.use(cors({
  origin: config.corsOrigin,
}));
app.use(express.json({ limit: '2mb' }));

// Rate limiting
app.use('/api/', rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: { error: '요청이 너무 많습니다. 1분 후 다시 시도해주세요.' },
  validate: { xForwardedForHeader: false },
}));

// 라우트
app.use('/api', chatRouter);
app.use('/api', dictionaryRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    region: config.aws.region,
    model: config.bedrock.modelId,
  });
});

// 서버 시작
app.listen(config.port, '0.0.0.0', () => {
  console.log(`[nokia-api] Server running on port ${config.port}`);
  console.log(`[nokia-api] AWS Region: ${config.aws.region}`);
  console.log(`[nokia-api] Model: ${config.bedrock.modelId}`);
});
