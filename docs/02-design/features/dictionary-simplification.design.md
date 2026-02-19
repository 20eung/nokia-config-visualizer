---
feature: dictionary-simplification
version: v4.3.0
status: design
created: 2026-02-16
author: Claude Code
references:
  - plan: docs/01-plan/features/dictionary-simplification.plan.md
---

# Dictionary Structure Simplification - Design Document

> **Feature**: 이름 사전 구조 단순화
> **Version**: v4.3.0
> **Status**: 🎨 Design
> **Type**: Refactoring (Data Model Simplification)

---

## 1. Design Overview

### 1.1 Design Goals

이 설계는 이름 사전(Name Dictionary) 데이터 구조를 6개 필드에서 2개 필드로 단순화하여 사용성과 유지보수성을 개선합니다.

**핵심 원칙**:
1. **최소화(Minimalism)**: 필수 필드만 유지 (originalToken, aliases)
2. **통합(Consolidation)**: 모든 이름 변형을 aliases 배열에 통합
3. **호환성(Compatibility)**: 기존 AI 검색 기능은 그대로 동작
4. **안전성(Safety)**: 데이터 손실 없는 마이그레이션

### 1.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   v4.2 Dictionary                        │
│  { originalToken, shortName, longName, koreanName,     │
│    aliases[], category }                                 │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ↓ Migration Script
┌─────────────────────────────────────────────────────────┐
│              Transformation Logic                        │
│  1. Extract all name variants                           │
│     - shortName → aliases[0]                            │
│     - longName → aliases[1]                             │
│     - koreanName → aliases[2]                           │
│     - aliases → aliases[3...N]                          │
│  2. Remove duplicates (case-insensitive)                │
│  3. Filter empty strings                                │
│  4. Preserve category in comment (optional)             │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────┐
│                   v4.3 Dictionary                        │
│  { originalToken, aliases[] }                           │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Data Model Design

### 2.1 Type Definitions

#### 2.1.1 DictionaryEntry (Core)

**Before (v4.2)**:
```typescript
// server/src/types.ts
interface DictionaryEntry {
  originalToken: string;      // Required
  shortName: string;           // Required
  longName: string;            // Required
  koreanName: string;          // Required
  aliases: string[];           // Optional
  category: 'customer' | 'location' | 'service' | 'device' | 'other';
}
```

**After (v4.3)**:
```typescript
// server/src/types.ts
interface DictionaryEntry {
  originalToken: string;      // Required: 원본 토큰 (예: "SKShielders")
  aliases: string[];           // Required: 모든 별칭 (예: ["SK쉴더스", "ADTCAPS", ...])
}

// Compact form for AI transmission (no change)
interface DictionaryCompact {
  entries: Array<{
    t: string;    // originalToken
    a: string[];  // aliases
  }>;
}
```

#### 2.1.2 MatchedEntry (AI Response)

**Before (v4.2)**:
```typescript
// server/src/types.ts
interface MatchedEntry {
  originalToken: string;
  shortName: string;
  longName: string;
  koreanName: string;
  aliases: string[];
  category: string;
  matchedBy: 'originalToken' | 'koreanName' | 'shortName' | 'longName' | 'alias';
  matchedValue?: string;
}
```

**After (v4.3)**:
```typescript
// server/src/types.ts
interface MatchedEntry {
  originalToken: string;       // 매칭된 dictionary 항목의 원본 토큰
  matchedAlias: string;        // 실제로 매칭된 별칭 (예: "SK쉴더스", "ADTCAPS")
  allAliases: string[];        // 해당 항목의 모든 별칭
}
```

### 2.2 Data Transformation Rules

#### Rule 1: Field Consolidation
```typescript
// shortName, longName, koreanName을 aliases 배열에 통합
const aliases = [
  entry.shortName,
  entry.longName,
  entry.koreanName,
  ...entry.aliases
];
```

#### Rule 2: Deduplication (Case-Insensitive)
```typescript
// 대소문자 무시 중복 제거
const uniqueAliases = aliases.filter((alias, index, self) => {
  return alias && self.findIndex(a =>
    a.toLowerCase() === alias.toLowerCase()
  ) === index;
});
```

#### Rule 3: Empty String Filter
```typescript
// 빈 문자열 제거
const cleanAliases = uniqueAliases.filter(alias => alias.trim().length > 0);
```

#### Rule 4: Category Preservation (Optional)
```typescript
// category 정보는 주석으로 보존 (파일에 저장 안 됨, 개발자용)
// category: "customer" → // [Migrated from category: customer]
```

### 2.3 Example Transformations

#### Example 1: SK쉴더스 (복잡한 케이스)

**Input (v4.2)**:
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

**Output (v4.3)**:
```json
{
  "originalToken": "SKShielders",
  "aliases": [
    "SK쉴더스",
    "에스케이쉴더스 주식회사",
    "ADTCAPS",
    "Bizen",
    "Infosec",
    "ISAC",
    "SK Shielders"
  ]
}
// Note: "SK쉴더스"가 shortName과 koreanName에 중복되어 있었으나 1개로 통합
```

#### Example 2: 간단한 케이스

**Input (v4.2)**:
```json
{
  "originalToken": "Seoul",
  "shortName": "서울",
  "longName": "서울특별시",
  "koreanName": "서울",
  "aliases": ["Seoul-City"],
  "category": "location"
}
```

**Output (v4.3)**:
```json
{
  "originalToken": "Seoul",
  "aliases": [
    "서울",
    "서울특별시",
    "Seoul-City"
  ]
}
// Note: "서울"이 shortName과 koreanName에 중복되어 있었으나 1개로 통합
```

---

## 3. Component Design

### 3.1 Migration Script

#### 3.1.1 File Structure
```
scripts/
└── migrate-dictionary-v43.ts     # 마이그레이션 메인 스크립트
    ├── migrateDictionary()       # 메인 함수
    ├── transformEntry()          # 항목 변환
    ├── deduplicateAliases()      # 중복 제거
    └── backupDictionary()        # 백업 생성
```

#### 3.1.2 Algorithm

```typescript
// scripts/migrate-dictionary-v43.ts

interface OldDictionaryEntry {
  originalToken: string;
  shortName: string;
  longName: string;
  koreanName: string;
  aliases: string[];
  category: string;
}

interface NewDictionaryEntry {
  originalToken: string;
  aliases: string[];
}

/**
 * v4.2 → v4.3 마이그레이션 메인 함수
 */
async function migrateDictionary(fingerprint: string): Promise<void> {
  // 1. 기존 dictionary 로드
  const oldDict = await loadDictionary(fingerprint);
  if (!oldDict) {
    throw new Error(`Dictionary not found: ${fingerprint}`);
  }

  // 2. 백업 생성
  await backupDictionary(fingerprint, oldDict);

  // 3. 항목별 변환
  const newEntries = oldDict.entries.map(entry => transformEntry(entry));

  // 4. 새 dictionary 저장
  const newDict = {
    version: '4.3.0',
    entries: newEntries
  };
  await saveDictionary(fingerprint, newDict);

  console.log(`✅ Migrated ${newEntries.length} entries`);
}

/**
 * 개별 항목 변환
 */
function transformEntry(oldEntry: OldDictionaryEntry): NewDictionaryEntry {
  // 1. 모든 이름 변형 수집
  const allNames = [
    oldEntry.shortName,
    oldEntry.longName,
    oldEntry.koreanName,
    ...oldEntry.aliases
  ];

  // 2. 중복 제거 (대소문자 무시)
  const uniqueAliases = deduplicateAliases(allNames);

  // 3. 빈 문자열 제거
  const cleanAliases = uniqueAliases.filter(alias => alias.trim().length > 0);

  return {
    originalToken: oldEntry.originalToken,
    aliases: cleanAliases
  };
}

/**
 * 중복 제거 (대소문자 무시)
 */
function deduplicateAliases(aliases: string[]): string[] {
  return aliases.filter((alias, index, self) => {
    return alias && self.findIndex(a =>
      a.toLowerCase() === alias.toLowerCase()
    ) === index;
  });
}

/**
 * 백업 생성
 */
async function backupDictionary(
  fingerprint: string,
  dictionary: any
): Promise<void> {
  const backupPath = `${DICT_DIR}/${fingerprint}.backup.json`;
  await fs.promises.writeFile(
    backupPath,
    JSON.stringify(dictionary, null, 2)
  );
  console.log(`📦 Backup created: ${backupPath}`);
}
```

### 3.2 DictionaryEditor Component

#### 3.2.1 UI Layout

**Before (v4.2)**: 6개 입력 필드
```
┌─────────────────────────────────────┐
│ 원본 토큰: [SKShielders          ] │
│ 짧은 이름: [SK쉴더스             ] │
│ 정식 명칭: [에스케이쉴더스...    ] │
│ 한국어명:  [SK쉴더스             ] │
│ 카테고리:  [Customer ▼]            │
│ 별칭:      [ADTCAPS, Bizen, ...]  │
│ [저장] [취소]                       │
└─────────────────────────────────────┘
```

**After (v4.3)**: 2개 입력 필드
```
┌─────────────────────────────────────┐
│ 원본 토큰: [SKShielders          ] │
│ 별칭 (줄바꿈으로 구분):            │
│ ┌───────────────────────────────┐  │
│ │ SK쉴더스                       │  │
│ │ 에스케이쉴더스 주식회사        │  │
│ │ ADTCAPS                        │  │
│ │ Bizen                          │  │
│ │ Infosec                        │  │
│ │ ISAC                           │  │
│ │ SK Shielders                   │  │
│ └───────────────────────────────┘  │
│ [저장] [취소]                       │
└─────────────────────────────────────┘
```

#### 3.2.2 Component Structure

```typescript
// src/components/v3/DictionaryEditor.tsx

interface DictionaryEditorProps {
  dictionary: Dictionary;
  onSave: (dictionary: Dictionary) => void;
}

interface EditingEntry {
  originalToken: string;
  aliases: string[];  // textarea 입력을 \n으로 split
}

function DictionaryEditor({ dictionary, onSave }: DictionaryEditorProps) {
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);
  const [aliasesText, setAliasesText] = useState<string>('');

  // 저장 핸들러
  const handleSave = () => {
    const aliases = aliasesText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const newEntry: DictionaryEntry = {
      originalToken: editingEntry.originalToken,
      aliases
    };

    // 중복 제거
    newEntry.aliases = deduplicateAliases(newEntry.aliases);

    onSave(newEntry);
  };

  // aliases 배열 → textarea 텍스트
  const aliasesToText = (aliases: string[]): string => {
    return aliases.join('\n');
  };

  // textarea 텍스트 → aliases 배열
  const textToAliases = (text: string): string[] => {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  };

  return (
    <div className="dictionary-editor">
      {/* 항목 목록 테이블 */}
      <table>
        <thead>
          <tr>
            <th>원본 토큰</th>
            <th>별칭 개수</th>
            <th>별칭 (미리보기)</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {dictionary.entries.map(entry => (
            <tr key={entry.originalToken}>
              <td>{entry.originalToken}</td>
              <td>{entry.aliases.length}개</td>
              <td>{entry.aliases.slice(0, 3).join(', ')}{entry.aliases.length > 3 ? '...' : ''}</td>
              <td>
                <button onClick={() => handleEdit(entry)}>수정</button>
                <button onClick={() => handleDelete(entry)}>삭제</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 추가/수정 모달 */}
      {editingEntry && (
        <div className="edit-modal">
          <h3>{editingEntry.originalToken ? '항목 수정' : '항목 추가'}</h3>
          <label>
            원본 토큰:
            <input
              type="text"
              value={editingEntry.originalToken}
              onChange={e => setEditingEntry({ ...editingEntry, originalToken: e.target.value })}
            />
          </label>
          <label>
            별칭 (줄바꿈으로 구분):
            <textarea
              rows={10}
              value={aliasesText}
              onChange={e => setAliasesText(e.target.value)}
              placeholder="SK쉴더스&#10;에스케이쉴더스&#10;ADTCAPS&#10;Bizen"
            />
          </label>
          <div className="modal-actions">
            <button onClick={handleSave}>저장</button>
            <button onClick={() => setEditingEntry(null)}>취소</button>
          </div>
        </div>
      )}

      {/* 도구 버튼 */}
      <div className="toolbar">
        <button onClick={handleAIGenerate}>AI 자동 생성</button>
        <button onClick={handleMergeItems}>항목 병합</button>
        <button onClick={handleMigrate}>마이그레이션 (v4.2 → v4.3)</button>
      </div>
    </div>
  );
}
```

### 3.3 AliasBadge Component

#### 3.3.1 Simplified Tooltip

**Before (v4.2)**:
```
┌────────────────────────────────────┐
│ SK쉴더스 (Customer)                │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 짧은 이름: SK쉴더스                │
│ 정식 명칭: 에스케이쉴더스...       │
│ 한국어명: SK쉴더스                 │
│ 별칭 (5개): ADTCAPS, Bizen, ...   │
│ 매칭: alias → "ADTCAPS"            │
└────────────────────────────────────┘
```

**After (v4.3)**:
```
┌────────────────────────────────────┐
│ SKShielders                         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 매칭: "ADTCAPS"                    │
│ 모든 별칭 (7개):                   │
│ • SK쉴더스                         │
│ • 에스케이쉴더스 주식회사          │
│ • ADTCAPS ✓                        │
│ • Bizen                            │
│ • Infosec                          │
│ • ISAC                             │
│ • SK Shielders                     │
└────────────────────────────────────┘
```

#### 3.3.2 Component Code

```typescript
// src/components/v3/AliasBadge.tsx

interface AliasBadgeProps {
  entry: MatchedEntry;  // v4.3 simplified structure
}

function AliasBadge({ entry }: AliasBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="alias-badge-container">
      <button
        className="alias-badge"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className="alias-badge__icon">🏷️</span>
        <span className="alias-badge__text">{entry.matchedAlias}</span>
      </button>

      {showTooltip && (
        <div className="alias-tooltip">
          <div className="alias-tooltip__header">
            <strong>{entry.originalToken}</strong>
          </div>

          <div className="alias-tooltip__section">
            <div className="alias-tooltip__label">매칭:</div>
            <div className="alias-tooltip__value">"{entry.matchedAlias}"</div>
          </div>

          <div className="alias-tooltip__section">
            <div className="alias-tooltip__label">
              모든 별칭 ({entry.allAliases.length}개):
            </div>
            <div className="alias-tooltip__aliases">
              {entry.allAliases.map((alias, idx) => (
                <div
                  key={idx}
                  className={`alias-tooltip__alias ${
                    alias === entry.matchedAlias ? 'alias-tooltip__alias--matched' : ''
                  }`}
                >
                  • {alias} {alias === entry.matchedAlias && '✓'}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 4. API Design

### 4.1 Backend Changes

#### 4.1.1 systemPrompt.ts

**Before (v4.2)**:
```typescript
// server/src/prompts/systemPrompt.ts

## Name Dictionary (이름 사전)

각 항목은 다음 필드로 구성:
- originalToken: 원본 토큰
- shortName: 짧은 이름
- longName: 정식 명칭
- koreanName: 한국어 이름
- aliases: 별칭 배열
- category: 카테고리 (customer, location, service, device, other)

매칭된 항목은 matchedEntries에 포함하세요:
{
  "originalToken": "...",
  "shortName": "...",
  "longName": "...",
  "koreanName": "...",
  "aliases": [...],
  "category": "...",
  "matchedBy": "..."
}
```

**After (v4.3)**:
```typescript
// server/src/prompts/systemPrompt.ts

## Name Dictionary (이름 사전)

각 항목은 다음 필드로 구성:
- originalToken: 원본 토큰 (예: "SKShielders")
- aliases: 모든 별칭 배열 (예: ["SK쉴더스", "ADTCAPS", "Bizen", ...])

별칭 배열에는 한국어 이름, 영문 약자, 정식 명칭 등이 모두 포함됩니다.

매칭된 항목은 matchedEntries에 포함하세요:
{
  "originalToken": "SKShielders",
  "matchedAlias": "ADTCAPS",      // 실제로 매칭된 별칭
  "allAliases": ["SK쉴더스", "ADTCAPS", "Bizen", ...]  // 모든 별칭
}
```

#### 4.1.2 claudeClient.ts

**Before (v4.2)**:
```typescript
// server/src/services/claudeClient.ts

function validateMatchedEntries(
  entries: MatchedEntry[] | undefined,
  dictionary?: DictionaryCompact
): MatchedEntry[] {
  if (!entries || !dictionary) {
    return [];
  }

  const validTokens = new Set(dictionary.entries.map(e => e.t));

  return entries.filter(entry => {
    if (!validTokens.has(entry.originalToken)) {
      return false;
    }

    // 필수 필드 존재 여부 확인 (shortName은 빈 문자열 허용)
    if (!entry.longName || !entry.koreanName) {
      return false;
    }

    // category 유효성 확인
    if (!['customer', 'location', 'service', 'device', 'other'].includes(entry.category)) {
      return false;
    }

    // matchedBy 유효성 확인
    if (!['originalToken', 'koreanName', 'shortName', 'longName', 'alias'].includes(entry.matchedBy)) {
      return false;
    }

    return true;
  });
}
```

**After (v4.3)**:
```typescript
// server/src/services/claudeClient.ts

function validateMatchedEntries(
  entries: MatchedEntry[] | undefined,
  dictionary?: DictionaryCompact
): MatchedEntry[] {
  if (!entries || !dictionary) {
    return [];
  }

  const validTokens = new Set(dictionary.entries.map(e => e.t));

  return entries.filter(entry => {
    // originalToken이 dictionary에 존재하는지 확인
    if (!validTokens.has(entry.originalToken)) {
      return false;
    }

    // 필수 필드 존재 여부 확인
    if (!entry.matchedAlias || !Array.isArray(entry.allAliases)) {
      return false;
    }

    // matchedAlias가 allAliases에 포함되어 있는지 확인
    if (!entry.allAliases.includes(entry.matchedAlias)) {
      return false;
    }

    return true;
  });
}
```

#### 4.1.3 dictionaryGenerator.ts

**Before (v4.2)**:
```typescript
// server/src/services/dictionaryGenerator.ts

export async function generateDictionaryEntries(
  descriptions: string[]
): Promise<DictionaryEntry[]> {
  const prompt = `
각 description에서 다음 정보를 추출하세요:
- originalToken: 원본 토큰
- shortName: 짧은 이름
- longName: 정식 명칭
- koreanName: 한국어 이름
- aliases: 별칭 배열
- category: 카테고리
`;

  // ...
}
```

**After (v4.3)**:
```typescript
// server/src/services/dictionaryGenerator.ts

export async function generateDictionaryEntries(
  descriptions: string[]
): Promise<DictionaryEntry[]> {
  const prompt = `
각 description에서 다음 정보를 추출하세요:
- originalToken: 원본 토큰 (description에서 추출한 대표 영문명)
- aliases: 모든 별칭 배열 (한국어 이름, 영문 약자, 정식 명칭 등 모두 포함)

예시:
{
  "originalToken": "SKShielders",
  "aliases": ["SK쉴더스", "에스케이쉴더스", "ADTCAPS", "Bizen", "SK Shielders"]
}
`;

  // ...
}
```

### 4.2 Frontend Changes

#### 4.2.1 chatApi.ts

**Before (v4.2)**:
```typescript
// src/services/chatApi.ts

export interface MatchedEntry {
  originalToken: string;
  shortName: string;
  longName: string;
  koreanName: string;
  aliases: string[];
  category: string;
  matchedBy: string;
  matchedValue?: string;
}
```

**After (v4.3)**:
```typescript
// src/services/chatApi.ts

export interface MatchedEntry {
  originalToken: string;
  matchedAlias: string;
  allAliases: string[];
}
```

---

## 5. Implementation Checklist

### 5.1 Phase 1: Backend (6 Steps)

- [ ] **Step 1: 타입 정의 수정**
  - `server/src/types.ts`:
    - [ ] DictionaryEntry: 6 필드 → 2 필드 (originalToken, aliases)
    - [ ] MatchedEntry: 간소화 (matchedAlias, allAliases)
  - `src/types.ts`: 프론트엔드 타입 동기화

- [ ] **Step 2: 마이그레이션 스크립트 작성**
  - `scripts/migrate-dictionary-v43.ts`:
    - [ ] migrateDictionary() 메인 함수
    - [ ] transformEntry() 변환 로직
    - [ ] deduplicateAliases() 중복 제거
    - [ ] backupDictionary() 백업 생성
  - `package.json`: 마이그레이션 스크립트 추가

- [ ] **Step 3: systemPrompt 수정**
  - `server/src/prompts/systemPrompt.ts`:
    - [ ] Dictionary 설명 간소화 (2 필드만 설명)
    - [ ] matchedEntries 응답 예시 업데이트

- [ ] **Step 4: claudeClient 수정**
  - `server/src/services/claudeClient.ts`:
    - [ ] validateMatchedEntries() 간소화
    - [ ] category 검증 제거
    - [ ] matchedBy 검증 → matchedAlias 검증

- [ ] **Step 5: dictionaryGenerator 수정**
  - `server/src/services/dictionaryGenerator.ts`:
    - [ ] AI 생성 프롬프트: 2 필드만 요청
    - [ ] 응답 파싱: 간소화된 구조

- [ ] **Step 6: Backend 빌드 확인**
  - [ ] `cd server && npx tsc --noEmit`: 타입 에러 없음
  - [ ] 단위 테스트 실행

### 5.2 Phase 2: Frontend (4 Steps)

- [ ] **Step 7: DictionaryEditor 재설계**
  - `src/components/v3/DictionaryEditor.tsx`:
    - [ ] 입력 필드 축소: originalToken + aliases (textarea)
    - [ ] category 선택 제거
    - [ ] shortName/longName/koreanName 입력 제거
    - [ ] 마이그레이션 버튼 추가
    - [ ] aliasesToText() / textToAliases() 헬퍼 함수
  - `src/components/v3/DictionaryEditor.css`: 스타일 업데이트

- [ ] **Step 8: AliasBadge 수정**
  - `src/components/v3/AliasBadge.tsx`:
    - [ ] 툴팁 내용 간소화 (matchedAlias, allAliases)
    - [ ] category 색상 제거 → 단일 색상
  - `src/components/v3/AliasBadge.css`:
    - [ ] category별 색상 클래스 제거
    - [ ] 단일 gradient 적용

- [ ] **Step 9: 타입 동기화**
  - `src/services/chatApi.ts`:
    - [ ] MatchedEntry 타입 업데이트
  - `src/utils/dictionaryStorage.ts`:
    - [ ] DictionaryEntry 타입 업데이트 (사용하는 경우)

- [ ] **Step 10: Frontend 빌드 확인**
  - [ ] `npx tsc --project tsconfig.app.json --noEmit`: 타입 에러 없음
  - [ ] `npm run build`: 빌드 성공

### 5.3 Phase 3: Testing & Deployment (5 Steps)

- [ ] **Step 11: 마이그레이션 실행**
  - [ ] 개발 환경에서 마이그레이션 스크립트 실행
  - [ ] 백업 파일 생성 확인
  - [ ] 변환 결과 검증 (중복 제거, 데이터 손실 확인)

- [ ] **Step 12: 통합 테스트**
  - [ ] 시나리오 1: 마이그레이션 후 AI 검색 정상 동작
  - [ ] 시나리오 2: DictionaryEditor에서 새 항목 추가
  - [ ] 시나리오 3: AI 자동 생성 정상 동작 (2필드만 생성)
  - [ ] 시나리오 4: AliasBadge 툴팁 정상 표시

- [ ] **Step 13: Docker 빌드 & 배포**
  - [ ] `docker compose up -d --build`: 빌드 성공
  - [ ] http://localhost:3301 접속 확인

- [ ] **Step 14: 문서 업데이트**
  - [ ] `CLAUDE.md`: DictionaryEntry 구조 업데이트
  - [ ] `CHANGELOG.md`: v4.3.0 변경 내용 추가
  - [ ] 릴리즈 노트 작성

- [ ] **Step 15: Gap Analysis**
  - [ ] `/pdca analyze dictionary-simplification` 실행
  - [ ] Match Rate >= 90% 확인

---

## 6. Testing Strategy

### 6.1 Unit Tests

#### Test 1: Migration Script
```typescript
// scripts/migrate-dictionary-v43.test.ts

describe('migrate-dictionary-v43', () => {
  test('should consolidate name fields into aliases', () => {
    const oldEntry = {
      originalToken: 'SKShielders',
      shortName: 'SK쉴더스',
      longName: '에스케이쉴더스 주식회사',
      koreanName: 'SK쉴더스',
      aliases: ['ADTCAPS', 'Bizen'],
      category: 'customer'
    };

    const newEntry = transformEntry(oldEntry);

    expect(newEntry.aliases).toContain('SK쉴더스');
    expect(newEntry.aliases).toContain('에스케이쉴더스 주식회사');
    expect(newEntry.aliases).toContain('ADTCAPS');
    expect(newEntry.aliases).toContain('Bizen');
  });

  test('should remove duplicates case-insensitively', () => {
    const oldEntry = {
      originalToken: 'Test',
      shortName: 'test',
      longName: 'TEST',
      koreanName: 'Test',
      aliases: ['test', 'TEST'],
      category: 'other'
    };

    const newEntry = transformEntry(oldEntry);

    // 대소문자 무시 중복 제거 → 1개만 남음
    expect(newEntry.aliases.length).toBe(1);
    expect(newEntry.aliases[0].toLowerCase()).toBe('test');
  });

  test('should filter empty strings', () => {
    const oldEntry = {
      originalToken: 'Test',
      shortName: '',
      longName: 'Test Long',
      koreanName: '',
      aliases: ['Alias1', '', 'Alias2'],
      category: 'other'
    };

    const newEntry = transformEntry(oldEntry);

    expect(newEntry.aliases).not.toContain('');
    expect(newEntry.aliases).toEqual(['Test Long', 'Alias1', 'Alias2']);
  });
});
```

#### Test 2: DictionaryEditor
```typescript
// src/components/v3/DictionaryEditor.test.tsx

describe('DictionaryEditor (v4.3)', () => {
  test('should convert textarea input to aliases array', () => {
    const input = `SK쉴더스
에스케이쉴더스
ADTCAPS
Bizen`;

    const aliases = textToAliases(input);

    expect(aliases).toEqual(['SK쉴더스', '에스케이쉴더스', 'ADTCAPS', 'Bizen']);
  });

  test('should filter empty lines', () => {
    const input = `SK쉴더스


ADTCAPS

Bizen`;

    const aliases = textToAliases(input);

    expect(aliases).toEqual(['SK쉴더스', 'ADTCAPS', 'Bizen']);
  });
});
```

### 6.2 Integration Tests

#### Scenario 1: 마이그레이션 후 AI 검색
```typescript
test('AI search works after migration', async () => {
  // 1. 마이그레이션 실행
  await migrateDictionary('test-fingerprint');

  // 2. AI 검색
  const response = await sendChatMessage(
    'SK쉴더스 서비스 보여줘',
    configSummary,
    dictionary
  );

  // 3. matchedEntries 확인
  expect(response.matchedEntries).toHaveLength(1);
  expect(response.matchedEntries[0].originalToken).toBe('SKShielders');
  expect(response.matchedEntries[0].allAliases).toContain('SK쉴더스');
  expect(response.matchedEntries[0].allAliases).toContain('ADTCAPS');
});
```

#### Scenario 2: DictionaryEditor 새 항목 추가
```typescript
test('Add new entry with simplified structure', async () => {
  // 1. 새 항목 추가
  const newEntry = {
    originalToken: 'NewCompany',
    aliases: ['새 회사', 'New Corp', 'NC']
  };

  // 2. 저장
  await saveDictionaryToServer(fingerprint, {
    entries: [...dictionary.entries, newEntry]
  });

  // 3. 로드 확인
  const loaded = await loadDictionaryFromServer(fingerprint);
  const addedEntry = loaded.entries.find(e => e.originalToken === 'NewCompany');

  expect(addedEntry).toBeDefined();
  expect(addedEntry.aliases).toEqual(['새 회사', 'New Corp', 'NC']);
});
```

### 6.3 Performance Tests

```typescript
test('Migration performance for 1000 entries', async () => {
  // 1. 1000개 항목 생성
  const largeDict = {
    entries: Array.from({ length: 1000 }, (_, i) => ({
      originalToken: `Token${i}`,
      shortName: `Short${i}`,
      longName: `Long${i}`,
      koreanName: `한글${i}`,
      aliases: [`Alias${i}A`, `Alias${i}B`],
      category: 'other'
    }))
  };

  // 2. 마이그레이션 시간 측정
  const start = Date.now();
  const newDict = {
    entries: largeDict.entries.map(e => transformEntry(e))
  };
  const elapsed = Date.now() - start;

  // 3. < 1초 확인
  expect(elapsed).toBeLessThan(1000);
  expect(newDict.entries.length).toBe(1000);
});
```

---

## 7. Rollback Plan

### 7.1 Backup Strategy

마이그레이션 실행 시 자동으로 백업 파일 생성:
```
/app/data/dictionaries/
├── {fingerprint}.json          # 현재 (v4.3)
└── {fingerprint}.backup.json   # 백업 (v4.2)
```

### 7.2 Rollback Procedure

**자동 롤백** (마이그레이션 실패 시):
```typescript
try {
  await migrateDictionary(fingerprint);
} catch (error) {
  console.error('Migration failed:', error);
  // 자동 롤백
  await restoreDictionary(fingerprint);
  throw error;
}
```

**수동 롤백** (사용자 요청 시):
```bash
# 백업에서 복원
npm run restore:dictionary

# 또는
node scripts/restore-dictionary.js {fingerprint}
```

---

## 8. Success Metrics

### 8.1 Technical Metrics

| Metric | Before (v4.2) | After (v4.3) | Measurement |
|--------|:-------------:|:------------:|:-----------:|
| 타입 정의 크기 | ~150 lines | < 50 lines | types.ts 라인 수 |
| 입력 필드 수 | 6개 | 2개 | DictionaryEditor UI |
| AI 생성 시간 | ~2-3초 | < 2초 | Claude API 응답 시간 |
| 메모리 사용량 | 100% | ≤ 70% | 필드 수 감소 효과 |

### 8.2 User Metrics

| Metric | Target | Measurement |
|--------|:------:|:-----------:|
| 마이그레이션 성공률 | 100% | 데이터 손실 없이 변환 |
| 사용자 혼란 없음 | ≥ 95% | 피드백 기반 |
| DictionaryEditor 사용성 | ≥ 80% | 입력 시간 단축 |

---

## 9. Risk Mitigation

### 9.1 Risk: 마이그레이션 실패

**Mitigation**:
- 자동 백업 생성
- 트랜잭션 방식 (all-or-nothing)
- 롤백 기능 제공

### 9.2 Risk: AI 검색 기능 중단

**Mitigation**:
- 통합 테스트로 사전 검증
- 단계별 배포 (개발 → 베타 → 프로덕션)
- 롤백 준비

### 9.3 Risk: category 정보 손실

**Mitigation**:
- category는 실제 사용 빈도 낮음 (색상 표시만 사용)
- 필요 시 주석으로 보존 가능
- 추후 재추가 가능한 구조

---

## 10. Next Steps

### 10.1 After Design Approval

1. **Implementation Start**: `/pdca do dictionary-simplification`
2. **Follow Checklist**: Phase 1 → Phase 2 → Phase 3
3. **Gap Analysis**: `/pdca analyze dictionary-simplification`
4. **Completion Report**: `/pdca report dictionary-simplification`

### 10.2 Future Enhancements (v4.4+)

- AI 생성 품질 개선
- 다국어 지원 (영어, 일본어 별칭)
- 카테고리 재도입 (선택적 필드)

---

## 11. References

- **Plan Document**: `docs/01-plan/features/dictionary-simplification.plan.md`
- **v4.2 AI Chatbot Alias Display**: `docs/01-plan/features/ai-chatbot-alias-display.plan.md`
- **CLAUDE.md**: 프로젝트 컨텍스트 문서

---

**Last Updated**: 2026-02-16
**Document Version**: 1.0
**Status**: 🎨 Design
