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

    // 1. Collect all next-hops for each prefix
    for (const device of topology.devices) {
        for (const route of device.staticRoutes) {
            if (!nextHopGroups[route.prefix]) {
                nextHopGroups[route.prefix] = new Set();
            }
            nextHopGroups[route.prefix].add(route.nextHop);
        }
    }

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
            }
        }
    }

    topology.haPairs = Object.values(detectedPairs);
    return topology;
};

// Helper to convert IP to number for sorting
function ipToLong(ip: string): number {
    const parts = ip.split('.');
    if (parts.length !== 4) return 0;
    return parts.reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
}
