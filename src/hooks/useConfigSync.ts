/**
 * NCV AI Platform - Config 동기화 훅 (v4.8.1)
 *
 * ParsedConfigV3[] 변경 시 백엔드 ConfigStore에 자동 동기화.
 * Demo 모드 또는 백엔드 미연결 시에는 조용히 무시.
 */

import { useState, useEffect, useRef } from 'react';
import { buildConfigSummary } from '../utils/configSummaryBuilder';
import type { ParsedConfigV3 } from '../utils/v3/parserV3';

const API_BASE = (import.meta.env['VITE_API_URL'] as string | undefined) ?? '';
const IS_DEMO = (import.meta.env['VITE_DEMO_MODE'] as string | undefined) === 'true';

/**
 * configs가 변경될 때마다 각 장비의 ConfigSummary를 백엔드에 동기화.
 * - 동일 hostname은 덮어씀 (최신 데이터 유지)
 * - 백엔드 미연결 시 조용히 무시 (선택 기능)
 */
export function useConfigSync(configs: ParsedConfigV3[]): void {
  const prevKeysRef = useRef<string>('');
  const [backendAvailable, setBackendAvailable] = useState(!IS_DEMO);

  // 백엔드 미연결 이벤트 수신 (WebSocket 실패 시 발생)
  useEffect(() => {
    const handleWsUnavailable = () => {
      setBackendAvailable(false);
    };
    window.addEventListener('config-ws-unavailable', handleWsUnavailable);
    return () => window.removeEventListener('config-ws-unavailable', handleWsUnavailable);
  }, []);

  useEffect(() => {
    if (!backendAvailable || configs.length === 0) return;

    // hostname 목록 기반으로 변경 감지
    const currentKey = configs.map(c => c.hostname).sort().join(',');
    if (currentKey === prevKeysRef.current) return;
    prevKeysRef.current = currentKey;

    const configSummary = buildConfigSummary(configs);

    for (let i = 0; i < configs.length; i++) {
      const device = configSummary.devices[i];
      if (!device) continue;

      const filename = `${device.hostname}.txt`;

      fetch(`${API_BASE}/api/ncv/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          hostname: device.hostname,
          systemIp: device.systemIp,
          configSummary: { devices: [device] },
        }),
      })
        .then(res => {
          if (!res.ok) {
            console.debug(`[useConfigSync] 백엔드 동기화 실패: ${device.hostname} (${res.status})`);
          }
        })
        .catch(() => {
          // 백엔드 미연결 시 조용히 무시
        });
    }
  }, [configs, backendAvailable]);
}
