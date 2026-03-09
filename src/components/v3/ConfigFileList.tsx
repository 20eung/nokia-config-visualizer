/**
 * Config 파일 목록 컴포넌트
 *
 * hostname별 최신 config 파일 목록을 표시합니다.
 * 폴더 선택(webkitdirectory) 기능이 내장되어 있습니다.
 */

import React, { useEffect, useRef, useState, type ChangeEvent } from 'react';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import FolderOpen from 'lucide-react/dist/esm/icons/folder-open';
import Folder from 'lucide-react/dist/esm/icons/folder';
import type { ConfigFileListProps } from '../../types/configWebSocket';
import { FileUpload } from '../FileUpload';

const LS_KEY = 'ncv_folder';
interface SavedFolder { name: string; fileCount: number; lastSelected: string; }

// rerender-memo: props(files, activeFiles) 불변 시 재렌더링 방지
const ConfigFileListImpl: React.FC<ConfigFileListProps> = ({
  files,
  groups,
  activeFiles,
  onToggleFile,
  isLoading,
  connectionStatus,
  onShowSettings: _onShowSettings, // 더 이상 버튼에 사용하지 않음
  onUploadConfig
}) => {
  const [savedFolder, setSavedFolder] = useState<SavedFolder | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // webkitdirectory 속성은 React JSX로 전달되지 않을 수 있으므로 직접 setAttribute 사용
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute('webkitdirectory', '');
      folderInputRef.current.setAttribute('directory', ''); // Firefox 호환
    }
  }, []);

  useEffect(() => {
    const readSaved = () => {
      try {
        const raw = localStorage.getItem(LS_KEY);
        setSavedFolder(raw ? JSON.parse(raw) : null);
      } catch { /* ignore */ }
    };
    readSaved();
    window.addEventListener('storage', readSaved);
    return () => window.removeEventListener('storage', readSaved);
  }, []);

  const handleFolderChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const allFiles = Array.from(e.target.files ?? []);
    // 서브디렉토리 포함 전체 .txt 파일 수집, webkitRelativePath 기준 정렬
    const txtFiles = allFiles
      .filter(f => f.name.toLowerCase().endsWith('.txt'))
      .sort((a, b) => a.webkitRelativePath.localeCompare(b.webkitRelativePath));

    e.target.value = ''; // 같은 폴더 재선택 가능하도록 초기화

    if (txtFiles.length === 0) return;

    // 최상위 폴더명 추출 (서브디렉토리 포함 구조도 처리)
    const folderName = txtFiles[0].webkitRelativePath.split('/')[0];

    try {
      const contents = await Promise.all(txtFiles.map(f => f.text()));
      const saved: SavedFolder = {
        name: folderName,
        fileCount: txtFiles.length,
        lastSelected: new Date().toISOString(),
      };
      localStorage.setItem(LS_KEY, JSON.stringify(saved));
      setSavedFolder(saved);
      onUploadConfig(contents);
    } catch {
      // 읽기 실패 시 무시
    }
  };

  const formatShortDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  // Demo/Beta 환경 감지
  const isDemoEnvironment =
    window.location.hostname.includes('demo') ||
    window.location.hostname.includes('beta') ||
    window.location.hostname.includes('pages.dev') ||
    window.location.hostname.includes('cloudflare');

  // 연결 상태 표시 (로컬 환경에서만)
  const getStatusBadge = () => {
    if (isDemoEnvironment) return null;
    switch (connectionStatus) {
      case 'connected':
        return <span className="text-xs leading-none text-green-500 animate-pulse-opacity">●</span>;
      case 'connecting':
      case 'reconnecting':
        return <span className="text-xs leading-none text-orange-500">●</span>;
      case 'disconnected':
      case 'error':
        return <span className="text-xs leading-none text-red-500">●</span>;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    if (isDemoEnvironment) return '';
    switch (connectionStatus) {
      case 'connected':    return '연결됨';
      case 'connecting':   return '연결 중...';
      case 'reconnecting': return '재연결 중...';
      case 'disconnected': return '연결 끊김';
      case 'error':        return '연결 오류';
      default:             return '';
    }
  };

  // 공통: 폴더 선택 버튼 + 업로드 버튼
  const folderBadge = savedFolder && (
    <div className="flex items-center gap-1.5 px-4 py-1.5 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-700 text-xs text-yellow-700 dark:text-yellow-300">
      <Folder size={12} className="shrink-0" />
      <span className="font-mono font-semibold truncate">{savedFolder.name}</span>
      <span className="text-yellow-500 dark:text-yellow-500">·</span>
      <span>{savedFolder.fileCount}개</span>
      <span className="text-yellow-500 dark:text-yellow-500">·</span>
      <span>{formatShortDate(savedFolder.lastSelected)}</span>
    </div>
  );

  const bottomButtons = (
    <div className="flex gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
      {/* 숨겨진 폴더 선택 input — webkitdirectory는 useEffect에서 setAttribute로 설정 */}
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFolderChange}
      />
      <button
        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-500 hover:bg-blue-600 text-white border-none rounded-md cursor-pointer text-[13px] font-medium transition-colors duration-200"
        onClick={() => folderInputRef.current?.click()}
        title="폴더 선택 (서브디렉토리 포함)"
      >
        <FolderOpen size={16} />
        <span>폴더 선택</span>
      </button>
      <div className="flex-1">
        <FileUpload onConfigLoaded={onUploadConfig} variant="compact" />
      </div>
    </div>
  );

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="w-[300px] h-full border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h3 className="m-0 text-base font-semibold text-gray-700 dark:text-gray-200 flex-1">Config 파일 목록</h3>
          {getStatusBadge()}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-500 dark:text-gray-400">
          <RefreshCw size={24} className="animate-spin" />
          <p className="m-0 text-sm">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 파일 없음
  if (files.length === 0) {
    return (
      <div className="w-[300px] h-full border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h3 className="m-0 text-base font-semibold text-gray-700 dark:text-gray-200 flex-1">Config 파일 목록</h3>
          {getStatusBadge()}
          <span className="text-xs text-gray-500 dark:text-gray-400">{getStatusText()}</span>
        </div>
        {folderBadge}
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-gray-400 dark:text-gray-500 text-center">
          <FileText size={48} strokeWidth={1} className="text-gray-300 dark:text-gray-600" />
          <p className="m-0 text-sm">파일이 없습니다</p>
          <p className="m-0 text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
            폴더 선택 버튼을 눌러<br />Config 폴더를 선택하세요
          </p>
        </div>
        {bottomButtons}
      </div>
    );
  }

  // 파일 목록 표시
  return (
    <div className="w-[300px] h-full border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <h3 className="m-0 text-base font-semibold text-gray-700 dark:text-gray-200 flex-1">Config 파일 목록</h3>
        {getStatusBadge()}
        <span className="text-xs text-gray-500 dark:text-gray-400">{getStatusText()}</span>
      </div>

      {folderBadge}

      <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <span>총 {files.length}개 (최신만 표시)</span>
      </div>

      <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {files.map((filename) => {
          const isActive = activeFiles.includes(filename);
          const group = groups?.find((g) => g.latestFile === filename);
          const hostname = group?.hostname;
          const formatDate = (dateStr: string) => {
            if (!dateStr || dateStr.length !== 8) return dateStr;
            return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
          };
          const displayDate = group?.latestDate ? formatDate(group.latestDate) : '';

          return (
            <div
              key={filename}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors duration-200 border-l-3 ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-l-blue-500 [&_svg]:text-blue-500'
                  : 'border-l-transparent hover:bg-gray-100 dark:hover:bg-gray-800 [&_svg]:text-gray-500 dark:[&_svg]:text-gray-400'
              }`}
              onClick={() => onToggleFile(filename)}
              title={`${filename} (클릭하여 ${isActive ? '제외' : '포함'})`}
            >
              <FileText size={16} className="shrink-0" />
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                {hostname && <span className={`text-[13px] font-semibold ${isActive ? 'text-blue-500' : 'text-gray-700 dark:text-gray-200'}`}>{hostname}</span>}
                {displayDate && <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{displayDate}</span>}
              </div>
              {isActive && <span className="shrink-0 text-green-500 text-xs animate-pulse-opacity">●</span>}
            </div>
          );
        })}
      </div>

      {connectionStatus === 'error' && (
        <div className="flex items-center gap-2 px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-400 text-xs text-yellow-700 dark:text-yellow-300">
          <AlertCircle size={16} className="shrink-0" />
          <span>연결 오류. 파일 목록이 업데이트되지 않습니다.</span>
        </div>
      )}

      {bottomButtons}
    </div>
  );
};

export const ConfigFileList = React.memo(ConfigFileListImpl);
