# Release Notes - v3.2.0 (QoS Highlight, VPRN Routing Nodes & SAP Parsing Overhaul)

This release delivers major improvements across all service types — enhanced QoS visibility, a completely rewritten VPRN diagram engine with routing middle nodes, robust SAP parsing, and refined diagram templates.

## 🚀 New Features

### 🌟 VPRN Native Routing Middle Nodes
- **BGP / OSPF / STATIC 분리 노드**: VPRN 다이어그램에서 라우팅 정보가 서비스 노드에서 분리되어 독립적인 중간 노드로 표시됩니다.
  - **BGP 노드**: Router-ID, Split-Horizon, Group/Peer 정보 통합. Peer IP → 인터페이스 서브넷 자동 매칭
  - **OSPF 노드**: Area/Interface 정보 통합. Interface Name 직접 비교 매칭
  - **STATIC 노드**: Next-Hop별 별도 노드 생성. Route 수 카운트 표시. Next-Hop → 인터페이스 서브넷 매칭
- **3단 레이아웃**: Interface → Routing Nodes → Service Node 구조로 라우팅 관계를 시각적으로 표현
- **V1 어댑터 제거**: VPRN을 V3 네이티브 `generateServiceDiagram()`으로 직접 렌더링

### 🎨 QoS 색상 강조 (시인성 향상)
- **녹색 배경 + 흰색 글자**: Epipe/VPLS/VPRN SAP 노드의 In-QoS/Out-QoS 텍스트에 녹색 배경(`#4caf50`) + 흰색 글자 하이라이트 적용
- **IES와 동일한 색상 체계**: 모든 서비스 타입에서 QoS 정보의 시인성이 통일됨
- **CSS 클래스 기반**: `.qos-hl` 클래스 사용 (Mermaid SVG foreignObject 호환)

### 📊 QoS Rate KMG 변환
- **정책 기반 Rate 파싱**: `sap-ingress`/`sap-egress` 정책 정의에서 실제 rate 값을 추출
- **장비별 문법 지원**: 7210SAS (meter 기반), 7750SR/7450ESS/7705SAR (queue 기반) 모두 지원
- **KMG 단위 표시**: 100,000 kbps → `100M`, 1,000,000 kbps → `1G`, unlimited → `Max`
- **Fallback**: 정책 정의가 없으면 policy ID 숫자만 표시

### 🔗 멀티호스트 Name/Desc 표시 개선
- **헤더 + 들여쓰기 목록 형식**: 여러 호스트의 Name/Description이 다를 경우:
  ```
  VPLS Name:
  ‑ hostname1: service-name-A
  ‑ hostname2: service-name-B
  ```
- **단일 고유값**: 모든 호스트가 동일한 Name이면 인라인 표시 (`VPLS Name: value`)
- **Epipe/VPLS 서비스 노드 모두 적용**

### 🔄 VPRN Ethernet 하위 필드
- **VPRN 호스트 노드에 Ethernet 정보 추가**: Port 하위에 Mode, MTU, Speed, AutoNego, Network, LLDP 필드 렌더링 (기존 Epipe/VPLS/IES에만 있던 기능을 VPRN에도 확장)

### 🚫 Shutdown 필터링
- **adminState='down' 자동 제외**: Epipe SAP, VPLS SAP, VPRN Interface, IES Interface에서 shutdown 상태인 항목을 다이어그램에서 자동 제외
- **파싱 데이터는 보존**: 디버깅용으로 원본 데이터는 유지, 렌더링 시점에서만 필터링

## 🐛 Bug Fixes

- **SAP 파싱 누락**: regex lookahead 기반 SAP 추출이 마지막 SAP을 누락하는 치명적 버그를 위치 기반(position-based) 방식으로 전면 교체하여 해결
- **SAP adminState 오탐**: `no shutdown`이 `shutdown`으로 잘못 판정되는 문제 수정. SAP 자체의 `exit` 이전 텍스트만 검사하도록 변경
- **VLAN-less SAP 파싱**: `sap 4/2/23 create` (VLAN 없는 고객 포트) 형식이 파싱되지 않던 문제 수정
- **멀티 IES 인터페이스 병합**: 동일 hostname의 여러 IES 서비스(IES 0 + IES 10) 인터페이스가 통합되지 않아 일부 다이어그램이 누락되던 문제 수정
- **IES Service Group 헤더**: IES에 무의미한 "Service Group (ID: 0)" 헤더가 표시되던 문제 제거
- **IES 카드 타이틀**: 구분자가 ` - `에서 `: `로 수정, Description 우선순위 적용 (Interface Desc > Port Desc > Interface Name)
- **VPLS 호스트 정렬**: 호스트가 업로드 순서대로 표시되던 문제를 hostname 기준 오름차순 정렬로 수정

## 🛠 Technical Updates

- **들여쓰기 레벨 전면 조정**: DIAGRAM_RULES.md 템플릿 기준으로 모든 서비스 타입의 들여쓰기를 2단계씩 축소
- **라벨 케이싱 통일**: `SPEED` → `Speed`, `AUTONEGO` → `AutoNego`, `NETWORK` → `Network`, `GROUP` → `Group`, `AREA` → `Area`
- **Port Desc → Desc**: Epipe/VPLS/VPRN SAP 노드에서 `Port Desc:` 라벨을 Port 하위 `Desc:`로 변경
- **VPRN Int Desc → Desc**: VPRN 호스트 노드의 `Int Desc:` 라벨을 `Desc:`로 간소화
- **DIAGRAM_RULES.md 대규모 업데이트**: QoS 색상 강조 규칙, 멀티호스트 표시 형식, SAP 블록 추출 규칙, VPRN Ethernet, STATIC 카운트 등 다수 규칙 추가/수정

---

**Full Changelog**: https://github.com/20eung/nokia-config-visualizer/compare/v3.1.0...v3.2.0
