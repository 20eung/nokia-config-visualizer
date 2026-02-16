import { useState, useRef, useEffect } from 'react';
import type { MatchedEntry } from '../../services/chatApi';
import './AliasBadge.css';

interface AliasBadgeProps {
  entry: MatchedEntry;
}

/**
 * AliasBadge - 이름 사전 매칭 결과 표시 배지
 *
 * v4.4.0: 3-field structure (name, configKeywords, searchAliases)
 * Features:
 * - Hover tooltip with group name, config keywords, matched alias
 * - Keyboard accessible (Tab, Enter, Space, Escape)
 * - Matched alias highlighting
 */
export function AliasBadge({ entry }: AliasBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const badgeRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Tooltip 표시 핸들러
  const handleMouseEnter = () => setShowTooltip(true);
  const handleMouseLeave = () => setShowTooltip(false);

  // 키보드 접근성
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setShowTooltip(prev => !prev);
    } else if (e.key === 'Escape') {
      setShowTooltip(false);
    }
  };

  // 외부 클릭 시 tooltip 닫기
  useEffect(() => {
    if (!showTooltip) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node) &&
        badgeRef.current &&
        !badgeRef.current.contains(e.target as Node)
      ) {
        setShowTooltip(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTooltip]);

  return (
    <div className="alias-badge-container">
      <button
        ref={badgeRef}
        className="alias-badge"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onKeyDown={handleKeyDown}
        aria-label={`${entry.matchedAlias} (${entry.groupName})`}
        aria-describedby={showTooltip ? `tooltip-${entry.groupName}` : undefined}
        type="button"
      >
        <span className="alias-badge__icon">🏷️</span>
        <span className="alias-badge__text">{entry.matchedAlias}</span>
      </button>

      {showTooltip && (
        <div
          ref={tooltipRef}
          id={`tooltip-${entry.groupName}`}
          className="alias-tooltip"
          role="tooltip"
        >
          <div className="alias-tooltip__header">
            <strong>그룹:</strong> {entry.groupName}
          </div>

          <div className="alias-tooltip__section">
            <div className="alias-tooltip__label">매칭:</div>
            <div className="alias-tooltip__matched-alias">{entry.matchedAlias}</div>
          </div>

          {entry.configKeywords.length > 0 && (
            <div className="alias-tooltip__section">
              <div className="alias-tooltip__label">Config 키워드 ({entry.configKeywords.length}개):</div>
              <div className="alias-tooltip__aliases">
                {entry.configKeywords.map((keyword: string, idx: number) => (
                  <span
                    key={idx}
                    className={`alias-tooltip__alias ${
                      keyword === entry.matchedAlias ? 'alias-tooltip__alias--matched' : ''
                    }`}
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
