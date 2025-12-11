import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { ZoomIn, ZoomOut, Download } from 'lucide-react';

interface DiagramViewerProps {
  diagrams: Array<{ name: string; code: string; description: string }>;
}

export const DiagramViewer: React.FC<DiagramViewerProps> = ({ diagrams }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || diagrams.length === 0) {
      if (containerRef.current) containerRef.current.innerHTML = '';
      return;
    }

    mermaid.initialize({
      startOnLoad: false, // We will render manually
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
      // Ensure the diagram code is valid before rendering
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

      // Clear container before rendering new content
      containerRef.current.innerHTML = '';

      // Append each successfully rendered diagram
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

      <div ref={containerRef} className="diagram-canvas" />
    </div>
  );
};
