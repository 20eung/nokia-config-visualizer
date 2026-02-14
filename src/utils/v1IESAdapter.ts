/**
 * V1 IES Adapter
 *
 * V3의 IES 데이터를 V1 형식으로 변환하고,
 * V1의 검증된 다이어그램 생성 로직을 재사용합니다.
 */

import type { NokiaDevice, NokiaInterface, NetworkTopology, HAPair } from '../types';
import type { IESService, L3Interface } from '../types/v2';
import {
    findPeerAndRoutes,
    generateSingleInterfaceDiagram,
    generateCombinedHaDiagram
} from './mermaidGenerator';

/**
 * 다이어그램 그룹 인터페이스
 */
interface DiagramGroup {
    id: string;
    haPair?: HAPair;
    items: Array<{
        device: NokiaDevice;
        intf: NokiaInterface;
        peerIp: string;
        relatedRoutes: string[];
    }>;
}

/**
 * V3 IESService를 V1 NokiaDevice로 변환
 *
 * @param iesService IES 서비스 데이터
 * @param hostname 호스트명
 * @param aggregatedStaticRoutes 동일 config 내 모든 IES 서비스의 통합 Static Routes (선택적)
 */
export function convertIESToV1Format(
    iesService: IESService,
    hostname: string,
    aggregatedStaticRoutes?: Array<{ prefix: string; nextHop: string }>
): NokiaDevice {
    const serviceRoutes = iesService.staticRoutes?.length || 0;
    const aggregatedCount = aggregatedStaticRoutes?.length || 0;

    console.log(`🔍 [IES Adapter] Converting IES for ${hostname}:`);
    console.log(`  - IES Service Routes: ${serviceRoutes}`);
    console.log(`  - Aggregated Routes: ${aggregatedCount}`);

    // aggregatedStaticRoutes가 제공되면 그것을 사용하고, 아니면 서비스 자체의 라우트 사용
    const staticRoutes = aggregatedStaticRoutes || iesService.staticRoutes?.map(r => ({
        prefix: r.prefix,
        nextHop: r.nextHop
    })) || [];

    console.log(`  - Final Routes Count: ${staticRoutes.length}`);

    return {
        hostname,
        ports: [],
        interfaces: iesService.interfaces.map(convertL3InterfaceToV1),
        staticRoutes
    };
}

/**
 * V3 L3Interface를 V1 NokiaInterface로 변환
 */
function convertL3InterfaceToV1(intf: L3Interface): NokiaInterface {
    return {
        name: intf.interfaceName,
        ipAddress: intf.ipAddress,
        portId: intf.portId,
        description: intf.description,
        portDescription: intf.portDescription,
        ingressQos: intf.ingressQosId || 'Default',
        egressQos: intf.egressQosId || 'Default',
        serviceType: 'IES 0',
        serviceDescription: 'Global Base Routing Table',
        vrrpVip: intf.vrrpBackupIp,
        vrrpPriority: intf.vrrpPriority
    };
}

/**
 * V1 스타일 IES 다이어그램 생성
 *
 * @param device V1 형식의 NokiaDevice
 * @param selectedInterfaceNames 선택된 인터페이스 이름 배열
 * @returns 개별 다이어그램 배열 (V1 형식과 동일)
 */
export function generateIESDiagramV1Style(
    device: NokiaDevice,
    selectedInterfaceNames: string[]
): Array<{ name: string; code: string; description: string }> {
    console.log(`🔍 [IES Adapter] Device: ${device.hostname}, Selected Interfaces:`, selectedInterfaceNames);

    // 선택된 인터페이스만 필터링
    const selectedInterfaces = device.interfaces.filter(
        intf => selectedInterfaceNames.includes(intf.name)
    );

    console.log(`🔍 [IES Adapter] Filtered Interfaces Count: ${selectedInterfaces.length}`);

    if (selectedInterfaces.length === 0) {
        return [{
            name: 'No Selection',
            code: 'graph LR\n    NoSelection["No interface selected"]',
            description: ''
        }];
    }

    // 각 인터페이스에 대해 Peer IP와 관련 라우트 찾기
    const items = selectedInterfaces.map(intf => {
        const peerData = findPeerAndRoutes(device, intf);
        console.log(`🔍 [IES Adapter] Interface ${intf.name}:`, {
            peerIp: peerData.peerIp,
            relatedRoutes: peerData.relatedRoutes,
            staticRoutesCount: device.staticRoutes.length
        });
        return {
            device,
            intf,
            ...peerData
        };
    });

    // HA 페어 감지
    const groups = detectHAGroups(items);
    console.log(`🔍 [IES Adapter] Detected ${groups.length} groups, HA pairs:`, groups.filter(g => g.haPair).length);
    const topology = createTopology(device);

    // 다이어그램 생성
    const result: Array<{ name: string; code: string; description: string }> = [];

    groups.forEach(group => {
        if (group.haPair) {
            // HA 페어: Combined Diagram
            // 호스트명들을 정렬하여 일관된 이름 생성
            group.items.sort((a, b) => a.device.hostname.localeCompare(b.device.hostname));
            const title = group.items.map(i => `${i.device.hostname}:${i.intf.name}`).join(' & ');

            result.push({
                name: `이중화: ${title}`,
                code: generateCombinedHaDiagram(group, topology),
                description: '이중화 토폴로지'
            });
        } else {
            // 단일 인터페이스: Single Diagram
            group.items.forEach(item => {
                result.push({
                    name: `${item.device.hostname} - ${item.intf.name}`,
                    code: generateSingleInterfaceDiagram(item.device, item.intf, topology),
                    description: item.intf.portDescription || item.intf.description || ''
                });
            });
        }
    });

    return result;
}

/**
 * HA 그룹 감지 (V1 로직 재사용)
 *
 * 공통 Customer Network(relatedRoutes)를 공유하는 인터페이스를 HA 페어로 그룹화
 */
function detectHAGroups(items: Array<{
    device: NokiaDevice;
    intf: NokiaInterface;
    peerIp: string;
    relatedRoutes: string[];
}>): DiagramGroup[] {
    const groups: Map<string, DiagramGroup> = new Map();
    const processed = new Set<number>();

    items.forEach((item1, idx1) => {
        if (processed.has(idx1)) return;

        let haPair: HAPair | undefined;
        const groupItems = [item1];

        // 다른 인터페이스와 비교하여 공통 라우트 찾기
        for (let idx2 = idx1 + 1; idx2 < items.length; idx2++) {
            if (processed.has(idx2)) continue;
            const item2 = items[idx2];

            // 공통 라우트 찾기
            const commonRoutes = item1.relatedRoutes.filter((r: string) =>
                item2.relatedRoutes.includes(r)
            );

            if (commonRoutes.length > 0) {
                // HA 페어 생성
                haPair = {
                    device1: item1.peerIp,
                    device2: item2.peerIp,
                    type: 'interface-based',
                    commonNetwork: commonRoutes[0]
                };
                groupItems.push(item2);
                processed.add(idx2);

                console.log(`✅ HA Pair detected: ${item1.intf.name} & ${item2.intf.name} via common network ${commonRoutes[0]}`);
            }
        }

        // 그룹 ID 생성
        const groupId = haPair
            ? `HA:${[haPair.device1, haPair.device2].sort().join('-')}`
            : `SINGLE:${idx1}`;

        groups.set(groupId, { id: groupId, haPair, items: groupItems });
        processed.add(idx1);
    });

    return Array.from(groups.values());
}

/**
 * Cross-Device IES HA 다이어그램 생성
 *
 * 여러 디바이스의 IES 인터페이스를 통합하여 크로스 디바이스 HA 페어를 감지하고
 * HA Combined 다이어그램 + Single 다이어그램을 생성합니다.
 *
 * @param deviceEntries 각 디바이스의 V1 변환 결과와 선택된 인터페이스 목록
 * @returns 다이어그램 배열 (HA Combined + Single)
 */
export function generateCrossDeviceIESDiagrams(
    deviceEntries: Array<{ v1Device: NokiaDevice; selectedInterfaceNames: string[] }>
): Array<{ name: string; code: string; description: string }> {
    console.log(`🔍 [IES Cross-Device] Processing ${deviceEntries.length} devices`);

    // 모든 디바이스의 선택된 인터페이스에 대해 Peer IP와 관련 라우트 수집
    const allItems: Array<{
        device: NokiaDevice;
        intf: NokiaInterface;
        peerIp: string;
        relatedRoutes: string[];
    }> = [];

    deviceEntries.forEach(({ v1Device, selectedInterfaceNames }) => {
        const selectedInterfaces = v1Device.interfaces.filter(
            intf => selectedInterfaceNames.includes(intf.name)
        );

        console.log(`🔍 [IES Cross-Device] Device ${v1Device.hostname}: ${selectedInterfaces.length} selected interfaces`);

        selectedInterfaces.forEach(intf => {
            const peerData = findPeerAndRoutes(v1Device, intf);
            console.log(`  - ${intf.name}: peer=${peerData.peerIp}, routes=${peerData.relatedRoutes.length}`);
            allItems.push({
                device: v1Device,
                intf,
                ...peerData
            });
        });
    });

    if (allItems.length === 0) {
        return [{
            name: 'No Selection',
            code: 'graph LR\n    NoSelection["No interface selected"]',
            description: ''
        }];
    }

    // 크로스 디바이스 HA 그룹 감지
    const groups = detectHAGroups(allItems);
    const haCount = groups.filter(g => g.haPair).length;
    console.log(`🔍 [IES Cross-Device] Detected ${groups.length} groups, ${haCount} HA pairs`);

    // 모든 디바이스를 포함하는 topology 생성
    const topology = createTopologyFromMultipleDevices(deviceEntries.map(e => e.v1Device));

    // 다이어그램 생성
    const result: Array<{ name: string; code: string; description: string }> = [];

    groups.forEach(group => {
        if (group.haPair) {
            group.items.sort((a, b) => a.device.hostname.localeCompare(b.device.hostname));
            const title = group.items.map(i => `${i.device.hostname}:${i.intf.name}`).join(' & ');

            result.push({
                name: `이중화: ${title}`,
                code: generateCombinedHaDiagram(group, topology),
                description: '이중화 토폴로지'
            });
        } else {
            group.items.forEach(item => {
                result.push({
                    name: `${item.device.hostname} - ${item.intf.name}`,
                    code: generateSingleInterfaceDiagram(item.device, item.intf, topology),
                    description: item.intf.portDescription || item.intf.description || ''
                });
            });
        }
    });

    return result;
}

/**
 * 임시 NetworkTopology 생성
 *
 * V1 함수들이 NetworkTopology 타입을 요구하므로, 단일 device로 구성된 topology 생성
 */
function createTopology(device: NokiaDevice): NetworkTopology {
    return {
        devices: [device],
        links: [],
        haPairs: []
    };
}

/**
 * 여러 디바이스를 포함하는 NetworkTopology 생성
 */
function createTopologyFromMultipleDevices(devices: NokiaDevice[]): NetworkTopology {
    return {
        devices,
        links: [],
        haPairs: []
    };
}
