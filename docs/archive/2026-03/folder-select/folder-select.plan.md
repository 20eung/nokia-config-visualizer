# Plan: 폴더 선택 기능 (folder-select)

**작성일**: 2026-03-09
**프로젝트**: nokia-config-visualizer
**현재 버전**: v5.2.5

---

## 1. 배경 및 문제

### 현재 상태

| 컴포넌트 | 역할 | 문제 |
|----------|------|------|
| `FileUpload.tsx` | 개별 파일 선택 (`<input multiple>`) | 파일을 하나씩 또는 여러 개 선택해야 함 |
| `ConfigFileList.tsx` | WebSocket 기반 서버 파일 목록 표시 | WebSocket 연결 불안정 시 파일 목록 미표시 |
| `FolderPathSettings.tsx` | "자동 로딩" 모달 — **안내 문서만 표시** | 실제 폴더 선택 기능 없음, 비기능 UI |
| `useConfigWebSocket.ts` | WebSocket 연결 관리 (최대 5회 재연결) | 재연결 실패 시 파일 목록 영구 불능 |

### 근본 문제

- `FolderPathSettings.tsx`가 단순 설명 페이지로, 사용자에게 "configs 폴더에 파일 저장 후 Docker 재시작" 안내만 제공
- WebSocket 연결 없이는 서버 파일 목록을 가져올 수 없어 전체 기능이 불안정
- 재접속 시 이전 작업 컨텍스트(어떤 폴더 사용했는지)가 초기화됨

---

## 2. 목표

### 주요 목표

1. **폴더 선택 기능**: IP Manager와 동일하게 OS 파일 브라우저에서 폴더 선택
2. **즉시 로딩**: 폴더 선택 시 `.txt` 파일을 브라우저에서 직접 읽어 파싱 (서버 업로드 불필요)
3. **선택 정보 유지**: localStorage에 폴더명 저장, 재접속 시 마지막 폴더 표시

### 범위 외

- WebSocket 기반 서버 파일 감시 제거 (기존 기능 유지, 폴더 선택과 병행)
- 서버 파일시스템 브라우저 UI (보안 이슈)
- 실제 File 객체 저장 (브라우저 보안상 불가)

---

## 3. 요구사항

### FR-01: 폴더 선택 UI

- `ConfigFileList` 하단 "자동 로딩" 버튼 → "폴더 선택" 버튼으로 변경
- 클릭 시 `<input webkitdirectory>` 로 OS 폴더 브라우저 열기
- 선택된 폴더 내 `.txt` 파일 전체 자동 로딩

### FR-02: 브라우저 파일 파싱

- 선택된 파일을 `FileReader`로 읽어 기존 `handleConfigLoaded` 흐름 재사용
- 파일 읽기 순서: 파일명 기준 정렬 후 처리
- 파일 없음 / 오류 시 사용자에게 명확한 피드백 표시

### FR-03: 선택 정보 localStorage 저장

- 저장 키: `ncv_folder` (JSON)
- 저장 내용: `{ name: string, fileCount: number, lastSelected: string (ISO date) }`
- 재접속 시 `ConfigFileList` 헤더에 마지막 폴더 정보 표시
- "폴더 재선택" 버튼으로 동일 폴더 재로딩 유도

### FR-04: FolderPathSettings 기능화

- 현재 안내 문서 UI → 실제 폴더 선택 기능 UI로 전환
- 미선택 상태: 폴더 선택 버튼 + 간단한 안내
- 선택 후 상태: 폴더명, 파일 수, 마지막 선택 시각 표시 + 재선택 버튼
- Props 추가: `onFolderLoaded: (contents: string[]) => void`

---

## 4. 기술 설계 방향

### 데이터 흐름 (변경 후)

```
사용자 클릭 "폴더 선택"
  → <input webkitdirectory> (OS 파일 브라우저)
  → File[] 획득 (브라우저 메모리)
  → .txt 파일 필터링
  → FileReader로 각 파일 텍스트 읽기
  → handleConfigLoaded(contents[]) 호출 (기존 파싱 흐름)
  → localStorage 저장 { name, fileCount, lastSelected }
  → ConfigFileList 헤더에 폴더 정보 표시
```

### localStorage 스키마

```ts
interface SavedFolder {
  name: string;       // 폴더명 (webkitRelativePath의 최상위 디렉토리)
  fileCount: number;  // .txt 파일 수
  lastSelected: string; // ISO 8601 날짜
}
const LS_KEY = 'ncv_folder';
```

### 변경 파일

| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `src/components/v3/FolderPathSettings.tsx` | 수정 | 안내 페이지 → 기능성 폴더 선택 컴포넌트 |
| `src/components/v3/ConfigFileList.tsx` | 수정 | 헤더에 저장된 폴더 정보 표시, 하단 버튼 레이블 변경 |
| `src/pages/V3Page.tsx` | 수정 | FolderPathSettings에 `onFolderLoaded` prop 전달 |

---

## 5. 구현 단계

1. `FolderPathSettings.tsx` 리팩터링 (핵심 폴더 선택 로직)
2. `ConfigFileList.tsx` 헤더/버튼 UI 업데이트
3. `V3Page.tsx` prop 연결

---

## 6. 완료 기준

- [ ] "폴더 선택" 버튼 클릭 시 OS 파일 브라우저 열림
- [ ] 폴더 선택 후 `.txt` 파일 자동 파싱 및 Config 목록 표시
- [ ] 폴더명이 localStorage에 저장되고 재접속 시 표시됨
- [ ] WebSocket 연결 없이도 폴더 선택 기능 정상 동작
- [ ] 빈 폴더 / .txt 없는 폴더 선택 시 에러 메시지 표시
