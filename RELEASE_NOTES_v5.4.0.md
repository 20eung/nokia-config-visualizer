# Nokia Config Visualizer v5.4.0

## 🎉 v4 AI Platform + v5 UI/Security 통합 릴리스

v4-development 브랜치의 AI Platform 기능을 v5 베이스로 성공적으로 이식한 통합 버전입니다.
최신 UI/보안 개선사항과 AI 협업 기능을 모두 갖춘 완전한 NOC 운영 플랫폼입니다.

---

## ✨ 신규 기능

### 🤖 백엔드 AI Platform
#### NCV REST API (8개 엔드포인트)
- `POST /api/ncv/analyze` - Config 파싱 결과 백엔드 동기화
- `GET /api/ncv/services` - 서비스 목록 조회 (type/hostname/query 필터 지원)
- `GET /api/ncv/services/:key` - 서비스 상세 정보 조회
- `GET /api/ncv/topology` - 네트워크 토폴로지 생성 (JSON/Mermaid)
- `GET /api/ncv/devices` - 장비 목록 조회
- `GET /api/ncv/search` - 키워드 검색
- `GET /api/ncv/export` - 전체 데이터 내보내기
- `GET /api/ncv/stats` - 시스템 통계

**인증**: 모든 NCV 엔드포인트는 `X-API-Key` 헤더 필요 (v5 보안 정책 준수)

#### ConfigStore (In-Memory 저장소)
- 싱글톤 패턴 기반 파싱 결과 저장소
- 서비스 검색, 필터링, 통계 생성 기능
- 전체 Config 데이터를 메모리에서 고속 처리

#### MCP Server (Model Context Protocol)
- **HTTP MCP 엔드포인트**: `POST/GET /mcp`
- **독립 실행 서버**: `node server/dist/mcp-server.ts` (stdio)
- **7개 MCP 도구**:
  - `get_services` - 서비스 목록 조회
  - `get_service_detail` - 서비스 상세 정보
  - `get_topology` - 토폴로지 데이터
  - `search_config` - 키워드 검색
  - `get_devices` - 장비 정보
  - `get_stats` - 통계
  - `get_ha_pairs` - HA 페어 정보

**연동 가능 도구**: Claude Desktop, Cursor, 커스텀 AI 클라이언트

### 🎨 프론트엔드 통합
#### useConfigSync 훅
- Config 로드 시 백엔드 ConfigStore 자동 동기화
- `V3Page.tsx`에서 `useConfigSync(configs)` 1줄로 활성화
- Demo 모드 또는 백엔드 미연결 시 조용히 무시 (에러 없음)

---

## 🔧 기술 개선

### 보안
- ✅ v5 보안 정책 완전 유지
  - CORS origin 제한 (다중 도메인 지원)
  - X-API-Key 인증 미들웨어
  - Rate Limiting (글로벌 + API별)

### UI/UX
- ✅ v5 Tailwind CSS 완전 보존
- ✅ Dashboard (사이트별 카드 그리드)
- ✅ 다크모드 (Sun/Moon 토글)
- ✅ 반응형 레이아웃

### 빌드
- 프론트엔드: Vite + TypeScript (9.28초)
- 백엔드: TypeScript (즉시)
- 의존성 추가: `@types/html2canvas`

---

## 📊 통합 전후 비교

| 기능 | v4.8.2 | v5.3.1 | v5.4.0 (통합) |
|------|--------|--------|---------------|
| **UI 프레임워크** | CSS Modules | Tailwind CSS | ✅ Tailwind |
| **사이트별 Dashboard** | ❌ | ✅ | ✅ 유지 |
| **다크모드** | ❌ | ✅ | ✅ 유지 |
| **보안 정책** | CORS `*` | CORS 제한 + API Key | ✅ v5 유지 |
| **NCV REST API** | ✅ | ❌ | ✅ **추가** |
| **MCP Server** | ✅ | ❌ | ✅ **추가** |
| **ConfigStore** | ✅ | ❌ | ✅ **추가** |
| **useConfigSync** | ✅ | ❌ | ✅ **추가** |

---

## 🚀 사용 방법

### 1. NCV REST API 사용 예시
```bash
# Config 동기화
curl -X POST http://localhost:3001/api/ncv/analyze \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "router1.txt",
    "hostname": "PE-Router-1",
    "systemIp": "10.0.0.1",
    "configSummary": {"devices": [...]}
  }'

# 서비스 조회 (Epipe만)
curl http://localhost:3001/api/ncv/services?type=epipe \
  -H "X-API-Key: your-api-key"

# 토폴로지 조회
curl http://localhost:3001/api/ncv/topology \
  -H "X-API-Key: your-api-key"
```

### 2. MCP Server 연동 (Claude Desktop)
```json
// Claude Desktop 설정 (~/.config/claude/config.json)
{
  "mcpServers": {
    "nokia-config-visualizer": {
      "command": "node",
      "args": ["/path/to/nokia-visualizer/server/dist/mcp-server.js"]
    }
  }
}
```

### 3. 환경 변수 설정
```bash
# docker-compose.yml 또는 .env
API_KEY=your-secret-api-key
CORS_ORIGIN=https://ncv.example.com
AWS_REGION=ap-northeast-2
BEDROCK_MODEL_ID=anthropic.claude-sonnet-4-20250514-v1:0
```

---

## 📦 설치 및 실행

### Docker Compose (권장)
```bash
git clone https://github.com/20eung/mermaid-web.git
cd mermaid-web
git checkout v5.4.0
docker-compose up -d
```

### 로컬 개발
```bash
# 프론트엔드
npm install
npm run dev

# 백엔드
cd server
npm install
npm start
```

---

## 📚 문서

- **Plan 문서**: [docs/01-plan/features/v4-ai-integration.plan.md](docs/01-plan/features/v4-ai-integration.plan.md)
- **CHANGELOG**: [CHANGELOG.md](CHANGELOG.md)
- **README**: [README.md](README.md)

---

## 🔗 관련 링크

- **v4-development 브랜치**: [v4.8.2](https://github.com/20eung/mermaid-web/tree/v4-development)
- **v5-development 브랜치**: [v5.2.6](https://github.com/20eung/mermaid-web/tree/v5-development)
- **이전 릴리스**: [v5.3.1](https://github.com/20eung/mermaid-web/releases/tag/v5.3.1)

---

## 👥 기여자

- **통합 작업**: Claude Code with /pdca workflow
- **v4 AI Platform**: @20eung (v4-development)
- **v5 UI/Security**: @20eung (v5-development)

---

## 🎯 다음 계획 (v5.5.0)

- [ ] RAG Indexer 완성 (시맨틱 검색)
- [ ] Dashboard 위젯 커스터마이징
- [ ] Real-time WebSocket 동기화
- [ ] 다국어 지원 (i18n)

---

**Full Changelog**: https://github.com/20eung/mermaid-web/compare/v5.3.1...v5.4.0
