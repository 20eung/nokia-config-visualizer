/**
 * Grafana Export 모달
 * v4.5.2 - InfluxDB 쿼리문 표시 및 복사 기능
 */

import { useState, useEffect } from 'react';
import X from 'lucide-react/dist/esm/icons/x';
import Copy from 'lucide-react/dist/esm/icons/copy';
import { generateGrafanaQueries } from '../../utils/grafana/queryGenerator';
import type { NokiaService } from '../../types/services';
import type { GrafanaQuery } from '../../types/grafana';

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-[90vw] max-w-[1200px] max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <h2 className="m-0 text-lg text-gray-800 dark:text-gray-100">Export to Grafana - v{__APP_VERSION__}</h2>
          <button className="flex items-center justify-center p-1.5 bg-transparent border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 transition-all" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {queries.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p>쿼리를 생성할 수 없습니다.</p>
              <p>
                서비스에 활성화된 인터페이스(adminState='up')가 없거나 portId가
                없습니다.
              </p>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="text-left px-2.5 py-2 bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-200 dark:border-gray-600 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap" style={{ width: '12%' }}>Hostname</th>
                  <th className="text-left px-2.5 py-2 bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-200 dark:border-gray-600 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap" style={{ width: '10%' }}>Interface</th>
                  <th className="text-left px-2.5 py-2 bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-200 dark:border-gray-600 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap" style={{ width: '10%' }}>Direction</th>
                  <th className="text-left px-2.5 py-2 bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-200 dark:border-gray-600 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap" style={{ width: '63%' }}>Query</th>
                  <th className="text-left px-2.5 py-2 bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-200 dark:border-gray-600 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap" style={{ width: '5%' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {queries.map((q, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-2.5 py-1.5 border-b border-gray-100 dark:border-gray-700 align-middle text-gray-800 dark:text-gray-200">{q.hostname}</td>
                    <td className="px-2.5 py-1.5 border-b border-gray-100 dark:border-gray-700 align-middle">
                      <code className="text-sm text-gray-700 dark:text-gray-300">{q.ifName}</code>
                    </td>
                    <td className="px-2.5 py-1.5 border-b border-gray-100 dark:border-gray-700 align-middle text-gray-800 dark:text-gray-200">
                      {q.direction === 'ingress' ? 'Ingress' : 'Egress'}
                    </td>
                    <td className="px-2.5 py-1.5 border-b border-gray-100 dark:border-gray-700 align-middle">
                      <pre className="font-mono text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all m-0 text-gray-700 dark:text-gray-300">
                        {q.queryText}
                      </pre>
                    </td>
                    <td className="px-2.5 py-1.5 border-b border-gray-100 dark:border-gray-700 align-middle">
                      <button
                        className={`flex items-center justify-center p-1 rounded cursor-pointer transition-all ${
                          copiedIndex === idx
                            ? 'bg-green-500 text-white'
                            : 'bg-transparent border-none text-gray-400 hover:bg-red-50 dark:hover:bg-gray-600 hover:text-red-500'
                        }`}
                        onClick={() => handleCopyQuery(q.queryText, idx)}
                        title="Copy Query"
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
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {queries.length > 0
              ? `${queries.length} queries generated`
              : 'No queries'}
          </div>
          {queries.length > 0 && (
            <button
              className={`flex items-center px-5 py-2 text-white rounded-md text-base font-medium cursor-pointer transition-colors ${
                copiedAll ? 'bg-green-500 hover:bg-green-600' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
              onClick={handleCopyAll}
            >
              <Copy size={16} className="mr-2" />
              {copiedAll ? 'Copied All!' : 'Copy All Queries'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
