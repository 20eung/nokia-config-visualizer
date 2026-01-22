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
    // 사이드바 너비 상태 (기본값 320px)
    const [sidebarWidth, setSidebarWidth] = useState(320);
    const [isResizing, setIsResizing] = useState(false);

    // 사이드바 리사이징 핸들러
    const startResizing = (mouseDownEvent: React.MouseEvent) => {
        mouseDownEvent.preventDefault();
        setIsResizing(true);
    };

    const stopResizing = () => {
        setIsResizing(false);
    };

    const resize = (mouseMoveEvent: MouseEvent) => {
        if (isResizing) {
            const newWidth = mouseMoveEvent.clientX; // 사이드바가 왼쪽에 있으므로 clientX가 곧 너비
            if (newWidth > 200 && newWidth < 800) { // 최소/최대 너비 제한
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
            <main className="v2-main" onMouseUp={stopResizing}>
                {configs.length > 0 ? (
                    <>
                        {/* 사이드바 - 서비스 목록 */}
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

                        {/* 리사이저 핸들 (사이드바가 펼쳐져 있을 때만 표시) */}
                        {!isSidebarCollapsed && (
                            <div
                                className={`sidebar-resizer ${isResizing ? 'resizing' : ''}`}
                                onMouseDown={startResizing}
                            />
                        )}

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
