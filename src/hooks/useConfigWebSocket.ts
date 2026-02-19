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
  const [activeFiles, setActiveFiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [watchPath, setWatchPath] = useState<string>('/app/configs');

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
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

          // 모든 파일을 활성 상태로 설정
          if (data.files && data.files.length > 0) {
            setActiveFiles(data.files);
            // 모든 파일 로드 이벤트 발생
            window.dispatchEvent(
              new CustomEvent('config-files-load-all', {
                detail: { filenames: data.files }
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

          // 현재 활성 파일 중 하나가 변경되었으면 재파싱 트리거
          if (activeFiles.includes(data.filename)) {
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

          // 현재 활성 파일에서 삭제된 파일 제거
          setActiveFiles(prev => prev.filter(f => f !== data.filename));
          break;
        }

        case 'file-list-updated': {
          // 최신 파일 목록 업데이트 (hostname별 최신만)
          const data = message.data as FileListUpdatedData;
          setConfigFiles(data.files || []);
          setWatchPath(data.watchPath || '/app/configs');

          // 활성 파일 목록에서 삭제된 파일 제거 및 새 파일 추가
          setActiveFiles(prev => {
            // 목록에 있는 파일만 유지
            const filtered = prev.filter(f => data.files.includes(f));
            // 새로 추가된 파일을 activeFiles에 추가
            const newFiles = data.files.filter(f => !filtered.includes(f));
            return [...filtered, ...newFiles];
          });
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
    [activeFiles]
  );

  /**
   * 파일 토글 (추가/제거)
   */
  const toggleFile = useCallback((filename: string) => {
    setActiveFiles(prev => {
      if (prev.includes(filename)) {
        // 이미 활성화된 파일이면 제거
        const newFiles = prev.filter(f => f !== filename);
        // 파일 제거 이벤트 발생
        window.dispatchEvent(
          new CustomEvent('config-file-removed', {
            detail: { filename, activeFiles: newFiles }
          })
        );
        return newFiles;
      } else {
        // 활성화되지 않은 파일이면 추가
        const newFiles = [...prev, filename];
        // 파일 추가 이벤트 발생
        window.dispatchEvent(
          new CustomEvent('config-file-selected', {
            detail: { filename, activeFiles: newFiles }
          })
        );
        return newFiles;
      }
    });
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
    // Demo/Beta 환경에서는 WebSocket 연결 시도하지 않음
    const isDemoEnvironment =
      window.location.hostname.includes('demo') ||
      window.location.hostname.includes('beta') ||
      window.location.hostname.includes('pages.dev') ||
      window.location.hostname.includes('cloudflare');

    if (isDemoEnvironment) {
      console.log('[ConfigWebSocket] Demo environment detected. WebSocket disabled.');
      setStatus('disconnected');
      return;
    }

    // 로컬 환경에서만 WebSocket 연결
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    status,
    configFiles,
    fileGroups,
    activeFiles,
    toggleFile,
    reconnect,
    disconnect,
    error,
    watchPath
  };
}
