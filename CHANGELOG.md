# 변경 이력 (Changelog)

이 프로젝트의 모든 주요 변경 사항은 이 파일에 문서화됩니다.

이 형식은 [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)를 기반으로 하며,
이 프로젝트는 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)을 준수합니다.

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
