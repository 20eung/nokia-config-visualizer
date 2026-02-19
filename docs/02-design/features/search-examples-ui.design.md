# Design: 검색창 사용 예시 UI 개선

## 기능 ID
`search-examples-ui` (v4.7.0)

## 작성일
2026-02-19

## Plan 참조
[search-examples-ui.plan.md](../../01-plan/features/search-examples-ui.plan.md)

---

## 개요 (Overview)

검색창 아래에 6개의 클릭 가능한 예시 pill을 표시하여 사용자가 검색 기능을 쉽게 발견하고 사용할 수 있도록 개선합니다.

### 핵심 원칙
1. **간단함**: 6개 고정 예시만 표시
2. **보안**: 고객사 이름 등 민감 정보 제외
3. **영문 기반**: Config 파일 내 영문 키워드 사용
4. **클릭 1회**: 예시 클릭 → 검색창 입력 (즉시 검색 없음)

---

## 아키텍처 (Architecture)

### 컴포넌트 계층 구조
```
ServiceListV3
├─ [기존] Search Input
├─ [신규] SearchExamples ← 이 컴포넌트를 추가
│   ├─ Examples Label (💡 Examples:)
│   └─ Examples Pills (6개 버튼)
└─ [기존] Service List Items
```

### 데이터 흐름
```
STATIC_EXAMPLES (상수 배열)
    ↓
SearchExamples 컴포넌트 렌더링
    ↓
사용자 pill 클릭
    ↓
handleExampleClick(query)
    ↓
setSearchQuery(query)
    ↓
검색창에 텍스트 입력됨
    ↓
사용자가 수정 가능
```

---

## 타입 정의 (Type Definitions)

### SearchExample 인터페이스
```typescript
/**
 * 검색 예시 pill 데이터 구조
 */
interface SearchExample {
  /** 화면에 표시될 텍스트 (예: "QoS 1G") */
  label: string;

  /** 검색창에 입력될 실제 쿼리 (예: "QoS 1G") */
  query: string;

  /** 예시 카테고리 (필터링/분류 용도) */
  category: 'qos' | 'ip' | 'and' | 'service' | 'port' | 'type';

  /** Tooltip에 표시될 설명 (영문, 선택적) */
  description?: string;
}
```

### SearchExamples Props (Phase 2 - 컴포넌트 분리 시)
```typescript
/**
 * SearchExamples 컴포넌트 Props (Phase 2에서 분리 시 사용)
 */
interface SearchExamplesProps {
  /** 클릭 시 호출될 핸들러 */
  onExampleClick: (query: string) => void;

  /** 표시할 예시 배열 (기본값: STATIC_EXAMPLES) */
  examples?: SearchExample[];
}
```

---

## 상수 정의 (Constants)

### STATIC_EXAMPLES 배열
```typescript
/**
 * 6개 고정 검색 예시 (Phase 1)
 *
 * 선정 기준:
 * - Config 파일 내 일반적인 영문 키워드
 * - 고객사 이름 등 민감 정보 제외
 * - 다양한 검색 패턴 소개 (QoS, IP, AND, 서비스, 포트, 타입)
 */
const STATIC_EXAMPLES: SearchExample[] = [
  {
    label: 'QoS 1G',
    query: 'QoS 1G',
    category: 'qos',
    description: 'QoS bandwidth 1G or more'
  },
  {
    label: '192.168.1.0/24',
    query: '192.168.1.0/24',
    category: 'ip',
    description: 'IP subnet search (v4.6.0)'
  },
  {
    label: 'port + description',
    query: 'port + description',
    category: 'and',
    description: 'AND search (space + space)'
  },
  {
    label: 'epipe 100',
    query: 'epipe 100',
    category: 'service',
    description: 'Service type + ID'
  },
  {
    label: '1/1/1',
    query: '1/1/1',
    category: 'port',
    description: 'Port/Interface search'
  },
  {
    label: 'vpls',
    query: 'vpls',
    category: 'type',
    description: 'Filter by service type'
  },
];
```

### 카테고리별 설명
| 카테고리 | 예시 | 검색 동작 | 사용 시나리오 |
|---------|------|----------|--------------|
| `qos` | `QoS 1G` | QoS 필드에서 "1G" 검색 | 대역폭 기반 서비스 필터링 |
| `ip` | `192.168.1.0/24` | IP 서브넷 매칭 (v4.6.0) | 특정 네트워크 세그먼트 찾기 |
| `and` | `port + description` | AND 검색 (공백+공백 구분) | 복합 조건 검색 |
| `service` | `epipe 100` | 서비스 타입 + ID 검색 | 특정 서비스 빠르게 찾기 |
| `port` | `1/1/1` | 포트/인터페이스 이름 검색 | 물리적 연결 확인 |
| `type` | `vpls` | 서비스 타입 필터링 | 특정 타입 서비스만 보기 |

---

## UI 컴포넌트 설계 (UI Component Design)

### JSX 구조
```tsx
// ServiceListV3.tsx - 검색창 바로 아래에 추가

{/* 기존 검색창 */}
{!aiEnabled && (
  <div className="service-search">
    <input
      type="text"
      placeholder="Search services..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      className="search-input"
    />
  </div>
)}

{/* 신규: 검색 예시 Pills */}
{!aiEnabled && (
  <div className="search-examples-container">
    <span className="examples-label">💡 Examples:</span>
    <div className="examples-pills">
      {STATIC_EXAMPLES.map((example, idx) => (
        <button
          key={idx}
          className="example-pill"
          title={example.description}
          onClick={() => handleExampleClick(example.query)}
          aria-label={`Search example: ${example.label}`}
        >
          {example.label}
        </button>
      ))}
    </div>
  </div>
)}
```

### 렌더링 조건
- **표시 조건**: `!aiEnabled` (AI 모드가 아닐 때만 표시)
- **미표시 조건**: AI 모드 활성화 시 (AI 예시는 Phase 3에서 별도 추가)

### 접근성 고려사항
```tsx
// 키보드 접근성
<button
  tabIndex={0}                          // Tab 키로 포커스 가능
  aria-label={`Search example: ${example.label}`} // 스크린 리더 지원
  title={example.description}           // Tooltip 표시
  onKeyDown={(e) => {                   // Enter/Space 키 지원
    if (e.key === 'Enter' || e.key === ' ') {
      handleExampleClick(example.query);
    }
  }}
/>
```

---

## 이벤트 핸들러 (Event Handlers)

### handleExampleClick
```typescript
/**
 * 예시 pill 클릭 핸들러
 *
 * 동작:
 * 1. 검색창에 예시 쿼리 입력
 * 2. 즉시 검색 실행하지 않음 (사용자가 수정할 시간 제공)
 *
 * @param query - 검색창에 입력할 쿼리 문자열
 */
const handleExampleClick = useCallback((query: string) => {
  setSearchQuery(query);

  // 선택적: 즉시 검색 실행
  // Phase 1에서는 제외, 사용자 피드백 후 Phase 2에서 추가 고려
  // triggerSearch(query);
}, []);
```

### 메모이제이션
```typescript
// useCallback으로 핸들러 메모이제이션 (리렌더링 최적화)
const handleExampleClick = useCallback((query: string) => {
  setSearchQuery(query);
}, [setSearchQuery]); // setSearchQuery는 안정적인 함수 (의존성 불필요)
```

---

## CSS 스타일 (CSS Styles)

### ServiceListV3.css에 추가

#### 1. 컨테이너 스타일
```css
/**
 * 검색 예시 Pills 컨테이너
 * 검색창 바로 아래에 위치
 */
.search-examples-container {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 0 12px;
}
```

#### 2. 라벨 스타일
```css
/**
 * "💡 Examples:" 라벨
 */
.examples-label {
  font-size: 0.85rem;
  color: #64748b;
  font-weight: 500;
  white-space: nowrap; /* 라벨 줄바꿈 방지 */
}
```

#### 3. Pills 컨테이너
```css
/**
 * Pill 버튼들을 감싸는 컨테이너
 */
.examples-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
```

#### 4. Pill 버튼 (기본 상태)
```css
/**
 * 예시 Pill 버튼 기본 스타일
 */
.example-pill {
  /* 레이아웃 */
  padding: 4px 12px;

  /* 타이포그래피 */
  font-size: 0.8rem;
  font-family: 'Courier New', monospace; /* 코드 스타일 폰트 */

  /* 색상 */
  background-color: #f1f5f9; /* Slate-100 */
  border: 1px solid #cbd5e1; /* Slate-300 */
  color: #334155; /* Slate-700 */

  /* 모양 */
  border-radius: 16px; /* Rounded pill 형태 */

  /* 인터랙션 */
  cursor: pointer;
  transition: all 0.2s ease-in-out;

  /* 텍스트 */
  white-space: nowrap; /* 버튼 내 텍스트 줄바꿈 방지 */

  /* 기타 */
  outline: none;
}
```

#### 5. Hover 상태
```css
/**
 * 마우스 오버 시 (Hover)
 */
.example-pill:hover {
  background-color: #e0f2fe; /* Sky-100 */
  border-color: #0ea5e9; /* Sky-500 */
  color: #0369a1; /* Sky-700 */
  transform: translateY(-1px); /* 살짝 위로 이동 */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); /* 그림자 추가 */
}
```

#### 6. Active 상태
```css
/**
 * 클릭 시 (Active)
 */
.example-pill:active {
  transform: translateY(0); /* 원래 위치로 */
  box-shadow: none; /* 그림자 제거 */
}
```

#### 7. Focus 상태 (키보드 접근성)
```css
/**
 * 키보드 포커스 시
 */
.example-pill:focus {
  outline: 2px solid #0ea5e9; /* Sky-500 */
  outline-offset: 2px;
}
```

#### 8. Disabled 상태 (Phase 2)
```css
/**
 * 비활성화 상태 (Phase 2에서 사용 가능)
 */
.example-pill:disabled {
  background-color: #e2e8f0; /* Slate-200 */
  border-color: #cbd5e1; /* Slate-300 */
  color: #94a3b8; /* Slate-400 */
  cursor: not-allowed;
  transform: none;
}
```

### 반응형 디자인 (Responsive)
```css
/**
 * 모바일 (화면 너비 768px 이하)
 */
@media (max-width: 768px) {
  .search-examples-container {
    flex-direction: column;
    align-items: flex-start;
  }

  .examples-label {
    margin-bottom: 4px;
  }

  .examples-pills {
    width: 100%;
  }

  .example-pill {
    font-size: 0.75rem; /* 모바일에서 약간 작게 */
  }
}

/**
 * 태블릿 (화면 너비 768px ~ 1024px)
 */
@media (min-width: 768px) and (max-width: 1024px) {
  .example-pill {
    font-size: 0.75rem;
    padding: 3px 10px;
  }
}
```

---

## 구현 세부사항 (Implementation Details)

### ServiceListV3.tsx 수정 위치

#### 1. 파일 상단: Import 섹션
```typescript
// 기존 imports...
import { useState, useMemo, useCallback, useEffect } from 'react';
import type { ParsedConfigV3, NokiaServiceV3 } from '../../utils/v3/parserV3';
// ... 기타 imports

// 변경 없음 (새로운 import 불필요)
```

#### 2. 컴포넌트 내부: 상수 정의 (라인 732 근처)
```typescript
export function ServiceListV3({
    services,
    configs,
    selectedServiceIds,
    onToggleService,
    onSetSelected,
}: ServiceListProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'epipe' | 'vpls' | 'vprn' | 'ies'>('all');
    const [aiEnabled, setAiEnabled] = useState(false);

    // 🆕 검색 예시 상수 정의 (라인 35 근처 추가)
    const STATIC_EXAMPLES: SearchExample[] = useMemo(() => [
      { label: 'QoS 1G', query: 'QoS 1G', category: 'qos', description: 'QoS bandwidth 1G or more' },
      { label: '192.168.1.0/24', query: '192.168.1.0/24', category: 'ip', description: 'IP subnet search (v4.6.0)' },
      { label: 'port + description', query: 'port + description', category: 'and', description: 'AND search (space + space)' },
      { label: 'epipe 100', query: 'epipe 100', category: 'service', description: 'Service type + ID' },
      { label: '1/1/1', query: '1/1/1', category: 'port', description: 'Port/Interface search' },
      { label: 'vpls', query: 'vpls', category: 'type', description: 'Filter by service type' },
    ], []);

    // 🆕 예시 클릭 핸들러 (라인 72 근처 추가)
    const handleExampleClick = useCallback((query: string) => {
        setSearchQuery(query);
    }, []);

    // 기존 코드...
}
```

#### 3. JSX 렌더링 섹션 (라인 730-738 수정)
```tsx
{/* 기존 검색창 */}
{!aiEnabled && (
    <div className="service-search">
        <input
            type="text"
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
        />
    </div>
)}

{/* 🆕 검색 예시 Pills (라인 738 다음에 추가) */}
{!aiEnabled && (
    <div className="search-examples-container">
        <span className="examples-label">💡 Examples:</span>
        <div className="examples-pills">
            {STATIC_EXAMPLES.map((example, idx) => (
                <button
                    key={idx}
                    className="example-pill"
                    title={example.description}
                    onClick={() => handleExampleClick(example.query)}
                    aria-label={`Search example: ${example.label}`}
                >
                    {example.label}
                </button>
            ))}
        </div>
    </div>
)}
```

### SearchExample 타입 추가 위치
```typescript
// src/components/v3/ServiceListV3.tsx 파일 상단

interface SearchExample {
  label: string;
  query: string;
  category: 'qos' | 'ip' | 'and' | 'service' | 'port' | 'type';
  description?: string;
}

// 또는 src/types/search.ts로 분리 (Phase 2)
```

---

## 성능 최적화 (Performance Optimization)

### 1. 상수 메모이제이션
```typescript
// ❌ 나쁜 예: 매 렌더링마다 배열 재생성
const STATIC_EXAMPLES = [
  { label: 'QoS 1G', query: 'QoS 1G', ... },
  // ...
];

// ✅ 좋은 예: useMemo로 메모이제이션
const STATIC_EXAMPLES = useMemo(() => [
  { label: 'QoS 1G', query: 'QoS 1G', ... },
  // ...
], []);
```

### 2. 핸들러 메모이제이션
```typescript
// ❌ 나쁜 예: 매 렌더링마다 함수 재생성
const handleExampleClick = (query: string) => {
  setSearchQuery(query);
};

// ✅ 좋은 예: useCallback으로 메모이제이션
const handleExampleClick = useCallback((query: string) => {
  setSearchQuery(query);
}, []);
```

### 3. 조건부 렌더링 최적화
```typescript
// ✅ 조기 반환으로 불필요한 렌더링 방지
if (aiEnabled) {
  return <AIChatPanel />;
}

// 검색 예시는 aiEnabled가 false일 때만 렌더링
```

---

## 테스트 시나리오 (Test Scenarios)

### 1. 기능 테스트

#### TC-01: Pill 클릭 시 검색창 입력
```
Given: 검색창이 비어있음
When: "QoS 1G" pill 클릭
Then: 검색창에 "QoS 1G" 입력됨
```

#### TC-02: 입력된 예시 수정 가능
```
Given: 검색창에 "QoS 1G" 입력됨
When: 사용자가 "QoS 500M"로 수정
Then: 검색창에 "QoS 500M" 표시됨
```

#### TC-03: 각 예시별 검색 동작 확인
```
Given: Config 파일이 업로드됨
When: 각 pill 클릭 후 검색 결과 확인

Test Cases:
- "QoS 1G" → QoS 1G 이상 서비스만 표시
- "192.168.1.0/24" → 해당 서브넷 서비스만 표시
- "port + description" → AND 검색 동작 확인
- "epipe 100" → Epipe 100 서비스 찾기
- "1/1/1" → 1/1/1 포트 사용 서비스 찾기
- "vpls" → VPLS 타입 서비스만 표시
```

### 2. UI/UX 테스트

#### TC-04: Hover 효과
```
Given: 예시 pill이 표시됨
When: 마우스를 pill 위로 이동
Then: 배경색 변경, 위로 이동 애니메이션 표시
```

#### TC-05: Tooltip 표시
```
Given: 예시 pill이 표시됨
When: 마우스를 pill 위에 1초간 유지
Then: Tooltip에 설명 표시 (예: "QoS bandwidth 1G or more")
```

#### TC-06: 키보드 접근성
```
Given: 예시 pill이 표시됨
When: Tab 키로 포커스 이동 후 Enter 키 입력
Then: 해당 예시가 검색창에 입력됨
```

### 3. 조건부 렌더링 테스트

#### TC-07: AI 모드 전환 시 예시 숨김
```
Given: 검색 예시가 표시됨
When: AI 토글 활성화
Then: 검색 예시가 숨겨지고 AI 패널 표시
```

#### TC-08: 일반 모드 복귀 시 예시 표시
```
Given: AI 모드 활성화 상태
When: AI 토글 비활성화
Then: 검색 예시가 다시 표시됨
```

### 4. 반응형 테스트

#### TC-09: 모바일 레이아웃
```
Given: 화면 너비 < 768px
When: 페이지 렌더링
Then:
  - 라벨과 pills가 세로로 배치됨
  - pill 크기가 약간 작아짐
```

#### TC-10: 태블릿 레이아웃
```
Given: 화면 너비 768px ~ 1024px
When: 페이지 렌더링
Then: pill 크기가 중간 크기로 조정됨
```

---

## 에러 처리 (Error Handling)

### 1. SearchExample 타입 검증
```typescript
// 개발 환경에서 타입 검증
if (process.env.NODE_ENV === 'development') {
  STATIC_EXAMPLES.forEach((ex, idx) => {
    if (!ex.label || !ex.query || !ex.category) {
      console.error(`Invalid SearchExample at index ${idx}:`, ex);
    }
  });
}
```

### 2. 핸들러 안전성
```typescript
const handleExampleClick = useCallback((query: string) => {
  if (!query || query.trim() === '') {
    console.warn('Empty query provided to handleExampleClick');
    return;
  }
  setSearchQuery(query);
}, []);
```

### 3. CSS 클래스 폴백
```css
/* 브라우저 호환성을 위한 폴백 */
.example-pill {
  border-radius: 16px;
  border-radius: clamp(12px, 16px, 20px); /* Modern browsers */
}
```

---

## Phase 2 확장 계획 (Phase 2 Extension)

### 동적 예시 생성
```typescript
/**
 * Phase 2: Config 파일 기반 동적 예시 생성
 *
 * 업로드된 config에서 실제 데이터 추출
 */
const generateDynamicExamples = (configs: ParsedConfigV3[]): SearchExample[] => {
  const dynamicExamples: SearchExample[] = [];

  if (configs.length === 0) return STATIC_EXAMPLES;

  // 첫 번째 Epipe 서비스 ID 추출
  const firstEpipe = configs[0].services.find(s => s.serviceType === 'epipe');
  if (firstEpipe) {
    dynamicExamples.push({
      label: `epipe ${firstEpipe.serviceId}`,
      query: `epipe ${firstEpipe.serviceId}`,
      category: 'service',
      description: `Actual Epipe service from config`
    });
  }

  // 첫 번째 포트 추출
  const firstPort = configs[0].services[0]?.saps?.[0]?.portId;
  if (firstPort) {
    dynamicExamples.push({
      label: firstPort,
      query: firstPort,
      category: 'port',
      description: `Actual port from config`
    });
  }

  // 첫 번째 IP 서브넷 추출
  const firstStaticRoute = (configs[0].services.find(s => s.serviceType === 'ies') as any)?.staticRoutes?.[0];
  if (firstStaticRoute) {
    dynamicExamples.push({
      label: firstStaticRoute.prefix,
      query: firstStaticRoute.prefix,
      category: 'ip',
      description: `Actual IP subnet from config`
    });
  }

  // 정적 예시와 동적 예시 결합 (최대 6개 유지)
  return [...dynamicExamples, ...STATIC_EXAMPLES].slice(0, 6);
};

// 사용 예시
const examples = useMemo(
  () => configs.length > 0 ? generateDynamicExamples(configs) : STATIC_EXAMPLES,
  [configs]
);
```

---

## 문서화 (Documentation)

### README.md 업데이트
```markdown
### 🔎 검색 기능

검색창 아래의 예시 pill을 클릭하여 다양한 검색 패턴을 쉽게 시도할 수 있습니다.

**검색 예시:**
- `QoS 1G`: QoS 대역폭 1G 이상 서비스
- `192.168.1.0/24`: IP 서브넷 검색 (v4.6.0)
- `port + description`: AND 검색 (공백+공백 구분)
- `epipe 100`: 서비스 타입 + ID
- `1/1/1`: 포트/인터페이스 검색
- `vpls`: 서비스 타입 필터링
```

### CHANGELOG.md 업데이트
```markdown
## [4.7.0] - 2026-02-XX

### ✨ 새로운 기능 (New Features)
- **검색 예시 UI**: 검색창 아래에 6개 클릭 가능한 예시 pill 추가
  - QoS, IP 서브넷, AND 검색, 서비스 ID, 포트, 타입 예시 제공
  - 클릭 시 자동 입력, 사용자가 수정 가능
  - Hover/Active 효과로 직관적인 UX
  - 키보드 접근성 지원 (Tab + Enter)
```

---

## 체크리스트 (Checklist)

### 구현 전
- [ ] Plan 문서 검토 완료
- [ ] 타입 정의 작성 완료
- [ ] CSS 스타일 검토 완료

### 구현 중
- [ ] SearchExample 타입 추가
- [ ] STATIC_EXAMPLES 배열 정의
- [ ] handleExampleClick 핸들러 구현
- [ ] JSX 구조 추가
- [ ] CSS 스타일 추가
- [ ] 접근성 속성 추가 (aria-label, title)

### 구현 후
- [ ] 각 예시 pill 클릭 동작 확인
- [ ] Hover/Active 효과 확인
- [ ] Tooltip 표시 확인
- [ ] 키보드 접근성 테스트 (Tab, Enter)
- [ ] AI 모드 전환 시 예시 숨김 확인
- [ ] 반응형 레이아웃 테스트 (모바일, 태블릿)
- [ ] 각 예시별 검색 결과 검증
- [ ] 문서화 (README, CHANGELOG)

---

## 의존성 (Dependencies)

### 내부 의존성
- `ServiceListV3.tsx`: 기존 검색 로직 (`searchQuery`, `setSearchQuery`)
- `ServiceListV3.css`: 기존 스타일 파일

### 외부 의존성
없음 (기존 React, TypeScript만 사용)

---

## 승인 (Approval)

- [ ] Design 검토 완료
- [ ] 구현 준비 완료
- [ ] 다음 단계: Implementation (Do Phase)

---

**Design 작성자**: Claude Sonnet 4.5
**검토자**: 사용자
**작성일**: 2026-02-19
**최종 수정일**: 2026-02-19
