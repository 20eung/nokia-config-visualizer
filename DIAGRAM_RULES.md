# Diagram Generation Rules (다이어그램 생성 규칙)

> 이 문서는 Nokia Config Visualizer v3에서 다이어그램을 생성할 때 적용되는 표준 규칙을 정의합니다.
> 모든 서비스 타입(Epipe, VPLS, VPRN, IES)에 공통적으로 적용되는 규칙과 각 서비스별 고유 규칙을 포함합니다.

**Last Updated**: 2026-02-14
**적용 버전**: v3.1.x+

---

## 1. 공통 규칙

### 1.1 카드 타이틀 (Card Title)

다이어그램 카드 상단에 표시되는 제목 형식.

| 서비스 타입 | 타이틀 형식 | 예시 |
|---|---|---|
| **Epipe** | `EPIPE {serviceId}: {description}` | `EPIPE 2043: TO-CustomerA` |
| **VPLS** | `VPLS {serviceId}: {description}` | `VPLS 5000: OFFICE-LAN` |
| **VPRN** | `VPRN {serviceId}: {description}` | `VPRN 3093: VPN-CustomerB` |
| **IES** | `{hostname} - {interfaceDesc}` | `PE-Router-1 - TO-CE-Switch` |

- 구분자는 `: ` (콜론 + 공백)을 사용한다. (` - ` 아님)
- description이 없으면 서비스 ID만 표시한다. (예: `EPIPE 2043`)
- IES는 인터페이스 단위로 다이어그램이 생성되므로, 타이틀 우선순위:
  1. Interface Description
  2. Port Description
  3. Interface Name (fallback)

### 1.2 QoS 표시 규칙

- **Epipe/VPLS**: QoS는 **SAP 하위 항목**으로 SAP 노드 안에 표시. config에 QoS가 있는 경우만 표시, 없으면 생략.
- **VPRN/IES**: 연결선(edge label)에 표시 (기존 방식 유지)
- Nokia config에서 QoS는 `sap` 블록 안의 `ingress qos` / `egress qos`에 설정됨

```
SAP: 3/1/12
  - In‑QoS: 400
  - Out‑QoS: 400
```

### 1.3 텍스트 표시 규칙

- **Non-breaking space** (`\u00A0`): 줄바꿈 방지가 필요한 곳에 사용
- **Non-breaking hyphen** (`\u2011`): 하이픈이 줄바꿈 지점이 되지 않도록 함
- **HTML 특수문자**: `&`, `<`, `>`, `"` 는 반드시 이스케이프 처리
- **값이 없는 필드는 표시하지 않는다** (N/A 아님). 데이터가 있는 항목만 렌더링.

### 1.4 다이어그램 레이아웃

- Mermaid `graph LR` (좌→우) 레이아웃 사용
- 왼쪽: Host 서브그래프 (Local 장비 정보)
- 중앙/오른쪽: Service 노드 또는 Remote 장비
- 노드 ID는 `sanitizeNodeId()`로 특수문자 제거하여 안전하게 생성

### 1.5 스타일 클래스

| classDef | 용도 | 스타일 |
|---|---|---|
| `default` | 일반 노드 | 흰색 배경, 검정 테두리 |
| `service` | 서비스 노드 | 연한 파란색 배경 (`#e3f2fd`) |
| `qos` | QoS 라벨 | 녹색 배경 (`#4caf50`), 흰색 텍스트 |
| `iface` | VPRN 인터페이스 | 연한 주황색 배경 (`#fff3e0`) |
| `route` | Static Route | 연한 보라색 배경 (`#f3e5f5`) |
| `redBox` | BGP/OSPF 정보 | 빨간 테두리 |

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
  - In‑QoS: 400
  - Out‑QoS: 400
Port: 3/1/12
Port Desc: TO-CUSTOMER-SW
Ethernet:
  - Mode: access
  - MTU: 9212
  - SPEED: 10000
  - AUTONEGO: limited
  - NETWORK: queue-policy-name
  - LLF: On
  - LLDP: tx-rx
```

**규칙:**
- **QoS는 SAP 하위 항목으로 표시** — Nokia config에서 `sap` 블록 안에 `ingress qos` / `egress qos`가 있으므로, SAP ID 바로 아래에 들여쓰기하여 표시. config에 QoS가 없으면 생략.
- **VLAN 정보는 표시하지 않는다.**
- **Spoke-SDP 정보는 표시하지 않는다.** (서비스 노드에서 표시)
- **Ethernet** 헤더 아래에 하위 필드를 들여쓰기(`  - `)하여 표시
- Ethernet 하위 필드 중 **값이 있는 것만 표시** (없으면 생략)
- Ethernet 하위 필드가 하나도 없으면 Ethernet 헤더 자체를 표시하지 않는다.
- 연결선은 plain arrow (`-->`) — QoS 라벨 없음

### 2.3 서비스 노드

```
Service: EPIPE 2043
EPIPE Name: service-name
EPIPE Desc: description
Spoke‑Sdp: 1005:2043
```

- Service ID, Name, Description, Spoke-SDP 정보 표시
- 값이 있는 것만 표시
- Spoke-SDP는 SAP 노드가 아닌 **서비스 노드에만** 표시 (동일 데이터의 중복 방지)

### 2.4 Ethernet 하위 필드 파싱 소스

| 필드 | 파싱 위치 | Nokia Config 예시 |
|---|---|---|
| Mode | `port > ethernet > mode` | `mode access` |
| MTU | `port > ethernet > mtu` | `mtu 9212` |
| SPEED | `port > ethernet > speed` | `speed 10000` |
| AUTONEGO | `port > ethernet > autonegotiate` | `autonegotiate limited` |
| NETWORK | `port > ethernet > network > queue-policy` | `queue-policy "policy-1"` |
| LLF | `service > sap > ethernet > llf` | `llf` (키워드 존재 여부) |
| LLDP | `port > ethernet > lldp > dest-mac > admin-status` | `admin-status tx-rx` |

---

## 3. VPLS 다이어그램

### 3.1 호스트 노드 (SAP Node)

```
SAP: 3/2/15
  - In‑QoS: 100
  - Out‑QoS: 100
Port: 3/2/15
Port Desc: TO-SWITCH
VLAN: 200
Ethernet:
  - Mode: access
  - MTU: 9212
  - SPEED: 10000
  - AUTONEGO: limited
  - NETWORK: queue-policy-name
  - LLF: On
  - LLDP: tx-rx
```

**규칙:**
- **QoS는 SAP 하위 항목으로 표시** — Nokia config에서 `sap` 블록 안에 `ingress qos` / `egress qos`가 있으므로, SAP ID 바로 아래에 들여쓰기하여 표시. config에 QoS가 없으면 생략.
- **VLAN 0인 경우 표시하지 않는다.** VLAN이 0이 아닌 경우에만 표시.
- **SAP Desc는 표시하지 않는다.** (Epipe와 동일)
- **Ethernet** 헤더 아래에 하위 필드를 들여쓰기(`  - `)하여 표시 (Epipe와 동일 형식)
- Ethernet 하위 필드 중 **값이 있는 것만 표시** (없으면 생략)
- Ethernet 하위 필드가 하나도 없으면 Ethernet 헤더 자체를 표시하지 않는다.
- **SAP 노드에는 SAP/QoS/포트/Ethernet 정보만 표시** — Spoke-Sdp, Mesh-Sdp, MAC-MOVE는 별도 SDP 정보 노드에 표시

### 3.2 SDP 정보 노드 (서비스 레벨)

SAP과 Mesh-Sdp/Spoke-Sdp는 Nokia config에서 **형제 관계** (VPLS 서비스 아래 동등한 레벨)이므로, SAP 노드와 분리하여 **별도 노드**로 표시한다.

```
Mesh‑Sdp: 6320:4050
Mesh‑Sdp: 6410:4050
MAC-MOVE: Detected
```

- 각 호스트 서브그래프 안에 **노란색 배경** 노드로 표시
- `classDef svcinfo fill:#fff9c4,stroke:#f9a825,stroke-width:2px`
- Spoke-Sdp, Mesh-Sdp, MAC-MOVE 중 값이 있는 것만 표시
- `sdpId:vcId` 기준 중복 제거 적용
- SDP 정보가 하나도 없으면 노드 자체를 생성하지 않음

### 3.3 서비스 노드

```
Service: VPLS 5000
VPLS Name: office-lan
VPLS Desc: Office LAN Service
```

- Service ID, Name, Description만 표시
- Spoke-Sdp, Mesh-Sdp, MAC-MOVE는 호스트 종속이므로 서비스 노드에 표시하지 않음

### 3.3 Hub-Spoke 레이아웃

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
- 연결선에 QoS를 표시하지 않는 이유: QoS는 SAP 포트(고객 연결)에 설정되며, 장비 간 터널(Mesh-Sdp/Spoke-Sdp)에 설정되는 것이 아님

**Flat 레이아웃 (Hub 미감지 시):**
```
[Host A] --> [VPLS 서비스 정보]
[Host B] -->
[Host C] -->
```

### 3.4 QoS 표시

- QoS는 **SAP 하위 항목**으로 SAP 노드 안에 표시한다. (연결선 라벨이 아님)
- Nokia config에서 `sap` 블록 안에 `ingress qos` / `egress qos`가 있으므로 config 구조에 맞춤
- **config에 QoS가 있는 경우만 표시**, 없으면 생략 (Default 표시 안 함)
- 연결선에 QoS를 표시하지 않는 이유: QoS는 SAP 포트(고객 연결)에 설정되며, 장비 간 터널(Mesh-Sdp/Spoke-Sdp)에 설정되는 것이 아님

---

## 4. VPRN 다이어그램

### 4.1 V1 스타일 (HA 감지 포함)

VPRN은 V1 어댑터를 통해 다이어그램을 생성한다.
- `v1VPRNAdapter.ts`에서 L3Interface → NokiaInterface 변환
- V1의 `generateSingleInterfaceDiagram()` / `generateCombinedHaDiagram()` 재사용
- Static Route 기반 HA 페어 자동 감지

### 4.2 호스트 노드

```
Host: PE-Router-1

Port: 1/1/3 (TO-CE-Router)
Ethernet: access / encap-type: dot1q
Port MTU: 9212

Interface: TO-CE-VPN (VPN Customer A)

IP: 10.0.0.1/30
(VIP: 10.0.0.3)

Service: VPRN 3093 (VPN Customer A)
```

### 4.3 VPRN 전용 다이어그램 (V3 네이티브)

직접 `mermaidGeneratorV3.ts`에서 생성하는 경우:

**인터페이스 노드:**
```
Interface: TO-CE-Router
Desc: Customer A
IP: 10.0.0.1/30
(VIP: 10.0.0.3)
SAP: 1/1/3:100
Port Desc: TO-CE-SWITCH
Ethernet: access / encap-type: dot1q
Port MTU: 9212
VPLS: vpls-name
SPOKE-SDP: 1005
MTU: 1500
---
Static Route: 10.1.0.1
Customer Network: 3
10.1.1.0/24
10.1.2.0/24
10.1.3.0/24
```

**서비스 노드:**
```
Service: VPRN 3093
VPRN Service Name: vpn-service
VPRN Desc: VPN Customer A
VRF: target:65000:3093
Customer: 1

[BGP 박스]
AS: 65000
RD: 65000:3093
Router-id: 10.255.0.1
Neighbor
- 10.0.0.2 (AS 65001)

[OSPF 박스]
Area 0.0.0.0
- int: TO-CE-Router
```

### 4.4 QoS 표시

- 인터페이스→서비스 연결선에 QoS 라벨 표시
- `ingressQosId` / `egressQosId` 값이 있으면 표시
- 없으면 QoS 라벨 없이 직접 연결 (`-->`)

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

Port: 1/1/1 (TO-CE-Switch)
Ethernet: access / encap-type: dot1q
Port MTU: 9212

Interface: TO-CE-LAN (Customer LAN)

IP: 10.0.0.1/30
(VIP: 10.0.0.3)

Service: IES 0 (Global Base Routing Table)
```

### 5.4 HA 감지 규칙

- **Static Route 기반**: 두 인터페이스의 `relatedRoutes`에 공통 Customer Network이 있으면 HA 페어
- **Cross-Device 지원**: 서로 다른 호스트(config 파일)의 IES 인터페이스도 HA 감지 가능
- VRRP Priority ≥ 100이면 Master (`*` 표시), < 100이면 Backup

### 5.5 QoS 표시

- 항상 In-QoS / Out-QoS 모두 표시
- 없으면 `Default`
- `<div class='qos-label'>` 래핑 (녹색 배경)

---

## 6. 파싱 규칙 (Parser)

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
        autonegotiate limited
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
| `autonegotiate` | string | 예: `limited` |
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
| `sap-ingress <ID> create` | 전 장비 (7210SAS, 7750SR, 7450ESS, 7705SAR) |
| `sap-ingress <ID> name "<NAME>" create` | 7750SR |
| `sap-egress <ID> create` | 7750SR, 7450ESS |
| `sap-egress <ID> name "<NAME>" create` | 7750SR |

- 파서 정규식: `/sap-(ingress|egress)\s+(\d+)(?:\s+name\s+"[^"]*")?\s+create/`
- `name` 필드는 선택적(optional)으로 처리

#### 6.4.2 Rate 형식 (장비별)

장비 플랫폼에 따라 QoS 내부 구조(queue vs meter)와 rate 문법이 다르다:

**7750SR / 7450ESS / 7705SAR** — Queue 기반:
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
rate max cir max                      ← Format 4: 7750SR/7450ESS/7705SAR
rate cir max                          ← Format 5: 7210SAS
```

| Rate 형식 | 장비 | 파싱 방법 |
|---|---|---|
| `rate 10000` | 7750SR, 7450ESS, 7705SAR | `rate\s+(\d+)` → PIR |
| `rate 10000 cir 10000` | 7750SR, 7705SAR | `rate\s+(\d+)` → PIR |
| `rate cir 2000 pir 2000` | 7210SAS | `pir\s+(\d+)` → PIR |
| `rate max cir max` | 7750SR, 7450ESS, 7705SAR | `max` 감지 → rateMax |
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

- `sap-egress` 정의는 7750SR, 7450ESS에서만 발견됨 (전체 config 중 소수)
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

- V1 어댑터의 HA 감지를 통해 자동 분리:
  - 공통 Static Route가 있는 인터페이스 → HA Combined 다이어그램
  - 나머지 → 개별 Single 다이어그램

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
    portEthernet?: { mode?: string; encapType?: string; mtu?: number; speed?: string; autonegotiate?: string };
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
| `src/utils/mermaidGenerator.ts` | V1 스타일 다이어그램 생성 (IES/VPRN HA용) |
| `src/utils/v1IESAdapter.ts` | IES → V1 변환 + 다이어그램 생성 |
| `src/utils/v1VPRNAdapter.ts` | VPRN → V1 변환 + 다이어그램 생성 |
| `src/pages/V3Page.tsx` | 다이어그램 오케스트레이션 (SDP 분리 등) |
| `src/components/v2/ServiceDiagram.tsx` | 다이어그램 카드 UI 렌더링 |
