# 변경 이력 (Changelog)

이 프로젝트의 모든 주요 변경 사항은 이 파일에 문서화됩니다.

이 형식은 [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)를 기반으로 하며,
이 프로젝트는 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)을 준수합니다.

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
