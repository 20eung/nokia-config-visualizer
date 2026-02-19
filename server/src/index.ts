import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import chatRouter from './routes/chat';
import dictionaryRouter from './routes/dictionary';
import configRouter from './routes/config';
import { config } from './config';
import { setupWebSocket } from './services/websocket';
import { fileWatcher } from './services/fileWatcher';

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

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    region: config.aws.region,
    model: config.bedrock.modelId,
  });
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
