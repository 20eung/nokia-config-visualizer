import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { ZoomIn, ZoomOut, Download } from 'lucide-react';

interface DiagramViewerProps {
    chart: string;
}

export const DiagramViewer: React.FC<DiagramViewerProps> = ({ chart }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current) {
            mermaid.initialize({
                startOnLoad: true,
                theme: 'base',
                themeVariables: {
                    primaryColor: '#2563eb',
                    primaryTextColor: '#fff',
                    primaryBorderColor: '#1e40af',
                    lineColor: '#6b7280',
                    secondaryColor: '#34a853',
                    tertiaryColor: '#fff'
                },
                securityLevel: 'loose',
                fontFamily: 'Inter, sans-serif'
            });

            mermaid.render('mermaid-chart', chart).then((result) => {
                if (containerRef.current) {
                    containerRef.current.innerHTML = result.svg;
                }
            }).catch(err => {
                console.error("Mermaid failed to render", err);
                // Dont clear if it's just a transient error, but for syntax error we should
                // For now, silent fail or handle gracefully
            });
        }
    }, [chart]);

    return (
        <div className="diagram-viewer">
            <div className="toolbar">
                <button title="Zoom In (Not Implemented)">
                    <ZoomIn size={16} />
                </button>
                <button title="Zoom Out (Not Implemented)">
                    <ZoomOut size={16} />
                </button>
                <button className="primary" title="Download SVG (Not Implemented)">
                    <Download size={16} />
                </button>
            </div>

            <div
                ref={containerRef}
                className="diagram-canvas"
            />
        </div>
    );
};
