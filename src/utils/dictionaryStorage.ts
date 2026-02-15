import type { ParsedConfigV3 } from './v3/parserV3';
import type { NameDictionary, DictionaryCompact } from '../types/dictionary';

/**
 * hostname + serviceId 기반으로 config fingerprint를 생성합니다.
 */
export function getConfigFingerprint(configs: ParsedConfigV3[]): string {
  const parts = configs.map(c => {
    const serviceIds = c.services
      .map(s => `${s.serviceType}:${s.serviceId}`)
      .sort()
      .join(',');
    return `${c.hostname}|${serviceIds}`;
  }).sort();

  // 간단한 해시
  let hash = 0;
  const str = parts.join('||');
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // 32bit integer
  }
  return `fp-${Math.abs(hash).toString(36)}`;
}

/**
 * 빈 dictionary를 생성합니다.
 */
export function createEmptyDictionary(fingerprint: string): NameDictionary {
  const now = new Date().toISOString();
  return {
    version: 1,
    createdAt: now,
    updatedAt: now,
    configFingerprint: fingerprint,
    entries: [],
  };
}

/**
 * NameDictionary → AI 전송용 DictionaryCompact 변환.
 * 엔트리가 없으면 undefined를 반환합니다.
 */
export function toDictionaryCompact(dict: NameDictionary | null): DictionaryCompact | undefined {
  if (!dict || dict.entries.length === 0) return undefined;

  return {
    entries: dict.entries.map(e => ({
      t: e.originalToken,
      s: e.shortName,
      l: e.longName,
      k: e.koreanName,
      a: e.aliases,
    })),
  };
}
