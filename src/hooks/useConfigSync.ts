/**
 * NCV AI Platform - Config 동기화 훅 (v4.8.0)
 *
 * ParsedConfigV3[] 변경 시 백엔드 ConfigStore에 자동 동기화.
 * Demo 모드 또는 백엔드 미연결 시에는 조용히 무시.
 */

import { useEffect, useRef } from 'react';
import { buildConfigSummary } from '../utils/configSummaryBuilder';
import type { ParsedConfigV3 } from '../utils/v3/parserV3';

const API_BASE = (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:3001';
const IS_DEMO = (import.meta.env['VITE_DEMO_MODE'] as string | undefined) === 'true';

/**
 * configs가 변경될 때마다 각 장비의 ConfigSummary를 백엔드에 동기화.
 * - 동일 hostname은 덮어씀 (최신 데이터 유지)
 * - 오류 시 조용히 무시 (선택 기능)
 */
export function useConfigSync(configs: ParsedConfigV3[]): void {
  // 이전 hostname Set을 추적하여 변경 없으면 API 호출 생략
  const prevKeysRef = useRef<string>('');

  useEffect(() => {
    if (IS_DEMO || configs.length === 0) return;

    // hostname 목록 기반으로 변경 감지 (JSON stringify로 순서도 비교)
    const currentKey = configs.map(c => c.hostname).sort().join(',');
    if (currentKey === prevKeysRef.current) return;
    prevKeysRef.current = currentKey;

    // 각 Config를 개별적으로 백엔드에 전송 (장비별 분리)
    const configSummary = buildConfigSummary(configs);

    for (let i = 0; i < configs.length; i++) {
      const raw = configs[i];
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

      // raw는 미사용이지만 의도적 보관 (향후 filename 추출 목적)
      void raw;
    }
  }, [configs]);
}
