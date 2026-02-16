import type { NameDictionary, DictionaryCompact } from '../types/dictionary';

/**
 * 빈 dictionary를 생성합니다 (v4.4.0).
 */
export function createEmptyDictionary(): NameDictionary {
  const now = new Date().toISOString();
  return {
    version: 4,  // v4.4.0
    createdAt: now,
    updatedAt: now,
    entries: [],
  };
}

/**
 * NameDictionary → AI 전송용 DictionaryCompact 변환 (v4.4.0)
 * 엔트리가 없으면 undefined를 반환합니다.
 */
export function toDictionaryCompact(dict: NameDictionary | null): DictionaryCompact | undefined {
  if (!dict || dict.entries.length === 0) return undefined;

  return {
    entries: dict.entries.map(e => ({
      n: e.name,
      k: e.configKeywords,
      a: e.searchAliases,
    })),
  };
}
