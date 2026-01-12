import { useState } from 'react';
import { parseL2VPNConfig } from '../utils/v2/l2vpnParser';
import { generateServiceDiagram } from '../utils/v2/mermaidGeneratorV2';
import type { ParsedL2VPNConfig } from '../types/v2';
import { ServiceList } from '../components/v2/ServiceList';
import { ServiceDiagram } from '../components/v2/ServiceDiagram';
import { FileUpload } from '../components/FileUpload';
import './V2Page.css';

export function V2Page() {
    const [config, setConfig] = useState<ParsedL2VPNConfig | null>(null);
    const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);

    const handleConfigLoaded = (contents: string[]) => {
        try {
            // 첫 번째 config 파일만 파싱 (v2는 단일 파일)
            const parsedConfig = parseL2VPNConfig(contents[0]);
            setConfig(parsedConfig);
            setSelectedServiceIds([]);
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

    // 선택된 서비스들
    const selectedServices = config?.services.filter(s =>
        selectedServiceIds.includes(s.serviceId)
    ) || [];

    // 다이어그램 생성
    const diagrams = selectedServices.map(service => ({
        service,
        diagram: generateServiceDiagram(service, config?.hostname || ''),
    }));

    return (
        <div className="v2-page">
            {/* 헤더 */}
            <header className="v2-header">
                <div className="header-left">
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
                {config ? (
                    <>
                        {/* 사이드바 - 서비스 목록 */}
                        <aside className="v2-sidebar">
                            <ServiceList
                                services={config.services}
                                selectedServiceIds={selectedServiceIds}
                                onToggleService={handleToggleService}
                                onSetSelected={handleSetSelected}
                            />
                        </aside>

                        {/* 컨텐츠 - 다이어그램 */}
                        <section className="v2-content">
                            {diagrams.length > 0 ? (
                                <div className="diagrams-container">
                                    {diagrams.map(({ service, diagram }) => (
                                        <ServiceDiagram
                                            key={service.serviceId}
                                            service={service}
                                            diagram={diagram}
                                            hostname={config.hostname}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <h3>No Service Selected</h3>
                                    <p>Please select a service from the list to view its diagram.</p>
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
