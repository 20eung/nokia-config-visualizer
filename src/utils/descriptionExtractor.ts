import type { ParsedConfigV3 } from './v3/parserV3';
import type { DescriptionSource } from '../types/dictionary';
import type {
  EpipeService,
  VPLSService,
  VPRNService,
  IESService,
} from '../types/services';

/**
 * ParsedConfigV3[]에서 모든 description을 수집합니다.
 * 서비스, SAP, 인터페이스, 포트의 description을 포함합니다.
 */
export function extractAllDescriptions(configs: ParsedConfigV3[]): DescriptionSource[] {
  const sources: DescriptionSource[] = [];

  for (const config of configs) {
    for (const svc of config.services) {
      if (svc.adminState === 'down') continue;

      // 서비스 description
      if (svc.description) {
        sources.push({
          text: svc.description,
          sourceType: 'service',
          hostname: config.hostname,
          serviceId: svc.serviceId,
          serviceType: svc.serviceType,
        });
      }

      if (svc.serviceType === 'epipe') {
        const epipe = svc as EpipeService;
        for (const sap of epipe.saps) {
          if (sap.adminState === 'down') continue;
          if (sap.description) {
            sources.push({
              text: sap.description,
              sourceType: 'sap',
              hostname: config.hostname,
              serviceId: svc.serviceId,
              serviceType: 'epipe',
            });
          }
          if (sap.portDescription) {
            sources.push({
              text: sap.portDescription,
              sourceType: 'port',
              hostname: config.hostname,
              serviceId: svc.serviceId,
              serviceType: 'epipe',
            });
          }
        }
      } else if (svc.serviceType === 'vpls') {
        const vpls = svc as VPLSService;
        for (const sap of vpls.saps) {
          if (sap.adminState === 'down') continue;
          if (sap.description) {
            sources.push({
              text: sap.description,
              sourceType: 'sap',
              hostname: config.hostname,
              serviceId: svc.serviceId,
              serviceType: 'vpls',
            });
          }
          if (sap.portDescription) {
            sources.push({
              text: sap.portDescription,
              sourceType: 'port',
              hostname: config.hostname,
              serviceId: svc.serviceId,
              serviceType: 'vpls',
            });
          }
        }
      } else if (svc.serviceType === 'vprn') {
        const vprn = svc as VPRNService;
        for (const intf of vprn.interfaces) {
          if (intf.adminState === 'down') continue;
          if (intf.description) {
            sources.push({
              text: intf.description,
              sourceType: 'interface',
              hostname: config.hostname,
              serviceId: svc.serviceId,
              serviceType: 'vprn',
            });
          }
          if (intf.portDescription) {
            sources.push({
              text: intf.portDescription,
              sourceType: 'port',
              hostname: config.hostname,
              serviceId: svc.serviceId,
              serviceType: 'vprn',
            });
          }
        }
      } else if (svc.serviceType === 'ies') {
        const ies = svc as IESService;
        for (const intf of ies.interfaces) {
          if (intf.adminState === 'down') continue;
          if (intf.description) {
            sources.push({
              text: intf.description,
              sourceType: 'interface',
              hostname: config.hostname,
              serviceId: svc.serviceId,
              serviceType: 'ies',
            });
          }
          if (intf.portDescription) {
            sources.push({
              text: intf.portDescription,
              sourceType: 'port',
              hostname: config.hostname,
              serviceId: svc.serviceId,
              serviceType: 'ies',
            });
          }
        }
      }
    }
  }

  return sources;
}

/**
 * 중복 제거된 고유 description 텍스트 목록을 반환합니다.
 */
export function getUniqueDescriptions(configs: ParsedConfigV3[]): string[] {
  const sources = extractAllDescriptions(configs);
  const unique = new Set<string>();
  for (const src of sources) {
    const trimmed = src.text.trim();
    if (trimmed) {
      unique.add(trimmed);
    }
  }
  return Array.from(unique).sort();
}
