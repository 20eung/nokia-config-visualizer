# Design: Vendor Backup Status Display

## 1. Architecture Overview

### 1.1 System Context
```
┌─────────────────────────────────────────────────────────────┐
│                    Nokia Visualizer                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           V3Page (Entry Point)                      │   │
│  │  ┌───────────────────────────────────────────────┐  │   │
│  │  │  Dashboard Component                          │  │   │
│  │  │  ┌─────────────────────────────────────────┐  │  │   │
│  │  │  │ Service Type Stats (기존)              │  │  │   │
│  │  │  │ [Epipe] [VPLS] [VPRN] [IES]            │  │  │   │
│  │  │  └─────────────────────────────────────────┘  │  │   │
│  │  │  ┌─────────────────────────────────────────┐  │  │   │
│  │  │  │ Vendor Backup Stats (신규)             │  │  │   │
│  │  │  │ [Nokia] [Arista] [Cisco] [Unknown]     │  │  │   │
│  │  │  └─────────────────────────────────────────┘  │  │   │
│  │  │  ┌─────────────────────────────────────────┐  │  │   │
│  │  │  │ Summary Info + Search                   │  │  │   │
│  │  │  └─────────────────────────────────────────┘  │  │   │
│  │  │  ┌─────────────────────────────────────────┐  │  │   │
│  │  │  │ Site Cards Grid                         │  │  │   │
│  │  │  └─────────────────────────────────────────┘  │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Data Flow:                                                 │
│  Config Files → parserV3 → ParsedConfigV3[] → Dashboard    │
│                    ↓                                        │
│               vendorDetector (신규)                         │
│                    ↓                                        │
│          ParsedConfigV3 + vendor field                      │
│                    ↓                                        │
│            backupAggregator (신규)                          │
│                    ↓                                        │
│          VendorBackupStats { nokia: 12, ... }               │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Component Hierarchy
```
Dashboard.tsx (Modified)
  ├─ StatCards (Service Types - 기존)
  ├─ VendorBackupSection (신규)
  │   └─ VendorBackupCard[] (신규)
  ├─ SummaryInfo (기존)
  ├─ SearchBar (기존)
  └─ SiteCards[] (기존)
```

## 2. Data Model Design

### 2.1 Type Definitions

#### 2.1.1 Vendor Type (신규)
```typescript
// src/types/vendor.ts (신규 파일)

/**
 * 네트워크 장비 벤더 타입
 */
export type Vendor = 'Nokia' | 'Arista' | 'Cisco' | 'Juniper' | 'Unknown';

/**
 * 벤더 탐지 결과
 */
export interface VendorInfo {
  vendor: Vendor;
  /** 탐지된 키워드 (디버깅용) */
  detectedKeyword?: string;
  /** Config 파일의 첫 50줄 중 탐지 위치 */
  detectionLine?: number;
}

/**
 * 벤더별 백업 통계
 */
export interface VendorBackupStats {
  Nokia: number;
  Arista: number;
  Cisco: number;
  Juniper: number;
  Unknown: number;
}

/**
 * 벤더 카드 표시 정보
 */
export interface VendorCardConfig {
  vendor: Vendor;
  count: number;
  color: string;
  darkColor: string;
  icon?: string; // Lucide icon name (optional)
}
```

#### 2.1.2 Extended ParsedConfigV3 (수정)
```typescript
// src/utils/v3/parserV3.ts (수정)

export interface ParsedConfigV3 {
  hostname: string;
  systemIp: string;
  services: NokiaServiceV3[];
  sdps: SDP[];
  connections: any[];
  vendor?: Vendor; // 신규 필드 추가
}
```

### 2.2 Vendor Detection Logic

#### 2.2.1 Detection Rules
```typescript
// src/utils/vendorDetector.ts (신규 파일)

export interface VendorPattern {
  vendor: Vendor;
  patterns: RegExp[];
  priority: number; // 우선순위 (높을수록 우선)
}

const VENDOR_PATTERNS: VendorPattern[] = [
  {
    vendor: 'Nokia',
    patterns: [
      /TiMOS[-\s]/i,
      /Nokia\s+7\d{3}/i, // Nokia 7450, 7750, 7950
      /SROS/i,
    ],
    priority: 100,
  },
  {
    vendor: 'Arista',
    patterns: [
      /EOS[-\s]/i,
      /DCS-\d+/i, // DCS-7020SR, DCS-7280
      /Arista/i,
    ],
    priority: 100,
  },
  {
    vendor: 'Cisco',
    patterns: [
      /Cisco\s+IOS/i,
      /IOS-XE/i,
      /IOS-XR/i,
      /NX-OS/i,
    ],
    priority: 100,
  },
  {
    vendor: 'Juniper',
    patterns: [
      /JUNOS/i,
      /Juniper\s+Networks/i,
    ],
    priority: 100,
  },
];

/**
 * Config 파일 헤더에서 벤더 정보 탐지
 * @param configText - 전체 Config 텍스트
 * @returns VendorInfo
 */
export function detectVendor(configText: string): VendorInfo {
  // 성능을 위해 첫 50줄만 분석 (대부분 헤더에 벤더 정보 존재)
  const lines = configText.split('\n').slice(0, 50);
  const headerText = lines.join('\n');

  for (const { vendor, patterns, priority } of VENDOR_PATTERNS.sort((a, b) => b.priority - a.priority)) {
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const match = headerText.match(pattern);
      if (match) {
        return {
          vendor,
          detectedKeyword: match[0],
          detectionLine: lines.findIndex(line => pattern.test(line)),
        };
      }
    }
  }

  return { vendor: 'Unknown' };
}

/**
 * Hostname 패턴 기반 벤더 추론 (Fallback)
 * 예: "SKNet-PDC3F-MMR-7020SR-leaf-1" → "7020SR" → Arista
 */
export function inferVendorFromHostname(hostname: string): Vendor {
  if (/7\d{3}SR/i.test(hostname)) return 'Nokia'; // 7450SR, 7750SR
  if (/DCS-/i.test(hostname)) return 'Arista';
  if (/ASR|ISR|Nexus/i.test(hostname)) return 'Cisco';
  if (/MX|EX|QFX/i.test(hostname)) return 'Juniper';
  return 'Unknown';
}
```

### 2.3 Backup Service Detection Logic

#### 2.3.1 Backup Keywords
```typescript
// src/utils/backupDetector.ts (신규 파일)

/**
 * 백업 관련 키워드 목록 (대소문자 무시)
 */
const BACKUP_KEYWORDS = [
  'backup',
  'bkup',
  'failover',
  'standby',
  'redundancy',
  'ha', // High Availability
];

/**
 * 서비스가 백업 관련인지 확인
 * @param service - NokiaService
 * @returns boolean
 */
export function isBackupService(service: NokiaService): boolean {
  const desc = (service.description || '').toLowerCase();
  const name = (service.serviceName || '').toLowerCase();

  return BACKUP_KEYWORDS.some(keyword =>
    desc.includes(keyword) || name.includes(keyword)
  );
}

/**
 * VRF 이름이 백업 관련인지 확인 (Arista Config)
 * Arista는 "vrf instance SKENS_Backup_Dispersion" 형태
 */
export function isBackupVrf(vrfName: string): boolean {
  const normalized = vrfName.toLowerCase();
  return BACKUP_KEYWORDS.some(keyword => normalized.includes(keyword));
}
```

### 2.4 Aggregation Logic

#### 2.4.1 Vendor Backup Aggregator
```typescript
// src/utils/backupAggregator.ts (신규 파일)

import type { ParsedConfigV3 } from './v3/parserV3';
import type { VendorBackupStats } from '../types/vendor';
import { isBackupService } from './backupDetector';

/**
 * Config 배열에서 벤더별 백업 서비스 수량 집계
 * @param configs - ParsedConfigV3[]
 * @returns VendorBackupStats
 */
export function aggregateVendorBackupStats(configs: ParsedConfigV3[]): VendorBackupStats {
  const stats: VendorBackupStats = {
    Nokia: 0,
    Arista: 0,
    Cisco: 0,
    Juniper: 0,
    Unknown: 0,
  };

  for (const config of configs) {
    const vendor = config.vendor || 'Unknown';

    // 백업 관련 서비스 카운트
    const backupCount = config.services.filter(isBackupService).length;

    if (backupCount > 0) {
      stats[vendor] += backupCount;
    }
  }

  return stats;
}

/**
 * VendorBackupStats를 VendorCardConfig 배열로 변환
 * @param stats - VendorBackupStats
 * @returns VendorCardConfig[]
 */
export function statsToCardConfigs(stats: VendorBackupStats): VendorCardConfig[] {
  const configs: VendorCardConfig[] = [
    {
      vendor: 'Nokia',
      count: stats.Nokia,
      color: 'bg-cyan-500',
      darkColor: 'dark:bg-cyan-600',
    },
    {
      vendor: 'Arista',
      count: stats.Arista,
      color: 'bg-orange-500',
      darkColor: 'dark:bg-orange-600',
    },
    {
      vendor: 'Cisco',
      count: stats.Cisco,
      color: 'bg-blue-500',
      darkColor: 'dark:bg-blue-600',
    },
    {
      vendor: 'Juniper',
      count: stats.Juniper,
      color: 'bg-purple-500',
      darkColor: 'dark:bg-purple-600',
    },
    {
      vendor: 'Unknown',
      count: stats.Unknown,
      color: 'bg-gray-400',
      darkColor: 'dark:bg-gray-600',
    },
  ];

  // count가 0인 항목 제외
  return configs.filter(c => c.count > 0);
}
```

## 3. Component Design

### 3.1 VendorBackupSection Component

#### 3.1.1 Component Structure
```typescript
// src/components/v3/VendorBackupSection.tsx (신규 파일)

import { useMemo } from 'react';
import type { ParsedConfigV3 } from '../../utils/v3/parserV3';
import type { VendorCardConfig } from '../../types/vendor';
import { aggregateVendorBackupStats, statsToCardConfigs } from '../../utils/backupAggregator';

interface VendorBackupSectionProps {
  configs: ParsedConfigV3[];
  onVendorClick?: (vendor: string) => void;
}

export function VendorBackupSection({ configs, onVendorClick }: VendorBackupSectionProps) {
  const vendorCards = useMemo(() => {
    const stats = aggregateVendorBackupStats(configs);
    return statsToCardConfigs(stats);
  }, [configs]);

  // 백업 서비스가 하나도 없으면 섹션 전체를 숨김
  if (vendorCards.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      {/* 섹션 헤더 */}
      <h3 className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
        Backup Status by Vendor
      </h3>

      {/* 벤더 카드 그리드 */}
      <div
        className="gap-2 sm:gap-3"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(vendorCards.length, 4)}, minmax(0, 1fr))`,
        }}
      >
        {vendorCards.map(card => (
          <VendorBackupCard
            key={card.vendor}
            config={card}
            onClick={() => onVendorClick?.(card.vendor)}
          />
        ))}
      </div>
    </div>
  );
}
```

#### 3.1.2 VendorBackupCard Component
```typescript
// src/components/v3/VendorBackupCard.tsx (신규 파일)

import type { VendorCardConfig } from '../../types/vendor';

interface VendorBackupCardProps {
  config: VendorCardConfig;
  onClick?: () => void;
}

export function VendorBackupCard({ config, onClick }: VendorBackupCardProps) {
  return (
    <button
      onClick={onClick}
      className={`
        rounded-xl p-2 sm:p-3 text-white shadow-md
        flex flex-col items-center overflow-hidden
        transition-all
        hover:shadow-lg hover:scale-105
        ${config.color} ${config.darkColor}
      `}
    >
      <span className="text-lg sm:text-xl lg:text-2xl font-bold truncate">
        {config.count}
      </span>
      <span className="text-[10px] sm:text-xs opacity-90 mt-0.5 truncate">
        {config.vendor}
      </span>
    </button>
  );
}
```

### 3.2 Dashboard Component (수정)

#### 3.2.1 Props 확장
```typescript
// src/components/v3/Dashboard.tsx (수정)

interface DashboardProps {
  configs: ParsedConfigV3[];
  onSiteClick: (hostnames: string[]) => void;
  onVendorFilter?: (vendor: string) => void; // 신규 prop
}
```

#### 3.2.2 Vendor Filter State
```typescript
export function Dashboard({ configs, onSiteClick, onVendorFilter }: DashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null); // 신규 state

  // 벤더 필터링 로직
  const filteredByVendor = useMemo(() => {
    if (!selectedVendor) return configs;
    return configs.filter(c => c.vendor === selectedVendor);
  }, [configs, selectedVendor]);

  // 사이트 그룹핑 (벤더 필터 적용 후)
  const siteGroups = useMemo(() =>
    groupConfigsBySite(filteredByVendor),
    [filteredByVendor]
  );

  // 벤더 카드 클릭 핸들러
  const handleVendorClick = (vendor: string) => {
    setSelectedVendor(prev => prev === vendor ? null : vendor); // 토글
    onVendorFilter?.(vendor);
  };

  // ... (기존 코드)
}
```

#### 3.2.3 Layout Integration
```typescript
return (
  <div className="flex flex-col bg-gray-50 dark:bg-gray-900" style={{ flex: '1 1 0%', minWidth: 0, minHeight: 0, width: '100%' }}>
    {/* 상단 고정 영역 */}
    <div className="shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3">
      {/* Service Type 통계 카드 (기존) */}
      <div className="gap-2 sm:gap-3 mb-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        {statCards.map(card => (
          <div key={card.label} className={`rounded-xl p-2 sm:p-3 text-white shadow-md flex flex-col items-center overflow-hidden ${card.color} ${card.darkColor}`}>
            <span className="text-lg sm:text-xl lg:text-2xl font-bold truncate">{card.count}</span>
            <span className="text-[10px] sm:text-xs opacity-90 mt-0.5 truncate">{card.label}</span>
          </div>
        ))}
      </div>

      {/* 벤더별 백업 통계 (신규) */}
      <VendorBackupSection configs={configs} onVendorClick={handleVendorClick} />

      {/* 선택된 벤더 표시 (신규) */}
      {selectedVendor && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-300">
            Filtered by: <strong>{selectedVendor}</strong>
          </span>
          <button
            onClick={() => setSelectedVendor(null)}
            className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Clear
          </button>
        </div>
      )}

      {/* 요약 정보 (기존) */}
      <div className="flex flex-wrap items-center gap-4 sm:gap-6 mb-3 text-sm text-gray-500 dark:text-gray-400">
        {/* ... 기존 코드 ... */}
      </div>

      {/* 검색 (기존) */}
      <div className="relative">
        {/* ... 기존 코드 ... */}
      </div>
    </div>

    {/* 하단 스크롤 영역: 사이트 카드 그리드 (기존) */}
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 sm:px-6 pt-3 pb-6">
      {/* ... 기존 코드 ... */}
    </div>
  </div>
);
```

## 4. Integration Points

### 4.1 Parser Integration (parserV3.ts 수정)

#### 4.1.1 Vendor Detection 통합
```typescript
// src/utils/v3/parserV3.ts (수정)

import { detectVendor, inferVendorFromHostname } from '../vendorDetector';

export function parseConfigV3(
  configText: string,
  hostname?: string
): ParsedConfigV3 {
  // 기존 파싱 로직...

  // 벤더 정보 탐지 (신규)
  const vendorInfo = detectVendor(configText);
  let vendor = vendorInfo.vendor;

  // Fallback: hostname 패턴 기반 추론
  if (vendor === 'Unknown' && parsedHostname) {
    vendor = inferVendorFromHostname(parsedHostname);
  }

  return {
    hostname: parsedHostname,
    systemIp: parsedSystemIp,
    services: allServices,
    sdps: allSdps,
    connections: [],
    vendor, // 신규 필드
  };
}
```

### 4.2 V3Page Integration (선택 사항)

#### 4.2.1 Vendor Filter Callback
```typescript
// src/pages/V3Page.tsx (수정 - Optional)

function V3Page() {
  const [vendorFilter, setVendorFilter] = useState<string | null>(null);

  // 벤더 필터 핸들러
  const handleVendorFilter = (vendor: string) => {
    setVendorFilter(prev => prev === vendor ? null : vendor);
    console.log('Vendor filter applied:', vendor);
  };

  return (
    <Dashboard
      configs={configs}
      onSiteClick={handleSiteClick}
      onVendorFilter={handleVendorFilter}
    />
  );
}
```

## 5. File Structure

### 5.1 New Files
```
nokia-visualizer/
├── src/
│   ├── types/
│   │   └── vendor.ts                      (신규)
│   ├── utils/
│   │   ├── vendorDetector.ts              (신규)
│   │   ├── backupDetector.ts              (신규)
│   │   └── backupAggregator.ts            (신규)
│   └── components/
│       └── v3/
│           ├── VendorBackupSection.tsx    (신규)
│           └── VendorBackupCard.tsx       (신규)
└── docs/
    └── 02-design/
        └── features/
            └── vendor-backup-status.design.md (본 문서)
```

### 5.2 Modified Files
```
nokia-visualizer/
└── src/
    ├── utils/
    │   └── v3/
    │       └── parserV3.ts                (수정: vendor 필드 추가)
    └── components/
        └── v3/
            └── Dashboard.tsx              (수정: VendorBackupSection 통합)
```

## 6. API Design

### 6.1 Public APIs

#### 6.1.1 vendorDetector.ts
```typescript
/**
 * Config 텍스트에서 벤더 정보 탐지
 * @param configText - Config 파일 전체 텍스트
 * @returns VendorInfo (vendor, detectedKeyword, detectionLine)
 * @complexity O(n) where n = 첫 50줄
 */
export function detectVendor(configText: string): VendorInfo;

/**
 * Hostname 패턴 기반 벤더 추론 (Fallback)
 * @param hostname - 장비 hostname
 * @returns Vendor
 * @complexity O(1)
 */
export function inferVendorFromHostname(hostname: string): Vendor;
```

#### 6.1.2 backupDetector.ts
```typescript
/**
 * 서비스가 백업 관련인지 확인
 * @param service - NokiaService
 * @returns boolean
 * @complexity O(k) where k = BACKUP_KEYWORDS.length (상수)
 */
export function isBackupService(service: NokiaService): boolean;

/**
 * VRF 이름이 백업 관련인지 확인
 * @param vrfName - VRF 이름
 * @returns boolean
 */
export function isBackupVrf(vrfName: string): boolean;
```

#### 6.1.3 backupAggregator.ts
```typescript
/**
 * 벤더별 백업 서비스 수량 집계
 * @param configs - ParsedConfigV3[]
 * @returns VendorBackupStats
 * @complexity O(n * m) where n = configs.length, m = avg services per config
 */
export function aggregateVendorBackupStats(configs: ParsedConfigV3[]): VendorBackupStats;

/**
 * VendorBackupStats를 UI 카드 설정으로 변환
 * @param stats - VendorBackupStats
 * @returns VendorCardConfig[]
 * @complexity O(1) (고정 5개 벤더)
 */
export function statsToCardConfigs(stats: VendorBackupStats): VendorCardConfig[];
```

## 7. Performance Considerations

### 7.1 Optimization Strategies

#### 7.1.1 Parser Level
- **Vendor Detection**: Config 첫 50줄만 분석 (전체 파일 스캔 방지)
- **Regex Compilation**: 모듈 레벨 상수로 RegExp 선언 (재생성 방지)

#### 7.1.2 Component Level
- **useMemo**: `aggregateVendorBackupStats` 결과 메모이제이션
- **Lazy Rendering**: 백업 서비스가 없으면 섹션 전체 숨김 (DOM 노드 절약)

#### 7.1.3 Benchmarks (예상)
| Operation | Target | Actual (측정 필요) |
|-----------|--------|-------------------|
| detectVendor (1 config) | < 1ms | - |
| aggregateVendorBackupStats (100 configs) | < 50ms | - |
| Dashboard re-render | < 100ms | - |

### 7.2 Memory Usage
- **VendorBackupStats**: 5 vendors × 4 bytes = 20 bytes (negligible)
- **vendorInfo per config**: ~50 bytes × 100 configs = ~5KB (acceptable)

## 8. Error Handling

### 8.1 Error Scenarios

#### 8.1.1 Vendor Detection Failure
```typescript
// src/utils/vendorDetector.ts

export function detectVendor(configText: string): VendorInfo {
  try {
    // 탐지 로직...
  } catch (error) {
    console.warn('Vendor detection failed:', error);
    return { vendor: 'Unknown' };
  }
}
```

#### 8.1.2 Invalid Config Data
```typescript
// src/utils/backupAggregator.ts

export function aggregateVendorBackupStats(configs: ParsedConfigV3[]): VendorBackupStats {
  const stats: VendorBackupStats = {
    Nokia: 0, Arista: 0, Cisco: 0, Juniper: 0, Unknown: 0,
  };

  for (const config of configs) {
    try {
      const vendor = config.vendor || 'Unknown';
      const backupCount = config.services?.filter(isBackupService).length || 0;
      stats[vendor] += backupCount;
    } catch (error) {
      console.error('Failed to aggregate backup stats for config:', config.hostname, error);
      // Continue processing other configs
    }
  }

  return stats;
}
```

### 8.2 User Feedback
- **No Backup Services**: 섹션 숨김 (null 반환)
- **Unknown Vendor**: "Unknown" 카드로 표시
- **Filter Active**: 선택된 벤더 배지 + Clear 버튼 표시

## 9. Testing Strategy

### 9.1 Unit Tests

#### 9.1.1 vendorDetector.spec.ts
```typescript
describe('detectVendor', () => {
  it('should detect Nokia from TiMOS', () => {
    const config = '# TiMOS-B-23.3.R1 both/x86_64 Nokia 7750 SR';
    expect(detectVendor(config).vendor).toBe('Nokia');
  });

  it('should detect Arista from EOS', () => {
    const config = '! device: SKNet-leaf-1 (DCS-7020SR-32C2, EOS-4.27.6M)';
    expect(detectVendor(config).vendor).toBe('Arista');
  });

  it('should return Unknown for unrecognized config', () => {
    const config = 'random config text';
    expect(detectVendor(config).vendor).toBe('Unknown');
  });
});
```

#### 9.1.2 backupDetector.spec.ts
```typescript
describe('isBackupService', () => {
  it('should detect backup from description', () => {
    const service = {
      serviceId: 100,
      serviceType: 'vprn',
      description: 'SKENS_Backup_Dispersion',
      customerId: 1,
      adminState: 'up',
    };
    expect(isBackupService(service as any)).toBe(true);
  });

  it('should return false for non-backup service', () => {
    const service = {
      serviceId: 100,
      serviceType: 'vprn',
      description: 'Production_VPN',
      customerId: 1,
      adminState: 'up',
    };
    expect(isBackupService(service as any)).toBe(false);
  });
});
```

#### 9.1.3 backupAggregator.spec.ts
```typescript
describe('aggregateVendorBackupStats', () => {
  it('should aggregate backup services by vendor', () => {
    const configs: ParsedConfigV3[] = [
      {
        hostname: 'nokia-pe1',
        systemIp: '10.0.0.1',
        vendor: 'Nokia',
        services: [
          { serviceId: 100, description: 'Backup_VPN', /* ... */ },
          { serviceId: 101, description: 'Prod_VPN', /* ... */ },
        ],
        sdps: [],
        connections: [],
      },
      {
        hostname: 'arista-leaf1',
        systemIp: '10.0.0.2',
        vendor: 'Arista',
        services: [
          { serviceId: 200, description: 'Backup_Link', /* ... */ },
        ],
        sdps: [],
        connections: [],
      },
    ];

    const stats = aggregateVendorBackupStats(configs);
    expect(stats.Nokia).toBe(1);
    expect(stats.Arista).toBe(1);
    expect(stats.Cisco).toBe(0);
  });
});
```

### 9.2 Integration Tests

#### 9.2.1 Dashboard Rendering
```typescript
describe('Dashboard with VendorBackupSection', () => {
  it('should render vendor backup cards', () => {
    const configs = mockConfigs; // with vendor field
    render(<Dashboard configs={configs} onSiteClick={() => {}} />);

    expect(screen.getByText('Backup Status by Vendor')).toBeInTheDocument();
    expect(screen.getByText('Nokia')).toBeInTheDocument();
    expect(screen.getByText('Arista')).toBeInTheDocument();
  });

  it('should hide section when no backup services exist', () => {
    const configs = mockConfigsWithoutBackup;
    render(<Dashboard configs={configs} onSiteClick={() => {}} />);

    expect(screen.queryByText('Backup Status by Vendor')).not.toBeInTheDocument();
  });
});
```

#### 9.2.2 Vendor Filter
```typescript
describe('Vendor filtering', () => {
  it('should filter sites by selected vendor', () => {
    const configs = mockConfigs;
    render(<Dashboard configs={configs} onSiteClick={() => {}} />);

    fireEvent.click(screen.getByText('Nokia'));

    // Nokia 사이트만 표시되어야 함
    expect(screen.getByText('nokia-site-1')).toBeInTheDocument();
    expect(screen.queryByText('arista-site-1')).not.toBeInTheDocument();
  });

  it('should clear filter on Clear button click', () => {
    const configs = mockConfigs;
    render(<Dashboard configs={configs} onSiteClick={() => {}} />);

    fireEvent.click(screen.getByText('Nokia'));
    fireEvent.click(screen.getByText('Clear'));

    // 모든 사이트 다시 표시
    expect(screen.getByText('nokia-site-1')).toBeInTheDocument();
    expect(screen.getByText('arista-site-1')).toBeInTheDocument();
  });
});
```

### 9.3 E2E Tests (Optional)

#### 9.3.1 Playwright Test
```typescript
// tests/e2e/vendor-backup.spec.ts

test('Vendor backup workflow', async ({ page }) => {
  await page.goto('/');

  // Config 로드 대기
  await page.waitForSelector('[data-testid="dashboard"]');

  // 벤더 카드 확인
  await expect(page.locator('text=Backup Status by Vendor')).toBeVisible();
  await expect(page.locator('text=Nokia')).toBeVisible();

  // Nokia 카드 클릭
  await page.click('text=Nokia');

  // 필터 배지 확인
  await expect(page.locator('text=Filtered by: Nokia')).toBeVisible();

  // Clear 클릭
  await page.click('text=Clear');

  // 필터 해제 확인
  await expect(page.locator('text=Filtered by:')).not.toBeVisible();
});
```

## 10. Security Considerations

### 10.1 Input Validation
- **Config Text**: 탐지 로직은 첫 50줄만 분석 (DoS 공격 방지)
- **Vendor Name**: Enum 타입으로 제한 (SQLi 등 불가능)

### 10.2 XSS Prevention
- React의 기본 이스케이핑 적용 (`{config.vendor}` 등)
- User input은 검색 쿼리뿐 (이미 기존 Dashboard에서 처리 중)

## 11. Accessibility (a11y)

### 11.1 ARIA Labels
```typescript
<button
  onClick={onClick}
  className="..."
  aria-label={`Show ${config.vendor} backup services (${config.count})`}
>
  {/* ... */}
</button>
```

### 11.2 Keyboard Navigation
- 벤더 카드는 `<button>` 요소 사용 (Tab, Enter 지원)
- Clear 버튼도 `<button>` 사용

### 11.3 Color Contrast
- WCAG AA 기준 준수 (Tailwind 기본 색상 사용)
- Dark mode 별도 색상 제공

## 12. Implementation Checklist

### Phase 1: Core Logic (Day 1, 4-6시간)
- [x] `src/types/vendor.ts` 생성
- [ ] `src/utils/vendorDetector.ts` 구현
  - [ ] `detectVendor()` 함수
  - [ ] `inferVendorFromHostname()` 함수
  - [ ] Unit tests
- [ ] `src/utils/backupDetector.ts` 구현
  - [ ] `isBackupService()` 함수
  - [ ] Unit tests
- [ ] `src/utils/backupAggregator.ts` 구현
  - [ ] `aggregateVendorBackupStats()` 함수
  - [ ] `statsToCardConfigs()` 함수
  - [ ] Unit tests

### Phase 2: Parser Integration (Day 1, 2-3시간)
- [ ] `src/utils/v3/parserV3.ts` 수정
  - [ ] `ParsedConfigV3` 인터페이스에 `vendor` 필드 추가
  - [ ] `parseConfigV3()` 함수에서 `detectVendor()` 호출
  - [ ] Fallback 로직 추가 (`inferVendorFromHostname`)

### Phase 3: UI Components (Day 2, 4-6시간)
- [ ] `src/components/v3/VendorBackupCard.tsx` 생성
  - [ ] 카드 스타일링 (Tailwind)
  - [ ] 호버 효과
  - [ ] 클릭 이벤트 핸들러
- [ ] `src/components/v3/VendorBackupSection.tsx` 생성
  - [ ] 섹션 헤더
  - [ ] 카드 그리드 레이아웃
  - [ ] 빈 상태 처리 (null 반환)
- [ ] `src/components/v3/Dashboard.tsx` 수정
  - [ ] `VendorBackupSection` import 및 배치
  - [ ] `selectedVendor` state 추가
  - [ ] 필터 배지 + Clear 버튼
  - [ ] `filteredByVendor` useMemo 추가

### Phase 4: Testing & Polish (Day 2, 3-4시간)
- [ ] 실제 Config 파일로 통합 테스트
  - [ ] Nokia 7750 Config
  - [ ] Arista EOS Config
  - [ ] Unknown 벤더 Config
- [ ] 다크 모드 확인
- [ ] 반응형 레이아웃 검증 (모바일/태블릿)
- [ ] Performance 측정 (100 configs 로딩 시간)
- [ ] Documentation 업데이트 (README)

### Phase 5: Code Review & Deployment (Day 3, 2-3시간)
- [ ] PR 생성
- [ ] Code review
- [ ] Merge to main
- [ ] Production 배포

## 13. Rollback Plan

### 13.1 Feature Flag (Optional)
```typescript
// src/config.ts

export const FEATURE_FLAGS = {
  VENDOR_BACKUP_STATS: true, // false로 설정 시 기능 비활성화
};
```

### 13.2 Rollback Steps
1. `VENDOR_BACKUP_STATS` 플래그를 `false`로 설정
2. 또는 `VendorBackupSection` 컴포넌트를 Dashboard에서 제거
3. Git revert 후 재배포

## 14. Future Enhancements (Out of Scope)

### 14.1 Phase 2 (선택)
- [ ] 벤더별 상세 통계 모달 (클릭 시 팝업)
- [ ] 백업 서비스 건강 상태 표시 (admin/oper state 기반)
- [ ] CSV 내보내기 기능

### 14.2 Phase 3 (장기)
- [ ] 실시간 SNMP 조회 통합
- [ ] 벤더별 백업 정책 비교 분석
- [ ] 백업 실패 알림 기능 (Webhook)

---

**문서 버전**: 1.0
**작성일**: 2026-03-11
**작성자**: Claude (AI Assistant)
**검토 상태**: Draft
