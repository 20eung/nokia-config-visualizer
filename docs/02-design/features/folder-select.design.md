---
feature: folder-select
version: v5.3.0
status: design
created: 2026-03-09
author: Claude Code
---

# Folder Select - Design Document

> **Feature**: 폴더 선택 기능 — IP Manager 방식의 OS 폴더 브라우저 + localStorage 유지
> **Version**: v5.3.0
> **Status**: Design
> **Type**: UX Enhancement (File Loading Stability)

## Plan 참조
[folder-select.plan.md](../../01-plan/features/folder-select.plan.md)

---

## 1. 개요 (Overview)

현재 `FolderPathSettings.tsx`는 안내 문서만 표시하는 비기능 컴포넌트이며, WebSocket 기반 파일 목록은 연결 불안정 시 동작하지 않는다. 이 기능은 IP Manager와 동일하게 `<input webkitdirectory>`로 브라우저에서 직접 폴더를 선택하고, 선택 정보를 localStorage에 저장하여 재접속 시 유지한다.

### 핵심 원칙
1. **브라우저 직접 파싱**: 파일을 서버에 업로드하지 않고 브라우저에서 `FileReader`로 읽어 기존 `parserV3.ts`로 처리
2. **WebSocket 병행**: 서버 파일 감시(WebSocket)를 제거하지 않고, 폴더 선택과 병행 가능
3. **선택 정보 유지**: 폴더명을 localStorage에 저장, 재접속 시 표시
4. **최소 변경**: 3개 파일만 수정, 기존 파싱 흐름(`handleConfigLoaded`) 재사용

---

## 2. 아키텍처 (Architecture)

### 2.1 데이터 흐름 (변경 후)

```
사용자 "폴더 선택" 클릭
  │
  ▼
<input webkitdirectory> (OS 파일 브라우저)
  │ File[] (브라우저 메모리)
  ▼
FolderPathSettings.tsx
  ├─ .txt 파일 필터링
  ├─ FileReader로 텍스트 읽기 (Promise.all)
  ├─ localStorage 저장 { name, fileCount, lastSelected }
  └─ onFolderLoaded(contents: string[]) 콜백 호출
         │
         ▼
V3Page.tsx: handleConfigLoaded(contents)
  │
  ▼
parserV3.ts: parseL2VPNConfig(content) × N
  │
  ▼
setConfigs(parsedConfigs) → UI 업데이트
```

### 2.2 컴포넌트 관계 (변경 후)

```
V3Page
  ├── ConfigFileList (showConfigFileList)
  │     ├── 헤더: 저장된 폴더 정보 표시 (from localStorage)
  │     ├── 파일 목록 (WebSocket 기반, 기존)
  │     └── 하단 버튼
  │           ├── [폴더 선택] → setShowFolderSettings(true)
  │           └── [Upload] → FileUpload (기존)
  │
  └── FolderPathSettings Modal (showFolderSettings)
        ├── 미선택 상태: 폴더 선택 버튼 + 안내
        └── 선택 후 상태: 폴더명, 파일 수, 날짜 + 재선택 버튼
              └── onFolderLoaded(contents) → handleConfigLoaded
```

---

## 3. 상세 설계

### 3.1 localStorage 스키마

```ts
const LS_KEY = 'ncv_folder';

interface SavedFolder {
  name: string;        // 폴더명 (webkitRelativePath 최상위 디렉토리)
  fileCount: number;   // 선택 시점 .txt 파일 수
  lastSelected: string; // ISO 8601 (예: "2026-03-09T10:30:00.000Z")
}
```

저장 시점: 파일 읽기 성공 후 `handleConfigLoaded` 호출 직전
읽기 시점: `FolderPathSettings` 마운트 시, `ConfigFileList` 마운트 시

### 3.2 FolderPathSettings.tsx — 전체 재작성

**Props 인터페이스:**
```ts
interface FolderPathSettingsProps {
  onFolderLoaded: (contents: string[]) => void;
}
```

**내부 상태:**
```ts
const [savedFolder, setSavedFolder] = useState<SavedFolder | null>(null);
const [isLoading, setIsLoading]     = useState(false);
const [error, setError]             = useState<string | null>(null);
const inputRef                      = useRef<HTMLInputElement>(null);
```

**마운트 시 동작:** localStorage에서 `ncv_folder` 읽어 `savedFolder` 초기화

**폴더 선택 핸들러:**
```ts
const handleFolderChange = async (e: ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files ?? [])
    .filter(f => f.name.toLowerCase().endsWith('.txt'))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (files.length === 0) {
    setError('선택한 폴더에 .txt 파일이 없습니다.');
    return;
  }

  const folderName = files[0].webkitRelativePath.split('/')[0];
  setIsLoading(true);
  setError(null);

  try {
    const contents = await Promise.all(files.map(f => f.text()));
    const saved: SavedFolder = {
      name: folderName,
      fileCount: files.length,
      lastSelected: new Date().toISOString(),
    };
    localStorage.setItem(LS_KEY, JSON.stringify(saved));
    setSavedFolder(saved);
    onFolderLoaded(contents);
  } catch {
    setError('파일 읽기 중 오류가 발생했습니다.');
  } finally {
    setIsLoading(false);
  }
};
```

**UI 상태별 렌더링:**

| 상태 | 표시 내용 |
|------|-----------|
| 미선택 (savedFolder = null) | 폴더 선택 버튼 + "폴더 내 .txt 파일이 자동 로딩됩니다" 안내 |
| 선택 완료 | 폴더명(아이콘), 파일 수, 마지막 선택 날짜, "재선택" 버튼 |
| 로딩 중 | 스피너 + "파일 읽는 중..." 텍스트 |
| 에러 | 빨간 에러 메시지 |

### 3.3 ConfigFileList.tsx — 최소 변경

**변경 사항:**
1. 헤더 아래에 저장된 폴더 배지 추가 (localStorage 직접 읽기)
2. 하단 "자동 로딩" 버튼 레이블 → "폴더 선택"으로 변경

**폴더 배지 UI (헤더 하단):**
```
[ configs  ·  23개 파일  ·  2026-03-09 ]   (저장된 폴더 있을 때만 표시)
```

**Props 변경 없음** — `onShowSettings` prop 그대로 사용 (버튼 클릭 시 FolderPathSettings 모달 열기)

### 3.4 V3Page.tsx — prop 연결

**변경 사항:**
```tsx
// Before
<FolderPathSettings />

// After
<FolderPathSettings onFolderLoaded={handleConfigLoaded} />
```

변경 범위: 1줄

---

## 4. UI 와이어프레임

### 4.1 FolderPathSettings 모달 — 미선택 상태
```
┌─────────────────────────────────────────┐
│  폴더 선택                           X  │
├─────────────────────────────────────────┤
│                                         │
│  [📁 폴더 선택]  ← 버튼 (대형)         │
│                                         │
│  선택한 폴더의 .txt 파일이 모두         │
│  자동으로 로딩됩니다.                   │
│                                         │
└─────────────────────────────────────────┘
```

### 4.2 FolderPathSettings 모달 — 선택 완료 상태
```
┌─────────────────────────────────────────┐
│  폴더 선택                           X  │
├─────────────────────────────────────────┤
│                                         │
│  📁 configs                             │
│  23개 파일 · 2026-03-09 10:30           │
│                                         │
│  [📁 폴더 재선택]                       │
│                                         │
└─────────────────────────────────────────┘
```

### 4.3 ConfigFileList 헤더 — 폴더 배지
```
┌─────────────────────────────────────┐
│  Config 파일 목록         ●연결됨   │
├─────────────────────────────────────┤
│  📁 configs  ·  23개  ·  03-09      │  ← 저장 폴더 배지
├─────────────────────────────────────┤
│  총 12개 (최신만 표시)              │
│  ...                                │
├─────────────────────────────────────┤
│  [📁 폴더 선택]   [Upload]          │  ← 버튼 레이블 변경
└─────────────────────────────────────┘
```

---

## 5. 변경 파일 요약

| 파일 | 변경 규모 | 내용 |
|------|-----------|------|
| `src/components/v3/FolderPathSettings.tsx` | 전체 재작성 | 안내 페이지 → 기능성 폴더 선택 컴포넌트 |
| `src/components/v3/ConfigFileList.tsx` | 소폭 수정 (~10줄) | 폴더 배지 추가, 버튼 레이블 변경 |
| `src/pages/V3Page.tsx` | 1줄 수정 | `onFolderLoaded` prop 추가 |

**신규 파일 없음** — 기존 파일 수정만으로 구현

---

## 6. 완료 기준

- [x] "폴더 선택" 클릭 시 OS 파일 브라우저 열림 (webkitdirectory)
- [x] .txt 파일 자동 필터링 및 파싱, Config 목록 표시
- [x] 폴더명이 localStorage에 저장, 재접속 시 ConfigFileList 헤더에 배지 표시
- [x] 모달 재열기 시 마지막 선택 폴더 정보 표시 및 재선택 가능
- [x] .txt 없는 폴더 선택 시 에러 메시지 표시 (FolderPathSettings)
- [x] WebSocket 연결 없이도 폴더 선택 기능 정상 동작
- [x] TypeScript 컴파일 오류 없음
