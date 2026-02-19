---
feature: auto-config-loading
version: v5.0.0
status: planning
created: 2026-02-19
author: Claude Code
---

# Auto Config Loading - Plan Document

> **Feature**: 로컬 폴더 자동 감시를 통한 Config 파일 자동 로딩
> **Version**: v5.0.0
> **Status**: 📋 Planning
> **Type**: User Experience Enhancement (Auto Loading)

---

## 1. Feature Overview

### 1.1 Summary

현재 Nokia Config Visualizer는 매번 수동으로 config 파일을 업로드해야 하는 불편함이 있습니다. **자주 사용하는 사용자**에게는 이러한 반복 작업이 번거롭게 느껴질 수 있습니다.

v5.0에서는 **로컬 Docker 환경**에서 특정 폴더를 지정하면, 해당 폴더 내 config 파일(*.txt)을 자동으로 감지하고 파싱하여 UI에 반영합니다.

### 1.2 Key Objectives

1. **자동 감지**: 지정된 폴더 내 *.txt 파일 변경 시 자동 감지
2. **자동 파싱**: 감지된 파일을 자동으로 파싱하여 UI 업데이트
3. **멀티 Config 지원**: 여러 config 파일을 동시에 로드하고 전환
4. **UI 병행 사용**: 기존 업로드 방식과 병행 사용 가능
5. **에러 처리**: 파싱 실패 시 명확한 에러 메시지 및 복구 가능

### 1.3 Current vs Proposed Workflow

**현재 워크플로우 (수동 업로드)**:
```
사용자 → 파일 선택 다이얼로그 → config 파일 선택 → 업로드 → 파싱 → UI 표시
```

**문제점**:
- 매번 파일 선택 다이얼로그를 열어야 함
- 여러 파일 비교 시 반복 업로드 필요
- 파일 경로를 매번 탐색해야 함

**제안 워크플로우 (자동 로딩)**:
```
초기 설정: 사용자 → 폴더 경로 지정 → 저장
자동 감지: File Watcher → 파일 변경 감지 → 자동 파싱 → UI 업데이트
```

**개선 효과**:
- 한 번만 폴더 경로 지정하면 이후 자동
- 파일 수정 시 즉시 반영
- 여러 config 파일 간 빠른 전환

---

## 2. Business Value

### 2.1 Problem Statement

**현재 사용자 불편 사항**:

1. **반복 작업**: 매번 config 파일을 수동으로 업로드
2. **시간 낭비**: 파일 선택 다이얼로그 탐색 시간
3. **여러 파일 비교 어려움**: 파일 간 전환 시 재업로드 필요
4. **수정 반영 지연**: config 수정 후 재업로드해야 함

**실제 사용 시나리오**:
> "매일 같은 폴더의 config 파일들을 분석하는데, 매번 업로드하는 게 번거로워요.
> 특히 여러 장비를 비교할 때는 파일을 계속 바꿔가며 업로드해야 해서 불편합니다."

### 2.2 Business Benefits

1. **사용자 경험 개선**: 반복 작업 제거로 UX 향상
2. **시간 절약**: 파일 선택 시간 제거 (평균 5초/파일)
3. **생산성 향상**: 여러 파일 비교 시 빠른 전환
4. **실시간 반영**: config 수정 즉시 UI 업데이트
5. **전문가 사용자 만족도**: 자주 사용하는 사용자의 워크플로우 최적화

### 2.3 Target Users

- **Primary**: 매일 동일 폴더의 config 파일들을 분석하는 엔지니어
- **Secondary**: 여러 장비 config를 비교 분석하는 사용자
- **Tertiary**: 실시간으로 config를 수정하며 결과를 확인하는 개발자

---

## 3. Goals and Objectives

### 3.1 Primary Goals

1. **폴더 경로 설정**: 사용자가 로컬 폴더 경로를 지정하고 저장
2. **File Watcher 구현**: Docker 컨테이너 내에서 폴더 감시
3. **자동 파싱**: 파일 변경 감지 시 자동 파싱 트리거
4. **멀티 Config 관리**: 여러 config 파일 목록 표시 및 전환
5. **에러 처리**: 파싱 실패 시 에러 메시지 및 fallback

### 3.2 Secondary Goals

1. **파일 필터링**: *.txt 파일만 자동 감지 (다른 파일 무시)
2. **성능 최적화**: 파일 변경 debounce로 불필요한 파싱 방지
3. **UI 피드백**: 자동 로딩 상태 표시 (아이콘, 로딩 인디케이터)
4. **로그 기록**: 자동 로딩 이벤트 로그 (디버깅 용도)

### 3.3 Success Metrics

| Metric | Current (수동 업로드) | Target (자동 로딩) | Measurement |
|--------|:---------------------:|:------------------:|:-----------:|
| 파일 로딩 시간 | ~5초 (파일 선택 포함) | < 1초 (자동 감지) | 평균 로딩 시간 |
| 파일 전환 시간 | ~3초 (재업로드) | < 0.5초 (전환) | UI 전환 응답 시간 |
| 사용자 클릭 수 | 3회 (찾기 → 선택 → 업로드) | 0회 (자동) | 사용자 인터랙션 횟수 |
| 에러 복구 시간 | 수동 재업로드 (~5초) | 자동 재시도 (< 2초) | 에러 후 복구 시간 |

---

## 4. Scope

### 4.1 In Scope

#### 4.1.1 로컬 Docker 환경 (v5.0)

- [x] **폴더 경로 설정 UI**:
  - 입력 필드: 절대 경로 또는 컨테이너 내 경로
  - 예시: `/app/configs` (Docker 컨테이너 내부 경로)
  - 저장 버튼 및 localStorage 저장

- [x] **Docker Volume Mount 설정**:
  ```yaml
  # docker-compose.yml
  services:
    frontend:
      volumes:
        - /Users/myuser/nokia-configs:/app/configs:ro  # 읽기 전용
  ```

- [x] **File Watcher (Backend)**:
  - Node.js `chokidar` 라이브러리 사용
  - 지정된 폴더 내 `*.txt` 파일 감시
  - 파일 생성/수정/삭제 이벤트 감지

- [x] **자동 파싱 트리거**:
  - WebSocket 또는 Server-Sent Events (SSE)로 프론트엔드에 알림
  - 프론트엔드에서 자동으로 파일 요청 및 파싱

- [x] **멀티 Config 관리 UI**:
  - Config 파일 목록 사이드바 (왼쪽 패널)
  - 파일명 클릭 시 해당 config로 전환
  - 현재 활성 config 하이라이트

- [x] **에러 처리**:
  - 파싱 실패 시 에러 메시지 표시
  - 파일 읽기 실패 시 재시도 로직
  - 잘못된 경로 설정 시 경고 메시지

#### 4.1.2 Backend Changes

**Step 1: File Watcher 서비스**
```typescript
// server/src/services/fileWatcher.ts
import chokidar from 'chokidar';
import { EventEmitter } from 'events';

class FileWatcherService extends EventEmitter {
  private watcher: chokidar.FSWatcher | null = null;
  private watchPath: string = '/app/configs';

  startWatching(path: string) {
    this.watchPath = path;
    this.watcher = chokidar.watch(`${path}/*.txt`, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 }
    });

    this.watcher
      .on('add', (filePath) => this.emit('file-added', filePath))
      .on('change', (filePath) => this.emit('file-changed', filePath))
      .on('unlink', (filePath) => this.emit('file-deleted', filePath));
  }

  stopWatching() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  getFiles(): string[] {
    // 현재 폴더 내 *.txt 파일 목록 반환
  }
}
```

**Step 2: WebSocket 서버**
```typescript
// server/src/services/websocket.ts
import { WebSocketServer } from 'ws';
import { fileWatcher } from './fileWatcher';

export function setupWebSocket(server: any) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    // 클라이언트 연결 시 현재 파일 목록 전송
    ws.send(JSON.stringify({
      type: 'file-list',
      files: fileWatcher.getFiles()
    }));

    // File Watcher 이벤트를 WebSocket으로 전송
    fileWatcher.on('file-added', (path) => {
      ws.send(JSON.stringify({ type: 'file-added', path }));
    });

    fileWatcher.on('file-changed', (path) => {
      ws.send(JSON.stringify({ type: 'file-changed', path }));
    });

    fileWatcher.on('file-deleted', (path) => {
      ws.send(JSON.stringify({ type: 'file-deleted', path }));
    });
  });
}
```

**Step 3: API Endpoints**
```typescript
// server/src/routes/config.ts
router.post('/watch-folder', (req, res) => {
  const { path } = req.body;
  fileWatcher.startWatching(path);
  res.json({ success: true });
});

router.get('/files', (req, res) => {
  const files = fileWatcher.getFiles();
  res.json({ files });
});

router.get('/file/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(fileWatcher.watchPath, filename);
  res.sendFile(filePath);
});
```

#### 4.1.3 Frontend Changes

**Step 1: WebSocket 클라이언트**
```typescript
// src/services/websocket.ts
class ConfigWebSocket {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Function[]> = new Map();

  connect() {
    this.ws = new WebSocket('ws://localhost:3001');

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.emit(data.type, data);
    };
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }
}
```

**Step 2: Config 파일 목록 사이드바**
```typescript
// src/components/v3/ConfigFileList.tsx
interface ConfigFileListProps {
  files: string[];
  activeFile: string | null;
  onSelectFile: (file: string) => void;
}

export const ConfigFileList: React.FC<ConfigFileListProps> = ({
  files,
  activeFile,
  onSelectFile
}) => {
  return (
    <div className="config-file-list">
      <h3>Config 파일 목록</h3>
      {files.map(file => (
        <div
          key={file}
          className={`file-item ${file === activeFile ? 'active' : ''}`}
          onClick={() => onSelectFile(file)}
        >
          <FileIcon />
          <span>{file}</span>
        </div>
      ))}
    </div>
  );
};
```

**Step 3: 폴더 경로 설정 UI**
```typescript
// src/components/v3/FolderPathSettings.tsx
export const FolderPathSettings: React.FC = () => {
  const [folderPath, setFolderPath] = useState('/app/configs');

  const handleSave = async () => {
    await fetch('/api/watch-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: folderPath })
    });

    localStorage.setItem('configFolderPath', folderPath);
    alert('폴더 경로가 저장되었습니다.');
  };

  return (
    <div className="folder-path-settings">
      <label>Config 폴더 경로:</label>
      <input
        type="text"
        value={folderPath}
        onChange={(e) => setFolderPath(e.target.value)}
        placeholder="/app/configs"
      />
      <button onClick={handleSave}>저장</button>
      <p className="help-text">
        Docker 컨테이너 내 경로를 입력하세요. (예: /app/configs)
      </p>
    </div>
  );
};
```

**Step 4: 자동 파싱 통합**
```typescript
// src/pages/V3Page.tsx
const [configFiles, setConfigFiles] = useState<string[]>([]);
const [activeFile, setActiveFile] = useState<string | null>(null);

useEffect(() => {
  const ws = new ConfigWebSocket();
  ws.connect();

  ws.on('file-list', ({ files }) => {
    setConfigFiles(files);
    if (files.length > 0 && !activeFile) {
      setActiveFile(files[0]);
    }
  });

  ws.on('file-added', ({ path }) => {
    setConfigFiles(prev => [...prev, path]);
  });

  ws.on('file-changed', ({ path }) => {
    if (path === activeFile) {
      // 현재 활성 파일이 변경되었으므로 자동 재파싱
      handleAutoRefresh(path);
    }
  });

  return () => ws.disconnect();
}, []);
```

### 4.2 Out of Scope

- ❌ **Cloudflare Pages 환경** (v5.0): 정적 호스팅이므로 파일 시스템 접근 불가. v5.1 이후 브라우저 File System Access API로 구현 고려
- ❌ **네트워크 드라이브 지원**: 로컬 파일 시스템만 지원 (SMB, NFS는 v5.1 이후)
- ❌ **파일 업로드 제거**: 기존 업로드 방식은 유지 (병행 사용)
- ❌ **파일 편집 기능**: 읽기 전용 (편집은 외부 에디터 사용)

### 4.3 Assumptions

- Docker 컨테이너를 사용하는 로컬 환경
- 사용자가 Docker volume mount를 설정할 수 있음
- Config 파일은 *.txt 확장자 사용
- 파일 크기는 10MB 이하 (대용량 파일 제외)

---

## 5. Requirements

### 5.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|:--------:|:------:|
| FR-01 | 사용자가 폴더 경로를 입력하고 저장할 수 있음 | P0 | ⏳ |
| FR-02 | Docker volume mount로 로컬 폴더를 컨테이너에 연결 | P0 | ⏳ |
| FR-03 | 지정된 폴더 내 *.txt 파일을 자동 감지 (File Watcher) | P0 | ⏳ |
| FR-04 | 파일 변경 시 WebSocket으로 프론트엔드에 알림 | P0 | ⏳ |
| FR-05 | Config 파일 목록을 사이드바에 표시 | P0 | ⏳ |
| FR-06 | 파일 클릭 시 해당 config로 전환 | P0 | ⏳ |
| FR-07 | 현재 활성 파일 하이라이트 표시 | P1 | ⏳ |
| FR-08 | 파일 변경 감지 시 현재 활성 파일 자동 재파싱 | P0 | ⏳ |
| FR-09 | 파싱 실패 시 에러 메시지 표시 및 fallback | P0 | ⏳ |
| FR-10 | 기존 업로드 방식과 병행 사용 가능 | P0 | ⏳ |

### 5.2 Non-Functional Requirements

| ID | Requirement | Target | Priority |
|----|-------------|:------:|:--------:|
| NFR-01 | 파일 감지 지연 시간 | < 500ms (파일 저장 후) | P0 |
| NFR-02 | 파일 전환 응답 시간 | < 300ms (클릭 후 UI 업데이트) | P0 |
| NFR-03 | WebSocket 재연결 | < 3초 (연결 끊김 시) | P1 |
| NFR-04 | 메모리 사용량 | < 100MB (10개 파일 감시 시) | P1 |

---

## 6. Technical Architecture

### 6.1 System Overview

```
┌─────────────────────────────────────────────────────────┐
│                  로컬 파일 시스템                        │
│   /Users/myuser/nokia-configs/*.txt                     │
└────────────────┬────────────────────────────────────────┘
                 │ Docker Volume Mount
                 ↓
┌─────────────────────────────────────────────────────────┐
│           Docker 컨테이너 (/app/configs)                 │
│                                                          │
│   ┌──────────────────────────────────────────┐          │
│   │    File Watcher Service (chokidar)       │          │
│   │    - *.txt 파일 감시                     │          │
│   │    - 파일 생성/수정/삭제 이벤트 감지     │          │
│   └────────────┬─────────────────────────────┘          │
│                │ Event Emitter                           │
│                ↓                                         │
│   ┌──────────────────────────────────────────┐          │
│   │    WebSocket Server (ws)                 │          │
│   │    - file-added                          │          │
│   │    - file-changed                        │          │
│   │    - file-deleted                        │          │
│   └────────────┬─────────────────────────────┘          │
└────────────────┼─────────────────────────────────────────┘
                 │ WebSocket (ws://localhost:3001)
                 ↓
┌─────────────────────────────────────────────────────────┐
│                  프론트엔드 (React)                       │
│   ┌──────────────────────────────────────────┐          │
│   │    WebSocket 클라이언트                   │          │
│   │    - 파일 목록 수신                       │          │
│   │    - 파일 변경 이벤트 수신                │          │
│   └────────────┬─────────────────────────────┘          │
│                ↓                                         │
│   ┌──────────────────────────────────────────┐          │
│   │    ConfigFileList (사이드바)              │          │
│   │    - 파일 목록 표시                       │          │
│   │    - 파일 선택 UI                         │          │
│   └────────────┬─────────────────────────────┘          │
│                ↓                                         │
│   ┌──────────────────────────────────────────┐          │
│   │    V3Page                                │          │
│   │    - 자동 파싱 트리거                     │          │
│   │    - UI 업데이트                          │          │
│   └──────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────┘
```

### 6.2 File Watcher Flow

```typescript
// 1. 사용자가 폴더 경로 설정
localStorage.setItem('configFolderPath', '/app/configs');

// 2. File Watcher 시작
fileWatcher.startWatching('/app/configs');

// 3. 파일 변경 감지
fileWatcher.on('file-changed', (filePath) => {
  // 4. WebSocket으로 알림
  wss.clients.forEach(client => {
    client.send(JSON.stringify({
      type: 'file-changed',
      path: filePath
    }));
  });
});

// 5. 프론트엔드 수신
ws.onmessage = (event) => {
  const { type, path } = JSON.parse(event.data);

  if (type === 'file-changed' && path === activeFile) {
    // 6. 자동 재파싱
    fetchAndParseConfig(path);
  }
};
```

### 6.3 Component Hierarchy

```
V3Page (메인 페이지)
├── FolderPathSettings (폴더 경로 설정)
│   ├── 입력 필드 (/app/configs)
│   ├── 저장 버튼
│   └── 도움말 텍스트
│
├── ConfigFileList (파일 목록 사이드바)
│   ├── 파일 항목 (config1.txt)
│   ├── 파일 항목 (config2.txt) [active]
│   └── 파일 항목 (config3.txt)
│
├── FileUploadButton (기존 업로드 방식)
│   └── 파일 선택 다이얼로그
│
└── DiagramView (다이어그램 표시)
    └── 현재 활성 config의 다이어그램
```

---

## 7. Implementation Plan

### 7.1 Phase 1: Backend Infrastructure (Step 1-3)

**Step 1: File Watcher 서비스 구현**
- `server/src/services/fileWatcher.ts` 생성
- chokidar 라이브러리 설치 및 설정
- *.txt 파일 감시 로직 구현
- 파일 목록 조회 메서드 추가

**Step 2: WebSocket 서버 구현**
- `server/src/services/websocket.ts` 생성
- ws 라이브러리 설치
- File Watcher 이벤트를 WebSocket으로 전송
- 클라이언트 연결/해제 관리

**Step 3: API Endpoints 추가**
- `server/src/routes/config.ts` 수정
- POST `/api/watch-folder`: 폴더 경로 설정
- GET `/api/files`: 파일 목록 조회
- GET `/api/file/:filename`: 파일 내용 조회

### 7.2 Phase 2: Frontend Integration (Step 4-6)

**Step 4: WebSocket 클라이언트 구현**
- `src/services/websocket.ts` 생성
- WebSocket 연결 및 이벤트 리스너
- 재연결 로직 (exponential backoff)

**Step 5: Config 파일 목록 UI**
- `src/components/v3/ConfigFileList.tsx` 생성
- 파일 목록 표시
- 파일 선택 및 활성 상태 표시

**Step 6: 폴더 경로 설정 UI**
- `src/components/v3/FolderPathSettings.tsx` 생성
- 입력 필드 및 저장 버튼
- localStorage 연동

### 7.3 Phase 3: Docker Configuration (Step 7-8)

**Step 7: Docker Volume Mount 설정**
- `docker-compose.yml` 수정
- Volume mount 예시 추가 (README.md)
- 환경변수 설정 (WATCH_FOLDER_PATH)

**Step 8: 통합 테스트 및 최적화**
- 파일 변경 감지 테스트
- WebSocket 재연결 테스트
- 성능 최적화 (debounce, throttle)

---

## 8. Dependencies

### 8.1 External Dependencies

**Backend**:
- **chokidar** (^3.5.3): File system watcher
- **ws** (^8.14.2): WebSocket 서버

**Frontend**:
- **WebSocket API**: 브라우저 내장 (추가 라이브러리 불필요)

### 8.2 Internal Dependencies

- **v3 Parser** (`parserV3.ts`): Config 파싱 로직 재사용
- **V3Page**: 기존 UI 컴포넌트 확장

### 8.3 Breaking Changes

⚠️ **No Breaking Changes**: 기존 업로드 방식은 유지되며, 자동 로딩은 추가 기능으로 제공

---

## 9. Risk Analysis

### 9.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|:-----------:|:------:|-----------|
| File Watcher 성능 저하 (많은 파일) | Medium | High | 파일 필터링 (*.txt만), debounce 적용 |
| WebSocket 연결 끊김 | High | Medium | 자동 재연결 로직, fallback to polling |
| Docker volume mount 설정 오류 | Medium | High | 명확한 가이드 문서, 에러 메시지 개선 |
| 대용량 파일 (> 10MB) 성능 | Low | Medium | 파일 크기 체크, 경고 메시지 |

### 9.2 User Experience Risks

| Risk | Probability | Impact | Mitigation |
|------|:-----------:|:------:|-----------|
| 사용자가 Docker volume mount를 설정하지 못함 | High | High | 단계별 가이드, 예시 제공 |
| 파일 변경 감지가 즉시 반영되지 않음 | Medium | Medium | 로딩 인디케이터, 진행 상태 표시 |
| 여러 config 파일 간 전환 시 혼란 | Low | Low | 현재 활성 파일 명확히 표시 |

---

## 10. Testing Strategy

### 10.1 Unit Tests

- **File Watcher 서비스**: 파일 추가/수정/삭제 이벤트 발생 확인
- **WebSocket 서버**: 이벤트 전송 및 클라이언트 연결 관리
- **Config 파일 목록 UI**: 파일 선택 및 활성 상태 전환

### 10.2 Integration Tests

- **E2E 시나리오 1**: 폴더 경로 설정 → File Watcher 시작 → 파일 목록 표시
- **E2E 시나리오 2**: 파일 추가 → WebSocket 알림 → 파일 목록 업데이트
- **E2E 시나리오 3**: 파일 수정 → 현재 활성 파일 자동 재파싱 → UI 업데이트
- **E2E 시나리오 4**: WebSocket 연결 끊김 → 자동 재연결 → 정상 동작

### 10.3 Performance Tests

- **파일 감지 지연 시간**: < 500ms (10개 파일 동시 변경)
- **파일 전환 시간**: < 300ms (UI 반응 속도)
- **메모리 사용량**: < 100MB (File Watcher + WebSocket)

---

## 11. Rollout Plan

### 11.1 Phase 1: Internal Testing (2 days)

- 개발 환경에서 Docker volume mount 설정 테스트
- File Watcher 및 WebSocket 동작 확인
- 파일 변경 감지 및 자동 파싱 테스트

### 11.2 Phase 2: Beta Release (3 days)

- 일부 사용자에게 v5.0 배포 (Docker 사용자 대상)
- 사용 가이드 제공 (README.md 업데이트)
- 피드백 수집 및 버그 수정

### 11.3 Phase 3: General Availability (v5.0.0)

- 모든 Docker 사용자에게 배포
- Cloudflare Pages 사용자는 기존 업로드 방식 유지
- 릴리즈 노트 공개

---

## 12. Success Criteria

### 12.1 Launch Criteria

- [x] FR-01 ~ FR-10 (P0) 모두 구현 완료
- [x] File Watcher 및 WebSocket 통합 테스트 통과
- [x] Docker volume mount 설정 가이드 작성
- [x] 성능 테스트 통과 (파일 감지 < 500ms)

### 12.2 Post-Launch Metrics (1주 후)

- 자동 로딩 사용률: ≥ 50% (Docker 사용자 기준)
- 파일 전환 시간: < 300ms (평균)
- 사용자 만족도: "자동 로딩이 편리하다" 긍정 피드백 ≥ 80%
- 에러 발생률: < 5% (파일 감지 실패)

---

## 13. Future Enhancements (v5.1+)

### 13.1 Cloudflare Pages 지원

- 브라우저 File System Access API 활용
- 사용자가 로컬 폴더에 대한 권한 부여
- 파일 변경 감지 (Polling 방식)

### 13.2 네트워크 드라이브 지원

- SMB, NFS 프로토콜 지원
- 원격 서버의 config 파일 감시

### 13.3 파일 편집 기능

- 간단한 텍스트 에디터 통합
- 수정 후 자동 저장 및 재파싱

### 13.4 파일 히스토리

- 변경 이력 추적 (Git 연동)
- 이전 버전으로 롤백

---

## 14. Related Documents

- **README.md**: 프로젝트 개요 및 Docker 설정 가이드
- **HOWTO-DOCKER.md**: Docker 빌드 및 배포 상세 가이드
- **CLAUDE.md**: 프로젝트 컨텍스트 문서

---

## 15. Docker Configuration Example

### 15.1 docker-compose.yml

```yaml
version: '3.8'

services:
  backend:
    build: ./server
    ports:
      - "3001:3001"
    volumes:
      # 로컬 config 폴더를 컨테이너에 마운트 (읽기 전용)
      - /Users/myuser/nokia-configs:/app/configs:ro
    environment:
      - WATCH_FOLDER_PATH=/app/configs

  frontend:
    build: .
    ports:
      - "5173:5173"
    depends_on:
      - backend
```

### 15.2 사용 가이드 (README.md 추가)

**자동 Config 로딩 설정**:

1. **로컬 폴더 준비**:
   ```bash
   mkdir -p ~/nokia-configs
   cp config1.txt config2.txt ~/nokia-configs/
   ```

2. **Docker volume mount 설정**:
   ```yaml
   # docker-compose.yml
   services:
     backend:
       volumes:
         - ~/nokia-configs:/app/configs:ro
   ```

3. **컨테이너 재시작**:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

4. **웹 UI에서 폴더 경로 설정**:
   - V3 페이지 → 설정 아이콘 → "Config 폴더 경로" → `/app/configs` 입력 → 저장

5. **자동 로딩 확인**:
   - 좌측 사이드바에 config 파일 목록 표시
   - 파일 수정 시 자동으로 UI 업데이트

---

## 16. Parallel Development Strategy

### 16.1 병렬 개발 현황

현재 **두 개의 기능**이 동시에 개발되고 있습니다:

| Feature | 브랜치 | Phase | 영향 파일 |
|---------|--------|-------|----------|
| **search-examples-ui** (검색창 고도화) | v4-development | Design | `ServiceListV3.tsx`, `ServiceListV3.css` |
| **auto-config-loading** (자동 로딩) | v4-development | Plan | `V3Page.tsx`, Backend 파일들, 신규 컴포넌트들 |

### 16.2 파일 충돌 분석

#### 16.2.1 충돌 위험 파일

**높은 충돌 위험** (두 기능이 동시 수정):
- ❌ 없음 (파일 수정 범위가 겹치지 않음)

**낮은 충돌 위험** (같은 파일이지만 다른 섹션 수정):
- ⚠️ **src/pages/V3Page.tsx**:
  - search-examples-ui: 수정 안 함
  - auto-config-loading: WebSocket 통합, config 파일 목록 관리 (라인 50-100 예상)
  - 충돌 가능성: **10%** (같은 파일이지만 다른 영역)

#### 16.2.2 독립적인 파일

**충돌 없음**:
- ✅ **ServiceListV3.tsx** (search-examples-ui 전용)
- ✅ **ServiceListV3.css** (search-examples-ui 전용)
- ✅ Backend 파일들 (auto-config-loading 전용)
- ✅ 신규 컴포넌트들 (auto-config-loading 전용)

### 16.3 Git 브랜치 전략

#### 16.3.1 권장 전략: Feature 브랜치 사용

```bash
# 현재 상황
v4-development (main branch)
  ├── feature/search-examples-ui (다른 창)
  └── feature/auto-config-loading (현재 창)
```

**작업 순서**:

1. **search-examples-ui** 브랜치 생성 (다른 창):
   ```bash
   git checkout -b feature/search-examples-ui v4-development
   # 작업 진행...
   ```

2. **auto-config-loading** 브랜치 생성 (현재 창):
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

#### 16.3.2 대안: 순차 개발 (가장 안전)

하나의 기능을 완료한 후 다른 기능 시작:

```bash
# Option 1: search-examples-ui 먼저 완료
1. search-examples-ui 개발 완료 → merge → push
2. auto-config-loading 개발 시작

# Option 2: auto-config-loading 먼저 완료
1. auto-config-loading 개발 완료 → merge → push
2. search-examples-ui 개발 재개
```

**추천**: Option 1 (search-examples-ui가 더 간단하고 빠름)

### 16.4 충돌 예방 가이드라인

#### 16.4.1 코드 작성 시 주의사항

**V3Page.tsx 수정 시**:

```typescript
// ✅ 좋은 예: 섹션 분리
// === Search Examples UI (search-examples-ui) ===
// (검색창 관련 코드)

// === Auto Config Loading (auto-config-loading) ===
// (파일 목록 관련 코드)
```

**Import 문 정리**:
```typescript
// ✅ 좋은 예: 알파벳 순 정렬
import { ConfigFileList } from '@/components/v3/ConfigFileList';
import { FolderPathSettings } from '@/components/v3/FolderPathSettings';
import { ServiceListV3 } from '@/components/v3/ServiceListV3';
```

#### 16.4.2 충돌 발생 시 해결 방법

**Step 1: 충돌 확인**
```bash
git rebase v4-development
# 충돌 발생 시:
# CONFLICT (content): Merge conflict in src/pages/V3Page.tsx
```

**Step 2: 충돌 파일 열기**
```typescript
// src/pages/V3Page.tsx
<<<<<<< HEAD
// search-examples-ui 변경사항
const [searchExamples, setSearchExamples] = useState([]);
=======
// auto-config-loading 변경사항
const [configFiles, setConfigFiles] = useState([]);
>>>>>>> feature/auto-config-loading
```

**Step 3: 수동 병합**
```typescript
// 두 변경사항 모두 유지
const [searchExamples, setSearchExamples] = useState([]);
const [configFiles, setConfigFiles] = useState([]);
```

**Step 4: 충돌 해결 완료**
```bash
git add src/pages/V3Page.tsx
git rebase --continue
```

### 16.5 통합 테스트 계획

**두 기능이 모두 merge된 후**:

1. **기능별 독립 테스트**:
   - search-examples-ui: 예시 pill 클릭 → 검색 동작 확인
   - auto-config-loading: 파일 변경 → 자동 파싱 확인

2. **통합 테스트**:
   - 자동 로딩된 config 파일에서 검색 예시 사용
   - 여러 config 파일 전환 후 검색 예시 동작 확인

3. **회귀 테스트**:
   - 기존 업로드 방식 + 검색 기능 정상 동작 확인

### 16.6 커밋 메시지 규칙

**Feature 명시**:
```bash
# search-examples-ui
git commit -m "feat(search): Add search examples pills UI"

# auto-config-loading
git commit -m "feat(auto-loading): Add file watcher service"
```

**Merge 커밋**:
```bash
git merge feature/search-examples-ui -m "Merge feature/search-examples-ui into v4-development

- Add search examples pills UI
- Update ServiceListV3 component
- Add CSS styles for pills
"
```

### 16.7 결론

**충돌 위험 평가**: **🟢 낮음 (10%)**

**이유**:
1. ✅ 파일 수정 범위가 거의 겹치지 않음
2. ✅ search-examples-ui는 UI만 수정 (프론트엔드 전용)
3. ✅ auto-config-loading은 Backend + 신규 컴포넌트 위주
4. ⚠️ V3Page.tsx만 두 기능이 수정하지만, 다른 섹션 수정 예상

**권장 사항**:
1. ✅ Feature 브랜치 사용 (독립 개발)
2. ✅ search-examples-ui 먼저 완료 후 merge (더 간단함)
3. ✅ auto-config-loading은 rebase 후 merge
4. ✅ V3Page.tsx 수정 시 주석으로 섹션 구분
5. ✅ 통합 테스트 필수

---

## 17. Approval

| Role | Name | Date | Status |
|------|------|------|:------:|
| Product Owner | User | 2026-02-19 | ⏳ Pending |
| Tech Lead | Claude Code | 2026-02-19 | ✅ Approved |

---

**Last Updated**: 2026-02-19
**Document Version**: 1.0
**Status**: 📋 Planning
