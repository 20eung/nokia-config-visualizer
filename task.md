# v2.x MPLS L2 VPN 개발 체크리스트

> Nokia Config Visualizer v2.x 개발 진행 상황

## 📋 전체 진행 상황

- [x] 프로젝트 기획
- [x] 기술 스펙 작성
- [x] UI/UX 설계
- [x] 샘플 Config 준비
- [/] 개발 환경 설정
- [ ] Phase 1: 파서 개발
- [ ] Phase 2: Epipe 시각화
- [ ] Phase 3: VPLS 시각화
- [ ] Phase 4: Multi-hop 경로 추적
- [ ] Phase 5: 통합 및 최적화

---

## ✅ 완료된 작업

### 기획 및 설계 (2026-01-09)

- [x] v2-development 브랜치 생성
- [x] beta → demo 브랜치명 변경
- [x] V2_PLANNING.md 작성
- [x] V2_TECHNICAL_SPEC.md 작성
- [x] V2_UI_MOCKUP.md 작성
- [x] 샘플 L2 VPN Config 파일 생성
  - [x] Epipe 서비스 3개
  - [x] VPLS 서비스 3개
  - [x] SDP 설정 2개

---

## 🔄 진행 중

### 문서 업데이트

- [/] README.md 업데이트
  - [ ] v2.x 정보 추가
  - [ ] 브랜치 전략 설명
  - [ ] 로드맵 업데이트
- [/] PROMPT.md 업데이트
  - [ ] v2.x 개발 가이드 추가
- [/] task.md 생성
  - [ ] 개발 체크리스트 작성

### 환경 설정

- [ ] React Router 설치
- [ ] 프로젝트 구조 준비
  - [ ] src/types/v2.ts 생성
  - [ ] src/utils/v2/ 폴더 생성
  - [ ] src/components/v2/ 폴더 생성
  - [ ] src/pages/ 폴더 생성
- [ ] 개발 환경 설정
  - [ ] TypeScript 설정 확인
  - [ ] ESLint 설정 확인

---

## 📦 Phase 1: 기본 파싱 및 데이터 구조 (2주)

### 타입 정의

- [x] src/types/v2.ts 생성
  - [x] ServiceType 타입
  - [x] BaseService 인터페이스
  - [x] SAP 인터페이스
  - [x] SDP 인터페이스
  - [x] EpipeService 인터페이스
  - [x] VPLSService 인터페이스
  - [x] L2VPNService 타입
  - [x] ParsedL2VPNConfig 인터페이스
  - [x] ServiceConnection 인터페이스

### 파서 개발

- [x] src/utils/v2/l2vpnParser.ts 생성
  - [x] extractSection 함수
  - [x] parseL2VPNServices 함수
  - [x] parseEpipe 함수
  - [x] parseVPLS 함수
  - [x] parseSAPs 함수
  - [x] parseSDPs 함수
  - [x] parseSpokeSDP 함수
  - [x] parseMeshSDP 함수

### 테스트

- [ ] src/utils/v2/__tests__/l2vpnParser.test.ts
  - [ ] Epipe 파싱 테스트
  - [ ] VPLS 파싱 테스트
  - [ ] SAP 파싱 테스트
  - [ ] SDP 파싱 테스트
  - [ ] 통합 테스트

---

## 🎨 Phase 2: Epipe 시각화 (2주)

### 다이어그램 생성기

- [ ] src/utils/v2/mermaidGeneratorV2.ts
  - [ ] generateEpipeDiagram 함수
  - [ ] SAP 노드 생성
  - [ ] Epipe 서비스 노드 생성
  - [ ] 연결선 생성
  - [ ] 스타일 적용

### UI 컴포넌트

- [ ] src/components/v2/ServiceList.tsx
  - [ ] 서비스 목록 표시
  - [ ] 서비스 타입별 그룹화
  - [ ] 검색 기능
  - [ ] 필터링 기능
  - [ ] 다중 선택

- [ ] src/components/v2/EpipeViewer.tsx
  - [ ] Epipe 다이어그램 표시
  - [ ] 서비스 상세 정보
  - [ ] SAP 상세 정보
  - [ ] 확대/축소 기능
  - [ ] PNG/SVG 내보내기

### 테스트

- [ ] Epipe 다이어그램 생성 테스트
- [ ] UI 컴포넌트 렌더링 테스트
- [ ] 사용자 인터랙션 테스트

---

## 🌐 Phase 3: VPLS 시각화 (2주)

### 다이어그램 생성기

- [ ] src/utils/v2/mermaidGeneratorV2.ts 확장
  - [ ] generateVPLSDiagram 함수
  - [ ] VPLS 중심 노드 생성
  - [ ] Multi-SAP 연결
  - [ ] Spoke SDP 연결
  - [ ] Mesh SDP 연결
  - [ ] 스타일 적용

### UI 컴포넌트

- [ ] src/components/v2/VPLSViewer.tsx
  - [ ] VPLS 다이어그램 표시
  - [ ] 서비스 상세 정보
  - [ ] SAP 목록 표시
  - [ ] SDP 목록 표시
  - [ ] 확대/축소 기능
  - [ ] PNG/SVG 내보내기

### 테스트

- [ ] VPLS 다이어그램 생성 테스트
- [ ] UI 컴포넌트 렌더링 테스트
- [ ] 대규모 VPLS (50+ SAP) 테스트

---

## 🔗 Phase 4: Multi-hop 경로 추적 (2주)

### 서비스 분석기

- [ ] src/utils/v2/serviceAnalyzer.ts
  - [ ] analyzeServiceConnections 함수
  - [ ] findServiceById 함수
  - [ ] filterServicesByCustomer 함수
  - [ ] traceServicePath 함수
  - [ ] matchRouterByFarEnd 함수

### 다이어그램 생성기

- [ ] src/utils/v2/mermaidGeneratorV2.ts 확장
  - [ ] generateMultiHopDiagram 함수
  - [ ] generateFullTopology 함수
  - [ ] 라우터 노드 생성
  - [ ] SDP 터널 표시
  - [ ] End-to-End 경로 표시

### UI 컴포넌트

- [ ] src/components/v2/ServicePathViewer.tsx
  - [ ] Multi-hop 경로 표시
  - [ ] 중간 라우터 정보
  - [ ] SDP 상세 정보
  - [ ] 경로 하이라이트

### 테스트

- [ ] 경로 추적 알고리즘 테스트
- [ ] Multi-hop 다이어그램 테스트
- [ ] 복잡한 토폴로지 테스트

---

## 🔧 Phase 5: 통합 및 최적화 (1주)

### v1 + v2 통합

- [ ] src/App.tsx 수정
  - [ ] React Router 설정
  - [ ] 버전 선택 UI
  - [ ] 라우팅 설정

- [ ] src/pages/V1Page.tsx 생성
  - [ ] 기존 App.tsx 내용 이동
  - [ ] v1 전용 컴포넌트

- [ ] src/pages/V2Page.tsx 생성
  - [ ] v2 전용 컴포넌트
  - [ ] 서비스 목록 + 다이어그램 뷰어

- [ ] src/components/common/VersionSelector.tsx
  - [ ] v1 ↔ v2 전환 UI
  - [ ] URL 라우팅 연동

### 성능 최적화

- [ ] 대용량 Config 파싱 최적화
- [ ] 다이어그램 렌더링 최적화
- [ ] 메모리 관리 최적화
- [ ] 코드 스플리팅

### 문서 작성

- [ ] README.md 최종 업데이트
- [ ] CHANGELOG.md 업데이트
- [ ] RELEASE_NOTES_v2.0.0.md 작성
- [ ] 사용자 가이드 작성

### 최종 테스트

- [ ] 통합 테스트
- [ ] E2E 테스트
- [ ] 브라우저 호환성 테스트
- [ ] 성능 테스트
- [ ] 접근성 테스트

---

## 🚀 배포 준비

### v2-demo 브랜치

- [ ] v2-demo 브랜치 생성
- [ ] 샘플 Config 파일 추가
- [ ] Cloudflare Pages 설정
  - [ ] 프로젝트 생성
  - [ ] 도메인 연결 (v2-demo.hub.sk-net.com)

### main 브랜치 병합

- [ ] v2-development → main PR 생성
- [ ] 코드 리뷰
- [ ] 테스트 통과 확인
- [ ] main 브랜치 병합

### 배포

- [ ] Cloudflare Pages 자동 배포 확인
- [ ] Docker 컨테이너 재빌드
- [ ] 프로덕션 배포 확인
  - [ ] nokia.hub.sk-net.com/ (v1)
  - [ ] nokia.hub.sk-net.com/v2 (v2)
  - [ ] nokia-int.hub.sk-net.com/ (v1)
  - [ ] nokia-int.hub.sk-net.com/v2 (v2)

---

## 📝 메모

### 기술적 결정 사항

- React Router v6 사용
- Mermaid.js 기존 버전 유지
- TypeScript strict mode 유지
- v1 코드 변경 최소화

### 주의사항

- main 브랜치 직접 수정 금지
- 모든 변경사항은 PR을 통해 병합
- 테스트 코드 필수 작성
- 문서 동기화 유지

### 다음 마일스톤

- [ ] 2026-02-09: Phase 1-2 완료
- [ ] 2026-03-09: Phase 3-4 완료
- [ ] 2026-04-09: Phase 5 완료 및 릴리즈

---

**최종 업데이트**: 2026-01-09  
**현재 Phase**: 준비 단계  
**진행률**: 15% (기획 완료)
