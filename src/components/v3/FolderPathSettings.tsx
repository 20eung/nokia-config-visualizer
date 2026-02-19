/**
 * Config 폴더 안내 컴포넌트
 *
 * 자동 Config 로딩 기능 사용법을 안내합니다.
 */

import React from 'react';
import { Folder, Info, CheckCircle } from 'lucide-react';
import './FolderPathSettings.css';

export const FolderPathSettings: React.FC = () => {
  // Demo/Beta 환경 감지
  const isDemoEnvironment =
    window.location.hostname.includes('demo') ||
    window.location.hostname.includes('beta') ||
    window.location.hostname.includes('pages.dev') ||
    window.location.hostname.includes('cloudflare');

  return (
    <div className="folder-path-settings">
      <div className="settings-header">
        <Folder size={20} />
        <h3>자동 Config 로딩 사용법</h3>
      </div>

      <div className="settings-content">
        {isDemoEnvironment && (
          <div className="info-box" style={{ backgroundColor: '#fff3cd', borderColor: '#ffc107' }}>
            <Info size={16} style={{ color: '#856404' }} />
            <div className="info-content">
              <p style={{ color: '#856404', fontWeight: 600 }}>
                ⚠️ 이 기능은 로컬 Docker 환경에서만 사용 가능합니다.
              </p>
              <p style={{ color: '#856404', fontSize: '13px', marginTop: '4px' }}>
                Demo 사이트에서는 <strong>Upload Config</strong> 버튼을 사용하세요.
              </p>
            </div>
          </div>
        )}

        <div className="info-box">
          <Info size={16} />
          <div className="info-content">
            <p>프로젝트 루트의 <strong>configs</strong> 폴더에 백업 config 파일들을 저장하세요.</p>
            <p className="example">예: ./configs/router1-20260219.txt</p>
          </div>
        </div>

        <div className="settings-info">
          <h4>📁 폴더 구조</h4>
          <pre>
nokia-config-visualizer/
├── configs/                    ← 여기에 백업 파일 저장
│   ├── router1-20260219.txt
│   ├── router2-20260219.txt
│   └── pe-east-20260218.txt
├── docker-compose.yml
└── ...
          </pre>
        </div>

        <div className="settings-info">
          <h4>📝 파일명 형식</h4>
          <p>다양한 파일명 형식을 지원합니다:</p>
          <ul>
            <li><code>router1-20260219.txt</code> (하이픈 + YYYYMMDD)</li>
            <li><code>router1_20260219.txt</code> (언더스코어 + YYYYMMDD)</li>
            <li><code>router1 20260219.txt</code> (공백 + YYYYMMDD)</li>
            <li><code>router1-2026-02-19.txt</code> (하이픈 + YYYY-MM-DD)</li>
            <li><code>router1_2026_02_19.txt</code> (언더스코어 + YYYY_MM_DD)</li>
          </ul>
          <p style={{ fontSize: '13px', color: '#666', marginTop: '8px' }}>
            💡 hostname과 날짜만 파싱되면 자동으로 인식됩니다.
          </p>
        </div>

        <div className="settings-info">
          <h4>✨ 자동 기능</h4>
          <ul>
            <li>
              <CheckCircle size={14} style={{ display: 'inline', marginRight: '4px', color: '#4caf50' }} />
              <strong>실시간 감지:</strong> 파일 추가/변경/삭제 시 자동으로 목록 업데이트
            </li>
            <li>
              <CheckCircle size={14} style={{ display: 'inline', marginRight: '4px', color: '#4caf50' }} />
              <strong>최신 파일 필터링:</strong> hostname별 최신 날짜의 config만 표시
            </li>
            <li>
              <CheckCircle size={14} style={{ display: 'inline', marginRight: '4px', color: '#4caf50' }} />
              <strong>자동 재파싱:</strong> 현재 활성 파일이 변경되면 자동 재로드
            </li>
          </ul>
        </div>

        <div className="settings-tip">
          <Info size={16} />
          <div>
            <strong>폴더가 없나요?</strong> 터미널에서 다음 명령어를 실행하세요:
            <pre style={{ marginTop: '8px', padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
mkdir -p configs
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
