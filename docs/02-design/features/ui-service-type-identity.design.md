# Design: Service Type Visual Identity 통합

## 상태 변경 없음

이 기능은 순수 UI 변경 (색상 + 아이콘)이며 state/props 변경 없음.

---

## 색상 토큰 정의

```tsx
// ServiceListV3.tsx 상단 상수로 추가
const TYPE_COLORS = {
  all:   { active: 'bg-gray-700 text-white border-gray-700',   inactive: 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700' },
  epipe: { active: 'bg-blue-600 text-white border-blue-600',   inactive: 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40' },
  vpls:  { active: 'bg-emerald-600 text-white border-emerald-600', inactive: 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40' },
  vprn:  { active: 'bg-violet-600 text-white border-violet-600',   inactive: 'border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40' },
  ies:   { active: 'bg-amber-600 text-white border-amber-600',  inactive: 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40' },
  ha:    { active: 'bg-green-600 text-white border-green-600',  inactive: 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40' },
} as const;
```

---

## 아이콘 변경

| 타입 | 현재 | 변경 | 근거 |
|------|------|------|------|
| Epipe | 🔗 | 🔗 유지 | P2P 링크 직관적 |
| VPLS  | 🌐 | 🔀 변경 | L2 multipoint 스위칭 |
| VPRN  | 📡 | 📡 유지 | 라우팅 의미 적절 |
| IES   | 🌐 | 🌍 변경 | Internet Enhanced Service |

---

## JSX 변경

### 타입 버튼 (수정)

```tsx
{(['all', 'epipe', 'vpls', 'vprn', 'ies', 'ha'] as const).map(type => (
  <button
    key={type}
    className={`px-2 py-1 border rounded text-xs cursor-pointer whitespace-nowrap transition-all duration-200 ${
      filterType === type
        ? TYPE_COLORS[type].active
        : TYPE_COLORS[type].inactive
    }`}
    onClick={() => handleTypeButtonClick(type)}
  >
    {type === 'all' ? 'All' : type === 'ha' ? '이중화' : type.toUpperCase()}
  </button>
))}
```

### 그룹 헤더 아이콘 (수정)

```tsx
// Epipe: 🔗 유지
// VPLS:  🌐 → 🔀
// VPRN:  📡 유지
// IES:   🌐 → 🌍
```

### 그룹 헤더 좌측 컬러 보더 (추가)

각 그룹 헤더 div에 `border-l-4` 추가:

```tsx
// Epipe 헤더
className="... border-l-4 border-l-blue-400 dark:border-l-blue-500"

// VPLS 헤더
className="... border-l-4 border-l-emerald-400 dark:border-l-emerald-500"

// VPRN 헤더
className="... border-l-4 border-l-violet-400 dark:border-l-violet-500"

// IES 헤더
className="... border-l-4 border-l-amber-400 dark:border-l-amber-500"
```

---

## 외부 영향 없음

- Props 변경 없음
- `V3Page.tsx`, `Dashboard.tsx` 변경 불필요
- `ServiceDiagram.tsx` 변경 불필요
