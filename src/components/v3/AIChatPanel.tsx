import { useState, useRef, useCallback } from 'react';
import Bot from 'lucide-react/dist/esm/icons/bot';
import X from 'lucide-react/dist/esm/icons/x';
import { sendChatMessage, type ChatResponse } from '../../services/chatApi';
import type { ConfigSummary } from '../../utils/configSummaryBuilder';
import type { DictionaryCompact } from '../../types/dictionary';
import { AliasBadge } from './AliasBadge';

interface AIChatPanelProps {
  configSummary: ConfigSummary | null;
  onAIResponse: (response: ChatResponse) => void;
  aiEnabled: boolean;
  onToggleAI: () => void;
  dictionary?: DictionaryCompact;
  filterType?: 'all' | 'epipe' | 'vpls' | 'vprn' | 'ies';
}

export function AIChatPanel({
  configSummary,
  onAIResponse,
  aiEnabled,
  onToggleAI,
  dictionary,
  filterType,
}: AIChatPanelProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ChatResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || !configSummary || loading) return;

    // 이전 요청 취소
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const result = await sendChatMessage(
        trimmed,
        configSummary,
        controller.signal,
        dictionary,
        filterType
      );
      setResponse(result);
      onAIResponse(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [query, configSummary, loading, onAIResponse, dictionary, filterType]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleClear = () => {
    setResponse(null);
    setError(null);
    setQuery('');
  };

  // confidence 배지 색상
  const confidenceClass = (level: string) => {
    switch (level) {
      case 'high': return 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'medium': return 'bg-orange-50 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'low': return 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default: return '';
    }
  };

  return (
    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
      <div className="flex gap-2 items-center">
        <button
          className={`flex items-center justify-center w-9 h-9 border rounded-md cursor-pointer transition-all duration-200 shrink-0 ${
            aiEnabled
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          onClick={onToggleAI}
          title={aiEnabled ? 'AI 검색 끄기' : 'AI 검색 켜기'}
        >
          <Bot size={18} />
        </button>

        {aiEnabled ? (
          <div className="flex-1 relative">
            <input
              type="text"
              className="w-full px-3 py-2 border border-blue-600 dark:border-blue-500 rounded-md text-sm outline-none transition-colors duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:bg-gray-100 dark:disabled:bg-gray-900 disabled:border-gray-300 dark:disabled:border-gray-600 disabled:text-gray-400"
              placeholder="AI에게 질문하세요..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading || !configSummary}
            />
          </div>
        ) : null}
      </div>

      {/* 로딩 */}
      {aiEnabled && loading && (
        <div className="flex items-center gap-2 pt-2.5 pb-1 text-[13px] text-gray-500 dark:text-gray-400">
          <div className="w-4 h-4 border-2 border-gray-200 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-ai-spin" />
          <span>AI가 서비스를 검색하고 있습니다...</span>
        </div>
      )}

      {/* AI 응답 */}
      {aiEnabled && response && !loading && (
        <div className="mt-2.5 px-3 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg text-[13px] leading-relaxed">
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
            <button className="bg-transparent border-none text-gray-400 dark:text-gray-500 cursor-pointer p-0.5 flex items-center rounded transition-all duration-200 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300" onClick={handleClear} title="초기화">
              <X size={14} />
            </button>
          </div>
          <div className="text-gray-700 dark:text-gray-300">{response.explanation}</div>

          {/* 매칭된 이름 사전 항목 */}
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
      {aiEnabled && error && !loading && (
        <div className="mt-2.5 px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-[13px] text-red-800 dark:text-red-300">{error}</div>
      )}
    </div>
  );
}
