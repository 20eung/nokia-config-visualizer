---
feature: auto-config-loading
version: v5.0.0
status: design
created: 2026-02-19
author: Claude Code
---

# Auto Config Loading - Design Document

> **Feature**: 로컬 폴더 자동 감시를 통한 Config 파일 자동 로딩
> **Version**: v5.0.0
> **Status**: 🎨 Design
> **Type**: User Experience Enhancement (Auto Loading)

## Plan 참조
[auto-config-loading.plan.md](../../01-plan/features/auto-config-loading.plan.md)

---

## 1. 개요 (Overview)

로컬 Docker 환경에서 특정 폴더를 지정하면, 해당 폴더 내 config 파일(*.txt)을 자동으로 감지하고 파싱하여 UI에 반영합니다.

### 핵심 원칙
1. **자동 감지**: File Watcher로 파일 변경 실시간 감지
2. **실시간 통신**: WebSocket으로 프론트엔드에 즉시 알림
3. **병행 사용**: 기존 업로드 방식과 함께 사용 가능
4. **에러 복구**: 파싱 실패 시 자동 재시도 및 명확한 에러 메시지

---

## 2. 아키텍처 (Architecture)

### 2.1 전체 시스템 구조

```
┌────────────────────────────────────────────────────────┐
│                로컬 파일 시스템                         │
│      /Users/myuser/nokia-configs/*.txt                 │
└───────────────────┬────────────────────────────────────┘
                    │ Docker Volume Mount (:ro)
                    ↓
┌────────────────────────────────────────────────────────┐
│              Docker 컨테이너 Backend                    │
│                                                         │
│  ┌──────────────────────────────────────────────┐     │
│  │  FileWatcherService (chokidar)               │     │
│  │  - watch: /app/configs/*.txt                 │     │
│  │  - events: add, change, unlink               │     │
│  └────────┬─────────────────────────────────────┘     │
│           │ EventEmitter                               │
│           ↓                                            │
│  ┌──────────────────────────────────────────────┐     │
│  │  WebSocketServer (ws)                        │     │
│  │  - port: 3001                                │     │
│  │  - events: file-list, file-added, ...       │     │
│  └────────┬─────────────────────────────────────┘     │
│           │                                            │
│  ┌────────┴────────────────────────────────────┐      │
│  │  Express API                                 │      │
│  │  - POST /api/watch-folder                   │      │
│  │  - GET  /api/files                          │      │
│  │  - GET  /api/file/:filename                 │      │
│  └──────────────────────────────────────────────┘     │
└───────────────────┬────────────────────────────────────┘
                    │ WebSocket (ws://localhost:3001)
                    ↓
┌────────────────────────────────────────────────────────┐
│              프론트엔드 (React)                         │
│                                                         │
│  ┌──────────────────────────────────────────────┐     │
│  │  ConfigWebSocket 클라이언트                  │     │
│  │  - 연결 관리, 이벤트 리스닝                 │     │
│  └────────┬─────────────────────────────────────┘     │
│           │ setState                                   │
│           ↓                                            │
│  ┌──────────────────────────────────────────────┐     │
│  │  V3Page (메인 페이지)                        │     │
│  │  - configFiles: string[]                    │     │
│  │  - activeFile: string | null                │     │
│  └────────┬─────────────────────────────────────┘     │
│           │                                            │
│           ├─→ ConfigFileList (사이드바)               │
│           ├─→ FolderPathSettings (설정 모달)          │
│           └─→ ServiceListV3 (서비스 목록)             │
└────────────────────────────────────────────────────────┘
```

### 2.2 컴포넌트 계층 구조

```
V3Page
├── FolderPathSettings (폴더 경로 설정)
│   ├── Input (경로 입력)
│   ├── Button (저장)
│   └── HelpText (가이드)
│
├── ConfigFileList (파일 목록 사이드바)
│   ├── FileItem[] (파일 목록)
│   │   ├── FileIcon
│   │   ├── FileName
│   │   └── ActiveIndicator
│   └── EmptyState (파일 없음)
│
├── FileUploadButton (기존 업로드 - 유지)
│
└── DiagramView (다이어그램 표시)
    └── 현재 활성 config의 다이어그램
```

### 2.3 데이터 흐름

#### 2.3.1 초기 설정 플로우

```
사용자: 폴더 경로 입력 (/app/configs)
    ↓
FolderPathSettings: POST /api/watch-folder
    ↓
FileWatcherService: startWatching(path)
    ↓
현재 폴더 내 파일 목록 스캔
    ↓
WebSocket: file-list 이벤트 전송
    ↓
프론트엔드: configFiles 상태 업데이트
    ↓
ConfigFileList: 파일 목록 렌더링
```

#### 2.3.2 파일 변경 감지 플로우

```
로컬: config1.txt 수정
    ↓
Docker volume mount: 컨테이너 내 파일 자동 동기화
    ↓
chokidar: 'change' 이벤트 감지
    ↓
FileWatcherService: emit('file-changed', path)
    ↓
WebSocketServer: broadcast file-changed
    ↓
ConfigWebSocket: onmessage 수신
    ↓
V3Page: activeFile === path ?
    ├─ Yes → 자동 재파싱 (fetchAndParseConfig)
    └─ No → 파일 목록만 업데이트
```

#### 2.3.3 파일 전환 플로우

```
사용자: ConfigFileList에서 파일 클릭
    ↓
handleSelectFile(filename)
    ↓
setActiveFile(filename)
    ↓
GET /api/file/:filename
    ↓
파일 내용 다운로드
    ↓
parseNokiaConfigV3(content)
    ↓
setParsedData(result)
    ↓
UI 업데이트 (다이어그램 재생성)
```

---

## 3. 타입 정의 (Type Definitions)

### 3.1 Backend 타입

```typescript
// server/src/types/fileWatcher.ts

/**
 * File Watcher 이벤트 타입
 */
export type FileWatcherEvent = 'file-added' | 'file-changed' | 'file-deleted';

/**
 * File Watcher 이벤트 데이터
 */
export interface FileWatcherEventData {
  /** 이벤트 타입 */
  type: FileWatcherEvent;
  /** 파일 경로 (절대 경로) */
  path: string;
  /** 파일명 (basename) */
  filename: string;
  /** 타임스탬프 */
  timestamp: number;
}

/**
 * File Watcher 설정
 */
export interface FileWatcherConfig {
  /** 감시할 폴더 경로 */
  watchPath: string;
  /** 파일 패턴 (glob) */
  pattern: string;
  /** debounce 시간 (ms) */
  debounceMs?: number;
  /** 최대 파일 크기 (bytes) */
  maxFileSize?: number;
}

/**
 * WebSocket 메시지 타입
 */
export type WebSocketMessageType =
  | 'file-list'
  | 'file-added'
  | 'file-changed'
  | 'file-deleted'
  | 'error';

/**
 * WebSocket 메시지 페이로드
 */
export interface WebSocketMessage {
  /** 메시지 타입 */
  type: WebSocketMessageType;
  /** 데이터 (타입별로 다름) */
  data?: any;
  /** 에러 메시지 (type='error'일 때) */
  error?: string;
}

/**
 * WebSocket file-list 응답
 */
export interface FileListMessage extends WebSocketMessage {
  type: 'file-list';
  data: {
    files: string[];
    watchPath: string;
  };
}

/**
 * WebSocket file-changed 알림
 */
export interface FileChangedMessage extends WebSocketMessage {
  type: 'file-changed';
  data: {
    filename: string;
    path: string;
    timestamp: number;
  };
}
```

### 3.2 Frontend 타입

```typescript
// src/types/configWebSocket.ts

/**
 * WebSocket 연결 상태
 */
export type WebSocketStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'reconnecting';

/**
 * Config 파일 메타데이터
 */
export interface ConfigFileMetadata {
  /** 파일명 */
  filename: string;
  /** 파일 경로 (컨테이너 내 경로) */
  path: string;
  /** 파일 크기 (bytes) */
  size?: number;
  /** 마지막 수정 시간 */
  lastModified?: number;
  /** 활성 상태 */
  isActive: boolean;
}

/**
 * Config WebSocket Hook 반환값
 */
export interface UseConfigWebSocketReturn {
  /** WebSocket 연결 상태 */
  status: WebSocketStatus;
  /** Config 파일 목록 */
  configFiles: string[];
  /** 현재 활성 파일 */
  activeFile: string | null;
  /** 파일 선택 핸들러 */
  selectFile: (filename: string) => Promise<void>;
  /** 연결 재시도 */
  reconnect: () => void;
  /** 에러 메시지 */
  error: string | null;
}

/**
 * Folder Path Settings Props
 */
export interface FolderPathSettingsProps {
  /** 현재 폴더 경로 */
  currentPath: string;
  /** 경로 변경 핸들러 */
  onPathChange: (path: string) => Promise<void>;
  /** 저장 중 상태 */
  isSaving: boolean;
}

/**
 * Config File List Props
 */
export interface ConfigFileListProps {
  /** 파일 목록 */
  files: ConfigFileMetadata[];
  /** 현재 활성 파일 */
  activeFile: string | null;
  /** 파일 선택 핸들러 */
  onSelectFile: (filename: string) => void;
  /** 로딩 상태 */
  isLoading: boolean;
}
```

---

## 4. Backend 설계

### 4.1 FileWatcherService

```typescript
// server/src/services/fileWatcher.ts

import chokidar, { FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';

/**
 * File Watcher 서비스
 *
 * 지정된 폴더 내 *.txt 파일을 감시하고 변경 이벤트를 발생시킵니다.
 */
export class FileWatcherService extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private watchPath: string;
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB

  constructor(watchPath: string = '/app/configs') {
    super();
    this.watchPath = watchPath;
  }

  /**
   * 파일 감시 시작
   */
  startWatching(path?: string): void {
    if (path) {
      this.watchPath = path;
    }

    // 기존 watcher 중지
    if (this.watcher) {
      this.stopWatching();
    }

    // chokidar 설정
    this.watcher = chokidar.watch(`${this.watchPath}/*.txt`, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100
      },
      depth: 0 // 하위 폴더 제외
    });

    // 이벤트 리스너 등록
    this.watcher
      .on('add', (filePath) => this.handleFileAdd(filePath))
      .on('change', (filePath) => this.handleFileChange(filePath))
      .on('unlink', (filePath) => this.handleFileDelete(filePath))
      .on('error', (error) => this.handleError(error));

    console.log(`[FileWatcher] Started watching: ${this.watchPath}`);
  }

  /**
   * 파일 감시 중지
   */
  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log('[FileWatcher] Stopped watching');
    }
  }

  /**
   * 현재 파일 목록 조회
   */
  async getFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.watchPath);
      return files.filter(file => file.endsWith('.txt'));
    } catch (error) {
      console.error('[FileWatcher] Error reading directory:', error);
      return [];
    }
  }

  /**
   * 파일 크기 체크
   */
  private async checkFileSize(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      if (stats.size > this.maxFileSize) {
        console.warn(`[FileWatcher] File too large: ${filePath} (${stats.size} bytes)`);
        return false;
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 파일 추가 이벤트 핸들러
   */
  private async handleFileAdd(filePath: string): Promise<void> {
    const filename = path.basename(filePath);
    const isValid = await this.checkFileSize(filePath);

    if (!isValid) {
      this.emit('error', {
        type: 'file-too-large',
        filename,
        path: filePath
      });
      return;
    }

    this.emit('file-added', {
      type: 'file-added',
      filename,
      path: filePath,
      timestamp: Date.now()
    });

    console.log(`[FileWatcher] File added: ${filename}`);
  }

  /**
   * 파일 변경 이벤트 핸들러
   */
  private async handleFileChange(filePath: string): Promise<void> {
    const filename = path.basename(filePath);
    const isValid = await this.checkFileSize(filePath);

    if (!isValid) {
      this.emit('error', {
        type: 'file-too-large',
        filename,
        path: filePath
      });
      return;
    }

    this.emit('file-changed', {
      type: 'file-changed',
      filename,
      path: filePath,
      timestamp: Date.now()
    });

    console.log(`[FileWatcher] File changed: ${filename}`);
  }

  /**
   * 파일 삭제 이벤트 핸들러
   */
  private handleFileDelete(filePath: string): void {
    const filename = path.basename(filePath);

    this.emit('file-deleted', {
      type: 'file-deleted',
      filename,
      path: filePath,
      timestamp: Date.now()
    });

    console.log(`[FileWatcher] File deleted: ${filename}`);
  }

  /**
   * 에러 핸들러
   */
  private handleError(error: Error): void {
    console.error('[FileWatcher] Error:', error);
    this.emit('error', {
      type: 'watcher-error',
      error: error.message
    });
  }

  /**
   * Watch 경로 변경
   */
  setWatchPath(path: string): void {
    this.watchPath = path;
    if (this.watcher) {
      this.startWatching();
    }
  }

  /**
   * 현재 감시 중인 경로 반환
   */
  getWatchPath(): string {
    return this.watchPath;
  }
}

// 싱글톤 인스턴스
export const fileWatcher = new FileWatcherService();
```

### 4.2 WebSocket 서버

```typescript
// server/src/services/websocket.ts

import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { fileWatcher } from './fileWatcher';

/**
 * WebSocket 서버 초기화
 */
export function setupWebSocket(server: HTTPServer): WebSocketServer {
  const wss = new WebSocketServer({
    server,
    path: '/ws'
  });

  wss.on('connection', (ws: WebSocket) => {
    console.log('[WebSocket] Client connected');

    // 연결 시 현재 파일 목록 전송
    sendFileList(ws);

    // File Watcher 이벤트 리스너 등록
    const onFileAdded = (data: any) => {
      sendMessage(ws, {
        type: 'file-added',
        data: {
          filename: data.filename,
          path: data.path,
          timestamp: data.timestamp
        }
      });
    };

    const onFileChanged = (data: any) => {
      sendMessage(ws, {
        type: 'file-changed',
        data: {
          filename: data.filename,
          path: data.path,
          timestamp: data.timestamp
        }
      });
    };

    const onFileDeleted = (data: any) => {
      sendMessage(ws, {
        type: 'file-deleted',
        data: {
          filename: data.filename,
          path: data.path,
          timestamp: data.timestamp
        }
      });
    };

    const onError = (data: any) => {
      sendMessage(ws, {
        type: 'error',
        error: data.error || 'Unknown error'
      });
    };

    fileWatcher.on('file-added', onFileAdded);
    fileWatcher.on('file-changed', onFileChanged);
    fileWatcher.on('file-deleted', onFileDeleted);
    fileWatcher.on('error', onError);

    // 연결 해제 시 리스너 제거
    ws.on('close', () => {
      console.log('[WebSocket] Client disconnected');
      fileWatcher.off('file-added', onFileAdded);
      fileWatcher.off('file-changed', onFileChanged);
      fileWatcher.off('file-deleted', onFileDeleted);
      fileWatcher.off('error', onError);
    });

    ws.on('error', (error) => {
      console.error('[WebSocket] Error:', error);
    });
  });

  console.log('[WebSocket] Server started');
  return wss;
}

/**
 * 파일 목록 전송
 */
async function sendFileList(ws: WebSocket): Promise<void> {
  try {
    const files = await fileWatcher.getFiles();
    sendMessage(ws, {
      type: 'file-list',
      data: {
        files,
        watchPath: fileWatcher.getWatchPath()
      }
    });
  } catch (error) {
    sendMessage(ws, {
      type: 'error',
      error: 'Failed to get file list'
    });
  }
}

/**
 * WebSocket 메시지 전송
 */
function sendMessage(ws: WebSocket, message: any): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}
```

### 4.3 API Endpoints

```typescript
// server/src/routes/config.ts

import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { fileWatcher } from '../services/fileWatcher';

const router = express.Router();

/**
 * POST /api/watch-folder
 * 폴더 경로 설정 및 감시 시작
 */
router.post('/watch-folder', async (req: Request, res: Response) => {
  try {
    const { path: watchPath } = req.body;

    if (!watchPath) {
      return res.status(400).json({
        success: false,
        error: 'Path is required'
      });
    }

    // 폴더 존재 확인
    try {
      await fs.access(watchPath);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Path does not exist'
      });
    }

    // File Watcher 시작
    fileWatcher.startWatching(watchPath);

    res.json({
      success: true,
      watchPath
    });
  } catch (error: any) {
    console.error('[API] Error setting watch folder:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/files
 * 현재 파일 목록 조회
 */
router.get('/files', async (req: Request, res: Response) => {
  try {
    const files = await fileWatcher.getFiles();
    res.json({
      success: true,
      files,
      watchPath: fileWatcher.getWatchPath()
    });
  } catch (error: any) {
    console.error('[API] Error getting files:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/file/:filename
 * 특정 파일 다운로드
 */
router.get('/file/:filename', async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const watchPath = fileWatcher.getWatchPath();
    const filePath = path.join(watchPath, filename);

    // 파일 존재 확인
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // 파일 전송
    res.sendFile(filePath);
  } catch (error: any) {
    console.error('[API] Error sending file:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/watch-status
 * 현재 감시 상태 조회
 */
router.get('/watch-status', (req: Request, res: Response) => {
  res.json({
    success: true,
    watchPath: fileWatcher.getWatchPath(),
    isWatching: fileWatcher.getWatchPath() !== null
  });
});

export default router;
```

---

## 5. Frontend 설계

### 5.1 ConfigWebSocket Hook

```typescript
// src/hooks/useConfigWebSocket.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import type { UseConfigWebSocketReturn, WebSocketStatus } from '@/types/configWebSocket';

/**
 * Config WebSocket Hook
 *
 * WebSocket 연결 관리 및 파일 목록 동기화
 */
export function useConfigWebSocket(): UseConfigWebSocketReturn {
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const [configFiles, setConfigFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000;

  /**
   * WebSocket 연결
   */
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setStatus('connecting');
    setError(null);

    try {
      const ws = new WebSocket('ws://localhost:3001/ws');

      ws.onopen = () => {
        console.log('[ConfigWebSocket] Connected');
        setStatus('connected');
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleMessage(message);
        } catch (err) {
          console.error('[ConfigWebSocket] Failed to parse message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('[ConfigWebSocket] Error:', event);
        setError('WebSocket connection error');
        setStatus('error');
      };

      ws.onclose = () => {
        console.log('[ConfigWebSocket] Disconnected');
        setStatus('disconnected');
        wsRef.current = null;

        // 자동 재연결
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          setStatus('reconnecting');
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay);
        }
      };

      wsRef.current = ws;
    } catch (err: any) {
      console.error('[ConfigWebSocket] Connection failed:', err);
      setError(err.message);
      setStatus('error');
    }
  }, []);

  /**
   * WebSocket 메시지 핸들러
   */
  const handleMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'file-list':
        setConfigFiles(message.data.files);
        // 첫 파일 자동 선택
        if (message.data.files.length > 0 && !activeFile) {
          setActiveFile(message.data.files[0]);
        }
        break;

      case 'file-added':
        setConfigFiles(prev => [...prev, message.data.filename]);
        break;

      case 'file-changed':
        // 현재 활성 파일이 변경되었으면 재파싱 트리거
        if (message.data.filename === activeFile) {
          // V3Page에서 처리 (이벤트 발생)
          window.dispatchEvent(new CustomEvent('config-file-changed', {
            detail: { filename: message.data.filename }
          }));
        }
        break;

      case 'file-deleted':
        setConfigFiles(prev => prev.filter(f => f !== message.data.filename));
        if (message.data.filename === activeFile) {
          setActiveFile(null);
        }
        break;

      case 'error':
        setError(message.error);
        break;

      default:
        console.warn('[ConfigWebSocket] Unknown message type:', message.type);
    }
  }, [activeFile]);

  /**
   * 파일 선택
   */
  const selectFile = useCallback(async (filename: string) => {
    try {
      setActiveFile(filename);
      // V3Page에서 파일 로드 처리
      window.dispatchEvent(new CustomEvent('config-file-selected', {
        detail: { filename }
      }));
    } catch (err: any) {
      console.error('[ConfigWebSocket] Failed to select file:', err);
      setError(err.message);
    }
  }, []);

  /**
   * 재연결
   */
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  /**
   * 초기 연결 및 정리
   */
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    status,
    configFiles,
    activeFile,
    selectFile,
    reconnect,
    error
  };
}
```

### 5.2 FolderPathSettings 컴포넌트

```typescript
// src/components/v3/FolderPathSettings.tsx

import React, { useState } from 'react';
import './FolderPathSettings.css';

export interface FolderPathSettingsProps {
  currentPath: string;
  onPathChange: (path: string) => Promise<void>;
  isSaving: boolean;
}

export const FolderPathSettings: React.FC<FolderPathSettingsProps> = ({
  currentPath,
  onPathChange,
  isSaving
}) => {
  const [path, setPath] = useState(currentPath);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      setError(null);
      await onPathChange(path);
      localStorage.setItem('configFolderPath', path);
    } catch (err: any) {
      setError(err.message || 'Failed to set folder path');
    }
  };

  return (
    <div className="folder-path-settings">
      <h3>Config 폴더 경로 설정</h3>
      <div className="settings-content">
        <label htmlFor="folder-path">컨테이너 내 폴더 경로</label>
        <input
          id="folder-path"
          type="text"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="/app/configs"
          disabled={isSaving}
        />
        <p className="help-text">
          Docker 컨테이너 내 경로를 입력하세요.
          <br />
          예: /app/configs
        </p>
        {error && <p className="error-text">{error}</p>}
        <button
          onClick={handleSave}
          disabled={isSaving || !path}
        >
          {isSaving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  );
};
```

### 5.3 ConfigFileList 컴포넌트

```typescript
// src/components/v3/ConfigFileList.tsx

import React from 'react';
import { FileText } from 'lucide-react';
import type { ConfigFileListProps } from '@/types/configWebSocket';
import './ConfigFileList.css';

export const ConfigFileList: React.FC<ConfigFileListProps> = ({
  files,
  activeFile,
  onSelectFile,
  isLoading
}) => {
  if (isLoading) {
    return (
      <div className="config-file-list">
        <h3>Config 파일 목록</h3>
        <div className="loading">로딩 중...</div>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="config-file-list">
        <h3>Config 파일 목록</h3>
        <div className="empty-state">
          <FileText size={48} strokeWidth={1} />
          <p>파일이 없습니다</p>
          <p className="help-text">
            폴더 경로를 확인하고<br />
            *.txt 파일을 추가하세요
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="config-file-list">
      <h3>Config 파일 목록</h3>
      <div className="file-items">
        {files.map((file) => {
          const metadata = typeof file === 'string'
            ? { filename: file, isActive: file === activeFile }
            : file;

          return (
            <div
              key={metadata.filename}
              className={`file-item ${metadata.isActive ? 'active' : ''}`}
              onClick={() => onSelectFile(metadata.filename)}
            >
              <FileText size={16} />
              <span className="filename">{metadata.filename}</span>
              {metadata.isActive && (
                <span className="active-indicator">●</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

---

## 6. 구현 순서 (Implementation Order)

### Phase 1: Backend Infrastructure (Step 1-4)

#### Step 1: 의존성 설치
```bash
cd server
npm install chokidar ws
npm install --save-dev @types/ws
```

#### Step 2: FileWatcherService 구현
- `server/src/services/fileWatcher.ts` 생성
- chokidar 설정 및 이벤트 리스너
- 파일 크기 체크 로직
- 싱글톤 인스턴스 export

#### Step 3: WebSocket 서버 구현
- `server/src/services/websocket.ts` 생성
- WebSocketServer 초기화
- File Watcher 이벤트 → WebSocket 메시지 전송
- 클라이언트 연결/해제 관리

#### Step 4: API Endpoints 추가
- `server/src/routes/config.ts` 수정
- POST `/api/watch-folder`: 폴더 경로 설정
- GET `/api/files`: 파일 목록 조회
- GET `/api/file/:filename`: 파일 다운로드
- GET `/api/watch-status`: 감시 상태 조회

#### Step 5: Express 서버 통합
```typescript
// server/src/index.ts
import express from 'express';
import http from 'http';
import configRoutes from './routes/config';
import { setupWebSocket } from './services/websocket';
import { fileWatcher } from './services/fileWatcher';

const app = express();
const server = http.createServer(app);

app.use('/api', configRoutes);

// WebSocket 서버 설정
setupWebSocket(server);

// 서버 시작 시 File Watcher 자동 시작
const defaultWatchPath = process.env.WATCH_FOLDER_PATH || '/app/configs';
fileWatcher.startWatching(defaultWatchPath);

server.listen(3001, () => {
  console.log('Server started on port 3001');
});
```

### Phase 2: Frontend Integration (Step 6-9)

#### Step 6: 타입 정의
- `src/types/configWebSocket.ts` 생성
- 모든 인터페이스 정의

#### Step 7: useConfigWebSocket Hook 구현
- `src/hooks/useConfigWebSocket.ts` 생성
- WebSocket 연결 관리
- 자동 재연결 로직
- 파일 목록 상태 관리

#### Step 8: UI 컴포넌트 구현
- `src/components/v3/FolderPathSettings.tsx`
- `src/components/v3/ConfigFileList.tsx`
- CSS 파일 작성

#### Step 9: V3Page 통합
```typescript
// src/pages/V3Page.tsx

import { useConfigWebSocket } from '@/hooks/useConfigWebSocket';
import { FolderPathSettings } from '@/components/v3/FolderPathSettings';
import { ConfigFileList } from '@/components/v3/ConfigFileList';

export const V3Page: React.FC = () => {
  // === Auto Config Loading (auto-config-loading) ===
  const {
    status: wsStatus,
    configFiles,
    activeFile,
    selectFile,
    reconnect,
    error: wsError
  } = useConfigWebSocket();

  const [isSavingPath, setIsSavingPath] = useState(false);

  const handlePathChange = async (path: string) => {
    setIsSavingPath(true);
    try {
      const res = await fetch('/api/watch-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });

      if (!res.ok) {
        throw new Error('Failed to set folder path');
      }
    } finally {
      setIsSavingPath(false);
    }
  };

  // config-file-selected 이벤트 리스닝
  useEffect(() => {
    const handleFileSelected = async (event: CustomEvent) => {
      const { filename } = event.detail;

      // 파일 다운로드 및 파싱
      const res = await fetch(`/api/file/${filename}`);
      const content = await res.text();
      const parsed = parseNokiaConfigV3(content);

      setParsedData(parsed);
      // ... 기존 로직
    };

    window.addEventListener('config-file-selected', handleFileSelected as EventListener);
    return () => {
      window.removeEventListener('config-file-selected', handleFileSelected as EventListener);
    };
  }, []);

  // config-file-changed 이벤트 리스닝 (자동 재파싱)
  useEffect(() => {
    const handleFileChanged = async (event: CustomEvent) => {
      const { filename } = event.detail;
      console.log(`[V3Page] Auto-reloading: ${filename}`);

      // 현재 활성 파일 재파싱
      const res = await fetch(`/api/file/${filename}`);
      const content = await res.text();
      const parsed = parseNokiaConfigV3(content);

      setParsedData(parsed);
      // ... 기존 로직
    };

    window.addEventListener('config-file-changed', handleFileChanged as EventListener);
    return () => {
      window.removeEventListener('config-file-changed', handleFileChanged as EventListener);
    };
  }, []);

  return (
    <div className="v3-page">
      {/* 설정 모달 */}
      <FolderPathSettings
        currentPath={localStorage.getItem('configFolderPath') || '/app/configs'}
        onPathChange={handlePathChange}
        isSaving={isSavingPath}
      />

      {/* 파일 목록 사이드바 */}
      <ConfigFileList
        files={configFiles}
        activeFile={activeFile}
        onSelectFile={selectFile}
        isLoading={wsStatus === 'connecting'}
      />

      {/* 기존 UI (업로드 버튼 등) */}
      {/* ... */}
    </div>
  );
};
```

### Phase 3: Docker Configuration (Step 10-11)

#### Step 10: docker-compose.yml 수정
```yaml
version: '3.8'

services:
  backend:
    build: ./server
    ports:
      - "3001:3001"
    volumes:
      # 로컬 config 폴더를 컨테이너에 마운트 (읽기 전용)
      - ${CONFIG_FOLDER_PATH:-./public}:/app/configs:ro
    environment:
      - WATCH_FOLDER_PATH=/app/configs

  frontend:
    build: .
    ports:
      - "5173:5173"
    depends_on:
      - backend
```

#### Step 11: README.md 업데이트
```markdown
## 자동 Config 로딩 설정 (v5.0)

### 1. 로컬 폴더 준비
```bash
mkdir -p ~/nokia-configs
cp config1.txt config2.txt ~/nokia-configs/
```

### 2. docker-compose.yml 수정
```yaml
services:
  backend:
    volumes:
      - ~/nokia-configs:/app/configs:ro
```

### 3. 컨테이너 재시작
```bash
docker-compose down
docker-compose up -d
```

### 4. 웹 UI에서 폴더 경로 설정
- V3 페이지 → 설정 아이콘
- "Config 폴더 경로" → `/app/configs` 입력
- 저장

### 5. 자동 로딩 확인
- 좌측 사이드바에 config 파일 목록 표시
- 파일 수정 시 자동으로 UI 업데이트
```

### Phase 4: Testing & Optimization (Step 12-13)

#### Step 12: 통합 테스트
- File Watcher 동작 확인
- WebSocket 연결 테스트
- 파일 변경 감지 및 자동 재파싱 테스트
- 여러 파일 전환 테스트
- 재연결 로직 테스트

#### Step 13: 성능 최적화
- debounce 적용 (파일 변경 감지)
- WebSocket 재연결 지연 조정
- 파일 크기 제한 설정
- 메모리 사용량 모니터링

---

## 7. 에러 처리 (Error Handling)

### 7.1 Backend 에러 시나리오

| 에러 시나리오 | 에러 코드 | 처리 방법 |
|--------------|----------|----------|
| 폴더 경로 존재하지 않음 | `PATH_NOT_FOUND` | 400 응답, 에러 메시지 반환 |
| 파일 크기 초과 (> 10MB) | `FILE_TOO_LARGE` | WebSocket으로 경고 전송, 파일 무시 |
| 파일 읽기 권한 없음 | `PERMISSION_DENIED` | 500 응답, 권한 에러 메시지 |
| File Watcher 충돌 | `WATCHER_ERROR` | 재시작 시도, 실패 시 에러 로그 |
| WebSocket 연결 끊김 | `WS_DISCONNECTED` | 자동 재연결 (최대 5회) |

### 7.2 Frontend 에러 시나리오

| 에러 시나리오 | UI 표시 | 복구 방법 |
|--------------|---------|----------|
| WebSocket 연결 실패 | "연결 중..." → "연결 실패" | 재연결 버튼 표시 |
| 파일 다운로드 실패 | Toast: "파일을 불러올 수 없습니다" | 재시도 버튼 |
| 파싱 실패 | Toast: "Config 파일 형식 오류" | 다른 파일 선택 유도 |
| 폴더 경로 설정 실패 | 입력 필드 아래 에러 메시지 | 경로 수정 유도 |

### 7.3 에러 처리 코드 예시

```typescript
// Backend: FileWatcherService
private handleError(error: Error): void {
  const errorData = {
    type: 'watcher-error',
    error: error.message,
    timestamp: Date.now()
  };

  // WebSocket으로 에러 전송
  this.emit('error', errorData);

  // 로그 기록
  console.error('[FileWatcher] Error:', errorData);

  // 재시작 시도
  setTimeout(() => {
    if (!this.watcher) {
      this.startWatching();
    }
  }, 5000);
}

// Frontend: useConfigWebSocket
const handleMessage = useCallback((message: any) => {
  if (message.type === 'error') {
    setError(message.error);

    // Toast 알림
    toast.error(`Config 로딩 에러: ${message.error}`);

    // 특정 에러에 대한 복구 시도
    if (message.error.includes('WATCHER_ERROR')) {
      reconnect();
    }
  }
}, [reconnect]);
```

---

## 8. 성능 최적화 (Performance Optimization)

### 8.1 File Watcher 최적화

```typescript
// chokidar 설정 최적화
this.watcher = chokidar.watch(`${this.watchPath}/*.txt`, {
  // 파일 쓰기 완료 대기
  awaitWriteFinish: {
    stabilityThreshold: 1000, // 1초 동안 변경 없으면 완료로 간주
    pollInterval: 100         // 100ms마다 체크
  },
  // 하위 폴더 제외 (성능 향상)
  depth: 0,
  // 초기 파일 스캔 제외 (연결 시 수동으로 전송)
  ignoreInitial: false
});
```

### 8.2 WebSocket 메시지 최적화

```typescript
// 메시지 크기 최소화 (filename만 전송)
sendMessage(ws, {
  type: 'file-changed',
  data: {
    filename: data.filename,  // 전체 경로 대신 filename만
    timestamp: data.timestamp
  }
});
```

### 8.3 Frontend 렌더링 최적화

```typescript
// ConfigFileList: React.memo로 불필요한 리렌더링 방지
export const ConfigFileList = React.memo<ConfigFileListProps>(({
  files,
  activeFile,
  onSelectFile,
  isLoading
}) => {
  // ...
}, (prevProps, nextProps) => {
  // 파일 목록과 활성 파일이 변경되지 않으면 리렌더링 방지
  return (
    prevProps.files === nextProps.files &&
    prevProps.activeFile === nextProps.activeFile &&
    prevProps.isLoading === nextProps.isLoading
  );
});
```

---

## 9. 보안 고려사항 (Security Considerations)

### 9.1 파일 시스템 보안

1. **읽기 전용 마운트**:
   ```yaml
   volumes:
     - ~/nokia-configs:/app/configs:ro  # 읽기 전용
   ```

2. **파일 크기 제한**: 10MB (DoS 공격 방지)

3. **경로 검증**:
   ```typescript
   // 상위 디렉토리 접근 방지
   const filename = path.basename(req.params.filename);
   const filePath = path.join(watchPath, filename);

   // 경로 검증
   if (!filePath.startsWith(watchPath)) {
     throw new Error('Invalid file path');
   }
   ```

### 9.2 WebSocket 보안

1. **Origin 검증** (운영 환경):
   ```typescript
   const wss = new WebSocketServer({
     server,
     verifyClient: (info) => {
       const origin = info.origin;
       return origin === 'http://localhost:5173'; // 개발 환경
     }
   });
   ```

2. **Rate Limiting**: 연결 횟수 제한

---

## 10. 테스트 계획 (Testing Plan)

### 10.1 Unit Tests

**Backend**:
- FileWatcherService: 파일 추가/수정/삭제 이벤트 발생 확인
- WebSocketServer: 메시지 전송 로직
- API Endpoints: 요청/응답 검증

**Frontend**:
- useConfigWebSocket: 상태 관리 로직
- ConfigFileList: 파일 선택 동작
- FolderPathSettings: 경로 저장 로직

### 10.2 Integration Tests

| 시나리오 | 테스트 내용 | 예상 결과 |
|---------|------------|----------|
| 초기 설정 | 폴더 경로 설정 → File Watcher 시작 | 파일 목록 표시 |
| 파일 추가 | 새 config 파일 추가 | 목록에 자동 추가 |
| 파일 수정 | 활성 파일 수정 | 자동 재파싱, UI 업데이트 |
| 파일 전환 | 다른 파일 클릭 | 다이어그램 전환 |
| WebSocket 재연결 | 연결 끊김 → 자동 재연결 | 5초 내 재연결 |

### 10.3 Performance Tests

- **파일 감지 지연**: < 500ms (10개 파일 동시 변경)
- **파일 전환 시간**: < 300ms (UI 반응 속도)
- **메모리 사용량**: < 100MB (File Watcher + WebSocket)

---

## 11. 문서 업데이트 (Documentation Updates)

### 11.1 CLAUDE.md
- **Section 3.1**: auto-config-loading 기능 설명 추가
- **Section 7.1**: Backend 파일 구조 업데이트
- **Section 9**: Docker 설정 예시 추가

### 11.2 README.md
- **Installation**: Docker volume mount 설정 안내
- **Usage**: 자동 로딩 사용법 추가
- **Configuration**: 환경변수 설명

### 11.3 CHANGELOG.md
```markdown
## v5.0.0 (2026-02-XX)

### 🎉 New Features
- **Auto Config Loading**: 로컬 폴더 자동 감시를 통한 Config 파일 자동 로딩
  - File Watcher (chokidar)로 파일 변경 실시간 감지
  - WebSocket으로 프론트엔드에 즉시 알림
  - Config 파일 목록 사이드바
  - 파일 수정 시 자동 재파싱
  - 기존 업로드 방식과 병행 사용 가능

### 🛠️ Backend
- FileWatcherService 추가
- WebSocket 서버 추가
- API Endpoints 추가 (/api/watch-folder, /api/files, /api/file/:filename)

### 🎨 Frontend
- useConfigWebSocket Hook 추가
- ConfigFileList 컴포넌트 추가
- FolderPathSettings 컴포넌트 추가
- V3Page에 자동 로딩 통합
```

---

## 12. 병렬 개발 전략 (Parallel Development Strategy)

### 12.1 파일 수정 범위

| 기능 | 수정 파일 | 병렬 개발 가능 여부 |
|------|----------|-------------------|
| **search-examples-ui** | `ServiceListV3.tsx`, `ServiceListV3.css` | ✅ 독립적 |
| **auto-config-loading** | Backend, `V3Page.tsx`, 신규 컴포넌트 | ✅ 독립적 |

### 12.2 V3Page.tsx 수정 시 주의사항

```typescript
// ✅ 좋은 예: 섹션 구분 주석 추가
export const V3Page: React.FC = () => {
  // === 기존 상태 ===
  const [parsedData, setParsedData] = useState<ParsedConfigV3 | null>(null);
  // ...

  // === Auto Config Loading (auto-config-loading) ===
  const {
    status: wsStatus,
    configFiles,
    activeFile,
    selectFile,
    reconnect,
    error: wsError
  } = useConfigWebSocket();

  const [isSavingPath, setIsSavingPath] = useState(false);

  // ...
};
```

### 12.3 병합 순서

1. **search-examples-ui** 먼저 완료 → merge (더 간단함)
2. **auto-config-loading** 나중 완료 → rebase → merge

---

## 13. 향후 개선 사항 (Future Enhancements)

### v5.1: 동적 예시 생성 통합
- auto-config-loading으로 로드된 파일에서 실제 데이터 추출
- search-examples-ui의 동적 예시 기능 활성화

### v5.2: Cloudflare Pages 지원
- 브라우저 File System Access API 활용
- Polling 방식으로 파일 변경 감지

### v5.3: 파일 히스토리
- 변경 이력 추적 (Git 연동)
- 이전 버전으로 롤백

---

## 14. 승인 (Approval)

| Role | Name | Date | Status |
|------|------|------|:------:|
| Product Owner | User | 2026-02-19 | ⏳ Pending |
| Tech Lead | Claude Code | 2026-02-19 | ✅ Approved |

---

**Last Updated**: 2026-02-19
**Document Version**: 1.0
**Status**: 🎨 Design
