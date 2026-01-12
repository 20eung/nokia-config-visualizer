import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { toPng, toSvg } from 'html-to-image';
import { Download, Code, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type { L2VPNService } from '../../types/v2';
import './ServiceDiagram.css';

interface ServiceDiagramProps {
    service: L2VPNService;
    diagram: string;
    hostname: string;
}

export function ServiceDiagram({ service, diagram, hostname: _hostname }: ServiceDiagramProps) {
    const diagramRef = useRef<HTMLDivElement>(null);
    const [showCode, setShowCode] = useState(false);
    const [zoom, setZoom] = useState(1);

    useEffect(() => {
        if (diagramRef.current && diagram) {
            // Mermaid 초기화
            mermaid.initialize({
                startOnLoad: true,
                theme: 'default',
                securityLevel: 'loose',
                flowchart: {
                    useMaxWidth: true,
                    htmlLabels: true,
                    curve: 'basis',
                },
            });

            // 다이어그램 렌더링
            const renderDiagram = async () => {
                try {
                    const id = `mermaid-${service.serviceId}-${Date.now()}`;
                    const { svg } = await mermaid.render(id, diagram);
                    if (diagramRef.current) {
                        diagramRef.current.innerHTML = svg;
                    }
                } catch (error) {
                    console.error('Mermaid rendering error:', error);
                    if (diagramRef.current) {
                        diagramRef.current.innerHTML = '<p class="error">Failed to render diagram</p>';
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
                    <h3>{service.serviceType === 'epipe' ? '🔗' : '🌐'} {service.serviceType.toUpperCase()} {service.serviceId}</h3>
                </div>
                <div className="diagram-description">
                    {service.description}
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

            {/* 서비스 상세 정보 */}
            <div className="service-details">
                <h4>Service Details</h4>
                <div className="details-grid">
                    <div className="detail-item">
                        <span className="detail-label">Service ID:</span>
                        <span className="detail-value">{service.serviceId}</span>
                    </div>
                    <div className="detail-item">
                        <span className="detail-label">Type:</span>
                        <span className="detail-value">{service.serviceType.toUpperCase()}</span>
                    </div>
                    <div className="detail-item">
                        <span className="detail-label">Customer:</span>
                        <span className="detail-value">{service.customerId}</span>
                    </div>
                    <div className="detail-item">
                        <span className="detail-label">Admin State:</span>
                        <span className={`detail-value state-${service.adminState}`}>
                            {service.adminState.toUpperCase()}
                        </span>
                    </div>
                    {service.serviceMtu && (
                        <div className="detail-item">
                            <span className="detail-label">Service MTU:</span>
                            <span className="detail-value">{service.serviceMtu}</span>
                        </div>
                    )}
                    {service.serviceType === 'vpls' && service.fdbSize && (
                        <div className="detail-item">
                            <span className="detail-label">FDB Size:</span>
                            <span className="detail-value">{service.fdbSize}</span>
                        </div>
                    )}
                </div>

                {/* SAP 정보 */}
                <h4>SAPs ({service.saps.length})</h4>
                <div className="sap-list">
                    {service.saps.map((sap, index) => (
                        <div key={index} className="sap-item">
                            <div className="sap-header">
                                <span className="sap-id">📍 {sap.sapId}</span>
                                <span className="sap-state state-{sap.adminState}">{sap.adminState}</span>
                            </div>
                            <div className="sap-description">{sap.description}</div>
                            <div className="sap-details">
                                <span>Port: {sap.portId}</span>
                                <span>VLAN: {sap.vlanId}</span>
                                {sap.ingressQos && <span>Ingress QoS: {sap.ingressQos.policyId}</span>}
                                {sap.egressQos && <span>Egress QoS: {sap.egressQos.policyId}</span>}
                            </div>
                        </div>
                    ))}
                </div>

                {/* SDP 정보 */}
                {((service.spokeSdps && service.spokeSdps.length > 0) ||
                    (service.serviceType === 'vpls' && service.meshSdps && service.meshSdps.length > 0)) && (
                        <>
                            <h4>SDPs</h4>
                            <div className="sdp-list">
                                {service.spokeSdps?.map((sdp, index) => (
                                    <div key={index} className="sdp-item">
                                        <div className="sdp-header">
                                            <span className="sdp-id">🔀 Spoke SDP {sdp.sdpId}:{sdp.vcId}</span>
                                        </div>
                                        <div className="sdp-description">{sdp.description}</div>
                                    </div>
                                ))}
                                {service.serviceType === 'vpls' && service.meshSdps?.map((sdp, index) => (
                                    <div key={index} className="sdp-item">
                                        <div className="sdp-header">
                                            <span className="sdp-id">🔀 Mesh SDP {sdp.sdpId}:{sdp.vcId}</span>
                                        </div>
                                        <div className="sdp-description">{sdp.description}</div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
            </div>
        </div>
    );
}
