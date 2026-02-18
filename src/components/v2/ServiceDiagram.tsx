import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { toPng, toSvg } from 'html-to-image';
import { Download, Code, ZoomIn, ZoomOut, Maximize2, BarChart3 } from 'lucide-react';
import type { L2VPNService } from '../../types/v2';
import { GrafanaExportModal } from '../v3/GrafanaExportModal';
import './ServiceDiagram.css';

interface ServiceDiagramProps {
    service: L2VPNService;
    diagram: string;
    hostname: string;
    diagramName?: string;
}

export function ServiceDiagram({ service, diagram, hostname, diagramName }: ServiceDiagramProps) {
    const diagramRef = useRef<HTMLDivElement>(null);
    const [showCode, setShowCode] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [showGrafanaModal, setShowGrafanaModal] = useState(false);

    useEffect(() => {
        if (diagramRef.current && diagram) {
            // Mermaid 초기화
            mermaid.initialize({
                startOnLoad: true,
                theme: 'default',
                securityLevel: 'loose',
                flowchart: {
                    useMaxWidth: false, // Let CSS control the width
                    htmlLabels: true,
                    curve: 'basis',
                },
            });

            // 다이어그램 렌더링
            const renderDiagram = async () => {
                try {
                    // Use serviceId AND hostname AND random string to ensure uniqueness
                    // Replace special chars in hostname for ID safety
                    const safeHost = hostname.replace(/[^a-zA-Z0-9]/g, '_');
                    const uniqueSuffix = Math.random().toString(36).substring(2, 9);
                    const id = `mermaid-${service.serviceId}-${safeHost}-${uniqueSuffix}`;
                    const { svg } = await mermaid.render(id, diagram);
                    if (diagramRef.current) {
                        diagramRef.current.innerHTML = svg;
                    }
                } catch (error) {
                    console.error('Mermaid rendering error:', error);
                    if (diagramRef.current) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        diagramRef.current.innerHTML = `<div class="error-container">
                            <p class="error-title">Failed to render diagram</p>
                            <pre class="error-message">${errorMessage}</pre>
                        </div>`;
                    }
                }
            };

            renderDiagram();
        }
    }, [diagram, service.serviceId]);

    const handleDownloadPNG = async () => {
        if (!diagramRef.current) return;

        try {
            const dataUrl = await toPng(diagramRef.current, {
                quality: 1.0,
                pixelRatio: 2,
            });

            const link = document.createElement('a');
            link.download = `${service.serviceType}-${service.serviceId}.png`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error('PNG export error:', error);
        }
    };

    const handleDownloadSVG = async () => {
        if (!diagramRef.current) return;

        try {
            const dataUrl = await toSvg(diagramRef.current);

            const link = document.createElement('a');
            link.download = `${service.serviceType}-${service.serviceId}.svg`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error('SVG export error:', error);
        }
    };

    const handleCopyCode = () => {
        navigator.clipboard.writeText(diagram);
        alert('Mermaid code copied to clipboard!');
    };

    const handleZoomIn = () => {
        setZoom(prev => Math.min(prev + 0.1, 2));
    };

    const handleZoomOut = () => {
        setZoom(prev => Math.max(prev - 0.1, 0.5));
    };

    const handleResetZoom = () => {
        setZoom(1);
    };

    return (
        <div className="service-diagram">
            {/* 헤더 */}
            <div className="diagram-header">
                <div className="diagram-title">
                    <span className="service-type-badge" data-type={service.serviceType}>
                        {service.serviceType.toUpperCase()}
                    </span>
                    <h3>
                        {service.serviceType === 'epipe' ? '🔗' : '🌐'}{' '}
                        {diagramName
                            ? diagramName
                            : service.serviceType === 'ies'
                                ? hostname
                                : `${service.serviceType.toUpperCase()} ${service.serviceId}${service.description ? `: ${service.description}` : ''}`
                        }
                    </h3>
                </div>
            </div>

            {/* 컨트롤 */}
            <div className="diagram-controls">
                <div className="control-group">
                    <button onClick={handleZoomOut} className="control-btn" title="Zoom Out">
                        <ZoomOut size={18} />
                    </button>
                    <span className="zoom-level">{Math.round(zoom * 100)}%</span>
                    <button onClick={handleZoomIn} className="control-btn" title="Zoom In">
                        <ZoomIn size={18} />
                    </button>
                    <button onClick={handleResetZoom} className="control-btn" title="Reset Zoom">
                        <Maximize2 size={18} />
                    </button>
                </div>

                <div className="control-group">
                    <button onClick={() => setShowCode(!showCode)} className="control-btn" title="Toggle Code">
                        <Code size={18} />
                        {showCode ? ' Hide Code' : ' Show Code'}
                    </button>
                    <button onClick={handleDownloadPNG} className="control-btn" title="Download PNG">
                        <Download size={18} /> PNG
                    </button>
                    <button onClick={handleDownloadSVG} className="control-btn" title="Download SVG">
                        <Download size={18} /> SVG
                    </button>
                    <button onClick={() => setShowGrafanaModal(true)} className="control-btn" title="Export to Grafana">
                        <BarChart3 size={18} /> Grafana
                    </button>
                </div>
            </div>

            {/* 다이어그램 */}
            <div className="diagram-container">
                <div
                    ref={diagramRef}
                    className="diagram-content"
                    style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
                />
            </div>

            {/* Mermaid 코드 */}
            {showCode && (
                <div className="diagram-code">
                    <div className="code-header">
                        <span>Mermaid Code</span>
                        <button onClick={handleCopyCode} className="copy-btn">
                            Copy
                        </button>
                    </div>
                    <pre className="code-content">
                        <code>{diagram}</code>
                    </pre>
                </div>
            )}

            {/* Grafana Export 모달 */}
            {showGrafanaModal && (
                <GrafanaExportModal
                    service={service}
                    hostname={hostname}
                    onClose={() => setShowGrafanaModal(false)}
                />
            )}
        </div>
    );
}
