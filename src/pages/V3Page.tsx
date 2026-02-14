import { useState, useEffect } from 'react';
import { parseL2VPNConfig } from '../utils/v3/parserV3';
import { generateServiceDiagram } from '../utils/v3/mermaidGeneratorV3';
import type { ParsedConfigV3 } from '../utils/v3/parserV3';
import type { NokiaService, IESService, VPRNService, EpipeService } from '../types/v2';
import { ServiceListV3 } from '../components/v3/ServiceListV3';
import { ServiceDiagram } from '../components/v2/ServiceDiagram'; // Reuse for now or duplicate if needed
import { FileUpload } from '../components/FileUpload';
import { Menu } from 'lucide-react';
import { convertIESToV1Format, generateCrossDeviceIESDiagrams } from '../utils/v1IESAdapter';
import { convertVPRNToV1Format, generateVPRNDiagramV1Style } from '../utils/v1VPRNAdapter';
import './V2Page.css';

export function V3Page() {
    const [configs, setConfigs] = useState<ParsedConfigV3[]>([]);
    const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(320);
    const [isResizing, setIsResizing] = useState(false);

    useEffect(() => {
        const isDemoEnvironment = window.location.hostname.includes('demo') || window.location.hostname.includes('beta');

        if (isDemoEnvironment && configs.length === 0) {
            fetch('/docs/v2/pe-router-1-l2vpn.cfg')
                .then(r => r.text())
                .then(text => {
                    handleConfigLoaded([text]);
                    console.log('✅ Demo/Beta environment: Auto-loaded pe-router-1-l2vpn.cfg');
                })
                .catch(error => {
                    console.warn('⚠️ Demo/Beta environment: Could not auto-load sample config:', error);
                });
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleConfigLoaded = (contents: string[]) => {
        try {
            const parsedConfigs: ParsedConfigV3[] = [];
            contents.forEach(content => {
                const parsed = parseL2VPNConfig(content);
                if (parsed.hostname || parsed.services.length > 0) {
                    parsedConfigs.push(parsed);
                }
            });

            if (parsedConfigs.length > 0) {
                setConfigs(parsedConfigs);
                setSelectedServiceIds([]);
            } else {
                alert('No valid configuration found in the uploaded files.');
            }
        } catch (error) {
            console.error('Failed to parse L2 VPN config:', error);
            alert('Failed to parse L2 VPN configuration file.');
        }
    };

    const handleToggleService = (serviceKey: string) => {
        setSelectedServiceIds(prev =>
            prev.includes(serviceKey)
                ? prev.filter(key => key !== serviceKey)
                : [...prev, serviceKey]
        );
    };

    const handleSetSelected = (serviceKeys: string[]) => {
        setSelectedServiceIds(serviceKeys);
    };

    const startResizing = (mouseDownEvent: React.MouseEvent) => {
        mouseDownEvent.preventDefault();
        setIsResizing(true);
    };

    const stopResizing = () => {
        setIsResizing(false);
    };

    const resize = (mouseMoveEvent: MouseEvent) => {
        if (isResizing) {
            const newWidth = mouseMoveEvent.clientX;
            if (newWidth > 200 && newWidth < 800) {
                setSidebarWidth(newWidth);
            }
        }
    };

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
        } else {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        }

        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizing]);

    const allServices = configs.flatMap(c => c.services.map(s => ({ ...s, _hostname: c.hostname })));

    const selectedServices = ((allServices as any[]).flatMap(s => {
        if (s.serviceType === 'ies') {
            const hostname = (s as any)._hostname;

            if (selectedServiceIds.includes(`ies-${hostname}`)) {
                return [s];
            }

            const prefix = `ies___${hostname}___`;
            const selectedInterfaceKeys = selectedServiceIds.filter(id => id.startsWith(prefix));

            if (selectedInterfaceKeys.length > 0) {
                const selectedInterfaceNames = new Set(
                    selectedInterfaceKeys.map(key => key.replace(prefix, ''))
                );

                const iesService = s as IESService & { _hostname: string };
                const filteredService = {
                    ...iesService,
                    interfaces: iesService.interfaces.filter((intf: any) => selectedInterfaceNames.has(intf.interfaceName))
                };
                return [filteredService];
            }
            return [];
        }

        if (s.serviceType === 'vprn') {
            const hostname = (s as any)._hostname;
            const serviceId = s.serviceId;

            // Full service selection
            if (selectedServiceIds.includes(`vprn-${serviceId}`)) {
                return [s];
            }

            // Individual interface selection
            const prefix = `vprn___${serviceId}___${hostname}___`;
            const selectedInterfaceKeys = selectedServiceIds.filter(id => id.startsWith(prefix));

            if (selectedInterfaceKeys.length > 0) {
                const selectedInterfaceNames = new Set(
                    selectedInterfaceKeys.map(key => key.replace(prefix, ''))
                );

                const vprnService = s as VPRNService & { _hostname: string };
                const filteredService = {
                    ...vprnService,
                    interfaces: vprnService.interfaces.filter((intf: any) => selectedInterfaceNames.has(intf.interfaceName))
                };
                return [filteredService];
            }
            return [];
        }

        if (selectedServiceIds.includes(`${s.serviceType}-${s.serviceId}`)) {
            return [s];
        }
        return [];
    })) as (NokiaService & { _hostname: string })[];

    const remoteDeviceMap = new Map<string, string>();
    configs.forEach(c => {
        if (c.systemIp && c.hostname) {
            remoteDeviceMap.set(c.systemIp, c.hostname);
        }
    });

    const serviceGroups = selectedServices.reduce((acc, service) => {
        let key = `${service.serviceType}-${service.serviceId}`;

        if (service.serviceType === 'ies') {
            const hostname = (service as any)._hostname || 'Unknown';
            key = `ies-${hostname}`;
        }

        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(service);
        return acc;
    }, {} as Record<string, typeof selectedServices>);

    type DiagramItem = {
        service: NokiaService & { _hostname: string };
        diagram: string;
        hostname: string;
        diagramName?: string;
        description?: string;
    };

    // ==================================================
    // Cross-Device IES 다이어그램 생성
    // IES는 호스트별로 분리되어 있으므로, 모든 IES 그룹을 통합하여
    // 크로스 디바이스 HA 페어를 감지합니다.
    // ==================================================
    const iesGroupEntries = Object.entries(serviceGroups).filter(
        ([, group]) => group[0].serviceType === 'ies'
    );
    const nonIesGroupEntries = Object.entries(serviceGroups).filter(
        ([, group]) => group[0].serviceType !== 'ies'
    );

    const iesDiagrams: DiagramItem[] = (() => {
        if (iesGroupEntries.length === 0) return [];

        // 각 IES 호스트별로 V1 디바이스 변환 + 선택된 인터페이스 수집
        const deviceEntries: Array<{
            v1Device: import('../types').NokiaDevice;
            selectedInterfaceNames: string[];
            hostname: string;
            representativeService: NokiaService & { _hostname: string };
        }> = [];

        iesGroupEntries.forEach(([, group]) => {
            const iesService = group[0] as IESService & { _hostname: string };
            const hostname = iesService._hostname || 'Unknown';

            // 동일 config 내 모든 IES 서비스의 Static Routes 수집
            const parentConfig = configs.find(c => c.hostname === hostname);
            const aggregatedStaticRoutes: Array<{ prefix: string; nextHop: string }> = [];

            if (parentConfig) {
                parentConfig.services.forEach(service => {
                    if (service.serviceType === 'ies') {
                        const ies = service as IESService;
                        if (ies.staticRoutes) {
                            ies.staticRoutes.forEach(route => {
                                aggregatedStaticRoutes.push({
                                    prefix: route.prefix,
                                    nextHop: route.nextHop
                                });
                            });
                        }
                    }
                });
            }

            console.log(`📊 [V3Page] IES for ${hostname}: Aggregated ${aggregatedStaticRoutes.length} static routes from all IES services`);

            const v1Device = convertIESToV1Format(iesService, hostname, aggregatedStaticRoutes);

            // 선택된 인터페이스 파싱
            const fullHostKey = `ies-${hostname}`;
            const selectedInterfaceNames = selectedServiceIds.includes(fullHostKey)
                ? iesService.interfaces.map(i => i.interfaceName)
                : selectedServiceIds
                    .filter(id => id.startsWith(`ies___${hostname}___`))
                    .map(id => id.replace(`ies___${hostname}___`, ''));

            if (selectedInterfaceNames.length > 0) {
                deviceEntries.push({
                    v1Device,
                    selectedInterfaceNames,
                    hostname,
                    representativeService: iesService
                });
            }
        });

        if (deviceEntries.length === 0) return [];

        // 크로스 디바이스 HA 다이어그램 생성
        const crossDeviceDiagrams = generateCrossDeviceIESDiagrams(
            deviceEntries.map(e => ({ v1Device: e.v1Device, selectedInterfaceNames: e.selectedInterfaceNames }))
        );

        // 대표 서비스를 첫 번째 entry에서 가져옴
        const representativeService = deviceEntries[0].representativeService;

        return crossDeviceDiagrams.map(d => ({
            service: representativeService as NokiaService & { _hostname: string },
            diagram: d.code,
            hostname: deviceEntries.map(e => e.hostname).join(' + '),
            diagramName: d.name,
            description: d.description
        }));
    })();

    const nonIesDiagrams: DiagramItem[] = nonIesGroupEntries.flatMap<DiagramItem>(([, group]) => {
        const servicesWithContext = group.map(service => {
            const hostname = (service as any)._hostname || 'Unknown';
            const parentConfig = configs.find(c => c.hostname === hostname);
            return {
                service,
                hostname: hostname,
                sdps: parentConfig?.sdps || []
            };
        });

        const representativeService = servicesWithContext[0].service;

        if (representativeService.serviceType === 'vprn') {
            const vprnService = servicesWithContext[0].service as VPRNService;
            const hostname = servicesWithContext[0].hostname;

            // 동일 config 내 모든 IES + VPRN 서비스의 Static Routes 수집
            const parentConfig = configs.find(c => c.hostname === hostname);
            const aggregatedStaticRoutes: Array<{ prefix: string; nextHop: string }> = [];

            if (parentConfig) {
                parentConfig.services.forEach(service => {
                    if (service.serviceType === 'ies' || service.serviceType === 'vprn') {
                        const l3Service = service as IESService | VPRNService;
                        if (l3Service.staticRoutes) {
                            l3Service.staticRoutes.forEach(route => {
                                aggregatedStaticRoutes.push({
                                    prefix: route.prefix,
                                    nextHop: route.nextHop
                                });
                            });
                        }
                    }
                });
            }

            console.log(`📊 [V3Page] VPRN ${vprnService.serviceId} for ${hostname}: Aggregated ${aggregatedStaticRoutes.length} static routes from all IES/VPRN services`);

            // V3 → V1 변환 (aggregated routes 포함)
            const v1Device = convertVPRNToV1Format(vprnService, hostname, aggregatedStaticRoutes);

            // 선택된 인터페이스 파싱
            // 전체 서비스: "vprn-${serviceId}"
            // 개별 인터페이스: "vprn___${serviceId}___${hostname}___${interfaceName}"
            const fullServiceKey = `vprn-${vprnService.serviceId}`;
            const selectedInterfaceNames = selectedServiceIds.includes(fullServiceKey)
                ? vprnService.interfaces.map(i => i.interfaceName)
                : selectedServiceIds
                    .filter(id => id.startsWith(`vprn___${vprnService.serviceId}___${hostname}___`))
                    .map(id => id.replace(`vprn___${vprnService.serviceId}___${hostname}___`, ''));

            // V1 스타일 다이어그램 생성 (HA 감지 포함)
            const diagrams = generateVPRNDiagramV1Style(v1Device, selectedInterfaceNames);

            // 각 다이어그램을 개별 항목으로 반환
            return diagrams.map(d => ({
                service: representativeService,
                diagram: d.code,
                hostname: hostname,
                diagramName: d.name,
                description: d.description
            }));
        }

        // Epipe: Split by Spoke-SDP so different SDPs get separate diagrams
        if (representativeService.serviceType === 'epipe') {
            const sdpSubGroups = new Map<string, typeof servicesWithContext>();
            servicesWithContext.forEach(ctx => {
                const epipe = ctx.service as EpipeService;
                const sdpKey = epipe.spokeSdps && epipe.spokeSdps.length > 0
                    ? `${epipe.spokeSdps[0].sdpId}:${epipe.spokeSdps[0].vcId}`
                    : 'no-sdp';
                if (!sdpSubGroups.has(sdpKey)) sdpSubGroups.set(sdpKey, []);
                sdpSubGroups.get(sdpKey)!.push(ctx);
            });

            return Array.from(sdpSubGroups.values()).map(subGroup => ({
                service: representativeService,
                diagram: generateServiceDiagram(
                    subGroup.map(s => s.service),
                    subGroup.map(s => s.hostname),
                    subGroup[0].sdps,
                    remoteDeviceMap
                ),
                hostname: subGroup.map(s => s.hostname).join(' + '),
                diagramName: undefined,
                description: undefined
            }));
        }

        // Other service types (VPLS etc.)
        return [{
            service: representativeService,
            diagram: generateServiceDiagram(
                servicesWithContext.map(s => s.service),
                servicesWithContext.map(s => s.hostname),
                servicesWithContext[0].sdps,
                remoteDeviceMap
            ),
            hostname: servicesWithContext.map(s => s.hostname).join(' + '),
            diagramName: undefined,
            description: undefined
        }];
    });

    const diagrams: DiagramItem[] = [...iesDiagrams, ...nonIesDiagrams];

    return (
        <div className="v2-page">
            <header className="v2-header">
                <div className="header-left">
                    <button
                        className="icon-btn"
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                        style={{ marginRight: '16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                        <Menu size={20} />
                    </button>
                    <div className="logo">
                        <img src="/favicon.svg" alt="App Icon" className="app-icon" />
                        <h1>Nokia Config Visualizer v3.0.0 (Unified Visualizer)</h1>
                    </div>
                </div>

                <div className="header-right">
                    <FileUpload onConfigLoaded={handleConfigLoaded} variant="header" />
                </div>
            </header>

            <main className="v2-main" onMouseUp={stopResizing}>
                {configs.length > 0 ? (
                    <>
                        <aside
                            className={`v2-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}
                            style={{ width: isSidebarCollapsed ? 0 : sidebarWidth, flexShrink: 0, transition: isResizing ? 'none' : 'width 0.3s ease' }}
                        >
                            <ServiceListV3
                                services={allServices}
                                configs={configs}
                                selectedServiceIds={selectedServiceIds}
                                onToggleService={handleToggleService}
                                onSetSelected={handleSetSelected}
                            />
                        </aside>

                        {!isSidebarCollapsed && (
                            <div
                                className={`sidebar-resizer ${isResizing ? 'resizing' : ''}`}
                                onMouseDown={startResizing}
                            />
                        )}

                        <section className="v2-content">
                            {diagrams.length > 0 ? (
                                <div className="diagrams-container">
                                    {Object.entries(
                                        diagrams.reduce((acc, item) => {
                                            const key = `${item.service.serviceType}_${item.service.serviceId}`;
                                            if (!acc[key]) acc[key] = [];
                                            acc[key].push(item);
                                            return acc;
                                        }, {} as Record<string, typeof diagrams>)
                                    ).map(([groupKey, group]) => {
                                        const firstService = group[0].service;
                                        return (
                                            <div key={groupKey} className={`service-group ${group.length > 1 ? 'redundant-group' : ''}`}>
                                                {group.length > 1 && (
                                                    <div className="group-header">
                                                        <h3>🔗 Service Group (ID: {firstService.serviceId})</h3>
                                                    </div>
                                                )}
                                                <div className="group-items">
                                                    {group.map(({ service, diagram, hostname, diagramName }, idx) => (
                                                        <ServiceDiagram
                                                            key={`${hostname}-${service.serviceId}-${idx}`}
                                                            service={service as any}
                                                            diagram={diagram}
                                                            hostname={hostname}
                                                            diagramName={diagramName}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <p>Select a service from the sidebar to view its diagram.</p>
                                </div>
                            )}
                        </section>
                    </>
                ) : (
                    <div className="empty-state">
                        <h3>No Configuration Loaded</h3>
                        <p>Please upload a Nokia configuration file to start.</p>
                        <div className="upload-hint">
                            <FileUpload onConfigLoaded={handleConfigLoaded} variant="default" />
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
