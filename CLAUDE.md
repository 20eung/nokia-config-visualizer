# CLAUDE.md - Nokia Config Visualizer Project Context

> 이 문서는 Nokia Config Visualizer 프로젝트에 특화된 컨텍스트 문서입니다.
>
> **전역 지침**: `~/.claude/CLAUDE.md` 참조 (역할, 언어, 코딩 원칙, Docker/Git 연동)
>
> 이 문서는 프로젝트 특화 내용만 기술합니다.

## 프로젝트 개요

**Nokia Config Visualizer**는 Nokia 장비의 설정 파일(config)을 파싱하여 네트워크 토폴로지를 시각화하는 React + TypeScript 기반 웹 애플리케이션입니다.

### 핵심 목표
1. Nokia 장비 설정 파일(텍스트)을 구조화된 데이터로 파싱
2. Mermaid.js를 이용한 네트워크 다이어그램 생성
3. 물리적 연결(v1), 논리적 서비스(v2), 통합 뷰(v3) 지원
4. Grafana Diagram 패널과의 호환성 보장

### 기술 스택
- **Frontend**: React 19 + TypeScript
- **Build**: Vite
- **Visualization**: Mermaid.js
- **Styling**: Vanilla CSS (no CSS framework)
- **Icons**: Lucide React

## 핵심 구조

### 버전별 구조
- **v1.x**: 물리적 연결 토폴로지 (Base Router, Interface 중심)
- **v2.x**: MPLS L2/L3 VPN 서비스 토폴로지 (Epipe, VPLS, VPRN)
- **v3.x**: Unified Visualizer (v1 + v2 통합 + IES 서비스)

### 데이터 플로우
```
Config Upload → Parser → Data → Selection (수동/AI) → Topology Engine → Mermaid Generator → Diagram
```

### 주요 디렉토리
- **src/utils/**: Parser, Generator, Adapter (핵심 비즈니스 로직)
- **src/components/**: React UI 컴포넌트 (v2/, v3/ 버전별 분리)
- **src/pages/**: V1Page, V2Page, V3Page (버전별 메인 페이지)
- **server/**: Express 백엔드 (AI API, AWS Bedrock 통합)

## 주요 파일

### 1. Parser
- **nokiaParser.ts** (v1): 물리 인터페이스, Base Router 파싱 (hostname, IP, port, interface, static routes, VRRP)
- **v3/parserV3.ts** (v3): 통합 파서 (Epipe, VPLS, VPRN, IES, BGP, OSPF). 들여쓰기 기반 블록 파싱, 중복 블록 병합, 위치 기반 SAP 추출

### 2. Mermaid Generator
- **mermaidGenerator.ts** (v1/IES): 물리 토폴로지 다이어그램. Single/HA 다이어그램 지원
- **v3/mermaidGeneratorV3.ts** (v3): 서비스 중심 다이어그램 (Epipe, VPLS, VPRN). QoS 하이라이트, 라우팅 중간 노드, 멀티호스트 표시, Grafana 호환

### 3. Adapter
- **v1IESAdapter.ts**: IES 서비스 → v1 형식 변환하여 mermaidGenerator.ts로 다이어그램 생성

### 4. Topology Engine
- **TopologyEngine.ts**: HA Pair 자동 감지 (Static Route 기반 공통 Customer Network 탐지, VRRP Priority 비교)

### 5. AI 챗봇 (v4.0)
- **server/src/services/claudeClient.ts**: AWS Bedrock Converse API 호출
- **src/utils/configSummaryBuilder.ts**: ParsedConfigV3 → AI용 축약 JSON 변환
- **src/components/v3/AIChatPanel.tsx**: AI 토글, 자연어 입력, 응답 표시 UI

### 6. 이름 사전 (v4.1)
- **server/src/services/dictionaryStore.ts**: JSON 파일 읽기/쓰기
- **server/src/services/dictionaryGenerator.ts**: AI 자동 생성
- **src/components/v3/DictionaryEditor.tsx**: 편집 모달 UI

## 주요 기능 구현 위치

### Config 파싱
- **v1**: `nokiaParser.ts` → `parseNokiaConfig()`
- **v3**: `v3/parserV3.ts` → `parseNokiaConfigV3()`

### HA 감지
- **엔진**: `TopologyEngine.ts` (Static Route 기반, VRRP 기반)

### 다이어그램 생성
- **v1**: `mermaidGenerator.ts` (단일/HA)
- **v3**: `v3/mermaidGeneratorV3.ts` (Epipe, VPLS, VPRN, IES)

### 검색
- **수동**: `InterfaceList.tsx` (AND: ` + `, OR: 띄어쓰기)
- **AI**: `AIChatPanel.tsx` → `claudeClient.ts` → AWS Bedrock

## 개발 가이드

### 코드 작성 규칙
1. **TypeScript Strict**: `any` 사용 금지, 상세 인터페이스 정의
2. **타입 정의**: `types.ts` 중앙 집중화 (v2 전용은 `types/v2.ts`)
3. **컴포넌트**: React 함수형 컴포넌트 + Hooks
4. **스타일**: Vanilla CSS (CSS-in-JS 사용 안 함)
5. **모듈화**: 파싱 로직(`utils/`)과 UI(`components/`) 분리
6. **빌드 제약**: 프론트엔드는 정적 자산만 생성. AI 기능은 별도 Express 백엔드

### 디자인 & UX 원칙
- **UI 스타일**: 깔끔하고 전문적인 인터페이스
- **데스크톱 우선**: 복잡한 다이어그램 대상
- **피드백**: 업로드, 에러, 로딩 상태 명확히 표시

### 파서 작성 시 주의사항
Nokia Config는 들여쓰기 기반 구조. 정규식으로 블록 추출, 들여쓰기 레벨 추적, `exit` 키워드로 블록 종료 판단.

### Mermaid 코드 생성 시 주의사항
- 특수문자 이스케이프: `&`, `<`, `>`, `"`
- HTML 라벨은 Double Quote 사용
- Non-breaking space 사용 (줄바꿈 방지)
- CSS class 기반 스타일링 (inline style 불가)

**상세 규칙은 `DIAGRAM_RULES.md` 참조**

## 설정 및 버전 관리

### 환경변수 관리 (server/src/config.ts)

**모든 환경변수는 `server/src/config.ts`에서 중앙 집중식으로 관리**합니다.

#### 설정 변경 방법

1. **환경변수 우선순위**:
   ```
   docker-compose.yml 환경변수 > .env 파일 > config.ts 기본값
   ```

2. **모델 ID 변경 예시**:
   ```yaml
   # docker-compose.yml
   environment:
     - BEDROCK_MODEL_ID=global.anthropic.claude-sonnet-4-xxxxxx-v1:0
   ```

3. **기본값 변경**:
   ```typescript
   // server/src/config.ts
   bedrock: {
     modelId: process.env.BEDROCK_MODEL_ID || 'your-new-default-model-id',
   }
   ```

#### 관리되는 설정

- **AWS 설정**: region, profile
- **Bedrock 모델**: modelId (현재: `global.anthropic.claude-sonnet-4-20250514-v1:0`)
- **서버**: port, corsOrigin
- **Rate Limiting**: windowMs, maxRequests

### 버전 관리 (package.json)

**프로젝트 버전은 `package.json`의 `version` 필드에서 단일 소스로 관리**합니다.
웹 페이지에 표시되는 버전은 빌드 시점에 자동으로 주입됩니다.

#### 버전 형식

```
v{major}.{minor}.{patch}
예: v4.4.0, v4.4.1, v4.5.0
```

- **Major**: 큰 변경, 호환성이 깨지는 변경
- **Minor**: 새로운 기능 추가 (하위 호환 유지)
- **Patch**: 버그 수정, 작은 개선

#### 버전 변경 방법 (수동 관리 권장)

```bash
# Patch 버전 증가 (4.4.0 → 4.4.1)
npm run version:patch

# Minor 버전 증가 (4.4.0 → 4.5.0)
npm run version:minor

# Major 버전 증가 (4.4.0 → 5.0.0)
npm run version:major

# 변경사항 커밋
git add package.json
git commit -m "chore: Bump version to vX.X.X"
git push origin v4-development
```

#### 자동 버전 관리 (선택사항, 비권장)

Git hook을 활성화하면 **커밋 시마다 자동으로 patch 버전이 증가**합니다.

```bash
# 활성화
ln -s ../../scripts/auto-version.sh .git/hooks/pre-commit

# 비활성화
rm .git/hooks/pre-commit
```

⚠️ **주의**: 모든 커밋마다 버전이 증가하므로 일반적으로 권장하지 않습니다.

#### 버전 표시 위치

- **웹 페이지 헤더**: [src/pages/V3Page.tsx](src/pages/V3Page.tsx) - `v{__APP_VERSION__}`
- **이름 사전 모달**: [src/components/v3/DictionaryEditor.tsx](src/components/v3/DictionaryEditor.tsx) - `v{__APP_VERSION__}`
- **빌드 시 주입**: [vite.config.ts](vite.config.ts) - `__APP_VERSION__` 전역 변수

#### 상세 문서

- [VERSION_MANAGEMENT.md](VERSION_MANAGEMENT.md): 전체 버전 관리 가이드, 워크플로우, FAQ

## 테스트
- 표준 테스트 파일: `public/config1.txt`, `public/config2.txt`

## 프로젝트 특화 응답 스타일
- **톤**: 전문적이고 기술적인 어조 (네트워크 엔지니어링 배경 지식 필요)

## 참고 문서
- `README.md`: 사용자 대상 프로젝트 설명 및 빌드/배포 명령어
- `CHANGELOG.md`: 버전별 변경 이력
- `DIAGRAM_RULES.md`: 다이어그램 렌더링 규칙 상세
- `HOWTO-DOCKER.md`: Docker 빌드 및 배포 가이드
- [Mermaid.js 공식 문서](https://mermaid.js.org/)
- [Nokia 네트워크 장비 문서](https://documentation.nokia.com/)

## 브랜치 전략
- `main`: 프로덕션 코드 (v1.x)
- `v4-development`: v4 개발 (현재 활성)

## 최근 버전 히스토리

| 버전 | 날짜 | 주요 내용 |
|---|---|---|
| v3.2.0 | 2026-02-15 | QoS 하이라이트, VPRN 라우팅 노드, SAP 파싱 개선 |
| v4.0.0 | 2026-02-15 | AI 챗봇 서비스 검색, Express 백엔드 (AWS Bedrock) |
| v4.1.0 | 2026-02-16 | 이름 사전 (Name Dictionary), 전역 단일 사전, 테이블 정렬 |
| v4.3.0 | 2026-02-16 | Dictionary 구조 간소화 (6 fields → 2 fields), 마이그레이션 스크립트 |
| v4.4.0 | 2026-02-16 | 3-Field Dictionary (name, configKeywords, searchAliases), 양방향 검색 |
| v4.4.0+ | 2026-02-18 | 환경변수 중앙 관리 (config.ts), 동적 버전 관리 (package.json) |

상세 변경 이력은 `CHANGELOG.md` 참조.

---

**Last Updated**: 2026-02-18
**Current Version**: v4.4.0
**Branch**: v4-development
