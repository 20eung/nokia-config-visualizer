# 워크스루 - Nokia Config Visualizer (단계 1)

## 개요
Nokia Config Visualizer의 첫 번째 단계를 성공적으로 구현했습니다. 이 애플리케이션은 사용자가 Nokia 설정 파일을 업로드하고, 특정 인터페이스를 선택하여 네트워크 토폴로지를 동적 Mermaid 다이어그램으로 시각화할 수 있게 해줍니다.

## 구현된 기능
1.  **설정 파싱 (Configuration Parsing)**:
    -   `hostname`, `ports`, `interfaces`, `IP addresses`, `QoS`, `Services` (VPRN) 파싱.
    -   인터페이스/포트 설명을 기반으로 인접 장비 추론 (예: "To-RouterB" -> Node "RouterB").

2.  **대화형 UI (Interactive UI)**:
    -   **파일 업로드**: 헤더 업로드 버튼. ( `.cfg`, `.txt`, `.conf` 지원)
    -   **인터페이스 선택**: "모두 선택" / "모두 해제" 및 스마트 검색/필터링 기능.
    -   **다이어그램 뷰어**: 선택된 인터페이스별 개별 또는 다중 인터페이스를 포함하는 다이어그램 카드 생성.

3.  **시각화 (Visualization)**:
    -   중앙 노드는 업로드된 장비를 나타냄.
    -   연결된 노드는 인접 장비를 나타냄.
    -   링크에는 인터페이스 이름, 포트, IP, QoS 등의 라벨이 표시됨.

## 검증 결과

### 테스트 시나리오
1.  **입력**: 3개의 인터페이스(`system`, `to-router-b`, `uplink`)와 1개의 서비스 인터페이스(`vprn-int-1`)를 가진 Nokia 7750 SR 라우터(`SK-NET-BB3`)를 모방한 더미 설정.
2.  **동작**: 설정 붙여넣기, 모든 인터페이스 선택, 그 후 "to-router-b" 토글.

### 스크린샷
다음 스크린샷은 로컬에서 실행 중인 애플리케이션을 보여줍니다. 다이어그램은 선택된 인터페이스를 반영합니다.

![Application Screenshot](/Users/a04258/.gemini/antigravity/brain/666e0733-491c-4000-8551-ee87be43424e/diagram_after_toggle_1765336996519.png)

## 버그 수정 (v1.1)
- **인터페이스 중복 버그**: 프로토콜 블록(예: OSPF, MPLS) 내에서 참조된 인터페이스가 새로운 인터페이스 정의로 잘못 파싱되는 문제를 수정했습니다. 단일 단어 명령어(예: `mpls`)를 지원하도록 프로토콜 컨텍스트 감지를 강화했습니다.
- **스니펫 지원**: `router` 컨텍스트 없는 최상위 인터페이스 정의가 무시되는 회귀 문제를 수정했습니다. 파서는 이제 스니펫과 전체 설정을 모두 지원합니다.

![Final Verification](/Users/a04258/.gemini/antigravity/brain/666e0733-491c-4000-8551-ee87be43424e/verify_final_fix_1765338269691.png)
![UI Verification Recording](/Users/20eung/.gemini/antigravity/brain/3ffe7761-537c-4584-a0b7-675b0069b78c/ui_verification_layout_1765454502183.webp)

### 디자인 복원 (Design Restoration)
사용자 피드백을 반영하여 인터페이스 목록의 디자인을 기존 "프리미엄" 스타일로 복원했습니다.
- **스타일 복원**: 체크박스, 폰트, 태그, 선택 효과(파란색 테두리)를 기존과 동일하게 적용.
- **기능 유지**: 헤더 업로드, 사이드바 리사이징 및 접기/펼치기 기능은 그대로 유지됨을 확인했습니다.

### 버그 수정 검증: 인터페이스 목록 스크롤
- **문제**: 인터페이스 목록이 길어질 경우 스크롤이 되지 않는 문제 발생.
- **해결**: CSS Flexbox 컨테이너의 `min-height: 0` 및 `overflow` 속성 수정을 통해 해결.
- **검증**: 다수의 인터페이스가 있는 설정을 로드하여 스크롤 작동 여부를 브라우저 테스트로 확인했습니다. (결과: Scrollable: true)

### 최종 검증 (Standardized Testing)
- **테스트 파일**: `docs/config.txt`
- **결과**: 표준 테스트 파일(`docs/config.txt`)을 사용하여 UI 레이아웃, 디자인 복원, 스크롤 기능이 모두 정상 작동함을 최종 확인했습니다.



## UI/파서 개선 (v1.2)
- **인터페이스 중복 제거**: 중복된 인터페이스 항목을 병합하는 로직을 구현했습니다. 인터페이스가 여러 번 정의된 경우(예: 한 번은 세부 정보와 함께, 한 번은 참조로), 파서는 이제 IP와 설명을 보존하면서 이를 단일 항목으로 결합합니다.
- **자연 정렬**: 인터페이스 목록이 이제 영숫자순으로 정렬되어(예: p3/2/2가 p3/2/10보다 앞에 옴) 특정 인터페이스를 찾기 쉬워졌습니다.

![Refinement Verification](/Users/a04258/.gemini/antigravity/brain/666e0733-491c-4000-8551-ee87be43424e/verify_features_final_1765339903396.png)

## 다이어그램 정보 강화 (v1.3)
- **호스트네임**: 다양한 설정 컨텍스트에 대해 파서를 더 견고하게 만들어 "Unknown" 호스트네임 문제를 해결했습니다.
- **상세 라벨**: 엣지 라벨에 다음 정보가 포함됩니다:
    -   **Port**: 상단에 표시 (예: `Port: 1/1/1`).
    -   **Interface**: 인터페이스 이름.
    -   **IP**: 로컬 IP 주소.
    -   **QoS**: QoS 정책 ID (있는 경우).
    -   **Service ID**: 서비스 ID (예: VPRN/IES ID).
    -   **Static Routes**: 해당 인터페이스의 서브넷을 통해 도달 가능한 정적 경로(목적지 프리픽스 + 넥스트 홉)를 표시.
- **원격 정보**: 정적 경로 넥스트 홉이 인터페이스 서브넷과 일치하는 경우 타겟 노드 IP를 추론합니다. (표준 점대점 주소 지정 가정).

## 다음 단계
## 기능 고도화 및 사용성 개선 (v1.5)

### 1. 개별 다이어그램 시각화 (Individual Visualization)
사용자가 여러 인터페이스를 선택했을 때, 더 이상 하나의 복잡한 거대 그래프로 뭉쳐서 보여주지 않습니다.
- **변경 전**: 모든 노드가 하나의 그래프에 연결되어 복잡도가 높음.
- **변경 후**: **각 인터페이스가 독립적인 카드(Card) 형태의 다이어그램으로 생성**됩니다. 이를 통해 각 링크의 연결 관계를 명확하게 파악할 수 있습니다.
- **Generator**: Updated `mermaidGenerator.ts` to accept full topology context.

## 검증 결과 (Verification Results)

### 1. HA 필터 및 다이어그램 생성 (HA Filter & Diagram)
- **테스트 시나리오**: `config1.txt` (인터페이스) 업로드 -> 프리뷰 모달에서 `config2.txt` (Static Route) 추가 -> 분석 시작 -> '이중화' 필터 클릭.
- **결과**: 다이어그램이 정상적으로 생성됨. 'p3/2/21' 인터페이스가 두 개의 리모트 HA IP (26, 6)와 연결됨을 확인.

![HA Flow Verification](/Users/20eung/.gemini/antigravity/brain/f3bc43d1-95f2-4f5d-9b7e-aa50375507dc/full_flow_verification_1765690077175.png)

### 2. 파일 추가 기능 (Add Files)
- **테스트**: 프리뷰 모달 내 'Add Files' 버튼 동작 확인.
- **결과**: 초기 업로드 후 추가 파일 선택 및 병합 처리가 정상적으로 수행됨.
![Verification Screenshot](/Users/20eung/.gemini/antigravity/brain/f3bc43d1-95f2-4f5d-9b7e-aa50375507dc/final_verification_1765687383195.png)
### 2. 스마트 검색 및 필터링 (Smart Search)
인터페이스 목록 상단에 검색바가 추가되었습니다. 단순 이름 검색을 넘어 다양한 속성을 실시간으로 필터링합니다.
- **검색 대상**: Interface Name, Port ID (`1/1/1`), IP Address, Description, Service Description.
- **활용 예**: "to-router"를 입력하여 특정 장비로 가는 인터페이스만 찾거나, IP 대역을 입력하여 해당되는 인터페이스만 빠르게 조회할 수 있습니다.

### 3. 다양한 파일 포맷 지원 및 업로드 개선
- **확장자 확대**: `.cfg` 뿐만 아니라 `.txt`, `.conf` 파일도 공식 지원합니다.
- **헤더 업로드**: 스크롤이 내려간 상태에서도 상단 헤더의 아이콘을 통해 즉시 새 파일을 업로드할 수 있습니다.

### 4. UI 재설계 (Redesign)
- **사이드바**: 너비 조절(Resizable) 및 접기/펼치기(Collapsible) 기능을 구현하여 작업 공간 활용도를 높였습니다.
- **스타일**: 다이어그램 뷰어에 카드 스타일을 적용하여 가독성을 개선했습니다.

![Features v1.5 Verification](/Users/a04258/.gemini/antigravity/brain/666e0733-491c-4000-8551-ee87be43424e/verify_v1_5_features.png)

## 파서 개선 (v1.4) - BB4.txt 지원
- **새로운 정적 라우트 문법 지원**: `static-route-entry` 블록 문법을 사용하는 최신 Nokia 설정 파일(BB4.txt)에 대한 파싱 지원을 추가했습니다.
- **검증**:
    - BB4.txt: 51개의 정적 라우트가 정상적으로 파싱되어 "Customer Network" 노드가 올바르게 생성됨을 확인했습니다.
    - BB3.txt: 기존 `static-route` 문법도 여전히 정상 작동함(회귀 없음)을 확인했습니다.

## 로직 변경 (v1.5)
- **원격 호스트네임 기준 변경**: 다이어그램의 "Remote" 노드 타이틀을 기존 `Port Description`에서 `Interface Description`으로 변경했습니다. 이는 포트 설명보다 인터페이스 설명이 실제 연결 대상을 더 정확하게 반영하는 경우가 많다는 사용자 피드백을 반영한 것입니다.

## 포트 파싱 개선 (v1.6)
- **암시적 포트 바인딩 지원**: `p3/1/13`과 같이 이름이 `p<Slot>/<MDA>/<Port>` 형식을 따르는 인터페이스에 대해, 명시적인 `sap` 설정이 없더라도 이름에서 포트 ID를 유추하여 포트 설명 및 정보를 가져오도록 파서를 개선했습니다.
  - 이를 통해 `sap`이 VPLS 등 다른 블록에 숨어있는 경우에도 인터페이스-포트 관계를 올바르게 시각화합니다.
- **다중 포트 인터페이스 지원**: `p4/1/6-p4/1/7`과 같이 하이픈(`-`)으로 연결된 인터페이스 이름을 인식하여, 포함된 모든 포트(예: `4/1/6`, `4/1/7`)를 인식하고 설명을 통합하여 표시합니다.

## 데모 모드 (Demo Mode)
- **Beta 환경 전용**: 호스트네임에 `beta`가 포함된 환경에서만 활성화됩니다.
- **Select Config 버튼**: 헤더에 추가된 버튼을 통해 미리 변환된 안심 설정 파일(`config1.txt`, `config2.txt`)을 즉시 로드하여 테스트할 수 있습니다.

## 다이어그램 툴바 고도화 (v1.7)
사용자 피드백을 반영하여 다이어그램 툴바를 전면 개편했습니다.

- **UI 재설계**:
    - 다이어그램이 생성될 때만 툴바가 표시되도록 조건부 렌더링을 적용했습니다.
    - 버튼 디자인을 통일하고 아이콘을 적용하여 현대적이고 직관적인 UI를 제공합니다.
    - Zoom 컨트롤을 `[ - ] [ 100% ] [ + ]` 순서로 재배치하여 사용성을 높였습니다.

- **통합 다운로드 (Unified Download)**:
    - **Download** 버튼 하나로 통합되었으며, 드롭다운 메뉴를 통해 형식을 선택할 수 있습니다.
    - **SVG (Vector)**: 벡터 그래픽 형식. 확대해도 깨지지 않으며 편집이 쉽습니다.
    - **PNG (Image)**: 고화질 비트맵 이미지. `html-to-image` 라이브러리를 도입하여 브라우저 보안 제약이나 스타일 누락 없이 안정적으로 이미지를 생성합니다. (흰색 배경, 2.5배율 고해상도 적용)

## 다음 단계
-   **단계 2**: 두 설정 파일 비교 구현 (이중화 시각화).
-   **단계 3**: 다중 설정을 통한 엔드투엔드 경로 시각화.

## 텍스트 표시 개선 (v1.8)
사용자 피드백을 반영하여 다이어그램 내 텍스트 표시를 개선했습니다.

### 줄바꿈 방지 (Text Wrapping Prevention)
- **문제**: Description, Hostname, Remote name이 공백이나 하이픈(`-`) 문자에서 줄바꿈되어 가독성 저하
- **해결**: 유니코드 non-breaking 문자 사용
  - 공백 → `\u00A0` (non-breaking space)
  - 하이픈 → `\u2011` (non-breaking hyphen)
- **적용 범위**:
  - Port, Interface, Service description
  - Hostname (Host subgraph 제목)
  - Remote name (Remote subgraph 제목)

### 볼드 처리 (Bold Formatting)
- **Hostname**과 **Remote name**에 `<b>` 태그 적용하여 시각적 강조
- 다이어그램에서 주요 노드 식별이 더욱 용이해짐

### 기술적 배경
- HTML 엔티티(`&nbsp;`, `&#8209;`)는 Mermaid.js에서 이스케이프되어 `&` 문자가 표시되는 문제 발생
- CSS `white-space: nowrap`은 Mermaid.js가 렌더링하지 않아 텍스트 사라짐
- **유니코드 문자**는 실제 문자이므로 Mermaid.js가 그대로 렌더링하여 성공적으로 작동

