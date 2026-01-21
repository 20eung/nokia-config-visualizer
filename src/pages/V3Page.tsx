import { useState, useEffect } from 'react';
import { parseL2VPNConfig } from '../utils/v3/parserV3';
import { generateServiceDiagram, generateIESDiagram } from '../utils/v3/mermaidGeneratorV3';
import type { ParsedConfigV3 } from '../utils/v3/parserV3';
import { ServiceListV3 } from '../components/v3/ServiceListV3';
import { ServiceDiagram } from '../components/v2/ServiceDiagram'; // Reuse for now or duplicate if needed
import { FileUpload } from '../components/FileUpload';
import { Menu } from 'lucide-react';
import './V2Page.css';

export function V3Page() {
    const [configs, setConfigs] = useState<ParsedConfigV3[]>([]);
    const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // Auto-load sample config in demo/beta environment
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
                // Only add if it has valid hostname or services
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

    // 모든 Config의 서비스를 하나로 합침 (Hostname 정보 주입)
    const allServices = configs.flatMap(c => c.services.map(s => ({ ...s, _hostname: c.hostname })));

    // 선택된 서비스들 (IES는 Hostname 기반 키 매칭)
    const selectedServices = allServices.filter(s => {
        if (s.serviceType === 'ies') {
            const hostname = (s as any)._hostname;
            return selectedServiceIds.includes(`ies-${hostname}`);
        }
        return selectedServiceIds.includes(`${s.serviceType}-${s.serviceId}`);
    });

    // Build Remote Device Map (System IP -> Hostname)
    const remoteDeviceMap = new Map<string, string>();
    configs.forEach(c => {
        if (c.systemIp && c.hostname) {
            remoteDeviceMap.set(c.systemIp, c.hostname);
        }
    });

    // 서비스를 serviceId와 serviceType별로 그룹화 (Diagram Generation용 - IES는 0으로 묶임)
    const serviceGroups = selectedServices.reduce((acc, service) => {
        const key = `${service.serviceType}-${service.serviceId}`;
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(service);
        return acc;
    }, {} as Record<string, typeof selectedServices>);

    // 다이어그램 생성 (그룹별로 하나의 다이어그램 생성)
    const diagrams = Object.values(serviceGroups).map(group => {
        // 각 서비스가 속한 Config와 Hostname 찾기
        const servicesWithContext = group.map(service => {
            // Use _hostname property that was injected in line 69
            const hostname = (service as any)._hostname || 'Unknown';
            const parentConfig = configs.find(c => c.hostname === hostname);
            return {
                service,
                hostname: hostname,
                sdps: parentConfig?.sdps || []
            };
        });

        // 첫 번째 서비스를 대표로 사용
        const representativeService = servicesWithContext[0].service;

        // IES Special Handling
        if (representativeService.serviceType === 'ies') {
            return {
                service: representativeService,
                diagram: generateIESDiagram(
                    servicesWithContext.map(s => s.service),
                    servicesWithContext.map(s => s.hostname)
                ),
                hostname: 'Global Routing (IES 0)'
            };
        }

        // 단일 서비스인 경우와 다중 서비스인 경우 처리
        if (servicesWithContext.length === 1) {
            return {
                service: representativeService,
                diagram: generateServiceDiagram(
                    representativeService,
                    servicesWithContext[0].hostname,
                    servicesWithContext[0].sdps,
                    remoteDeviceMap
                ),
                hostname: servicesWithContext[0].hostname
            };
        } else {
            // Epipe의 경우 통합 다이어그램 생성
            if (representativeService.serviceType === 'epipe') {
                return {
                    service: representativeService,
                    diagram: generateServiceDiagram(
                        servicesWithContext.map(s => s.service),
                        servicesWithContext.map(s => s.hostname),
                        servicesWithContext[0].sdps, // SDPs는 첫 번째 것 사용 (필요시 병합 가능)
                        remoteDeviceMap
                    ),
                    hostname: servicesWithContext.map(s => s.hostname).join(' + ')
                };
            } else {
                // VPLS, VPRN도 통합 다이어그램 생성
                return {
                    service: representativeService,
                    diagram: generateServiceDiagram(
                        servicesWithContext.map(s => s.service),
                        servicesWithContext.map(s => s.hostname),
                        servicesWithContext[0].sdps,
                        remoteDeviceMap
                    ),
                    hostname: servicesWithContext.map(s => s.hostname).join(' + ')
                };
            }
        }
    });

    return (
        <div className="v2-page">
            {/* 헤더 */}
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

            {/* 메인 컨텐츠 */}
            <main className="v2-main">
                {configs.length > 0 ? (
                    <>
                        {/* 사이드바 - 서비스 목록 */}
                        <aside className={`v2-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
                            <ServiceListV3
                                services={allServices}
                                configs={configs}
                                selectedServiceIds={selectedServiceIds}
                                onToggleService={handleToggleService}
                                onSetSelected={handleSetSelected}
                            />
                        </aside>

                        {/* 컨텐츠 - 다이어그램 */}
                        <section className="v2-content">
                            {diagrams.length > 0 ? (
                                <div className="diagrams-container">
                                    {Object.entries(
                                        diagrams.reduce((acc, item) => {
                                            // Group by Type + ID to separate VPRN 2001 and Epipe 2001
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
                                                    {group.map(({ service, diagram, hostname }) => (
                                                        <ServiceDiagram
                                                            key={`${hostname}-${service.serviceId}`}
                                                            service={service as any}
                                                            diagram={diagram}
                                                            hostname={hostname}
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
