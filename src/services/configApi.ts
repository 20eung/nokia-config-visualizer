/**
 * Config 파일 관련 API 클라이언트 (search-global-config)
 */
import { API_BASE } from '../utils/apiBase';

export interface FileSearchResult {
  filename: string;
  matches: number;
  snippets: string[];
  isLoaded: boolean;
}

interface FileSearchResponse {
  success: boolean;
  results: FileSearchResult[];
  watchPath: string;
  totalFiles: number;
  error?: string;
}

/**
 * watchFolder 내 전체 파일 텍스트 검색
 *
 * @param query 검색어 (3자 이상 필요, 미만 시 빈 배열 반환)
 * @param signal AbortSignal (debounce 취소용)
 */
export async function searchConfigFiles(
  query: string,
  signal?: AbortSignal,
): Promise<FileSearchResult[]> {
  const params = new URLSearchParams({ q: query });
  const res = await fetch(`${API_BASE}/api/config/search-files?${params}`, { signal });

  if (!res.ok) {
    // 400 (query too short) → 빈 배열 반환 (에러 표시 불필요)
    if (res.status === 400) return [];
    throw new Error(`파일 검색 실패 (${res.status})`);
  }

  const data: FileSearchResponse = await res.json();
  return data.success ? data.results : [];
}
