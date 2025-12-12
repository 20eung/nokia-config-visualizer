import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { toPng } from 'html-to-image';
import { ZoomIn, ZoomOut, Download, ChevronDown } from 'lucide-react';

interface DiagramViewerProps {
  diagrams: Array<{ name: string; code: string; description: string }>;
}

export const DiagramViewer: React.FC<DiagramViewerProps> = ({ diagrams }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);

  useEffect(() => {
    if (!containerRef.current || diagrams.length === 0) {
      if (containerRef.current) containerRef.current.innerHTML = '';
      return;
    }

    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        primaryColor: '#2563eb',
        primaryTextColor: '#fff',
        primaryBorderColor: '#1e40af',
        lineColor: '#6b7280',
        secondaryColor: '#34a853',
        tertiaryColor: '#fff',
      },
      securityLevel: 'loose',
      fontFamily: 'Inter, sans-serif',
      flowchart: {
        htmlLabels: true,
        useMaxWidth: true,
      },
    });

    const renderPromises = diagrams.map((diagram, index) => {
      if (!diagram.code || typeof diagram.code !== 'string' || diagram.code.trim() === '') {
        return Promise.resolve({ index, svg: '', success: false, name: diagram.name, description: diagram.description });
      }
      return mermaid
        .render(`mermaid-chart-${index}`, diagram.code)
        .then((result) => ({ index, svg: result.svg, success: true, name: diagram.name, description: diagram.description }))
        .catch((err) => {
          console.error(`Mermaid failed to render diagram ${diagram.name} (index ${index})`, err);
          return { index, svg: '', success: false, name: diagram.name, description: diagram.description };
        });
    });

    Promise.all(renderPromises).then((results) => {
      if (!containerRef.current) return;
      containerRef.current.innerHTML = '';
      results.forEach(({ svg, success, name, description }) => {
        if (!success || !svg) return;
        const title = description ? `${name}: ${description}` : name;
        const diagramWrapper = document.createElement('div');
        diagramWrapper.className = 'diagram-item';
        diagramWrapper.innerHTML = `
          <div class="diagram-header">
            <h3>${title}</h3>
          </div>
          <div class="diagram-content">
            ${svg}
          </div>
        `;
        containerRef.current?.appendChild(diagramWrapper);
      });
    });
  }, [diagrams]);

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.1, 3.0));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.1, 0.5));

  const handleDownloadSvg = () => {
    const svg = containerRef.current?.querySelector('svg');
    if (!svg) return;
    try {
      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(svg);
      if (!source.match(/^<\?xml/)) {
        source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
      }
      const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = 'network-diagram.svg';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      setIsDownloadMenuOpen(false);
    } catch (e) {
      console.error('SVG Download failed:', e);
      alert('SVG Download failed');
    }
  };

  const handleDownloadPng = async () => {
    const svg = containerRef.current?.querySelector('svg');
    if (!svg) {
      alert('No diagram to download');
      return;
    }

    try {
      // Use html-to-image to generate PNG
      // We set a white background and scale up for quality
      const dataUrl = await toPng(svg as unknown as HTMLElement, {
        backgroundColor: 'white',
        pixelRatio: 2.5, // Higher quality
      });

      const downloadLink = document.createElement('a');
      downloadLink.href = dataUrl;
      downloadLink.download = 'network-diagram.png';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      setIsDownloadMenuOpen(false);

    } catch (e) {
      console.error('PNG Download failed:', e);
      alert('Failed to generate PNG. Please try SVG download.');
    }
  };

  // If no diagrams, don't show the viewer (or at least toolbar)
  if (!diagrams.length) return null;

  return (
    <div className="diagram-viewer">
      <div className="toolbar">
        {/* Left: Zoom Controls */}
        <div className="toolbar-group">
          <button className="btn-tool" onClick={handleZoomOut} title="Zoom Out">
            <ZoomOut size={16} />
          </button>

          <span className="zoom-monitor">{Math.round(zoomLevel * 100)}%</span>

          <button className="btn-tool" onClick={handleZoomIn} title="Zoom In">
            <ZoomIn size={16} />
          </button>
        </div>

        {/* Right: Download Control */}
        <div className="toolbar-group relative">
          <button
            className={`btn-tool primary ${isDownloadMenuOpen ? 'active' : ''}`}
            onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)}
            title="Download Diagram"
          >
            <Download size={16} />
            <span>Download</span>
            <ChevronDown size={14} />
          </button>

          {isDownloadMenuOpen && (
            <div className="dropdown-menu" style={{ width: '160px' }}>
              <div className="py-1">
                <button className="dropdown-item" onClick={handleDownloadSvg}>
                  <span className="font-medium">SVG</span> <span className="text-gray-500 text-xs">(Vector)</span>
                </button>
                <button className="dropdown-item" onClick={handleDownloadPng}>
                  <span className="font-medium">PNG</span> <span className="text-gray-500 text-xs">(Image)</span>
                </button>
              </div>
            </div>
          )}

          {/* Backdrop */}
          {isDownloadMenuOpen && (
            <div className="fixed inset-0 z-40" onClick={() => setIsDownloadMenuOpen(false)} />
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        className="diagram-canvas"
        style={{
          transform: `scale(${zoomLevel})`,
          transformOrigin: 'top left',
          transition: 'transform 0.1s ease-out'
        }}
      />
    </div>
  );
};
