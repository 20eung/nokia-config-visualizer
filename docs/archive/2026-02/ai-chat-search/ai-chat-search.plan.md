---
template: plan
version: 1.2
description: AI Chatbot Service Search and Diagram Visualization
variables:
  feature: ai-chat-search
  date: 2026-02-15
  author: Claude Code (AI Assistant)
  project: Nokia Config Visualizer
  version: v3.2.0
---

# AI Chatbot Service Search Planning Document

> **Summary**: Replace manual sidebar service selection with AI chatbot that understands natural language queries and automatically displays relevant diagrams using AWS Bedrock
>
> **Project**: Nokia Config Visualizer
> **Version**: v3.2.0
> **Branch**: v3-development
> **Author**: Claude Code (AI Assistant)
> **Date**: 2026-02-15
> **Status**: Draft

---

## 1. Overview

### 1.1 Purpose

현재 사용자는 사이드바에서 수동으로 서비스를 검색/선택하여 다이어그램을 표시합니다. 이 프로세스를 AI 챗봇으로 대체하여, 자연어 질문으로 관련 서비스를 찾고 다이어그램을 자동으로 표시하는 기능을 구현합니다.

**핵심 가치:**
- 사용자가 네트워크 구조를 자연어로 질문 → AI가 관련 서비스를 자동 검색 → 다이어그램 자동 표시
- 복잡한 Nokia Config 구조를 이해하지 못해도 자연어로 정보 탐색 가능
- 네트워크 엔지니어의 생산성 향상

### 1.2 Background

**현재 상태:**
- ✅ UI 컴포넌트: `AIChatPanel.tsx` 구현 완료
- ✅ API 클라이언트: `chatApi.ts` 구현 완료
- ✅ Config 요약: `configSummaryBuilder.ts` 구현 완료
- ✅ Backend API: `server/src/` 구현 완료 (Express + AWS Bedrock)
- ✅ AWS Bedrock 통합: `claudeClient.ts` 구현 완료
- ✅ 환경변수 지원: `~/.aws/credentials`, `~/.aws/config`, `$AWS_REGION`, `$AWS_PROFILE`, `$BEDROCK_MODEL_ID`

**개선 필요:**
- V3Page.tsx에 AIChatPanel 통합
- AI 응답 → 다이어그램 자동 표시 로직 개선
- 서버 배포 설정 (Docker Compose, Nginx 프록시)
- 환경변수 문서화 (`.env.example` 생성)
- System Prompt 개선 (더 정확한 서비스 매칭)
- 에러 핸들링 및 사용자 피드백 개선

### 1.3 Related Documents

- Requirements: 이 문서
- Technical Spec: `CLAUDE.md`, `DIAGRAM_RULES.md`
- References: [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)

---

## 2. Scope

### 2.1 In Scope

- [x] **AIChatPanel UI 구현** (완료)
  - 챗봇 토글 버튼
  - 입력창 (자연어 질문)
  - AI 응답 표시 (explanation, confidence, selectedKeys)
  - 로딩/에러 상태 표시

- [x] **Backend API 구현** (완료)
  - Express 서버 (`server/src/index.ts`)
  - `/api/chat` 엔드포인트
  - `/api/health` 엔드포인트
  - AWS Bedrock 클라이언트
  - Rate limiting (분당 30회)

- [x] **AWS Bedrock 통합** (완료)
  - `~/.aws/credentials` 지원
  - `~/.aws/config` 지원
  - `$AWS_REGION`, `$AWS_DEFAULT_REGION` 환경변수 지원
  - `$AWS_PROFILE` 환경변수 지원
  - `$BEDROCK_MODEL_ID` 환경변수로 모델 변경 가능

- [ ] **V3Page 통합**
  - AIChatPanel 컴포넌트 임베드
  - AI 응답 → 자동 서비스 선택
  - 자동 다이어그램 표시
  - 기존 사이드바와 병행 사용 가능

- [ ] **서버 배포 설정**
  - Docker Compose 설정 (프론트엔드 + 백엔드)
  - Nginx 리버스 프록시 설정 (`/api` → 백엔드)
  - 환경변수 문서화 (`.env.example`)

- [ ] **System Prompt 개선**
  - 서비스 매칭 정확도 향상
  - 필터 타입 추천 (epipe, vpls, vprn, ies)
  - 신뢰도(confidence) 판정 개선

- [ ] **에러 핸들링 개선**
  - AWS 자격 증명 오류 시 명확한 안내
  - Bedrock 접근 권한 오류 시 IAM 정책 안내
  - 네트워크 타임아웃 처리

### 2.2 Out of Scope

- 대화 히스토리 저장 (로컬 세션만)
- 멀티턴 대화 (현재는 단일 질문-응답만)
- 사용자 인증/권한 관리
- 다국어 지원 (한국어만)
- 다이어그램 편집 기능
- 다른 AI 모델 지원 (AWS Bedrock만)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | 사용자가 자연어로 네트워크 서비스 질문 가능 | High | 완료 |
| FR-02 | AI가 ConfigSummary를 분석하여 관련 서비스 선택 | High | 완료 |
| FR-03 | 선택된 서비스의 다이어그램 자동 표시 | High | 진행중 |
| FR-04 | 신뢰도(confidence: high/medium/low) 표시 | High | 완료 |
| FR-05 | 선택된 서비스 개수 표시 | High | 완료 |
| FR-06 | AI 응답 초기화 버튼 | Medium | 완료 |
| FR-07 | 로딩 상태 표시 (스피너 + 메시지) | Medium | 완료 |
| FR-08 | 에러 상태 표시 (명확한 오류 메시지) | High | 완료 |
| FR-09 | AWS 환경변수 지원 (Region, Profile, Model) | High | 완료 |
| FR-10 | Docker Compose로 프론트엔드+백엔드 통합 배포 | High | Pending |
| FR-11 | Nginx 리버스 프록시 설정 | High | Pending |
| FR-12 | 환경변수 예제 파일 (`.env.example`) 제공 | Medium | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Performance | AI 응답 시간 < 10초 | AWS Bedrock latency 측정 |
| Performance | 다이어그램 렌더링 < 2초 | Mermaid.js 렌더링 시간 측정 |
| Security | AWS 자격 증명 보안 저장 (~/.aws/) | AWS SDK Credential Chain |
| Security | Rate limiting (분당 30회) | Express rate-limit 미들웨어 |
| Security | CORS 설정 | Helmet + CORS 미들웨어 |
| Reliability | AWS Bedrock 연결 실패 시 재시도 | 에러 핸들링 + Health check |
| Usability | 명확한 에러 메시지 | 사용자 테스트 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [x] AIChatPanel UI 구현 완료
- [x] Backend API 구현 완료
- [x] AWS Bedrock 통합 완료
- [ ] V3Page에 AIChatPanel 통합
- [ ] AI 응답 → 자동 다이어그램 표시 동작 확인
- [ ] Docker Compose 설정 완료
- [ ] Nginx 리버스 프록시 설정 완료
- [ ] `.env.example` 문서 작성
- [ ] `public/config1.txt`, `config2.txt`로 기능 검증
- [ ] 코드 리뷰 완료
- [ ] 사용자 테스트 완료

### 4.2 Quality Criteria

- [ ] TypeScript 타입 에러 0개
- [ ] ESLint 에러 0개
- [ ] 빌드 성공 (프론트엔드 + 백엔드)
- [ ] Docker 컨테이너 정상 실행
- [ ] Health check 엔드포인트 정상 응답
- [ ] AI 응답 정확도 > 80% (수동 테스트)

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| AWS 자격 증명 설정 실패 | High | Medium | 명확한 에러 메시지 + 문서화 + Health check |
| Bedrock 모델 접근 권한 부족 | High | Medium | IAM 정책 예제 제공 + 에러 안내 |
| AI 응답 부정확 (잘못된 서비스 선택) | Medium | Medium | System Prompt 개선 + 신뢰도 표시 |
| API 타임아웃 (네트워크 지연) | Medium | Low | 타임아웃 60초 설정 + 재시도 로직 |
| Rate limiting으로 인한 요청 실패 | Low | Low | Rate limit 표시 + 적절한 제한 (분당 30회) |
| Docker Compose 설정 복잡도 | Medium | Low | 문서화 + 예제 제공 |

---

## 6. Architecture Considerations

### 6.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | Simple structure (`components/`, `lib/`, `types/`) | Static sites, portfolios, landing pages | ☐ |
| **Dynamic** | Feature-based modules, BaaS integration (bkend.ai) | Web apps with backend, SaaS MVPs, fullstack apps | ☐ |
| **Enterprise** | Strict layer separation, DI, microservices | High-traffic systems, complex architectures | ☑ |

**선택 이유**:
- 이미 복잡한 구조 (React frontend + Express backend + AWS Bedrock)
- 명확한 레이어 분리 (UI, API, Service, Infrastructure)
- 독립 배포 가능한 서비스 (Frontend, Backend)

### 6.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| Framework | Next.js / React / Vue | **React (Vite)** | 이미 React 19 + Vite로 구성됨 |
| State Management | Context / Zustand / Redux / Jotai | **React useState** | 간단한 로컬 상태만 필요 |
| API Client | fetch / axios / react-query | **fetch** | 네이티브 API, 충분한 기능 |
| Backend Framework | Express / Fastify / NestJS | **Express** | 이미 Express로 구성됨 |
| AI Model | AWS Bedrock / OpenAI / Anthropic | **AWS Bedrock** | 요구사항 명시 |
| Styling | Tailwind / CSS Modules / styled-components | **Vanilla CSS** | 이미 CSS 파일 사용 중 |
| Testing | Jest / Vitest / Playwright | **수동 테스트** | Starter 프로젝트 수준 |
| Deployment | Docker / Vercel / AWS | **Docker + Nginx** | 프론트+백엔드 통합 배포 |

### 6.3 Clean Architecture Approach

```
Selected Level: Enterprise

Current Folder Structure:
┌─────────────────────────────────────────────────┐
│ Frontend (React + TypeScript):                  │
│   src/components/      - UI 컴포넌트            │
│   src/services/        - API 클라이언트         │
│   src/utils/           - 비즈니스 로직          │
│   src/types/           - 타입 정의              │
│   src/pages/           - 페이지 컴포넌트        │
├─────────────────────────────────────────────────┤
│ Backend (Express + TypeScript):                 │
│   server/src/routes/   - Express 라우트         │
│   server/src/services/ - AWS Bedrock 클라이언트 │
│   server/src/prompts/  - System Prompt          │
│   server/src/types.ts  - 타입 정의              │
├─────────────────────────────────────────────────┤
│ Infrastructure:                                 │
│   docker-compose.yml   - 서비스 오케스트레이션  │
│   nginx.conf           - 리버스 프록시 설정     │
│   Dockerfile           - 컨테이너 이미지        │
└─────────────────────────────────────────────────┘
```

### 6.4 Data Flow

```
┌──────────────────────────────────────────────────────────┐
│                        User                              │
└──────────────────────────────────────────────────────────┘
                          │
                          │ 자연어 질문
                          ▼
┌──────────────────────────────────────────────────────────┐
│              AIChatPanel (React Component)               │
│  - 입력 처리                                              │
│  - 로딩/에러 상태 관리                                     │
│  - AI 응답 표시                                           │
└──────────────────────────────────────────────────────────┘
                          │
                          │ sendChatMessage()
                          ▼
┌──────────────────────────────────────────────────────────┐
│            chatApi.ts (Frontend API Client)              │
│  - fetch('/api/chat', POST)                              │
│  - 타임아웃 처리 (60초)                                    │
│  - 에러 핸들링                                            │
└──────────────────────────────────────────────────────────┘
                          │
                          │ HTTP POST /api/chat
                          ▼
┌──────────────────────────────────────────────────────────┐
│              Nginx Reverse Proxy                         │
│  - /api → Backend (포트 3000)                            │
│  - / → Frontend (포트 80)                                │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│         Express Server (server/src/index.ts)             │
│  - CORS, Helmet, Rate limiting                           │
│  - Request validation                                    │
└──────────────────────────────────────────────────────────┘
                          │
                          │ askClaude()
                          ▼
┌──────────────────────────────────────────────────────────┐
│    claudeClient.ts (AWS Bedrock Integration)             │
│  - BedrockRuntimeClient                                  │
│  - ConverseCommand                                       │
│  - System Prompt + ConfigSummary                         │
└──────────────────────────────────────────────────────────┘
                          │
                          │ AWS Bedrock API
                          ▼
┌──────────────────────────────────────────────────────────┐
│              AWS Bedrock (Claude Sonnet 4)               │
│  - 자연어 처리                                            │
│  - 서비스 매칭                                            │
│  - JSON 응답 생성                                         │
└──────────────────────────────────────────────────────────┘
                          │
                          │ ChatResponse
                          ▼
┌──────────────────────────────────────────────────────────┐
│                    V3Page.tsx                            │
│  - onAIResponse() 핸들러                                 │
│  - 자동 서비스 선택                                       │
│  - 다이어그램 자동 표시                                    │
└──────────────────────────────────────────────────────────┘
```

---

## 7. Convention Prerequisites

### 7.1 Existing Project Conventions

Check which conventions already exist in the project:

- [x] `CLAUDE.md` has coding conventions section
  - TypeScript Strict mode
  - React 함수형 컴포넌트 + Hooks
  - Vanilla CSS (no CSS-in-JS)
  - 모듈화 (UI와 로직 분리)
- [x] ESLint configuration (`.eslintrc.*`)
- [x] TypeScript configuration (`tsconfig.json`)
- [ ] `docs/01-plan/conventions.md` (없음 - 필요시 생성)
- [ ] Prettier configuration (`.prettierrc`) (없음 - 필요시 생성)

### 7.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| **Naming** | CLAUDE.md 참고 | Component명: PascalCase, file명: camelCase | High |
| **Folder structure** | 명확함 | components/, services/, utils/, types/ | High |
| **Import order** | 없음 | React → 외부 라이브러리 → 내부 모듈 | Low |
| **Environment variables** | 부분적 | `.env.example` 생성 필요 | High |
| **Error handling** | 부분적 | 통일된 에러 핸들링 패턴 | Medium |

### 7.3 Environment Variables Needed

#### Frontend (.env)
| Variable | Purpose | Scope | Default | To Be Created |
|----------|---------|-------|---------|:-------------:|
| `VITE_API_URL` | Backend API URL | Client | `/api` | ☑ (이미 설정됨) |

#### Backend (.env)
| Variable | Purpose | Scope | Default | To Be Created |
|----------|---------|-------|---------|:-------------:|
| `PORT` | 서버 포트 | Server | `3000` | ☐ |
| `AWS_REGION` | AWS 리전 | Server | `ap-northeast-2` | ☐ |
| `AWS_DEFAULT_REGION` | AWS 기본 리전 | Server | `ap-northeast-2` | ☐ |
| `AWS_PROFILE` | AWS 프로필 | Server | (optional) | ☐ |
| `BEDROCK_MODEL_ID` | Bedrock 모델 ID | Server | `apac.anthropic.claude-sonnet-4-20250514-v1:0` | ☐ |
| `CORS_ORIGIN` | CORS 허용 Origin | Server | `*` | ☐ |

#### Docker Compose (.env)
| Variable | Purpose | Scope | Default | To Be Created |
|----------|---------|-------|---------|:-------------:|
| `FRONTEND_PORT` | 프론트엔드 포트 | Docker | `3301` | ☐ |
| `BACKEND_PORT` | 백엔드 포트 | Docker | `3000` | ☐ |

**`.env.example` 파일 생성 필요**

### 7.4 Pipeline Integration

현재 프로젝트는 이미 v3.2.0으로 성숙한 단계이므로, 9-phase Development Pipeline은 사용하지 않습니다.

대신 PDCA 사이클을 사용합니다:
- Plan (현재 단계)
- Design (다음 단계: `ai-chat-search.design.md`)
- Do (구현)
- Check (Gap analysis)
- Act (개선)

---

## 8. Technical Specifications

### 8.1 AWS Bedrock Configuration

**Model**: Claude Sonnet 4 (APAC Region)
- Model ID: `apac.anthropic.claude-sonnet-4-20250514-v1:0`
- Max Tokens: 1024
- Temperature: 0.1 (정확도 우선)

**Credential Chain** (우선순위):
1. 환경변수 (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
2. `~/.aws/credentials` (프로필 지정 가능)
3. IAM Role (EC2, ECS 등)

**필요한 IAM 권한**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "arn:aws:bedrock:*::foundation-model/apac.anthropic.claude-sonnet-4-*"
    }
  ]
}
```

### 8.2 API Endpoints

#### POST /api/chat
**Request**:
```typescript
{
  message: string;        // 사용자 질문 (최대 2000자)
  configSummary: ConfigSummary;  // 파싱된 Config 요약
}
```

**Response (Success)**:
```typescript
{
  selectedKeys: string[];  // 선택된 서비스 키 (예: ["epipe-100", "vpls-200"])
  explanation: string;     // AI 응답 설명
  confidence: 'high' | 'medium' | 'low';  // 신뢰도
  filterType?: 'all' | 'epipe' | 'vpls' | 'vprn' | 'ies';  // 필터 타입
}
```

**Response (Error)**:
```typescript
{
  error: string;  // 오류 메시지
}
```

**Status Codes**:
- 200: 성공
- 400: 잘못된 요청 (validation 실패)
- 429: Rate limit 초과
- 500: 서버 오류
- 503: AWS Bedrock 연결 실패

#### GET /api/health
**Response**:
```typescript
{
  status: 'ok';
  region: string;  // AWS Region
  model: string;   // Bedrock Model ID
}
```

### 8.3 Docker Deployment

**docker-compose.yml 구조**:
```yaml
services:
  frontend:
    build: .
    ports:
      - "3301:80"
    depends_on:
      - backend

  backend:
    build: ./server
    ports:
      - "3000:3000"
    environment:
      - AWS_REGION=${AWS_REGION}
      - AWS_PROFILE=${AWS_PROFILE}
    volumes:
      - ~/.aws:/root/.aws:ro  # AWS credentials 마운트
```

**Nginx 프록시 설정**:
```nginx
location /api {
  proxy_pass http://backend:3000;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
}

location / {
  root /usr/share/nginx/html;
  try_files $uri /index.html;
}
```

---

## 9. Implementation Priority

### Phase 1 (High Priority)
1. V3Page에 AIChatPanel 통합
2. AI 응답 → 자동 다이어그램 표시 로직 구현
3. `.env.example` 파일 생성 및 문서화

### Phase 2 (Medium Priority)
4. Docker Compose 설정 완료
5. Nginx 리버스 프록시 설정
6. System Prompt 개선 (정확도 향상)

### Phase 3 (Low Priority)
7. 에러 핸들링 개선 (더 상세한 안내)
8. Health check 강화 (Bedrock 연결 상태)
9. 로깅 개선 (디버깅 용이성)

---

## 10. Next Steps

1. [ ] 이 Plan 문서 리뷰 및 승인
2. [ ] Design 문서 작성 (`ai-chat-search.design.md`)
   - V3Page 통합 상세 설계
   - 컴포넌트 구조
   - 상태 관리 설계
   - Docker/Nginx 설정 상세
3. [ ] Implementation 시작 (`/pdca do ai-chat-search`)
4. [ ] Gap Analysis (`/pdca analyze ai-chat-search`)
5. [ ] Completion Report (`/pdca report ai-chat-search`)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-02-15 | Initial draft - 현재 상태 분석 및 Plan 작성 | Claude Code |
