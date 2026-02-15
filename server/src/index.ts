import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import chatRouter from './routes/chat';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// 미들웨어
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
}));
app.use(express.json({ limit: '1mb' }));

// Rate limiting (분당 30회)
app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: '요청이 너무 많습니다. 1분 후 다시 시도해주세요.' },
}));

// 라우트
app.use('/api', chatRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    region: process.env.AWS_REGION
      || process.env.AWS_DEFAULT_REGION
      || 'ap-northeast-2',
    model: process.env.BEDROCK_MODEL_ID
      || 'apac.anthropic.claude-sonnet-4-20250514-v1:0',
  });
});

// 서버 시작
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[nokia-api] Server running on port ${PORT}`);
  console.log(`[nokia-api] AWS Region: ${process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-northeast-2'}`);
  console.log(`[nokia-api] Model: ${process.env.BEDROCK_MODEL_ID || 'apac.anthropic.claude-sonnet-4-20250514-v1:0'}`);
});
