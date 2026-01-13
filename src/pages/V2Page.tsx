import { useState, useEffect } from 'react';
import { parseL2VPNConfig } from '../utils/v2/l2vpnParser';
import { generateServiceDiagram } from '../utils/v2/mermaidGeneratorV2';
import type { ParsedL2VPNConfig } from '../types/v2';
import { ServiceList } from '../components/v2/ServiceList';
import { ServiceDiagram } from '../components/v2/ServiceDiagram';
import { FileUpload } from '../components/FileUpload';
import { Menu } from 'lucide-react';
import './V2Page.css';

export function V2Page() {
    const [configs, setConfigs] = useState<ParsedL2VPNConfig[]>([]);
    const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
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
            const parsedConfigs: ParsedL2VPNConfig[] = [];
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

    const handleToggleService = (serviceId: number) => {
        setSelectedServiceIds(prev =>
            prev.includes(serviceId)
                ? prev.filter(id => id !== serviceId)
                : [...prev, serviceId]
        );
    };

    const handleSetSelected = (serviceIds: number[]) => {
        setSelectedServiceIds(serviceIds);
    };

    // 모든 Config의 서비스를 하나로 합침 (Hostname 정보 주입 필요시 확장)
    const allServices = configs.flatMap(c => c.services);

    // 선택된 서비스들
    const selectedServices = allServices.filter(s =>
        selectedServiceIds.includes(s.serviceId)
    );

    // Build Remote Device Map (System IP -> Hostname)
    const remoteDeviceMap = new Map<string, string>();
    configs.forEach(c => {
        if (c.systemIp && c.hostname) {
            remoteDeviceMap.set(c.systemIp, c.hostname);
        }
    });

    // 다이어그램 생성 (해당 서비스가 속한 Config의 Hostname 찾기)
    const diagrams = selectedServices.map(service => {
        // Find which config this service belongs to
        const parentConfig = configs.find(c => c.services.includes(service));
        return {
            service,
            diagram: generateServiceDiagram(
                service,
                parentConfig?.hostname || 'Unknown',
                parentConfig?.sdps || [],
                remoteDeviceMap
            ),
            hostname: parentConfig?.hostname || 'Unknown'
        };
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
                        <h1>Nokia Config Visualizer v2.x</h1>
                    </div>
                    <span className="version-badge">MPLS L2 VPN Services</span>
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
                            <ServiceList
                                services={allServices}
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
                                            const id = item.service.serviceId;
                                            if (!acc[id]) acc[id] = [];
                                            acc[id].push(item);
                                            return acc;
                                        }, {} as Record<number, typeof diagrams>)
                                    ).map(([serviceId, group]) => (
                                        <div key={serviceId} className={`service-group ${group.length > 1 ? 'redundant-group' : ''}`}>
                                            {group.length > 1 && (
                                                <div className="group-header">
                                                    <h3>🔗 Service Group (ID: {serviceId})</h3>
                                                </div>
                                            )}
                                            <div className="group-items">
                                                {group.map(({ service, diagram, hostname }) => (
                                                    <ServiceDiagram
                                                        key={`${hostname}-${service.serviceId}`}
                                                        service={service}
                                                        diagram={diagram}
                                                        hostname={hostname}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
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
                        <p>Please upload a Nokia L2 VPN configuration file to start.</p>
                        <div className="upload-hint">
                            <FileUpload onConfigLoaded={handleConfigLoaded} variant="default" />
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
