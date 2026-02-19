---
feature: ai-chatbot-alias-display
version: v4.5.0
status: planning
created: 2026-02-16
updated: 2026-02-16
author: Claude Code
---

# AI Chatbot Alias Display Enhancement - Plan Document

> **Feature**: AI 챗봇 검색 결과에 별칭 표시
> **Version**: v4.5.0 (v4.4.0 dictionary structure 기반)
> **Status**: 📋 Planning
> **Type**: Enhancement (AI Chatbot + Name Dictionary v4.4.0)

---

## 1. Feature Overview

### 1.1 Summary

AI 챗봇 검색 결과에서 매칭된 이름 사전 정보를 함께 표시하는 기능입니다. v4.4.0 dictionary 구조(name, configKeywords, searchAliases)를 활용하여, 사용자가 검색한 키워드와 해당 그룹의 모든 Config 키워드를 배지와 툴팁으로 표시합니다.

### 1.2 Key Capabilities

1. **매칭 정보 반환**: Claude 응답에 어떤 dictionary entry와 매칭되었는지 정보 추가 (v4.4.0 구조)
2. **별칭 배지 표시**: 검색 결과 각 항목 옆에 매칭된 그룹명(name) 배지 표시
3. **툴팁 상세 정보**: 배지 hover 시 전체 정보 표시 (그룹명, 매칭된 키워드, Config 키워드 목록)
4. **하이라이트 강조**: 사용자가 검색한 키워드에 해당하는 configKeyword 강조 표시
5. **Type 필터링 기능**: AI 챗봇 활성화 시 기본값 "All" 선택, 사용자가 특정 Type 지정 시 해당 Type만 검색

### 1.3 Example Use Case

**현재 (v4.4.0)**:
```
사용자: "SK쉴더스 서비스 보여줘"
결과:
  ✅ Epipe-1001: Cust-SKShielders_Seoul_100M
  ✅ VPLS-2001: Cust-ADTCAPS_Busan_1G
  ✅ VPRN-3001: Cust-Infosec_Gangnam_10G
  (문제 1: Bizen, ADTCAPS, SKShielders, Infosec가 모두 같은 고객인데 연관성 파악 어려움)
  (문제 2: 사용자가 "SK쉴더스"로 검색했는데 Config 영문 키워드만 보임)
  (문제 3: Type 필터가 없어 모든 타입이 섞여 나옴)
```

**개선 후 (v4.5.0)**:
```
[Type 필터: All ▼]  (기본값)
사용자: "SK쉴더스 서비스 보여줘"
결과:
  ✅ Epipe-1001: Cust-SKShielders_Seoul_100M [SK쉴더스 🏷️]
      hover → 그룹: SK쉴더스
              매칭: SK쉴더스 (searchAliases)
              Config 키워드: Bizen, ADTCAPS, SKShielders, Infosec
  ✅ VPLS-2001: Cust-ADTCAPS_Busan_1G [SK쉴더스 🏷️]
      hover → 매칭: ADTCAPS (configKeywords) → SK쉴더스
  ✅ VPRN-3001: Cust-Infosec_Gangnam_10G [SK쉴더스 🏷️]
      hover → 매칭: Infosec (configKeywords) → SK쉴더스
  (해결 1: 모든 configKeywords가 "SK쉴더스" 그룹으로 통합 표시)
  (해결 2: 사용자가 검색한 searchAlias가 배지로 표시됨)
  (해결 3: Type "All" 기본값으로 모든 타입 검색)

[Type 필터: VPRN ▼]  (사용자가 선택)
사용자: "ISAC 서비스 보여줘"  (SK쉴더스의 또 다른 검색어)
결과:
  ✅ VPRN-3001: Cust-Infosec_Gangnam_10G [SK쉴더스 🏷️]
      hover → 매칭: ISAC (searchAliases) → SK쉴더스
  (해결 4: VPRN만 필터링 + searchAlias "ISAC"으로 검색 성공)
```

---

## 2. Business Value

### 2.1 Problem Statement

**현재 상황** (v4.4.0):
- AI 챗봇이 이름 사전(v4.4.0)을 활용하여 검색 가능
- 하지만 **검색 결과에는 Config 키워드만 표시**됨
- 사용자가 "SK쉴더스"로 검색해도 결과에는 "Bizen", "ADTCAPS", "SKShielders", "Infosec" 등 Config 키워드만 보임
- **특히 여러 configKeywords를 가진 그룹의 경우 혼란 극심**:
  - 예: SK쉴더스 그룹 = configKeywords: [Bizen, ADTCAPS, SKShielders, Infosec]
  - 모두 같은 고객인데 서로 다른 Config 키워드로 보여 연관성 파악 불가

**문제 영향**:
- 사용자가 자신이 검색한 키워드와 결과의 연관성을 파악하기 어려움
- "내가 SK쉴더스로 검색했는데 왜 ADTCAPS가 나오지?" 혼란
- 여러 별칭이 흩어져 있어 같은 고객의 서비스를 통합 파악 불가
- AI가 이름 사전을 활용했다는 사실을 사용자가 인지하지 못함
- 검색 신뢰도 저하 및 사용성 악화

### 2.2 Business Benefits

1. **검색 투명성**: 어떤 키워드로 매칭되었는지 명확히 표시
   - SK쉴더스의 4개 configKeywords(Bizen, ADTCAPS, SKShielders, Infosec)가 모두 하나의 그룹으로 통합
2. **사용자 신뢰 향상**: AI가 이름 사전(v4.4.0)을 활용했음을 시각적으로 확인
   - "ISAC" (searchAlias)으로 검색했는데 "Infosec" (configKeyword) 결과가 나와도 [SK쉴더스 🏷️] 배지로 연관성 확인
3. **학습 효과**: 사용자가 다양한 Config 키워드를 자연스럽게 학습
   - 툴팁을 통해 "아, ADTCAPS도 SK쉴더스 그룹이었구나" 학습
4. **UX 개선**: 검색 키워드와 결과의 관계를 직관적으로 파악
   - 복잡한 그룹(4개 이상 configKeywords)도 명확하게 그룹핑

### 2.3 Target Users

- **Primary**: AI 챗봇을 사용하여 서비스를 검색하는 모든 사용자
- **Secondary**: 이름 사전을 구축하고 관리하는 사용자

---

## 3. Goals and Objectives

### 3.1 Primary Goals

1. **Claude 응답 확장**: ChatResponse에 `matchedEntries` 필드 추가
2. **배지 UI 구현**: ServiceListV3에서 매칭된 별칭을 배지로 표시
3. **툴팁 정보 제공**: 배지 hover 시 전체 이름 변형 표시
4. **키워드 하이라이트**: 사용자가 검색한 별칭 강조 표시
5. **Type 필터 통합**: AI 챗봇에서 Type 필터 선택 가능, 기본값 "All"

### 3.2 Secondary Goals

1. **다중 매칭 지원**: 하나의 서비스가 여러 dictionary entry와 매칭된 경우 모두 표시
2. **색상 코딩**: 카테고리별 배지 색상 (customer: blue, location: green 등)
3. **접기/펼치기**: 별칭이 5개 이상일 경우 "+N개 더보기" 버튼 (예: SK쉴더스는 5개 별칭)
4. **성능 최적화**: 별칭 정보가 추가되어도 응답 시간 1초 이내 유지
5. **복잡한 케이스 처리**: SK쉴더스처럼 6개 이상의 별칭을 가진 엔티티도 원활하게 표시

### 3.3 Success Metrics

| Metric | Target | Measurement |
|--------|:------:|:-----------:|
| 별칭 표시 정확도 | 100% | 매칭된 모든 별칭 표시 |
| 응답 시간 증가 | < 10% | Claude maxTokens 조정 |
| 사용자 혼란 감소 | ≥ 80% | 사용자 피드백 |
| 배지 클릭률 | ≥ 50% | 툴팁 hover 추적 |
| 5개 이상 별칭 처리 | 100% | SK쉴더스 케이스 정상 표시 |

---

## 4. Scope

### 4.1 In Scope

#### 4.1.1 Backend Changes

- [x] **ChatResponse 타입 확장** (v4.4.0 dictionary 구조 기반):
  ```typescript
  interface MatchedEntry {
    matchedAlias: string;         // 실제로 매칭된 키워드 (예: "SK쉴더스", "Bizen")
    configKeywords: string[];     // Config 검색에 사용될 키워드들 (예: ["Bizen", "ADTCAPS", "SKShielders", "Infosec"])
    groupName: string;            // 그룹 대표 이름 (예: "SK쉴더스")
  }

  interface ChatResponse {
    selectedKeys: string[];
    explanation: string;
    confidence: 'high' | 'medium' | 'low';
    filterType?: 'all' | 'epipe' | 'vpls' | 'vprn' | 'ies';
    matchedEntries?: MatchedEntry[]; // 🆕 추가 (v4.5.0)
  }
  ```

- [x] **systemPrompt.ts 확장**: Claude에게 매칭 정보 반환 요청
  - "매칭된 dictionary entry를 matchedEntries에 포함하세요"
  - "matchedBy 필드에 어떤 필드로 매칭되었는지 명시하세요"

- [x] **claudeClient.ts 검증 로직**: matchedEntries 유효성 검증

#### 4.1.2 Frontend Components

- [x] **AIChatPanel.tsx**:
  - matchedEntries를 ServiceListV3에 전달
  - Type 필터 UI 추가 (All, Epipe, VPLS, VPRN, IES)
  - 선택된 filterType을 chatApi에 전달

- [x] **ServiceListV3.tsx**:
  - 별칭 배지 렌더링 로직
  - 배지 클릭 시 툴팁 표시
  - 카테고리별 배지 색상 스타일
  - AI 활성화 시 Type 필터 기본값 "All" 설정

- [x] **AliasBadge.tsx** (신규 컴포넌트):
  - 별칭 배지 UI
  - 툴팁 렌더링
  - 다중 별칭 접기/펼치기

#### 4.1.3 Styling

- [x] **AliasBadge.css**: 배지 스타일, 툴팁 애니메이션, 카테고리 색상

### 4.2 Out of Scope

- ❌ **검색 히스토리**: 이전 검색어 저장 기능 (v4.3에서 고려)
- ❌ **별칭 자동 수정**: 사용자가 잘못 입력한 별칭 자동 교정 (v4.3에서 고려)
- ❌ **다국어 지원**: 영어/일본어 별칭 (현재는 한국어만)
- ❌ **음성 검색**: 음성 입력 지원

### 4.3 Assumptions

- AWS Bedrock Claude Sonnet 4는 JSON 구조 변경을 정확히 이해하고 응답
- matchedEntries 추가로 인한 응답 크기 증가는 성능에 영향 없음 (maxTokens 1024 → 2048 증가)
- 사용자는 배지 hover로 상세 정보를 확인할 의도가 있음

---

## 5. Requirements

### 5.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|:--------:|:------:|
| FR-01 | Claude가 매칭된 dictionary entry 정보를 반환해야 함 | P0 | ⏳ |
| FR-02 | matchedEntries에는 originalToken, 이름 변형, matchedBy 포함 | P0 | ⏳ |
| FR-03 | ServiceListV3에서 별칭 배지를 서비스 항목 옆에 표시 | P0 | ⏳ |
| FR-04 | 배지 hover 시 툴팁으로 전체 이름 변형 표시 | P0 | ⏳ |
| FR-05 | 사용자가 검색한 키워드에 해당하는 별칭 강조 표시 | P1 | ⏳ |
| FR-06 | 카테고리별 배지 색상 구분 (customer, location, service, device) | P1 | ⏳ |
| FR-07 | 하나의 서비스가 여러 entry와 매칭 시 모두 표시 | P1 | ⏳ |
| FR-08 | 별칭이 3개 이상일 경우 "+N개 더보기" 접기/펼치기 | P2 | ⏳ |
| FR-09 | AI 챗봇 활성화 시 Type 필터 기본값 "All" 자동 선택 | P0 | ⏳ |
| FR-10 | 사용자가 Type 선택 시 해당 Type만 검색 (filterType 전달) | P0 | ⏳ |

### 5.2 Non-Functional Requirements

| ID | Requirement | Target | Priority |
|----|-------------|:------:|:--------:|
| NFR-01 | AI 응답 시간 | < 3초 (95th percentile) | P0 |
| NFR-02 | 배지 렌더링 성능 | 60 FPS (애니메이션 부드러움) | P1 |
| NFR-03 | 툴팁 표시 지연 | < 300ms (hover 후) | P1 |
| NFR-04 | 모바일 반응형 | 배지가 화면 밖으로 나가지 않음 | P2 |
| NFR-05 | 접근성 | 키보드로 배지 포커스 가능 (탭 키) | P2 |

---

## 6. Technical Architecture

### 6.1 System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    User Interaction                      │
└─────────────────┬───────────────────────────────────────┘
                  │ "SK쉴더스 서비스 보여줘"
                  ↓
┌─────────────────────────────────────────────────────────┐
│              AIChatPanel (Frontend)                      │
│  - Type 필터 선택 (기본값: All)                          │
│  - sendChatMessage(query, configSummary, dictionary,    │
│                    filterType)                           │
└─────────────────┬───────────────────────────────────────┘
                  │ POST /api/chat { filterType: "all" }
                  ↓
┌─────────────────────────────────────────────────────────┐
│              Express Backend                             │
│  1. systemPrompt with dictionary section                │
│  2. "매칭 정보를 matchedEntries에 포함하세요"           │
│  3. filterType을 Claude에게 전달                        │
│     "only search for {filterType} services"             │
└─────────────────┬───────────────────────────────────────┘
                  │ AWS Bedrock Converse API
                  ↓
┌─────────────────────────────────────────────────────────┐
│              Claude Sonnet 4                             │
│  - Dictionary 기반 매칭                                  │
│  - matchedEntries 생성:                                  │
│    [{ originalToken: "SKShielders",                     │
│       koreanName: "SK쉴더스",                            │
│       aliases: ["ADTCAPS","Bizen","Infosec","ISAC"],   │
│       matchedBy: "koreanName" }]                        │
└─────────────────┬───────────────────────────────────────┘
                  │ ChatResponse
                  ↓
┌─────────────────────────────────────────────────────────┐
│              ServiceListV3 (Frontend)                    │
│  - selectedKeys로 서비스 선택                            │
│  - matchedEntries로 AliasBadge 렌더링                   │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────┐
│              AliasBadge Component                        │
│  - 배지: [SK쉴더스 🏷️]                                   │
│  - 툴팁: "원본: SKShielders | 한국어: SK쉴더스          │
│           별칭: ADTCAPS, Bizen, Infosec, ISAC, ..."    │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Data Flow

```typescript
// 1. 프론트엔드 → 백엔드
POST /api/chat
{
  message: "SK쉴더스 서비스 보여줘",
  configSummary: { devices: [...] },
  dictionary: {  // v4.4.0 structure
    entries: [{
      n: "SK쉴더스",                                              // name
      k: ["Bizen", "ADTCAPS", "SKShielders", "Infosec"],        // configKeywords
      a: ["SK쉴더스", "ISAC", "인포섹", "SK Shielders"]          // searchAliases
    }]
  },
  filterType: "all"  // 🆕 추가 (or "epipe", "vpls", "vprn", "ies")
}

// 2. 백엔드 → Claude
systemPrompt: "매칭된 dictionary entry를 matchedEntries에 포함하세요 (v4.4.0)"
userContent: ConfigSummary + Name Dictionary (v4.4.0) + 사용자 질문
  + "filterType: all (모든 타입 검색)" // 🆕 filterType 조건 추가
  // 또는 "filterType: epipe (Epipe 서비스만 검색)"

// 3. Claude → 백엔드 (v4.5.0 response)
{
  "selectedKeys": ["epipe-1001", "vpls-2001", "vprn-3001"],
  "explanation": "SK쉴더스 관련 서비스 3개를 찾았습니다.",
  "confidence": "high",
  "matchedEntries": [
    {
      "matchedAlias": "SK쉴더스",                                 // 실제 매칭된 키워드
      "configKeywords": ["Bizen", "ADTCAPS", "SKShielders", "Infosec"], // Config 검색 키워드
      "groupName": "SK쉴더스"                                     // 그룹 대표 이름
    }
  ]
}

// 4. 백엔드 → 프론트엔드
ChatResponse (검증 후 전달)

// 5. 프론트엔드 렌더링
ServiceListV3:
  - 체크박스 선택 (selectedKeys 기반)
  - AliasBadge 렌더링 (matchedEntries 기반)
```

### 6.3 Component Hierarchy

```
V3Page
└── ServiceListV3
    ├── AIChatPanel
    │   ├── Type 필터 드롭다운 🆕
    │   │   └── [All, Epipe, VPLS, VPRN, IES]
    │   └── (사용자 입력, AI 응답 처리)
    └── 서비스 목록
        ├── 체크박스
        ├── 서비스 정보 (description)
        │   예: Cust-SKShielders_Seoul_100M
        │       Cust-ADTCAPS_Busan_1G
        │       Cust-Infosec_Gangnam_10G
        └── AliasBadge 🆕
            ├── 배지 아이콘 ([SK쉴더스 🏷️])
            └── Tooltip (v4.4.0 구조)
                ├── 그룹: SK쉴더스 (groupName)
                ├── 매칭: SK쉴더스 (matchedAlias)
                └── Config 키워드: Bizen, ADTCAPS, SKShielders, Infosec (configKeywords)
```

---

## 7. Implementation Plan

### 7.1 Phase 1: Backend (Step 1-3)

**Step 1: 타입 정의 확장** (v4.4.0 기반)
- ✅ **ALREADY EXISTS** `server/src/types.ts`: MatchedEntry 인터페이스 (v4.4.0에서 이미 정의됨)
- ✅ **ALREADY EXISTS** `src/services/chatApi.ts`: ChatResponse에 matchedEntries 포함 (v4.4.0)

**Step 2: systemPrompt 및 API 수정**
- ✅ **ALREADY EXISTS** `server/src/prompts/systemPrompt.ts`:
  - matchedEntries 응답 형식 이미 정의됨 (v4.4.0)
  - filterType 조건 설명 이미 포함 (v4.4.0)
  - 응답 JSON 예시 업데이트 완료

- ⏳ **TO DO** `server/src/routes/chat.ts`:
  - ChatRequest에 filterType 파라미터 추가 필요
  - filterType을 claudeClient.askClaude()에 전달 필요

- ✅ **ALREADY EXISTS** `server/src/services/claudeClient.ts`:
  - askClaude() 시그니처에 filterType 이미 존재 (v4.4.0)
  - userContent에 filterType 조건 이미 포함

**Step 3: 검증 로직 확인**
- ✅ **ALREADY EXISTS** `server/src/services/claudeClient.ts`:
  - matchedEntries 유효성 검증 로직 존재 (validateMatchedEntries, v4.4.0)
  - dictionary 실제 존재 여부 확인 완료
  - maxTokens 이미 2048로 설정됨 (v4.4.0)

### 7.2 Phase 2: Frontend (Step 4-6)

**Step 4: AliasBadge 컴포넌트 업데이트**
- ✅ **ALREADY EXISTS** `src/components/v3/AliasBadge.tsx`:
  - 배지 렌더링 이미 구현 (v4.4.0)
  - 툴팁 로직 구현 완료 (groupName, matchedAlias, configKeywords)
  - ⏳ **OPTIONAL**: 접기/펼치기 (configKeywords 5개 이상)

**Step 5: ServiceListV3 통합**
- ⏳ **TO DO** `src/components/v3/ServiceListV3.tsx`:
  - matchedEntries state 추가 필요
  - AliasBadge 렌더링 위치 결정 (서비스 항목 옆)
  - selectedKeys와 matchedEntries 매핑 로직
  - AI 활성화 시 Type 필터 기본값 "All" 설정
  - Type 필터 UI 추가 (드롭다운 또는 라디오 버튼)

- ⏳ **TO DO** `src/services/chatApi.ts`:
  - sendChatMessage()에 filterType 파라미터 추가

**Step 6: 스타일링 확인**
- ✅ **ALREADY EXISTS** `src/components/v3/AliasBadge.css`:
  - 배지 기본 스타일 구현 완료 (v4.4.0)
  - 툴팁 애니메이션 구현 완료
  - 반응형 지원 완료

### 7.3 Phase 3: Testing & Refinement (Step 7-8)

**Step 7: 통합 테스트** (v4.4.0 구조)
- 시나리오 1: searchAlias 검색 → 배지 표시 확인 ("SK쉴더스" → [SK쉴더스 🏷️])
- 시나리오 2: configKeyword 검색 → 매칭 확인 ("Bizen" → [SK쉴더스 🏷️])
- 시나리오 3: 다중 매칭 → 여러 배지 표시 (여러 서비스가 같은 그룹)
- 시나리오 4: dictionary 없이 검색 → 배지 없음 확인
- 시나리오 5: Type "All" 기본값 → 모든 타입 검색 확인
- 시나리오 6: Type "Epipe" 선택 → Epipe만 검색 확인
- 시나리오 7: Type "VPRN" 선택 → VPRN만 검색 확인

**Step 8: 성능 최적화**
- matchedEntries가 100개 이상일 때 성능 테스트
- 배지 렌더링 최적화 (React.memo, useMemo)
- 툴팁 렌더링 최적화 (lazy rendering)

---

## 8. Dependencies

### 8.1 External Dependencies

- **AWS Bedrock Claude Sonnet 4**: JSON 구조 변경 대응 가능
- **React 19**: 툴팁 렌더링 (Portal 사용 가능)
- **TypeScript**: 타입 안전성 보장

### 8.2 Internal Dependencies

- **v4.4.0 Name Dictionary**: 이름 사전 v4.4.0 구조 (name, configKeywords, searchAliases)
- **v4.0.0 AI Chatbot**: chatApi.ts, AIChatPanel.tsx 기존 구현
- **ConfigSummary**: 서비스 description 정보 필요
- **AliasBadge component**: v4.4.0에서 이미 구현됨

### 8.3 Feature Flags

- **ENABLE_ALIAS_BADGE**: 환경변수로 배지 표시 on/off (개발 단계에서 유용)
  ```env
  ENABLE_ALIAS_BADGE=true
  ```

---

## 9. Risk Analysis

### 9.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|:-----------:|:------:|-----------|
| Claude가 matchedEntries를 정확히 반환하지 않음 | Medium | High | systemPrompt 개선, 응답 예시 추가 |
| matchedEntries 추가로 응답 시간 증가 | Low | Medium | maxTokens 조정, 캐싱 고려 |
| 배지가 너무 많아 UI 복잡도 증가 | Medium | Medium | 접기/펼치기 기능, 최대 3개만 표시 |
| 5개 이상 별칭 렌더링 성능 | Low | Low | 가상 스크롤, lazy rendering |
| 모바일에서 툴팁 표시 어려움 | High | Low | 클릭 시 모달로 표시 |

### 9.2 User Experience Risks

| Risk | Probability | Impact | Mitigation |
|------|:-----------:|:------:|-----------|
| 사용자가 배지의 의미를 이해하지 못함 | Medium | Medium | 툴팁에 설명 추가, 온보딩 가이드 |
| 배지 클릭률이 낮음 (관심 없음) | Medium | Low | A/B 테스트, 사용자 피드백 수집 |
| 색상 구분이 직관적이지 않음 | Low | Low | 표준 색상 사용 (blue=customer, green=location) |

---

## 10. Testing Strategy

### 10.1 Unit Tests

- **claudeClient.ts**: matchedEntries 검증 로직 테스트
- **AliasBadge.tsx**: 배지 렌더링, 툴팁 표시 테스트
- **ServiceListV3.tsx**: matchedEntries와 selectedKeys 매핑 테스트

### 10.2 Integration Tests

- **E2E 시나리오**:
  1. 한국어 검색 → 배지 표시 → 툴팁 확인
     - "SK쉴더스" 검색 → [SK쉴더스 🏷️] 배지 표시
  2. 별칭 검색 → 배지 표시 → matchedBy 확인
     - "ADTCAPS" 검색 → [SK쉴더스 🏷️] 배지 표시, matchedBy="alias"
  3. 다중 매칭 → 여러 배지 표시
     - "SK쉴더스" 검색 → SKShielders, ADTCAPS, Infosec 항목 모두 [SK쉴더스 🏷️] 표시
  4. dictionary 없이 검색 → 배지 없음
  5. **복잡한 케이스** (5개 이상 별칭):
     - SK쉴더스 (5개 별칭) → "+N개 더보기" 버튼 확인
     - 툴팁에서 모든 별칭 표시 확인

### 10.3 Performance Tests

- **응답 시간**: 100개 서비스, 50개 dictionary entry → 3초 이내
- **렌더링 성능**: 100개 배지 렌더링 → 60 FPS 유지
- **메모리 사용량**: matchedEntries 추가로 인한 메모리 증가 < 10%

---

## 11. Rollout Plan

### 11.1 Phase 1: Internal Testing (1-2 days)

- 개발 환경에서 기능 구현
- 팀 내부 테스트 (config1.txt, config2.txt)
- 피드백 수집 및 버그 수정

### 11.2 Phase 2: Beta Release (3-5 days)

- `ENABLE_ALIAS_BADGE=true` 환경변수로 기능 활성화
- 일부 사용자에게 베타 테스트 요청
- A/B 테스트: 배지 있음 vs 없음 (클릭률, 만족도)

### 11.3 Phase 3: General Availability (v4.2.0)

- 모든 사용자에게 기능 공개
- 릴리즈 노트 작성
- 사용자 가이드 업데이트

---

## 12. Success Criteria

### 12.1 Launch Criteria

- [x] FR-01 ~ FR-04 (P0) 모두 구현 완료
- [x] NFR-01 (응답 시간 < 3초) 충족
- [x] 통합 테스트 모든 시나리오 통과
- [x] 코드 리뷰 완료 (TypeScript strict mode)

### 12.2 Post-Launch Metrics (2주 후)

- 배지 표시 정확도: 100% (매칭된 모든 별칭 표시)
- 툴팁 hover 비율: ≥ 50% (사용자가 관심 있음)
- AI 응답 시간 증가: < 10% (성능 영향 미미)
- 사용자 혼란 감소: ≥ 80% (피드백 기반)

---

## 13. Future Enhancements (v4.3+)

### 13.1 고급 Type 필터링

- Type 다중 선택 (예: Epipe + VPLS 동시 검색)
- Type별 결과 개수 표시 (Epipe: 3, VPLS: 5)
- 최근 사용한 Type 필터 저장

### 13.2 검색 히스토리

- 이전 검색어 저장 및 자동완성
- 자주 사용하는 searchAliases 우선 표시

### 13.3 검색어 자동 수정

- 사용자가 오타를 입력하면 자동 교정 제안
- "SK쉴더즈" → "SK쉴더스로 검색하시겠습니까?"
- "ADTCAP" → "ADTCAPS로 검색하시겠습니까?"

### 13.4 다국어 지원

- 영어, 일본어 별칭 추가
- 다국어 사용자를 위한 이름 사전 확장

### 13.5 음성 검색

- 음성 입력 지원 (Web Speech API)
- 한국어 음성 인식 정확도 개선

---

## 14. Related Documents

- **v4.4.0 Dictionary Structure**: `docs/02-design/features/dictionary-structure-v5.design.md`
- **v4.1.0 Name Dictionary Plan**: `docs/archive/2026-02/name-dictionary/name-dictionary.plan.md`
- **v4.0.0 AI Chatbot Plan**: `docs/archive/2026-02/ai-chat-search/ai-chat-search.plan.md`
- **CLAUDE.md**: 프로젝트 컨텍스트 문서
- **DIAGRAM_RULES.md**: 다이어그램 렌더링 규칙

---

## 15. Approval

| Role | Name | Date | Status |
|------|------|------|:------:|
| Product Owner | User | 2026-02-16 | ⏳ Pending |
| Tech Lead | Claude Code | 2026-02-16 | ✅ Approved |

---

## 16. Implementation Status

### v4.4.0 Dictionary Structure (✅ Completed)
- MatchedEntry interface with v4.4.0 structure
- systemPrompt with matchedEntries response format
- AliasBadge component with tooltip (groupName, matchedAlias, configKeywords)
- Validation logic for matchedEntries

### v4.5.0 Remaining Work
- **Frontend**: ServiceListV3 matchedEntries integration
- **Frontend**: Type filter UI (dropdown)
- **API**: ChatRequest filterType parameter handling
- **Testing**: Integration tests for all scenarios

---

**Last Updated**: 2026-02-16 (Updated to v4.4.0 dictionary structure + v4.5.0 scope)
**Document Version**: 2.0
**Status**: 📋 Planning (Updated for v4.4.0 compatibility)
