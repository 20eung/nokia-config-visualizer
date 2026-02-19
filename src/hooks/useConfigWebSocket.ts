/**
 * Config WebSocket Hook
 *
 * WebSocket 연결 관리 및 파일 목록 동기화를 처리합니다.
 * hostname별 최신 파일만 필터링하여 제공합니다.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  UseConfigWebSocketReturn,
  WebSocketStatus,
  WebSocketMessage,
  FileListData,
  FileEventData,
  FileListUpdatedData,
  ConfigFileGroup
} from '../types/configWebSocket';

/**
 * Config WebSocket Hook
 *
 * @returns WebSocket 연결 상태 및 파일 관리 함수
 */
export function useConfigWebSocket(): UseConfigWebSocketReturn {
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const [configFiles, setConfigFiles] = useState<string[]>([]);
  const [fileGroups, setFileGroups] = useState<ConfigFileGroup[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watchPath, setWatchPath] = useState<string>('/app/configs');

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3초

  /**
   * WebSocket 연결
   */
  const connect = useCallback(() => {
    // 이미 연결되어 있으면 무시
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setStatus('connecting');
    setError(null);

    try {
      // WebSocket 연결 (Backend 포트: 3001)
      const ws = new WebSocket('ws://localhost:3001/ws');

      ws.onopen = () => {
        console.log('[ConfigWebSocket] Connected');
        setStatus('connected');
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
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

        // 자동 재연결 (최대 5회)
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          setStatus('reconnecting');
          console.log(
            `[ConfigWebSocket] Reconnecting (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay);
        } else {
          console.error('[ConfigWebSocket] Max reconnect attempts reached');
          setError('Connection lost. Please refresh the page.');
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
   * WebSocket 연결 해제
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus('disconnected');
    reconnectAttemptsRef.current = 0;
  }, []);

  /**
   * WebSocket 메시지 핸들러
   */
  const handleMessage = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case 'file-list': {
          // 초기 파일 목록
          const data = message.data as FileListData;
          setConfigFiles(data.files || []);
          setFileGroups(data.groups || []);
          setWatchPath(data.watchPath || '/app/configs');

          // 첫 파일 자동 선택
          if (data.files && data.files.length > 0 && !activeFile) {
            setActiveFile(data.files[0]);
            // 파일 선택 이벤트 발생
            window.dispatchEvent(
              new CustomEvent('config-file-selected', {
                detail: { filename: data.files[0] }
              })
            );
          }
          break;
        }

        case 'file-added': {
          // 파일 추가 (개별 이벤트, file-list-updated가 곧 올 것임)
          const data = message.data as FileEventData;
          console.log(`[ConfigWebSocket] File added: ${data.filename}`);
          break;
        }

        case 'file-changed': {
          // 파일 변경
          const data = message.data as FileEventData;
          console.log(`[ConfigWebSocket] File changed: ${data.filename}`);

          // 현재 활성 파일이 변경되었으면 재파싱 트리거
          if (data.filename === activeFile) {
            window.dispatchEvent(
              new CustomEvent('config-file-changed', {
                detail: { filename: data.filename }
              })
            );
          }
          break;
        }

        case 'file-deleted': {
          // 파일 삭제 (file-list-updated가 곧 올 것임)
          const data = message.data as FileEventData;
          console.log(`[ConfigWebSocket] File deleted: ${data.filename}`);

          // 현재 활성 파일이 삭제되었으면 초기화
          if (data.filename === activeFile) {
            setActiveFile(null);
          }
          break;
        }

        case 'file-list-updated': {
          // 최신 파일 목록 업데이트 (hostname별 최신만)
          const data = message.data as FileListUpdatedData;
          setConfigFiles(data.files || []);
          setWatchPath(data.watchPath || '/app/configs');

          // 현재 활성 파일이 목록에 없으면 첫 파일로 변경
          if (activeFile && !data.files.includes(activeFile)) {
            if (data.files.length > 0) {
              setActiveFile(data.files[0]);
              window.dispatchEvent(
                new CustomEvent('config-file-selected', {
                  detail: { filename: data.files[0] }
                })
              );
            } else {
              setActiveFile(null);
            }
          }
          break;
        }

        case 'error': {
          // 에러 메시지
          const errorMsg = message.error || 'Unknown error';
          console.error('[ConfigWebSocket] Error:', errorMsg);
          setError(errorMsg);
          break;
        }

        case 'ping': {
          // Ping 메시지 (서버 Heartbeat)
          // Pong 응답 (자동으로 브라우저가 처리)
          break;
        }

        case 'pong': {
          // Pong 응답 (우리가 보낸 ping에 대한 응답)
          break;
        }

        default:
          console.warn('[ConfigWebSocket] Unknown message type:', message.type);
      }
    },
    [activeFile]
  );

  /**
   * 파일 선택
   */
  const selectFile = useCallback(async (filename: string) => {
    try {
      setActiveFile(filename);
      // V3Page에서 파일 로드 처리
      window.dispatchEvent(
        new CustomEvent('config-file-selected', {
          detail: { filename }
        })
      );
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
    disconnect();
    setTimeout(() => {
      connect();
    }, 500);
  }, [connect, disconnect]);

  /**
   * 초기 연결 및 정리
   */
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    status,
    configFiles,
    fileGroups,
    activeFile,
    selectFile,
    reconnect,
    disconnect,
    error,
    watchPath
  };
}
