import { memo, useEffect, useRef, useState } from 'react';
import { toBlob } from 'html-to-image';

// mermaid 초기화는 앱 전체에서 단 한 번만 실행 (bundle-dynamic-imports + rendering-hoist-jsx)
let mermaidInitialized = false;
import Code from 'lucide-react/dist/esm/icons/code';
import ZoomIn from 'lucide-react/dist/esm/icons/zoom-in';
import ZoomOut from 'lucide-react/dist/esm/icons/zoom-out';
import Maximize2 from 'lucide-react/dist/esm/icons/maximize-2';
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3';
import Copy from 'lucide-react/dist/esm/icons/copy';
import Check from 'lucide-react/dist/esm/icons/check';
import type { L2VPNService } from '../../types/services';
import { GrafanaExportModal } from '../v3/GrafanaExportModal';
import './ServiceDiagram.css';

interface ServiceDiagramProps {
    service: L2VPNService;
    diagram: string;
    hostname: string;
    diagramName?: string;
}

// rerender-memo: diagram/service props 불변 시 재렌더링 방지 (mermaid async 렌더링 비용 절감)
export const ServiceDiagram = memo(function ServiceDiagram({ service, diagram, hostname, diagramName }: ServiceDiagramProps) {
    const diagramRef = useRef<HTMLDivElement>(null);
    const [showCode, setShowCode] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [showGrafanaModal, setShowGrafanaModal] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (diagramRef.current && diagram) {
            // 다이어그램 렌더링 (mermaid 동적 import - 첫 렌더링 시점에 lazy load)
            const renderDiagram = async () => {
                const { default: mermaid } = await import('mermaid');
                if (!mermaidInitialized) {
                    mermaid.initialize({
                        startOnLoad: false,
                        theme: 'default',
                        securityLevel: 'loose',
                        flowchart: {
                            useMaxWidth: false,
                            htmlLabels: true,
                            curve: 'basis',
                        },
                    });
                    mermaidInitialized = true;
                }
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

    const handleCopyImagePNG = async () => {
        if (!diagramRef.current) return;

        try {
            const blob = await toBlob(diagramRef.current, {
                quality: 1.0,
                pixelRatio: 2,
                backgroundColor: '#ffffff',
            });

            if (!blob) {
                throw new Error('Failed to generate image blob');
            }

            await navigator.clipboard.write([
                new ClipboardItem({
                    'image/png': blob
                })
            ]);

            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Copy image error:', error);
            alert('이미지 복사에 실패했습니다. 브라우저가 클립보드 API를 지원하는지 확인해주세요.');
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
                    <button
                        onClick={handleCopyImagePNG}
                        className={`control-btn ${copied ? 'copied' : ''}`}
                        title="Copy diagram as PNG to clipboard"
                    >
                        {copied ? <Check size={18} /> : <Copy size={18} />}
                        {copied ? ' Copied!' : ' Copy PNG'}
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
});
