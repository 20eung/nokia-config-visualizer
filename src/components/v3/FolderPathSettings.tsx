/**
 * Config 폴더 경로 설정 컴포넌트
 *
 * Docker 컨테이너 내 config 폴더 경로를 설정합니다.
 */

import React, { useState } from 'react';
import { Folder, Save, AlertCircle, Info } from 'lucide-react';
import type { FolderPathSettingsProps } from '../../types/configWebSocket';
import './FolderPathSettings.css';

export const FolderPathSettings: React.FC<FolderPathSettingsProps> = ({
  currentPath,
  onPathChange,
  isSaving,
  error
}) => {
  const [path, setPath] = useState(currentPath);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSave = async () => {
    setLocalError(null);

    if (!path || path.trim() === '') {
      setLocalError('폴더 경로를 입력해주세요.');
      return;
    }

    try {
      await onPathChange(path);
      // 성공 시 localStorage에 저장
      localStorage.setItem('configFolderPath', path);
    } catch (err: any) {
      setLocalError(err.message || 'Failed to set folder path');
    }
  };

  const displayError = error || localError;

  return (
    <div className="folder-path-settings">
      <div className="settings-header">
        <Folder size={20} />
        <h3>Config 폴더 경로 설정</h3>
      </div>

      <div className="settings-content">
        <div className="input-group">
          <label htmlFor="folder-path">컨테이너 내 폴더 경로</label>
          <input
            id="folder-path"
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/app/configs"
            disabled={isSaving}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSave();
              }
            }}
          />
        </div>

        <div className="info-box">
          <Info size={16} />
          <div className="info-content">
            <p>Docker 컨테이너 내 경로를 입력하세요.</p>
            <p className="example">예: /app/configs</p>
          </div>
        </div>

        {displayError && (
          <div className="error-box">
            <AlertCircle size={16} />
            <span>{displayError}</span>
          </div>
        )}

        <button
          className="save-button"
          onClick={handleSave}
          disabled={isSaving || !path}
        >
          {isSaving ? (
            <>
              <div className="spinner" />
              <span>저장 중...</span>
            </>
          ) : (
            <>
              <Save size={16} />
              <span>저장</span>
            </>
          )}
        </button>
      </div>

      <div className="settings-info">
        <h4>설정 방법</h4>
        <ol>
          <li>
            <strong>로컬 폴더 준비</strong>
            <br />
            백업 config 파일들을 한 폴더에 모아두세요.
          </li>
          <li>
            <strong>Docker Volume Mount</strong>
            <br />
            <code>docker-compose.yml</code>에서 볼륨을 마운트하세요.
            <pre>
              volumes:
              <br />
              &nbsp;&nbsp;- /path/to/configs:/app/configs:ro
            </pre>
          </li>
          <li>
            <strong>경로 입력</strong>
            <br />
            컨테이너 내 경로 (<code>/app/configs</code>)를 입력하세요.
          </li>
        </ol>
      </div>

      <div className="settings-tip">
        <Info size={16} />
        <div>
          <strong>자동 감지:</strong> 파일 추가/변경/삭제 시 자동으로 목록이
          업데이트됩니다.
          <br />
          <strong>최신 파일:</strong> hostname별 최신 날짜의 config만 표시됩니다.
        </div>
      </div>
    </div>
  );
};
