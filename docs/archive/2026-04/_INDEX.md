# Archive Index - 2026년 4월

## 아카이브된 기능 목록

### react-performance-optimization (v5.8.0)
- **완료일**: 2026-04-10
- **Match Rate**: 100% ✅
- **문서**:
  - [Plan](react-performance-optimization/react-performance-optimization.plan.md)
  - [Design](react-performance-optimization/react-performance-optimization.design.md)
  - [Analysis](react-performance-optimization/react-performance-optimization.analysis.md)
  - [Report](react-performance-optimization/react-performance-optimization.report.md)
  - [Summary](react-performance-optimization/SUMMARY.md)
- **주요 성과**:
  - 메모리 누수 제거 (mousemove/mouseup 이벤트 리스너 정상 해제)
  - WebSocket Stale Closure 제거 (useRef 패턴 도입)
  - normalizeSearchString 공유 유틸 추출 (2개 파일 중복 통합)
  - 정규식 모듈 레벨 상수 호이스팅 (parserV3.ts RE_* 패턴 일관성)
  - handleCopyImagePNG useCallback, statCards useMemo 적용
- **통계**:
  - 반복: 0회 (1차 완성)
  - TypeScript 에러: 0
  - 신규 파일: 1개 (stringUtils.ts)
  - 수정 파일: 5개

---

### sso-authentik-integration (v5.7.0)
- **완료일**: 2026-04-02
- **문서**:
  - [Plan](sso-authentik-integration/sso-authentik-integration.plan.md)
  - [Design](sso-authentik-integration/sso-authentik-integration.design.md)
- **주요 성과**:
  - Authentik Forward Auth 인증 게이트 구현 (nginx.conf)
  - X-Authentik-* 헤더로 사용자 정보 백엔드 전달
  - iframe 컨텍스트에서 TOP 프레임 포털 인증 리다이렉트
  - docker-compose.yml portainer-network 연동

---

### qos-png-fix (v5.7.5)
- **완료일**: 2026-04-03
- **문서**:
  - [Plan](qos-png-fix/qos-png-fix.plan.md)
  - [Design](qos-png-fix/qos-png-fix.design.md)
- **주요 성과**:
  - IES QoS 엣지 레이블 Copy PNG 렌더링 수정
  - html2canvas SVG foreignObject 렌더링 버그 우회
  - .qos-hl/.qos-label 인라인 스타일 직접 주입
  - Canvas 2D API로 QoS 배지 직접 재렌더링

---

### react-perf-optimization-v2 (v5.8.1)
- **완료일**: 2026-04-10
- **Match Rate**: 100% ✅
- **문서**:
  - [Plan](react-perf-optimization-v2/react-perf-optimization-v2.plan.md)
  - [Design](react-perf-optimization-v2/react-perf-optimization-v2.design.md)
  - [Analysis](react-perf-optimization-v2/react-perf-optimization-v2.analysis.md)
  - [Report](react-perf-optimization-v2/react-perf-optimization-v2.report.md)
- **주요 성과**:
  - `groupedDiagrams` useMemo 추출 (JSX inline reduce 제거)
  - `handleCopyCode` useCallback `[diagram]` 적용
  - `handleZoomIn/Out/Reset` useCallback `[]` 적용
  - `Dashboard` STAT_CARD_DEFS 외부 상수화, statCards useMemo 제거
- **통계**:
  - 반복: 0회 (1차 완성)
  - Match Rate: 100% (8/8)
  - 수정 파일: 3개

---

### dashboard-site-filter (v5.8.2)
- **완료일**: 2026-04-10
- **Match Rate**: 100% ✅
- **문서**:
  - [Plan](dashboard-site-filter/dashboard-site-filter.plan.md)
  - [Design](dashboard-site-filter/dashboard-site-filter.design.md)
  - [Analysis](dashboard-site-filter/dashboard-site-filter.analysis.md)
  - [Report](dashboard-site-filter/dashboard-site-filter.report.md)
- **주요 성과**:
  - Dashboard 카드 클릭 시 해당 장비 서비스만 왼쪽 패널에 필터링
  - `dashboardFilterHostnames` 상태 + `displayedServices` useMemo 추가
  - 사이드바 상단 배너로 필터 상태 시각화 (장비명 + X 해제 버튼)
  - 헤더 Services 탭 직접 클릭 시 필터 초기화
  - `allServices` 원본 보존 — 다이어그램 로직 영향 없음
- **통계**:
  - 반복: 0회 (1차 완성)
  - Match Rate: 100% (8/8)
  - 수정 파일: 1개 (`V3Page.tsx`, ~30줄)

---

**Last Updated**: 2026-04-10
