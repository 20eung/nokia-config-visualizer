---
feature: dictionary-simplification
version: v4.3.0
status: planning
created: 2026-02-16
author: Claude Code
---

# Dictionary Structure Simplification - Plan Document

> **Feature**: 이름 사전 구조 단순화
> **Version**: v4.3.0
> **Status**: 📋 Planning
> **Type**: Refactoring (Data Model Simplification)

---

## 1. Feature Overview

### 1.1 Summary

현재 이름 사전(Name Dictionary)은 6개 필드(originalToken, shortName, longName, koreanName, aliases, category)로 구성되어 있습니다. v4.3에서는 이를 **2개 필드(originalToken, aliases)만 남기는 구조로 단순화**합니다.

### 1.2 Key Objectives

1. **구조 단순화**: 6개 필드 → 2개 필드 (originalToken, aliases)
2. **중복 제거**: shortName/longName/koreanName은 모두 aliases 배열에 통합
3. **카테고리 제거**: category 필드 삭제 (실제 사용 빈도 낮음)
4. **UI 개선**: 단순화된 구조로 DictionaryEditor 재설계
5. **API 호환성**: 기존 AI 챗봇 기능은 그대로 유지

### 1.3 Current vs Proposed Structure

**현재 구조 (v4.1 - v4.2)**:
```typescript
interface DictionaryEntry {
  originalToken: string;      // 원본 토큰 (예: "SKShielders")
  shortName: string;           // 짧은 이름 (예: "SK쉴더스")
  longName: string;            // 정식 명칭 (예: "에스케이쉴더스 주식회사")
  koreanName: string;          // 한국어 이름 (예: "SK쉴더스")
  aliases: string[];           // 별칭 (예: ["ADTCAPS", "Bizen", "Infosec"])
  category: 'customer' | 'location' | 'service' | 'device' | 'other';
}
```

**제안 구조 (v4.3)**:
```typescript
interface DictionaryEntry {
  originalToken: string;      // 원본 토큰 (예: "SKShielders")
  aliases: string[];           // 모든 별칭 통합 (예: ["SK쉴더스", "에스케이쉴더스", "ADTCAPS", "Bizen", "Infosec"])
}
```

### 1.4 Example Transformation

**변환 전 (v4.2)**:
```json
{
  "originalToken": "SKShielders",
  "shortName": "SK쉴더스",
  "longName": "에스케이쉴더스 주식회사",
  "koreanName": "SK쉴더스",
  "aliases": ["ADTCAPS", "Bizen", "Infosec", "ISAC", "SK Shielders"],
  "category": "customer"
}
```

**변환 후 (v4.3)**:
```json
{
  "originalToken": "SKShielders",
  "aliases": ["SK쉴더스", "에스케이쉴더스", "ADTCAPS", "Bizen", "Infosec", "ISAC", "SK Shielders"]
}
```

---

## 2. Business Value

### 2.1 Problem Statement

**현재 문제**:
1. **복잡한 구조**: 6개 필드 중 shortName/longName/koreanName이 중복 정보
2. **입력 부담**: DictionaryEditor에서 필드가 너무 많아 사용자 입력 부담
3. **유지보수 어려움**: 구조 변경 시 여러 파일 수정 필요
4. **category 미활용**: category 필드는 실제로 색상 표시에만 사용되며, 검색/필터링에 활용 안 됨
5. **일관성 문제**: shortName == koreanName인 경우가 대부분인데 두 필드 분리 유지

**문제 영향**:
- 사용자가 이름 사전 입력 시 혼란 (어디에 무엇을 넣어야 할지?)
- AI 자동 생성 시 불필요한 토큰 소비 (6개 필드 생성에 시간 소요)
- 개발자가 타입 변경 시 여러 파일 수정 (types.ts, claudeClient.ts, AliasBadge.tsx 등)

### 2.2 Business Benefits

1. **사용자 편의성**: 입력 필드 6개 → 2개 (원본 토큰 + 별칭 목록)
2. **AI 효율성**: Claude가 생성해야 할 필드 수 감소 → 응답 시간 단축, 토큰 절약
3. **유지보수성**: 타입 정의 간소화 → 코드 변경 최소화
4. **확장성**: 추후 필드 추가 필요 시 쉽게 확장 가능
5. **일관성**: 모든 이름 변형이 aliases 배열에 통합 → 혼란 제거

### 2.3 Target Users

- **Primary**: 이름 사전을 입력/수정하는 사용자
- **Secondary**: AI 자동 생성 기능을 사용하는 사용자
- **Tertiary**: 개발자 (타입 정의 관리)

---

## 3. Goals and Objectives

### 3.1 Primary Goals

1. **데이터 모델 단순화**: DictionaryEntry 타입을 originalToken + aliases 2개 필드로 축소
2. **UI 재설계**: DictionaryEditor를 2개 필드 입력으로 간소화
3. **마이그레이션 도구**: 기존 v4.2 구조 → v4.3 구조 자동 변환
4. **AI 프롬프트 수정**: systemPrompt.ts에서 간소화된 구조로 응답 요청
5. **API 호환성 유지**: 기존 AI 챗봇 검색 기능은 그대로 동작

### 3.2 Secondary Goals

1. **검색 성능 최적화**: 필드 수 감소로 메모리 사용량 감소
2. **토큰 절약**: AI 생성 시 불필요한 필드 생성 제거
3. **코드 정리**: category 색상 관련 CSS 제거
4. **문서 업데이트**: CLAUDE.md, 릴리즈 노트 업데이트

### 3.3 Success Metrics

| Metric | Current (v4.2) | Target (v4.3) | Measurement |
|--------|:--------------:|:-------------:|:-----------:|
| 입력 필드 수 | 6개 | 2개 | DictionaryEditor UI |
| AI 생성 시간 | ~2-3초 | < 2초 | Claude API 응답 시간 |
| 타입 정의 크기 | ~150 lines | < 50 lines | types.ts 라인 수 |
| 마이그레이션 성공률 | - | 100% | 기존 데이터 손실 없이 변환 |

---

## 4. Scope

### 4.1 In Scope

#### 4.1.1 Backend Changes

- [x] **타입 정의 수정**:
  ```typescript
  // server/src/types.ts
  interface DictionaryEntry {
    originalToken: string;
    aliases: string[];  // shortName, longName, koreanName 통합
  }

  // MatchedEntry는 유지 (AI 응답용)
  interface MatchedEntry {
    originalToken: string;
    matchedAlias: string;  // 어떤 별칭으로 매칭되었는지
    allAliases: string[];  // 모든 별칭
  }
  ```

- [x] **systemPrompt.ts 수정**:
  - Dictionary 섹션: "각 항목은 originalToken과 aliases 배열로 구성"
  - matchedEntries 응답: category 제거, matchedAlias 추가

- [x] **claudeClient.ts 수정**:
  - validateMatchedEntries() 로직 단순화
  - category 검증 제거

- [x] **dictionaryGenerator.ts 수정**:
  - AI 생성 시 2개 필드만 요청
  - shortName/longName/koreanName 생성 제거

#### 4.1.2 Frontend Changes

- [x] **DictionaryEditor.tsx 재설계**:
  - 입력 필드: originalToken + aliases (textarea, 줄바꿈으로 구분)
  - category 선택 제거
  - shortName/longName/koreanName 입력 제거
  - "AI 자동 생성" 버튼은 유지 (간소화된 구조로 생성)

- [x] **AliasBadge.tsx 수정**:
  - 툴팁: "원본: {originalToken} | 별칭: {aliases.join(', ')}"
  - category 색상 제거 → 단일 색상 (파란색 gradient)
  - matchedBy → matchedAlias로 표시 변경

- [x] **타입 정의 수정**:
  ```typescript
  // src/types.ts
  interface DictionaryEntry {
    originalToken: string;
    aliases: string[];
  }

  // src/services/chatApi.ts
  interface MatchedEntry {
    originalToken: string;
    matchedAlias: string;
    allAliases: string[];
  }
  ```

#### 4.1.3 Migration Tool

- [x] **마이그레이션 스크립트**:
  ```typescript
  // scripts/migrate-dictionary-v43.ts
  function migrateDictionaryV42ToV43(oldEntry: OldDictionaryEntry): DictionaryEntry {
    return {
      originalToken: oldEntry.originalToken,
      aliases: [
        oldEntry.shortName,
        oldEntry.longName,
        oldEntry.koreanName,
        ...oldEntry.aliases
      ].filter((alias, index, self) => {
        // 중복 제거 (대소문자 무시)
        return alias && self.findIndex(a =>
          a.toLowerCase() === alias.toLowerCase()
        ) === index;
      })
    };
  }
  ```

### 4.2 Out of Scope

- ❌ **검색 알고리즘 변경**: AI 챗봇 검색 로직은 그대로 유지
- ❌ **카테고리 기능 완전 제거**: 추후 필요 시 재추가 가능하도록 마이그레이션 스크립트에 category 정보 주석으로 보존
- ❌ **다국어 지원**: 영어/일본어 별칭은 v4.4 이후 고려
- ❌ **AI 프롬프트 최적화**: 응답 품질 개선은 별도 이슈

### 4.3 Assumptions

- 기존 사용자는 마이그레이션 스크립트 실행에 동의
- category 정보가 손실되어도 문제없음 (실제 사용 빈도 낮음)
- aliases 배열에 중복이 있어도 검색에 영향 없음 (대소문자 무시 처리)

---

## 5. Requirements

### 5.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|:--------:|:------:|
| FR-01 | DictionaryEntry 타입을 originalToken + aliases 2개 필드로 축소 | P0 | ⏳ |
| FR-02 | 기존 6필드 구조 → 2필드 구조 자동 변환 마이그레이션 스크립트 | P0 | ⏳ |
| FR-03 | DictionaryEditor UI를 2개 필드 입력으로 재설계 | P0 | ⏳ |
| FR-04 | AI 자동 생성 시 간소화된 구조로 응답 요청 (systemPrompt 수정) | P0 | ⏳ |
| FR-05 | AliasBadge 툴팁을 간소화된 구조로 표시 | P1 | ⏳ |
| FR-06 | category 색상 제거, 단일 색상 적용 | P1 | ⏳ |
| FR-07 | 마이그레이션 후 기존 AI 검색 기능 정상 동작 | P0 | ⏳ |
| FR-08 | aliases 배열 중복 제거 (대소문자 무시) | P1 | ⏳ |

### 5.2 Non-Functional Requirements

| ID | Requirement | Target | Priority |
|----|-------------|:------:|:--------:|
| NFR-01 | 마이그레이션 시간 | < 1초 (1000개 항목 기준) | P0 |
| NFR-02 | 메모리 사용량 감소 | ≥ 30% (필드 수 감소 효과) | P1 |
| NFR-03 | AI 생성 시간 단축 | ≥ 20% (불필요한 필드 생성 제거) | P2 |
| NFR-04 | 데이터 손실 없는 변환 | 100% (중복 제거만 허용) | P0 |

---

## 6. Technical Architecture

### 6.1 System Overview

```
┌─────────────────────────────────────────────────────────┐
│                  v4.2 Dictionary (Old)                   │
│  { originalToken, shortName, longName, koreanName,     │
│    aliases, category }                                   │
└─────────────────┬───────────────────────────────────────┘
                  │ 마이그레이션 스크립트
                  ↓
┌─────────────────────────────────────────────────────────┐
│            migrate-dictionary-v43.ts                     │
│  - shortName/longName/koreanName → aliases 통합        │
│  - 중복 제거 (대소문자 무시)                             │
│  - category 정보 주석으로 보존                          │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────┐
│                  v4.3 Dictionary (New)                   │
│  { originalToken, aliases }                              │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────┐
│              DictionaryEditor (Simplified)               │
│  - 입력: originalToken + aliases (textarea)            │
│  - AI 자동 생성: 간소화된 구조로 생성                   │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Data Flow

```typescript
// 1. 마이그레이션 전 (v4.2)
{
  "originalToken": "SKShielders",
  "shortName": "SK쉴더스",
  "longName": "에스케이쉴더스 주식회사",
  "koreanName": "SK쉴더스",
  "aliases": ["ADTCAPS", "Bizen", "Infosec"],
  "category": "customer"
}

// 2. 마이그레이션 후 (v4.3)
{
  "originalToken": "SKShielders",
  "aliases": [
    "SK쉴더스",              // from shortName
    "에스케이쉴더스 주식회사", // from longName (중복 아님)
    "SK쉴더스",              // from koreanName (중복 제거됨)
    "ADTCAPS",               // from aliases[0]
    "Bizen",                 // from aliases[1]
    "Infosec"                // from aliases[2]
  ]
  // category: "customer" (주석으로 보존, 파일에 저장 안 됨)
}

// 3. 중복 제거 후 최종 결과
{
  "originalToken": "SKShielders",
  "aliases": [
    "SK쉴더스",
    "에스케이쉴더스 주식회사",
    "ADTCAPS",
    "Bizen",
    "Infosec"
  ]
}
```

### 6.3 Component Hierarchy

```
DictionaryEditor (v4.3)
├── 항목 목록 (테이블)
│   ├── originalToken 컬럼
│   ├── aliases 컬럼 (배열을 ", "로 join하여 표시)
│   └── 작업 버튼 (수정, 삭제)
│
├── 추가/수정 모달
│   ├── originalToken 입력 (input)
│   ├── aliases 입력 (textarea, 줄바꿈으로 구분)
│   │   예: SK쉴더스
│   │       에스케이쉴더스
│   │       ADTCAPS
│   │       Bizen
│   └── 저장/취소 버튼
│
└── 도구 버튼
    ├── AI 자동 생성 (간소화된 구조)
    ├── 항목 병합 (기존 유지)
    └── 마이그레이션 (v4.2 → v4.3) 🆕
```

---

## 7. Implementation Plan

### 7.1 Phase 1: Data Model Changes (Step 1-3)

**Step 1: 타입 정의 수정**
- `server/src/types.ts`: DictionaryEntry 타입 축소
- `src/types.ts`: 프론트엔드 타입 동기화
- `src/services/chatApi.ts`: MatchedEntry 타입 수정

**Step 2: 마이그레이션 스크립트 작성**
- `scripts/migrate-dictionary-v43.ts`:
  - 기존 6필드 → 2필드 변환
  - 중복 제거 (대소문자 무시)
  - 백업 생성 (`.backup` 확장자)

**Step 3: 백엔드 로직 수정**
- `server/src/services/claudeClient.ts`:
  - validateMatchedEntries() 간소화
  - category 검증 제거
- `server/src/prompts/systemPrompt.ts`:
  - Dictionary 설명 수정
  - matchedEntries 응답 예시 업데이트
- `server/src/services/dictionaryGenerator.ts`:
  - AI 생성 시 2필드만 요청

### 7.2 Phase 2: Frontend Changes (Step 4-6)

**Step 4: DictionaryEditor 재설계**
- `src/components/v3/DictionaryEditor.tsx`:
  - 입력 필드 축소: originalToken + aliases (textarea)
  - category 선택 제거
  - 마이그레이션 버튼 추가
  - AI 자동 생성 버튼 유지 (간소화된 구조로 생성)

**Step 5: AliasBadge 수정**
- `src/components/v3/AliasBadge.tsx`:
  - 툴팁 내용 간소화
  - category 색상 제거 → 단일 색상
  - matchedBy → matchedAlias 표시

**Step 6: 스타일 정리**
- `src/components/v3/AliasBadge.css`:
  - category별 색상 클래스 제거
  - 단일 gradient 색상 적용

### 7.3 Phase 3: Testing & Migration (Step 7-9)

**Step 7: 마이그레이션 실행**
- 기존 dictionary 파일 백업
- 마이그레이션 스크립트 실행
- 변환 결과 검증 (중복 제거, 데이터 손실 확인)

**Step 8: 통합 테스트**
- 시나리오 1: 마이그레이션 후 AI 검색 정상 동작
- 시나리오 2: DictionaryEditor에서 새 항목 추가
- 시나리오 3: AI 자동 생성 정상 동작 (2필드만 생성)
- 시나리오 4: AliasBadge 툴팁 정상 표시

**Step 9: 문서 업데이트**
- `CLAUDE.md`: 새로운 DictionaryEntry 구조 반영
- 릴리즈 노트: v4.3.0 변경 내용 작성
- `CHANGELOG.md`: 업데이트

---

## 8. Dependencies

### 8.1 External Dependencies

- **Node.js**: 마이그레이션 스크립트 실행 환경
- **TypeScript**: 타입 안전성 보장

### 8.2 Internal Dependencies

- **v4.2.0 AI Chatbot Alias Display**: 기존 AI 검색 기능 호환
- **v4.1.0 Name Dictionary**: 기존 dictionary 파일 형식

### 8.3 Breaking Changes

⚠️ **Breaking Change**: DictionaryEntry 타입 변경으로 기존 코드 영향
- 영향 범위: DictionaryEditor, AliasBadge, claudeClient, dictionaryGenerator
- 해결 방법: 마이그레이션 스크립트 실행 + 타입 수정

---

## 9. Risk Analysis

### 9.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|:-----------:|:------:|-----------|
| 마이그레이션 실패 (데이터 손실) | Low | High | 백업 자동 생성, 롤백 기능 |
| 중복 제거 로직 오류 | Medium | Medium | 단위 테스트, 수동 검증 |
| AI 검색 기능 중단 | Low | High | 통합 테스트, 단계별 배포 |
| category 정보 손실로 인한 UX 저하 | Low | Low | 단일 색상으로도 충분 |

### 9.2 User Experience Risks

| Risk | Probability | Impact | Mitigation |
|------|:-----------:|:------:|-----------|
| 사용자가 마이그레이션 필요성 이해 못함 | Medium | Low | 가이드 문서, 자동 실행 |
| DictionaryEditor UI 변경으로 혼란 | Low | Medium | 온보딩 메시지, 도움말 |
| aliases textarea 입력 방식 불편 | Low | Low | 줄바꿈 자동 인식, 예시 제공 |

---

## 10. Testing Strategy

### 10.1 Unit Tests

- **migrate-dictionary-v43.ts**: 마이그레이션 로직 테스트
  - 6필드 → 2필드 변환
  - 중복 제거 (대소문자 무시)
  - 빈 문자열 제거
- **DictionaryEditor.tsx**: 입력 유효성 검증
- **AliasBadge.tsx**: 툴팁 렌더링 테스트

### 10.2 Integration Tests

- **E2E 시나리오**:
  1. 마이그레이션 실행 → 백업 생성 확인
  2. 마이그레이션 후 AI 검색 → 정상 동작 확인
  3. DictionaryEditor에서 새 항목 추가 → 저장 확인
  4. AI 자동 생성 → 2필드만 생성 확인
  5. AliasBadge 툴팁 → 간소화된 정보 표시 확인

### 10.3 Performance Tests

- **마이그레이션 시간**: 1000개 항목 → < 1초
- **메모리 사용량**: 필드 수 감소로 ≥ 30% 감소 확인
- **AI 생성 시간**: 불필요한 필드 생성 제거로 ≥ 20% 단축 확인

---

## 11. Rollout Plan

### 11.1 Phase 1: Internal Testing (1 day)

- 개발 환경에서 마이그레이션 스크립트 실행
- 기존 dictionary 백업 생성 확인
- 변환 결과 검증 (데이터 손실, 중복 제거)

### 11.2 Phase 2: Beta Release (2 days)

- 일부 사용자에게 v4.3 배포
- 마이그레이션 가이드 제공
- 피드백 수집 및 버그 수정

### 11.3 Phase 3: General Availability (v4.3.0)

- 모든 사용자에게 배포
- 자동 마이그레이션 실행 (첫 실행 시)
- 릴리즈 노트 공개

---

## 12. Success Criteria

### 12.1 Launch Criteria

- [x] FR-01 ~ FR-04 (P0) 모두 구현 완료
- [x] 마이그레이션 스크립트 테스트 통과 (데이터 손실 0%)
- [x] 통합 테스트 모든 시나리오 통과
- [x] 코드 리뷰 완료

### 12.2 Post-Launch Metrics (1주 후)

- 마이그레이션 성공률: 100% (데이터 손실 없음)
- AI 생성 시간 단축: ≥ 20%
- 사용자 혼란 없음: 피드백 기반
- 메모리 사용량 감소: ≥ 30%

---

## 13. Future Enhancements (v4.4+)

### 13.1 AI 생성 품질 개선

- 별칭 추천 알고리즘 개선
- 유사 별칭 자동 매칭

### 13.2 다국어 지원

- 영어, 일본어 별칭 추가
- 언어별 aliases 분리

### 13.3 카테고리 재도입 (선택적)

- 사용자 요청 시 category 필드 재추가 가능
- 선택적 필드로 설계 (없어도 동작)

---

## 14. Related Documents

- **v4.2.0 AI Chatbot Alias Display Plan**: `docs/01-plan/features/ai-chatbot-alias-display.plan.md`
- **v4.1.0 Name Dictionary Plan**: `docs/archive/2026-02/name-dictionary/name-dictionary.plan.md`
- **CLAUDE.md**: 프로젝트 컨텍스트 문서

---

## 15. Migration Guide

### 15.1 For Users

**자동 마이그레이션**:
- v4.3.0 첫 실행 시 자동으로 마이그레이션 실행
- 백업 파일 생성: `{fingerprint}.backup.json`
- 문제 발생 시 백업 파일로 복원 가능

**수동 마이그레이션**:
```bash
# 마이그레이션 스크립트 실행
npm run migrate:dictionary

# 백업에서 복원 (문제 발생 시)
npm run restore:dictionary
```

### 15.2 For Developers

**타입 변경 사항**:
```typescript
// Old (v4.2)
interface DictionaryEntry {
  originalToken: string;
  shortName: string;
  longName: string;
  koreanName: string;
  aliases: string[];
  category: string;
}

// New (v4.3)
interface DictionaryEntry {
  originalToken: string;
  aliases: string[];  // shortName, longName, koreanName 통합
}
```

**코드 수정 가이드**:
```typescript
// Old: shortName 접근
const displayName = entry.shortName;

// New: aliases 첫 번째 항목 사용
const displayName = entry.aliases[0] || entry.originalToken;

// Old: category 색상
const colorClass = `badge-${entry.category}`;

// New: 단일 색상
const colorClass = 'badge-default';
```

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
