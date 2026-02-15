import type { ConfigSummary } from '../utils/configSummaryBuilder';

export interface ChatResponse {
  selectedKeys: string[];
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
  filterType?: 'all' | 'epipe' | 'vpls' | 'vprn' | 'ies';
}

interface ChatError {
  error: string;
}

const CHAT_TIMEOUT_MS = 60_000;

export async function sendChatMessage(
  message: string,
  configSummary: ConfigSummary,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);

  // 외부 signal과 내부 timeout을 모두 지원
  if (signal) {
    signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, configSummary }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null) as ChatError | null;
      throw new Error(body?.error || `서버 오류 (${res.status})`);
    }

    return await res.json() as ChatResponse;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('요청이 취소되었거나 시간이 초과되었습니다.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}
