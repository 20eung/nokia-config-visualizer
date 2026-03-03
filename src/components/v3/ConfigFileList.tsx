/**
 * Config 파일 목록 컴포넌트
 *
 * hostname별 최신 config 파일 목록을 표시합니다.
 */

import React from 'react';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import FolderOpen from 'lucide-react/dist/esm/icons/folder-open';
import type { ConfigFileListProps } from '../../types/configWebSocket';
import { FileUpload } from '../FileUpload';

// rerender-memo: props(files, activeFiles) 불변 시 재렌더링 방지
const ConfigFileListImpl: React.FC<ConfigFileListProps> = ({
  files,
  groups,
  activeFiles,
  onToggleFile,
  isLoading,
  connectionStatus,
  onShowSettings,
  onUploadConfig
}) => {
  // Demo/Beta 환경 감지
  const isDemoEnvironment =
    window.location.hostname.includes('demo') ||
    window.location.hostname.includes('beta') ||
    window.location.hostname.includes('pages.dev') ||
    window.location.hostname.includes('cloudflare');

  // 연결 상태 표시 (로컬 환경에서만)
  const getStatusBadge = () => {
    if (isDemoEnvironment) return null; // Demo 환경에서는 표시하지 않음

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
    if (isDemoEnvironment) return ''; // Demo 환경에서는 표시하지 않음

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
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-gray-400 dark:text-gray-500 text-center">
          <FileText size={48} strokeWidth={1} className="text-gray-300 dark:text-gray-600" />
          <p className="m-0 text-sm">파일이 없습니다</p>
          <p className="m-0 text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
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
    <div className="w-[300px] h-full border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <h3 className="m-0 text-base font-semibold text-gray-700 dark:text-gray-200 flex-1">Config 파일 목록</h3>
        {getStatusBadge()}
        <span className="text-xs text-gray-500 dark:text-gray-400">{getStatusText()}</span>
      </div>

      <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <span>총 {files.length}개 (최신만 표시)</span>
      </div>

      <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {files.map((filename) => {
          const isActive = activeFiles.includes(filename);

          // 그룹 정보에서 hostname 추출 (있으면)
          const group = groups?.find((g) => g.latestFile === filename);
          const hostname = group?.hostname;

          // 날짜를 YYYY-MM-DD 형식으로 변환
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

      {/* 하단 버튼 영역 */}
      <div className="flex gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
        <button
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-500 hover:bg-blue-600 text-white border-none rounded-md cursor-pointer text-[13px] font-medium transition-colors duration-200"
          onClick={onShowSettings}
          title="자동 로딩 사용법"
        >
          <FolderOpen size={16} />
          <span>자동 로딩</span>
        </button>
        <div className="flex-1">
          <FileUpload onConfigLoaded={onUploadConfig} variant="compact" />
        </div>
      </div>
    </div>
  );
};

export const ConfigFileList = React.memo(ConfigFileListImpl);
