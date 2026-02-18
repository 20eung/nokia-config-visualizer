/**
 * 중앙 집중식 환경변수 설정
 *
 * 모든 환경변수 기본값을 한 곳에서 관리합니다.
 * 모델 ID나 리전 변경 시 이 파일만 수정하면 됩니다.
 */

export const config = {
  // 서버 설정
  port: parseInt(process.env.PORT || '3000', 10),
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // AWS 설정
  aws: {
    region: process.env.AWS_REGION
      || process.env.AWS_DEFAULT_REGION
      || 'ap-northeast-2',
    profile: process.env.AWS_PROFILE || undefined,
  },

  // AWS Bedrock 설정
  bedrock: {
    // 모델 ID: docker-compose.yml 환경변수가 최우선
    // 환경변수가 없으면 이 기본값 사용
    modelId: process.env.BEDROCK_MODEL_ID
      || 'global.anthropic.claude-sonnet-4-20250514-v1:0',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: 60 * 1000, // 1분
    maxRequests: 30,
  },
} as const;
