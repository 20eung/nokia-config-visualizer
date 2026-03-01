/**
 * Dashboard 컴포넌트
 *
 * Config 로드 후 첫 화면으로 표시됩니다.
 * 서비스 타입별 통계 카드와 사이트별 카드 그리드를 표시합니다.
 */

import { useState, useMemo } from 'react';
import Server from 'lucide-react/dist/esm/icons/server';
import Shield from 'lucide-react/dist/esm/icons/shield';
import Search from 'lucide-react/dist/esm/icons/search';
import type { ParsedConfigV3 } from '../../utils/v3/parserV3';
import type { SiteGroup } from '../../types/site';
import { groupConfigsBySite } from '../../utils/siteGrouper';

interface DashboardProps {
  configs: ParsedConfigV3[];
  onSiteClick: (hostnames: string[]) => void;
}

export function Dashboard({ configs, onSiteClick }: DashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const siteGroups = useMemo(() => groupConfigsBySite(configs), [configs]);

  // 전체 통계
  const totalStats = useMemo(() => {
    const stats = { epipe: 0, vpls: 0, vprn: 0, ies: 0, sites: siteGroups.length, devices: 0 };
    for (const group of siteGroups) {
      stats.epipe += group.serviceCounts.epipe;
      stats.vpls += group.serviceCounts.vpls;
      stats.vprn += group.serviceCounts.vprn;
      stats.ies += group.serviceCounts.ies;
      stats.devices += group.hostnames.length;
    }
    return stats;
  }, [siteGroups]);

  // 검색 필터
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return siteGroups;
    const q = searchQuery.toLowerCase();
    return siteGroups.filter(g =>
      g.siteName.toLowerCase().includes(q) ||
      g.hostnames.some(h => h.toLowerCase().includes(q))
    );
  }, [siteGroups, searchQuery]);

  const statCards: Array<{ label: string; count: number; color: string; darkColor: string }> = [
    { label: 'Epipe', count: totalStats.epipe, color: 'bg-blue-500', darkColor: 'dark:bg-blue-600' },
    { label: 'VPLS', count: totalStats.vpls, color: 'bg-emerald-500', darkColor: 'dark:bg-emerald-600' },
    { label: 'VPRN', count: totalStats.vprn, color: 'bg-violet-500', darkColor: 'dark:bg-violet-600' },
    { label: 'IES', count: totalStats.ies, color: 'bg-amber-500', darkColor: 'dark:bg-amber-600' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto">
        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {statCards.map(card => (
            <div
              key={card.label}
              className={`rounded-xl p-4 text-white shadow-md flex flex-col items-center ${card.color} ${card.darkColor}`}
            >
              <span className="text-3xl font-bold">{card.count}</span>
              <span className="text-sm opacity-90 mt-1">{card.label}</span>
            </div>
          ))}
        </div>

        {/* 요약 정보 */}
        <div className="flex items-center gap-6 mb-6 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1.5">
            <Server size={16} />
            <span>{totalStats.devices} devices</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Shield size={16} />
            <span>{siteGroups.filter(g => g.isHAPair).length} HA pairs</span>
          </div>
        </div>

        {/* 검색 */}
        <div className="relative mb-6">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search sites or hostnames..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* 사이트 카드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map(group => (
            <SiteCard key={group.siteName} group={group} onClick={() => onSiteClick(group.hostnames)} />
          ))}
        </div>

        {filteredGroups.length === 0 && (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            No sites found matching "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  );
}

function SiteCard({ group, onClick }: { group: SiteGroup; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all cursor-pointer group"
    >
      {/* 사이트명 + HA 뱃지 */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {group.siteName}
        </h3>
        {group.isHAPair && (
          <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded-full">
            HA
          </span>
        )}
      </div>

      {/* Hostname 목록 */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {group.hostnames.map(h => (
          <span key={h} className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
            {h}
          </span>
        ))}
      </div>

      {/* 서비스 카운트 */}
      <div className="flex gap-2">
        {group.serviceCounts.epipe > 0 && (
          <span className="px-2 py-0.5 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
            Epipe: {group.serviceCounts.epipe}
          </span>
        )}
        {group.serviceCounts.vpls > 0 && (
          <span className="px-2 py-0.5 text-xs bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded">
            VPLS: {group.serviceCounts.vpls}
          </span>
        )}
        {group.serviceCounts.vprn > 0 && (
          <span className="px-2 py-0.5 text-xs bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded">
            VPRN: {group.serviceCounts.vprn}
          </span>
        )}
        {group.serviceCounts.ies > 0 && (
          <span className="px-2 py-0.5 text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded">
            IES: {group.serviceCounts.ies}
          </span>
        )}
      </div>
    </button>
  );
}
