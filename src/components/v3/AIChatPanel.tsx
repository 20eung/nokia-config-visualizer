import X from 'lucide-react/dist/esm/icons/x';
import type { ChatResponse } from '../../services/chatApi';
import { AliasBadge } from './AliasBadge';

interface AIChatPanelProps {
  loading: boolean;
  response: ChatResponse | null;
  error: string | null;
  onClear: () => void;
}

export function AIChatPanel({ loading, response, error, onClear }: AIChatPanelProps) {
  if (!loading && !response && !error) return null;

  const confidenceClass = (level: string) => {
    switch (level) {
      case 'high': return 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'medium': return 'bg-orange-50 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'low': return 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default: return '';
    }
  };

  return (
    <div className="mt-2">
      {/* 로딩 */}
      {loading && (
        <div className="flex items-center gap-2 py-2 text-[13px] text-gray-500 dark:text-gray-400">
          <div className="w-4 h-4 border-2 border-gray-200 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-ai-spin" />
          <span>AI가 서비스를 검색하고 있습니다...</span>
        </div>
      )}

      {/* AI 응답 */}
      {response && !loading && (
        <div className="px-3 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg text-[13px] leading-relaxed">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex gap-1.5 items-center">
              <span className={`px-2 py-0.5 rounded-xl text-[11px] font-medium ${confidenceClass(response.confidence)}`}>
                {response.confidence === 'high' ? '높음'
                  : response.confidence === 'medium' ? '보통' : '낮음'}
              </span>
              <span className="px-2 py-0.5 rounded-xl text-[11px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                {response.selectedKeys.length}개 선택
              </span>
            </div>
            <button
              className="bg-transparent border-none text-gray-400 dark:text-gray-500 cursor-pointer p-0.5 flex items-center rounded transition-all duration-200 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
              onClick={onClear}
              title="초기화"
            >
              <X size={14} />
            </button>
          </div>
          <div className="text-gray-700 dark:text-gray-300 whitespace-pre-line">{response.explanation}</div>

          {response.matchedEntries && response.matchedEntries.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-indigo-100 dark:border-indigo-800">
              <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5">매칭된 엔티티:</div>
              <div className="flex flex-wrap gap-1.5">
                {response.matchedEntries.map((entry, idx) => (
                  <AliasBadge key={`${entry.groupName}-${idx}`} entry={entry} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 에러 */}
      {error && !loading && (
        <div className="px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-[13px] text-red-800 dark:text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
