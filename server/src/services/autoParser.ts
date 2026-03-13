/**
 * Auto Parser Service (v5.5.0)
 *
 * FileWatcher 이벤트를 수신하여 자동으로 Nokia config 파싱 및 ConfigStore 업데이트.
 * 서버 시작 시 전체 파일 스캔 + 파일 변경 시 자동 재파싱.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileWatcher, type FileWatcherEventData } from './fileWatcher';
import { configStore } from './configStore';
import { parseNokiaConfig } from './nokiaParser';
import type {
  ParsedConfigV3,
  ConfigSummary,
  DeviceSummary,
  ServiceSummary,
  SapSummary,
  InterfaceSummary,
  EpipeService,
  VPLSService,
  VPRNService,
  IESService,
} from '../types';

/**
 * QoS rate (kbps) → 읽기 쉬운 문자열
 */
function formatRate(rateKbps: number | undefined, isMax: boolean | undefined): string | undefined {
  if (isMax) return 'max';
  if (rateKbps === undefined || rateKbps === 0) return undefined;
  if (rateKbps >= 1_000_000) return `${rateKbps / 1_000_000}G`;
  if (rateKbps >= 1_000) return `${rateKbps / 1_000}M`;
  return `${rateKbps}K`;
}

/**
 * ParsedConfigV3 → ConfigSummary 변환
 * (Frontend configSummaryBuilder.ts 로직 이식)
 */
function buildConfigSummary(parsed: ParsedConfigV3): ConfigSummary {
  const services: ServiceSummary[] = [];

  for (const svc of parsed.services) {
    // adminState='down' 서비스 제외
    if (svc.adminState === 'down') continue;

    if (svc.serviceType === 'epipe') {
      const epipe = svc as EpipeService;
      services.push({
        serviceType: 'epipe',
        serviceId: epipe.serviceId,
        description: epipe.description,
        serviceName: epipe.serviceName,
        selectionKey: `epipe-${epipe.serviceId}`,
        saps: epipe.saps
          .filter(s => s.adminState !== 'down')
          .map(s => ({
            sapId: s.sapId,
            description: s.description,
            portId: s.portId,
            portDescription: s.portDescription,
            ingressRate: formatRate(s.ingressQos?.rate, s.ingressQos?.rateMax),
            egressRate: formatRate(s.egressQos?.rate, s.egressQos?.rateMax),
          })),
      });
    } else if (svc.serviceType === 'vpls') {
      const vpls = svc as VPLSService;
      services.push({
        serviceType: 'vpls',
        serviceId: vpls.serviceId,
        description: vpls.description,
        serviceName: vpls.serviceName,
        selectionKey: `vpls-${vpls.serviceId}`,
        saps: vpls.saps
          .filter(s => s.adminState !== 'down')
          .map(s => ({
            sapId: s.sapId,
            description: s.description,
            portId: s.portId,
            portDescription: s.portDescription,
            ingressRate: formatRate(s.ingressQos?.rate, s.ingressQos?.rateMax),
            egressRate: formatRate(s.egressQos?.rate, s.egressQos?.rateMax),
          })),
      });
    } else if (svc.serviceType === 'vprn') {
      const vprn = svc as VPRNService;
      services.push({
        serviceType: 'vprn',
        serviceId: vprn.serviceId,
        description: vprn.description,
        serviceName: vprn.serviceName,
        selectionKey: `vprn-${vprn.serviceId}`,
        interfaces: vprn.interfaces
          .filter(i => i.adminState !== 'down')
          .map(i => ({
            name: i.interfaceName,
            description: i.description,
            ipAddress: i.ipAddress,
            portId: i.portId,
            portDescription: i.portDescription,
            ingressRate: formatRate(i.ingressQosRate, i.ingressQosRateMax),
            egressRate: formatRate(i.egressQosRate, i.egressQosRateMax),
            vrrpBackupIp: i.vrrpBackupIp,
          })),
        bgpNeighbors: vprn.bgpNeighbors?.map(n =>
          n.autonomousSystem ? `${n.neighborIp} (AS${n.autonomousSystem})` : n.neighborIp
        ),
        ospfAreas: vprn.ospf?.areas?.map(a =>
          `Area ${a.areaId} (${a.interfaces.length} intf)`
        ),
        staticRoutes: vprn.staticRoutes?.map(r => `${r.prefix} → ${r.nextHop}`),
        autonomousSystem: vprn.autonomousSystem,
        routeDistinguisher: vprn.routeDistinguisher,
      });
    } else if (svc.serviceType === 'ies') {
      const ies = svc as IESService;
      services.push({
        serviceType: 'ies',
        serviceId: ies.serviceId,
        description: ies.description,
        serviceName: ies.serviceName,
        selectionKey: `ies-${parsed.hostname}`,
        interfaces: ies.interfaces
          .filter(i => i.adminState !== 'down')
          .map(i => ({
            name: i.interfaceName,
            description: i.description,
            ipAddress: i.ipAddress,
            portId: i.portId,
            portDescription: i.portDescription,
            ingressRate: formatRate(i.ingressQosRate, i.ingressQosRateMax),
            egressRate: formatRate(i.egressQosRate, i.egressQosRateMax),
            vrrpBackupIp: i.vrrpBackupIp,
          })),
        staticRoutes: ies.staticRoutes?.map(r => `${r.prefix} → ${r.nextHop}`),
      });
    }
  }

  const device: DeviceSummary = {
    hostname: parsed.hostname,
    systemIp: parsed.systemIp,
    services,
  };

  return { devices: [device] };
}

/**
 * 단일 파일 파싱 및 ConfigStore 업데이트
 */
async function parseAndStoreFile(filePath: string, filename: string): Promise<void> {
  try {
    console.log(`[AutoParser] Parsing file: ${filename}`);

    // 파일 읽기
    const content = await fs.readFile(filePath, 'utf-8');

    // Nokia config 파싱
    const parsed = parseNokiaConfig(content);

    // ConfigSummary 생성
    const configSummary = buildConfigSummary(parsed);

    // ConfigStore에 저장
    const serviceCount = configSummary.devices.reduce((sum, d) => sum + d.services.length, 0);

    configStore.set(filename, {
      filename,
      hostname: parsed.hostname,
      systemIp: parsed.systemIp,
      configSummary,
      serviceCount,
      uploadedAt: new Date(),
    });

    console.log(`[AutoParser] ✅ Parsed successfully: ${parsed.hostname} (${serviceCount} services)`);
  } catch (error) {
    console.error(`[AutoParser] ❌ Parsing failed: ${filename}`, error);
    // 파싱 실패해도 서버는 계속 실행 (다른 파일들은 정상 처리)
  }
}

/**
 * FileWatcher 이벤트 핸들러
 */
function handleFileAdded(event: FileWatcherEventData): void {
  const filePath = fileWatcher.getFilePath(event.filename);
  if (!filePath) {
    console.error(`[AutoParser] File path not found: ${event.filename}`);
    return;
  }

  // Nokia 파일만 처리 (vendor=nokia)
  if (event.vendor !== 'nokia') {
    console.log(`[AutoParser] Skipped non-Nokia file: ${event.filename} (vendor=${event.vendor})`);
    return;
  }

  parseAndStoreFile(filePath, event.filename);
}

function handleFileChanged(event: FileWatcherEventData): void {
  const filePath = fileWatcher.getFilePath(event.filename);
  if (!filePath) {
    console.error(`[AutoParser] File path not found: ${event.filename}`);
    return;
  }

  console.log(`[AutoParser] File changed, re-parsing: ${event.filename}`);
  parseAndStoreFile(filePath, event.filename);
}

function handleFileDeleted(event: FileWatcherEventData): void {
  console.log(`[AutoParser] File deleted, removing from store: ${event.filename}`);
  const deleted = configStore.delete(event.filename);
  if (deleted) {
    console.log(`[AutoParser] ✅ Removed from ConfigStore: ${event.filename}`);
  } else {
    console.warn(`[AutoParser] File not found in ConfigStore: ${event.filename}`);
  }
}

/**
 * 서버 시작 시 모든 파일 파싱
 */
async function parseAllFiles(): Promise<void> {
  console.log('[AutoParser] Scanning and parsing all config files...');

  try {
    const allFiles = await fileWatcher.getAllFiles();
    console.log(`[AutoParser] Found ${allFiles.length} files`);

    let successCount = 0;
    let failedCount = 0;

    // 순차 파싱 (병렬 처리는 나중에 최적화 가능)
    for (const filename of allFiles) {
      const filePath = fileWatcher.getFilePath(filename);
      if (!filePath) {
        console.warn(`[AutoParser] File path not found: ${filename}`);
        continue;
      }

      try {
        await parseAndStoreFile(filePath, filename);
        successCount++;
      } catch (error) {
        failedCount++;
      }
    }

    console.log(`[AutoParser] ✅ Parsing completed: ${successCount} success, ${failedCount} failed`);
  } catch (error) {
    console.error('[AutoParser] ❌ Failed to scan files:', error);
  }
}

/**
 * Auto Parser 시작 (FileWatcher 이벤트 리스너 등록 + 초기 파싱)
 * FileWatcher는 이미 index.ts에서 시작되어 있어야 함
 */
export function startAutoParser(): void {
  console.log('[AutoParser] Starting Auto Parser Service...');

  // FileWatcher 이벤트 리스너 등록
  fileWatcher.on('file-added', handleFileAdded);
  fileWatcher.on('file-changed', handleFileChanged);
  fileWatcher.on('file-deleted', handleFileDeleted);

  console.log('[AutoParser] Event listeners registered');

  // 초기 파싱 (FileWatcher 초기화 완료 후 3초 대기)
  setTimeout(() => {
    parseAllFiles();
  }, 3000);

  console.log('[AutoParser] ✅ Auto Parser Service started (initial parsing will begin in 3s)');
}

/**
 * Auto Parser 중지
 */
export function stopAutoParser(): void {
  console.log('[AutoParser] Stopping Auto Parser Service...');

  fileWatcher.off('file-added', handleFileAdded);
  fileWatcher.off('file-changed', handleFileChanged);
  fileWatcher.off('file-deleted', handleFileDeleted);

  fileWatcher.stopWatching();

  console.log('[AutoParser] ✅ Auto Parser Service stopped');
}
