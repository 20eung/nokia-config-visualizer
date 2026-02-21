/**
 * NCV AI Platform - Config Store (v4.8.0)
 *
 * 파싱된 Config 결과를 In-Memory로 저장하는 싱글톤 저장소.
 * Feature 1 (JSON API), Feature 2 (MCP), Feature 3 (RAG)의 공통 데이터 허브.
 */

import type { ConfigSummary, ServiceSummary } from '../types';

export interface StoredConfig {
  filename: string;
  hostname: string;
  systemIp: string;
  configSummary: ConfigSummary;
  serviceCount: number;
  uploadedAt: Date;
  indexedAt?: Date;
}

/** hostname + serviceType + serviceId 포함 flat service 항목 */
export interface FlatService extends ServiceSummary {
  hostname: string;
  systemIp: string;
}

class ConfigStore {
  private readonly store = new Map<string, StoredConfig>();

  /** Config 저장 또는 갱신 (filename을 키로 사용) */
  set(filename: string, config: StoredConfig): void {
    this.store.set(filename, config);
  }

  /** filename으로 조회 */
  get(filename: string): StoredConfig | undefined {
    return this.store.get(filename);
  }

  /** 전체 StoredConfig 목록 */
  getAll(): StoredConfig[] {
    return Array.from(this.store.values());
  }

  /** 모든 Config에서 flat service 목록 반환 */
  getAllServices(): FlatService[] {
    const result: FlatService[] = [];
    for (const stored of this.store.values()) {
      for (const device of stored.configSummary.devices) {
        for (const svc of device.services) {
          result.push({ ...svc, hostname: device.hostname, systemIp: stored.systemIp });
        }
      }
    }
    return result;
  }

  /** 키워드 검색 (description, serviceName, serviceId, hostname) */
  searchServices(query: string): FlatService[] {
    const lower = query.toLowerCase();
    return this.getAllServices().filter(svc =>
      (svc.description ?? '').toLowerCase().includes(lower)
      || (svc.serviceName ?? '').toLowerCase().includes(lower)
      || String(svc.serviceId).includes(query)
      || svc.serviceType.includes(lower)
      || svc.hostname.toLowerCase().includes(lower)
    );
  }

  /** RAG 인덱싱 완료 시간 기록 */
  setIndexedAt(filename: string, date: Date): void {
    const stored = this.store.get(filename);
    if (stored) {
      this.store.set(filename, { ...stored, indexedAt: date });
    }
  }

  /** 전체 삭제 */
  clear(): void {
    this.store.clear();
  }

  /** 통계 정보 */
  getStats(): { configCount: number; serviceCount: number; lastUpdated: Date | null } {
    const all = Array.from(this.store.values());
    return {
      configCount: this.store.size,
      serviceCount: this.getAllServices().length,
      lastUpdated: all.length > 0
        ? new Date(Math.max(...all.map(c => c.uploadedAt.getTime())))
        : null,
    };
  }
}

/** 싱글톤 인스턴스 */
export const configStore = new ConfigStore();
