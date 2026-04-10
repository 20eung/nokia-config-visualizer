# Design: Service Filter Toggle

## 상태 변경

```
[제거] activeSelectAction: 'all' | 'ha' | 'none' | null
[추가] pendingSelectAll: useRef<boolean>(false)
```

## 함수 변경

### handleSelectAll (수정)
```tsx
const handleSelectAll = () => {
  const allKeys: string[] = [];
  filteredServices.forEach(s => {
    if (s.serviceType === 'ies') {
      const hostname = (s as any)._hostname || 'Unknown';
      (s as IESService).interfaces.forEach(intf => {
        allKeys.push(`ies___${hostname}___${intf.interfaceName}`);
      });
    } else {
      allKeys.push(`${s.serviceType}-${s.serviceId}`);
    }
  });
  // setActiveSelectAction('all') ← 제거
  onSetSelected(Array.from(new Set(allKeys)));
};
```

### handleSelectNone (제거)
기존 `handleSelectNone` 삭제. `onSetSelected([])` 인라인 사용.

### handleTypeButtonClick (신규)
```tsx
const handleTypeButtonClick = (type: typeof filterType) => {
  if (filterType === type) {
    // 같은 버튼 토글
    if (selectedServiceIds.length > 0) {
      onSetSelected([]); // 해제
    } else {
      // 아무것도 선택 안 된 상태 → 다시 전체 선택
      if (type === 'ha') {
        const keys = filteredServices.flatMap(s => { ...HA key generation... });
        onSetSelected(Array.from(new Set(keys)));
      } else {
        handleSelectAll();
      }
    }
  } else {
    // 다른 타입 클릭: HA는 useEffect가 처리, 나머지는 pendingSelectAll
    if (type !== 'ha') pendingSelectAll.current = true;
    setFilterType(type);
  }
};
```

### 새 useEffect (추가)
```tsx
// non-HA 타입 버튼 클릭 후 filteredServices 업데이트 시 자동 선택
useEffect(() => {
  if (!pendingSelectAll.current) return;
  pendingSelectAll.current = false;
  handleSelectAll();
  setExpandedGroups({ epipe: false, vpls: false, vprn: false, ies: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [filteredServices]);
```

### HA useEffect (수정)
```tsx
useEffect(() => {
  if (filterType !== 'ha') return;
  // ... HA key generation ...
  onSetSelected(Array.from(new Set(keys)));
  // setActiveSelectAction('all') ← 제거
  setExpandedGroups({ epipe: false, vpls: false, vprn: false, ies: false });
}, [filterType, filteredServices, haInterfaceKeys]);
```

## JSX 변경

### 제거
```tsx
{/* 구분선 */}
<div className="border-t border-dashed ..." />
{/* 선택 액션 */}
<div className="flex items-center gap-2">
  <label>Select:</label>
  <div>
    <button onClick={handleSelectAll}>전체</button>
    <button onClick={handleSelectNone}>해제</button>
  </div>
</div>
```

### 수정 (Type 영역)
```tsx
{/* 라벨 제거, 버튼 onClick 변경 */}
<div className="flex items-center gap-2">
  {/* <label>Type:</label>  ← 제거 */}
  <div className="flex gap-1 flex-nowrap">
    {(['all', 'epipe', 'vpls', 'vprn', 'ies', 'ha'] as const).map(type => (
      <button
        key={type}
        onClick={() => handleTypeButtonClick(type)}  // ← setFilterType → handleTypeButtonClick
        className={...}  // 스타일 동일 유지
      >
        {type === 'all' ? 'All' : type === 'ha' ? '이중화' : type.toUpperCase()}
      </button>
    ))}
  </div>
</div>
```

## 외부 컴포넌트 영향 없음

- `V3Page.tsx`, `ServiceDiagram.tsx` 변경 불필요
- Props 인터페이스 변경 없음
