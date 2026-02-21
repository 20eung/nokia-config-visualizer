import { useState, useRef, useCallback } from 'react';
import Bot from 'lucide-react/dist/esm/icons/bot';
import X from 'lucide-react/dist/esm/icons/x';
import { sendChatMessage, type ChatResponse } from '../../services/chatApi';
import type { ConfigSummary } from '../../utils/configSummaryBuilder';
import type { DictionaryCompact } from '../../types/dictionary';
import { AliasBadge } from './AliasBadge';
import './AIChatPanel.css';

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

  return (
    <div className="ai-chat-panel">
      <div className="ai-input-row">
        <button
          className={`ai-toggle-btn ${aiEnabled ? 'active' : ''}`}
          onClick={onToggleAI}
          title={aiEnabled ? 'AI 검색 끄기' : 'AI 검색 켜기'}
        >
          <Bot size={18} />
        </button>

        {aiEnabled ? (
          <div className="ai-input-wrapper">
            <input
              type="text"
              className="ai-input"
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
        <div className="ai-loading">
          <div className="ai-loading-spinner" />
          <span>AI가 서비스를 검색하고 있습니다...</span>
        </div>
      )}

      {/* AI 응답 */}
      {aiEnabled && response && !loading && (
        <div className="ai-response">
          <div className="ai-response-header">
            <div className="ai-response-badges">
              <span className={`ai-badge confidence-${response.confidence}`}>
                {response.confidence === 'high' ? '높음'
                  : response.confidence === 'medium' ? '보통' : '낮음'}
              </span>
              <span className="ai-badge count">
                {response.selectedKeys.length}개 선택
              </span>
            </div>
            <button className="ai-clear-btn" onClick={handleClear} title="초기화">
              <X size={14} />
            </button>
          </div>
          <div className="ai-response-text">{response.explanation}</div>

          {/* 매칭된 이름 사전 항목 */}
          {response.matchedEntries && response.matchedEntries.length > 0 && (
            <div className="ai-matched-entries">
              <div className="ai-matched-entries-label">매칭된 엔티티:</div>
              <div className="ai-matched-entries-list">
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
        <div className="ai-error">{error}</div>
      )}
    </div>
  );
}
