# 변경 이력 (Changelog)

이 프로젝트의 모든 주요 변경 사항은 이 파일에 문서화됩니다.

이 형식은 [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)를 기반으로 하며,
이 프로젝트는 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)을 준수합니다.


## [3.3.0] - 2026-02-15

### 🚀 주요 변경 사항 (Major Changes)
- **AI 챗봇 서비스 검색**: 자연어 질문으로 네트워크 서비스를 검색하고 다이어그램을 자동 표시하는 AI 기능 추가
  - AWS Bedrock (Claude) 기반 자연어 처리
  - "Epipe 서비스 보여줘", "Customer-A 관련 서비스", "QoS 1G 이상 서비스 찾아줘" 등 한국어/영어 질문 지원
  - 기존 다이어그램 생성 로직 100% 재사용 (AI가 selectionKey를 반환하면 기존 onSetSelected()로 연동)
- **Express 백엔드 추가**: AI 기능을 위한 Node.js Express 서버를 별도 Docker 컨테이너로 추가
  - nginx에서 `/api/*` 요청을 Express 서버로 프록시
  - 백엔드 장애 시에도 프론트엔드(다이어그램 기능) 정상 동작

### ✨ 새로운 기능 (New Features)
- **AI 토글 검색**: 서비스 목록의 검색창에 AI 토글 버튼 추가 (Bot 아이콘)
  - AI ON: 자연어 질문 입력 → Claude가 관련 서비스 selectionKey 반환 → 다이어그램 자동 표시
  - AI OFF: 기존 텍스트 검색 그대로 유지
- **AI 응답 패널**: 검색 결과 설명, 정확도(높음/보통/낮음) 배지, 선택된 서비스 수 표시
- **ConfigSummary 빌더**: ParsedConfigV3를 AI에 전달할 축약 JSON으로 변환 (10-30KB)
  - QoS Rate KMG 변환 (1G, 500M 등)
  - adminState='down' 서비스 자동 제외
- **API Health Check**: `GET /api/health` 엔드포인트로 백엔드 상태 확인
- **요청 Rate Limiting**: 분당 30회 제한으로 API 남용 방지

### 🔧 기술적 변경 (Technical Changes)
- **아키텍처**: nginx + Express 별도 컨테이너 구조 (docker-compose)
  - `nokia-visualizer`: 프론트엔드 (nginx, 정적 파일)
  - `nokia-api`: 백엔드 (Express, AWS Bedrock API)
- **AWS Bedrock 연동**: `@aws-sdk/client-bedrock-runtime` Converse API 사용
  - AWS 자격 증명: `~/.aws/credentials` (read-only 마운트), 환경변수, IAM Role 순서로 탐지
  - 모델 ID: `BEDROCK_MODEL_ID` 환경변수로 변경 가능
  - 리전: `AWS_REGION` 환경변수 지원 (기본: ap-northeast-2)
- **nginx.conf**: `/api/*` 리버스 프록시 추가 (proxy_read_timeout 120s)
- **새로운 파일 구조**:
  - `server/`: Express 백엔드 (TypeScript, 멀티 스테이지 Docker 빌드)
  - `src/utils/configSummaryBuilder.ts`: ConfigSummary 변환
  - `src/services/chatApi.ts`: 프론트엔드 API 클라이언트
  - `src/components/v3/AIChatPanel.tsx`: AI 채팅 UI
- **에러 처리**: AWS 자격 증명 오류, Bedrock 접근 권한 오류, 스로틀링 등 상세 에러 분류

## [3.2.0] - 2026-02-15

### 🚀 주요 변경 사항 (Major Changes)
- **VPRN V3 네이티브 다이어그램**: V1 어댑터 기반에서 V3 네이티브 구현으로 전환. 라우팅 중간 노드(BGP, OSPF, STATIC)를 별도 노드로 분리하여 인터페이스와 서브넷/이름 매칭으로 자동 연결
- **QoS SAP 노드 내부 표시**: Epipe/VPLS의 QoS를 연결선 라벨에서 SAP 하위 항목으로 이동 (Nokia config 구조와 일치)
- **QoS Rate KMG 변환**: `sap-ingress`/`sap-egress` 정책 정의에서 rate를 파싱하여 K/M/G 단위로 표시 (7210SAS meter 방식, 7750SR/7450ESS/7705SAR queue 방식 모두 지원)

### ✨ 새로운 기능 (New Features)
- **QoS 색상 강조**: Epipe/VPLS/VPRN SAP 노드의 QoS 텍스트에 녹색 배경(`#4caf50`) + 흰색 글자 하이라이트 적용 (IES와 동일한 시인성)
- **VPRN Ethernet 하위 필드**: VPRN 호스트 노드에 Port 하위 Ethernet 정보(Mode, MTU, Speed, AutoNego, Network, LLDP) 렌더링 추가
- **멀티호스트 Name/Desc 표시 개선**: 여러 호스트의 Name/Description이 다를 경우, 헤더 아래 `‑ hostname: value` 형식의 들여쓰기 목록으로 표시 (Epipe/VPLS 서비스 노드)
- **VPRN 라우팅 중간 노드**:
  - BGP 노드: Router-ID, Split-Horizon, Group/Peer 정보 통합. Peer IP → 인터페이스 서브넷 매칭
  - OSPF 노드: Area/Interface 정보 통합. Interface Name 직접 비교 매칭
  - STATIC 노드: Next-Hop별 별도 노드 생성. Route 수 표시. Next-Hop → 인터페이스 서브넷 매칭
- **Shutdown 필터링**: adminState='down'인 SAP/인터페이스를 다이어그램에서 자동 제외 (Epipe, VPLS, VPRN, IES)
- **VPLS 호스트 정렬**: hostname 기준 오름차순 정렬 (BB3 → BB4 순서 보장)
- **VPLS 멀티 SAP**: 하나의 호스트에 여러 SAP이 있을 경우 각 SAP을 개별 노드로 표시

### 🐛 버그 수정 (Bug Fixes)
- **SAP 파싱 누락 수정**: regex 기반 SAP 추출을 위치 기반(position-based) 방식으로 교체하여 마지막 SAP이 누락되는 버그 해결
- **SAP adminState 오탐 수정**: `no shutdown`이 `shutdown`으로 잘못 판정되는 문제 수정. SAP 자체의 `exit` 이전까지만 검사
- **VLAN-less SAP 파싱**: `sap 4/2/23 create` (VLAN 없음) 형식도 정상 파싱되도록 regex 수정
- **멀티 IES 인터페이스 병합**: 동일 hostname의 여러 IES 서비스(IES 0 + IES 10) 인터페이스를 통합하여 다이어그램 생성
- **IES Service Group 헤더 제거**: IES에 무의미한 "Service Group (ID: 0)" 헤더가 표시되던 문제 수정
- **IES 카드 타이틀 형식**: 구분자를 ` - `에서 `: `로 수정, Description 우선순위 적용 (DIAGRAM_RULES.md 1.1 준수)

### 🔧 기술적 변경 (Technical Changes)
- **들여쓰기 레벨 조정**: 모든 다이어그램 템플릿의 들여쓰기를 2단계씩 축소 (DIAGRAM_RULES.md 템플릿 반영)
  - Level 1: `  ‑ ` → `‑ `, Level 2: `    ‑ ` → `  ‑ `, Level 3: `      ‑ ` → `    ‑ `
- **라벨 케이싱 변경**: `SPEED` → `Speed`, `AUTONEGO` → `AutoNego`, `NETWORK` → `Network`, `GROUP` → `Group`, `AREA` → `Area`
- **Port Desc → Desc**: SAP 노드의 `Port Desc:` 라벨을 Port 하위 `Desc:`로 변경
- **VPRN Int Desc → Desc**: VPRN 호스트 노드의 `Int Desc:` 라벨을 `Desc:`로 변경
- **V3Page.tsx**: VPRN 다이어그램을 v1VPRNAdapter 대신 네이티브 `generateServiceDiagram()` 사용으로 전환
- **DIAGRAM_RULES.md**: QoS 색상 강조, 멀티호스트 표시 형식, SAP 파싱 규칙, VPRN Ethernet 추가 등 다수 규칙 업데이트

## [3.1.0] - 2026-02-14

### 🚀 주요 변경 사항 (Major Changes)
- **크로스 디바이스 IES HA 다이어그램**: 여러 장비(BB3, BB4 등)의 IES 인터페이스를 통합하여 이중화(HA) 다이어그램을 자동 생성합니다.
  - 기존: 장비별로 독립 처리하여 HA 페어를 감지할 수 없었음
  - 변경: 모든 장비의 IES 인터페이스를 통합 처리하여 공통 Static Route 기반 HA 페어 감지
- **VPRN V1 스타일 다이어그램**: VPRN 서비스에 V1 검증 로직(HA 감지, QoS 표시)을 적용한 다이어그램 생성
- **IES 서비스 파싱 고도화**: `ies N customer M create` 블록을 독립 서비스로 파싱 (기존 Base Router만 지원)

### ✨ 새로운 기능 (New Features)
- **V1 IES Adapter** (`v1IESAdapter.ts`): V3 IES 데이터를 V1 형식으로 변환하여 검증된 V1 다이어그램 생성 로직 재사용
  - `convertIESToV1Format()`: IES → NokiaDevice 변환
  - `generateCrossDeviceIESDiagrams()`: 크로스 디바이스 HA 통합 다이어그램 생성
- **V1 VPRN Adapter** (`v1VPRNAdapter.ts`): V3 VPRN 데이터를 V1 형식으로 변환
  - `convertVPRNToV1Format()`: VPRN → NokiaDevice 변환
  - `generateVPRNDiagramV1Style()`: V1 스타일 VPRN 다이어그램 생성
- **HA Filter 고도화** (`ServiceListV3.tsx`):
  - IES/VPRN 인터페이스 개별 선택 지원 (`ies___hostname___interfaceName`, `vprn___serviceId___hostname___interfaceName`)
  - Static Route 기반 크로스 디바이스 HA 페어 자동 감지 (79개 후보 → 33개 인터페이스 선택)
  - Aggregated Static Routes를 HA Filter에서도 사용하여 정확한 relatedRoutes 계산
- **Static Route Block 파싱** (`parserV3.ts`): `static-route-entry` 블록 형식 파싱 지원 (기존 한줄 형식만 지원)
- **VPRN 개별 인터페이스 선택**: VPRN 서비스 내 인터페이스를 개별적으로 선택/해제 가능 (아코디언 UI)

### 🐛 버그 수정 (Bug Fixes)
- **HA Filter에 Aggregated Routes 전달**: `convertIESToV1Format` 호출 시 동일 config의 모든 IES Static Routes를 통합하여 전달
- **React 중복 Key 경고 수정**: IES 다이어그램 그룹 및 인터페이스 목록에서 발생하던 중복 key 문제 해결
- **mermaidGeneratorV3.ts 중복 코드 제거**: IES 다이어그램 생성 로직을 V1 Adapter로 이관하여 코드 중복 해소

### 🔧 기술적 변경 (Technical Changes)
- `mermaidGenerator.ts`: `generateCombinedHaDiagram`, `generateSingleInterfaceDiagram` 함수를 export로 변경
- `Dockerfile`: Node.js 18 → 22 업그레이드
- `V3Page.tsx`: IES 다이어그램 생성을 per-hostname에서 cross-device 방식으로 리팩토링

## [2.0.0] - 2026-01-13

### 🚀 주요 변경 사항 (Major Changes)
- **MPLS L2 VPN 서비스 시각화**: Nokia 네트워크 장비의 L2/L3 VPN 서비스를 완벽하게 지원합니다.
  - **Epipe (P2P)**: SAP, Spoke-SDP, Endpoint 구성 시각화
  - **VPLS (Multipoint)**: SAP, Spoke-SDP, Mesh-SDP 풀 메쉬 토폴로지
  - **VPRN (L3 VPN)**: Interface, BGP Neighbor, Static Route 정보가 포함된 전용 레이아웃

### ✨ 새로운 기능 (New Features)
- **차세대 파서 (Parser V2)**:
  - **중복 블록 병합**: 분산 정의된 서비스(`vprn 3093` 등)를 자동으로 병합
  - **들여쓰기 인식**: Python 스타일 파싱으로 중첩 구조 정확도 100% 달성
  - **고급 정규식**: `type` 키워드 없는 레거시 설정도 완벽 지원
- **향상된 검색 시스템**:
  - Service ID, Name, Description, Customer ID 통합 검색
  - 검색어 입력 시 실시간 필터링 및 하이라이트
- **Service List 고도화**:
  - 서비스 타입별(Epipe/VPLS/VPRN) 그룹화 및 접기/펼치기
  - 체크박스를 통한 다중 선택 및 일괄 제어

### 🐛 버그 수정 (Bug Fixes)
- **Service List Ghosting**: 검색 시 이전 결과가 잔상으로 남는 React 렌더링 이슈 해결 (`key` prop 리셋 적용)
- **Diagram Label Formatting**: 포트 설명이 길어질 경우 라벨이 깨지는 현상 수정
- **Hostname Parsing**: VPRN 내 호스트네임 파싱 로직 개선

### ⚠️ 변경사항 (Breaking Changes)
- **Root Path 변경**: `/` 경로가 **MPLS L2 VPN (V2)** UI로 변경되었습니다. (기존 Topology V1은 `/v1`으로 이동)

## [1.7.0] - 2025-12-15

### 추가됨 (Added)
- **VRRP VIP 표시**: 다이어그램에 VRRP Virtual IP 표시
  - VIP 표시: IP 주소 아래에 `(VIP: x.x.x.x)` 형식
  - Master 표시: Priority >= 100인 경우 IP 앞에 `*` 표시
  - Nokia parser에서 VRRP `backup` (VIP) 및 `priority` 파싱
  - config1.txt와 config2.txt의 서로 다른 VRRP 설정 지원

### 개선됨 (Improved)
- **다이어그램 노드 라벨**: VRRP 정보 포함하여 더 상세한 정보 제공

## [1.6.0] - 2025-12-15

### 추가됨 (Added)
- **인터페이스 리스트 계층 구조**: 장비별 접기/펼치기 기능
  - 파일 탐색기처럼 장비를 폴더처럼 접고 펼칠 수 있음
  - ChevronRight (▶) / ChevronDown (▼) 아이콘으로 상태 표시
  - 각 장비의 인터페이스 개수 표시
  - 기본값: 모든 장비 펼쳐진 상태

### 개선됨 (Improved)
- **이중화 버튼 기능**: 동적 HA 감지 로직 적용
  - relatedRoutes 비교하여 공통 Customer Network가 있으면 HA로 인식
  - config 문법이 달라도 정확하게 HA 인터페이스 자동 선택
- **UI 개선**: Chevron 및 Server 아이콘 크기 및 간격 조정 (16px, 6px 간격)

## [1.5.0] - 2025-12-15

### 개선됨 (Improved)
- **Mermaid 코드 보기 UX 개선**
  - 코드 보기 아이콘(`<>`)에 "Mermaid 코드 보기" 툴팁 추가
  - 코드 표시 영역에 "복사" 버튼 추가
  - 클립보드 복사 기능 구현 (전체 코드 한 번에 복사)
  - 복사 성공 시 2초간 "복사됨" 상태 표시 (녹색 배경, Check 아이콘)
  - Copy/Check 아이콘으로 시각적 피드백 제공

## [1.4.0] - 2025-12-15

### 추가됨 (Added)
- **동적 HA 감지**: Customer Network 기반 자동 HA Pair 감지
  - 선택된 인터페이스들의 relatedRoutes를 비교하여 공통 Customer Network가 있으면 자동으로 HA로 그룹핑
  - config1.txt와 config2.txt의 서로 다른 static-route 문법에도 정상 작동
  - 'interface-based' HA Pair 타입 추가

### 개선됨 (Improved)
- **HA 감지 로직**: 기존 topology.haPairs 외에 선택된 인터페이스 기반 동적 HA 감지 추가
- **디버깅 로그**: TopologyEngine에 상세한 HA 감지 로그 추가
  - Static routes 파싱 상태 확인
  - HA Pair 감지 과정 추적
  - 공통 Customer Network 발견 시 로그 출력

## [1.3.0] - 2025-12-15

### 추가됨 (Added)
- **고급 검색 기능**: AND/OR 검색 지원
  - OR 검색: 띄어쓰기로 구분 (예: `BB5 210.211`)
  - AND 검색: ` + `로 구분 (예: `BB5 + 210.211`)
  - 검색 필드 확장: hostname, port, port description, interface name, interface description, ip address, service description (총 7개 필드)

### 수정됨 (Fixed)
- **HA 다이어그램 QoS 라벨**: "In:", "Out:"을 "In-QoS:", "Out-QoS:"로 복원하여 Single 다이어그램과 일관성 유지
- QoS 기본값을 "D"에서 "Default"로 변경하여 가독성 향상

## [1.2.0] - 2025-12-14

### 추가됨 (Added)
- **Demo Config 1&2 (HA)**: Select Config 드롭다운에 HA 구성 테스트용 옵션 추가
  - config1.txt와 config2.txt를 동시에 로드하여 이중화 다이어그램 테스트 가능
  - Beta 환경에서 기본으로 자동 로드

### 개선됨 (Improved)
- **HA 다이어그램 표시**:
  - Local Hosts 박스에 **Host** 정보 추가 (각 인터페이스의 호스트명 표시)
  - Remote HA Pair에 개별 **Peer IP** 노드 생성 (각 인터페이스별로 대응하는 Peer IP 표시)
  - 더 명확한 인터페이스-Peer 관계 시각화

### 변경됨 (Changed)
- Beta 환경 auto-load: 단일 config.txt 대신 config1.txt & config2.txt 로드

## [1.1.0] - 2025-12-14


### 추가됨 (Added)
- **HA 다이어그램 생성**: 이중화(High Availability) 구성 자동 감지 및 시각화
  - HA Pair를 공유하는 인터페이스를 자동으로 그룹핑하여 Combined Diagram 생성
  - Local Hosts, Remote HA Pair, Customer Network 서브그래프로 구조화
  - QoS 정보 표시 (In-QoS / Out-QoS)
- **이중화 필터 버튼**: 인터페이스 목록에서 HA 구성 인터페이스만 자동 선택
- **파일 미리보기 모달**: 업로드할 파일 목록을 미리 확인하고 추가 파일 선택 가능
  - "Add Files" 버튼으로 파일 추가
  - 선택한 파일 목록 표시
- **Mermaid 코드 보기 버튼**: 생성된 Mermaid 코드를 확인할 수 있는 디버깅 도구
  - 각 다이어그램 헤더에 `</>` 아이콘 버튼
  - 렌더링 실패 시에도 코드 확인 가능

### 변경됨 (Changed)
- **다이어그램 레이블 형식**: Beta 브랜치 원본 형식으로 복원
  - HTML 레이블 사용 (`<div style="text-align: left">`)
  - **Port**, **Interface**, **IP**, **Service** 정보 표시
  - Non-breaking space/hyphen 적용으로 텍스트 줄바꿈 방지
- **Parser 개선**: `create` 키워드가 없는 interface 선언도 파싱 가능

### 수정됨 (Fixed)
- **Mermaid 파싱 오류**: HTML style 속성의 quote 처리 문제 해결
  - Single quote → Double quote 변경
  - 특수 문자 이스케이프 개선 (`&` → `&amp;`)
- **Carriage return 처리**: Windows 스타일 줄바꿈 문자 제거
- **에러 표시 개선**: 다이어그램 렌더링 실패 시에도 카드와 Code 버튼 표시

## [1.0.0] - 2025-12-14


### 추가됨 (Added)
- **다이어그램 시각화**: Nokia 설정 파일을 파싱하여 네트워크 토폴로지와 인터페이스를 시각화합니다.
- **개별 다운로드**: 각 다이어그램 카드를 고해상도 PNG 또는 SVG로 개별 다운로드할 수 있습니다.
- **커스텀 UI**:
  - "Config Visualizer" 타이틀 및 브랜딩 적용.
  - 네트워크 토폴로지를 형상화한 커스텀 SVG 아이콘 (Favicon 및 헤더 로고).
  - 크기 조절이 가능한 사이드바 및 반응형 레이아웃.
- **데모 모드**: 베타 환경에서 자동으로 데모 설정 파일을 로드합니다.

### 변경됨 (Changed)
- **툴바 리팩토링**: UX 개선을 위해 다운로드 버튼을 각 카드 헤더로 통합했습니다.
- **아이콘 업데이트**: 기본 Vite 아이콘을 커스텀 `cv.svg` (Config Visualizer) 아이콘으로 교체했습니다.
- **성능**: 안정적인 PNG 생성을 위해 `html-to-image` 라이브러리를 도입하여 렌더링을 최적화했습니다.

### 수정됨 (Fixed)
- **PNG 다운로드**: `html-to-image`로 전환하여 캔버스 오염(tainted canvas) 및 저해상도 문제를 해결했습니다.
- **빌드 오류**: 프로덕션 빌드 시 발생하던 미사용 변수 관련 TypeScript 오류를 수정했습니다.
