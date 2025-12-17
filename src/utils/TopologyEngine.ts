import type { NokiaDevice, NetworkTopology } from '../types';
import { parseNokiaConfig } from './nokiaParser';

export const processConfigFiles = (filesContent: string[]): NetworkTopology => {
    const devices: NokiaDevice[] = [];

    for (const content of filesContent) {
        try {
            const device = parseNokiaConfig(content);
            if (device.hostname && device.hostname !== 'Unknown') {
                devices.push(device);
            } else {
                // Handle unknown hostname or empty config? 
                // For now, push it anyway to show errors or generic name
                devices.push(device);
            }
        } catch (e) {
            console.error("Failed to parse a config file", e);
        }
    }

    const topology: NetworkTopology = { devices, links: [], haPairs: [] };
    return analyzeTopology(topology);
};

export const analyzeTopology = (topology: NetworkTopology): NetworkTopology => {
    const nextHopGroups: Record<string, Set<string>> = {};

    console.log('🔍 [HA Detection] Starting topology analysis...');
    console.log('📊 [HA Detection] Total devices:', topology.devices.length);

    // 1. Collect all next-hops for each prefix
    for (const device of topology.devices) {
        console.log(`📱 [HA Detection] Device: ${device.hostname}, Static Routes: ${device.staticRoutes.length}`);

        for (const route of device.staticRoutes) {
            if (!nextHopGroups[route.prefix]) {
                nextHopGroups[route.prefix] = new Set();
            }
            nextHopGroups[route.prefix].add(route.nextHop);

            // Log first few routes for debugging
            if (device.staticRoutes.indexOf(route) < 3) {
                console.log(`  📍 Route: ${route.prefix} → ${route.nextHop}`);
            }
        }
    }

    console.log('🔗 [HA Detection] Next-hop groups:', Object.keys(nextHopGroups).length);

    // 2. Identify HA Pairs (same prefix, 2 different next-hops)
    // We treat the Next-Hop IPs themselves as the "Device Names" for the remote pair
    const detectedPairs: Record<string, import('../types').HAPair> = {};

    for (const [prefix, hops] of Object.entries(nextHopGroups)) {
        if (hops.size === 2) {
            const [hop1, hop2] = Array.from(hops).sort((a, b) => {
                const numA = ipToLong(a);
                const numB = ipToLong(b);
                return numA - numB;
            });
            const pairKey = `${hop1}-${hop2}`;

            if (!detectedPairs[pairKey]) {
                detectedPairs[pairKey] = {
                    device1: hop1,
                    device2: hop2,
                    type: 'static-route',
                    commonNetwork: prefix
                };
                console.log(`✅ [HA Detection] HA Pair found: ${prefix} → ${hop1} & ${hop2}`);
            }
        } else if (hops.size > 2) {
            console.log(`⚠️ [HA Detection] Multiple next-hops (${hops.size}) for ${prefix}:`, Array.from(hops));
        }
    }

    // 3. Identify VRRP-based HA Pairs (interfaces with same VRRP VIP)
    console.log('🔍 [HA Detection] Checking for VRRP-based HA pairs...');
    const vrrpGroups: Record<string, Array<{ ip: string; hostname: string; interfaceName: string; priority?: number }>> = {};

    for (const device of topology.devices) {
        for (const intf of device.interfaces) {
            if (intf.vrrpVip) {
                if (!vrrpGroups[intf.vrrpVip]) {
                    vrrpGroups[intf.vrrpVip] = [];
                }
                const intfIp = intf.ipAddress?.split('/')[0] || '';
                vrrpGroups[intf.vrrpVip].push({
                    ip: intfIp,
                    hostname: device.hostname,
                    interfaceName: intf.name,
                    priority: intf.vrrpPriority
                });
            }
        }
    }

    console.log(`🔗 [HA Detection] VRRP VIP groups found: ${Object.keys(vrrpGroups).length}`);

    // Add VRRP pairs to detectedPairs
    for (const [vip, interfaces] of Object.entries(vrrpGroups)) {
        if (interfaces.length === 2) {
            const [intf1, intf2] = interfaces.sort((a, b) => {
                const numA = ipToLong(a.ip);
                const numB = ipToLong(b.ip);
                return numA - numB;
            });

            const pairKey = `vrrp-${vip}`;
            if (!detectedPairs[pairKey]) {
                detectedPairs[pairKey] = {
                    device1: intf1.ip,
                    device2: intf2.ip,
                    type: 'vrrp',
                    commonNetwork: vip
                };
                console.log(`✅ [HA Detection] VRRP HA Pair found: VIP ${vip} → ${intf1.hostname}:${intf1.interfaceName} (${intf1.ip}, priority: ${intf1.priority || 'default'}) & ${intf2.hostname}:${intf2.interfaceName} (${intf2.ip}, priority: ${intf2.priority || 'default'})`);
            }
        } else if (interfaces.length > 2) {
            console.log(`⚠️ [HA Detection] Multiple VRRP interfaces (${interfaces.length}) for VIP ${vip}:`, interfaces.map(i => `${i.hostname}:${i.interfaceName} (${i.ip})`));
        }
    }

    topology.haPairs = Object.values(detectedPairs);
    console.log(`🎯 [HA Detection] Total HA Pairs detected: ${topology.haPairs.length} (Static Route: ${Object.values(detectedPairs).filter(p => p.type === 'static-route').length}, VRRP: ${Object.values(detectedPairs).filter(p => p.type === 'vrrp').length})`);

    if (topology.haPairs.length > 0) {
        console.log('📋 [HA Detection] HA Pairs:', topology.haPairs);
    }

    return topology;
};

// Helper to convert IP to number for sorting
function ipToLong(ip: string): number {
    const parts = ip.split('.');
    if (parts.length !== 4) return 0;
    return parts.reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
}
