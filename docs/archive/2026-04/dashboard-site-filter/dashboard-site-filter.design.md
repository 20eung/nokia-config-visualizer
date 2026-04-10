# Design: dashboard-site-filter

## 기능 ID
`dashboard-site-filter` (v5.9.0)

## 작성일
2026-04-10

## Plan 참조
[dashboard-site-filter.plan.md](../../01-plan/features/dashboard-site-filter.plan.md)

---

## 개요 (Overview)

Dashboard 모드에서 사이트 카드를 클릭해 Services 뷰로 전환할 때, 해당 카드에 포함된 장비의 서비스만 왼쪽 패널에 필터링해서 표시한다. V3Page.tsx 단일 파일 수정으로 완결되며 ServiceListV3 인터페이스는 변경하지 않는다.

### 수정/신규 파일 목록

| 파일 | 유형 | 주요 변경 |
|------|------|-----------|
| `src/pages/V3Page.tsx` | 수정 | `dashboardFilterHostnames` 상태, `displayedServices` memo, 필터 배너 UI, X 아이콘 import |

---

## 1. 상태 설계 — `V3Page.tsx`

### 1.1 신규 상태

```typescript
// 기존 uploadedFiles 상태 바로 아래에 추가
const [dashboardFilterHostnames, setDashboardFilterHostnames] = useState<string[]>([]);
```

**역할**: Dashboard 카드 클릭으로 진입한 경우 선택된 장비 hostname 목록을 보관한다.
- `[]`: 필터 없음 (전체 서비스 표시)
- `['hostname1']`: 단일 장비 필터
- `['hostname1', 'hostname2']`: HA 페어 필터

### 1.2 파생 상태 — `displayedServices`

```typescript
// allServices 메모 바로 아래에 추가
const displayedServices = useMemo(() =>
  dashboardFilterHostnames.length > 0
    ? allServices.filter(s => dashboardFilterHostnames.includes((s as any)._hostname))
    : allServices,
  [allServices, dashboardFilterHostnames]
);
```

**설계 결정**: `allServices`를 변경하지 않고 파생 메모를 추가한다.
- `allServices`는 diagram 생성(`selectedServices`, `serviceGroups`)에서 계속 사용됨
- `displayedServices`는 `ServiceListV3` 표시 전용

---

## 2. 이벤트 핸들러 수정

### 2.1 `handleSiteClick` — 필터 상태 저장

```typescript
// 기존 코드에 setDashboardFilterHostnames 추가
const handleSiteClick = useCallback((hostnames: string[]) => {
  const keys: string[] = [];
  configs.forEach(c => {
    if (hostnames.includes(c.hostname)) {
      c.services.forEach(s => {
        if (s.serviceType === 'ies') {
          (s as IESService).interfaces.forEach(intf => {
            keys.push(`ies___${c.hostname}___${intf.interfaceName}`);
          });
        } else {
          keys.push(`${s.serviceType}-${s.serviceId}`);
        }
      });
    }
  });
  setSelectedServiceIds(keys);
  setDashboardFilterHostnames(hostnames);  // ← 신규 추가
  setViewMode('services');
}, [configs]);
```

### 2.2 헤더 Services 버튼 — 수동 진입 시 필터 초기화

```typescript
// 기존: onClick={() => setViewMode('services')}
// 변경:
onClick={() => { setViewMode('services'); setDashboardFilterHostnames([]); }}
```

**의도**: 헤더 탭을 직접 클릭하는 것은 "전체 서비스를 보겠다"는 의도이므로 필터를 제거한다.

---

## 3. UI — 필터 배너

### 3.1 렌더링 위치

사이드바 `<aside>` 내부, `ServiceListV3` 컴포넌트 바로 위에 조건부 렌더링.

```
┌──────────────────────────────────────┐
│ aside (ServiceListV3 사이드바)        │
│ ┌──────────────────────────────────┐ │
│ │ [배너] hostname1, hostname2   ✕  │ │  ← dashboardFilterHostnames.length > 0 시에만
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ ServiceListV3                    │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

### 3.2 배너 JSX

```tsx
{dashboardFilterHostnames.length > 0 && (
  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-700 text-xs shrink-0">
    <span className="text-blue-700 dark:text-blue-300 font-medium truncate flex-1 min-w-0">
      {dashboardFilterHostnames.join(', ')}
    </span>
    <button
      onClick={() => { setDashboardFilterHostnames([]); setSelectedServiceIds([]); }}
      className="text-blue-400 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200 shrink-0"
      title="필터 해제 (전체 서비스 표시)"
    >
      <X size={14} />
    </button>
  </div>
)}
```

**스타일 결정**:
- `bg-blue-50 dark:bg-blue-900/20`: 다크모드 호환 파란 배너
- `shrink-0`: 사이드바 높이에서 배너가 ServiceListV3를 밀어내지 않도록
- `truncate flex-1 min-w-0`: 긴 hostname이 오버플로우 시 말줄임표 처리

### 3.3 X 버튼 동작

| 항목 | 값 |
|------|-----|
| `setDashboardFilterHostnames([])` | 필터 해제 → `displayedServices` = `allServices` |
| `setSelectedServiceIds([])` | 선택된 서비스 초기화 (다이어그램 빈 화면으로) |

---

## 4. `ServiceListV3` 연결

### 4.1 props 전달 변경

```tsx
// 기존
<ServiceListV3 services={allServices} ... />

// 변경
<ServiceListV3 services={displayedServices} ... />
```

**영향 분석**:
- `services` prop만 변경, 나머지 props 동일
- `ServiceListV3` 내부 `filteredServices`, 타입별 카운터, `handleSelectAll` 모두 `services` 기반이므로 필터 자동 적용
- HA 탐지 로직은 `configs` prop (변경 없음) 기반이므로 영향 없음

---

## 5. 아이콘 import

```typescript
// V3Page.tsx 기존 import 목록에 추가
import X from 'lucide-react/dist/esm/icons/x';
```

프로젝트 규칙: 배럴 import 금지, 직접 경로 사용.

---

## 6. 데이터 흐름 다이어그램

```
Dashboard 카드 클릭
        │
        ▼
handleSiteClick(hostnames)
   ├─ setSelectedServiceIds(keys)        → 다이어그램 표시용
   ├─ setDashboardFilterHostnames(hostnames) → [NEW] 필터 상태
   └─ setViewMode('services')
        │
        ▼
displayedServices (useMemo)
   = allServices.filter(s => hostnames.includes(s._hostname))
        │
        ▼
ServiceListV3(services=displayedServices)
   → 타입 카운터: 해당 장비 서비스만 집계
   → All 버튼: 해당 장비 서비스만 전체 선택
   → 검색: 해당 장비 서비스 범위 내
        │
        ▼
사이드바 배너 (필터 활성 표시)
   "hostname1, hostname2  [X]"
   X 클릭 → dashboardFilterHostnames=[] → displayedServices=allServices
```

---

## 7. 구현된 코드 변경 요약

| 항목 | 위치 | 변경 내용 |
|------|------|-----------|
| import X | line 34 | `import X from 'lucide-react/dist/esm/icons/x'` 추가 |
| state | line 50 | `const [dashboardFilterHostnames, setDashboardFilterHostnames] = useState<string[]>([])` 추가 |
| handleSiteClick | line 229 | `setDashboardFilterHostnames(hostnames)` 추가 |
| Services 버튼 | line 543 | `onClick`에 `setDashboardFilterHostnames([])` 추가 |
| displayedServices | line 291 | `useMemo` 파생 상태 추가 |
| 필터 배너 | line 608 | `dashboardFilterHostnames.length > 0` 조건부 배너 렌더링 |
| ServiceListV3 | line 622 | `services={allServices}` → `services={displayedServices}` |
