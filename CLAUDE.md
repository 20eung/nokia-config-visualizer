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

## 아키텍처 구조

### 버전별 구조

```
프로젝트는 3가지 주요 버전으로 구성됩니다:
- v1.x: 물리적 연결 토폴로지 (Base Router, Interface 중심)
- v2.x: MPLS L2/L3 VPN 서비스 토폴로지 (Epipe, VPLS, VPRN)
- v3.x: Unified Visualizer (v1 + v2 통합 + IES 서비스)
```

### 데이터 플로우

```
Config File Upload
    ↓
Nokia Parser (nokiaParser.ts / v3/parserV3.ts)
    ↓
Structured Data (Interface, Service, Route 등)
    ↓
┌─────────────────────────────────────────┐
│  (A) 수동 선택                           │
│  ServiceListV3 → 체크박스/검색/HA 필터   │
├─────────────────────────────────────────┤
│  (B) AI 챗봇 검색 (v3.3)                │
│  AIChatPanel → configSummaryBuilder     │
│       ↓                                  │
│  POST /api/chat → Express → Bedrock     │
│       ↓                                  │
│  Claude 응답: selectedKeys              │
└─────────────────────────────────────────┘
    ↓
onSetSelected(selectedKeys)
    ↓
Topology Engine (HA Detection, Grouping)
    ↓
Mermaid Generator (mermaidGenerator.ts / v3/mermaidGeneratorV3.ts)
    ↓
Mermaid Code String
    ↓
DiagramViewer Component
    ↓
Rendered Diagram (PNG/SVG Export)
```

## 주요 디렉토리 구조

```
src/
├── components/              # React UI 컴포넌트
│   ├── ConfigSelector.tsx   # Config 파일 선택 드롭다운
│   ├── DiagramViewer.tsx    # Mermaid 다이어그램 렌더링 및 내보내기
│   ├── FileUpload.tsx       # 파일 업로드 UI
│   ├── FilePreviewModal.tsx # 업로드 파일 미리보기
│   ├── InterfaceList.tsx    # 인터페이스 목록 (계층 구조)
│   ├── v2/                  # v2 전용 컴포넌트
│   │   ├── ServiceDiagram.tsx  # v2 서비스 다이어그램
│   │   └── ServiceList.tsx     # v2 서비스 목록
│   └── v3/                  # v3 전용 컴포넌트
│       ├── ServiceListV3.tsx   # v3 서비스 목록
│       ├── AIChatPanel.tsx     # AI 챗봇 UI (토글, 입력, 응답)
│       └── AIChatPanel.css     # AI 챗봇 스타일
│
├── services/                # API 클라이언트
│   └── chatApi.ts           # AI 채팅 API (fetch /api/chat)
│
├── pages/                   # 페이지 컴포넌트
│   ├── V1Page.tsx / .css    # 물리 토폴로지 페이지
│   ├── V2Page.tsx / .css    # L2/L3 VPN 서비스 페이지
│   └── V3Page.tsx / .css    # 통합 시각화 페이지
│
├── utils/                   # 핵심 비즈니스 로직
│   ├── nokiaParser.ts       # v1 Nokia config 파서
│   ├── mermaidGenerator.ts  # v1 Mermaid 다이어그램 생성 (IES 포함)
│   ├── TopologyEngine.ts    # HA 감지 및 토폴로지 분석
│   ├── v1IESAdapter.ts      # IES 서비스 → v1 다이어그램 어댑터
│   ├── v1VPRNAdapter.ts     # VPRN 서비스 → v1 다이어그램 어댑터
│   ├── configSummaryBuilder.ts # ParsedConfigV3 → AI용 축약 JSON
│   ├── v2/                  # v2 전용 유틸리티
│   │   ├── index.ts         # v2 유틸리티 export
│   │   ├── l2vpnParser.ts   # L2/L3 VPN 파서
│   │   └── mermaidGeneratorV2.ts # v2 Mermaid 다이어그램 생성
│   └── v3/                  # v3 전용 유틸리티
│       ├── parserV3.ts      # v3 통합 파서
│       └── mermaidGeneratorV3.ts # v3 Mermaid 다이어그램 생성
│
├── types/                   # 버전별 타입 정의
│   └── v2.ts                # v2 TypeScript 타입
│
├── types.ts                 # 공통 TypeScript 타입 정의
├── App.tsx                  # 메인 애플리케이션 컴포넌트
├── App.css                  # 메인 앱 스타일
├── index.css                # 글로벌 CSS (QoS 하이라이트 등)
└── main.tsx                 # 진입점

public/
├── favicon.svg              # 사이트 파비콘
├── config1.txt              # 데모용 Config (nokia-1)
└── config2.txt              # 데모용 Config (nokia-2)

server/                      # Express 백엔드 (AI API)
├── package.json             # express, @aws-sdk/client-bedrock-runtime
├── tsconfig.json            # Node.js 타겟 TypeScript 설정
├── Dockerfile               # node:22-alpine 멀티 스테이지 빌드
└── src/
    ├── index.ts             # Express 앱 (CORS, rate-limit, 라우트)
    ├── routes/
    │   └── chat.ts          # POST /api/chat 핸들러
    ├── services/
    │   └── claudeClient.ts  # AWS Bedrock Converse API 래퍼
    ├── prompts/
    │   └── systemPrompt.ts  # Nokia config 분석 시스템 프롬프트
    └── types.ts             # ChatRequest, ChatResponse 타입
```

## 핵심 파일 설명

### 1. Parser 계열

#### `src/utils/nokiaParser.ts` (v1)
- **목적**: 물리적 인터페이스 및 Base Router 설정 파싱
- **주요 함수**:
  - `parseNokiaConfig()`: 메인 파서 함수
  - `parseInterfaces()`: 인터페이스 정보 추출
  - `parseStaticRoutes()`: Static Route 파싱
  - `parseVRRP()`: VRRP 설정 파싱
- **파싱 대상**:
  - System hostname, IP
  - Port 정보
  - Interface (IP, description, QoS)
  - Static routes
  - VRRP (priority, backup IP)

#### `src/utils/v3/parserV3.ts` (v3)
- **목적**: v1 + v2 통합 파서 (IES 서비스 포함)
- **주요 함수**:
  - `parseNokiaConfigV3()`: 통합 파서
  - `parseServices()`: Epipe, VPLS, VPRN, IES 파싱
  - `parseBGPNeighbors()`: BGP 정보 추출
  - `parseOSPFAreas()`: OSPF 정보 추출
  - `parseStaticRoutes()`: Static Route 추출 (VPRN 내부)
- **특징**:
  - 들여쓰기 기반 블록 파싱
  - 중복 블록 병합 (예: `vprn 3093`이 여러 곳에 정의된 경우)
  - IES 0을 Base Router 대용으로 사용
  - **위치 기반(position-based) SAP 추출**: regex lookahead 대신 `sap` 키워드 위치를 찾아 블록 단위로 추출 (v3.2.0)
  - SAP adminState 판정: SAP 자체의 `exit` 이전 텍스트만 검사하여 `no shutdown` / `shutdown` 구분
  - QoS Rate 파싱: `sap-ingress`/`sap-egress` 정책에서 rate 값 추출, KMG 단위 변환

### 2. Mermaid Generator 계열

#### `src/utils/mermaidGenerator.ts` (v1 / IES)
- **목적**: 물리적 토폴로지 및 IES 서비스 다이어그램 생성
- **다이어그램 타입**:
  - **Single Diagram**: 개별 인터페이스 다이어그램
  - **HA Diagram**: 이중화 구성 통합 다이어그램
- **노드 구조**:
  ```
  Local Host → Peer Device → Customer Network
  ```
- **라벨 정보**: Port, Interface, IP, QoS, VRRP VIP

#### `src/utils/v3/mermaidGeneratorV3.ts` (v3)
- **목적**: 서비스 중심 토폴로지 다이어그램 생성
- **서비스 타입별 레이아웃**:
  - **Epipe**: Host A ↔ Service ↔ Host B
  - **VPLS**: 중앙 Service 노드 + 여러 Host 노드
  - **VPRN**: Host → Routing Middle Nodes (BGP/OSPF/STATIC) → Service Node (v3.2.0)
  - **IES**: v1IESAdapter를 통해 v1 다이어그램으로 위임
- **주요 기능** (v3.2.0):
  - **QoS 색상 하이라이트**: `qosHighlight()` 헬퍼로 `<span class='qos-hl'>` 적용 (녹색 배경 + 흰색 글자)
  - **VPRN 라우팅 중간 노드**: BGP/OSPF/STATIC 정보를 서비스 노드에서 분리하여 독립 노드로 렌더링
  - **멀티호스트 Name/Desc**: 호스트별 값이 다를 경우 헤더 + 들여쓰기 목록 형식 표시
  - **Shutdown 필터링**: adminState='down' 항목을 다이어그램에서 자동 제외
  - 서비스 타입별 색상 구분
  - Grafana Diagram 패널 호환 코드 생성

### 3. Adapter 계열

#### `src/utils/v1IESAdapter.ts`
- **목적**: v3 파서의 IES 서비스 데이터를 v1 형식으로 변환하여 `mermaidGenerator.ts`로 다이어그램 생성
- **기능**:
  - IES 인터페이스 → v1 Interface 구조 변환
  - 단일/HA 다이어그램 생성
  - 타이틀 규칙: `{hostname}: {description}` (구분자 `: `)
  - Description 우선순위: Interface Desc > Port Desc > Interface Name

#### `src/utils/v1VPRNAdapter.ts`
- **목적**: v3 파서의 VPRN 서비스 데이터를 v1 형식으로 변환 (레거시, v3.2.0부터 VPRN은 네이티브 렌더링)

### 4. Topology Engine

#### `src/utils/TopologyEngine.ts`
- **목적**: HA Pair 자동 감지 및 토폴로지 분석
- **주요 기능**:
  - **동적 HA 감지**: Static Route 기반 공통 Customer Network 탐지
  - **VRRP 기반 HA**: Priority 비교하여 Master/Backup 판별
  - **관계 분석**: 인터페이스 간 연결 관계 추론
- **알고리즘**:
  ```typescript
  1. 모든 인터페이스의 relatedRoutes(Static Route) 수집
  2. 공통 Customer Network가 있는지 비교
  3. 공통 네트워크가 있으면 HA Pair로 그룹화
  4. VRRP 정보로 Master/Backup 결정
  ```

### 5. AI 채팅 계열 (v3.3)

#### `server/src/services/claudeClient.ts`
- **목적**: AWS Bedrock Converse API를 통한 Claude 호출
- **주요 함수**:
  - `askClaude()`: ConfigSummary + 질문 → Claude 호출 → selectedKeys 반환
  - `checkBedrockAccess()`: Bedrock 연결 확인
- **특징**:
  - AWS credential chain (env vars → ~/.aws/credentials → IAM Role)
  - 응답 JSON 파싱 및 selectionKey 유효성 검증
  - 모델 ID: `BEDROCK_MODEL_ID` 환경변수로 변경 가능

#### `src/utils/configSummaryBuilder.ts`
- **목적**: ParsedConfigV3[]를 AI에 전달할 축약 JSON으로 변환
- **주요 함수**: `buildConfigSummary(configs: ParsedConfigV3[]): ConfigSummary`
- **특징**:
  - QoS Rate KMG 변환 (kbps → 100M, 1G 등)
  - adminState='down' 서비스/인터페이스 자동 제외
  - selectionKey 사전 계산 (ServiceListV3와 동일한 키 형식)

#### `src/components/v3/AIChatPanel.tsx`
- **목적**: AI 토글 + 자연어 입력 + 응답 표시 UI
- **기능**:
  - AI 토글 버튼 (Bot 아이콘)
  - 입력 필드 (Enter 전송)
  - 로딩 스피너, 응답 패널 (confidence 배지), 에러 표시
  - AbortController로 요청 취소 지원

#### `src/services/chatApi.ts`
- **목적**: 프론트엔드 → Express 백엔드 API 클라이언트
- **주요 함수**:
  - `sendChatMessage()`: POST /api/chat (60초 타임아웃)
  - `checkApiHealth()`: GET /api/health

### 5-1. 이름 사전 계열 (v4.1)

#### `server/src/services/dictionaryStore.ts`
- **목적**: 이름 사전 JSON 파일 읽기/쓰기
- **주요 함수**:
  - `loadDictionary(fingerprint)`: 파일에서 사전 로드 (없으면 null)
  - `saveDictionary(fingerprint, data)`: JSON 파일 저장
- **특징**:
  - 저장 경로: `DICT_DATA_DIR` 환경변수 또는 `/app/data/dictionaries`
  - fingerprint 검증: `/^[a-z0-9-]+$/` (path traversal 방지)

#### `server/src/services/dictionaryGenerator.ts`
- **목적**: AWS Bedrock를 통한 이름 사전 AI 자동 생성
- **주요 함수**: `generateDictionaryEntries(descriptions)`: description 목록 → 엔트리 배열

#### `src/utils/dictionaryStorage.ts`
- **목적**: config fingerprint 생성 및 사전 변환 유틸리티
- **주요 함수**:
  - `getConfigFingerprint(configs)`: hostname + serviceId 기반 해시
  - `createEmptyDictionary(fingerprint)`: 빈 사전 생성
  - `toDictionaryCompact(dict)`: AI 전송용 압축 변환

#### `src/services/dictionaryApi.ts`
- **목적**: 사전 관련 API 클라이언트
- **주요 함수**:
  - `generateDictionary(descriptions, signal)`: AI 자동 생성 요청
  - `loadDictionaryFromServer(fingerprint)`: 서버에서 사전 로드
  - `saveDictionaryToServer(fingerprint, dictionary)`: 서버에 사전 저장

#### `src/components/v3/DictionaryEditor.tsx`
- **목적**: 이름 사전 편집 모달 UI
- **기능**: AI 자동 생성, 항목 추가/수정/삭제, 카테고리 분류, 별칭 관리

### 6. React 컴포넌트

#### `src/pages/V3Page.tsx`
- **목적**: v3 통합 시각화 메인 페이지
- **기능**:
  - 서비스 타입별 다이어그램 렌더링 (Epipe, VPLS, VPRN, IES)
  - Service Group 헤더 표시 (IES 제외)
  - 선택된 인터페이스/서비스에 따라 동적 다이어그램 생성

#### `src/components/v3/ServiceListV3.tsx`
- **목적**: 서비스 목록 + AI 채팅 통합
- **AI 관련 기능**:
  - `aiEnabled` 상태로 AI/기존검색 토글
  - `configSummary` useMemo 메모이제이션
  - `handleAIResponse()`: AI 응답의 selectedKeys → onSetSelected 연동
  - AI 토글 OFF 시 기존 검색 input 표시

#### `src/components/InterfaceList.tsx`
- **목적**: 좌측 사이드바 인터페이스 리스트
- **기능**:
  - 장비별 계층 구조 (접기/펼치기)
  - 체크박스 선택
  - 스마트 필터: All / 이중화 / None
  - 검색 (AND/OR)
- **상태 관리**: `expandedHosts` (접힌 상태 추적)

#### `src/components/DiagramViewer.tsx`
- **목적**: Mermaid 다이어그램 렌더링 및 제어
- **기능**:
  - Mermaid 코드 렌더링
  - 확대/축소 (Zoom)
  - PNG/SVG 다운로드
  - Mermaid 코드 보기/복사
- **라이브러리**:
  - `mermaid` (렌더링)
  - `html-to-image` (PNG/SVG export)

## 주요 기능 구현 위치

### 1. 파일 업로드
- **컴포넌트**: `FileUpload.tsx`, `FilePreviewModal.tsx`
- **처리**: 드래그 앤 드롭, 파일 선택, 여러 파일 동시 로드

### 2. Config 파싱
- **v1 물리**: `nokiaParser.ts` → `parseNokiaConfig()`
- **v3 통합**: `v3/parserV3.ts` → `parseNokiaConfigV3()`
- **데이터 구조**: `types.ts` (Interface, Service, ParsedConfig 등)

### 3. HA 감지
- **엔진**: `TopologyEngine.ts`
- **트리거**:
  - 사용자가 여러 인터페이스 선택
  - "이중화" 버튼 클릭
- **로직**:
  - Static Route 기반: `relatedRoutes` 비교
  - VRRP 기반: `vrrp.backup` (VIP) 및 `vrrp.priority` 비교

### 4. 다이어그램 생성
- **v1**: `mermaidGenerator.ts`
  - `generateSingleDiagram()`: 단일 인터페이스
  - `generateHADiagram()`: HA 통합
- **v3**: `v3/mermaidGeneratorV3.ts`
  - `generateServiceDiagram()`: Epipe, VPLS, VPRN 서비스 다이어그램
  - IES: `v1IESAdapter.ts` → `mermaidGenerator.ts`로 위임

### 5. 검색 기능
- **컴포넌트**: `InterfaceList.tsx`
- **AND 검색**: ` + ` 구분 (예: `nokia-1 + 172.16`)
- **OR 검색**: 띄어쓰기 구분 (예: `nokia-1 172.16`)
- **검색 필드**: hostname, port, portDescription, interfaceName, interfaceDescription, ipAddress, serviceDescription

### 6. AI 챗봇 검색 (v3.3)
- **프론트엔드**: `AIChatPanel.tsx` → `configSummaryBuilder.ts` → `chatApi.ts`
- **백엔드**: `server/src/routes/chat.ts` → `claudeClient.ts` → AWS Bedrock
- **연동**: AI 응답의 `selectedKeys` → `onSetSelected()` → 기존 다이어그램 자동 생성
- **토글**: AI 토글 OFF 시 기존 텍스트 검색 그대로 동작

### 7. Grafana 호환성
- **위치**: `v3/mermaidGeneratorV3.ts`
- **보장 사항**:
  - Mermaid 문법 호환 (특수문자 이스케이프)
  - HTML 라벨 사용 시 quote 처리
  - Non-breaking space/hyphen 사용

## 개발 가이드

### 코드 작성 규칙

1. **TypeScript Strict**: 모든 파일은 `.ts` 또는 `.tsx`. `any` 사용 금지. 모든 데이터 구조에 상세 인터페이스 정의.
2. **타입 정의**: `types.ts`에 중앙 집중화 (v2 전용은 `types/v2.ts`)
3. **컴포넌트**: React 함수형 컴포넌트 + Hooks (useState, useEffect, useMemo 등)
4. **스타일**: Vanilla CSS (CSS-in-JS 사용 안 함)
5. **모듈화**: 컴포넌트는 작고 집중적으로. 파싱 로직(`utils/`)과 UI 컴포넌트(`components/`)를 분리.
6. **빌드 제약**: 프론트엔드 빌드는 정적 자산(static assets)만 생성. AI 챗봇 기능은 별도 Express 백엔드(`server/`)에서 처리. 프론트엔드는 `/api/*` 경로로 백엔드와 통신.

### 디자인 & UX 원칙

- **UI 스타일**: 깔끔하고 전문적인 인터페이스. 미묘한 그림자, 둥근 모서리, 부드러운 전환 효과 사용.
- **데스크톱 우선**: 복잡한 다이어그램을 다루므로 데스크톱이 주요 타겟. 반응형 레이아웃 지원.
- **사용자 피드백**: 업로드, 에러, 로딩 상태에 대한 명확한 시각적 피드백 제공.

### 파서 작성 시 주의사항

```typescript
// Nokia Config는 들여쓰기 기반 구조
// 예시:
configure
    router Base
        interface "test"
            address 10.0.0.1/24
            exit
        exit
    exit

// 파싱 시:
// 1. 정규식으로 블록 추출
// 2. 들여쓰기 레벨 추적
// 3. exit 키워드로 블록 종료 판단
```

### Mermaid 코드 생성 시 주의사항

```typescript
// 1. 특수문자 이스케이프
const escapeLabel = (text: string) => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

// 2. HTML 라벨 사용 시 Double Quote
// ✅ 올바름
lines.push(`A["<div style=\"text-align: left\">Content</div>"]`);
// ❌ 잘못됨
lines.push(`A['<div style='text-align: left'>Content</div>']`);

// 3. Non-breaking space 사용 (줄바꿈 방지)
const nbsp = '\u00A0'; // Non-breaking space
const label = `Port:${nbsp}1/1/1`;

// 4. Mermaid DOMPurify 제약 사항
// ⚠️ inline style 속성은 Mermaid가 strip함 (securityLevel: 'loose'여도 동일)
// ✅ CSS class 기반으로 스타일링 (index.css에 정의)
const qosHighlight = (text: string) => `<span class='qos-hl'>${text}</span>`;
// ❌ inline style 사용 불가
const bad = (text: string) => `<span style='color:red'>${text}</span>`;
```

### 새로운 서비스 타입 추가 시

1. **타입 정의** (`types.ts`):
   ```typescript
   export interface NewService extends BaseService {
     serviceType: 'new-service';
     // 추가 필드
   }
   ```

2. **파서 추가** (`v3/parserV3.ts`):
   ```typescript
   function parseNewService(content: string): NewService {
     // 파싱 로직
   }
   ```

3. **다이어그램 생성** (`v3/mermaidGeneratorV3.ts`):
   ```typescript
   function generateNewServiceDiagram(service: NewService): string {
     // Mermaid 코드 생성
   }
   ```

## 디버깅 가이드

### 파싱 실패 시

1. **Console 로그 확인**: Parser에 `console.log()` 추가
2. **Config 파일 검증**:
   - 인코딩 확인 (UTF-8)
   - Carriage return 제거 (`\r`)
   - `exit` 키워드 누락 여부
3. **정규식 테스트**: [regex101.com](https://regex101.com) 사용

### Mermaid 렌더링 실패 시

1. **Mermaid Code 보기**: 다이어그램의 `<>` 버튼 클릭
2. **Mermaid Live Editor 테스트**: https://mermaid.live
3. **특수문자 이스케이프 확인**: `&`, `<`, `>`, `"` 등
4. **노드 ID 중복 확인**: 같은 ID를 가진 노드가 있는지 확인
5. **CSS class 확인**: `index.css`의 `.qos-hl` 등 클래스가 정상 로드되는지 확인

### HA 감지 안 될 때

1. **Static Route 파싱 확인**:
   ```typescript
   console.log('Interface relatedRoutes:', interface.relatedRoutes);
   ```
2. **VRRP 설정 확인**:
   ```typescript
   console.log('VRRP:', interface.vrrp);
   ```
3. **TopologyEngine 로그**: `detectHAPairs()` 함수에 로그 추가

## 테스트

### 표준 테스트 파일
- 기능 검증 시 `public/config1.txt` 및 `public/config2.txt` 파일을 사용한다.
- 테스트 수행 시 사용자 입력을 기다리지 않고, 해당 파일로 즉시 검증을 진행한다.

## 응답 스타일

- **언어**: 한국어 (Korean)
- **톤**: 전문적이고 기술적인 어조
- **코드 변경 시**: 변경 이유를 먼저 설명한 후 코드를 제시

## 참고 문서

### 프로젝트 내부 문서
- `README.md`: 사용자 대상 프로젝트 설명
- `CHANGELOG.md`: 버전별 변경 이력
- `DIAGRAM_RULES.md`: 다이어그램 렌더링 규칙 (템플릿, 들여쓰기, QoS 색상 등)
- `HOWTO-DOCKER.md`: Docker 빌드 및 배포 가이드
- `docs/v2/V2_PLANNING.md`: v2 개발 계획
- `docs/v2/V2_TECHNICAL_SPEC.md`: v2 기술 명세
- `docs/release-notes/`: 버전별 릴리즈 노트

### 외부 참고
- [Mermaid.js 공식 문서](https://mermaid.js.org/)
- [Nokia 네트워크 장비 문서](https://documentation.nokia.com/)
- [React 공식 문서](https://react.dev/)
- [TypeScript 공식 문서](https://www.typescriptlang.org/)

## 배포

### 브랜치 전략
- `main`: 프로덕션 코드 (v1.x)
- `v1-development`: v1 유지보수 개발
- `v2-development`: v2 개발
- `v3-development`: v3 개발
- `v4-development`: v4 개발 (현재 활성)

### 빌드 및 배포
```bash
# 개발 서버 (프론트엔드)
npm run dev

# 개발 서버 (백엔드)
cd server && npm run dev

# 프로덕션 빌드
npm run build

# Docker Compose 빌드 및 실행 (프론트엔드 + 백엔드)
docker compose up -d --build

# 컨테이너 로그 확인
docker compose logs -f

# Health check
curl http://localhost:3301/api/health
```

## 작업 시 체크리스트

새로운 기능 추가 시:
- [ ] 타입 정의 추가 (`types.ts`)
- [ ] 파서 로직 구현
- [ ] Mermaid 생성 로직 구현
- [ ] UI 컴포넌트 업데이트
- [ ] DIAGRAM_RULES.md 업데이트
- [ ] CHANGELOG.md 업데이트
- [ ] Grafana 호환성 확인

## 버전 히스토리

| 버전 | 날짜 | 주요 내용 |
|---|---|---|
| v1.4.0 | 2025-12-15 | Dynamic HA 감지 |
| v1.5.0 | 2025-12-15 | Mermaid Code Viewer UX |
| v1.6.0 | 2025-12-15 | Interface 목록 계층 구조 |
| v1.7.0 | 2025-12-15 | VRRP VIP, Master 표시 |
| v1.8.0 | 2025-12-17 | VRRP 기반 HA 감지 |
| v3.0.0 | 2026-01-21 | Unified Visualizer (Base/IES 통합) |
| v3.1.0 | 2026-01-21 | BGP/OSPF 고급 시각화, UI 개선 |
| v3.2.0 | 2026-02-15 | QoS 하이라이트, VPRN 라우팅 노드, SAP 파싱 개선 |
| v4.0.0 | 2026-02-15 | AI 챗봇 서비스 검색, Express 백엔드 (AWS Bedrock) |
| v4.1.0 | 2026-02-16 | 이름 사전 (Name Dictionary), 전역 단일 사전, 테이블 정렬, 중복 정리 |

상세 변경 이력은 `CHANGELOG.md` 참조.

---

**Last Updated**: 2026-02-16
**Current Version**: v4.1.0
**Branch**: v4-development
