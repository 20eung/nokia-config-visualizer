import type { ParsedConfigV3 } from './v3/parserV3';
import type {
  EpipeService,
  VPLSService,
  VPRNService,
  IESService,
} from '../types/services';

/** ConfigSummary 타입 (서버와 공유) */

interface SapSummary {
  sapId: string;
  description: string;
  portId: string;
  portDescription?: string;
  ingressRate?: string;
  egressRate?: string;
}

interface InterfaceSummary {
  name: string;
  description?: string;
  ipAddress?: string;
  portId?: string;
  portDescription?: string;
  ingressRate?: string;
  egressRate?: string;
  vrrpBackupIp?: string;
}

interface ServiceSummary {
  serviceType: 'epipe' | 'vpls' | 'vprn' | 'ies';
  serviceId: number;
  description: string;
  serviceName?: string;
  selectionKey: string;
  saps?: SapSummary[];
  interfaces?: InterfaceSummary[];
  bgpNeighbors?: string[];
  ospfAreas?: string[];
  staticRoutes?: string[];
  autonomousSystem?: number;
  routeDistinguisher?: string;
}

interface DeviceSummary {
  hostname: string;
  systemIp: string;
  services: ServiceSummary[];
}

export interface ConfigSummary {
  devices: DeviceSummary[];
}

/** QoS rate (kbps) → 읽기 쉬운 문자열 */
function formatRate(rateKbps: number | undefined, isMax: boolean | undefined): string | undefined {
  if (isMax) return 'max';
  if (rateKbps === undefined || rateKbps === 0) return undefined;
  if (rateKbps >= 1_000_000) return `${rateKbps / 1_000_000}G`;
  if (rateKbps >= 1_000) return `${rateKbps / 1_000}M`;
  return `${rateKbps}K`;
}

/** ParsedConfigV3[] → ConfigSummary 변환 */
export function buildConfigSummary(configs: ParsedConfigV3[]): ConfigSummary {
  const devices: DeviceSummary[] = configs.map(config => {
    const services: ServiceSummary[] = [];

    for (const svc of config.services) {
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
          selectionKey: `ies-${config.hostname}`,
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

    return {
      hostname: config.hostname,
      systemIp: config.systemIp,
      services,
    };
  });

  return { devices };
}
