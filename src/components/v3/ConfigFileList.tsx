/**
 * Config 파일 목록 컴포넌트
 *
 * hostname별 최신 config 파일 목록을 표시합니다.
 */

import React from 'react';
import { FileText, RefreshCw, AlertCircle } from 'lucide-react';
import type { ConfigFileListProps } from '../../types/configWebSocket';
import './ConfigFileList.css';

export const ConfigFileList: React.FC<ConfigFileListProps> = ({
  files,
  groups,
  activeFile,
  onSelectFile,
  isLoading,
  connectionStatus
}) => {
  // 연결 상태 표시
  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return <span className="status-badge status-connected">●</span>;
      case 'connecting':
      case 'reconnecting':
        return <span className="status-badge status-connecting">●</span>;
      case 'disconnected':
      case 'error':
        return <span className="status-badge status-error">●</span>;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return '연결됨';
      case 'connecting':
        return '연결 중...';
      case 'reconnecting':
        return '재연결 중...';
      case 'disconnected':
        return '연결 끊김';
      case 'error':
        return '연결 오류';
      default:
        return '';
    }
  };

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="config-file-list">
        <div className="list-header">
          <h3>Config 파일 목록</h3>
          {getStatusBadge()}
        </div>
        <div className="loading">
          <RefreshCw size={24} className="spin" />
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  // 파일 없음
  if (files.length === 0) {
    return (
      <div className="config-file-list">
        <div className="list-header">
          <h3>Config 파일 목록</h3>
          {getStatusBadge()}
          <span className="status-text">{getStatusText()}</span>
        </div>
        <div className="empty-state">
          <FileText size={48} strokeWidth={1} />
          <p>파일이 없습니다</p>
          <p className="help-text">
            폴더 경로를 확인하고
            <br />
            *.txt 파일을 추가하세요
          </p>
        </div>
      </div>
    );
  }

  // 파일 목록 표시
  return (
    <div className="config-file-list">
      <div className="list-header">
        <h3>Config 파일 목록</h3>
        {getStatusBadge()}
        <span className="status-text">{getStatusText()}</span>
      </div>

      <div className="file-count">
        <span>총 {files.length}개 (최신만 표시)</span>
      </div>

      <div className="file-items">
        {files.map((filename) => {
          const isActive = filename === activeFile;

          // 그룹 정보에서 hostname 추출 (있으면)
          const group = groups?.find((g) => g.latestFile === filename);
          const hostname = group?.hostname;

          return (
            <div
              key={filename}
              className={`file-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectFile(filename)}
              title={filename}
            >
              <FileText size={16} />
              <div className="file-info">
                {hostname && <span className="hostname">{hostname}</span>}
                <span className="filename">{filename}</span>
              </div>
              {isActive && <span className="active-indicator">●</span>}
            </div>
          );
        })}
      </div>

      {connectionStatus === 'error' && (
        <div className="connection-warning">
          <AlertCircle size={16} />
          <span>연결 오류. 파일 목록이 업데이트되지 않습니다.</span>
        </div>
      )}
    </div>
  );
};
