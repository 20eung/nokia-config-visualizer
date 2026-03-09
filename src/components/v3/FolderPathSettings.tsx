/**
 * Config 폴더 선택 컴포넌트
 *
 * OS 파일 브라우저(webkitdirectory)로 폴더를 선택하고,
 * .txt 파일을 브라우저에서 직접 읽어 파싱합니다.
 * 마지막 선택 폴더는 localStorage에 저장되어 재접속 시에도 표시됩니다.
 */

import React, { useState, useRef, useEffect, type ChangeEvent } from 'react';
import Folder from 'lucide-react/dist/esm/icons/folder';
import FolderOpen from 'lucide-react/dist/esm/icons/folder-open';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';

const LS_KEY = 'ncv_folder';

interface SavedFolder {
  name: string;
  fileCount: number;
  lastSelected: string; // ISO 8601
}

interface FolderPathSettingsProps {
  onFolderLoaded: (contents: string[]) => void;
}

export const FolderPathSettings: React.FC<FolderPathSettingsProps> = ({ onFolderLoaded }) => {
  const [savedFolder, setSavedFolder] = useState<SavedFolder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setSavedFolder(JSON.parse(raw));
    } catch {
      // localStorage 읽기 실패 시 무시
    }
  }, []);

  const handleFolderChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const allFiles = Array.from(e.target.files ?? []);
    const txtFiles = allFiles
      .filter(f => f.name.toLowerCase().endsWith('.txt'))
      .sort((a, b) => a.name.localeCompare(b.name));

    // input 초기화 (같은 폴더 재선택 가능하도록)
    e.target.value = '';

    if (txtFiles.length === 0) {
      setError('선택한 폴더에 .txt 파일이 없습니다.');
      return;
    }

    const folderName = txtFiles[0].webkitRelativePath.split('/')[0];
    setIsLoading(true);
    setError(null);

    try {
      const contents = await Promise.all(txtFiles.map(f => f.text()));
      const saved: SavedFolder = {
        name: folderName,
        fileCount: txtFiles.length,
        lastSelected: new Date().toISOString(),
      };
      localStorage.setItem(LS_KEY, JSON.stringify(saved));
      setSavedFolder(saved);
      onFolderLoaded(contents);
    } catch {
      setError('파일 읽기 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md max-w-[480px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <FolderOpen size={20} className="text-blue-500" />
        <h3 className="m-0 text-xl font-semibold text-gray-700 dark:text-gray-200">폴더 선택</h3>
      </div>

      <input
        ref={inputRef}
        type="file"
        // @ts-expect-error webkitdirectory is non-standard
        webkitdirectory=""
        multiple
        className="hidden"
        onChange={handleFolderChange}
      />

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="flex flex-col items-center gap-3 py-8 text-gray-500 dark:text-gray-400">
          <RefreshCw size={28} className="animate-spin text-blue-500" />
          <p className="m-0 text-sm">파일 읽는 중...</p>
        </div>
      )}

      {/* 에러 메시지 */}
      {!isLoading && error && (
        <div className="flex items-start gap-2 p-3 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md">
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-500" />
          <p className="m-0 text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* 선택 완료 상태 */}
      {!isLoading && savedFolder && (
        <div className="mb-5 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-md">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={16} className="text-green-500 shrink-0" />
            <span className="text-sm font-semibold text-green-700 dark:text-green-300">마지막 선택 폴더</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <Folder size={16} className="text-yellow-500 shrink-0" />
            <span className="text-sm font-mono font-bold text-gray-800 dark:text-gray-100">{savedFolder.name}</span>
          </div>
          <p className="m-0 text-xs text-gray-500 dark:text-gray-400 pl-6">
            {savedFolder.fileCount}개 파일 · {formatDate(savedFolder.lastSelected)}
          </p>
        </div>
      )}

      {/* 폴더 선택 버튼 */}
      {!isLoading && (
        <button
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium cursor-pointer transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          <FolderOpen size={18} />
          {savedFolder ? '폴더 재선택' : '폴더 선택'}
        </button>
      )}

      <p className="mt-3 text-center text-xs text-gray-400 dark:text-gray-500">
        선택한 폴더의 .txt 파일이 모두 자동으로 로딩됩니다
      </p>
    </div>
  );
};
