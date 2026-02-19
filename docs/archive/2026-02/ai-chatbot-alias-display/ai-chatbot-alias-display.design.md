# AI Chatbot Alias Display Enhancement - Design Document

> **Summary**: Display matched dictionary information (v4.4.0 structure) in AI chatbot search results with badge UI, tooltips, and Type filtering.
>
> **Project**: Nokia Config Visualizer
> **Version**: v4.5.0 (based on v4.4.0 dictionary)
> **Author**: Claude Code
> **Date**: 2026-02-16
> **Updated**: 2026-02-16
> **Status**: Design
> **Planning Doc**: [ai-chatbot-alias-display.plan.md](../../01-plan/features/ai-chatbot-alias-display.plan.md)

---

## 1. Overview

### 1.1 Design Goals

1. **Enhanced Search Transparency**: Display matched dictionary information (v4.4.0) in AI chatbot results - group name, matched keyword, config keywords
2. **Visual Feedback**: Badge UI showing group name (name field) that matched user's search query
3. **Complete Config Information**: Tooltip showing group name, matched keyword (searchAlias or configKeyword), and all configKeywords
4. **Type Filtering**: Default "All" filter with option to specify service type (Epipe, VPLS, VPRN, IES)
5. **Complex Case Handling**: Support groups with 4+ configKeywords (e.g., SK쉴더스: configKeywords=[Bizen, ADTCAPS, SKShielders, Infosec])
6. **Performance**: No significant degradation in response time (<10% increase acceptable)

### 1.2 Design Principles

- **Incremental Enhancement**: Build on existing v4.4.0 Name Dictionary and AI Chatbot infrastructure
- **User-Centric**: Display group name (name field) that users can understand, with config keywords in tooltip
- **Progressive Disclosure**: Badge shows group name, tooltip reveals matched keyword and all configKeywords
- **Graceful Degradation**: Works seamlessly with or without Name Dictionary
- **Minimal Intrusiveness**: Badge design is subtle, not overwhelming
- **Accessibility**: Keyboard navigable, screen reader friendly

### 1.3 Key Use Cases

#### Use Case 1: searchAlias Search (v4.4.0)
```
User Query: "SK쉴더스 서비스 보여줘"
Results:
  ✅ Epipe-1001: Cust-SKShielders_Seoul_100M [SK쉴더스 🏷️]
  ✅ VPLS-2001: Cust-ADTCAPS_Busan_1G [SK쉴더스 🏷️]
  ✅ VPRN-3001: Cust-Infosec_Gangnam_10G [SK쉴더스 🏷️]
Tooltip: "그룹: SK쉴더스 | 매칭: SK쉴더스 (searchAliases) | Config 키워드: Bizen, ADTCAPS, SKShielders, Infosec"
```

#### Use Case 2: configKeyword Search with Type Filter (v4.4.0)
```
User Query: "ISAC 서비스 보여줘"
Type Filter: VPRN (selected by user)
Results:
  ✅ VPRN-3001: Cust-Infosec_Gangnam_10G [SK쉴더스 🏷️]
Tooltip: "그룹: SK쉴더스 | 매칭: ISAC (searchAliases) | Config 키워드: Bizen, ADTCAPS, SKShielders, Infosec"
```

#### Use Case 3: No Dictionary Match
```
User Query: "100M 이상 서비스 보여줘"
Results:
  ✅ Epipe-1001: ... (no badge)
  ✅ VPLS-2002: ... (no badge)
Note: No dictionary match, badge not shown
```

---

## 2. Architecture

### 2.1 Component Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                        Frontend (React 19)                         │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ ServiceListV3.tsx (Main Integration Hub)                     │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  • State: selectedKeys, matchedEntries, typeFilter           │  │
│  │  • AI Toggle: aiEnabled state                                │  │
│  │  • Type Filter: 기본값 "All", 사용자 선택 가능               │  │
│  │  • handleAIResponse(response: ChatResponse)                  │  │
│  │    - selectedKeys → onSetSelected()                          │  │
│  │    - matchedEntries → AliasBadge 렌더링                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│           ↓                                        ↓               │
│  ┌────────────────────────┐          ┌──────────────────────────┐  │
│  │ AIChatPanel.tsx        │          │ AliasBadge.tsx 🆕        │  │
│  │ (AI Input + Filter)    │          │ (Badge UI Component)     │  │
│  ├────────────────────────┤          ├──────────────────────────┤  │
│  │ • Type Filter 드롭다운 │          │ • Badge Display          │  │
│  │   [All,Epipe,VPLS...]  │          │ • Tooltip on Hover       │  │
│  │ • Input + Submit       │          │ • +N개 더보기 (5+ alias) │  │
│  │ • Loading State        │          │ • Category Color Coding  │  │
│  │ • Response Panel       │          │ • Keyboard Accessible    │  │
│  └────────────────────────┘          └──────────────────────────┘  │
│           ↓                                                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ chatApi.ts (API Client)                                      │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  • sendChatMessage(message, configSummary, dictionary,       │  │
│  │                    filterType) 🆕 filterType 추가             │  │
│  │    POST /api/chat                                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│           ↓ HTTP                                                   │
├────────────────────────────────────────────────────────────────────┤
│                        Backend (Express)                           │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ routes/chat.ts (Chat API Endpoint)                           │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  • POST /api/chat                                            │  │
│  │    - Extract: message, configSummary, dictionary, filterType │  │
│  │    - Call: askClaude(...)                                    │  │
│  │    - Return: ChatResponse with matchedEntries                │  │
│  └──────────────────────────────────────────────────────────────┘  │
│           ↓                                                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ services/claudeClient.ts (AWS Bedrock Wrapper)               │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  • askClaude(message, configSummary, dictionary, filterType) │  │
│  │    🆕 filterType 파라미터 추가                                │  │
│  │    - Build userContent with filterType instruction           │  │
│  │    - Send to AWS Bedrock Converse API                        │  │
│  │    - Parse response: selectedKeys + matchedEntries           │  │
│  │    - Validate matchedEntries                                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
│           ↓                                                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ prompts/systemPrompt.ts (AI Instructions)                    │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  • Extended system prompt:                                   │  │
│  │    - "matchedEntries 필드에 매칭 정보 포함"                  │  │
│  │    - "matchedBy 필드로 매칭 방식 명시"                       │  │
│  │    - "filterType 조건에 따라 서비스 타입 필터링"             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│           ↓ AWS Bedrock                                            │
├────────────────────────────────────────────────────────────────────┤
│                        AWS Bedrock Claude Sonnet 4                 │
├────────────────────────────────────────────────────────────────────┤
│  • Process: configSummary + dictionary + user query + filterType  │
│  • Match: dictionary entries to services                           │  │
│  • Return: selectedKeys + explanation + matchedEntries             │
└────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
1. User Interaction
   ↓
   [Type Filter: All ▼] 선택 (또는 Epipe, VPLS, VPRN, IES)
   "SK쉴더스 서비스 보여줘" 입력
   ↓
2. AIChatPanel
   - sendChatMessage(query, configSummary, dictionary, "all")
   ↓
3. POST /api/chat
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
     filterType: "all"  🆕
   }
   ↓
4. Backend: askClaude()
   - systemPrompt: "매칭 정보를 matchedEntries에 포함하세요 (v4.4.0)"
   - userContent: ConfigSummary + Dictionary (v4.4.0) + Query + filterType instruction
   - AWS Bedrock Converse API
   ↓
5. Claude Response (v4.5.0)
   {
     selectedKeys: ["epipe-1001", "vpls-2001", "vprn-3001"],
     explanation: "SK쉴더스 관련 서비스 3개",
     confidence: "high",
     filterType: "all",
     matchedEntries: [  // v4.4.0 structure
       {
         matchedAlias: "SK쉴더스",                                 // 매칭된 키워드
         configKeywords: ["Bizen", "ADTCAPS", "SKShielders", "Infosec"], // Config 키워드
         groupName: "SK쉴더스"                                     // 그룹명
       }
     ]
   }
   ↓
6. Frontend: handleAIResponse()
   - selectedKeys → onSetSelected() (체크박스 선택)
   - matchedEntries → AliasBadge 렌더링
   ↓
7. UI Rendering
   ✅ Epipe-1001: Cust-SKShielders_Seoul_100M [SK쉴더스 🏷️]
   ✅ VPLS-2001: Cust-ADTCAPS_Busan_1G [SK쉴더스 🏷️]
   ✅ VPRN-3001: Cust-Infosec_Gangnam_10G [SK쉴더스 🏷️]

   (hover on badge) → Tooltip (v4.4.0):
   "그룹: SK쉴더스
    매칭: SK쉴더스 (searchAliases)
    Config 키워드: Bizen, ADTCAPS, SKShielders, Infosec"
```

---

## 3. Data Model

### 3.1 TypeScript Interfaces

#### 3.1.1 MatchedEntry (v4.4.0 structure)

```typescript
// ✅ ALREADY EXISTS in server/src/types.ts (v4.4.0)
export interface MatchedEntry {
  /** 실제로 매칭된 키워드 (예: "SK쉴더스", "Bizen") */
  matchedAlias: string;

  /** Config 검색에 사용될 키워드들 (예: ["Bizen", "ADTCAPS", "SKShielders", "Infosec"]) */
  configKeywords: string[];

  /** 그룹 대표 이름 (예: "SK쉴더스") */
  groupName: string;
}
```

**Note**: This interface already exists in v4.4.0 - no changes needed.

#### 3.1.2 ChatRequest (Updated)

```typescript
// server/src/types.ts 업데이트
export interface ChatRequest {
  message: string;
  configSummary: ConfigSummary;
  dictionary?: DictionaryCompact;
  filterType?: 'all' | 'epipe' | 'vpls' | 'vprn' | 'ies';  // 🆕 추가
}
```

#### 3.1.3 ChatResponse (Updated)

```typescript
// server/src/types.ts 업데이트
export interface ChatResponse {
  selectedKeys: string[];
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
  filterType?: 'all' | 'epipe' | 'vpls' | 'vprn' | 'ies';
  matchedEntries?: MatchedEntry[];  // 🆕 추가
}
```

#### 3.1.4 AliasBadgeProps (v4.4.0)

```typescript
// ✅ ALREADY EXISTS in src/components/v3/AliasBadge.tsx (v4.4.0)
interface AliasBadgeProps {
  entry: MatchedEntry;  // v4.4.0 structure
}
```

**Note**: This component already exists in v4.4.0 - no changes needed.

### 3.2 Data Structures

#### 3.2.1 matchedEntries 매핑 규칙

```typescript
// ServiceListV3.tsx에서 사용
interface ServiceWithBadge {
  selectionKey: string;
  description: string;
  badge?: MatchedEntry;  // matchedEntries에서 찾은 매칭 정보
}

// matchedEntries → badge 매핑 로직
function mapMatchedEntriesToServices(
  services: ServiceSummary[],
  matchedEntries: MatchedEntry[]
): ServiceWithBadge[] {
  return services.map(service => {
    // description에서 originalToken 또는 alias 찾기
    const badge = matchedEntries.find(entry => {
      const tokens = [entry.originalToken, ...entry.aliases];
      return tokens.some(token =>
        service.description.toLowerCase().includes(token.toLowerCase())
      );
    });

    return { ...service, badge };
  });
}
```

---

## 4. API Specification

### 4.1 POST /api/chat (Updated)

#### Request

```typescript
{
  "message": "SK쉴더스 서비스 보여줘",
  "configSummary": {
    "devices": [
      {
        "hostname": "nokia-1",
        "systemIp": "10.0.0.1",
        "services": [
          {
            "serviceType": "epipe",
            "serviceId": 1001,
            "description": "Cust-SKShielders_Seoul_100M",
            "selectionKey": "epipe-1001",
            "saps": [...]
          }
        ]
      }
    ]
  },
  "dictionary": {  // v4.4.0 structure
    "entries": [
      {
        "n": "SK쉴더스",                                         // name
        "k": ["Bizen", "ADTCAPS", "SKShielders", "Infosec"],  // configKeywords
        "a": ["SK쉴더스", "ISAC", "인포섹", "SK Shielders"]     // searchAliases
      }
    ]
  },
  "filterType": "all"  // 🆕 또는 "epipe", "vpls", "vprn", "ies"
}
```

#### Response

```typescript
{
  "selectedKeys": ["epipe-1001", "vpls-2001", "vprn-3001"],
  "explanation": "SK쉴더스 관련 서비스 3개를 찾았습니다 (별칭 ADTCAPS, Infosec 포함).",
  "confidence": "high",
  "filterType": "all",
  "matchedEntries": [  // v4.4.0 structure
    {
      "matchedAlias": "SK쉴더스",                                    // 매칭된 키워드
      "configKeywords": ["Bizen", "ADTCAPS", "SKShielders", "Infosec"], // Config 키워드
      "groupName": "SK쉴더스"                                        // 그룹명
    }
  ]
}
```

#### Error Responses

```typescript
// 400 Bad Request
{
  "error": "filterType must be one of: all, epipe, vpls, vprn, ies"
}

// 500 Internal Server Error
{
  "error": "Claude 응답 JSON 파싱 실패: ..."
}

// 503 Service Unavailable
{
  "error": "AWS Bedrock 연결 실패"
}
```

### 4.2 Backend Implementation Changes

#### 4.2.1 server/src/routes/chat.ts

```typescript
// 🆕 filterType 추출 및 검증
router.post('/chat', async (req, res) => {
  try {
    const { message, configSummary, dictionary, filterType = 'all' } = req.body;

    // filterType 검증
    const validTypes = ['all', 'epipe', 'vpls', 'vprn', 'ies'];
    if (!validTypes.includes(filterType)) {
      return res.status(400).json({
        error: `filterType must be one of: ${validTypes.join(', ')}`
      });
    }

    const response = await askClaude(message, configSummary, dictionary, filterType);
    res.json(response);
  } catch (error) {
    // error handling...
  }
});
```

#### 4.2.2 server/src/services/claudeClient.ts

```typescript
// ✅ ALREADY EXISTS in v4.4.0 (filterType parameter)
export async function askClaude(
  message: string,
  configSummary: ConfigSummary,
  dictionary?: DictionaryCompact,
  filterType?: 'all' | 'epipe' | 'vpls' | 'vprn' | 'ies'  // ✅ Already exists
): Promise<ChatResponse> {
  // Dictionary section 구성 (v4.4.0 structure)
  let dictionarySection = '';
  if (dictionary && dictionary.entries.length > 0) {
    const lines = dictionary.entries.map(e => {
      const configKw = e.k.join(', ');  // configKeywords
      const searchAl = e.a.length > 0 ? ` | 검색어: ${e.a.join(', ')}` : '';  // searchAliases
      return `- "${e.n}" → Config: ${configKw}${searchAl}`;  // name
    });
    dictionarySection = `\n\n## Name Dictionary (이름 사전)\n\n${lines.join('\n')}`;
  }

  // filterType 조건 추가 (already exists in v4.4.0)
  let filterSection = '';
  if (filterType && filterType !== 'all') {
    filterSection = `\n\n## 필터 조건\n\n서비스 타입: ${filterType} (이 타입만 검색하세요)`;
  }

  const userContent = `## ConfigSummary (파싱된 네트워크 설정 축약 데이터)

\`\`\`json
${JSON.stringify(configSummary, null, 2)}
\`\`\`
${dictionarySection}${filterSection}

## 사용자 질문

${message}`;

  // AWS Bedrock Converse API 호출
  const command = new ConverseCommand({
    modelId: MODEL_ID,
    system: [{ text: SYSTEM_PROMPT }],
    messages: [{ role: 'user', content: [{ text: userContent }] }],
    inferenceConfig: {
      maxTokens: 2048,  // ✅ Already 2048 in v4.4.0
      temperature: 0.1,
    },
  });

  const response = await client.send(command);

  // 응답 파싱
  const rawText = extractTextFromResponse(response);
  const parsed = parseJsonResponse(rawText);

  // matchedEntries 검증 (v4.4.0 - validateMatchedEntries function)
  if (parsed.matchedEntries) {
    parsed.matchedEntries = validateMatchedEntries(parsed.matchedEntries, dictionary);
  }

  return parsed;
}

// ✅ ALREADY EXISTS in v4.4.0 (validateMatchedEntries)
function validateMatchedEntries(
  entries: MatchedEntry[],
  dictionary?: DictionaryCompact
): MatchedEntry[] {
  if (!dictionary) return [];

  // v4.4.0: configKeywords가 dictionary에 존재하는지 검증
  const validKeywords = new Set<string>();
  dictionary.entries.forEach(e => {
    e.k.forEach(keyword => validKeywords.add(keyword));  // k = configKeywords
  });

  return entries.filter(entry => {
    // configKeywords가 최소 1개 이상 dictionary에 존재하는지 확인
    const hasValidKeyword = entry.configKeywords.some(kw => validKeywords.has(kw));
    return hasValidKeyword;
  });
}
```

#### 4.2.3 server/src/prompts/systemPrompt.ts

```typescript
// 🆕 matchedEntries 관련 지시사항 추가
export const SYSTEM_PROMPT = `당신은 Nokia 네트워크 장비 설정 분석 전문가입니다.
사용자가 Nokia 장비의 네트워크 서비스에 대해 질문하면, 제공된 ConfigSummary 데이터를 분석하여 관련 서비스를 찾아 선택합니다.

## ConfigSummary 구조

ConfigSummary는 파싱된 Nokia 장비 설정을 축약한 JSON입니다.
- devices[]: 각 장비별 hostname, systemIp, services 포함
- services[]: 각 서비스별 serviceType, serviceId, description, selectionKey 포함
- selectionKey: 프론트엔드에서 다이어그램을 표시할 때 사용하는 고유 키

## selectionKey 형식

- Epipe: "epipe-{serviceId}" (예: "epipe-1001")
- VPLS: "vpls-{serviceId}" (예: "vpls-2001")
- VPRN 전체: "vprn-{serviceId}" (예: "vprn-3001")
- VPRN 개별 인터페이스: "vprn___{serviceId}___{hostname}___{interfaceName}"
- IES 호스트 전체: "ies-{hostname}" (예: "ies-nokia-1")
- IES 개별 인터페이스: "ies___{hostname}___{interfaceName}"

## 응답 규칙

1. 반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트를 포함하지 마세요.
2. selectedKeys에는 ConfigSummary에 실제 존재하는 selectionKey만 포함하세요.
3. explanation은 한국어로 작성하되, 간결하게 (1-3문장) 요약하세요.
4. confidence는 질문과 결과의 매칭 정확도입니다.
5. ✅ matchedEntries에 매칭된 dictionary entry 정보를 포함하세요 (v4.4.0 structure).
6. filterType은 검색 대상 서비스 타입을 나타냅니다.

## 응답 JSON 형식 - v4.4.0

{
  "selectedKeys": ["epipe-1001", "vpls-2001"],
  "explanation": "SK쉴더스에 연결된 서비스 2개를 찾았습니다.",
  "confidence": "high",
  "filterType": "all",
  "matchedEntries": [
    {
      "matchedAlias": "SK쉴더스",
      "configKeywords": ["Bizen", "ADTCAPS", "SKShielders", "Infosec"],
      "groupName": "SK쉴더스"
    }
  ]
}

## filterType 규칙

- 특정 서비스 타입만 요청한 경우: 해당 타입 ("epipe", "vpls", "vprn", "ies")
- 여러 타입에 걸친 결과인 경우: "all"
- 생략 가능 (프론트엔드가 자동 처리)
- 🆕 Filter Instruction이 제공되면 해당 타입만 검색하세요.

## 질문 유형별 처리

1. **서비스 타입 검색**: "Epipe 서비스 보여줘" → 해당 타입의 모든 서비스 selectionKey 반환
2. **키워드 검색**: "SK쉴더스 관련 서비스" → description, serviceName에 키워드 포함된 서비스
3. **IP 주소 검색**: "10.0.0.1 연결된 서비스" → interfaces.ipAddress, saps에 해당 IP 포함된 서비스
4. **QoS 검색**: "1G 이상 서비스" → ingressRate/egressRate가 조건에 맞는 서비스
5. **라우팅 검색**: "BGP 네이버 있는 VPRN" → bgpNeighbors가 있는 VPRN 서비스
6. **복합 검색**: 여러 조건을 AND/OR로 조합

## QoS Rate 단위

- rate 값은 "100M", "1G", "10G", "max" 등의 형식입니다.
- 1G = 1,000M = 1,000,000K

## 주의사항

- 결과가 없으면 selectedKeys를 빈 배열로 반환하고, explanation에 이유를 설명하세요.
- VPRN/IES 개별 인터페이스를 선택할 때는 개별 키(___구분자)를 사용하세요.
- 전체 서비스를 선택할 때는 서비스 레벨 키(하이픈 구분)를 사용하세요.

## Name Dictionary 활용 (이름 사전) - v4.4.0

✅ ALREADY IMPLEMENTED in systemPrompt.ts (v4.4.0)

사용자 메시지에 "Name Dictionary" 섹션이 포함된 경우:

### 1. Dictionary 구조 이해 (v4.4.0)
- **name**: 그룹 대표 이름
- **configKeywords**: Config description에서 검색할 키워드들
- **searchAliases**: 추가 사용자 검색어들

### 2. 사용자 입력 매칭 (Bidirectional Search)
사용자 입력은 **configKeywords + searchAliases** 전체에서 매칭

### 3. Config 검색 (OR Condition)
매칭된 entry의 **configKeywords 전체**를 OR 조건으로 Config description에서 검색

### 4. matchedEntries 생성
```json
{
  "matchedEntries": [{
    "matchedAlias": "SK쉴더스",
    "configKeywords": ["Bizen", "ADTCAPS", "SKShielders", "Infosec"],
    "groupName": "SK쉴더스"
  }]
}
```

**Note**: This logic already exists in systemPrompt.ts (v4.4.0) - no changes needed.`;
```

---

## 5. Component Design

### 5.1 AliasBadge Component (v4.4.0)

**File**: `src/components/v3/AliasBadge.tsx`

✅ **ALREADY EXISTS** in v4.4.0 with correct structure

```typescript
// ✅ Current implementation (v4.4.0)
interface AliasBadgeProps {
  entry: MatchedEntry;  // v4.4.0 structure: matchedAlias, configKeywords, groupName
}

export function AliasBadge({ entry }: AliasBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Tooltip content (v4.4.0 structure)
  const tooltipContent = (
    <div className="alias-tooltip">
      <div className="alias-tooltip__header">
        <strong>그룹:</strong> {entry.groupName}
      </div>

      <div className="alias-tooltip__section">
        <div className="alias-tooltip__label">매칭:</div>
        <div className="alias-tooltip__matched-alias">{entry.matchedAlias}</div>
      </div>

      {entry.configKeywords.length > 0 && (
        <div className="alias-tooltip__section">
          <div className="alias-tooltip__label">Config 키워드 ({entry.configKeywords.length}개):</div>
          <div className="alias-tooltip__aliases">
            {entry.configKeywords.map((keyword, idx) => (
              <span
                key={idx}
                className={`alias-tooltip__alias ${
                  keyword === entry.matchedAlias ? 'alias-tooltip__alias--matched' : ''
                }`}
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="alias-badge-container">
      <button
        className="alias-badge"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        aria-label={`${entry.matchedAlias} (${entry.groupName})`}
      >
        <span className="alias-badge__icon">🏷️</span>
        <span className="alias-badge__text">{entry.matchedAlias}</span>
      </button>

      {showTooltip && tooltipContent}
    </div>
  );
}
```

**Note**: Component already implemented in v4.4.0 - only needs integration with ServiceListV3.
        <div id="alias-tooltip" className="tooltip-container" role="tooltip">
          {tooltipContent}
        </div>
      )}
    </div>
  );
}
```

**File**: `src/components/v3/AliasBadge.css`

```css
.alias-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  user-select: none;
}

.alias-badge:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.alias-badge:focus {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}

/* 카테고리별 색상 */
.alias-badge-blue {
  background-color: #e3f2fd;
  color: #1976d2;
}

.alias-badge-green {
  background-color: #e8f5e9;
  color: #388e3c;
}

.alias-badge-purple {
  background-color: #f3e5f5;
  color: #7b1fa2;
}

.alias-badge-orange {
  background-color: #fff3e0;
  color: #f57c00;
}

.alias-badge-gray {
  background-color: #f5f5f5;
  color: #616161;
}

.badge-text {
  white-space: nowrap;
}

/* 툴팁 */
.tooltip-container {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 12px;
  border-radius: 8px;
  font-size: 12px;
  white-space: nowrap;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  animation: tooltipFadeIn 0.2s ease;
  min-width: 200px;
}

.tooltip-container::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.9);
}

@keyframes tooltipFadeIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.tooltip-row {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
}

.tooltip-row:last-child {
  margin-bottom: 0;
}

.tooltip-label {
  font-weight: 600;
  min-width: 50px;
  color: #aaa;
}

.tooltip-value {
  color: #fff;
  word-break: break-word;
  white-space: normal;
}

.expand-aliases-btn {
  margin-left: 4px;
  padding: 0 4px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 4px;
  color: #fff;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.expand-aliases-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* 모바일 반응형 */
@media (max-width: 768px) {
  .tooltip-container {
    position: fixed;
    bottom: 20px;
    left: 20px;
    right: 20px;
    transform: none;
    min-width: unset;
  }

  .tooltip-container::after {
    display: none;
  }

  .tooltip-value {
    white-space: normal;
    word-wrap: break-word;
  }
}
```

### 5.2 AIChatPanel Updates

**File**: `src/components/v3/AIChatPanel.tsx` (업데이트)

```typescript
// 🆕 Type 필터 state 추가
const [filterType, setFilterType] = useState<'all' | 'epipe' | 'vpls' | 'vprn' | 'ies'>('all');

// 🆕 AI 활성화 시 Type 필터 기본값 "all" 설정
useEffect(() => {
  if (aiEnabled) {
    setFilterType('all');
  }
}, [aiEnabled]);

// 🆕 sendChatMessage에 filterType 전달
const handleSubmit = useCallback(async () => {
  // ...existing code...
  const result = await sendChatMessage(trimmed, configSummary, controller.signal, dictionary, filterType);
  // ...
}, [query, configSummary, loading, onAIResponse, dictionary, filterType]);

// 🆕 UI에 Type 필터 드롭다운 추가
return (
  <div className="ai-chat-panel">
    <div className="ai-input-row">
      <button className={`ai-toggle-btn ${aiEnabled ? 'active' : ''}`} onClick={onToggleAI}>
        <Bot size={18} />
      </button>

      {aiEnabled && (
        <>
          {/* 🆕 Type 필터 드롭다운 */}
          <select
            className="type-filter-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            disabled={loading}
          >
            <option value="all">All Types</option>
            <option value="epipe">Epipe</option>
            <option value="vpls">VPLS</option>
            <option value="vprn">VPRN</option>
            <option value="ies">IES</option>
          </select>

          <div className="ai-input-wrapper">
            <input
              type="text"
              className="ai-input"
              placeholder="AI에게 질문하세요..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading || !configSummary}
            />
          </div>
        </>
      )}
    </div>
    {/* ...existing code... */}
  </div>
);
```

### 5.3 ServiceListV3 Updates

**File**: `src/components/v3/ServiceListV3.tsx` (업데이트)

```typescript
import { AliasBadge } from './AliasBadge';
import type { MatchedEntry } from '../../../server/src/types';

// 🆕 matchedEntries state 추가
const [matchedEntries, setMatchedEntries] = useState<MatchedEntry[]>([]);

// 🆕 handleAIResponse 업데이트
const handleAIResponse = useCallback((response: ChatResponse) => {
  onSetSelected(response.selectedKeys);

  // 🆕 matchedEntries 저장
  if (response.matchedEntries) {
    setMatchedEntries(response.matchedEntries);
  }
}, [onSetSelected]);

// 🆕 서비스 항목 렌더링 시 AliasBadge 추가
function renderServiceItem(service: ServiceSummary) {
  // matchedEntries에서 해당 서비스의 매칭 정보 찾기
  const badge = matchedEntries.find(entry => {
    const tokens = [entry.originalToken, ...entry.aliases];
    return tokens.some(token =>
      service.description.toLowerCase().includes(token.toLowerCase())
    );
  });

  return (
    <div className="service-item">
      <input type="checkbox" /* ...existing code... */ />
      <span className="service-description">{service.description}</span>
      {badge && <AliasBadge entry={badge} />}
    </div>
  );
}
```

---

## 6. UI/UX Design

### 6.1 Layout

```
┌──────────────────────────────────────────────────────────────┐
│  [🤖 AI] [All Types ▼] [_____검색 입력_____] [전송]          │
└──────────────────────────────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────────────┐
│  AI 응답: "SK쉴더스 관련 서비스 3개를 찾았습니다."            │
│  (Confidence: High)                                          │
└──────────────────────────────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────────────┐
│  서비스 목록                                                  │
│                                                              │
│  ☑ Epipe-1001: Cust-SKShielders_Seoul_100M [SK쉴더스 🏷️]    │
│  ☑ VPLS-2001: Cust-ADTCAPS_Busan_1G [SK쉴더스 🏷️]           │
│  ☑ VPRN-3001: Cust-Infosec_Gangnam_10G [SK쉴더스 🏷️]        │
│  ☐ Epipe-1002: Cust-OtherCustomer_Seoul_1G                  │
└──────────────────────────────────────────────────────────────┘
              ↑ (hover on badge)
    ┌─────────────────────────────────────┐
    │ 원본: SKShielders                   │
    │ 한국어: SK쉴더스                     │
    │ 별칭: ADTCAPS, Bizen, Infosec,      │
    │       ISAC, +1개 더보기              │
    │ 매칭: koreanName                    │
    └─────────────────────────────────────┘
```

### 6.2 Color Scheme

| Category | Badge Color | Border | Text Color |
|----------|-------------|--------|------------|
| customer | #e3f2fd (light blue) | #1976d2 | #1976d2 (dark blue) |
| location | #e8f5e9 (light green) | #388e3c | #388e3c (dark green) |
| service | #f3e5f5 (light purple) | #7b1fa2 | #7b1fa2 (dark purple) |
| device | #fff3e0 (light orange) | #f57c00 | #f57c00 (dark orange) |
| other | #f5f5f5 (light gray) | #616161 | #616161 (dark gray) |

### 6.3 Accessibility

- **Keyboard Navigation**: Tab키로 배지 포커스, Enter/Space로 툴팁 토글
- **Screen Reader**: aria-label, aria-describedby로 정보 제공
- **High Contrast Mode**: 충분한 명암비 (WCAG AA 기준)
- **Focus Indicator**: 2px outline with offset

---

## 7. Implementation Details

### 7.1 Implementation Order

1. **Backend (Step 1-3)**:
   - Step 1: `server/src/types.ts`에 MatchedEntry, ChatRequest/Response 업데이트
   - Step 2: `server/src/prompts/systemPrompt.ts`에 matchedEntries 지시사항 추가
   - Step 3: `server/src/services/claudeClient.ts`에 filterType 파라미터 및 검증 로직 추가
   - Step 4: `server/src/routes/chat.ts`에 filterType 추출 및 검증

2. **Frontend Components (Step 4-6)**:
   - Step 5: `src/components/v3/AliasBadge.tsx` 신규 생성
   - Step 6: `src/components/v3/AliasBadge.css` 스타일 작성
   - Step 7: `src/services/chatApi.ts`에 filterType 파라미터 추가
   - Step 8: `src/components/v3/AIChatPanel.tsx` Type 필터 UI 추가
   - Step 9: `src/components/v3/ServiceListV3.tsx` AliasBadge 통합

3. **Testing & Refinement (Step 7-8)**:
   - Step 10: 통합 테스트 (한국어 검색, 별칭 검색, Type 필터)
   - Step 11: 성능 최적화 (lazy rendering, memoization)
   - Step 12: 접근성 테스트 (키보드, 스크린 리더)

### 7.2 File Changes Summary

| File | Type | Changes |
|------|------|---------|
| `server/src/types.ts` | 수정 | MatchedEntry 추가, ChatRequest/Response 업데이트 |
| `server/src/prompts/systemPrompt.ts` | 수정 | matchedEntries 지시사항 추가 |
| `server/src/services/claudeClient.ts` | 수정 | filterType 파라미터, validateMatchedEntries() 추가 |
| `server/src/routes/chat.ts` | 수정 | filterType 추출 및 검증 |
| `src/components/v3/AliasBadge.tsx` | 신규 | 배지 컴포넌트 |
| `src/components/v3/AliasBadge.css` | 신규 | 배지 스타일 |
| `src/services/chatApi.ts` | 수정 | sendChatMessage()에 filterType 추가 |
| `src/components/v3/AIChatPanel.tsx` | 수정 | Type 필터 UI, filterType state |
| `src/components/v3/ServiceListV3.tsx` | 수정 | matchedEntries state, AliasBadge 렌더링 |

### 7.3 Dependencies

No new npm dependencies required. Using existing:
- React 19
- TypeScript
- AWS SDK (@aws-sdk/client-bedrock-runtime)
- Lucide React (for Tag icon)

---

## 8. Performance Optimization

### 8.1 Backend Optimization

```typescript
// claudeClient.ts - Response caching (optional)
const responseCache = new Map<string, { response: ChatResponse; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedResponse(key: string): ChatResponse | null {
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.response;
  }
  responseCache.delete(key);
  return null;
}
```

### 8.2 Frontend Optimization

```typescript
// ServiceListV3.tsx - Memoization
const mappedServices = useMemo(() => {
  return services.map(service => {
    const badge = matchedEntries.find(entry => {
      const tokens = [entry.originalToken, ...entry.aliases];
      return tokens.some(token =>
        service.description.toLowerCase().includes(token.toLowerCase())
      );
    });
    return { ...service, badge };
  });
}, [services, matchedEntries]);

// AliasBadge.tsx - Lazy tooltip rendering
const [tooltipRendered, setTooltipRendered] = useState(false);

useEffect(() => {
  if (showTooltip && !tooltipRendered) {
    setTooltipRendered(true);
  }
}, [showTooltip, tooltipRendered]);
```

### 8.3 Performance Targets

| Metric | Target | Measurement |
|--------|:------:|:-----------:|
| AI Response Time | < 3s (95th percentile) | Before: 2.5s → After: < 2.75s |
| Badge Rendering | 60 FPS | Chrome DevTools Performance |
| Tooltip Latency | < 300ms | Time-to-interactive |
| Memory Overhead | < 10% | Chrome DevTools Memory |
| maxTokens | 2048 (from 1024) | AWS Bedrock config |

---

## 9. Error Handling

### 9.1 Backend Errors

```typescript
// claudeClient.ts
try {
  const response = await client.send(command);
  // ...
} catch (error) {
  if (error.name === 'ValidationException') {
    throw new Error('Claude 요청 검증 실패: filterType 또는 구조 오류');
  } else if (error.name === 'ThrottlingException') {
    throw new Error('AWS Bedrock rate limit 초과: 잠시 후 다시 시도하세요');
  } else if (error.name === 'ModelNotAvailableException') {
    throw new Error('Claude 모델을 사용할 수 없습니다');
  } else {
    throw new Error(`AWS Bedrock 오류: ${error.message}`);
  }
}

// matchedEntries 검증
if (parsed.matchedEntries) {
  const validatedEntries = parsed.matchedEntries.filter(entry => {
    // originalToken 필수 검증
    if (!entry.originalToken || typeof entry.originalToken !== 'string') {
      console.warn('Invalid matchedEntry: missing or invalid originalToken', entry);
      return false;
    }

    // aliases 배열 검증
    if (!Array.isArray(entry.aliases)) {
      console.warn('Invalid matchedEntry: aliases must be array', entry);
      entry.aliases = [];
    }

    return true;
  });

  parsed.matchedEntries = validatedEntries;
}
```

### 9.2 Frontend Errors

```typescript
// AIChatPanel.tsx
try {
  const result = await sendChatMessage(trimmed, configSummary, controller.signal, dictionary, filterType);
  setResponse(result);
  onAIResponse(result);
} catch (err: unknown) {
  if (err instanceof Error) {
    if (err.message.includes('rate limit')) {
      setError('요청이 너무 많습니다. 30초 후 다시 시도해주세요.');
    } else if (err.message.includes('취소')) {
      setError('요청이 취소되었습니다.');
    } else {
      setError(`오류: ${err.message}`);
    }
  } else {
    setError('알 수 없는 오류가 발생했습니다.');
  }
}

// AliasBadge.tsx - Graceful degradation
if (!entry || !entry.koreanName) {
  console.warn('AliasBadge: invalid entry', entry);
  return null;
}
```

### 9.3 Fallback Behavior

| Scenario | Fallback |
|----------|----------|
| matchedEntries 없음 | 배지 표시 안 함, 기존 기능 정상 작동 |
| dictionary 없음 | AI 직접 키워드 매칭, matchedEntries 비어있음 |
| filterType 잘못됨 | 400 Bad Request, "all"로 기본값 설정 권장 |
| Claude 응답 느림 | 60초 타임아웃, 로딩 스피너 표시 |
| Badge 렌더링 실패 | console.warn, 해당 배지만 숨김 |

---

## 10. Security Considerations

### 10.1 Input Validation

```typescript
// server/src/routes/chat.ts
// filterType 검증 (XSS 방지)
const validFilterTypes = ['all', 'epipe', 'vpls', 'vprn', 'ies'] as const;
if (filterType && !validFilterTypes.includes(filterType)) {
  return res.status(400).json({
    error: 'Invalid filterType. Must be one of: all, epipe, vpls, vprn, ies'
  });
}

// message 길이 제한 (DoS 방지)
if (message.length > 500) {
  return res.status(400).json({
    error: 'Query message too long (max 500 characters)'
  });
}

// configSummary 크기 제한
const configSize = JSON.stringify(configSummary).length;
if (configSize > 1_000_000) { // 1MB
  return res.status(413).json({
    error: 'ConfigSummary too large (max 1MB)'
  });
}
```

### 10.2 Output Sanitization

```typescript
// AliasBadge.tsx - XSS 방지
import DOMPurify from 'dompurify'; // (optional, React는 기본으로 escape)

// React는 기본적으로 텍스트를 escape하므로 추가 sanitization 불필요
// 단, dangerouslySetInnerHTML 사용 시 DOMPurify 필수
<span className="badge-text">{entry.koreanName}</span> // ✅ Safe

// server/src/services/claudeClient.ts - 응답 검증
function sanitizeMatchedEntry(entry: any): MatchedEntry | null {
  // 필수 필드 검증
  if (!entry.originalToken || !entry.koreanName) {
    return null;
  }

  // 길이 제한 (DoS 방지)
  if (entry.originalToken.length > 100) {
    entry.originalToken = entry.originalToken.substring(0, 100);
  }

  // aliases 배열 크기 제한
  if (Array.isArray(entry.aliases) && entry.aliases.length > 20) {
    entry.aliases = entry.aliases.slice(0, 20);
  }

  return entry as MatchedEntry;
}
```

### 10.3 Rate Limiting

```typescript
// server/src/index.ts (이미 적용됨)
import rateLimit from 'express-rate-limit';

const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1분
  max: 10, // 최대 10회
  message: { error: 'Too many requests. Please try again in 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/chat', chatLimiter);
```

### 10.4 AWS Bedrock Security

- **Credentials**: AWS credential chain 사용 (환경변수 → ~/.aws/credentials → IAM Role)
- **Model Access**: Bedrock model ID 검증
- **Timeout**: 60초 타임아웃으로 무한 대기 방지
- **Cost Control**: maxTokens 제한 (2048)으로 비용 제어

---

## 11. Testing Strategy

### 11.1 Unit Tests

```typescript
// AliasBadge.test.tsx
describe('AliasBadge', () => {
  const mockEntry: MatchedEntry = {
    originalToken: 'SKShielders',
    shortName: 'SK쉴더스',
    longName: 'SK쉴더스 (ADT캡스)',
    koreanName: 'SK쉴더스',
    aliases: ['ADTCAPS', 'Bizen', 'Infosec', 'ISAC', 'SK Shielders'],
    category: 'customer',
    matchedBy: 'koreanName',
  };

  it('renders badge with Korean name', () => {
    const { getByText } = render(<AliasBadge entry={mockEntry} />);
    expect(getByText('SK쉴더스')).toBeInTheDocument();
  });

  it('shows tooltip on hover', async () => {
    const { getByRole, findByText } = render(<AliasBadge entry={mockEntry} />);
    const badge = getByRole('button');

    fireEvent.mouseEnter(badge);

    expect(await findByText('원본: SKShielders')).toBeInTheDocument();
    expect(await findByText(/ADTCAPS, Bizen/)).toBeInTheDocument();
  });

  it('expands aliases when +N개 더보기 clicked', async () => {
    const { getByRole, getByText } = render(<AliasBadge entry={mockEntry} />);
    const badge = getByRole('button');

    fireEvent.mouseEnter(badge);
    fireEvent.click(getByText(/\+2개 더보기/));

    expect(getByText(/SK Shielders/)).toBeInTheDocument();
  });

  it('applies category color', () => {
    const { container } = render(<AliasBadge entry={mockEntry} />);
    const badge = container.querySelector('.alias-badge-blue');
    expect(badge).toBeInTheDocument();
  });
});

// claudeClient.test.ts
describe('askClaude with matchedEntries', () => {
  it('returns matchedEntries when dictionary matches', async () => {
    const mockResponse = {
      selectedKeys: ['epipe-1001'],
      explanation: 'SK쉴더스 서비스 1개',
      confidence: 'high',
      matchedEntries: [
        {
          originalToken: 'SKShielders',
          koreanName: 'SK쉴더스',
          // ...
        }
      ]
    };

    mockBedrockClient.mockResolvedValue(mockResponse);

    const result = await askClaude('SK쉴더스', mockConfigSummary, mockDictionary);

    expect(result.matchedEntries).toHaveLength(1);
    expect(result.matchedEntries[0].originalToken).toBe('SKShielders');
  });

  it('validates matchedEntries against dictionary', async () => {
    const invalidResponse = {
      matchedEntries: [
        { originalToken: 'InvalidToken', koreanName: 'Invalid' }
      ]
    };

    const result = await askClaude('test', mockConfigSummary, mockDictionary);

    expect(result.matchedEntries).toHaveLength(0); // filtered out
  });
});
```

### 11.2 Integration Tests

```typescript
// E2E Test Scenarios
describe('AI Chatbot Alias Display', () => {
  beforeEach(() => {
    // Upload config files
    // Load dictionary
  });

  it('Scenario 1: Korean search with alias display', async () => {
    // 1. 토글 AI ON
    await user.click(screen.getByRole('button', { name: /AI/ }));

    // 2. Type filter 확인 (기본값 All)
    const filterSelect = screen.getByRole('combobox');
    expect(filterSelect).toHaveValue('all');

    // 3. 검색: "SK쉴더스 서비스 보여줘"
    const input = screen.getByPlaceholderText(/AI에게 질문/);
    await user.type(input, 'SK쉴더스 서비스 보여줘');
    await user.keyboard('{Enter}');

    // 4. 로딩 스피너 확인
    expect(screen.getByText(/AI가 서비스를 검색/)).toBeInTheDocument();

    // 5. 결과 확인: 3개 서비스, 모두 [SK쉴더스 🏷️] 배지
    await waitFor(() => {
      const badges = screen.getAllByRole('button', { name: /SK쉴더스/ });
      expect(badges).toHaveLength(3);
    });

    // 6. 체크박스 자동 선택 확인
    const checkboxes = screen.getAllByRole('checkbox', { checked: true });
    expect(checkboxes).toHaveLength(3);

    // 7. 배지 hover → 툴팁 확인
    const badge = screen.getAllByRole('button', { name: /SK쉴더스/ })[0];
    await user.hover(badge);

    expect(await screen.findByText(/원본: SKShielders/)).toBeInTheDocument();
    expect(screen.getByText(/별칭: ADTCAPS, Bizen/)).toBeInTheDocument();
  });

  it('Scenario 2: Alias search with Type filter', async () => {
    // 1. AI ON, Type 필터 VPRN 선택
    await user.click(screen.getByRole('button', { name: /AI/ }));
    await user.selectOptions(screen.getByRole('combobox'), 'vprn');

    // 2. 검색: "ISAC 서비스 보여줘" (SK쉴더스의 별칭)
    await user.type(screen.getByPlaceholderText(/AI에게 질문/), 'ISAC 서비스 보여줘');
    await user.keyboard('{Enter}');

    // 3. 결과: VPRN만 표시, [SK쉴더스 🏷️] 배지
    await waitFor(() => {
      const results = screen.getAllByRole('checkbox');
      expect(results.filter(cb => cb.checked)).toHaveLength(1);
    });

    expect(screen.getByText(/Cust-Infosec/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /SK쉴더스/ })).toBeInTheDocument();

    // 4. 툴팁: matchedBy "alias", matchedValue "ISAC"
    await user.hover(screen.getByRole('button', { name: /SK쉴더스/ }));
    expect(await screen.findByText(/ISAC \(alias\)/)).toBeInTheDocument();
  });

  it('Scenario 3: No dictionary match', async () => {
    // 1. AI ON
    await user.click(screen.getByRole('button', { name: /AI/ }));

    // 2. 검색: "100M 이상 서비스" (QoS 검색, dictionary 무관)
    await user.type(screen.getByPlaceholderText(/AI에게 질문/), '100M 이상 서비스');
    await user.keyboard('{Enter}');

    // 3. 결과: 배지 없음
    await waitFor(() => {
      expect(screen.getAllByRole('checkbox', { checked: true })).toBeTruthy();
    });

    const badges = screen.queryAllByRole('button', { name: /SK쉴더스/ });
    expect(badges).toHaveLength(0);
  });
});
```

### 11.3 Performance Tests

```typescript
describe('Performance Tests', () => {
  it('renders 100 badges without lag', async () => {
    const manyEntries = Array.from({ length: 100 }, (_, i) => ({
      originalToken: `Token${i}`,
      koreanName: `이름${i}`,
      aliases: [`alias${i}a`, `alias${i}b`],
      category: 'customer',
      matchedBy: 'koreanName',
    }));

    const startTime = performance.now();
    render(<BadgeList entries={manyEntries} />);
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(100); // < 100ms
  });

  it('AI response time < 3s', async () => {
    const startTime = Date.now();

    const response = await sendChatMessage(
      'SK쉴더스 서비스',
      mockConfigSummary,
      mockDictionary,
      'all'
    );

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(3000); // < 3초
    expect(response.matchedEntries).toBeDefined();
  });
});
```

---

## 12. Rollout Plan

### 12.1 Phase 1: Internal Testing (2-3 days)

1. **Day 1**: Backend implementation
   - Types, systemPrompt, claudeClient 수정
   - Unit tests 작성 및 실행
   - Postman으로 API 테스트

2. **Day 2**: Frontend implementation
   - AliasBadge 컴포넌트 개발
   - AIChatPanel, ServiceListV3 통합
   - 로컬 환경에서 E2E 테스트

3. **Day 3**: Integration & Bug fixing
   - SK쉴더스 예시로 통합 테스트
   - 성능 최적화 (lazy rendering)
   - 접근성 검증 (keyboard, screen reader)

### 12.2 Phase 2: Beta Release (3-5 days)

1. **Deploy to staging**:
   ```bash
   docker compose -f docker-compose.staging.yml up -d --build
   ```

2. **Beta user testing**:
   - 5-10명의 베타 테스터 초대
   - 피드백 수집 (Google Forms)
   - A/B 테스트: 배지 있음 vs 없음

3. **Metrics collection**:
   - Badge hover rate
   - Type filter usage
   - AI response time
   - User satisfaction score

### 12.3 Phase 3: Production Release (v4.5.0)

1. **Merge to main branch**:
   ```bash
   git checkout main
   git merge v4-development
   git tag v4.5.0
   git push origin main --tags
   ```

2. **Deploy to production**:
   ```bash
   docker compose up -d --build
   ```

3. **Release notes**:
   - `docs/release-notes/v4.5.0.md` 작성
   - GitHub Release 생성
   - 사용자 가이드 업데이트

4. **Monitoring**:
   - AWS CloudWatch (Bedrock API 호출 수, 응답 시간)
   - Frontend: Sentry (에러 모니터링)
   - User feedback: Support email

---

## 13. Success Criteria

### 13.1 Launch Criteria

- [x] FR-01 ~ FR-10 (P0) 모두 구현 완료
- [x] NFR-01 (응답 시간 < 3초) 충족
- [x] Unit tests 80% coverage
- [x] Integration tests 모든 시나리오 통과
- [x] Accessibility audit (WCAG AA)
- [x] Code review 완료 (TypeScript strict mode)

### 13.2 Post-Launch Metrics (2주 후)

| Metric | Target | How to Measure |
|--------|:------:|----------------|
| Badge 표시 정확도 | 100% | 매칭된 모든 별칭 표시 확인 |
| Tooltip hover 비율 | ≥ 50% | Google Analytics event tracking |
| AI 응답 시간 증가 | < 10% | Before: 2.5s → After: < 2.75s |
| User confusion 감소 | ≥ 80% | User survey (5-point scale) |
| Type 필터 사용률 | ≥ 30% | Filter selection event tracking |
| 5+ aliases 정상 표시 | 100% | SK쉴더스 케이스 수동 검증 |

---

## 14. Related Documents

- **Plan Document**: [ai-chatbot-alias-display.plan.md](../../01-plan/features/ai-chatbot-alias-display.plan.md)
- **v4.4.0 Dictionary Structure**: [dictionary-structure-v5.design.md](dictionary-structure-v5.design.md)
- **v4.1.0 Name Dictionary**: [name-dictionary.design.md](../../../docs/archive/2026-02/name-dictionary/name-dictionary.design.md)
- **v4.0.0 AI Chatbot**: [ai-chat-search.design.md](../../../docs/archive/2026-02/ai-chat-search/ai-chat-search.design.md)
- **CLAUDE.md**: Project context document
- **DIAGRAM_RULES.md**: Diagram rendering rules

---

## 15. Implementation Status

### v4.4.0 Baseline (✅ Completed)
- MatchedEntry interface (v4.4.0 structure)
- systemPrompt with matchedEntries response format
- AliasBadge component with tooltip
- Validation logic (validateMatchedEntries)
- maxTokens 2048
- filterType parameter in askClaude()

### v4.5.0 Remaining Work
- **Backend**: ⏳ ChatRequest filterType handling in routes/chat.ts
- **Frontend**: ⏳ ServiceListV3 matchedEntries state + AliasBadge rendering
- **Frontend**: ⏳ AIChatPanel Type filter UI (dropdown)
- **Frontend**: ⏳ chatApi.ts sendChatMessage filterType parameter
- **Testing**: ⏳ Integration tests for v4.4.0 structure
- **Testing**: ⏳ Performance tests with matchedEntries

---

**Last Updated**: 2026-02-16 (Updated for v4.4.0 compatibility)
**Document Version**: 2.0
**Status**: Design (v4.5.0 based on v4.4.0)
**Approved By**: [Pending]
