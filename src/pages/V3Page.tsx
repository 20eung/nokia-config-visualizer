import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { parseL2VPNConfig } from '../utils/v3/parserV3';
import { generateServiceDiagram } from '../utils/v3/mermaidGeneratorV3';
import type { ParsedConfigV3 } from '../utils/v3/parserV3';
import type { NokiaService, IESService, VPRNService, EpipeService } from '../types/services';
import { ServiceListV3 } from '../components/v3/ServiceListV3';
import { ServiceDiagram } from '../components/v3/ServiceDiagram';
import { FileUpload } from '../components/FileUpload';
import PanelLeft from 'lucide-react/dist/esm/icons/panel-left';
import PanelLeftClose from 'lucide-react/dist/esm/icons/panel-left-close';
import FolderOpen from 'lucide-react/dist/esm/icons/folder-open';
import FolderIcon from 'lucide-react/dist/esm/icons/folder';
import X from 'lucide-react/dist/esm/icons/x';
import { convertIESToV1Format, generateCrossDeviceIESDiagrams } from '../utils/v1IESAdapter';
// === Auto Config Loading (auto-config-loading) ===
import { useConfigWebSocket } from '../hooks/useConfigWebSocket';
import { ConfigFileList } from '../components/v3/ConfigFileList';
import { FolderPathSettings } from '../components/v3/FolderPathSettings';
// === NCV AI Platform (ncv-ai-platform) ===
import { useConfigSync } from '../hooks/useConfigSync';
import './V3Page.css';

export function V3Page() {
    const [configs, setConfigs] = useState<ParsedConfigV3[]>([]);
    const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(320);
    const [isResizing, setIsResizing] = useState(false);

    // === Auto Config Loading (auto-config-loading) ===
    const {
        status: wsStatus,
        configFiles,
        fileGroups,
        activeFiles,
        toggleFile
    } = useConfigWebSocket();

    // === NCV AI Platform (ncv-ai-platform) ===
    // configs 변경 시 백엔드 ConfigStore에 자동 동기화
    useConfigSync(configs);

    const [showFolderSettings, setShowFolderSettings] = useState(false);
    const [showConfigFileList, setShowConfigFileList] = useState(false); // 기본값: 접힌 상태

    useEffect(() => {
        const isDemoEnvironment = window.location.hostname.includes('demo') || window.location.hostname.includes('beta');

        if (isDemoEnvironment && configs.length === 0) {
            Promise.all([
                fetch('/config1.txt').then(r => r.text()),
                fetch('/config2.txt').then(r => r.text())
            ])
                .then(texts => {
                    handleConfigLoaded(texts);
                    console.log('✅ Demo/Beta environment: Auto-loaded config1.txt & config2.txt');
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

    // === Auto Config Loading (auto-config-loading) ===
    // config-file-selected/removed 이벤트 리스닝 (파일 토글)
    useEffect(() => {
        const handleFileToggle = async (event: Event) => {
            const customEvent = event as CustomEvent;
            const { activeFiles: newActiveFiles } = customEvent.detail;

            try {
                console.log(`[V3Page] Loading active config files: ${newActiveFiles.length} files`);
                const contents = await Promise.all(
                    newActiveFiles.map(async (filename: string) => {
                        const res = await fetch(`http://localhost:3001/api/config/file/${filename}`);
                        return res.text();
                    })
                );

                handleConfigLoaded(contents);
                console.log(`[V3Page] Successfully loaded ${contents.length} config files`);
            } catch (error) {
                console.error('[V3Page] Failed to load config files:', error);
                alert('Config 파일 로드 실패');
            }
        };

        window.addEventListener('config-file-selected', handleFileToggle);
        window.addEventListener('config-file-removed', handleFileToggle);
        return () => {
            window.removeEventListener('config-file-selected', handleFileToggle);
            window.removeEventListener('config-file-removed', handleFileToggle);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // config-files-load-all 이벤트 리스닝 (모든 파일 로드)
    useEffect(() => {
        const handleLoadAll = async (event: Event) => {
            const customEvent = event as CustomEvent;
            const { filenames } = customEvent.detail;

            try {
                console.log(`[V3Page] Loading all config files: ${filenames.length} files`);
                const contents = await Promise.all(
                    filenames.map(async (filename: string) => {
                        const res = await fetch(`http://localhost:3001/api/config/file/${filename}`);
                        return res.text();
                    })
                );

                handleConfigLoaded(contents);
                console.log(`[V3Page] Successfully loaded ${contents.length} config files`);
            } catch (error) {
                console.error('[V3Page] Failed to load config files:', error);
                alert('Config 파일 로드 실패');
            }
        };

        window.addEventListener('config-files-load-all', handleLoadAll);
        return () => {
            window.removeEventListener('config-files-load-all', handleLoadAll);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // rerender-dependencies: useRef로 최신 activeFiles 추적
    // → 이벤트 리스너를 마운트 1회만 등록하면서 stale closure 방지
    const activeFilesRef = useRef(activeFiles);
    useEffect(() => {
        activeFilesRef.current = activeFiles;
    });

    // config-file-changed 이벤트 리스닝 (파일 변경 시 자동 재파싱)
    useEffect(() => {
        const handleFileChanged = async (event: Event) => {
            const customEvent = event as CustomEvent;
            const { filename } = customEvent.detail;

            console.log(`[V3Page] Auto-reloading changed file: ${filename}`);

            try {
                // ref에서 최신 activeFiles 읽기 — stale closure 없음
                const contents = await Promise.all(
                    activeFilesRef.current.map(async (fname: string) => {
                        const res = await fetch(`http://localhost:3001/api/config/file/${fname}`);
                        return res.text();
                    })
                );

                handleConfigLoaded(contents);
                alert(`파일이 변경되어 자동으로 다시 로드되었습니다: ${filename}`);
            } catch (error) {
                console.error('[V3Page] Failed to reload changed file:', error);
            }
        };

        window.addEventListener('config-file-changed', handleFileChanged);
        return () => {
            window.removeEventListener('config-file-changed', handleFileChanged);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // useCallback으로 참조 안정화 → ServiceListV3 불필요 리렌더 방지 (rerender-memo)
    const handleToggleService = useCallback((serviceKey: string) => {
        setSelectedServiceIds(prev =>
            prev.includes(serviceKey)
                ? prev.filter(key => key !== serviceKey)
                : [...prev, serviceKey]
        );
    }, []); // 의존성 없음 — 함수형 setState 덕분

    // functional updater 지원으로 확장 → stale closure 방지 (rerender-functional-setstate)
    const handleSetSelected = useCallback(
        (updater: string[] | ((prev: string[]) => string[])) => {
            setSelectedServiceIds(updater);
        },
        []
    );

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

    // configs가 변경될 때만 재계산 (rerender-memo)
    const allServices = useMemo(() =>
        configs.flatMap(c =>
            c.services.map(s => {
                const serviceWithHostname = { ...s, _hostname: c.hostname };

                // SAP와 Interface에도 _hostname 전파 (Grafana 쿼리문 생성용)
                if ('saps' in serviceWithHostname && serviceWithHostname.saps) {
                    serviceWithHostname.saps = serviceWithHostname.saps.map(sap => ({ ...sap, _hostname: c.hostname }));
                }
                if ('interfaces' in serviceWithHostname && serviceWithHostname.interfaces) {
                    serviceWithHostname.interfaces = serviceWithHostname.interfaces.map(intf => ({ ...intf, _hostname: c.hostname }));
                }

                return serviceWithHostname;
            })
        ),
        [configs]
    );

    // allServices 또는 selectedServiceIds가 변경될 때만 재계산 (rerender-memo)
    const selectedServices = useMemo(() =>
        ((allServices as any[]).flatMap(s => {
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
        })) as (NokiaService & { _hostname: string })[],
        [allServices, selectedServiceIds]
    );

    // configs가 변경될 때만 Map 재생성 (rerender-memo)
    const remoteDeviceMap = useMemo(() => {
        const map = new Map<string, string>();
        configs.forEach(c => {
            if (c.systemIp && c.hostname) {
                map.set(c.systemIp, c.hostname);
            }
        });
        return map;
    }, [configs]);

    // configs가 변경될 때만 Map 재생성 (js-index-maps: O(n²) → O(n+m))
    const configByHostname = useMemo(() =>
        new Map(configs.map(c => [c.hostname, c])),
        [configs]
    );

    const serviceGroups = useMemo(() => selectedServices.reduce((acc, service) => {
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
    }, {} as Record<string, typeof selectedServices>), [selectedServices]);

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
    const iesGroupEntries = useMemo(() =>
        Object.entries(serviceGroups).filter(([, group]) => group[0].serviceType === 'ies'),
        [serviceGroups]
    );
    const nonIesGroupEntries = useMemo(() =>
        Object.entries(serviceGroups).filter(([, group]) => group[0].serviceType !== 'ies'),
        [serviceGroups]
    );

    const iesDiagrams: DiagramItem[] = useMemo(() => {
        if (iesGroupEntries.length === 0) return [];

        // 각 IES 호스트별로 V1 디바이스 변환 + 선택된 인터페이스 수집
        const deviceEntries: Array<{
            v1Device: import('../types').NokiaDevice;
            selectedInterfaceNames: string[];
            hostname: string;
            representativeService: NokiaService & { _hostname: string };
        }> = [];

        iesGroupEntries.forEach(([, group]) => {
            const iesServices = group as (IESService & { _hostname: string })[];
            const hostname = iesServices[0]._hostname || 'Unknown';

            // 같은 호스트의 모든 IES 서비스 인터페이스를 병합 (hostname 정보 추가)
            const mergedInterfaces = iesServices.flatMap(s =>
                s.interfaces.map(intf => ({ ...intf, _hostname: s._hostname }))
            );
            const mergedService: IESService & { _hostname: string } = {
                ...iesServices[0],
                interfaces: mergedInterfaces,
            };

            // 동일 config 내 모든 IES 서비스의 Static Routes 수집 (O(1) Map 조회)
            const parentConfig = configByHostname.get(hostname);
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

            console.log(`📊 [V3Page] IES for ${hostname}: Aggregated ${aggregatedStaticRoutes.length} static routes, ${mergedInterfaces.length} merged interfaces from ${iesServices.length} IES services`);

            const v1Device = convertIESToV1Format(mergedService, hostname, aggregatedStaticRoutes);

            // 선택된 인터페이스 파싱
            const fullHostKey = `ies-${hostname}`;
            const selectedInterfaceNames = selectedServiceIds.includes(fullHostKey)
                ? mergedInterfaces.map(i => i.interfaceName)
                : selectedServiceIds
                    .filter(id => id.startsWith(`ies___${hostname}___`))
                    .map(id => id.replace(`ies___${hostname}___`, ''));

            if (selectedInterfaceNames.length > 0) {
                deviceEntries.push({
                    v1Device,
                    selectedInterfaceNames,
                    hostname,
                    representativeService: mergedService
                });
            }
        });

        if (deviceEntries.length === 0) return [];

        // 크로스 디바이스 HA 다이어그램 생성
        const crossDeviceDiagrams = generateCrossDeviceIESDiagrams(
            deviceEntries.map(e => ({ v1Device: e.v1Device, selectedInterfaceNames: e.selectedInterfaceNames }))
        );

        // 각 다이어그램마다 해당하는 인터페이스만 포함하는 서비스 생성 (Grafana Export용)
        return crossDeviceDiagrams.map(d => {
            // 이 다이어그램에 사용된 장비의 인터페이스만 필터링 (portId 기반)
            const diagramInterfaces = deviceEntries.flatMap(e => {
                const service = e.representativeService as IESService & { _hostname: string };
                // 장비 hostname이 다이어그램에 포함되어 있고, portId도 일치해야 함
                if (!d.usedHostnames.includes(e.hostname)) {
                    return [];
                }
                return service.interfaces.filter(intf =>
                    intf.portId && d.usedPortIds.includes(intf.portId)
                );
            });

            const representativeService: IESService & { _hostname: string } = {
                ...(deviceEntries[0].representativeService as IESService & { _hostname: string }),
                interfaces: diagramInterfaces,
            };

            return {
                service: representativeService as NokiaService & { _hostname: string },
                diagram: d.code,
                hostname: d.usedHostnames.join(' + '), // 실제 사용된 장비만 표시
                diagramName: d.name,
                description: d.description
            };
        });
    }, [iesGroupEntries, configByHostname, selectedServiceIds]);

    const nonIesDiagrams: DiagramItem[] = useMemo(() => nonIesGroupEntries.flatMap<DiagramItem>(([, group]) => {
        const servicesWithContext = group.map(service => {
            const hostname = (service as any)._hostname || 'Unknown';
            const parentConfig = configByHostname.get(hostname); // O(1) Map 조회 (js-index-maps)
            return {
                service,
                hostname: hostname,
                sdps: parentConfig?.sdps || []
            };
        });

        const representativeService = servicesWithContext[0].service;

        if (representativeService.serviceType === 'vprn') {
            // VPRN HA: 모든 장비의 인터페이스를 병합한 대표 서비스 생성 (Grafana Export용)
            const allInterfaces = servicesWithContext.flatMap(ctx => {
                const service = ctx.service as VPRNService & { _hostname: string };
                return service.interfaces || [];
            });
            const mergedVPRNService = {
                ...(representativeService as VPRNService),
                interfaces: allInterfaces
            } as NokiaService & { _hostname: string };

            // V3 네이티브: generateServiceDiagram() 사용
            return [{
                service: mergedVPRNService,
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

            return Array.from(sdpSubGroups.values()).map(subGroup => {
                // EPIPE HA: 모든 장비의 SAP를 병합한 대표 서비스 생성 (Grafana Export용)
                const allSaps = subGroup.flatMap(ctx => {
                    const service = ctx.service as EpipeService & { _hostname: string };
                    return service.saps || [];
                });
                const mergedEpipeService = {
                    ...(subGroup[0].service as EpipeService),
                    saps: allSaps
                } as NokiaService & { _hostname: string };

                return {
                    service: mergedEpipeService,
                    diagram: generateServiceDiagram(
                        subGroup.map(s => s.service),
                        subGroup.map(s => s.hostname),
                        subGroup[0].sdps,
                        remoteDeviceMap
                    ),
                    hostname: subGroup.map(s => s.hostname).join(' + '),
                    diagramName: undefined,
                    description: undefined
                };
            });
        }

        // Other service types (VPLS etc.)
        // VPLS HA: 모든 장비의 SAP를 병합한 대표 서비스 생성 (Grafana Export용)
        const allSaps = servicesWithContext.flatMap(ctx => {
            const service = ctx.service;
            if ('saps' in service && service.saps) {
                return service.saps;
            }
            return [];
        });
        const mergedService = {
            ...representativeService,
            saps: allSaps
        } as NokiaService & { _hostname: string };

        return [{
            service: mergedService,
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
    }), [nonIesGroupEntries, configByHostname, remoteDeviceMap]);

    const diagrams: DiagramItem[] = useMemo(() =>
        [...iesDiagrams, ...nonIesDiagrams],
        [iesDiagrams, nonIesDiagrams]
    );

    return (
        <div className="v2-page">
            <header className="v2-header">
                <div className="header-left">
                    {/* Config 파일 목록 토글 */}
                    <button
                        className={`sidebar-toggle-btn ${showConfigFileList ? 'active' : ''}`}
                        onClick={() => setShowConfigFileList(!showConfigFileList)}
                        title={showConfigFileList ? "Config 목록 닫기" : "Config 목록 열기"}
                    >
                        {showConfigFileList ? <FolderOpen size={20} /> : <FolderIcon size={20} />}
                        <span className="toggle-label">Config</span>
                    </button>

                    {/* Network Services 사이드바 토글 */}
                    <button
                        className={`sidebar-toggle-btn ${!isSidebarCollapsed ? 'active' : ''}`}
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        title={isSidebarCollapsed ? "Network Services 목록 열기" : "Network Services 목록 닫기"}
                    >
                        {isSidebarCollapsed ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
                        <span className="toggle-label">Services</span>
                    </button>

                    <div className="logo">
                        <img src="/favicon.svg" alt="App Icon" className="app-icon" />
                        <h1>Nokia Config Visualizer v{__APP_VERSION__} (AI Visualizer)</h1>
                    </div>
                </div>

                <div className="header-right">
                    {/* 버튼들이 Config 사이드바로 이동 */}
                </div>
            </header>

            {/* === Auto Config Loading: Folder Settings Modal (auto-config-loading) === */}
            {showFolderSettings && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <button
                            onClick={() => setShowFolderSettings(false)}
                            className="modal-close-btn"
                        >
                            <X size={24} />
                        </button>
                        <FolderPathSettings />
                    </div>
                </div>
            )}

            <main className="v2-main" onMouseUp={stopResizing}>
                {/* === Auto Config Loading: Config File List (auto-config-loading) === */}
                <aside
                    className="config-file-sidebar"
                    style={{
                        width: showConfigFileList ? '300px' : '0',
                        minWidth: showConfigFileList ? '300px' : '0',
                        flexShrink: 0,
                        overflow: 'hidden',
                        transition: 'width 0.3s ease-in-out, min-width 0.3s ease-in-out',
                        opacity: showConfigFileList ? 1 : 0,
                        pointerEvents: showConfigFileList ? 'auto' : 'none'
                    }}
                >
                    <ConfigFileList
                        files={configFiles}
                        groups={fileGroups}
                        activeFiles={activeFiles}
                        onToggleFile={toggleFile}
                        isLoading={wsStatus === 'connecting'}
                        connectionStatus={wsStatus}
                        onShowSettings={() => setShowFolderSettings(true)}
                        onUploadConfig={handleConfigLoaded}
                    />
                </aside>

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
                                                {group.length > 1 && firstService.serviceType !== 'ies' && (
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
