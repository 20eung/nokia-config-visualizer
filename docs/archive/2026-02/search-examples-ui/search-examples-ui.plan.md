# Plan: 검색창 사용 예시 UI 개선

## 기능 ID
`search-examples-ui` (v4.8.1)

## 작성일
2026-02-19

## 문제 정의 (Problem Statement)

### 현재 상황
- 검색창에 단순한 "Search services..." placeholder만 표시
- 사용자가 어떤 검색어를 입력해야 하는지 알기 어려움
- 처음 사용하는 사용자는 검색 기능의 강력함을 모르고 지나침
- IP 서브넷 검색, AND/OR 검색, QoS 검색 등 다양한 활용 방법을 발견하기 어려움

### 사용자 불편 사항
1. **사용법 학습 곡선**: 어떤 키워드로 검색할 수 있는지 알 수 없음
2. **기능 발견성**: IP 서브넷 검색, AND/OR 검색, QoS 검색 등 고급 기능을 모름
3. **초기 진입 장벽**: 빈 검색창을 보고 막막함
4. **예시 부족**: 실제 사용 사례를 보지 못해 활용도가 낮음

### 목표 사용자
- **신규 사용자**: 처음 툴을 접하는 네트워크 엔지니어
- **기존 사용자**: 고급 검색 기능을 모르고 기본 검색만 사용하는 사용자
- **관리자**: 팀원에게 툴 사용법을 빠르게 교육하고 싶은 사용자

## 목표 (Goals)

### 주요 목표
1. **사용성 향상**: 검색창에 다양한 실제 사용 예시를 표시
2. **기능 발견성**: 처음 사용자도 고급 검색 기능을 자연스럽게 발견
3. **학습 곡선 감소**: 클릭 한 번으로 예시를 입력하고 수정 가능
4. **활용도 증가**: 다양한 검색 패턴을 소개하여 툴의 가치 극대화

### 성공 지표
- 신규 사용자의 고급 검색 기능 사용률 증가
- 검색 기능 활용 다양성 증가
- 사용자 피드백 개선

## 제안 솔루션 (Proposed Solution)

### 핵심 아이디어
**"Search Examples Pills"** - 검색창 아래에 클릭 가능한 예시 버튼들을 표시

### UI 구성
```
┌─────────────────────────────────────────────────────────────┐
│  🔍 Search services...                                      │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  💡 Examples:                                                │
│  [ QoS 1G ]  [ 192.168.1.0/24 ]  [ port + description ]     │
│  [ epipe 100 ]  [ 1/1/1 ]  [ vpls ]                         │
└─────────────────────────────────────────────────────────────┘
```

### 동작 방식
1. **예시 표시**: 검색창 아래에 6개의 실제 사용 가능한 예시를 pill 형태로 표시
2. **클릭 입력**: 예시 pill 클릭 시 검색창에 자동 입력
3. **수정 가능**: 입력된 예시는 사용자가 자유롭게 수정 가능
4. **검색 실행**: 예시 pill 클릭 시 즉시 검색 실행 (선택적)

### 예시 카테고리 (6개 예시)
> **보안 고려사항**: 고객사 이름 등 민감 정보는 예시에서 제외. Config 파일 내 일반적인 영문 키워드만 사용.

1. **QoS 검색**: `QoS 1G` (용량 기반 필터링)
2. **IP 서브넷**: `192.168.1.0/24` (v4.6.0 신규 기능)
3. **AND 검색**: `port + description` (복합 검색, 영문 키워드)
4. **서비스 ID**: `epipe 100` (특정 서비스 찾기)
5. **포트 검색**: `1/1/1` (인터페이스 찾기)
6. **서비스 타입**: `vpls` (서비스 타입별 필터링)

> **Phase 2**: 업로드된 config 파일을 파싱하여 실제 존재하는 서비스 ID, 포트, IP 등을 동적 예시로 표시 가능 (v4.8.1)

## 기술 상세 (Technical Details)

### 컴포넌트 구조
```typescript
// ServiceListV3.tsx 내부

interface SearchExample {
  label: string;        // 표시 텍스트: "QoS 1G"
  query: string;        // 실제 검색어: "QoS 1G"
  category: 'qos' | 'ip' | 'and' | 'service' | 'port' | 'type';
  description?: string; // 툴팁 설명 (선택적)
}

// Phase 1: 고정 예시 (v4.7.0)
const STATIC_EXAMPLES: SearchExample[] = [
  { label: 'QoS 1G', query: 'QoS 1G', category: 'qos', description: 'QoS bandwidth 1G or more' },
  { label: '192.168.1.0/24', query: '192.168.1.0/24', category: 'ip', description: 'IP subnet search (v4.6.0)' },
  { label: 'port + description', query: 'port + description', category: 'and', description: 'AND search (space + space)' },
  { label: 'epipe 100', query: 'epipe 100', category: 'service', description: 'Service type + ID' },
  { label: '1/1/1', query: '1/1/1', category: 'port', description: 'Port/Interface search' },
  { label: 'vpls', query: 'vpls', category: 'type', description: 'Filter by service type' },
];

// Phase 2: 동적 예시 생성 함수 (v4.8.1)
const generateDynamicExamples = (configs: ParsedConfigV3[]): SearchExample[] => {
  // 업로드된 config 파일에서 실제 데이터 추출
  // - 첫 번째 서비스 ID (예: "epipe 100")
  // - 첫 번째 포트 (예: "1/1/c1/1")
  // - 첫 번째 IP 서브넷 (예: "10.0.0.0/24")
  // 등을 동적으로 생성
  return [...STATIC_EXAMPLES]; // Phase 2에서 구현
};
```

### UI 컴포넌트
```tsx
// ServiceListV3.tsx에 추가

<div className="search-examples-container">
  <span className="examples-label">💡 Examples:</span>
  <div className="examples-pills">
    {STATIC_EXAMPLES.map((example, idx) => (
      <button
        key={idx}
        className="example-pill"
        title={example.description}
        onClick={() => handleExampleClick(example.query)}
      >
        {example.label}
      </button>
    ))}
  </div>
</div>
```

### CSS 스타일
```css
/* ServiceListV3.css에 추가 */

.search-examples-container {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.examples-label {
  font-size: 0.85rem;
  color: #64748b;
  font-weight: 500;
}

.examples-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.example-pill {
  padding: 4px 12px;
  font-size: 0.8rem;
  background-color: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 16px;
  color: #334155;
  cursor: pointer;
  transition: all 0.2s;
}

.example-pill:hover {
  background-color: #e0f2fe;
  border-color: #0ea5e9;
  color: #0369a1;
  transform: translateY(-1px);
}

.example-pill:active {
  transform: translateY(0);
}
```

### 핵심 로직
```typescript
const handleExampleClick = (query: string) => {
  // 1. 검색창에 예시 입력
  setSearchQuery(query);

  // 2. (선택적) 즉시 검색 실행
  // 입력 후 사용자가 수정할 시간을 주려면 주석 처리
  // 즉시 검색하려면 주석 해제
  // triggerSearch(query);
};
```

## 구현 범위 (Scope)

### Phase 1: 정적 예시 UI (v4.7.0)
- [ ] 6개 고정 예시 pill 표시
- [ ] 클릭 시 검색창에 자동 입력
- [ ] CSS 스타일링 (hover, active 효과)
- [ ] 영문 키워드 기반 예시 (보안 고려)

### Phase 2: 동적 예시 생성 (v4.8.1 - 선택적)
- [ ] 업로드된 config 파일 파싱하여 실제 데이터 추출
  - 첫 번째 서비스 ID (예: "epipe 100")
  - 첫 번째 포트 (예: "1/1/c1/1")
  - 첫 번째 IP 서브넷 (예: "10.0.0.0/24")
  - 첫 번째 QoS 값 (예: "QoS 500M")
- [ ] 정적 예시 + 동적 예시 통합 (최대 6개 유지)
- [ ] Tooltip으로 각 예시 설명 표시
- [ ] 최근 검색어 5개 자동 표시

### Phase 3: AI 검색 예시 (v4.9.0 - 별도 계획)
- [ ] AI 모드 전용 예시 추가
- [ ] 자연어 예시 (한국어/영어)

### 제외 사항
- 예시 자동 순환 (rotating placeholder) - 사용자 혼란 우려
- 고객사 이름 예시 - 보안성 문제
- 예시 개인화 (personalized examples) - 복잡도 증가

## 파일 변경 목록 (Files to Modify)

### 수정 파일
1. **src/components/v3/ServiceListV3.tsx**
   - 위치: 라인 730-738 (검색창 주변)
   - 변경: `searchExamples` 배열 추가, `handleExampleClick` 함수 추가, 예시 pill UI 추가

2. **src/components/v3/ServiceListV3.css**
   - 위치: 파일 끝
   - 변경: `.search-examples-container`, `.examples-label`, `.examples-pills`, `.example-pill` 스타일 추가

### 신규 파일
없음 (기존 파일 수정만)

## 위험 요소 (Risks)

### 기술적 위험
- **UI 공간 부족**: 예시가 많으면 화면을 많이 차지할 수 있음
  - **완화**: 6개로 제한, flex-wrap으로 반응형 처리

- **모바일 호환성**: 작은 화면에서 pill들이 어색할 수 있음
  - **완화**: CSS media query로 모바일에서는 3-4개만 표시

- **영문 예시 이해도**: 한국어 사용자가 영문 예시를 이해하기 어려울 수 있음
  - **완화**: Tooltip에 한국어 설명 추가, config 파일 내용과 동일한 키워드 사용

### UX 위험
- **예시 선택 혼란**: 어떤 예시를 선택해야 할지 모를 수 있음
  - **완화**: Tooltip으로 설명 추가, 카테고리별 색상 구분

- **클릭 후 즉시 검색 여부**: 즉시 검색 vs 입력 후 수정 시간 제공
  - **완화**: 일단 즉시 검색 없이 입력만, 사용자 피드백 후 조정

## 의존성 (Dependencies)

### 내부 의존성
- **ServiceListV3.tsx**: 기존 검색 로직 (`searchQuery`, `setSearchQuery`)
- **ServiceListV3.css**: 기존 스타일과 일관성 유지

### 외부 의존성
없음

## 테스트 계획 (Testing Plan)

### 단위 테스트
- [x] `handleExampleClick` 함수가 `setSearchQuery`를 올바르게 호출하는지 확인

### 통합 테스트
- [ ] 예시 pill 클릭 시 검색창에 정확한 텍스트가 입력되는지 확인
- [ ] 입력된 예시를 사용자가 수정할 수 있는지 확인
- [ ] 각 예시별 실제 검색 결과가 올바른지 확인
  - `QoS 1G`: QoS 1G 이상 서비스 필터링
  - `192.168.1.0/24`: IP 서브넷 매칭
  - `port + description`: AND 검색 동작
  - `epipe 100`: 특정 서비스 찾기
  - `1/1/1`: 포트 검색
  - `vpls`: VPLS 타입 필터링

### 사용자 테스트
- [ ] 신규 사용자가 예시를 보고 검색 기능을 이해할 수 있는지 확인
- [ ] 예시 pill의 hover/active 효과가 직관적인지 확인
- [ ] 예시 개수(6개)가 적절한지 피드백 수집
- [ ] 영문 예시가 한국어 사용자에게도 이해 가능한지 확인

## 마일스톤 (Milestones)

| 단계 | 작업 | 예상 시간 | 상태 |
|-----|------|----------|------|
| 1 | Design 문서 작성 | 30분 | Pending |
| 2 | `STATIC_EXAMPLES` 배열 정의 (6개 영문 예시) | 15분 | Pending |
| 3 | `handleExampleClick` 함수 구현 | 10분 | Pending |
| 4 | 예시 pill UI 추가 (TSX) | 20분 | Pending |
| 5 | CSS 스타일링 | 30분 | Pending |
| 6 | 각 예시별 검색 동작 테스트 | 30분 | Pending |
| 7 | 문서화 (README, CHANGELOG) | 15분 | Pending |

**총 예상 시간**: 약 2시간 30분

## 대안 고려 (Alternatives Considered)

### 1. Rotating Placeholder (회전 placeholder)
```typescript
// 예시가 3초마다 자동 회전
placeholder="Search services... (e.g., QoS 1G)"
→ placeholder="Search services... (e.g., 192.168.1.0/24)"
→ placeholder="Search services... (e.g., epipe 100)"
```

**장점**: UI 공간을 차지하지 않음
**단점**:
- 사용자가 원하는 예시를 놓칠 수 있음
- 클릭으로 입력 불가능
- 너무 빠르면 주의 산만, 너무 느리면 발견 못함

**결론**: ❌ 제외

### 2. Dropdown 메뉴 (예시 드롭다운)
```
[🔍 Search services... ▼]
  ├─ QoS 1G
  ├─ 192.168.1.0/24
  ├─ port + description
  └─ ...
```

**장점**: 많은 예시를 구조적으로 표시 가능
**단점**:
- 클릭 한 번 더 필요 (드롭다운 열기)
- 처음 사용자가 드롭다운 존재를 모를 수 있음
- UI 복잡도 증가

**결론**: ❌ 제외

### 3. Examples Pills (선택된 방안)
```
💡 Examples:
[ QoS 1G ]  [ 192.168.1.0/24 ]  [ port + description ]
```

**장점**:
- ✅ 한눈에 모든 예시 확인 가능
- ✅ 클릭 한 번으로 입력
- ✅ 직관적이고 간단한 UI
- ✅ 수정 가능

**단점**:
- UI 공간 차지 (하지만 flex-wrap으로 완화)

**결론**: ✅ **채택**

## 참고 자료 (References)

### UI 참고
- **GitHub Search**: 검색창 아래 예시 칩 표시
- **Google Search**: "People also search for" 관련 검색어 pill
- **Slack**: 검색창 아래 최근 검색어 pill

### 기술 문서
- React useState hook
- CSS Flexbox (flex-wrap)
- CSS transitions

## 추가 고려 사항 (Additional Considerations)

### 접근성 (Accessibility)
- 예시 pill에 `title` 속성으로 tooltip 제공
- 키보드 탐색 지원 (Tab + Enter)
- Screen reader 지원 (`aria-label`)

### 국제화 (i18n)
- Config 파일 기반 영문 키워드 사용으로 국제화 불필요
- Tooltip 설명만 영문으로 제공 (Phase 1)

### 성능
- 예시 배열은 상수로 정의 (리렌더링 시 재생성 방지)
- 클릭 핸들러는 `useCallback`으로 메모이제이션

## 승인 (Approval)

- [ ] 요구사항 검토 완료
- [ ] 기술적 실현 가능성 확인
- [ ] 리소스 확보 (개발 시간)
- [ ] 다음 단계: Design 문서 작성

---

**Plan 작성자**: Claude Sonnet 4.5
**검토자**: 사용자
**작성일**: 2026-02-19
**최종 수정일**: 2026-02-19

## 병렬 개발 전략 (Parallel Development Strategy)

### 병렬 개발 현황

현재 **두 개의 기능**이 동시에 개발되고 있습니다:

| Feature | 브랜치 | Phase | 영향 파일 |
|---------|--------|-------|----------|
| **search-examples-ui** (검색창 고도화) | v4-development | Design | `ServiceListV3.tsx`, `ServiceListV3.css` |
| **auto-config-loading** (자동 로딩) | v4-development | Plan | `V3Page.tsx`, Backend 파일들, 신규 컴포넌트들 |

### 파일 충돌 분석

#### 충돌 위험 파일

**높은 충돌 위험** (두 기능이 동시 수정):
- ❌ 없음 (파일 수정 범위가 겹치지 않음)

**낮은 충돌 위험** (같은 파일이지만 다른 섹션 수정):
- ⚠️ **src/pages/V3Page.tsx**:
  - search-examples-ui: 수정 안 함
  - auto-config-loading: WebSocket 통합, config 파일 목록 관리 (라인 50-100 예상)
  - 충돌 가능성: **10%** (같은 파일이지만 다른 영역)

#### 독립적인 파일

**충돌 없음**:
- ✅ **ServiceListV3.tsx** (search-examples-ui 전용)
- ✅ **ServiceListV3.css** (search-examples-ui 전용)
- ✅ Backend 파일들 (auto-config-loading 전용)
- ✅ 신규 컴포넌트들 (auto-config-loading 전용)

### Git 브랜치 전략

#### 권장 전략: Feature 브랜치 사용

```bash
# 현재 상황
v4-development (main branch)
  ├── feature/search-examples-ui (현재 창)
  └── feature/auto-config-loading (다른 창)
```

**작업 순서**:

1. **search-examples-ui** 브랜치 생성 (현재 창):
   ```bash
   git checkout -b feature/search-examples-ui v4-development
   # 작업 진행...
   ```

2. **auto-config-loading** 브랜치 생성 (다른 창):
   ```bash
   git checkout -b feature/auto-config-loading v4-development
   # 작업 진행...
   ```

3. **먼저 완료된 기능 merge**:
   ```bash
   # search-examples-ui가 먼저 완료되었다고 가정
   git checkout v4-development
   git merge feature/search-examples-ui
   git push origin v4-development
   ```

4. **나중에 완료된 기능 rebase 후 merge**:
   ```bash
   # auto-config-loading이 나중에 완료
   git checkout feature/auto-config-loading
   git rebase v4-development  # 최신 변경사항 적용
   # 충돌 발생 시 해결
   git checkout v4-development
   git merge feature/auto-config-loading
   git push origin v4-development
   ```

#### 대안: 순차 개발 (가장 안전)

하나의 기능을 완료한 후 다른 기능 시작:

```bash
# Option 1: search-examples-ui 먼저 완료 (추천)
1. search-examples-ui 개발 완료 → merge → push
2. auto-config-loading 개발 시작

# Option 2: auto-config-loading 먼저 완료
1. auto-config-loading 개발 완료 → merge → push
2. search-examples-ui 개발 재개
```

**추천**: Option 1 (search-examples-ui가 더 간단하고 빠름)

### 충돌 예방 가이드라인

#### 코드 작성 시 주의사항

**ServiceListV3.tsx 수정 시**:

```typescript
// ✅ 좋은 예: 섹션 분리
// === Search Examples UI (search-examples-ui) ===
const STATIC_EXAMPLES: SearchExample[] = [...];

const handleExampleClick = useCallback((query: string) => {
  setSearchQuery(query);
}, []);

// JSX 렌더링
<div className="search-examples-container">
  ...
</div>
```

**Import 문 정리**:
```typescript
// ✅ 좋은 예: 알파벳 순 정렬
import { useState, useCallback, useMemo } from 'react';
import { NokiaService } from '@/types/v2';
```

#### 충돌 발생 시 해결 방법

**Step 1: 충돌 확인**
```bash
git rebase v4-development
# 충돌 발생 시:
# CONFLICT (content): Merge conflict in src/components/v3/ServiceListV3.tsx
```

**Step 2: 충돌 파일 열기**
```typescript
// src/components/v3/ServiceListV3.tsx
<<<<<<< HEAD
// search-examples-ui 변경사항
const [searchExamples, setSearchExamples] = useState([]);
=======
// 다른 기능 변경사항
const [otherFeature, setOtherFeature] = useState([]);
>>>>>>> feature/other-feature
```

**Step 3: 수동 병합**
```typescript
// 두 변경사항 모두 유지
const [searchExamples, setSearchExamples] = useState([]);
const [otherFeature, setOtherFeature] = useState([]);
```

**Step 4: 충돌 해결 완료**
```bash
git add src/components/v3/ServiceListV3.tsx
git rebase --continue
```

### 통합 테스트 계획

**두 기능이 모두 merge된 후**:

1. **기능별 독립 테스트**:
   - search-examples-ui: 예시 pill 클릭 → 검색 동작 확인
   - auto-config-loading: 파일 변경 → 자동 파싱 확인

2. **통합 테스트**:
   - 자동 로딩된 config 파일에서 검색 예시 사용
   - 여러 config 파일 전환 후 검색 예시 동작 확인

3. **회귀 테스트**:
   - 기존 업로드 방식 + 검색 기능 정상 동작 확인

### 커밋 메시지 규칙

**Feature 명시**:
```bash
# search-examples-ui
git commit -m "feat(search): Add search examples pills UI"
git commit -m "style(search): Add CSS for example pills"
git commit -m "test(search): Verify example pills functionality"

# auto-config-loading
git commit -m "feat(auto-loading): Add file watcher service"
```

**Merge 커밋**:
```bash
git merge feature/search-examples-ui -m "Merge feature/search-examples-ui into v4-development

- Add search examples pills UI
- Update ServiceListV3 component with 6 static examples
- Add CSS styles for pills with hover/active effects
"
```

### 결론

**충돌 위험 평가**: **🟢 낮음 (10%)**

**이유**:
1. ✅ 파일 수정 범위가 거의 겹치지 않음
2. ✅ search-examples-ui는 ServiceListV3만 수정 (프론트엔드 전용)
3. ✅ auto-config-loading은 Backend + 신규 컴포넌트 위주
4. ⚠️ V3Page.tsx는 auto-config-loading만 수정 (search-examples-ui는 미수정)

**권장 사항**:
1. ✅ Feature 브랜치 사용 (독립 개발)
2. ✅ search-examples-ui 먼저 완료 후 merge (더 간단함)
3. ✅ auto-config-loading은 rebase 후 merge
4. ✅ ServiceListV3.tsx 수정 시 주석으로 섹션 구분
5. ✅ 통합 테스트 필수

---

## 변경 이력 (Change Log)

### v3 (2026-02-19 16:00)
- 병렬 개발 전략 섹션 추가
- auto-config-loading 기능과의 충돌 분석 및 예방 전략
- Git 브랜치 전략 및 통합 테스트 계획

### v2 (2026-02-19 15:30)
- 사용자 피드백 반영: AI 검색 예시 제외 (Phase 3로 이연)
- 보안 고려: 고객사 이름 예시 제거
- Config 파일 기반: 영문 키워드 예시로 변경 (7개 → 6개)
- Phase 2 추가: 업로드된 config 기반 동적 예시 생성 기능

### v1 (2026-02-19 14:00)
- 초기 Plan 작성
- 7개 예시 (고객명, QoS, IP, AND, 서비스ID, 포트, AI)
