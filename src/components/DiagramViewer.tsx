import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';
import { toPng } from 'html-to-image';
import { ZoomIn, ZoomOut, Download, ChevronDown, Code, Copy, Check } from 'lucide-react';

interface DiagramViewerProps {
  diagrams: Array<{ name: string; code: string; description: string }>;
}

interface RenderedDiagram {
  id: string;
  svg: string;
  name: string;
  description: string;
  isError: boolean;
}

export const DiagramViewer: React.FC<DiagramViewerProps> = ({ diagrams }) => {
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [renderedDiagrams, setRenderedDiagrams] = useState<RenderedDiagram[]>([]);

  // Track open download menu
  const [activeDownloadMenu, setActiveDownloadMenu] = useState<string | null>(null);
  // Track which diagrams have code view open
  const [showCodeFor, setShowCodeFor] = useState<Set<number>>(new Set());
  // Track which diagrams have been copied
  const [copiedFor, setCopiedFor] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (diagrams.length === 0) {
      setRenderedDiagrams([]);
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
      const id = `mermaid-chart-${index}`;
      if (!diagram.code || typeof diagram.code !== 'string' || diagram.code.trim() === '') {
        return Promise.resolve({ id, svg: '', isError: true, name: diagram.name, description: diagram.description });
      }
      return mermaid
        .render(id, diagram.code)
        .then((result) => ({ id, svg: result.svg, isError: false, name: diagram.name, description: diagram.description }))
        .catch((err) => {
          console.error(`Mermaid failed to render diagram ${diagram.name} (index ${index})`, err);
          return { id, svg: '', isError: true, name: diagram.name, description: diagram.description };
        });
    });

    Promise.all(renderPromises).then((results) => {
      setRenderedDiagrams(results);
    });
  }, [diagrams]);

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.1, 3.0));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.1, 0.5));

  const downloadSvg = (diagram: RenderedDiagram) => {
    try {
      let source = diagram.svg;
      if (!source.match(/^<\?xml/)) {
        source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
      }
      const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = `${diagram.name.replace(/\s+/g, '_')}.svg`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      setActiveDownloadMenu(null);
    } catch (e) {
      console.error('SVG Download failed:', e);
      alert('SVG Download failed');
    }
  };

  const downloadPng = async (id: string, name: string) => {
    // Find the specific SVG element in the DOM
    // The svg is inside the div with id, but mermaid.render usually assigns id to the SVG. 
    // Wait, mermaid.render returns SVG string with id. When we dangerouslySetInnerHTML, the SVG has that ID.
    // However, unique IDs are important. Let's look for the SVG by ID.
    const svgElement = document.querySelector(`#${id}`);

    if (!svgElement) {
      alert('Diagram element not found');
      return;
    }

    try {
      const dataUrl = await toPng(svgElement as unknown as HTMLElement, {
        backgroundColor: 'white',
        pixelRatio: 2.5,
      });

      const downloadLink = document.createElement('a');
      downloadLink.href = dataUrl;
      downloadLink.download = `${name.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      setActiveDownloadMenu(null);

    } catch (e) {
      console.error('PNG Download failed:', e);
      alert('Failed to generate PNG. Please try SVG download.');
    }
  };

  const copyToClipboard = async (code: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(code);
      const newSet = new Set(copiedFor);
      newSet.add(idx);
      setCopiedFor(newSet);

      // Reset after 2 seconds
      setTimeout(() => {
        setCopiedFor(prev => {
          const resetSet = new Set(prev);
          resetSet.delete(idx);
          return resetSet;
        });
      }, 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
      alert('복사에 실패했습니다');
    }
  };


  // If no diagrams, don't show the viewer
  if (!diagrams.length) return null;

  return (
    <div className="diagram-viewer">
      <div className="toolbar">
        {/* Zoom Controls */}
        <div className="toolbar-group">
          <button className="btn-tool" onClick={handleZoomOut} title="Zoom Out">
            <ZoomOut size={16} />
          </button>

          <span className="zoom-monitor">{Math.round(zoomLevel * 100)}%</span>

          <button className="btn-tool" onClick={handleZoomIn} title="Zoom In">
            <ZoomIn size={16} />
          </button>
        </div>
        {/* Removed Global Download Button */}
      </div>

      <div
        className="diagram-canvas"
        style={{
          transform: `scale(${zoomLevel})`,
          transformOrigin: 'top left',
          transition: 'transform 0.1s ease-out'
        }}
      >
        {renderedDiagrams.map((diagram, idx) => {
          const title = diagram.description ? `${diagram.name}: ${diagram.description}` : diagram.name;
          const isMenuOpen = activeDownloadMenu === diagram.id;
          const showCode = showCodeFor.has(idx);
          const originalCode = diagrams[idx]?.code || '';

          return (
            <div key={diagram.id} className="diagram-item">
              <div className="diagram-header">
                <h3>{title}</h3>

                <div className="header-actions relative" style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn-tool"
                    style={{ height: '28px', padding: '0 8px', fontSize: '12px' }}
                    onClick={() => {
                      const newSet = new Set(showCodeFor);
                      if (showCode) newSet.delete(idx);
                      else newSet.add(idx);
                      setShowCodeFor(newSet);
                    }}
                    title="Mermaid 코드 보기"
                  >
                    <Code size={14} />
                  </button>
                  {!diagram.isError && (
                    <button
                      className="btn-tool"
                      style={{ height: '28px', padding: '0 8px', fontSize: '12px' }}
                      onClick={() => setActiveDownloadMenu(isMenuOpen ? null : diagram.id)}
                      title="Download"
                    >
                      <Download size={14} />
                      <ChevronDown size={12} />
                    </button>
                  )}

                  {!diagram.isError && isMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setActiveDownloadMenu(null)} />
                      <div className="dropdown-menu" style={{ width: '120px', right: 0, top: '100%', marginTop: '4px' }}>
                        <div className="py-1">
                          <button className="dropdown-item" onClick={() => downloadSvg(diagram)}>
                            <span className="font-medium">SVG</span>
                          </button>
                          <button className="dropdown-item" onClick={() => downloadPng(diagram.id, diagram.name)}>
                            <span className="font-medium">PNG</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              {showCode && (
                <div style={{ margin: '16px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '6px', position: 'relative' }}>
                  <button
                    onClick={() => copyToClipboard(originalCode, idx)}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      padding: '6px 12px',
                      backgroundColor: copiedFor.has(idx) ? '#10b981' : '#fff',
                      color: copiedFor.has(idx) ? '#fff' : '#374151',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.2s'
                    }}
                    title={copiedFor.has(idx) ? '복사됨!' : '코드 복사'}
                  >
                    {copiedFor.has(idx) ? (
                      <>
                        <Check size={14} />
                        <span>복사됨</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>복사</span>
                      </>
                    )}
                  </button>
                  <pre style={{ margin: 0, paddingRight: '80px', fontFamily: 'monospace', fontSize: '12px', overflow: 'auto', maxHeight: '300px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{originalCode}</pre>
                </div>
              )}
              {diagram.isError ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626' }}>
                  <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>⚠️ Diagram rendering failed</p>
                  <p style={{ fontSize: '14px', color: '#6b7280' }}>Click the Code button above to see the generated Mermaid code</p>
                </div>
              ) : (
                <div
                  className="diagram-content"
                  dangerouslySetInnerHTML={{ __html: diagram.svg }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
