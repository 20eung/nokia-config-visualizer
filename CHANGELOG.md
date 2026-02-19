# 변경 이력 (Changelog)

이 프로젝트의 모든 주요 변경 사항은 이 파일에 문서화됩니다.

이 형식은 [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)를 기반으로 하며,
이 프로젝트는 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)을 준수합니다.


## [4.6.1] - 2026-02-19

### 🐛 버그 수정 (Bug Fixes)
- **복수 검색어 Catch-all 검색 강화**: ServiceListV3의 AND/OR 검색 로직에서 `JSON.stringify(service)`를 searchFields에 추가
  - 단일 검색어에서만 작동하던 catch-all 검색이 복수 검색어(AND/OR)에서도 작동하도록 개선
  - 필드명 자체(예: "portId", "portDescription")도 AND/OR 검색 가능
  - 명시적으로 수집하지 못한 필드나 중첩된 객체 내부 값도 검색 가능
  - 예시: `port Video`, `port + Video`, `qos 100M`, `epipe 1270` 모두 정상 작동
- **백엔드 TypeScript 컴파일 오류 수정**: `server/src/routes/config.ts`에서 `path.basename(filename as string)` 타입 캐스팅 추가

### 🔧 기술적 변경 (Technical Changes)
- **수정 파일**:
  - `src/components/v3/ServiceListV3.tsx` (라인 591-600): 복수 검색어 로직에 JSON.stringify 추가
  - `server/src/routes/config.ts` (라인 112): TypeScript 타입 캐스팅 추가

### 📝 검증 결과 (Verification)
- **테스트 항목**: 사용자 피드백 기반 6개 검색 케이스 검증
  1. ✅ 'qos 100M': OR 검색 정상 작동
  2. ✅ 'port Video': OR 검색 정상 작동
  3. ✅ 'port + Video': AND 검색 정상 작동
  4. ✅ 'epipe 1270': OR 검색 정상 작동
  5. ✅ '1/1/1': 단일 검색 정상 작동
  6. ✅ 'vpls': 단일 검색 정상 작동

---

## [4.7.0] - 2026-02-19

### ✨ 새로운 기능 (New Features)
- **검색 예시 UI (Search Examples Pills)**: 검색창 아래에 6개 클릭 가능한 예시 pill 표시
  - QoS, IP 서브넷, AND 검색, 서비스 ID, 포트, 서비스 타입 예시 제공
  - 클릭 시 검색창에 자동 입력, 사용자가 수정 가능
  - Tooltip으로 각 예시 설명 표시 (호버 시 보임)
  - 키보드 접근성 지원 (Tab 네비게이션, Enter/Space로 실행)

### 🎨 UI/UX 개선 (UI/UX Improvements)
- **Hover/Active 효과**: 예시 pill에 시각적 피드백 (색상 변경, 애니메이션)
- **반응형 디자인**: 모바일(< 768px) 및 태블릿(768-1024px)에 최적화된 레이아웃
- **접근성**: aria-label, title 속성으로 스크린 리더 및 마우스 오버 Tooltip 지원

### 🔧 기술적 변경 (Technical Changes)
- **수정 파일**:
  - `src/components/v3/ServiceListV3.tsx`:
    - `SearchExample` 인터페이스 추가 (라인 29-38)
    - `STATIC_EXAMPLES` 배열로 6개 고정 예시 정의 (라인 65-72)
    - `handleExampleClick` useCallback 핸들러 추가 (라인 107-109)
    - 예시 pills JSX 렌더링 (라인 779-796)
  - `src/components/v3/ServiceListV3.css`:
    - `.search-examples-container` 컨테이너 스타일 (라인 278-285)
    - `.examples-label` 라벨 스타일 (라인 290-295)
    - `.examples-pills` pills 컨테이너 (라인 300-304)
    - `.example-pill` 기본/hover/active/focus/disabled 상태 (라인 309-372)
    - 반응형 미디어 쿼리 (라인 381-408)

### 📝 문서화 (Documentation)
- **완성 보고서**: `docs/04-report/features/search-examples-ui.report.md` 작성
  - PDCA 사이클 전체 통합 (Plan → Design → Do → Check → Act)
  - 설계-구현 일치율 95% 달성
  - 테스트 결과 및 성능 지표 기록

### 🎯 Phase 1 완료 정보
- **구현 시간**: ~2.5시간 (Plan → Design → Do → Check)
- **반복 횟수**: 0회 (첫 코드에서 완성)
- **테스트 상태**: 모든 기능 테스트 통과
- **다음 단계**: Phase 2 - 동적 예시 생성 (v4.8.0 예정)

---

## [4.6.0] - 2026-02-19

### 🚀 주요 기능 (Major Features)
- **IP 서브넷 검색 (IP Subnet Search)**: 검색창에서 IP 주소로 네트워크 서브넷 검색 기능 추가
  - IPv4 주소 입력 시 자동으로 IP 검색 모드 활성화
  - Static Route 설정 기반 서브넷 매칭 (예: `10.0.1.50` 검색 → `10.0.1.0/24` 서브넷 매칭)
  - Longest Prefix Match (LPM) 알고리즘으로 가장 구체적인 서브넷 우선 정렬
  - IES 서비스의 인터페이스 레벨 필터링 (검색 IP와 관련된 인터페이스만 표시)

### ✨ 새로운 기능 (New Features)
- **IPv4 유효성 검증**: 정규식 기반 IP 주소 형식 검증 및 옥텟 범위 체크 (0-255)
- **서브넷 계산**: CIDR 표기법 파싱 및 비트 연산을 통한 네트워크 주소 계산
- **너무 넓은 서브넷 필터링**: `/8` 미만의 과도하게 넓은 서브넷 자동 제외 (예: `128.0.0.0/1` 제외)
- **다중 호스트 지원**: hostname 정보를 보존하여 동일 serviceId의 서로 다른 호스트 정확히 구분
- **인터페이스 레벨 필터링**: IES 서비스에서 검색 IP와 관련된 Static Route를 가진 인터페이스만 표시

### 📦 신규 모듈 (New Modules)
- **`src/utils/ipUtils.ts`**: IP 유틸리티 함수 모듈 추가
  - `isValidIPv4()`: IPv4 주소 유효성 검증
  - `ipToLong()`: IP 주소를 32비트 정수로 변환
  - `parseNetwork()`: CIDR 표기법 파싱 (예: "10.0.1.0/24")
  - `isIpInSubnet()`: IP 주소가 서브넷에 포함되는지 확인
  - `sortByLongestPrefix()`: Longest Prefix Match 정렬

### 🔧 기술적 변경 (Technical Changes)
- **수정 파일**:
  - `src/components/v3/ServiceListV3.tsx`:
    - IP 검색 모드 추가 (라인 154-260)
    - `matchServiceByIpSubnet()` 함수로 서브넷 매칭 (라인 118-149)
    - IES 인터페이스 레벨 필터링 로직 (라인 202-260)
    - Longest Prefix Match 정렬 알고리즘 (라인 186-197)
  - `package.json`: 버전 4.5.6 → 4.6.0

### 📊 검색 알고리즘 (Search Algorithm)
1. **IPv4 검증**: `/^(\d{1,3}\.){3}\d{1,3}$/` 정규식 + 각 옥텟 0-255 범위 확인
2. **서비스 레벨 매칭**: 모든 서비스의 Static Routes에서 검색 IP가 포함된 서브넷 찾기
3. **LPM 정렬**: prefixLen 내림차순 (큰 값 = 더 구체적인 매칭)
4. **인터페이스 필터링** (IES만): V1 변환 후 `findPeerAndRoutes()`로 관련 라우트 확인
5. **결과 반환**: 검색 IP와 관련된 서비스 및 인터페이스만 표시

### 💡 사용 예시 (Usage Examples)
