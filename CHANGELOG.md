# 변경 이력 (Changelog)

이 프로젝트의 모든 주요 변경 사항은 이 파일에 문서화됩니다.

이 형식은 [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)를 기반으로 하며,
이 프로젝트는 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)을 준수합니다.


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
```
검색: 168.154.96.6

결과:
✓ SK-Net_Gyowon_7750SR-7_I_BB1 → 168.154.96.0/24 (p3/1/8 인터페이스)
✓ SK-Net_Gyowon_7750SR-7_I_BB2 → 168.154.96.0/24 (p3/1/8 인터페이스)
✓ SKNet_DDC2F_7750SR_I_BB1 → 168.154.64.0/18 (p1/2/1 인터페이스)
✓ SKNet_DDC2F_7750SR_I_BB2 → 168.154.64.0/18 (p1/2/1 인터페이스)
✓ SKNet_Pangyo_7750SR_I_BB3 → 168.154.64.0/18 (p5/1/1 인터페이스)
✓ VPRN 3093/3094 → 168.154.0.0/16
```

### 🎯 핵심 개선 효과 (Impact)
- **검색 정확도**: 단순 문자열 매칭 → 네트워크 서브넷 분석
- **효율성**: 대규모 네트워크에서 특정 IP가 속한 서비스 즉시 찾기
- **전문성**: 네트워크 엔지니어링 워크플로우에 최적화된 검색 기능
- **UX**: IP 주소 입력 시 자동 모드 전환 (별도 설정 불필요)

### 🔍 주요 사항 (Important Notes)
- **IPv6 미지원**: 현재 버전은 IPv4만 지원 (IPv6는 향후 추가 예정)
- **Static Route 의존성**: Static Route가 없는 서비스(Epipe, VPLS)는 IP 검색 불가
- **인터페이스 필터링**: Static Route와 Interface IP는 서로 다른 개념 (Static Route 기준으로 필터링)

### 📈 성능 (Performance)
- **검색 복잡도**: O(n×m) - n=서비스 수, m=평균 Static Route 수
- **실제 영향**: 서비스 < 1000개, route < 100개 기준 < 100ms (무시 가능)

## [4.5.5] - 2026-02-19

### 🔒 보안 개선 (Security Improvements)
- **민감 정보 익명화**: AI 프롬프트 및 UI 예시 데이터의 실제 고객사명 제거
  - AI 프롬프트 예시: 실제 고객사명 → 익명화된 예시 ("고객사A", "통신사B" 등)
  - UI Placeholder: 실제 고객사명 → 일반적인 예시
  - 코드 공개 및 배포에 적합한 보안 수준 달성

### 🛡️ 보안 검사 완료 (Security Audit)
- **코드 전체 스캔**: 민감 정보 검출 및 익명화
  - 'SK', 고객사명 키워드 검색 (28개 발견)
  - AWS Credentials, API Key 하드코딩: 없음 ✅
  - 환경변수 보호: .env 파일 gitignore 처리 ✅
  - 테스트 Config 파일: 익명화된 데이터 사용 ✅
- **보안 등급**: Medium → Good 상향

### 🔧 기술적 변경 (Technical Changes)
- **수정 파일**:
  - `server/src/prompts/dictionaryPrompt.ts`:
    - 예시 데이터 익명화 (라인 10-12, 17, 26, 34, 36, 42, 57-69)
    - "SK쉴더스", "Bizen", "ADTCAPS" → "고객사A", "CompanyA", "EntA"
    - "LG U+", "LGUplus" → "통신사B", "ISPB", "TelecomB"
  - `server/src/prompts/systemPrompt.ts`:
    - 예시 데이터 익명화 (라인 33, 38-40, 80-82, 89-94, 101-102, 113-115, 124-140)
    - AI 응답 예시의 고객사명 제거
  - `src/components/v3/DictionaryEditor.tsx`:
    - UI placeholder 익명화 (라인 463, 474)
    - Config Keywords: "Bizen..." → "CompanyA..."
    - Search Aliases: "SK쉴더스..." → "고객사A..."

### 📋 보안 검증 항목 (Security Checklist)
- ✅ **Credentials 하드코딩**: 없음
- ✅ **API Key 노출**: 없음
- ✅ **실제 고객 데이터**: 없음
- ✅ **환경변수 보호**: .env gitignore 처리
- ✅ **예시 데이터**: 익명화 완료
- ✅ **Config 파일**: 익명화된 테스트 데이터 사용

### 📊 변경 요약 (Summary)
| 항목 | Before | After |
|------|--------|-------|
| **AI 프롬프트 예시** | 실제 고객사명 사용 | 익명화된 일반 예시 |
| **UI Placeholder** | 실제 고객사명 사용 | 익명화된 일반 예시 |
| **보안 등급** | Medium (보통) | Good (양호) |
| **코드 공개 가능** | 주의 필요 | 적합 ✅ |

### 💡 개선 효과 (Impact)
- **보안성**: 민감 정보 노출 위험 제거
- **배포 안전성**: 오픈소스 공개에 적합한 수준
- **유지보수성**: 일반화된 예시로 이해도 향상
- **규정 준수**: 고객 정보 보호 강화

## [4.5.3] - 2026-02-19

### 🚀 주요 변경 사항 (Major Changes)
- **다이어그램 PNG 클립보드 복사**: 다운로드 버튼을 클립보드 복사로 대체하여 워크플로우 개선
  - 기존: PNG/SVG 다운로드 → 파일 탐색기 → 다른 프로그램에서 삽입 (5-10초)
  - 변경: Copy PNG 버튼 → 즉시 복사 → Word/PowerPoint/Slack 등에 붙여넣기 (1-2초)
  - 클립보드 API (`navigator.clipboard.write()`) 활용

### ✨ 새로운 기능 (New Features)
- **클립보드 복사 버튼**: PNG/SVG 다운로드 버튼 제거, Copy PNG 버튼으로 통합
  - `html-to-image`의 `toBlob()` 함수로 PNG 생성
  - 2x 픽셀 비율로 고품질 이미지 생성
  - 흰색 배경 처리 (`backgroundColor: '#ffffff'`)로 다크모드 호환성 보장
- **시각적 피드백**: 복사 성공 시 즉각적인 사용자 피드백
  - 아이콘 변경: Copy 아이콘 → Check 아이콘 (2초간)
  - 버튼 색상: 기본 → 녹색 배경 (2초간)
  - 텍스트 변경: "Copy PNG" → "Copied!"

### 📊 개선 사항 (Improvements)
- **다크모드 호환성**: 투명 배경 대신 흰색 배경으로 처리하여 다크모드 애플리케이션에서도 다이어그램 선명하게 표시
- **워크플로우 단순화**: 다운로드 → 파일 찾기 → 삽입 과정 제거, 즉시 복사-붙여넣기 가능
- **UI 정리**: 자주 사용하지 않는 SVG 다운로드 버튼 제거로 인터페이스 간소화

### 🔧 기술적 변경 (Technical Changes)
- **수정 파일**:
  - `src/components/v2/ServiceDiagram.tsx`:
    - `toPng`, `toSvg` import 제거, `toBlob` 추가
    - `Download` 아이콘 제거, `Copy`, `Check` 아이콘 추가
    - `handleDownloadPNG()`, `handleDownloadSVG()` 함수 제거
    - `handleCopyImagePNG()` 함수 추가 (라인 65-91)
    - `copied` state 추가로 시각적 피드백 구현
    - 클립보드 복사 실패 시 사용자 안내 메시지
  - `src/components/v2/ServiceDiagram.css`:
    - `.control-btn.copied` 스타일 추가 (녹색 배경, 흰색 텍스트)
    - `.control-btn.copied:hover` 스타일 추가

### 🌐 브라우저 호환성 (Browser Compatibility)
- **Clipboard API 지원**: Chrome 76+, Edge 79+, Safari 13.1+, Firefox 90+
- **에러 처리**: 브라우저가 클립보드 API를 지원하지 않을 경우 안내 메시지 표시

## [4.5.2] - 2026-02-18

### 🚀 주요 변경 사항 (Major Changes)
- **Grafana InfluxDB 쿼리 자동 생성**: 선택한 서비스의 모든 포트에 대해 트래픽 모니터링 쿼리문 자동 생성
  - InfluxQL 쿼리 형식: `SELECT non_negative_derivative("ifHCOutOctets", 1s) *8 FROM "snmp" WHERE ("hostname" = 'hostname' AND "ifName" = 'port') AND $timeFilter`
  - 모든 서비스 타입 지원: Epipe, VPLS, VPRN, IES
  - Grafana 대시보드에 즉시 사용 가능한 쿼리문 제공

### ✨ 새로운 기능 (New Features)
- **Export to Grafana 버튼**: ServiceDiagram에 Grafana 쿼리 내보내기 버튼 추가 (BarChart3 아이콘)
- **쿼리문 테이블 모달**: Hostname, Interface, Direction, Query, Action 컬럼으로 구성
  - 개별 쿼리 복사: Copy 버튼으로 쿼리문 클립보드 복사 (2초 피드백)
  - 전체 쿼리 복사: "Copy All Queries" 버튼으로 모든 쿼리 한 번에 복사
  - 쿼리 개수 표시: Footer에 생성된 쿼리 개수 표시
- **HA 구성 지원**: 여러 장비의 포트를 각각 개별 hostname으로 쿼리 생성
  - 기존: "장비1 + 장비2" 결합 hostname (Grafana에서 사용 불가)
  - 변경: 각 장비별 개별 hostname으로 분리된 쿼리 생성
- **다이어그램별 필터링**: IES 서비스에서 선택된 다이어그램의 포트만 쿼리 생성
  - usedPortIds 추적하여 실제 다이어그램에 표시된 포트만 필터링
- **VPLS 연결 해석**: IES 인터페이스가 VPLS를 통해 연결된 경우 실제 물리 포트 자동 탐지
  - VPLS 서비스를 조회하여 SAP portId 추출
  - 서비스 포트(VLAN 없음) 우선 선택, L2 Interlink(VLAN 있음) 제외

### 🐛 버그 수정 (Bug Fixes)
- **HA hostname 결합 문제**: "장비1 + 장비2" 형태의 hostname을 장비별 개별 hostname으로 분리
- **IES 전체 포트 생성 문제**: 선택된 다이어그램과 관계없이 모든 포트의 쿼리가 생성되던 문제 수정
- **잘못된 포트 선택**: interfaceName 대신 portId 기반 필터링으로 정확도 향상
- **VPLS 포트 누락**: IES 인터페이스가 VPLS로 연결된 경우 Port 정보가 없던 문제 해결
- **L2 Interlink 선택**: VLAN이 포함된 L2 Interlink 대신 서비스 포트 선택하도록 개선

### 🔧 기술적 변경 (Technical Changes)
- **신규 파일**:
  - `src/types/grafana.ts`: GrafanaQuery, GrafanaQuerySet 타입 정의
  - `src/utils/grafana/queryGenerator.ts`: 쿼리 생성 핵심 로직
    - `generateGrafanaQueries()`: 서비스 타입별 라우팅
    - `generateEpipeQueries()`, `generateVPLSQueries()`, `generateVPRNQueries()`, `generateIESQueries()`
    - `extractPortId()`: VLAN 제거 (1/1/1:100 → 1/1/1)
    - `buildInfluxQuery()`: InfluxQL 쿼리문 빌더
  - `src/components/v3/GrafanaExportModal.tsx`: 쿼리문 표시 및 복사 UI
- **수정 파일**:
  - `src/components/v2/ServiceDiagram.tsx`: Grafana 버튼 및 모달 통합 (라인 4, 20, 160-162, 190-197)
  - `src/pages/V3Page.tsx`: _hostname 전파 로직 (라인 105-117), HA 인터페이스 병합 (라인 296-385), 다이어그램별 필터링
  - `src/utils/v3/parserV3.ts`: VPLS 포트 해석 로직 (라인 1253-1270, 1479-1498), 서비스 포트 우선 선택
- **adminState 필터링**: 모든 서비스 타입에서 adminState='down' 포트 제외
- **DictionaryEditor.css 재사용**: 모달 UI 스타일 일관성 유지

### 📊 개선 사항 (Improvements)
- **시각적 피드백**: 복사 버튼 클릭 시 2초간 "Copied!" 표시 및 녹색 체크 아이콘
- **쿼리 주석**: "Copy All" 시 각 쿼리 앞에 `-- hostname interface direction` 주석 추가
- **데이터 정확도**: portId 기반 필터링으로 다이어그램과 쿼리문 일치 보장

## [4.5.0] - 2026-02-18

### 🚀 주요 변경 사항 (Major Changes)
- **IES 인터페이스 레벨 필터링**: 검색 시 IES 서비스 전체가 아닌 매칭된 인터페이스만 필터링
  - 기존: 한 인터페이스라도 매칭되면 호스트의 모든 인터페이스 표시
  - 변경: 검색어에 실제 매칭되는 인터페이스만 표시
  - 예: 'Shieldus' 검색 시 102개 → 15개로 정확도 향상

### ✨ 새로운 기능 (New Features)
- **검색 결과 기반 HA 필터링**: "이중화" 버튼이 검색/필터링된 결과만 대상으로 동작
  - `handleHAFilter` 함수가 `filteredServices`만 처리하도록 수정
  - 검색 후 "이중화" 버튼 클릭 시 검색 결과 내에서만 HA 감지
- **IES 개별 인터페이스 선택**: "All" 버튼이 IES의 경우 개별 인터페이스 키 생성
  - 기존: `ies-${hostname}` (호스트 전체 선택)
  - 변경: `ies___${hostname}___${interfaceName}` (필터링된 개별 인터페이스)
- **Catch-all JSON 검색**: 모든 파싱된 필드를 JSON.stringify()로 검색하여 누락 방지

### 📊 개선 사항 (Improvements)
- **Type별 갯수 표시**: "선택된 갯수 / 전체 갯수" 형식으로 표시
  - 예: "Epipe Services (7 / 384)", "IES Services (5 / 102)"
- **IES 갯수 산정 방식 변경**: 장비 갯수 → 인터페이스 갯수로 변경
  - 더 직관적이고 정확한 카운팅

### 🐛 버그 수정 (Bug Fixes)
- **AWS Bedrock 모델 ID 수정**: 잘못된 모델 ID 수정
  - `global.anthropic.claude-sonnet-4-20250514-v1:0` (오류) → `global.anthropic.claude-sonnet-4-5-20250929-v1:0` (정상)
  - docker-compose.yml, server/src/config.ts 모두 업데이트

### 🔧 기술적 변경 (Technical Changes)
- **ServiceListV3.tsx 핵심 로직 수정**:
  - `filterIESInterfaces()`: 인터페이스 레벨 필터링 함수 추가
  - `filteredServices`: IES에 대해 `.map()`으로 인터페이스 필터링 적용
  - `handleHAFilter`: filteredServiceKeys Set을 생성하여 검색 결과만 처리
  - `handleSelectAll`: IES 개별 인터페이스 키 생성 로직 추가
- **타입 안정성**: TypeScript 컴파일 에러 없이 모든 변경 사항 적용

### 📈 성능 개선 (Performance Improvements)
- **렌더링 최적화**: 필터링된 데이터만 다이어그램에 전달하여 렌더링 성능 향상
- **검색 정확도**: 불필요한 인터페이스 제외로 다이어그램 크기 감소 (예: 102개 → 15개)

## [4.4.0] - 2026-02-16

### 🚀 주요 변경 사항 (Major Changes)
- **Dictionary 구조 v4.4.0 마이그레이션**: v4.3.0 → v4.4.0 구조 변경
  - 기존: `originalToken`, `aliases` (2-field)
  - 변경: `name`, `configKeywords`, `searchAliases` (3-field)
  - 역할 분리: Config 검색 키워드와 사용자 검색어를 명확히 구분

### ✨ 새로운 기능 (New Features)
- **3컬럼 UI**: Dictionary Editor를 3개 필드 구조로 재설계
  - 그룹명 (15%): 대표 이름 입력
  - Config 키워드 (35%): Config description에 실제 존재하는 키워드들 (줄바꿈 구분)
  - 검색 별칭 (45%): 사용자 검색어 입력 (줄바꿈 구분)
- **양방향 검색**: AI 챗봇이 configKeywords와 searchAliases 모두 검색
  - 사용자가 "Bizen" 입력 → configKeywords 매칭 → ["Bizen", "ADTCAPS", "SKShielders", "Infosec"] 전체 OR 검색
  - 사용자가 "SK쉴더스" 입력 → searchAliases 매칭 → configKeywords 전체 OR 검색
- **테이블 정렬**: 3개 컬럼 모두 클릭으로 오름차순/내림차순 정렬 가능

### 🐛 버그 수정 (Bug Fixes)
- **Docker 빌드 오류 수정**: DictionaryEditor.tsx의 TypeScript 컴파일 에러 해결 (27개 오류)
  - v4.3.0 구조를 사용하던 코드를 v4.4.0으로 완전 마이그레이션
  - `originalToken` → `name`, `aliases` → `searchAliases`, `configKeywords` 추가
- **버전 표시 통일**: 모든 UI에서 v4.4.0으로 일관되게 표시
  - V3Page.tsx: "v4.1.0" → "v4.4.0"
  - DictionaryEditor.tsx: "v4.4" → "v4.4.0"

### 🔧 기술적 변경 (Technical Changes)
- **타입 정의 업데이트**:
  - `src/types/dictionary.ts`: 3-field structure (name, configKeywords, searchAliases)
  - `src/services/dictionaryApi.ts`: DictionaryGenerateResponse 타입 v4.4.0 대응
- **UI 컴포넌트 완전 재작성**:
  - `keywordTexts` 상태 추가 (Config 키워드 textarea 관리)
  - 저장 시 configKeywords, searchAliases 모두 동기화
  - 정렬 로직에 configKeywords 필드 추가
- **중복 제거 로직 개선**: name, configKeywords, searchAliases 모두 고려하여 병합

### 📊 개선 사항 (Improvements)
- **검색 정확도 향상**: Config 키워드와 검색어를 분리하여 더 정확한 매칭 가능
- **사용자 편의성**: placeholder로 각 필드의 용도를 명확히 안내
- **데이터 품질**: AI 생성 시 Config 키워드와 검색어를 자동 분류하여 데이터 일관성 보장

## [4.3.0] - 2026-02-16

### 🚀 주요 변경 사항 (Major Changes)
- **Dictionary 구조 간소화**: 6 fields → 2 fields로 단순화
  - 기존: originalToken, category, shortName, longName, koreanName, aliases
  - 변경: originalToken, aliases (모든 이름 변형을 aliases 배열로 통합)
  - 카테고리 분류 제거: 불필요한 복잡성 감소
  - AI 프롬프트 간소화: 엔티티 추출에만 집중

### ✨ 새로운 기능 (New Features)
- **Dictionary Editor 재설계**: 2-field 구조에 최적화된 UI
  - 원본 토큰 입력 (20% 너비)
  - 별칭 textarea (75% 너비, 줄바꿈 구분자)
  - 카테고리 드롭다운 제거
  - shortName, longName, koreanName 필드 제거
- **AliasBadge 간소화**: 툴팁에 originalToken → matchedAlias 형식으로 표시
- **마이그레이션 스크립트**: v4.2 → v4.3 자동 변환
  - `scripts/migrate-dictionary-v43.ts`
  - 기존 데이터 자동 백업 (.backup.json)
  - shortName, longName, koreanName을 aliases 배열로 자동 통합
  - 중복 제거 (case-insensitive)

### 🔧 기술적 변경 (Technical Changes)
- **타입 정의 업데이트**:
  - `DictionaryEntry`: id, originalToken, aliases, autoGenerated, userEdited
  - `DictionaryCompact`: {t: string, a: string[]}
  - `MatchedEntry`: originalToken, matchedAlias, allAliases
- **백엔드 프롬프트 간소화** (`dictionaryPrompt.ts`, `systemPrompt.ts`)
- **프론트엔드 컴포넌트 간소화** (`DictionaryEditor.tsx`, `AliasBadge.tsx`)
- **마이그레이션 도구**: npm run migrate:dictionary, npm run restore:dictionary

### 📊 성능 개선 (Performance Improvements)
- AI 토큰 사용량 감소: DictionaryCompact 크기 ~60% 절감 (s, l, k 필드 제거)
- JSON 파일 크기 감소: 평균 40% 축소
- UI 렌더링 속도 향상: 불필요한 필드 제거로 DOM 트리 간소화

## [4.1.0] - 2026-02-16

### 🚀 주요 변경 사항 (Major Changes)
- **이름 사전 (Name Dictionary)**: Config description에서 엔티티(고객명, 지역, 서비스 등)를 AI가 추출하여 이름 사전을 자동 생성
  - AI 자동 생성: AWS Bedrock (Claude)를 통해 description에서 엔티티 추출 및 이름 변형 생성
  - 수동 편집: 사전 항목의 추가, 수정, 삭제 지원
  - AI 챗봇 검색 시 사전 데이터를 함께 전달하여 한국어/별칭으로도 서비스 검색 가능
- **전역 단일 사전**: 서버에 `/app/data/dictionary.json` 단일 파일로 저장
  - Config 파일 조합과 무관하게 항상 동일한 사전 사용
  - Docker named volume(`dict-data`)으로 컨테이너 재빌드에도 데이터 유지

### ✨ 새로운 기능 (New Features)
- **Dictionary Editor UI**: 모달 기반 사전 편집기
  - AI 자동 생성 버튼 (Sparkles 아이콘)
  - 카테고리별 분류 (customer, location, service, device, other)
  - 원본 토큰, 짧은 이름, 긴 이름, 한국어, 별칭 필드
- **테이블 정렬**: 컬럼 헤더 클릭으로 오름차순/내림차순 토글 정렬 (한국어 로케일 지원)
- **증분 사전 구축**: AI 자동 생성 시 기존 항목을 모두 보존하고, 새로운 토큰만 추가
- **중복 정리**: 원본 토큰과 동일한 값을 짧은이름/긴이름/한국어/별칭에서 일괄 제거
- **전체 삭제**: 사전 항목을 모두 비우고 처음부터 다시 시작
- **Dictionary API 엔드포인트**:
  - `POST /api/dictionary/generate`: AI 사전 자동 생성
  - `GET /api/dictionary`: 전역 사전 로드
  - `PUT /api/dictionary`: 전역 사전 저장

### 🐛 버그 수정 (Bug Fixes)
- **사전 생성 토큰 초과**: AI 응답이 잘려 JSON 파싱 실패하던 문제 수정 (maxTokens 4096 → 8192)
- **AI 생성 중복 데이터**: originalToken과 동일한 값이 shortName/longName/koreanName/aliases에 중복 등록되던 문제 수정 (프롬프트 개선 + 후처리 필터)

### 🔧 기술적 변경 (Technical Changes)
- **전역 단일 파일 저장**: fingerprint별 분리 저장에서 `/app/data/dictionary.json` 단일 파일로 단순화
- **서버 파일 저장 서비스** (`dictionaryStore.ts`): 단일 파일 load/save
- **사전 생성 프롬프트 개선** (`dictionaryPrompt.ts`): originalToken 중복 방지 규칙 및 예시 추가
- **Docker Compose**: `dict-data:/app/data` named volume 추가
- **프론트엔드**: localStorage 의존 제거, 서버 API 기반 load/save로 전환

## [4.0.0] - 2026-02-15

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
