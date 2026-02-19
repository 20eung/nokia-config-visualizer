/**
 * WebSocket 서버
 *
 * File Watcher의 이벤트를 WebSocket을 통해 클라이언트에게 실시간으로 전송합니다.
 */

import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { fileWatcher, type FileWatcherEventData, type FileWatcherErrorData } from './fileWatcher';

/**
 * WebSocket 메시지 타입
 */
export type WebSocketMessageType =
  | 'file-list'
  | 'file-added'
  | 'file-changed'
  | 'file-deleted'
  | 'file-list-updated'
  | 'error'
  | 'ping'
  | 'pong';

/**
 * WebSocket 메시지 페이로드
 */
export interface WebSocketMessage {
  type: WebSocketMessageType;
  data?: any;
  error?: string;
  timestamp: number;
}

/**
 * 연결된 클라이언트 정보
 */
interface ConnectedClient {
  ws: WebSocket;
  id: string;
  connectedAt: number;
}

/**
 * WebSocket 서버 초기화
 *
 * @param server HTTP 서버 인스턴스
 * @returns WebSocketServer 인스턴스
 */
export function setupWebSocket(server: HTTPServer): WebSocketServer {
  const wss = new WebSocketServer({
    server,
    path: '/ws'
  });

  const clients = new Map<string, ConnectedClient>();
  let clientIdCounter = 0;

  wss.on('connection', (ws: WebSocket) => {
    const clientId = `client-${++clientIdCounter}`;
    const client: ConnectedClient = {
      ws,
      id: clientId,
      connectedAt: Date.now()
    };

    clients.set(clientId, client);
    console.log(`[WebSocket] Client connected: ${clientId} (Total: ${clients.size})`);

    // 연결 시 현재 파일 목록 전송
    sendFileList(ws);

    // File Watcher 이벤트 리스너 등록
    const onFileAdded = (data: FileWatcherEventData) => {
      sendMessage(ws, {
        type: 'file-added',
        data: {
          filename: data.filename,
          path: data.path,
          timestamp: data.timestamp
        },
        timestamp: Date.now()
      });
    };

    const onFileChanged = (data: FileWatcherEventData) => {
      sendMessage(ws, {
        type: 'file-changed',
        data: {
          filename: data.filename,
          path: data.path,
          timestamp: data.timestamp
        },
        timestamp: Date.now()
      });
    };

    const onFileDeleted = (data: FileWatcherEventData) => {
      sendMessage(ws, {
        type: 'file-deleted',
        data: {
          filename: data.filename,
          path: data.path,
          timestamp: data.timestamp
        },
        timestamp: Date.now()
      });
    };

    const onFileListUpdated = (data: FileWatcherEventData) => {
      sendMessage(ws, {
        type: 'file-list-updated',
        data: {
          files: data.latestFiles,
          watchPath: fileWatcher.getWatchPath(),
          timestamp: data.timestamp
        },
        timestamp: Date.now()
      });
    };

    const onError = (data: FileWatcherErrorData) => {
      sendMessage(ws, {
        type: 'error',
        error: data.error || 'Unknown error',
        data: {
          errorType: data.type,
          filename: data.filename,
          path: data.path
        },
        timestamp: Date.now()
      });
    };

    // 이벤트 리스너 등록
    fileWatcher.on('file-added', onFileAdded);
    fileWatcher.on('file-changed', onFileChanged);
    fileWatcher.on('file-deleted', onFileDeleted);
    fileWatcher.on('file-list-updated', onFileListUpdated);
    fileWatcher.on('error', onError);

    // 클라이언트 메시지 수신
    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());

        // Ping-Pong
        if (data.type === 'ping') {
          sendMessage(ws, {
            type: 'pong',
            timestamp: Date.now()
          });
        }
      } catch (error) {
        console.error(`[WebSocket] Failed to parse message from ${clientId}:`, error);
      }
    });

    // 연결 해제 시 리스너 제거
    ws.on('close', () => {
      console.log(`[WebSocket] Client disconnected: ${clientId} (Total: ${clients.size - 1})`);

      fileWatcher.off('file-added', onFileAdded);
      fileWatcher.off('file-changed', onFileChanged);
      fileWatcher.off('file-deleted', onFileDeleted);
      fileWatcher.off('file-list-updated', onFileListUpdated);
      fileWatcher.off('error', onError);

      clients.delete(clientId);
    });

    ws.on('error', (error) => {
      console.error(`[WebSocket] Error on ${clientId}:`, error);
    });
  });

  // Heartbeat: 30초마다 ping 전송
  const heartbeatInterval = setInterval(() => {
    for (const [clientId, client] of clients.entries()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        sendMessage(client.ws, {
          type: 'ping',
          timestamp: Date.now()
        });
      } else {
        // 연결이 끊긴 클라이언트 제거
        clients.delete(clientId);
      }
    }
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
    console.log('[WebSocket] Server closed');
  });

  console.log('[WebSocket] Server started on path /ws');
  return wss;
}

/**
 * 파일 목록 전송 (최신 파일만)
 */
async function sendFileList(ws: WebSocket): Promise<void> {
  try {
    const files = await fileWatcher.getLatestFiles();
    const groups = await fileWatcher.getFileGroups();

    sendMessage(ws, {
      type: 'file-list',
      data: {
        files, // 최신 파일 목록
        groups, // 그룹 정보 (hostname별)
        watchPath: fileWatcher.getWatchPath()
      },
      timestamp: Date.now()
    });
  } catch (error: any) {
    sendMessage(ws, {
      type: 'error',
      error: 'Failed to get file list',
      data: {
        errorType: 'file-list-error',
        message: error.message
      },
      timestamp: Date.now()
    });
  }
}

/**
 * WebSocket 메시지 전송
 */
function sendMessage(ws: WebSocket, message: WebSocketMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('[WebSocket] Failed to send message:', error);
    }
  }
}

/**
 * 모든 클라이언트에게 브로드캐스트
 */
export function broadcastMessage(wss: WebSocketServer, message: WebSocketMessage): void {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      sendMessage(client, message);
    }
  });
}
