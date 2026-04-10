# Plan: v4 AI Platform 기능 → v5 통합

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | v5는 최신 UI/보안 개선을 포함하지만 v4의 AI Platform(NCV API, MCP Server, RAG) 기능이 없어 외부 시스템 연동 및 AI 협업 기능 부재 |
| **Solution** | v5 브랜치를 베이스로 유지하면서 v4의 AI 백엔드 기능(8개 REST API, MCP 도구, ConfigStore)을 모듈화하여 이식 |
| **Function/UX Effect** | 외부 AI(Claude, Cursor)에서 MCP 프로토콜로 Nokia Config 데이터를 조회 가능하며, 프론트엔드는 기존 v5 Tailwind UI 유지로 사용자 경험 변화 없음 |
| **Core Value** | UI 현대화(v5) + AI 협업 미들웨어(v4) 통합으로 완전한 NOC 운영 플랫폼 구현, 향후 v5.4.0 릴리스 기반 마련 |

---

## 1. 배경 (Background)

### 1.1 현재 상황
- **v4-development**: AI Platform 기능 완성 (v4.8.2)
  - NCV REST API 8개 엔드포인트
  - MCP Server (Claude Desktop 연동)
  - ConfigStore (In-Memory 파싱 결과 저장)
  - RAG Indexing 준비
- **v5-development**: UI/보안 개선 완료 (v5.2.6)
  - Tailwind CSS v4 마이그레이션 (4,800줄 CSS 제거)
  - Dashboard + 사이트 그룹핑
  - CORS 제한, X-API-Key 인증, Rate Limiting
  - V1 레거시 코드 제거

### 1.2 해결해야 할 문제
1. **기술적 충돌**: v4의 CSS Modules vs v5의 Tailwind CSS
2. **보안 정책 차이**: v4는 CORS `*`, v5는 엄격한 origin 제한
3. **코드 베이스 분기**: 두 브랜치 간 18개 커밋 차이
4. **UI 일관성**: v4 AI Chat Panel이 v5 Tailwind 스타일과 충돌

### 1.3 기대 효과
- ✅ v5의 최신 UI/보안 유지
- ✅ v4의 AI 협업 기능 확보
- ✅ 외부 시스템(MCP, REST API) 연동 가능
- ✅ 단일 main 브랜치로 통합 → 유지보수 부담 감소

---

## 2. 목표 (Goals)

### 2.1 주요 목표
1. **v5를 베이스로 v4 AI 기능 이식**
   - v5의 Tailwind CSS, Dashboard, 보안 설정 유지
   - v4의 백엔드 AI 모듈만 선택적으로 복사

2. **백엔드 통합**
   - `/api/ncv` REST API 8개 엔드포인트
   - MCP Server (stdio, HTTP transport)
   - ConfigStore 싱글톤 서비스

3. **프론트엔드 최소 변경**
   - `useConfigSync` 훅 추가 (자동 백엔드 동기화)
   - AI Chat Panel은 v5 스타일로 재작성 없이 기존 유지
   - V3Page에 `useConfigSync(parsedConfigs)` 1줄 추가

4. **보안 정책 v5 기준 유지**
   - CORS origin 제한 유지
   - X-API-Key 인증 미들웨어 적용
   - Rate Limiting 유지

### 2.2 비목표 (Non-Goals)
- ❌ v4 CSS Modules 복원
- ❌ V1Page 레거시 코드 복구
- ❌ AI Chat Panel UI 전면 재작성 (기존 코드 유지)

---

## 3. 범위 (Scope)

### 3.1 포함 항목 (In Scope)

#### 백엔드 파일 (v4 → v5)
- `server/src/routes/ncv.ts` (NCV REST API)
- `server/src/services/configStore.ts` (In-Memory 저장소)
- `server/src/services/mcpTools.ts` (MCP 도구 정의)
- `server/src/mcp-server.ts` (MCP stdio 서버)
- `server/src/middleware/auth.ts` (이미 v5에 있음, 수정 필요)
- `server/src/index.ts` (ncv 라우터 추가, v5 보안 유지)

#### 프론트엔드 파일 (v4 → v5)
- `src/hooks/useConfigSync.ts` (백엔드 동기화 훅)
- `src/pages/V3Page.tsx` (useConfigSync 1줄 추가)

#### 의존성 (package.json 병합)
- v4 고유 의존성 없음 (기존 v5 의존성으로 충분)

### 3.2 제외 항목 (Out of Scope)
- V1Page 관련 파일 (v5에서 이미 제거)
- v4의 CSS Modules (Tailwind로 대체됨)
- RAG Indexer (v4에서 준비만 되어있고 미완성)

---

## 4. 제약사항 (Constraints)

### 4.1 기술적 제약
- **Git 브랜치 전략**: v5-development를 main으로 fast-forward
- **Breaking Change 최소화**: v5 사용자에게 영향 없도록
- **보안 정책**: v5의 엄격한 CORS/API Key 유지

### 4.2 시간 제약
- 목표: 4~6시간 내 완료
- Phase 1 (설정): 30분
- Phase 2 (이식): 2~3시간
- Phase 3 (테스트): 1~2시간

### 4.3 호환성 제약
- Node.js >= 18
- TypeScript ~5.9.3
- Docker Compose v2

---

## 5. 이해관계자 (Stakeholders)

### 5.1 Primary Stakeholders
- **NOC 운영자**: v5 UI 유지하면서 AI 기능 활용
- **개발자**: 통합 브랜치로 유지보수 부담 감소

### 5.2 Secondary Stakeholders
- **AI Agent 사용자**: Claude Desktop, Cursor 등에서 MCP 연동
- **외부 시스템**: REST API로 Nokia Config 데이터 조회

---

## 6. 위험 요소 (Risks)

| 위험 | 확률 | 영향 | 완화 전략 |
|------|------|------|----------|
| v5 보안 설정이 v4 API를 차단 | 중간 | 높음 | `/api/ncv`를 인증 화이트리스트에 추가 |
| AI Chat Panel이 Tailwind와 스타일 충돌 | 낮음 | 중간 | lazy import로 격리, 기존 스타일 유지 |
| MCP Server가 v5 환경에서 작동 안 함 | 낮음 | 중간 | 독립 실행 서버이므로 영향 없음 |
| 의존성 버전 충돌 | 낮음 | 낮음 | v4에 고유 의존성 없음 |

---

## 7. 성공 기준 (Success Criteria)

### 7.1 기능 검증
- [ ] `GET /api/ncv/services` 호출 시 서비스 목록 반환
- [ ] `GET /api/ncv/services/:key` 호출 시 상세 정보 반환
- [ ] `GET /api/ncv/topology` 호출 시 Mermaid 토폴로지 반환
- [ ] MCP Server 실행 시 7개 도구 정상 작동
- [ ] `useConfigSync` 훅이 config 로드 시 백엔드 동기화

### 7.2 UI/UX 검증
- [ ] Dashboard가 v5 스타일 그대로 표시
- [ ] 다크모드 토글 정상 작동
- [ ] Services 리스트가 Tailwind 스타일 유지
- [ ] AI Chat Panel이 기존 기능 유지 (스타일 충돌 없음)

### 7.3 보안 검증
- [ ] CORS origin 제한 작동 (허용된 도메인만)
- [ ] X-API-Key 없이 `/api/ncv` 호출 시 401 반환
- [ ] Rate Limiting 정상 작동 (초과 시 429)

### 7.4 성능 검증
- [ ] Config 로딩 속도 v5와 동일 (동기화로 인한 지연 < 100ms)
- [ ] Dashboard 렌더링 시간 변화 없음

---

## 8. 일정 (Timeline)

### Phase 1: 준비 (30분)
1. v5-development 체크아웃
2. v4-development에서 필요한 파일 식별
3. 디렉토리 구조 확인

### Phase 2: 백엔드 통합 (2시간)
1. `server/src/routes/ncv.ts` 복사 및 v5 보안 적용
2. `server/src/services/configStore.ts` 복사
3. `server/src/services/mcpTools.ts` 복사
4. `server/src/mcp-server.ts` 복사
5. `server/src/index.ts` 수정 (ncv 라우터 추가)
6. `server/package.json` 확인 (의존성 변화 없음)

### Phase 3: 프론트엔드 통합 (1시간)
1. `src/hooks/useConfigSync.ts` 복사
2. `src/pages/V3Page.tsx` 수정 (useConfigSync 추가)
3. AI Chat Panel 스타일 충돌 확인

### Phase 4: 테스트 및 검증 (1.5시간)
1. `npm run dev` 실행
2. Dashboard 확인
3. `/api/ncv/services` API 호출 테스트
4. MCP Server 실행 테스트
5. 보안 정책 검증

### Phase 5: 문서화 (30분)
1. CHANGELOG.md 업데이트 (v5.4.0)
2. README.md 업데이트 (AI Platform 섹션)

---

## 9. 의존성 (Dependencies)

### 9.1 기술 의존성
- v5-development 브랜치 안정성
- Git merge 도구
- Docker Compose 환경

### 9.2 외부 의존성
- 없음 (v4 AI 기능은 self-contained)

---

## 10. 다음 단계 (Next Steps)

1. **Design 문서 작성**: 파일별 상세 수정 내역
2. **Do 단계**: 실제 코드 이식 및 통합
3. **Check 단계**: Gap 분석 및 테스트
4. **Act 단계**: 필요 시 개선 반복
5. **Release**: v5.4.0 태그 및 배포

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| 2026-03-11 | 1.0 | 초안 작성 | Claude |
