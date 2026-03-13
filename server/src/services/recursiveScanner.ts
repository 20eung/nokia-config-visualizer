/**
 * Recursive Scanner Service
 *
 * 디렉토리 재귀 스캔 + Vendor 필터링
 *
 * @module recursiveScanner
 */

import fs from 'fs/promises';
import path from 'path';
import {
  detectVendor,
  readFirstLines,
  type VendorType,
  type VendorDetectionResult
} from './vendorDetector';

export interface ScanOptions {
  vendor: VendorType | 'all';    // 필터링할 Vendor (기본: 'all')
  maxDepth: number;               // 최대 깊이 (기본: 5)
  maxFileSize: number;            // 최대 파일 크기 bytes (기본: 10MB)
  excludePatterns?: string[];     // 제외할 파일명 패턴
}

export interface ScanResult {
  path: string;                   // 절대 경로
  relativePath: string;           // baseDir 기준 상대 경로
  vendor: VendorType;
  filename: string;
  size: number;
  mtime: Date;                    // 수정 시간
}

export interface ScanStats {
  totalFiles: number;
  nokiaFiles: number;
  aristaFiles: number;
  ciscoFiles: number;
  juniperFiles: number;
  unknownFiles: number;
  skippedFiles: number;           // 너무 크거나 에러
  scanDurationMs: number;
}

/**
 * 재귀적으로 config 파일 스캔
 *
 * @param baseDir 스캔할 기본 디렉토리
 * @param options 스캔 옵션
 * @returns 스캔 결과 및 통계
 */
export async function scanConfigsRecursive(
  baseDir: string,
  options: Partial<ScanOptions> = {}
): Promise<{ results: ScanResult[]; stats: ScanStats }> {
  const {
    vendor = 'all',
    maxDepth = 5,
    maxFileSize = 10 * 1024 * 1024,
    excludePatterns = ['.git', 'node_modules', '.DS_Store', '__MACOSX']
  } = options;

  const results: ScanResult[] = [];
  const stats: ScanStats = {
    totalFiles: 0,
    nokiaFiles: 0,
    aristaFiles: 0,
    ciscoFiles: 0,
    juniperFiles: 0,
    unknownFiles: 0,
    skippedFiles: 0,
    scanDurationMs: 0
  };

  const startTime = Date.now();

  /**
   * 재귀 스캔 내부 함수
   */
  async function scan(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) {
      console.warn(`[RecursiveScanner] Max depth ${maxDepth} reached: ${dir}`);
      return;
    }

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        // 제외 패턴 체크
        if (excludePatterns.some(pattern => entry.name.includes(pattern))) {
          continue;
        }

        // 숨김 파일/폴더 제외
        if (entry.name.startsWith('.')) {
          continue;
        }

        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);

        if (entry.isDirectory()) {
          // 재귀 탐색
          await scan(fullPath, depth + 1);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.txt')) {
          stats.totalFiles++;

          try {
            // 파일 크기 체크
            const fileStats = await fs.stat(fullPath);
            if (fileStats.size > maxFileSize) {
              console.warn(
                `[RecursiveScanner] File too large (${fileStats.size} bytes): ${fullPath}`
              );
              stats.skippedFiles++;
              continue;
            }

            // Vendor 검출
            const firstLines = await readFirstLines(fullPath, 10);
            const detection = detectVendor(firstLines);

            // 통계 업데이트
            switch (detection.vendor) {
              case 'nokia':
                stats.nokiaFiles++;
                break;
              case 'arista':
                stats.aristaFiles++;
                break;
              case 'cisco':
                stats.ciscoFiles++;
                break;
              case 'juniper':
                stats.juniperFiles++;
                break;
              case 'unknown':
                stats.unknownFiles++;
                break;
            }

            // Vendor 필터링
            if (vendor !== 'all' && detection.vendor !== vendor) {
              continue;
            }

            results.push({
              path: fullPath,
              relativePath,
              vendor: detection.vendor,
              filename: entry.name,
              size: fileStats.size,
              mtime: fileStats.mtime
            });
          } catch (error) {
            console.error(`[RecursiveScanner] Error processing ${fullPath}:`, error);
            stats.skippedFiles++;
          }
        }
      }
    } catch (error) {
      console.error(`[RecursiveScanner] Error scanning ${dir}:`, error);
      stats.skippedFiles++;
    }
  }

  // 스캔 시작
  await scan(baseDir, 0);

  stats.scanDurationMs = Date.now() - startTime;

  console.log(`[RecursiveScanner] Scan complete:
    Total: ${stats.totalFiles} files
    Nokia: ${stats.nokiaFiles}
    Arista: ${stats.aristaFiles}
    Cisco: ${stats.ciscoFiles}
    Juniper: ${stats.juniperFiles}
    Unknown: ${stats.unknownFiles}
    Skipped: ${stats.skippedFiles}
    Duration: ${stats.scanDurationMs}ms
  `);

  return { results, stats };
}

/**
 * 특정 디렉토리의 직계 자식 디렉토리 목록 조회
 *
 * @param baseDir 기본 디렉토리
 * @returns 서브디렉토리 목록
 */
export async function getSubdirectories(baseDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    const subdirs = entries
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
      .map(entry => path.join(baseDir, entry.name));

    return subdirs;
  } catch (error) {
    console.error(`[RecursiveScanner] Error reading subdirectories: ${baseDir}`, error);
    return [];
  }
}

/**
 * 파일 경로가 허용된 경로 내에 있는지 검증
 *
 * @param filePath 검증할 파일 경로
 * @param allowedPaths 허용된 경로 배열
 * @returns 허용 여부
 */
export function validatePath(filePath: string, allowedPaths: string[]): boolean {
  const resolvedPath = path.resolve(filePath);

  return allowedPaths.some(allowedPath => {
    const resolvedAllowed = path.resolve(allowedPath);
    return resolvedPath.startsWith(resolvedAllowed);
  });
}

/**
 * 스캔 결과를 Vendor별로 그룹화
 *
 * @param results 스캔 결과
 * @returns Vendor별 그룹화된 결과
 */
export function groupByVendor(
  results: ScanResult[]
): Map<VendorType, ScanResult[]> {
  const grouped = new Map<VendorType, ScanResult[]>();

  for (const result of results) {
    if (!grouped.has(result.vendor)) {
      grouped.set(result.vendor, []);
    }
    grouped.get(result.vendor)!.push(result);
  }

  return grouped;
}

/**
 * 스캔 결과를 디렉토리별로 그룹화
 *
 * @param results 스캔 결과
 * @param baseDir 기본 디렉토리
 * @returns 디렉토리별 그룹화된 결과
 */
export function groupByDirectory(
  results: ScanResult[],
  baseDir: string
): Map<string, ScanResult[]> {
  const grouped = new Map<string, ScanResult[]>();

  for (const result of results) {
    const dir = path.dirname(result.relativePath);
    const topLevelDir = dir.split(path.sep)[0] || '/';

    if (!grouped.has(topLevelDir)) {
      grouped.set(topLevelDir, []);
    }
    grouped.get(topLevelDir)!.push(result);
  }

  return grouped;
}
