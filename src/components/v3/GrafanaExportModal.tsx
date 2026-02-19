/**
 * Grafana Export 모달
 * v4.5.2 - InfluxDB 쿼리문 표시 및 복사 기능
 */

import { useState, useEffect } from 'react';
import { X, Copy } from 'lucide-react';
import { generateGrafanaQueries } from '../../utils/grafana/queryGenerator';
import type { NokiaService } from '../../types/services';
import type { GrafanaQuery } from '../../types/grafana';
import './DictionaryEditor.css'; // 스타일 재사용

interface GrafanaExportModalProps {
  service: NokiaService & { _hostname?: string };
  hostname: string;
  onClose: () => void;
}

export function GrafanaExportModal({
  service,
  hostname,
  onClose,
}: GrafanaExportModalProps) {
  const [queries, setQueries] = useState<GrafanaQuery[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  useEffect(() => {
    try {
      const querySet = generateGrafanaQueries(service, hostname);
      setQueries(querySet.queries);
    } catch (error) {
      console.error('Failed to generate Grafana queries:', error);
      setQueries([]);
    }
  }, [service, hostname]);

  const handleCopyQuery = (queryText: string, index: number) => {
    navigator.clipboard.writeText(queryText);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCopyAll = () => {
    const allQueries = queries
      .map(
        (q) => `-- ${q.hostname} ${q.ifName} ${q.direction}\n${q.queryText}`
      )
      .join('\n\n');

    navigator.clipboard.writeText(allQueries);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div className="dict-overlay" onClick={onClose}>
      <div
        className="dict-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '1200px' }}
      >
        {/* Header */}
        <div className="dict-header">
          <h2>Export to Grafana - v{__APP_VERSION__}</h2>
          <button className="dict-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="dict-body">
          {queries.length === 0 ? (
            <div className="dict-empty">
              <p>쿼리를 생성할 수 없습니다.</p>
              <p>
                서비스에 활성화된 인터페이스(adminState='up')가 없거나 portId가
                없습니다.
              </p>
            </div>
          ) : (
            <table className="dict-table">
              <thead>
                <tr>
                  <th style={{ width: '12%' }}>Hostname</th>
                  <th style={{ width: '10%' }}>Interface</th>
                  <th style={{ width: '10%' }}>Direction</th>
                  <th style={{ width: '63%' }}>Query</th>
                  <th style={{ width: '5%' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {queries.map((q, idx) => (
                  <tr key={idx}>
                    <td>{q.hostname}</td>
                    <td>
                      <code style={{ fontSize: '13px' }}>{q.ifName}</code>
                    </td>
                    <td>
                      {q.direction === 'ingress' ? '⬇️ Ingress' : '⬆️ Egress'}
                    </td>
                    <td>
                      <pre
                        className="query-text"
                        style={{
                          fontFamily: "'Courier New', monospace",
                          fontSize: '12px',
                          backgroundColor: '#f5f5f5',
                          padding: '8px',
                          borderRadius: '4px',
                          overflowX: 'auto',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          margin: 0,
                        }}
                      >
                        {q.queryText}
                      </pre>
                    </td>
                    <td>
                      <button
                        className="dict-delete-btn"
                        onClick={() => handleCopyQuery(q.queryText, idx)}
                        title="Copy Query"
                        style={{
                          backgroundColor:
                            copiedIndex === idx ? '#4caf50' : undefined,
                          color: copiedIndex === idx ? 'white' : undefined,
                        }}
                      >
                        {copiedIndex === idx ? '✓' : <Copy size={14} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="dict-footer">
          <div className="dict-footer-left">
            <span>
              {queries.length > 0
                ? `${queries.length} queries generated`
                : 'No queries'}
            </span>
          </div>
          {queries.length > 0 && (
            <button
              className="dict-save-btn"
              onClick={handleCopyAll}
              style={{
                backgroundColor: copiedAll ? '#4caf50' : undefined,
              }}
            >
              <Copy size={16} style={{ marginRight: '8px' }} />
              {copiedAll ? 'Copied All!' : 'Copy All Queries'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
