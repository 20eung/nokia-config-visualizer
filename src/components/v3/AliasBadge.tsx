import { memo, useState, useRef, useEffect } from 'react';
import type { MatchedEntry } from '../../services/chatApi';

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
// rerender-memo: entry props 불변 시 리스트 내 다수 인스턴스 재렌더링 방지
export const AliasBadge = memo(function AliasBadge({ entry }: AliasBadgeProps) {
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
    <div className="relative inline-block">
      <button
        ref={badgeRef}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-transparent bg-gradient-to-br from-indigo-400 to-purple-600 text-white text-sm font-medium cursor-pointer transition-all duration-200 whitespace-nowrap hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-400/40 focus:outline-2 focus:outline-indigo-400 focus:outline-offset-2 active:translate-y-0"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onKeyDown={handleKeyDown}
        aria-label={`${entry.matchedAlias} (${entry.groupName})`}
        aria-describedby={showTooltip ? `tooltip-${entry.groupName}` : undefined}
        type="button"
      >
        <span className="text-base leading-none">🏷️</span>
        <span className="leading-none">{entry.matchedAlias}</span>
      </button>

      {showTooltip && (
        <div
          ref={tooltipRef}
          id={`tooltip-${entry.groupName}`}
          className="absolute top-[calc(100%+8px)] left-0 min-w-[280px] max-w-[400px] p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-[1000] animate-tooltip-fade-in max-sm:left-1/2 max-sm:-translate-x-1/2 max-sm:min-w-60 max-sm:max-w-[calc(100vw-32px)]"
          role="tooltip"
        >
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
            <strong className="text-base text-gray-700 dark:text-gray-200 font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">그룹:</strong> {entry.groupName}
          </div>

          <div className="mb-2.5 last:mb-0">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">매칭:</div>
            <div className="text-[15px] text-indigo-500 dark:text-indigo-400 font-semibold">{entry.matchedAlias}</div>
          </div>

          {entry.configKeywords.length > 0 && (
            <div className="mb-2.5 last:mb-0">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Config 키워드 ({entry.configKeywords.length}개):</div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {entry.configKeywords.map((keyword: string, idx: number) => (
                  <span
                    key={idx}
                    className={`inline-block px-2 py-0.5 rounded-md text-[13px] transition-all duration-150 ${
                      keyword === entry.matchedAlias
                        ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 font-semibold border border-yellow-400 dark:border-yellow-600'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
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
});
