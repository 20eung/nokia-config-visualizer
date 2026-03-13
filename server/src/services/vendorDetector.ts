/**
 * Vendor Detector Service
 *
 * Config 파일 헤더를 분석하여 Nokia/Arista/Unknown 구분
 *
 * @module vendorDetector
 */

import fs from 'fs/promises';

export type VendorType = 'nokia' | 'arista' | 'cisco' | 'juniper' | 'unknown';

export interface VendorPattern {
  vendor: VendorType;
  patterns: RegExp[];
  priority: number; // 높을수록 우선순위 높음
}

export interface VendorDetectionResult {
  vendor: VendorType;
  confidence: number; // 0.0 ~ 1.0
  matchedPattern?: string;
}

/**
 * Vendor 키워드 정의 (netdevops-portal와 동일한 방식)
 * Simple keyword matching - 복잡한 regex 대신 단순 문자열 포함 여부로 판단
 */
const VENDOR_PATTERNS: VendorPattern[] = [
  {
    vendor: 'nokia',
    patterns: [
      /TiMOS/i,         // TiMOS (모든 버전)
      /ALCATEL SR/i,    // ALCATEL SR
      /Nokia/i          // Nokia
    ],
    priority: 10
  },
  {
    vendor: 'arista',
    patterns: [
      /EOS-/i,          // EOS-
      /DCS-/i,          // DCS-
      /Arista/i         // Arista
    ],
    priority: 9
  },
  {
    vendor: 'cisco',
    patterns: [
      /Cisco IOS/i,     // Cisco IOS
      /IOS-XE/i,        // IOS-XE
      /IOS-XR/i         // IOS-XR
    ],
    priority: 8
  },
  {
    vendor: 'juniper',
    patterns: [
      /JUNOS/i,         // JUNOS
      /Juniper/i        // Juniper
    ],
    priority: 7
  }
];

/**
 * Config 파일 헤더에서 Vendor 검출
 *
 * @param firstLines 파일 첫 10줄
 * @returns Vendor 검출 결과
 */
export function detectVendor(firstLines: string[]): VendorDetectionResult {
  const header = firstLines.slice(0, 10).join('\n');

  // 우선순위 순으로 정렬
  const sorted = [...VENDOR_PATTERNS].sort((a, b) => b.priority - a.priority);

  for (const { vendor, patterns } of sorted) {
    for (const pattern of patterns) {
      if (pattern.test(header)) {
        return {
          vendor,
          confidence: 1.0,
          matchedPattern: pattern.source
        };
      }
    }
  }

  console.warn('[VendorDetector] Unknown vendor in first 10 lines');
  return {
    vendor: 'unknown',
    confidence: 0.0
  };
}

/**
 * 파일 첫 N줄 읽기 (효율적)
 *
 * @param filePath 파일 경로
 * @param lineCount 읽을 줄 수 (기본: 10)
 * @returns 첫 N줄 배열
 */
export async function readFirstLines(
  filePath: string,
  lineCount: number = 10
): Promise<string[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content.split('\n').slice(0, lineCount);
  } catch (error) {
    console.error(`[VendorDetector] Error reading ${filePath}:`, error);
    return [];
  }
}

/**
 * 여러 파일의 Vendor를 동시에 검출 (병렬 처리)
 *
 * @param filePaths 파일 경로 배열
 * @returns Vendor 검출 결과 맵
 */
export async function detectVendorBatch(
  filePaths: string[]
): Promise<Map<string, VendorDetectionResult>> {
  const results = new Map<string, VendorDetectionResult>();

  const tasks = filePaths.map(async (filePath) => {
    const firstLines = await readFirstLines(filePath, 10);
    const detection = detectVendor(firstLines);
    return { filePath, detection };
  });

  const completed = await Promise.all(tasks);

  for (const { filePath, detection } of completed) {
    results.set(filePath, detection);
  }

  return results;
}

/**
 * Vendor 타입 검증
 *
 * @param vendor 검증할 vendor 문자열
 * @returns 유효한 VendorType인지 여부
 */
export function isValidVendor(vendor: string): vendor is VendorType {
  return ['nokia', 'arista', 'cisco', 'juniper', 'unknown'].includes(vendor);
}

/**
 * Vendor 표시 이름 반환
 *
 * @param vendor VendorType
 * @returns 표시용 이름
 */
export function getVendorDisplayName(vendor: VendorType): string {
  const displayNames: Record<VendorType, string> = {
    nokia: 'Nokia',
    arista: 'Arista',
    cisco: 'Cisco',
    juniper: 'Juniper',
    unknown: 'Unknown'
  };

  return displayNames[vendor] || 'Unknown';
}
