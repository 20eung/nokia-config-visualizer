/**
 * Config WebSocket 관련 타입 정의
 */

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
  path?: string;
  /** hostname (파일명에서 파싱) */
  hostname?: string;
  /** 날짜 (파일명에서 파싱, YYYYMMDD) */
  date?: string;
  /** 파일 크기 (bytes) */
  size?: number;
  /** 마지막 수정 시간 */
  lastModified?: number;
  /** 활성 상태 */
  isActive: boolean;
}

/**
 * Config 파일 그룹 (hostname별)
 */
export interface ConfigFileGroup {
  /** 호스트명 */
  hostname: string;
  /** 최신 파일명 */
  latestFile: string;
  /** 최신 날짜 */
  latestDate: string;
  /** 전체 파일 개수 */
  totalFiles: number;
}

/**
 * Config WebSocket Hook 반환값
 */
export interface UseConfigWebSocketReturn {
  /** WebSocket 연결 상태 */
  status: WebSocketStatus;
  /** Config 파일 목록 (최신만) */
  configFiles: string[];
  /** 파일 그룹 정보 (hostname별) */
  fileGroups: ConfigFileGroup[];
  /** 현재 활성 파일 */
  activeFile: string | null;
  /** 파일 선택 핸들러 */
  selectFile: (filename: string) => Promise<void>;
  /** 연결 재시도 */
  reconnect: () => void;
  /** WebSocket 연결 해제 */
  disconnect: () => void;
  /** 에러 메시지 */
  error: string | null;
  /** 감시 중인 폴더 경로 */
  watchPath: string;
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
  /** 에러 메시지 */
  error?: string | null;
}

/**
 * Config File List Props
 */
export interface ConfigFileListProps {
  /** 파일 목록 */
  files: string[];
  /** 파일 그룹 정보 */
  groups?: ConfigFileGroup[];
  /** 현재 활성 파일 */
  activeFile: string | null;
  /** 파일 선택 핸들러 */
  onSelectFile: (filename: string) => void;
  /** 로딩 상태 */
  isLoading: boolean;
  /** WebSocket 연결 상태 */
  connectionStatus: WebSocketStatus;
}

/**
 * WebSocket 메시지 타입 (Backend와 동일)
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
 * WebSocket 메시지 페이로드 (Backend와 동일)
 */
export interface WebSocketMessage {
  type: WebSocketMessageType;
  data?: any;
  error?: string;
  timestamp: number;
}

/**
 * file-list 메시지 데이터
 */
export interface FileListData {
  files: string[];
  groups?: ConfigFileGroup[];
  watchPath: string;
}

/**
 * file-added/changed/deleted 메시지 데이터
 */
export interface FileEventData {
  filename: string;
  path: string;
  timestamp: number;
}

/**
 * file-list-updated 메시지 데이터
 */
export interface FileListUpdatedData {
  files: string[];
  watchPath: string;
  timestamp: number;
}
