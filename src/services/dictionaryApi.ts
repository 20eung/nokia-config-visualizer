import type { NameDictionary } from '../types/dictionary';

/** v4.4.0: Server response structure */
export interface DictionaryGenerateResponse {
  entries: {
    name: string;
    configKeywords: string[];
    searchAliases: string[];
  }[];
}

interface ApiError {
  error: string;
}

const TIMEOUT_MS = 60_000;

export async function generateDictionary(
  descriptions: string[],
  signal?: AbortSignal,
): Promise<DictionaryGenerateResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  if (signal) {
    signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const res = await fetch('/api/dictionary/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descriptions }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null) as ApiError | null;
      throw new Error(body?.error || `서버 오류 (${res.status})`);
    }

    return await res.json() as DictionaryGenerateResponse;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('요청이 취소되었거나 시간이 초과되었습니다.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function loadDictionaryFromServer(): Promise<NameDictionary | null> {
  try {
    const res = await fetch('/api/dictionary');
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return await res.json() as NameDictionary;
  } catch {
    return null;
  }
}

export async function saveDictionaryToServer(
  dictionary: NameDictionary,
): Promise<boolean> {
  try {
    const res = await fetch('/api/dictionary', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dictionary),
    });
    return res.ok;
  } catch {
    return false;
  }
}
