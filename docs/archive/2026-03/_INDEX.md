# Archive Index - 2026년 3월

## 아카이브된 기능 목록

### auto-config-loading-v2 (v5.5.0)
- **완료일**: 2026-03-13
- **Match Rate**: 98% ✅
- **문서**:
  - [Plan](auto-config-loading-v2/auto-config-loading-v2.plan.md)
  - [Design](auto-config-loading-v2/auto-config-loading-v2.design.md)
  - [Analysis](auto-config-loading-v2/auto-config-loading-v2.analysis.md)
  - [Report](auto-config-loading-v2/auto-config-loading-v2.report.md)
- **주요 성과**:
  - AutoParser Service 구현 (FileWatcher 기반 자동 config 파싱)
  - Vendor Detection 개선 (TiMOS-B 인식)
  - Telegram Bot 개선 (Markdown 오류 수정, 응답 간결화)
  - AI 응답 품질 개선 (리스트 형식 가이드)
  - Web UI 개선 (whitespace-pre-line 적용)
  - 5개 Bonus Features 구현
- **통계**:
  - 94개 Nokia config 자동 파싱
  - 782개 서비스 자동 로드
  - 21개 파일 변경, 5,114줄 추가
  - User Acceptance Testing: Pass ✅

---

### networktype-undefined-issue (v5.6.0)
- **완료일**: 2026-03-19
- **Match Rate**: 96% ✅
- **문서**:
  - [Analysis](networktype-undefined-issue/networktype-undefined-issue.analysis.md)
  - [Report](networktype-undefined-issue/networktype-undefined-issue.report.md)
- **주요 성과**:
  - Network Type Separation (ISP/MPLS/Cloud) 구현
  - 15/15 설계 항목 + 2개 보너스 구현
  - Gap 항목 5개 (G-1 ~ G-5) 모두 수정
  - 4개 파일 변경, +83줄 / -12줄
- **통계**:
  - 반복: 2회 (85% → 92% → 96%)
  - TypeScript 에러: 0
  - 신규 Export: `getServiceKey`, `migrateExistingConfigs`

---

### service-filter-toggle (v5.2.1)
- **완료일**: 2026-03-02
- **문서**:
  - [Plan](service-filter-toggle/service-filter-toggle.plan.md)
  - [Design](service-filter-toggle/service-filter-toggle.design.md)
- **주요 성과**:
  - Type 버튼 통합 선택/해제 (Select 영역 제거)
  - filterType 상태: all/epipe/vpls/vprn/ies/ha/isp/mpls/cloud/unknown
  - 버튼 1개 → 필터+선택+해제 완결 UX

---

### ui-service-type-identity (v5.2.4)
- **완료일**: 2026-03-03
- **문서**:
  - [Plan](ui-service-type-identity/ui-service-type-identity.plan.md)
  - [Design](ui-service-type-identity/ui-service-type-identity.design.md)
- **주요 성과**:
  - 서비스 타입별 색상/아이콘 Visual Identity 통합 (TYPE_COLORS)
  - Dashboard ↔ ServiceListV3 색상 체계 일치
  - epipe(blue), vpls(emerald), vprn(violet), ies(amber) 고유 색상 정의

---

### folder-select (v5.3.0)
- **완료일**: 2026-03-09
- **문서**:
  - [Plan](folder-select/folder-select.plan.md)
  - [Design](folder-select/folder-select.design.md)
- **주요 성과**:
  - webkitdirectory HTML5 API로 폴더 전체 업로드
  - 폴더 경로에서 networkType 자동 추출 (isp/mpls/cloud)
  - localStorage 유지, 서브디렉토리 지원

---

### network-type-separation (v5.6.0)
- **완료일**: 2026-03-19
- **문서**:
  - [Plan](network-type-separation/network-type-separation.plan.md)
  - [Design](network-type-separation/network-type-separation.design.md)
- **주요 성과**:
  - ISP/MPLS/Cloud 망 타입 자동 구분 (3단계: 경로 > 파일명 > Config 내용)
  - networkTypeExtractor.ts 구현
  - NetworkType 타입 정의 (services.ts)
  - VPRN BGP AS 번호 기반 추론

---

### vpls4073-networktype-overwrite (v5.6.1)
- **완료일**: 2026-03-19
- **문서**:
  - [Plan](vpls4073-networktype-overwrite/vpls4073-networktype-overwrite.plan.md)
- **주요 성과**:
  - VPLS 4073 동일 ID 다른 망 분리 (networkType suffix: vpls-4073-isp, vpls-4073-mpls)
  - parserV3.ts networkType 적용 로직 수정
  - V3Page.tsx 선택 키 생성 시 networkType 포함

---

**Last Updated**: 2026-04-10
