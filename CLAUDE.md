# CLAUDE.md - AI Assistant Context Document

> 이 문서는 AI 어시스턴트가 프로젝트를 이해하고 효과적으로 작업할 수 있도록 작성된 컨텍스트 문서입니다.

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

## 테스트
- 표준 테스트 파일: `public/config1.txt`, `public/config2.txt`

## 응답 스타일
- **언어**: 한국어 (Korean)
- **톤**: 전문적이고 기술적인 어조
- **코드 변경 시**: 변경 이유를 먼저 설명한 후 코드 제시

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

상세 변경 이력은 `CHANGELOG.md` 참조.

---

**Last Updated**: 2026-02-16
**Current Version**: v4.3.0
**Branch**: v4-development
