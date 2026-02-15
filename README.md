# Nokia Config Visualizer

> 🚀 **v3.2.0** (Latest) - Nokia 네트워크 장비 / Unified Network & Service Visualizer

![Application Screenshot](./docs/screenshot.png)

[![GitHub release](https://img.shields.io/github/v/release/20eung/nokia-config-visualizer)](https://github.com/20eung/nokia-config-visualizer/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 📖 프로젝트 개요

네트워크 엔지니어가 복잡한 Nokia 장비 설정 파일을 쉽게 이해하고 분석할 수 있도록 돕는 웹 기반 시각화 도구입니다. 텍스트 형태의 설정을 파싱하여 인터페이스, 포트, 연동 장비 정보를 추출하고, **Mermaid.js**를 이용해 직관적인 다이어그램으로 변환합니다. 생성된 다이어그램은 **Grafana Diagram 패널**과 완벽하게 호환되어 실시간 모니터링 환경에 통합할 수 있습니다.

## ✨ 주요 기능

### 🔍 지능형 파싱
- **호스트네임 및 시스템 정보** 추출
- **인터페이스 및 포트** 상세 분석
- **IP 주소, 서브넷** 파싱
- **QoS 정책** (Ingress/Egress) 추출
- **서비스 정보** (VPRN/IES/VPLS) 파싱
- **정적 라우팅** (Static Route) 경로 및 Next-Hop 분석
- **VRRP 설정** (VIP, Priority) 파싱

### 🎨 다이어그램 시각화
- **Single Interface Diagram**: 개별 인터페이스별 독립적인 토폴로지
- **HA Diagram**: 이중화 구성 자동 감지 및 통합 다이어그램
  - 동적 HA 감지 (Static Route + VRRP 기반)
  - VRRP Master/Backup 표시
  - VIP (Virtual IP) 표시
- **QoS 정보** 링크 라벨에 표시
- **확대/축소** 및 **PNG/SVG 다운로드** 지원
- **Mermaid 코드 보기** 및 복사 기능
- **Grafana 호환성**: Grafana Diagram 패널과 완벽하게 호환되는 Mermaid 코드 생성

### 🌐 VPN 서비스 시각화 (v2.x)
- **Epipe (P2P)**: 양방향 QoS 정보, Source/Target 통합 다이어그램
- **VPLS (Multipoint)**: 멀티 장비 통합, Hub-and-Spoke 구조 시각화
- **VPRN (L3 VPN)**:
  - 인터페이스 및 Static Route 상세 정보
  - BGP Neighbor 및 Peering 정보
  - VRF, RD, AS 정보 표시
- **서비스 그룹화**: Service ID 및 Type 기반 자동 그룹화
- **통합 레이아웃**: Host(Left) - Service(Right) 표준화된 구조

### 🌍 통합 비주얼라이저 (v3.x)
- **Base Router / IES 통합**: Global Routing Table 인터페이스 및 Static Route 시각화
- **VPRN 라우팅 노드**: BGP / OSPF / STATIC 분리 노드로 라우팅 관계 시각화
- **QoS 색상 강조**: 녹색 배경 + 흰색 글자로 QoS 시인성 향상 (모든 서비스 타입 통일)
- **QoS Rate KMG 변환**: 정책 기반 Rate 파싱 (100M, 500M, 1G, Max 표시)
- **Shutdown 필터링**: adminState='down' 항목 자동 제외
- **Host 기반 그룹핑**: IES 서비스를 장비별 그룹화, HA 다이어그램 자동 생성
- **v1/v2 통합**: 물리 토폴로지와 논리 서비스를 단일 플랫폼에서 지원
### 🔎 고급 검색 기능
- **AND 검색**: ` + ` (공백 포함)로 구분
- **OR 검색**: 띄어쓰기로 구분
- **검색 필드**: Hostname, Port, Port Description, Interface Name, Interface Description, IP Address, Service Description

### 📁 인터페이스 관리
- **계층 구조**: 장비별 접기/펼치기 (파일 탐색기 스타일)
- **스마트 필터**: 
  - **All**: 모든 인터페이스 선택
  - **이중화**: HA 인터페이스만 자동 선택
  - **None**: 선택 해제
- **자연스러운 정렬** (Natural Sorting)
- **인터페이스 개수** 표시

### 🎯 사용자 편의성
- **드래그 앤 드롭** 또는 텍스트 붙여넣기 지원
- **여러 Config 파일** 동시 로드 가능
- **데모 모드**: 미리 준비된 설정 파일로 즉시 테스트 (Beta 환경)
- **크기 조절 가능한 사이드바**
- **모던하고 깔끔한 UI** 디자인

## 🛠 기술 스택

- **Frontend**: [React](https://react.dev/) 19 + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Visualization**: [Mermaid.js](https://mermaid.js.org/)
- **Integration**: [Grafana](https://grafana.com/) Diagram Panel 호환
- **Styling**: Vanilla CSS
- **Icons**: [Lucide React](https://lucide.dev/)
- **Image Export**: [html-to-image](https://github.com/bubkoo/html-to-image)

## 🚀 시작하기

### 사전 요구사항

- Node.js (v22 이상 권장)
- npm

### 설치 및 실행

```bash
# 저장소 클론
git clone https://github.com/20eung/nokia-config-visualizer.git
cd nokia-config-visualizer

# 패키지 설치
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 `http://localhost:5173`으로 접속하여 확인합니다.

### 프로덕션 빌드

```bash
npm run build
npm run preview
```

## 📝 사용 방법

### 1. Config 파일 업로드

상단 헤더의 **"Upload Config"** 버튼을 클릭하여 Nokia 설정 파일(`.cfg`, `.txt`, `.conf`)을 업로드합니다.

### 2. 인터페이스 선택

- 왼쪽 패널에서 장비를 클릭하여 접기/펼치기
- 원하는 인터페이스를 체크박스로 선택
- **스마트 필터** 사용:
  - **All**: 모든 인터페이스 선택
  - **이중화**: HA 구성 인터페이스만 선택
  - **None**: 선택 해제

### 3. 검색 활용

검색창에 키워드 입력:
- **OR 검색**: `nokia-1 172.16` (띄어쓰기)
- **AND 검색**: `nokia-1 + 172.16` (` + ` 사용)

### 4. 다이어그램 확인

- **Single Diagram**: 개별 인터페이스별 독립적인 다이어그램
- **HA Diagram**: 이중화 구성 통합 다이어그램
  - Master: IP 앞에 `*` 표시
  - VIP: `(VIP: x.x.x.x)` 표시

### 5. 다이어그램 내보내기

- **PNG/SVG 다운로드**: 다이어그램 우측 상단 Download 버튼
- **Mermaid 코드 복사**: `<>` 버튼 클릭 → 복사 버튼
- **Grafana 연동**: 복사한 Mermaid 코드를 Grafana Diagram 패널에 붙여넣기하여 실시간 모니터링 대시보드 구축

## 📂 프로젝트 구조

```
nokia-config-visualizer/
├── public/                      # 정적 자산
│   ├── config1.txt              # 데모용 Config (nokia-1)
│   └── config2.txt              # 데모용 Config (nokia-2)
├── src/
│   ├── components/              # UI 컴포넌트
│   ├── components/v2/           # V2 전용 컴포넌트
│   ├── components/v3/           # V3 전용 컴포넌트
│   ├── pages/                   # 페이지 (V1Page, V2Page, V3Page)
│   ├── utils/                   # 핵심 로직 (v1 파서, 다이어그램, HA 감지)
│   ├── utils/v2/                # V2 파서 및 다이어그램
│   ├── utils/v3/                # V3 파서 및 다이어그램
│   ├── types.ts                 # TypeScript 타입 정의
│   ├── App.tsx                  # 메인 애플리케이션 (라우팅)
│   └── main.tsx                 # 진입점
├── docs/                        # 프로젝트 문서
├── CHANGELOG.md                 # 변경 이력
├── DIAGRAM_RULES.md             # 다이어그램 렌더링 규칙
└── package.json
```

## 🎯 v1.x 기능 완성도

v1.x 시리즈는 **물리적 연결 토폴로지 시각화**를 목표로 하며, 다음 기능들이 구현되었습니다:

- ✅ 장비 간 물리적 연결
- ✅ IP 주소, 포트 정보
- ✅ HA 구성 (VRRP)
- ✅ QoS 정보
- ✅ Static Route 기반 Customer Network
- ✅ 동적 HA 감지 (Static Route + VRRP 기반)
- ✅ VRRP 기반 이중화 자동 탐지
- ✅ 고급 검색 기능 (AND/OR)
- ✅ 인터페이스 계층 구조 (접기/펼치기)
- ✅ VRRP VIP 및 Master 표시
- ✅ Mermaid 코드 보기 및 복사

## 🗺 로드맵

### v1.x - 물리적 연결 토폴로지 ✅ 완료
물리적 연결 구조 시각화

### v2.x - MPLS VPN 서비스 토폴로지 ✅ 완료 (v2.1.0 released)
- ✅ **Epipe**: Point-to-Point L2 VPN, 양방향 QoS, 통합 다이어그램
- ✅ **VPLS**: Multipoint L2 VPN, 멀티 호스트 지원, 중복 제거
- ✅ **VPRN**: L3 VPN, Interface/Static Route/BGP 통합 시각화
- ✅ **표준화된 레이아웃**: 모든 서비스에 대해 Host-Service 구조 통일
- ✅ **고도화된 파싱**: 복잡한 서비스 설정(Multi-hop, VRF 등) 파싱 지원

### v3.x - Unified Visualizer ✅ 완료 (v3.2.0 released)
- ✅ **Base Router 통합**: 물리적 연결(v1)과 서비스(v2) 뷰 통합
- ✅ **IES 서비스 지원**: Base Router 인터페이스 및 Global Routing Table 시각화
- ✅ **통합 UI**: 모든 서비스(Epipe, VPLS, VPRN, IES)를 하나의 인터페이스에서 관리
- ✅ **HA 토폴로지**: IES 서비스에 대한 Local -> Peer -> Network 위상 자동 생성
- ✅ **VPRN 라우팅 노드**: BGP / OSPF / STATIC 분리 노드로 3단 레이아웃
- ✅ **QoS 하이라이트**: 녹색 배경 + 흰색 글자, Rate KMG 변환
- ✅ **Shutdown 필터링**: adminState='down' 항목 다이어그램에서 자동 제외
- ✅ **SAP 파싱 개선**: Position 기반 추출, VLAN-less SAP 지원

**Latest Release**: v3.2.0 (2026-02-15)

## 📊 버전 히스토리

- **v3.2.0** (2026-02-15) - QoS 하이라이트, VPRN 라우팅 노드, SAP 파싱 개선
  - VPRN BGP/OSPF/STATIC 분리 라우팅 노드
  - QoS 녹색 배경 강조 및 Rate KMG 변환 (100M, 500M, 1G, Max)
  - Shutdown SAP/인터페이스 자동 필터링
  - SAP 파싱 전면 개선 (position 기반, VLAN-less 지원)

- **v3.1.0** (2026-01-21) - BGP/OSPF 시각화 고도화 및 UI 개선
  - VPRN BGP 정보 (Router ID, Neighbor, AS, RD) 시각화 강화
  - OSPF 영역(Area) 및 인터페이스 정보 시각화 추가
  - Service 라벨 가독성 개선 및 정보 중복 제거
  - 초기 화면 UI 문구 개선 ("L2 VPN" 제거)
- **v3.0.0** (2026-01-21) - Unified Visualizer 런칭
  - Base Router / IES 통합 시각화
  - Host 기반 그룹핑 및 통합 UI 적용

- **v1.8.0** (2025-12-17) - VRRP 기반 HA 탐지
- **v1.7.0** (2025-12-15) - VRRP VIP 및 Master 표시
- **v1.6.0** (2025-12-15) - 인터페이스 리스트 계층 구조
- **v1.5.0** (2025-12-15) - Mermaid 코드 보기 UX 개선
- **v1.4.0** (2025-12-15) - 동적 HA 감지
- **v1.3.0** (2025-12-15) - 고급 검색 기능 (AND/OR)
- **v1.2.0** (2025-12-14) - HA 다이어그램 표시 개선
- **v1.1.0** (2025-12-14) - HA 다이어그램 생성 기능
- **v1.0.0** (2025-12-14) - 초기 릴리즈

전체 변경 이력은 [CHANGELOG.md](./CHANGELOG.md)를 참조하세요.

## 🤝 기여하기

기여는 언제나 환영합니다! 버그를 발견하거나 새로운 기능을 제안하고 싶다면 Issue를 등록하거나 Pull Request를 보내주세요.

## 📄 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.

## 🔗 링크

### 개발
- **GitHub Repository**: https://github.com/20eung/nokia-config-visualizer
- **Latest Release**: https://github.com/20eung/nokia-config-visualizer/releases/latest

---

Made with ❤️ by Network Engineers, for Network Engineers
