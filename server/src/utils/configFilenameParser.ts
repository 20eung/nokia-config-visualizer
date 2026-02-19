/**
 * Config 파일명 파싱 유틸리티
 *
 * 다양한 파일명 형식을 지원합니다:
 * - router1-20260219.txt (하이픈 + YYYYMMDD)
 * - router1_20260219.txt (언더스코어 + YYYYMMDD)
 * - router1 20260219.txt (공백 + YYYYMMDD)
 * - router1-2026-02-19.txt (하이픈 + YYYY-MM-DD)
 * - router1_2026_02_19.txt (언더스코어 + YYYY_MM_DD)
 * - pe-router-east-20260219.txt (hostname에 구분자 포함)
 */

/**
 * 파싱된 Config 파일 정보
 */
export interface ParsedConfigFile {
  /** 호스트명 (소문자 통일) */
  hostname: string;
  /** 날짜 (YYYYMMDD 형식으로 정규화) */
  date: string;
  /** 원본 파일명 */
  originalFilename: string;
  /** 파싱 성공 여부 */
  isParsed: boolean;
}

/**
 * Config 파일 그룹 (hostname별)
 */
export interface ConfigFileGroup {
  /** 호스트명 */
  hostname: string;
  /** 최신 파일명 */
  latestFile: string;
  /** 최신 날짜 */
  latestDate: string;
  /** 전체 파일 목록 (날짜 순 정렬) */
  allFiles: ParsedConfigFile[];
}

/**
 * 날짜 문자열을 YYYYMMDD 형식으로 정규화
 */
function normalizeDate(dateStr: string): string {
  // 이미 YYYYMMDD 형식
  if (/^\d{8}$/.test(dateStr)) {
    return dateStr;
  }

  // YYYY-MM-DD 형식
  if (/^20\d{2}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr.replace(/-/g, '');
  }

  // YYYY_MM_DD 형식
  if (/^20\d{2}_\d{2}_\d{2}$/.test(dateStr)) {
    return dateStr.replace(/_/g, '');
  }

  // YYYY/MM/DD 형식
  if (/^20\d{2}\/\d{2}\/\d{2}$/.test(dateStr)) {
    return dateStr.replace(/\//g, '');
  }

  // 파싱 실패: 00000000 반환 (가장 오래된 것으로 간주)
  console.warn(`[ConfigParser] Failed to normalize date: ${dateStr}`);
  return '00000000';
}

/**
 * Config 파일명 파싱
 *
 * @param filename 파일명 (예: router1-20260219.txt)
 * @returns 파싱된 Config 파일 정보
 */
export function parseConfigFilename(filename: string): ParsedConfigFile {
  // .txt 확장자 체크
  if (!filename.toLowerCase().endsWith('.txt')) {
    return {
      hostname: filename,
      date: '00000000',
      originalFilename: filename,
      isParsed: false
    };
  }

  // 파싱 패턴들 (우선순위 순서)
  const patterns = [
    // 패턴 1: hostname[-_\s]YYYYMMDD.txt
    {
      regex: /^(.+?)[-_\s](20\d{6})\.txt$/i,
      dateIndex: 2
    },
    // 패턴 2: hostname[-_\s]YYYY-MM-DD.txt
    {
      regex: /^(.+?)[-_\s](20\d{2}-\d{2}-\d{2})\.txt$/i,
      dateIndex: 2
    },
    // 패턴 3: hostname[-_\s]YYYY_MM_DD.txt
    {
      regex: /^(.+?)[-_\s](20\d{2}_\d{2}_\d{2})\.txt$/i,
      dateIndex: 2
    },
    // 패턴 4: hostname[-_\s]YYYY/MM/DD.txt (일부 시스템)
    {
      regex: /^(.+?)[-_\s](20\d{2}\/\d{2}\/\d{2})\.txt$/i,
      dateIndex: 2
    }
  ];

  // 패턴 순서대로 시도
  for (const pattern of patterns) {
    const match = filename.match(pattern.regex);
    if (match) {
      const hostname = match[1].toLowerCase().trim();
      const dateStr = match[pattern.dateIndex];
      const normalizedDate = normalizeDate(dateStr);

      return {
        hostname,
        date: normalizedDate,
        originalFilename: filename,
        isParsed: true
      };
    }
  }

  // 파싱 실패: 전체 파일명을 hostname으로 간주
  const fallbackHostname = filename
    .replace(/\.txt$/i, '')
    .toLowerCase()
    .trim();

  console.warn(`[ConfigParser] Failed to parse filename: ${filename}, using fallback`);

  return {
    hostname: fallbackHostname,
    date: '00000000',
    originalFilename: filename,
    isParsed: false
  };
}

/**
 * 파일 목록을 hostname별로 그룹화하고 최신 파일만 필터링
 *
 * @param files 파일명 배열
 * @returns hostname별 그룹 정보
 */
export function groupConfigFiles(files: string[]): ConfigFileGroup[] {
  const grouped = new Map<string, ParsedConfigFile[]>();

  // 1. 파일명 파싱 및 그룹화
  for (const file of files) {
    const parsed = parseConfigFilename(file);

    if (!grouped.has(parsed.hostname)) {
      grouped.set(parsed.hostname, []);
    }

    grouped.get(parsed.hostname)!.push(parsed);
  }

  // 2. 각 그룹별로 날짜순 정렬 및 최신 파일 선택
  const result: ConfigFileGroup[] = [];

  for (const [hostname, parsedFiles] of grouped.entries()) {
    // 날짜 역순 정렬 (최신이 먼저)
    const sortedFiles = parsedFiles.sort((a, b) => {
      return b.date.localeCompare(a.date);
    });

    const latest = sortedFiles[0];

    result.push({
      hostname,
      latestFile: latest.originalFilename,
      latestDate: latest.date,
      allFiles: sortedFiles
    });
  }

  // hostname 알파벳 순 정렬
  return result.sort((a, b) => a.hostname.localeCompare(b.hostname));
}

/**
 * 파일 목록에서 최신 파일들만 추출
 *
 * @param files 파일명 배열
 * @returns 최신 파일명 배열 (hostname별 최신 파일만)
 */
export function getLatestConfigFiles(files: string[]): string[] {
  const groups = groupConfigFiles(files);
  return groups.map(group => group.latestFile);
}

/**
 * 특정 hostname의 전체 파일 목록 조회
 *
 * @param files 파일명 배열
 * @param hostname 조회할 hostname
 * @returns 해당 hostname의 파일 목록 (날짜 역순)
 */
export function getConfigFilesByHostname(
  files: string[],
  hostname: string
): ParsedConfigFile[] {
  const groups = groupConfigFiles(files);
  const group = groups.find(g => g.hostname === hostname.toLowerCase());

  return group ? group.allFiles : [];
}

/**
 * 파일명 파싱 테스트 (개발용)
 */
export function testConfigFilenameParser(): void {
  const testCases = [
    'router1-20260219.txt',
    'router1_20260219.txt',
    'router1 20260219.txt',
    'router1-2026-02-19.txt',
    'router1_2026_02_19.txt',
    'ROUTER1-20260217.txt',
    'pe-router-east-20260219.txt',
    'router2-2026-02-18.txt',
    'router2_2026_02_19.txt',
    'invalid-filename.txt'
  ];

  console.log('\n=== Config Filename Parser Test ===\n');

  for (const filename of testCases) {
    const parsed = parseConfigFilename(filename);
    console.log(`File: ${filename}`);
    console.log(`  → Hostname: ${parsed.hostname}`);
    console.log(`  → Date: ${parsed.date}`);
    console.log(`  → Parsed: ${parsed.isParsed ? '✅' : '❌'}`);
    console.log('');
  }

  console.log('=== Latest Files Test ===\n');
  const latest = getLatestConfigFiles(testCases);
  console.log('Latest files:', latest);
  console.log('');

  console.log('=== Grouped Files Test ===\n');
  const grouped = groupConfigFiles(testCases);
  for (const group of grouped) {
    console.log(`Hostname: ${group.hostname}`);
    console.log(`  Latest: ${group.latestFile} (${group.latestDate})`);
    console.log(`  Total: ${group.allFiles.length} files`);
  }
}
