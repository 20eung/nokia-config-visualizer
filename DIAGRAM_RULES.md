# Diagram Generation Rules (다이어그램 생성 규칙)

> 이 문서는 Nokia Config Visualizer v3에서 다이어그램을 생성할 때 적용되는 표준 규칙을 정의합니다.
> 모든 서비스 타입(Epipe, VPLS, VPRN, IES)에 공통적으로 적용되는 규칙과 각 서비스별 고유 규칙을 포함합니다.

**Last Updated**: 2026-02-15
**적용 버전**: v3.2.0+

---

## 0. 목차

| # | 섹션 | 설명 |
|---|------|------|
| **1** | **[공통 규칙](#1-공통-규칙)** | 모든 서비스 타입에 적용되는 공통 규칙 |
| 1.1 | 카드 타이틀 | 다이어그램 카드 상단 제목 형식 |
| 1.2 | QoS 표시 규칙 | 서비스 타입별 QoS 표시 위치 |
| 1.3 | 텍스트 표시 규칙 | Non-breaking space/hyphen, HTML 이스케이프 |
| 1.4 | 다이어그램 레이아웃 | `graph LR` 좌→우 레이아웃 |
| 1.5 | 스타일 클래스 | classDef 정의 (default, service, routing 등) |
| **2** | **[Epipe 다이어그램](#2-epipe-다이어그램)** | Point-to-Point L2 VPN |
| 2.1 | 다이어그램 분리 규칙 | Spoke-SDP별 분리 |
| 2.2 | 호스트 노드 (SAP Node) | SAP + QoS + Port + Ethernet |
| 2.3 | 서비스 노드 | Service ID, Name, Spoke-SDP |
| 2.4 | Ethernet 하위 필드 파싱 소스 | Nokia config → 필드 매핑 |
| **3** | **[VPLS 다이어그램](#3-vpls-다이어그램)** | Multipoint L2 VPN |
| 3.1 | 호스트 노드 (SAP Node) | SAP + QoS + Port + VLAN + Ethernet |
| 3.2 | SDP 정보 노드 | Mesh-Sdp, Spoke-Sdp, MAC-MOVE |
| 3.3 | 서비스 노드 | Service ID, Name, Description (멀티호스트 고유값) |
| 3.4 | 호스트 정렬 및 멀티 SAP | hostname 정렬, SAP별 개별 노드 |
| 3.5 | Hub-Spoke 레이아웃 | SDP 합산 기반 Hub 자동 감지 |
| 3.6 | QoS 표시 | SAP 하위 항목으로 표시 |
| **4** | **[VPRN 다이어그램](#4-vprn-다이어그램)** | L3 VPN (3단 레이아웃) |
| 4.1 | 전체 레이아웃 | Interface → Routing Nodes → Service |
| 4.2 | 호스트 노드 (Interface 중심) | Interface + SAP + QoS + Port |
| 4.3 | 라우팅 중간 노드 | BGP / OSPF / STATIC (Next-Hop별) |
| 4.4 | 연결선 규칙 | 매칭/미매칭 인터페이스 연결 방식 |
| 4.5 | 서비스 노드 | VPRN 메타데이터 (라우팅 정보 제외) |
| **5** | **[IES 다이어그램](#5-ies-다이어그램)** | V1 어댑터 기반 |
| 5.1 | V1 스타일 | IESService → NokiaDevice 변환 |
| 5.2 | 다이어그램 구조 | Single / HA Combined |
| 5.3 | 호스트 노드 | Port, Interface, IP, Service |
| 5.4 | HA 감지 규칙 | Static Route 기반, Cross-Device |
| 5.5 | QoS 표시 | 연결선 라벨 (녹색 배경) |
| **6** | **[파싱 규칙 (Parser)](#6-파싱-규칙-parser)** | Config 파싱 세부 규칙 |
| 6.1 | Port Ethernet Config | port 블록 → PortEthernetConfig |
| 6.2 | SAP LLF | Link Loss Forwarding 감지 |
| 6.3 | VPLS MAC-MOVE | mac-move 키워드 감지 |
| 6.4 | QoS 정책 Rate 파싱 | sap-ingress/egress → KMG 변환 |
| 6.5 | Port 정보 주입 | portInfoMap → SAP/L3Interface 주입 |
| **7** | **[다이어그램 분리 정책](#7-다이어그램-분리-정책-splitting-policy)** | 서비스별 다이어그램 분리 기준 |
| 7.1 | Epipe | SDP별 분리 |
| 7.2 | VPLS | 동일 serviceId 통합 |
| 7.3 | VPRN | 동일 serviceId 통합 (V3 네이티브) |
| 7.4 | IES | Cross-Device HA 분리 |
| **8** | **[타입 정의 요약](#8-타입-정의-요약)** | TypeScript 인터페이스 요약 |
| **9** | **[관련 파일 맵](#9-관련-파일-맵)** | 소스 파일별 역할 |

---

## 1. 공통 규칙

### 1.1 카드 타이틀 (Card Title)

다이어그램 카드 상단에 표시되는 제목 형식.

| 서비스 타입 | 타이틀 형식 | 예시 |
|---|---|---|
| **Epipe** | `EPIPE {serviceId}: {description}` | `EPIPE 2043: TO-CustomerA` |
| **VPLS** | `VPLS {serviceId}: {description}` | `VPLS 5000: OFFICE-LAN` |
| **VPRN** | `VPRN {serviceId}: {description}` | `VPRN 3093: VPN-CustomerB` |
| **IES** | `{hostname}: {interfaceDesc}` | `PE-Router-1: TO-CE-Switch` |
| **IES (이중화)** | `이중화: {hostname1}: {intfDesc} & {hostname2}: {intfDesc}` | `이중화: nokia-1: To-CustomerA & nokia-2: To-CustomerA` |

- 구분자는 `: ` (콜론 + 공백)을 사용한다. (` - ` 아님)
- description이 없으면 서비스 ID만 표시한다. (예: `EPIPE 2043`)
- IES는 인터페이스 단위로 다이어그램이 생성되므로, 타이틀 우선순위:
  1. Interface Description
  2. Port Description
  3. Interface Name (fallback)
- IES 이중화 타이틀도 동일한 Description 우선순위를 적용한다.

### 1.2 QoS 표시 규칙

- **Epipe/VPLS**: QoS는 **SAP 하위 항목**으로 SAP 노드 안에 표시. config에 QoS가 있는 경우만 표시, 없으면 생략.
  - QoS rate 표시: `formatRateKMG()` 사용 (`QosPolicy`의 `rate` → KMG 변환). 정의 없으면 policy ID만 표시.
- **VPRN**: QoS는 **SAP 하위 항목**으로 호스트 노드 안에 표시. `formatL3QosRate()` 사용 (`L3Interface`의 `ingressQosRate`/`egressQosRate` → KMG 변환).
- **IES**: 연결선(edge label)에 표시 (V1 어댑터 방식)
- Nokia config에서 QoS는 `sap` 블록 안의 `ingress qos` / `egress qos`에 설정됨

**QoS 색상 강조 (시인성 향상):**
- **Epipe/VPLS/VPRN**: QoS 텍스트를 녹색 배경(`#4caf50`) + 흰색 글자로 강조 표시. CSS 클래스 `.qos-hl` 사용 (`<span class='qos-hl'>`)
- **IES**: 연결선 라벨에 `.qos-label` 클래스 사용 (동일 색상)
- CSS 정의: `src/index.css`

```
SAP: 3/1/12
  - In‑QoS: 100M    ← 녹색 배경 + 흰색 글자
  - Out‑QoS: 100M   ← 녹색 배경 + 흰색 글자
```

### 1.3 텍스트 표시 규칙

- **Non-breaking space** (`\u00A0`): 줄바꿈 방지가 필요한 곳에 사용
- **Non-breaking hyphen** (`\u2011`): 하이픈이 줄바꿈 지점이 되지 않도록 함
- **HTML 특수문자**: `&`, `<`, `>`, `"` 는 반드시 이스케이프 처리
- **값이 없는 필드는 표시하지 않는다** (N/A 아님). 데이터가 있는 항목만 렌더링.

### 1.4 다이어그램 레이아웃

- Mermaid `graph LR` (좌→우) 레이아웃 사용
- 왼쪽: Host 서브그래프 (Local 장비 정보)
- 오른쪽: Service 서브그래프 (Type별 서비스 정보)
  - IES/VPLS/VPRN: Service 정보
  - IES: Remote Customer Network
- 중앙: Type별 필요 정보 서브그래프
  - VPLS: Mesh Host 노드
  - VPRN: BGP, OSPF, STATIC 라우팅 정보
  - IES: Remote HA Pair 노드
- 노드 ID는 `sanitizeNodeId()`로 특수문자 제거하여 안전하게 생성
- Grafana의 Diagram 패널에서 사용 가능하게 생성

### 1.5 스타일 클래스

| classDef / CSS | 용도 | 스타일 |
|---|---|---|
| `classDef default` | 호스트 노드 | 흰색 배경, 검정 테두리 |
| `classDef service` | 서비스 노드 (Epipe/VPRN) | 연한 파란색 배경 (`#e3f2fd`), 파란 테두리 (`#1976d2`) |
| `classDef vpls` | VPLS 서비스 | 연한 파란색 배경 (`#e3f2fd`) |
| `classDef routing` | 라우팅 노드 (VPRN) | 연한 보라색 배경 (`#f3e5f5`), 보라 테두리 (`#7b1fa2`) |
| `classDef svcinfo` | SDP 정보 (VPLS) | 연한 노란색 배경 (`#fff9c4`) |
| CSS `.qos-hl` | QoS 하이라이트 (Epipe/VPLS/VPRN) | 녹색 배경 (`#4caf50`), 흰색 텍스트 |
| CSS `.qos-label` | QoS 라벨 (IES 연결선) | 녹색 배경 (`#4caf50`), 흰색 텍스트 |

---

## 2. Epipe 다이어그램

### 2.1 다이어그램 분리 규칙

- **Spoke-SDP가 다르면 별도 다이어그램으로 분리**한다.
- 동일 서비스 ID(예: EPIPE 2043)라도 SDP가 다르면 카드를 나눈다.
- SDP 키: `{sdpId}:{vcId}` (예: `1005:2043`, `13000:2043`)
- 분리 로직은 `V3Page.tsx`에서 서비스를 SDP별로 그룹화하여 처리

### 2.2 호스트 노드 (SAP Node)

SAP 노드에 표시하는 정보와 순서:

```
SAP: 3/1/12
- In‑QoS: 100M
- Out‑QoS: 100M
Port: 3/1/12
- Desc: TO-CUSTOMER-SW
- Ethernet:
  - Mode: access
  - MTU: 9212
  - Speed: 100
  - AutoNego: NO
  - Network: queue-policy-name
  - LLF: On
  - LLDP: admin-status
```

**규칙:**
- **QoS는 SAP 하위 항목으로 표시** (→ 1.2 QoS 표시 규칙 참조)
- **VLAN 정보는 표시하지 않는다.**
- **Ethernet** 헤더 아래에 하위 필드를 들여쓰기(`  - `)하여 표시
- Ethernet 하위 필드 중 **값이 있는 것만 표시** (없으면 생략)
- Ethernet 하위 필드가 하나도 없으면 Ethernet 헤더 자체를 표시하지 않는다.
- 연결선은 plain arrow (`-->`) — QoS 라벨 없음
- **SAP 노드에는 SAP/QoS/Port/Ethernet 정보만 표시** — Spoke-Sdp 정보는 서비스 노드에 표시

### 2.3 서비스 노드

```
Service: EPIPE 2043
EPIPE Name: service-name
EPIPE Desc: description
Spoke‑Sdp: 1005:2043
```

**멀티호스트 Name/Desc가 다를 경우:**
```
Service: EPIPE 2043
EPIPE Name:
‑ hostname1: service-name-A
‑ hostname2: service-name-B
EPIPE Desc:
‑ hostname1: description-A
‑ hostname2: description-B
Spoke‑Sdp: 1005:2043
```

- Service ID, Name, Description, Spoke-SDP 정보 표시
- **멀티호스트 고유값 표시**: 동일 serviceId를 가진 여러 호스트의 Name/Description이 다를 경우, 헤더(`EPIPE Name:`) 아래에 `‑ hostname: value` 형식의 들여쓰기 목록으로 표시한다. 고유값이 1개면 인라인(`EPIPE Name: value`)으로 표시. (중복값은 1회만 표시)
- 값이 있는 것만 표시
- Spoke-SDP는 SAP 노드가 아닌 **서비스 노드에만** 표시 (동일 데이터의 중복 방지)

### 2.4 Ethernet 하위 필드 파싱 소스

| 필드 | 파싱 위치 | Nokia Config 예시 |
|---|---|---|
| Mode | `port > ethernet > mode` | `mode access` |
| MTU | `port > ethernet > mtu` | `mtu 9212` |
| Speed | `port > ethernet > speed` | `speed 10000` |
| AutoNego | `port > ethernet` | `no autonegotiate` |
| Network | `port > ethernet > network > queue-policy` | `queue-policy "voice_qos"` |
| LLF | `service > sap > ethernet > llf` | `llf` (키워드 존재 여부) |
| LLDP | `port > ethernet > lldp > dest-mac > admin-status` | `admin-status tx-rx` |

---

## 3. VPLS 다이어그램

### 3.1 호스트 노드 (SAP Node)

→ 2.2 Epipe 호스트 노드 참조 (SAP + QoS + Port + Ethernet 구조 동일)

**VPLS 고유 차이점:**
- **VLAN 정보 표시**: SAP에 VLAN ID가 있으면 표시 (Epipe는 VLAN 미표시)
- **SAP 노드에는 SAP/QoS/Port/Ethernet 정보만 표시** — Spoke-Sdp, Mesh-Sdp, MAC-MOVE는 별도 SDP 정보 노드에 표시 (→ 3.2 참조)


### 3.2 SDP 정보 노드 (서비스 레벨)

SAP과 Mesh-Sdp/Spoke-Sdp는 Nokia config에서 **형제 관계** (VPLS 서비스 아래 동등한 레벨)이므로, SAP 노드와 분리하여 **별도 노드**로 표시한다.

```
Spoke‑Sdp: 6320:4050
Mesh‑Sdp: 6410:4050
MAC-MOVE: Detected
```

- 각 호스트 서브그래프 안에 **흰색 배경** 노드로 표시
- `classDef svcinfo fill:#fff9c4,stroke:#f9a825,stroke-width:2px`
- Spoke-Sdp, Mesh-Sdp, MAC-MOVE 중 값이 있는 것만 표시
- `sdpId:vcId` 기준 중복 제거 적용
- SDP 정보가 하나도 없으면 노드 자체를 생성하지 않음

### 3.3 서비스 노드

```
Service: VPLS 5000
VPLS Name: office-lan-sw1
VPLS Desc: Office LAN
```

**멀티호스트 Name/Desc가 다를 경우:**
```
Service: VPLS 5000
VPLS Name:
‑ hostname1: office-lan-sw1
‑ hostname2: office-lan-sw2
VPLS Desc:
‑ hostname1: Office LAN Host-A
‑ hostname2: Office LAN Host-B
```

- Service ID, Name, Description 표시
- **멀티호스트 고유값 표시**: 동일 serviceId를 가진 여러 호스트의 Name/Description이 다를 경우, 헤더(`VPLS Name:`) 아래에 `‑ hostname: value` 형식의 들여쓰기 목록으로 표시한다. 고유값이 1개면 인라인(`VPLS Name: value`)으로 표시. (중복값은 1회만 표시)
- Spoke-Sdp, Mesh-Sdp, MAC-MOVE는 호스트 종속이므로 서비스 노드에 표시하지 않음

### 3.4 호스트 정렬 및 멀티 SAP

**호스트 정렬:**
- 여러 호스트(config 파일)가 동일 VPLS에 참여할 경우, **hostname 기준 오름차순 정렬**하여 렌더링한다. (예: nokia-1 → nokia-2)

**멀티 SAP:**
- 하나의 호스트에 여러 SAP이 설정된 경우, **각 SAP이 개별 노드(박스)**로 표시된다.
- 각 SAP 노드에는 해당 SAP의 고유 정보(SAP ID, QoS, Port, Ethernet)가 표시된다.
- 예: VPLS에 SAP `3/1/24:1049` (인터링크)와 SAP `3/2/4` (고객 포트)가 있으면, 같은 호스트 서브그래프 안에 2개의 SAP 노드가 생성된다.

### 3.5 Hub-Spoke 레이아웃

VPLS에 여러 호스트가 참여할 때, **SDP(Mesh + Spoke) 합산 개수가 가장 많은 호스트를 Hub(코어 장비)**로 자동 감지하여 레이아웃을 최적화한다.

**감지 조건:**
- 호스트가 2대 이상
- SDP 합산(Mesh-Sdp + Spoke-Sdp)이 가장 많은 호스트가 **유일**해야 함 (동률이면 Flat 레이아웃)
- Hub 호스트에 SAP이 1개 이상 존재
- Mesh-Sdp만 있는 경우, Spoke-Sdp만 있는 경우 모두 감지 가능

**Hub-Spoke 레이아웃:**
```
[Spoke 1 (액세스)] --> [Hub (코어)] --> [VPLS 서비스 정보]
[Spoke 2 (액세스)] -->
```

- 왼쪽: Spoke 호스트 서브그래프 (액세스 장비)
- 중간: Hub 호스트 서브그래프 (코어 장비)
- 오른쪽: VPLS 서비스 정보 노드
- Spoke SAPs → Hub 첫 번째 SAP (plain arrow, QoS는 각 SAP 노드 안에)
- Hub SAPs → VPLS 서비스 (plain arrow, QoS는 각 SAP 노드 안에)

**Flat 레이아웃 (Hub 미감지 시):**
```
[Host A] --> [VPLS 서비스 정보]
[Host B] -->
[Host C] -->
```

### 3.6 QoS 표시

→ 1.2 QoS 표시 규칙 참조 (Epipe/VPLS 공통)

- 연결선에 QoS를 표시하지 않는 이유: QoS는 SAP 포트(고객 연결)에 설정되며, 장비 간 터널(Mesh-Sdp/Spoke-Sdp)에 설정되는 것이 아님

---

## 4. VPRN 다이어그램

### 4.1 전체 레이아웃

VPRN 다이어그램은 3단 레이아웃을 사용한다:

```
[Host Subgraph]         [Routing Nodes]         [Service Node]

 Interface A ---------> BGP Node ────────────> Service Info
 Interface B ---------> OSPF Node ───────────>
 Interface C ---------> STATIC (NH1) ────────>
 Interface D ---------> STATIC (NH2) ────────>
 Interface E ─────────────────────────────────> (direct)
```

- **왼쪽**: Host 서브그래프 (Interface 노드들)
- **중간**: 라우팅 중간 노드 (BGP, OSPF, STATIC)
- **오른쪽**: Service 노드 (VPRN 기본 정보만)

### 4.2 호스트 노드 (Interface 중심)

Interface를 최상위 헤더로, SAP+QoS를 하위 항목으로 표시한다.

```
Interface: p4/2/13
- Desc: To_FG60E_2
- IP: 192.168.123.2/30
- VRRP: 10.230.62.89 (MASTER)
- VPLS: vpls-name
- SAP: 4/2/13:0
  - In‑QoS: 100M
  - Out‑QoS: 100M
- Port: 4/2/13
  - Desc: TO-CUSTOMER
  - Ethernet:
    - Mode: access
    - MTU: 9212
    - Speed: 100
    - AutoNego: NO
    - Network: queue-policy-name
    - LLF: On
    - LLDP: admin-status
- IP‑MTU: 1504
- Spoke‑Sdp: 9990:4019
```

**규칙:**
- **Interface가 최상위 헤더** — Interface Name을 첫 줄에 굵게 표시
- Desc, IP, VRRP, VPLS, SAP, Port, IP-MTU, Spoke-Sdp는 Interface 하위 항목으로 들여쓰기
- **VRRP 표시**: priority ≥ 100 → `MASTER`, < 100 → `BACKUP`
- **SAP + QoS**: SAP ID를 굵게 표시, In-QoS/Out-QoS를 하위 항목으로 들여쓰기 (→ 1.2 QoS 표시 규칙 참조)
- **Port**: SAP ID에서 `:` 이전 부분만 표시 (예: `4/2/13:0` → Port: `4/2/13`)
- **값이 없는 필드는 생략** (표시하지 않음)
- 연결선은 plain arrow (`-->`) — QoS 라벨 없음

### 4.3 라우팅 중간 노드

BGP/OSPF/STATIC 정보를 서비스 노드에서 분리하여 **별도 중간 노드**로 표시한다.
인터페이스와의 관계를 서브넷/이름 매칭으로 자동 연결한다.

#### 4.3.1 BGP 노드

```
BGP:
- Router‑ID: 192.168.25.1
- Split‑Horizon: On
- Group: group-name
  - Peer: 10.0.0.1
  - Peer‑AS: 65001
```

**매칭 규칙**: BGP Peer IP → 인터페이스의 `ipAddress` 서브넷에 포함 여부 (`isIpInSubnet`)
- 하나의 BGP 노드에 모든 BGP 정보 통합
- Router-ID, Split-Horizon, Group/Peer 정보 표시

#### 4.3.2 OSPF 노드

```
OSPF:
- Area: 0.0.0.0
  - Interface:
    - p3/2/23: point-to-point
    - system_vrf
```

**매칭 규칙**: OSPF Area의 interface name → L3Interface의 `interfaceName` 직접 비교
- 하나의 OSPF 노드에 모든 OSPF Area/Interface 정보 통합

#### 4.3.3 STATIC 노드 (Next-Hop별 분리)

```
STATIC: 20개
Next‑Hop: 192.168.100.1
- 10.1.0.0/24
- 10.2.0.0/24
```

**매칭 규칙**: Static Route의 Next-Hop → 인터페이스의 `ipAddress` 서브넷에 포함 여부 (`isIpInSubnet`)
- **Next-Hop별로 별도 노드 생성** (같은 Next-Hop의 route는 하나의 노드에 그룹화)
- 각 STATIC 노드는 매칭된 인터페이스에 연결
- **Next-Hop**은 볼드체로 표시
- Static Route 갯수를 카운트하여 정보를 표시

### 4.4 연결선 규칙

1. 인터페이스가 BGP/OSPF/STATIC 중 **하나 이상에 매칭** → 매칭된 라우팅 노드에만 연결
2. **어떤 라우팅에도 매칭되지 않는 인터페이스** → 서비스 노드에 직접 연결 (`-->`)
3. **라우팅 노드 → 서비스 노드** 연결 (`-->`)
4. 모든 연결선은 plain arrow (`-->`)

### 4.5 서비스 노드

```
Service: service-name
VPRN: 3093
VPRN Desc: description
ECMP: 16
AS NO: 65030
RD: 65030:103001
VRF‑TARGET: target:65030:103001
```

**규칙:**
- Service Name이 있으면 첫 줄에 표시, 없으면 생략
- **ECMP**: `ecmp N` 값 표시
- **AS NO**: autonomous-system 번호
- **RD**: route-distinguisher
- **VRF-TARGET**: vrf-target 값
- **BGP/OSPF/STATIC 정보는 서비스 노드에 포함하지 않음** (라우팅 중간 노드로 분리)
- 값이 있는 필드만 표시

---

## 5. IES 다이어그램

### 5.1 V1 스타일

IES는 V1 어댑터를 통해 다이어그램을 생성한다.
- `v1IESAdapter.ts`에서 IESService → NokiaDevice 변환
- V1의 Single/HA Combined 다이어그램 재사용

### 5.2 다이어그램 구조

```
[Local Host] --QoS--> [Next-Hop] -..-> [Customer Network]
```

**Single 다이어그램:**
- 왼쪽: Host 서브그래프 (buildNodeLabel)
- 중앙: Next-Hop (Peer IP)
- 오른쪽: Customer Network (Static Route destinations)

**HA Combined 다이어그램:**
- 왼쪽: Local Hosts (여러 개)
- 중앙: Remote HA Pair (각 Peer IP)
- 오른쪽: 공통 Customer Network

### 5.3 호스트 노드

```
Host: PE-Router-1

Interface: p4/2/13
- Desc: To_FG60E_2
- IP: 192.168.123.2/30
- VRRP: 10.230.62.89 (MASTER)
- VPLS: vpls-name
- SAP: 4/2/13
- Port: 4/2/13
  - Desc: TO-CUSTOMER
  - Ethernet:
    - Mode: access
    - MTU: 9212
    - Speed: 100
    - AutoNego: NO
    - Network: queue-policy-name
    - LLF: On
    - LLDP: admin-status
- IP‑MTU: 1504
- Spoke‑Sdp: 9990:4019
```

**규칙:**
- **Interface가 최상위 헤더** — Interface Name을 첫 줄에 표시
- Desc, IP, VRRP, VPLS, SAP, Port, IP-MTU, Spoke-Sdp는 Interface 하위 항목으로 들여쓰기
- **VRRP 표시**: priority ≥ 100 → `MASTER`, < 100 → `BACKUP`
- **SAP**: SAP ID만 표시 (QoS는 연결선에 표시 → 5.5 참조)
- **Port**: SAP ID에서 `:` 이전 부분만 표시 (예: `4/2/13:0` → Port: `4/2/13`)
- **Ethernet**: 하위 필드가 1개 이상일 때만 헤더 표시, 값이 있는 필드만 렌더링
- **값이 없는 필드는 생략** (N/A 표시하지 않음)

### 5.4 HA 감지 규칙

- **Static Route 기반**: 두 인터페이스의 `relatedRoutes`에 공통 Customer Network이 있으면 HA 페어
- **Cross-Device 지원**: 서로 다른 호스트(config 파일)의 IES 인터페이스도 HA 감지 가능
- VRRP Priority ≥ 100이면 Master, < 100이면 Backup

### 5.5 QoS 표시

- 항상 In-QoS / Out-QoS 모두 표시
- 없으면 `Default`
- `<div class='qos-label'>` 래핑 (녹색 배경)

### 5.6 IES 0 (Base Router) 필터링 규칙

`parserV3.ts`에서 `router Base`의 인터페이스를 IES 0으로 자동 생성할 때, 아래 필터를 적용한다.

**배경**: MPLS 장비의 backbone/trunk/system 인터페이스가 "인터넷 서비스"로 잘못 분류되는 노이즈를 제거하기 위함.

**필터 조건 (모두 충족해야 IES 0에 포함):**

| # | 조건 | 제외 대상 예시 |
|---|------|--------------|
| 1 | 인터페이스 이름이 `"system"`이 아닐 것 | system loopback |
| 2 | IP 주소가 있을 것 | 설정 중인 인터페이스 |
| 3 | 연관된 static route가 있을 것 (next-hop이 해당 인터페이스 서브넷에 포함) | backbone/trunk 링크 |

**IES 0 생성 조건:**
- 필터 통과 인터페이스가 1개 이상일 때만 IES 0을 생성한다.
- 필터 통과 인터페이스가 0개면 IES 0을 생성하지 않는다.

**Global Static Route 전파:**
- `router Base`의 static routes는 같은 config 내 명시적 IES 서비스 (serviceId > 0)에도 병합된다 (중복 제거).
- 이를 통해 IES 0이 생성되지 않더라도 HA 감지에 필요한 static route 정보가 유지된다.

**명시적 IES 서비스 (serviceId > 0):**
- `ies N customer N create` 블록의 인터페이스는 필터링하지 않는다.
- 운영자가 의도적으로 구성한 서비스이므로 모두 유지.

---

## 6. 파싱 규칙 (Parser)

### 6.0 SAP 블록 추출

파일: `src/utils/v3/parserV3.ts` → `parseSAPs()`

서비스 블록 내 모든 SAP을 **위치 기반**으로 추출한다.

**추출 방식:**
1. `sap <id> create` 키워드로 모든 SAP 시작 위치를 수집
2. 각 SAP의 내용 = 현재 `create` 이후 ~ 다음 SAP 시작 위치 (또는 서비스 블록 끝)

**adminState 판정:**
- SAP 내용에서 SAP 자체의 첫 번째 `exit` 이전 텍스트만 검사
- `shutdown` 포함 && `no shutdown` 미포함 → `'down'`
- 그 외 → `'up'` (기본값)
- 서비스 레벨의 `no shutdown`이 마지막 SAP 내용에 혼입되는 것을 방지하기 위해, SAP의 `exit` 이전까지만 검사

**SAP ID 형식:**
- VLAN 포함: `3/1/24:1049` → portId: `3/1/24`, vlanId: `1049`
- VLAN 없음: `3/2/4` → portId: `3/2/4`, vlanId: `0`

### 6.1 Port Ethernet Config

파일: `src/utils/v3/parserV3.ts` → `extractPortInfo()`

Nokia config의 `port` 블록에서 아래 정보를 추출한다:

```
port 1/1/1
    description "TO-CUSTOMER"
    ethernet
        mode access
        encap-type dot1q
        mtu 9212
        speed 10000
        no autonegotiate
        network
            queue-policy "policy-name"
        exit
        lldp
            dest-mac nearest-bridge
                admin-status tx-rx
            exit
        exit
    exit
exit
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `mode` | string | `access` 또는 `network` |
| `encapType` | string | 예: `dot1q` |
| `mtu` | number | Port MTU (예: 9212) |
| `speed` | string | 예: `10000` |
| `autonegotiate` | string | 예: `no` |
| `networkQueuePolicy` | string | network 하위 queue-policy |
| `lldp` | string | LLDP admin-status (예: `tx-rx`) |

### 6.2 SAP LLF (Link Loss Forwarding)

파일: `src/utils/v3/parserV3.ts` → `parseSAPs()`

SAP 블록 내 `ethernet > llf` 키워드 존재 여부로 판단:

```
sap 1/1/1:100 create
    ethernet
        llf
    exit
exit
```

- 정규식: `/ethernet\s[\s\S]*?llf/i`
- 결과: `sap.llf = true`

### 6.3 VPLS MAC-MOVE

파일: `src/utils/v3/parserV3.ts` → `parseVPLS()`

VPLS 서비스 블록 내 `mac-move` 키워드 존재 여부:

```
vpls 5000
    mac-move
        primary-ports
            sap 1/1/1:100
        exit
        secondary-ports
            sap 1/1/2:100
        exit
    exit
exit
```

- 정규식: `/mac-move\b/i`
- 결과: `vpls.macMoveShutdown = true`

### 6.4 QoS 정책 Rate 파싱

파일: `src/utils/v3/parserV3.ts` → `parseQosPolicyDefinitions()`

SAP에서 참조하는 QoS 정책 ID의 실제 rate(속도)를 파싱하여 KMG 단위로 다이어그램에 표시한다.

#### 6.4.1 QoS 정책 선언 형식 (장비별)

Nokia 장비 버전에 따라 `sap-ingress` / `sap-egress` 선언 문법이 다르다:

| 선언 형식 | 장비 |
|---|---|
| `sap-ingress <ID> create` | 전 장비 (7210SAS, Nokia 네트워크 장비, 7450ESS, 7705SAR) |
| `sap-ingress <ID> name "<NAME>" create` | Nokia 네트워크 장비 |
| `sap-egress <ID> create` | Nokia 네트워크 장비, 7450ESS |
| `sap-egress <ID> name "<NAME>" create` | Nokia 네트워크 장비 |

- 파서 정규식: `/sap-(ingress|egress)\s+(\d+)(?:\s+name\s+"[^"]*")?\s+create/`
- `name` 필드는 선택적(optional)으로 처리

#### 6.4.2 Rate 형식 (장비별)

장비 플랫폼에 따라 QoS 내부 구조(queue vs meter)와 rate 문법이 다르다:

**Nokia 네트워크 장비 / 7450ESS / 7705SAR** — Queue 기반:
```
sap-ingress 10 create
    queue 1 create
        rate 10000                    ← Format 1: rate <PIR>
    exit
    queue 2 expedite create
        rate 10000 cir 10000          ← Format 2: rate <PIR> cir <CIR>
    exit
exit
```

**7210SAS** — Meter 기반:
```
sap-ingress 2 create
    num-qos-classifiers 2
    meter 1 create
        rate cir 2000 pir 2000        ← Format 3: rate cir <CIR> pir <PIR>
    exit
exit
```

**Unlimited (전 장비)**:
```
rate max cir max                      ← Format 4: Nokia 네트워크 장비/7450ESS/7705SAR
rate cir max                          ← Format 5: 7210SAS
```

| Rate 형식 | 장비 | 파싱 방법 |
|---|---|---|
| `rate 10000` | Nokia 네트워크 장비, 7450ESS, 7705SAR | `rate\s+(\d+)` → PIR |
| `rate 10000 cir 10000` | Nokia 네트워크 장비, 7705SAR | `rate\s+(\d+)` → PIR |
| `rate cir 2000 pir 2000` | 7210SAS | `pir\s+(\d+)` → PIR |
| `rate max cir max` | Nokia 네트워크 장비, 7450ESS, 7705SAR | `max` 감지 → rateMax |
| `rate cir max` | 7210SAS | `max` 감지 → rateMax |

#### 6.4.3 Rate 표시 형식 (KMG 변환)

파싱된 PIR (kbps) 값을 K/M/G 단위로 변환하여 표시:

| PIR (kbps) | 표시 | 비고 |
|---|---|---|
| 2,000 | `2M` | 2,000 / 1,000 = 2 |
| 15,000 | `15M` | 15,000 / 1,000 = 15 |
| 100,000 | `100M` | 100,000 / 1,000 = 100 |
| 500,000 | `500M` | |
| 1,000,000 | `1G` | 1,000,000 / 1,000,000 = 1 |
| max | `Max` | 속도 제한 없음 |
| (정의 없음) | `15` | policy ID만 표시 (fallback) |

- 함수: `formatRateKMG()` (`mermaidGeneratorV3.ts`)
- Rate 파싱 실패 시 (config에 정책 정의 블록 없음) policy ID 숫자만 표시

#### 6.4.4 QoS Rate 주입 (Injection)

`parseL2VPNConfig()`에서 QoS 정책 맵을 생성하고 SAP 객체에 주입:

1. `parseQosPolicyDefinitions(configText)` → `Map<'ingress-{id}' | 'egress-{id}', { rate?, rateMax? }>`
2. 각 SAP의 `ingressQos.policyId` → `qosPolicyMap.get('ingress-{id}')` → `ingressQos.rate` 주입
3. 각 SAP의 `egressQos.policyId` → `qosPolicyMap.get('egress-{id}')` → `egressQos.rate` 주입

#### 6.4.5 sap-egress 참고사항

- `sap-egress` 정의는 Nokia 네트워크 장비, 7450ESS에서만 발견됨 (전체 config 중 소수)
- 대부분의 SAP은 `egress` 블록에 `qos` 참조가 없음 → egress QoS 미표시
- `sap-egress`의 rate는 `rate <number>` (단순 형식)만 사용

### 6.5 Port 정보 주입 (Injection)

파싱된 Port Ethernet 정보는 아래 경로로 각 서비스 객체에 주입된다:

1. **SAP** (Epipe, VPLS): `sap.portId` → `portInfoMap.get(portId)` → `sap.portEthernet`
2. **L3Interface** (VPRN, IES): `intf.portId` (`:` 이전 부분) → `portInfoMap.get(rawPort)` → `intf.portEthernet`
3. **Base Router Interface**: 동일한 로직으로 `baseInterfaces`에 주입
4. **V1 Adapter 변환 시**: `portEthernet` 필드를 NokiaInterface로 pass-through

---

## 7. 다이어그램 분리 정책 (Splitting Policy)

### 7.1 Epipe

| 조건 | 동작 |
|---|---|
| 동일 SDP → 여러 호스트 | 하나의 다이어그램에 통합 |
| 다른 SDP → 여러 호스트 | **SDP별로 별도 다이어그램 분리** |
| SDP 없음 (SAP-SAP only) | 하나의 다이어그램 |

- 분리 키: `{spokeSdp[0].sdpId}:{spokeSdp[0].vcId}`
- 처리 위치: `V3Page.tsx` → Epipe 서비스 SDP 그룹화

### 7.2 VPLS

- VPLS는 Multipoint 서비스이므로, 동일 serviceId의 모든 호스트를 하나의 다이어그램에 통합

### 7.3 VPRN

- 동일 serviceId의 모든 호스트를 하나의 다이어그램에 통합 (V3 네이티브)
- `generateVPRNDiagram()`에서 배열로 전달된 VPRN 서비스를 단일 다이어그램으로 렌더링

### 7.4 IES

- V1 어댑터의 HA 감지를 통해 자동 분리 (VPRN과 동일)
- Cross-Device HA 지원: 여러 config 파일의 IES 인터페이스를 통합 비교

---

## 8. 타입 정의 요약

### PortEthernetConfig (`src/types/v2.ts`)

```typescript
interface PortEthernetConfig {
    mode?: string;
    encapType?: string;
    mtu?: number;
    speed?: string;
    autonegotiate?: string;
    networkQueuePolicy?: string;
    lldp?: string;
}
```

### QosPolicy (`src/types/v2.ts`)

```typescript
interface QosPolicy {
    policyId: number;
    policyName: string;
    rate?: number;          // Rate in kbps (from sap-ingress/sap-egress policy definition)
    rateMax?: boolean;      // true if rate is "max" (unlimited)
}
```

### SAP 추가 필드

```typescript
interface SAP {
    // ...기존 필드...
    ingressQos?: QosPolicy;     // SAP ingress QoS (with rate from policy definition)
    egressQos?: QosPolicy;      // SAP egress QoS (with rate from policy definition)
    llf?: boolean;
    portEthernet?: PortEthernetConfig;
}
```

### VPLSService 추가 필드

```typescript
interface VPLSService {
    // ...기존 필드...
    macMoveShutdown?: boolean;
}
```

### L3Interface 추가 필드

```typescript
interface L3Interface {
    // ...기존 필드...
    portEthernet?: PortEthernetConfig;
}
```

### NokiaInterface 추가 필드 (V1 호환)

```typescript
interface NokiaInterface {
    // ...기존 필드...
    portEthernet?: { mode?: string; encapType?: string; mtu?: number; speed?: string; autonegotiate?: string; networkQueuePolicy?: string; lldp?: string };
    mtu?: number;                // IP-MTU
    vplsName?: string;           // Routed VPLS binding
    spokeSdpId?: string;         // Spoke-SDP ID
    sapId?: string;              // SAP ID (e.g., "4/2/13:0")
    ingressQosRate?: number;     // QoS rate (kbps)
    ingressQosRateMax?: boolean;
    egressQosRate?: number;
    egressQosRateMax?: boolean;
}
```

---

## 9. 관련 파일 맵

| 파일 | 역할 |
|---|---|
| `src/types/v2.ts` | V2/V3 서비스 타입 정의 |
| `src/types.ts` | V1 타입 정의 (NokiaInterface 등) |
| `src/utils/v3/parserV3.ts` | Config 파싱 (LLF, MAC-MOVE, Port Ethernet, QoS Rate) |
| `src/utils/v3/mermaidGeneratorV3.ts` | Epipe, VPLS, VPRN 다이어그램 생성 |
| `src/utils/mermaidGenerator.ts` | V1 스타일 다이어그램 생성 (IES HA용) |
| `src/utils/v1IESAdapter.ts` | IES → V1 변환 + 다이어그램 생성 |
| `src/utils/v1VPRNAdapter.ts` | VPRN → V1 변환 (legacy, 서비스 목록 표시용) |
| `src/pages/V3Page.tsx` | 다이어그램 오케스트레이션 (SDP 분리 등) |
| `src/components/v2/ServiceDiagram.tsx` | 다이어그램 카드 UI 렌더링 |
