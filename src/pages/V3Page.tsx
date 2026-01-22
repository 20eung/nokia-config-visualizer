import { useState, useEffect } from 'react';
import { parseL2VPNConfig } from '../utils/v3/parserV3';
import { generateServiceDiagram, generateIESDiagram } from '../utils/v3/mermaidGeneratorV3';
import type { ParsedConfigV3 } from '../utils/v3/parserV3';
import type { NokiaService, IESService } from '../types/v2';
import { ServiceListV3 } from '../components/v3/ServiceListV3';
import { ServiceDiagram } from '../components/v2/ServiceDiagram'; // Reuse for now or duplicate if needed
import { FileUpload } from '../components/FileUpload';
import { Menu } from 'lucide-react';
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

    const diagrams = Object.values(serviceGroups).map(group => {
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

        if (representativeService.serviceType === 'ies') {
            return {
                service: representativeService,
                diagram: generateIESDiagram(
                    servicesWithContext.map(s => s.service),
                    servicesWithContext.map(s => s.hostname)
                ),
                hostname: servicesWithContext[0].hostname
            };
        }

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
            if (representativeService.serviceType === 'epipe') {
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
            } else {
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
