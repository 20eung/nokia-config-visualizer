# 🚀 Nokia Config Visualizer v2.x 개발 계획

> MPLS L2 VPN 서비스 토폴로지 시각화

## 📋 목차

- [프로젝트 개요](#프로젝트-개요)
- [v1.x vs v2.x 비교](#v1x-vs-v2x-비교)
- [v2.x 목표](#v2x-목표)
- [기술 요구사항](#기술-요구사항)
- [구현 범위](#구현-범위)
- [브랜치 전략](#브랜치-전략)
- [개발 로드맵](#개발-로드맵)
- [배포 전략](#배포-전략)

---

## 📊 프로젝트 개요

### 현재 상태 (v1.8.0)

**v1.x - 물리적 연결 토폴로지**
- ✅ 장비 간 물리적 연결 시각화
- ✅ IP 주소, 포트 정보
- ✅ HA 구성 (VRRP) 자동 탐지
- ✅ QoS 정보 표시
- ✅ Static Route 기반 Customer Network

### v2.x 목표

**v2.x - MPLS L2 VPN 서비스 토폴로지**
- 🎯 Epipe (Point-to-Point L2 VPN) 서비스 시각화
- 🎯 VPLS (Multipoint L2 VPN) 서비스 시각화
- 🎯 Service ID 기반 End-to-End 경로 추적
- 🎯 Multi-hop 서비스 경로 시각화
- 🎯 SAP (Service Access Point) 정보 표시
- 🎯 SDP (Service Distribution Point) 정보 표시

---

## 🔄 v1.x vs v2.x 비교

| 항목 | v1.x (물리적 연결) | v2.x (L2 VPN 서비스) |
|------|-------------------|---------------------|
| **관점** | 물리적 인프라 | 논리적 서비스 |
| **연결** | 포트 간 물리 연결 | Service ID 기반 논리 연결 |
| **대상** | 라우터, 포트, 인터페이스 | Epipe, VPLS, SAP, SDP |
| **경로** | 직접 연결 | Multi-hop 터널 |
| **사용자** | 네트워크 엔지니어 (인프라) | 서비스 엔지니어 (운영) |
| **목적** | 물리적 구성 확인 | 서비스 경로 추적 |

---

## 🎯 v2.x 목표

### 핵심 목표

1. **Epipe 서비스 시각화**
   - Point-to-Point L2 VPN 연결
   - SAP A ↔ SAP B 직접 연결 표시
   - Service ID, Customer ID 표시

2. **VPLS 서비스 시각화**
   - Multipoint L2 VPN 연결
   - 여러 SAP 간 Full Mesh 연결
   - VPLS 인스턴스 중심 토폴로지

3. **End-to-End 경로 추적**
   - Service ID 기반 전체 경로 표시
   - Multi-hop SDP 터널 시각화
   - 중간 라우터 경유 경로 표시

4. **서비스 상세 정보**
   - SAP 정보 (포트, VLAN, QoS)
   - SDP 정보 (터널 타입, Far-End)
   - 서비스 설명 (Description)

---

## 🛠 기술 요구사항

### Nokia 7750 SR Config 파싱

#### Epipe 설정 예시

```
service
    epipe 100 customer 1 create
        description "Customer A - Site A to Site B"
        sap 1/1/1:100 create
            description "Site A"
            exit
        sap lag-1:100 create
            description "Site B"
            exit
        exit
```

#### VPLS 설정 예시

```
service
    vpls 200 customer 1 create
        description "Customer B - Multipoint L2 VPN"
        sap 1/1/2:200 create
            description "Site A"
            exit
        sap 1/1/3:200 create
            description "Site B"
            exit
        sap 1/1/4:200 create
            description "Site C"
            exit
        spoke-sdp 10:200 create
            description "To Remote PE"
            exit
        exit
```

#### SDP 설정 예시

```
service
    sdp 10 mpls create
        description "To PE-Router-2"
        far-end 10.0.0.2
        lsp "LSP-to-PE2"
        keep-alive
            shutdown
        exit
        exit
```

### 파싱 요구사항

1. **Service 섹션 파싱**
   - Service ID, Type (epipe/vpls), Customer ID
   - Description

2. **SAP 정보 파싱**
   - Port/LAG ID
   - VLAN ID
   - Description
   - QoS Policy

3. **SDP 정보 파싱**
   - SDP ID
   - Far-End IP
   - LSP Name
   - Tunnel Type (MPLS/GRE)

4. **연결 관계 파악**
   - Service ID 기반 SAP-SAP 연결
   - Service ID 기반 SAP-SDP 연결
   - SDP Far-End 기반 라우터 간 연결

---

## 📦 구현 범위

### Phase 1: 기본 파싱 및 데이터 구조 (2주)

- [ ] L2 VPN 서비스 파서 개발
  - [ ] Epipe 파싱
  - [ ] VPLS 파싱
  - [ ] SDP 파싱
- [ ] 데이터 구조 설계
  - [ ] Service 타입 정의
  - [ ] SAP 타입 정의
  - [ ] SDP 타입 정의
- [ ] 테스트 케이스 작성

### Phase 2: Epipe 시각화 (2주)

- [ ] Epipe 다이어그램 생성기
  - [ ] SAP-SAP 직접 연결
  - [ ] Service ID 표시
  - [ ] Customer 정보 표시
- [ ] UI 컴포넌트 개발
  - [ ] Epipe 서비스 리스트
  - [ ] Epipe 다이어그램 뷰어
- [ ] 테스트 및 검증

### Phase 3: VPLS 시각화 (2주)

- [ ] VPLS 다이어그램 생성기
  - [ ] Multi-SAP Full Mesh
  - [ ] VPLS 인스턴스 중심 표시
  - [ ] Spoke-SDP 연결
- [ ] UI 컴포넌트 개발
  - [ ] VPLS 서비스 리스트
  - [ ] VPLS 다이어그램 뷰어
- [ ] 테스트 및 검증

### Phase 4: Multi-hop 경로 추적 (2주)

- [ ] SDP 터널 경로 추적
  - [ ] Far-End 기반 라우터 매칭
  - [ ] Multi-hop 경로 계산
  - [ ] 중간 노드 표시
- [ ] End-to-End 경로 시각화
- [ ] 테스트 및 검증

### Phase 5: 통합 및 최적화 (1주)

- [ ] v1 + v2 통합
  - [ ] 버전 선택 UI
  - [ ] 라우팅 설정
- [ ] 성능 최적화
- [ ] 문서 작성
- [ ] 최종 테스트

---

## 🌿 브랜치 전략

### 브랜치 구조

```
main (v1.8.0 프로덕션)
├── demo (v1.8.0 데모 - 샘플 config 포함)
└── v2-development (v2.0.0 개발)
    ├── feature/v2-parser (L2 VPN 파서)
    ├── feature/v2-epipe (Epipe 시각화)
    ├── feature/v2-vpls (VPLS 시각화)
    ├── feature/v2-sdp (SDP 경로 추적)
    └── feature/v2-integration (v1+v2 통합)
```

### 작업 흐름

1. **기능 브랜치 생성**
   ```bash
   git checkout v2-development
   git checkout -b feature/v2-parser
   ```

2. **개발 및 커밋**
   ```bash
   git add .
   git commit -m "feat: add L2 VPN service parser"
   ```

3. **v2-development에 병합 (PR)**
   ```bash
   git push origin feature/v2-parser
   # GitHub에서 PR: feature/v2-parser → v2-development
   ```

4. **v2 완성 후 main에 병합**
   ```bash
   # GitHub에서 PR: v2-development → main
   ```

---

## 📅 개발 로드맵

### 2026년 1월 - Phase 1: 기획 및 설계

- [x] v2 브랜치 생성
- [x] 기획 문서 작성
- [ ] 기술 스펙 문서 작성
- [ ] 데이터 구조 설계
- [ ] UI/UX 목업 작성

### 2026년 2월 - Phase 2-3: 핵심 기능 개발

- [ ] L2 VPN 파서 개발
- [ ] Epipe 시각화
- [ ] VPLS 시각화
- [ ] 기본 UI 컴포넌트

### 2026년 3월 - Phase 4-5: 고급 기능 및 통합

- [ ] Multi-hop 경로 추적
- [ ] v1 + v2 통합
- [ ] 성능 최적화
- [ ] 문서 작성

### 2026년 4월 - 테스트 및 릴리즈

- [ ] 베타 테스트
- [ ] 버그 수정
- [ ] v2-demo 브랜치 생성
- [ ] v2.0.0 정식 릴리즈

---

## 🚀 배포 전략

### 개발 단계

| 단계 | 브랜치 | 배포 환경 | 용도 |
|------|--------|-----------|------|
| **로컬 개발** | feature/* | localhost:5173 | 기능 개발 |
| **통합 개발** | v2-development | localhost:5173 | 통합 테스트 |

### 베타 테스트 단계

| 환경 | 브랜치 | 도메인 | 용도 |
|------|--------|--------|------|
| **v2 베타** | v2-beta | v2-beta.hub.sk-net.com | 베타 테스트 |
| **v2 데모** | v2-demo | v2-demo.hub.sk-net.com | 샘플 포함 데모 |

### 정식 릴리즈 (v2.0.0)

| 환경 | 브랜치 | 도메인 | 버전 |
|------|--------|--------|------|
| **프로덕션** | main | nokia.hub.sk-net.com/ | v1.x |
| **프로덕션** | main | nokia.hub.sk-net.com/v2 | v2.x |
| **데모** | demo | demo.hub.sk-net.com | v1.x 샘플 |
| **데모** | v2-demo | v2-demo.hub.sk-net.com | v2.x 샘플 |
| **내부** | main | nokia-int.hub.sk-net.com/ | v1.x |
| **내부** | main | nokia-int.hub.sk-net.com/v2 | v2.x |

---

## 📚 참고 자료

### Nokia 7750 SR 문서

- [Nokia 7750 SR Service Configuration Guide](https://documentation.nokia.com/)
- MPLS L2 VPN 설정 가이드
- Service Distribution Point (SDP) 가이드

### 기술 스택

- React 19 + TypeScript
- Vite 7
- Mermaid.js (다이어그램)
- React Router (v1/v2 라우팅)

---

## ✅ 다음 단계

1. [ ] 기술 스펙 문서 작성 (`V2_TECHNICAL_SPEC.md`)
2. [ ] UI/UX 목업 작성 (`V2_UI_MOCKUP.md`)
3. [ ] 샘플 Config 파일 준비
4. [ ] 데이터 구조 설계 문서 작성
5. [ ] 개발 시작

---

**작성일**: 2026-01-09  
**버전**: v2.0.0-planning  
**작성자**: Network Engineers
