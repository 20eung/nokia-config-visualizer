# CLAUDE.md - AI Assistant Context Document

> 이 문서는 AI 어시스턴트가 프로젝트를 이해하고 효과적으로 작업할 수 있도록 작성된 컨텍스트 문서입니다.

## 📋 프로젝트 개요

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

## 🏗 아키텍처 구조

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
Nokia Parser (nokiaParser.ts / parserV3.ts)
    ↓
Structured Data (Interface, Service, Route 등)
    ↓
Topology Engine (HA Detection, Grouping)
    ↓
Mermaid Generator (mermaidGenerator.ts / mermaidGeneratorV3.ts)
    ↓
Mermaid Code String
    ↓
DiagramViewer Component
    ↓
Rendered Diagram (PNG/SVG Export)
```

## 📁 주요 디렉토리 구조

```
src/
├── components/              # React UI 컴포넌트
│   ├── ConfigSelector.tsx   # Config 파일 선택 드롭다운
│   ├── DiagramViewer.tsx    # Mermaid 다이어그램 렌더링 및 내보내기
│   ├── FileUpload.tsx       # 파일 업로드 UI
│   ├── FilePreviewModal.tsx # 업로드 파일 미리보기
│   └── InterfaceList.tsx    # 인터페이스 목록 (계층 구조)
│
├── utils/                   # 핵심 비즈니스 로직
│   ├── nokiaParser.ts       # v1 Nokia config 파서
│   ├── parserV3.ts          # v3 Nokia config 파서 (통합)
│   ├── mermaidGenerator.ts  # v1 Mermaid 다이어그램 생성
│   ├── mermaidGeneratorV3.ts # v3 Mermaid 다이어그램 생성
│   └── TopologyEngine.ts    # HA 감지 및 토폴로지 분석
│
├── types.ts                 # TypeScript 타입 정의
├── App.tsx                  # 메인 애플리케이션 컴포넌트
└── main.tsx                 # 진입점

public/
└── docs/                    # 데모용 Config 파일들
    ├── config.txt
    ├── config1.txt
    └── config2.txt
```

## 🔑 핵심 파일 설명

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

#### `src/utils/parserV3.ts` (v3)
- **목적**: v1 + v2 통합 파서 (IES 서비스 포함)
- **주요 함수**:
  - `parseNokiaConfigV3()`: 통합 파서
  - `parseServices()`: Epipe, VPLS, VPRN, IES 파싱
  - `parseBGPNeighbors()`: BGP 정보 추출
  - `parseOSPFAreas()`: OSPF 정보 추출
- **특징**:
  - 들여쓰기 기반 블록 파싱
  - 중복 블록 병합 (예: `vprn 3093`이 여러 곳에 정의된 경우)
  - IES 0을 Base Router 대용으로 사용

### 2. Mermaid Generator 계열

#### `src/utils/mermaidGenerator.ts` (v1)
- **목적**: 물리적 토폴로지 다이어그램 생성
- **다이어그램 타입**:
  - **Single Diagram**: 개별 인터페이스 다이어그램
  - **HA Diagram**: 이중화 구성 통합 다이어그램
- **노드 구조**:
  ```
  Local Host → Peer Device → Customer Network
  ```
- **라벨 정보**: Port, Interface, IP, QoS, VRRP VIP

#### `src/utils/mermaidGeneratorV3.ts` (v3)
- **목적**: 서비스 중심 토폴로지 다이어그램 생성
- **서비스 타입별 레이아웃**:
  - **Epipe**: Host A ↔ Service ↔ Host B
  - **VPLS**: 중앙 Service 노드 + 여러 Host 노드
  - **VPRN**: Host → Service (BGP/OSPF 정보 포함) → Network
  - **IES**: Local → Peer → Network (v1과 유사)
- **특징**:
  - BGP/OSPF 정보를 Service 노드 라벨에 통합
  - 서비스 타입별 색상 구분
  - Grafana Diagram 패널 호환 코드 생성

### 3. Topology Engine

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

### 4. React 컴포넌트

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

## 🎯 주요 기능 구현 위치

### 1. 파일 업로드
- **컴포넌트**: `FileUpload.tsx`, `FilePreviewModal.tsx`
- **처리**: 드래그 앤 드롭, 파일 선택, 여러 파일 동시 로드

### 2. Config 파싱
- **v1 물리**: `nokiaParser.ts` → `parseNokiaConfig()`
- **v3 통합**: `parserV3.ts` → `parseNokiaConfigV3()`
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
- **v3**: `mermaidGeneratorV3.ts`
  - `generateServiceDiagram()`: 서비스별 다이어그램
  - `generateIESDiagram()`: IES 서비스

### 5. 검색 기능
- **컴포넌트**: `InterfaceList.tsx`
- **AND 검색**: ` + ` 구분 (예: `BB3 + 210.211`)
- **OR 검색**: 띄어쓰기 구분 (예: `BB3 210.211`)
- **검색 필드**: hostname, port, portDescription, interfaceName, interfaceDescription, ipAddress, serviceDescription

### 6. Grafana 호환성
- **위치**: `mermaidGeneratorV3.ts`
- **보장 사항**:
  - Mermaid 문법 호환 (특수문자 이스케이프)
  - HTML 라벨 사용 시 quote 처리
  - Non-breaking space/hyphen 사용

## 🔧 개발 가이드

### 코드 작성 규칙

1. **TypeScript 사용**: 모든 파일은 `.ts` 또는 `.tsx`
2. **타입 정의**: `types.ts`에 중앙 집중화
3. **컴포넌트**: 함수형 컴포넌트 + Hooks
4. **스타일**: Vanilla CSS (CSS-in-JS 사용 안 함)

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
```

### 새로운 서비스 타입 추가 시

1. **타입 정의** (`types.ts`):
   ```typescript
   export interface NewService extends BaseService {
     serviceType: 'new-service';
     // 추가 필드
   }
   ```

2. **파서 추가** (`parserV3.ts`):
   ```typescript
   function parseNewService(content: string): NewService {
     // 파싱 로직
   }
   ```

3. **다이어그램 생성** (`mermaidGeneratorV3.ts`):
   ```typescript
   function generateNewServiceDiagram(service: NewService): string {
     // Mermaid 코드 생성
   }
   ```

## 🐛 디버깅 가이드

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

## 📚 참고 문서

### 프로젝트 내부 문서
- `README.md`: 사용자 대상 프로젝트 설명
- `CHANGELOG.md`: 버전별 변경 이력
- `V2_PLANNING.md`: v2 개발 계획
- `V2_TECHNICAL_SPEC.md`: v2 기술 명세
- `RELEASE_NOTES_*.md`: 버전별 릴리즈 노트

### 외부 참고
- [Mermaid.js 공식 문서](https://mermaid.js.org/)
- [Nokia 7750 SR 문서](https://documentation.nokia.com/)
- [React 공식 문서](https://react.dev/)
- [TypeScript 공식 문서](https://www.typescriptlang.org/)

## 🚀 배포

### 브랜치 전략
- `main`: 프로덕션 코드 (v1.x)
- `v2-development`: v2 개발
- `v3-development`: v3 개발 (현재 활성)

### 배포 환경
- **Production**: nokia.hub.sk-net.com (v1.x)
- **Production**: nokia2.hub.sk-net.com (v2.x)
- **Production**: nokia3.hub.sk-net.com (v3.x)
- **Internal**: nokia-int.hub.sk-net.com (v1.x)
- **Demo**: demo.hub.sk-net.com (v1.x, 샘플 config 포함)

### 빌드 및 배포
```bash
# 개발 서버
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 미리보기
npm run preview
```

## 💡 작업 시 체크리스트

새로운 기능 추가 시:
- [ ] 타입 정의 추가 (`types.ts`)
- [ ] 파서 로직 구현
- [ ] Mermaid 생성 로직 구현
- [ ] UI 컴포넌트 업데이트
- [ ] README.md 업데이트
- [ ] CHANGELOG.md 업데이트
- [ ] Grafana 호환성 확인

## 🎓 학습 경로

이 프로젝트를 처음 접하는 경우:

1. **기본 이해** (1-2시간)
   - README.md 읽기
   - 데모 사이트 직접 사용해보기
   - Config 파일 샘플 확인 (`public/docs/`)

2. **코드 탐색** (3-4시간)
   - `types.ts` 타입 구조 파악
   - `nokiaParser.ts` 파싱 로직 이해
   - `mermaidGenerator.ts` 다이어그램 생성 로직 파악

3. **실습** (5-10시간)
   - 새로운 Config 파일 테스트
   - 간단한 필드 추가 (예: description)
   - 새로운 다이어그램 스타일 적용

4. **고급** (10+ 시간)
   - 새로운 서비스 타입 추가
   - TopologyEngine 로직 개선
   - 성능 최적화

---

**Last Updated**: 2026-02-13
**Current Version**: v3.1.0
**Branch**: v3-development
