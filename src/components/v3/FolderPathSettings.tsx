/**
 * Config 폴더 안내 컴포넌트
 *
 * 자동 Config 로딩 기능 사용법을 안내합니다.
 */

import React from 'react';
import Folder from 'lucide-react/dist/esm/icons/folder';
import Info from 'lucide-react/dist/esm/icons/info';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';

export const FolderPathSettings: React.FC = () => {
  // Demo/Beta 환경 감지
  const isDemoEnvironment =
    window.location.hostname.includes('demo') ||
    window.location.hostname.includes('beta') ||
    window.location.hostname.includes('pages.dev') ||
    window.location.hostname.includes('cloudflare');

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md max-w-[600px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Folder size={20} className="text-blue-500" />
        <h3 className="m-0 text-xl font-semibold text-gray-700 dark:text-gray-200">자동 Config 로딩 사용법</h3>
      </div>

      <div className="flex flex-col gap-4">
        {isDemoEnvironment && (
          <div className="flex items-start gap-3 p-3 rounded border-l-3 border-l-yellow-400" style={{ backgroundColor: '#fff3cd', borderColor: '#ffc107' }}>
            <Info size={16} className="shrink-0 mt-0.5" style={{ color: '#856404' }} />
            <div className="flex-1">
              <p className="m-0 text-[13px] leading-relaxed" style={{ color: '#856404', fontWeight: 600 }}>
                ⚠️ 이 기능은 로컬 Docker 환경에서만 사용 가능합니다.
              </p>
              <p className="m-0 leading-relaxed" style={{ color: '#856404', fontSize: '13px', marginTop: '4px' }}>
                Demo 사이트에서는 <strong>Upload Config</strong> 버튼을 사용하세요.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border-l-3 border-l-blue-500 rounded">
          <Info size={16} className="shrink-0 mt-0.5 text-blue-500" />
          <div className="flex-1">
            <p className="m-0 text-[13px] text-blue-700 dark:text-blue-300 leading-relaxed">프로젝트 루트의 <strong>configs</strong> 폴더에 백업 config 파일들을 저장하세요.</p>
            <p className="m-0 mt-1 text-[13px] text-blue-700 dark:text-blue-300 leading-relaxed font-mono font-semibold">예: ./configs/router1-20260219.txt</p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h4 className="m-0 mb-4 text-base font-semibold text-gray-700 dark:text-gray-200">📁 폴더 구조</h4>
          <pre className="my-2 p-3 text-xs font-mono bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded overflow-x-auto leading-relaxed text-gray-700 dark:text-gray-300">
nokia-config-visualizer/
├── configs/                    ← 여기에 백업 파일 저장
│   ├── router1-20260219.txt
│   ├── router2-20260219.txt
│   └── pe-east-20260218.txt
├── docker-compose.yml
└── ...
          </pre>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h4 className="m-0 mb-4 text-base font-semibold text-gray-700 dark:text-gray-200">📝 파일명 형식</h4>
          <p className="m-0 text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed mb-2">다양한 파일명 형식을 지원합니다:</p>
          <ul className="m-0 pl-6 text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed [&_li]:mb-4 [&_li:last-child]:mb-0 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_code]:font-mono [&_code]:bg-gray-100 [&_code]:dark:bg-gray-900 [&_code]:border [&_code]:border-gray-200 [&_code]:dark:border-gray-700 [&_code]:rounded">
            <li><code>router1-20260219.txt</code> (하이픈 + YYYYMMDD)</li>
            <li><code>router1_20260219.txt</code> (언더스코어 + YYYYMMDD)</li>
            <li><code>router1 20260219.txt</code> (공백 + YYYYMMDD)</li>
            <li><code>router1-2026-02-19.txt</code> (하이픈 + YYYY-MM-DD)</li>
            <li><code>router1_2026_02_19.txt</code> (언더스코어 + YYYY_MM_DD)</li>
          </ul>
          <p className="m-0 mt-2 text-[13px] text-gray-500 dark:text-gray-400">
            💡 hostname과 날짜만 파싱되면 자동으로 인식됩니다.
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h4 className="m-0 mb-4 text-base font-semibold text-gray-700 dark:text-gray-200">✨ 자동 기능</h4>
          <ul className="m-0 pl-6 text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed [&_li]:mb-4 [&_li:last-child]:mb-0">
            <li>
              <CheckCircle size={14} style={{ display: 'inline', marginRight: '4px', color: '#4caf50' }} />
              <strong className="text-gray-700 dark:text-gray-200">실시간 감지:</strong> 파일 추가/변경/삭제 시 자동으로 목록 업데이트
            </li>
            <li>
              <CheckCircle size={14} style={{ display: 'inline', marginRight: '4px', color: '#4caf50' }} />
              <strong className="text-gray-700 dark:text-gray-200">최신 파일 필터링:</strong> hostname별 최신 날짜의 config만 표시
            </li>
            <li>
              <CheckCircle size={14} style={{ display: 'inline', marginRight: '4px', color: '#4caf50' }} />
              <strong className="text-gray-700 dark:text-gray-200">자동 재파싱:</strong> 현재 활성 파일이 변경되면 자동 재로드
            </li>
          </ul>
        </div>

        <div className="flex items-start gap-3 mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border-l-3 border-l-yellow-400 rounded text-[13px] text-yellow-700 dark:text-yellow-300 leading-relaxed">
          <Info size={16} className="shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold">폴더가 없나요?</strong> 터미널에서 다음 명령어를 실행하세요:
            <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-gray-700 dark:text-gray-300">
mkdir -p configs
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
