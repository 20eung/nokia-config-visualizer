---
feature: claude-md-token-optimization
version: v4.4.0
status: planning
created: 2026-02-16
author: Claude Code
---

# CLAUDE.md Token Optimization - Plan Document

> **Feature**: CLAUDE.md 파일 토큰 최적화
> **Version**: v4.4.0
> **Status**: 📋 Planning
> **Type**: Documentation Optimization

---

## 1. Feature Overview

### 1.1 Summary

CLAUDE.md 파일이 과도하게 상세하여 AI 컨텍스트 로딩 시 많은 토큰을 소비하고 있습니다. v4.4에서는 **핵심 정보만 남기고 불필요한 내용을 제거하여 토큰 사용량을 50% 이상 절감**합니다.

### 1.2 Key Objectives

1. **토큰 절감**: 현재 ~9,000 토큰 → 목표 ~4,000 토큰 (50%+ 감소)
2. **핵심 정보 유지**: 프로젝트 이해에 필수적인 정보는 보존
3. **가독성 향상**: 중복 제거로 문서 구조 명확화
4. **유지보수성**: 필수 정보만 남겨 업데이트 부담 감소
5. **응답 속도**: 컨텍스트 로딩 시간 단축

### 1.3 Current Issues

**토큰 낭비 원인**:
1. **과도한 디렉토리 구조 설명**: 모든 파일과 폴더를 상세히 나열 (~1,500 토큰)
2. **중복된 코드 예시**: 같은 개념을 여러 곳에서 반복 설명 (~800 토큰)
3. **오래된 버전 히스토리**: v1.4 ~ v3.0까지 모든 버전 나열 (~500 토큰)
4. **과도한 Mermaid 규칙**: 특수문자 이스케이프 예시 반복 (~600 토큰)
5. **불필요한 세부사항**: 테스트 파일 경로, 빌드 명령어 등 (~400 토큰)
6. **긴 데이터 플로우 다이어그램**: ASCII 다이어그램이 너무 상세 (~300 토큰)

**문제 영향**:
- AI 응답 지연: 컨텍스트 로딩에 시간 소요
- 토큰 비용: 매 요청마다 불필요한 토큰 소비
- 핵심 정보 희석: 중요한 정보가 많은 내용에 묻힘

---

## 2. Business Value

### 2.1 Problem Statement

**현재 문제**:
- CLAUDE.md 파일이 9,000+ 토큰으로 Claude의 컨텍스트 윈도우에서 큰 비중 차지
- 핵심 정보를 찾기 어려움 (Signal-to-Noise Ratio 낮음)
- 문서 업데이트 시 중복 내용 동기화 부담

**문제 영향**:
- 개발 효율성 저하: AI가 핵심 정보에 집중하지 못함
- 비용 증가: 불필요한 토큰 소비
- 유지보수 부담: 긴 문서 업데이트에 시간 소요

### 2.2 Business Benefits

1. **비용 절감**: 토큰 사용량 50% 감소 → API 비용 절감
2. **응답 품질**: 핵심 정보에 집중 → AI 응답 정확도 향상
3. **개발 속도**: 컨텍스트 로딩 시간 단축 → 빠른 피드백
4. **유지보수성**: 간결한 문서 → 업데이트 부담 감소

### 2.3 Target Users

- **Primary**: Claude Code AI (컨텍스트 로딩)
- **Secondary**: 프로젝트 개발자 (문서 참조)

---

## 3. Goals and Objectives

### 3.1 Primary Goals

1. **토큰 50% 절감**: 9,000 토큰 → 4,000 토큰 이하
2. **핵심 정보 유지**: 프로젝트 이해에 필수적인 내용만 보존
3. **구조 간소화**: 섹션 축소 및 중복 제거
4. **외부 참조 활용**: 상세 내용은 별도 문서로 분리

### 3.2 Secondary Goals

1. **가독성 향상**: 명확한 섹션 구조
2. **검색 효율**: 핵심 키워드로 빠른 탐색
3. **문서 일관성**: 다른 문서와 중복 제거

### 3.3 Success Metrics

| Metric | Current | Target | Measurement |
|--------|:-------:|:------:|:-----------:|
| 토큰 수 | ~9,000 | ≤ 4,500 | Token counter |
| 라인 수 | ~650 | ≤ 350 | `wc -l` |
| 섹션 수 | 16개 | ≤ 10개 | 수동 카운트 |
| 코드 예시 | ~15개 | ≤ 5개 | 수동 카운트 |

---

## 4. Scope

### 4.1 In Scope

#### 4.1.1 제거할 내용

1. **상세 디렉토리 구조** (→ 간략화):
   ```
   # 제거: 모든 파일 나열 (~1,500 토큰)
   src/
   ├── components/
   │   ├── ConfigSelector.tsx
   │   ├── DiagramViewer.tsx
   │   ├── FileUpload.tsx
   │   ...

   # 유지: 핵심 디렉토리만
   - src/utils/ : Parser, Generator, Adapter
   - src/components/ : UI 컴포넌트
   - server/ : Express AI API
   ```

2. **중복 코드 예시** (→ 대표 예시만):
   - Mermaid 특수문자 이스케이프 예시 (15줄 → 3줄)
   - 파서 예시 (여러 개 → 1개)
   - 타입 정의 (반복 예시 제거)

3. **오래된 버전 히스토리** (→ 최근 3개 버전만):
   - v1.4 ~ v3.0 제거 (~500 토큰)
   - v4.0 ~ v4.3만 유지

4. **과도한 다이어그램** (→ 간략화):
   - 데이터 플로우 ASCII 다이어그램 축소
   - 컴포넌트 계층 구조 제거 (필요 시 별도 문서)

5. **불필요한 세부사항**:
   - 테스트 파일 경로
   - 빌드 명령어 (README.md에 있음)
   - Grafana 호환성 상세 규칙 (DIAGRAM_RULES.md로 이동)

#### 4.1.2 유지할 내용

1. **프로젝트 개요**: 목표, 기술 스택
2. **핵심 파일 설명**: Parser, Generator, Adapter (각 1-2줄 요약)
3. **주요 기능 위치**: 파싱, 다이어그램 생성, AI 챗봇, 이름 사전
4. **코드 작성 규칙**: TypeScript Strict, 모듈화, 디자인 원칙
5. **최근 버전 히스토리**: v4.0 ~ v4.3 (4개)
6. **개발 가이드**: 테스트 파일, 응답 스타일

#### 4.1.3 외부 문서로 분리

- **Mermaid 상세 규칙** → `DIAGRAM_RULES.md` (이미 존재)
- **Docker 배포 가이드** → `HOWTO-DOCKER.md` (이미 존재)
- **디렉토리 구조 상세** → 별도 `ARCHITECTURE.md` (신규 생성 옵션)

### 4.2 Out of Scope

- ❌ **README.md 수정**: 사용자 대상 문서는 그대로 유지
- ❌ **다른 문서 통합**: 각 문서는 독립적으로 유지
- ❌ **내용 재작성**: 기존 정보의 표현만 간소화

### 4.3 Assumptions

- 상세 정보는 별도 문서 또는 코드에서 확인 가능
- AI는 핵심 정보만으로도 프로젝트 이해 가능
- 개발자는 필요 시 다른 문서 참조 가능

---

## 5. Requirements

### 5.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|:--------:|:------:|
| FR-01 | 디렉토리 구조 섹션 간소화 (650줄 → 100줄) | P0 | ⏳ |
| FR-02 | 중복 코드 예시 제거 (15개 → 5개) | P0 | ⏳ |
| FR-03 | 버전 히스토리 축소 (v1.4~v3.0 제거) | P1 | ⏳ |
| FR-04 | 데이터 플로우 다이어그램 간소화 | P1 | ⏳ |
| FR-05 | Mermaid 규칙 축소 및 DIAGRAM_RULES.md 참조 추가 | P0 | ⏳ |
| FR-06 | 테스트 가이드 섹션 축소 | P2 | ⏳ |
| FR-07 | 빌드/배포 명령어 제거 (README.md 참조로 대체) | P2 | ⏳ |

### 5.2 Non-Functional Requirements

| ID | Requirement | Target | Priority |
|----|-------------|:------:|:--------:|
| NFR-01 | 토큰 수 감소 | ≥ 50% | P0 |
| NFR-02 | 핵심 정보 손실 | 0% | P0 |
| NFR-03 | 가독성 유지 | 현재 수준 이상 | P1 |
| NFR-04 | 업데이트 부담 감소 | ≥ 30% | P2 |

---

## 6. Technical Architecture

### 6.1 Optimization Strategy

```
CLAUDE.md (Before)
├── 프로젝트 개요 (200 토큰) ✅ 유지
├── 디렉토리 구조 (1,500 토큰) ❌ 축소 → 300 토큰
├── 핵심 파일 설명 (1,200 토큰) ⚠️ 축소 → 600 토큰
├── 주요 기능 구현 (800 토큰) ✅ 유지
├── 코드 작성 규칙 (600 토큰) ✅ 유지
├── Mermaid 규칙 (800 토큰) ❌ 축소 → 200 토큰 (외부 참조)
├── 개발 가이드 (500 토큰) ⚠️ 축소 → 300 토큰
├── 버전 히스토리 (700 토큰) ❌ 축소 → 200 토큰
└── 기타 (2,700 토큰) ❌ 제거/축소 → 500 토큰

Total: ~9,000 토큰 → ~4,000 토큰 (56% 감소)
```

### 6.2 Section Reorganization

**Before** (16 sections):
1. 프로젝트 개요
2. 아키텍처 구조
3. 주요 디렉토리 구조
4. 핵심 파일 설명 (1~6)
5. React 컴포넌트
6. 주요 기능 구현 위치
7. 개발 가이드
8. 디자인 & UX 원칙
9. 파서 작성 시 주의사항
10. Mermaid 코드 생성 시 주의사항
11. 새로운 서비스 타입 추가 시
12. 디버깅 가이드
13. 테스트
14. 응답 스타일
15. 참고 문서
16. 배포

**After** (10 sections):
1. 프로젝트 개요
2. 핵심 구조 (디렉토리 간략)
3. 주요 파일 (Parser, Generator, Adapter)
4. 주요 기능 (파싱, 다이어그램, AI, 사전)
5. 개발 가이드 (코드 규칙, 디자인 원칙)
6. 테스트 (표준 파일만)
7. 참고 문서 (외부 링크)
8. 버전 히스토리 (최근 4개)
9. 응답 스타일
10. 작업 체크리스트

---

## 7. Implementation Plan

### 7.1 Phase 1: Content Analysis (Step 1-2)

**Step 1: 토큰 사용량 측정**
- 현재 CLAUDE.md의 섹션별 토큰 수 측정
- 제거 가능 영역 식별
- 우선순위 결정 (High token / Low value)

**Step 2: 축소 전략 수립**
- 섹션별 목표 토큰 수 설정
- 유지/축소/제거 기준 정리
- 외부 참조 문서 경로 정리

### 7.2 Phase 2: Content Optimization (Step 3-5)

**Step 3: 디렉토리 구조 간소화**
- 전체 파일 나열 제거
- 핵심 디렉토리 + 역할만 표시
- 예: `src/utils/ : Parser, Generator, Adapter`

**Step 4: 중복 예시 제거**
- 코드 예시 15개 → 5개 (대표 예시만)
- Mermaid 규칙 → DIAGRAM_RULES.md 참조로 대체
- 타입 정의 반복 제거

**Step 5: 버전 히스토리 축소**
- v1.4 ~ v3.0 제거 (CHANGELOG.md 참조)
- v4.0 ~ v4.3만 유지 (최근 4개)

### 7.3 Phase 3: Validation & Documentation (Step 6-8)

**Step 6: 토큰 검증**
- 최종 토큰 수 측정 (목표: ≤ 4,500)
- 핵심 정보 손실 여부 확인
- 가독성 테스트

**Step 7: 외부 참조 추가**
- DIAGRAM_RULES.md 링크 추가
- README.md 링크 추가
- HOWTO-DOCKER.md 링크 추가

**Step 8: 문서 업데이트**
- 최적화 버전 커밋
- 릴리즈 노트에 변경 사항 기록

---

## 8. Dependencies

### 8.1 External Dependencies

- **Token Counter**: Claude API 또는 tiktoken 라이브러리

### 8.2 Internal Dependencies

- **DIAGRAM_RULES.md**: Mermaid 규칙 상세 (이미 존재)
- **HOWTO-DOCKER.md**: Docker 배포 가이드 (이미 존재)
- **README.md**: 사용자 대상 빌드/배포 명령어

### 8.3 Breaking Changes

- ❌ **Breaking Change 없음**: 문서 최적화만 수행

---

## 9. Risk Analysis

### 9.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|:-----------:|:------:|-----------|
| 핵심 정보 손실 | Low | High | 백업 생성, 검증 체크리스트 |
| 외부 참조 링크 깨짐 | Low | Medium | 링크 유효성 검증 |
| AI 응답 품질 저하 | Low | High | A/B 테스트 (축소 전/후) |

### 9.2 User Experience Risks

| Risk | Probability | Impact | Mitigation |
|------|:-----------:|:------:|-----------|
| 개발자가 정보 찾기 어려움 | Low | Medium | 외부 참조 명확화, 링크 추가 |
| 가독성 저하 | Low | Low | 섹션 구조 명확화 |

---

## 10. Testing Strategy

### 10.1 Validation Tests

- **토큰 수 측정**: 목표치 달성 여부 (≤ 4,500 토큰)
- **핵심 정보 체크리스트**:
  - [ ] 프로젝트 목표 명시
  - [ ] 기술 스택 명시
  - [ ] 주요 파일 역할 명시
  - [ ] 코드 작성 규칙 명시
  - [ ] 버전 히스토리 (최근 4개)
  - [ ] 외부 문서 링크 유효성

### 10.2 A/B Testing

- **Before**: 현재 CLAUDE.md로 AI 응답 품질 측정
- **After**: 최적화된 CLAUDE.md로 동일 질문 응답 비교
- **Metric**: 응답 정확도, 응답 시간, 토큰 사용량

### 10.3 Performance Tests

- **컨텍스트 로딩 시간**: 축소 전/후 비교
- **토큰 절감률**: (Before - After) / Before × 100

---

## 11. Rollout Plan

### 11.1 Phase 1: Backup & Measurement (즉시)

- 현재 CLAUDE.md 백업 (`.backup` 확장자)
- 섹션별 토큰 수 측정 및 기록

### 11.2 Phase 2: Optimization (1 day)

- 디렉토리 구조 간소화
- 중복 예시 제거
- 버전 히스토리 축소
- 외부 참조 추가

### 11.3 Phase 3: Validation (1 day)

- 토큰 수 검증
- 핵심 정보 체크리스트 확인
- A/B 테스트 (응답 품질 비교)

---

## 12. Success Criteria

### 12.1 Launch Criteria

- [ ] 토큰 수 ≤ 4,500 (50%+ 감소)
- [ ] 핵심 정보 손실 0%
- [ ] 외부 참조 링크 유효성 100%
- [ ] A/B 테스트 통과 (응답 품질 유지 또는 향상)

### 12.2 Post-Launch Metrics (1주 후)

- 토큰 절감률: ≥ 50%
- AI 응답 정확도: 현재 수준 이상
- 컨텍스트 로딩 시간: 30% 이상 단축

---

## 13. Future Enhancements (v4.5+)

### 13.1 Dynamic Documentation

- 컨텍스트에 따라 필요한 섹션만 로딩
- 섹션별 토글 기능

### 13.2 Automated Optimization

- 주기적 토큰 사용량 모니터링
- 자동 최적화 제안

---

## 14. Related Documents

- **DIAGRAM_RULES.md**: Mermaid 렌더링 규칙 상세
- **HOWTO-DOCKER.md**: Docker 빌드 및 배포 가이드
- **README.md**: 사용자 대상 프로젝트 설명
- **CHANGELOG.md**: 버전별 변경 이력

---

## 15. Optimization Checklist

### 15.1 제거 대상

- [ ] 상세 디렉토리 구조 (650줄 → 100줄)
- [ ] 중복 코드 예시 (15개 → 5개)
- [ ] 오래된 버전 (v1.4 ~ v3.0)
- [ ] 테스트 파일 경로
- [ ] 빌드/배포 명령어 (README.md 참조)
- [ ] 과도한 Mermaid 예시

### 15.2 외부 참조 추가

- [ ] Mermaid 규칙 → DIAGRAM_RULES.md
- [ ] Docker 배포 → HOWTO-DOCKER.md
- [ ] 빌드 명령어 → README.md

### 15.3 검증 항목

- [ ] 토큰 수 ≤ 4,500
- [ ] 라인 수 ≤ 350
- [ ] 핵심 정보 손실 0%
- [ ] 링크 유효성 100%

---

## 16. Approval

| Role | Name | Date | Status |
|------|------|------|:------:|
| Product Owner | User | 2026-02-16 | ⏳ Pending |
| Tech Lead | Claude Code | 2026-02-16 | ✅ Approved |

---

**Last Updated**: 2026-02-16
**Document Version**: 1.0
**Status**: 📋 Planning
