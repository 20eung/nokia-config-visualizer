# Plan: Service Filter Toggle (Type 버튼 통합 선택/해제)

## 개요

Service 화면의 'Select: 전체, 해제' 버튼을 제거하고,
Type 필터 버튼에 전체선택/해제 토글 기능을 통합합니다.

## 목표 (Goals)

- UI 단순화: 버튼 줄 2개 → 1개로 감소
- UX 개선: 타입 선택과 동시에 전체 선택 → 다이어그램 즉시 표시
- 직관성 향상: 버튼 하나로 필터 + 선택 + 해제 완결

## 요구사항 (Requirements)

### FR-01: Select 영역 제거
- 'Select:' 라벨 및 '전체', '해제' 버튼 제거
- 구분선(border-dashed) 제거

### FR-02: 'Type:' 라벨 제거
- 'Type:' 텍스트 라벨 삭제
- 버튼들만 표시

### FR-03: Type 버튼 토글 동작
- **1회 클릭 (현재와 다른 타입)**: 해당 타입으로 필터 전환 + 전체 선택 → 다이어그램 표시
- **1회 클릭 (현재와 같은 타입, 선택된 항목 있음)**: 전체 해제 → 다이어그램 사라짐
- **1회 클릭 (현재와 같은 타입, 선택된 항목 없음)**: 전체 선택 → 다이어그램 표시

### FR-04: 이중화 버튼 특수 처리
- 기존 HA 자동선택 useEffect 동작 유지 (filterType === 'ha'일 때 HA 서비스만 선택)
- 이중화 버튼 재클릭 시 해제 동작 추가

## 구현 범위 (Scope)

### 변경 파일
- `src/components/v3/ServiceListV3.tsx`

### 제거 항목
- `activeSelectAction` state
- `handleSelectNone` 함수
- Select 영역 JSX (라벨 + 전체/해제 버튼 + 구분선)
- 'Type:' 라벨

### 추가 항목
- `pendingSelectAll` ref
- `handleTypeButtonClick` 함수
- `filteredServices` 의존 useEffect (non-HA 타입 자동선택)

### 수정 항목
- `handleSelectAll`: `setActiveSelectAction('all')` 제거
- Type 버튼 onClick: `setFilterType(type)` → `handleTypeButtonClick(type)`
- HA useEffect: `setActiveSelectAction('all')` 제거

## 예상 효과

| 항목 | 이전 | 이후 |
|------|------|------|
| 버튼 줄 수 | 2줄 (Type + Select) | 1줄 (통합) |
| 클릭 수 (타입 변경 + 전체선택) | 2번 | 1번 |
| 다이어그램 표시 | 버튼 2번 클릭 후 | 타입 버튼 1번으로 즉시 |

## 일정
- Plan: 2026-03-02
- Design/Do: 2026-03-02 (즉시 구현)
