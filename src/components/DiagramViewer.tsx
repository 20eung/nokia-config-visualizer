import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { ZoomIn, ZoomOut, Download } from 'lucide-react';

interface DiagramViewerProps {
  diagrams: Array<{ name: string; code: string; description: string }>;
}

export const DiagramViewer: React.FC<DiagramViewerProps> = ({ diagrams }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = React.useState(1.0);

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

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.1, 3.0));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.1, 0.5));
  };

  /* Download as SVG */
  const handleDownloadSvg = () => {
    const svg = containerRef.current?.querySelector('svg');
    if (!svg) return;
    try {
      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(svg);

      // Add XML declaration
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
    } catch (e) {
      console.error('SVG Download failed:', e);
      alert('SVG Download failed');
    }
  };

  const handleDownloadPng = () => {
    const svg = containerRef.current?.querySelector('svg');
    if (!svg) {
      alert('No diagram to download');
      return;
    }

    try {
      const styles = Array.from(document.querySelectorAll('style'))
        .map(style => style.innerHTML)
        .join('\n');

      const clonedSvg = svg.cloneNode(true) as SVGElement;
      clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      const bbox = svg.getBoundingClientRect();

      if (!clonedSvg.getAttribute('width')) clonedSvg.setAttribute('width', bbox.width.toString());
      if (!clonedSvg.getAttribute('height')) clonedSvg.setAttribute('height', bbox.height.toString());

      const styleElement = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      styleElement.textContent = styles;
      clonedSvg.prepend(styleElement);

      const serializer = new XMLSerializer();
      const svgData = serializer.serializeToString(clonedSvg);

      const canvas = document.createElement('canvas');
      const scale = 2;
      canvas.width = bbox.width * scale;
      canvas.height = bbox.height * scale;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);

      const img = new Image();
      img.onload = () => {
        try {
          ctx.drawImage(img, 0, 0);

          const pngUrl = canvas.toDataURL('image/png');
          const downloadLink = document.createElement('a');
          downloadLink.href = pngUrl;
          downloadLink.download = 'network-diagram.png';
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);

          URL.revokeObjectURL(img.src);
        } catch (innerErr) {
          console.error('Error during canvas drawing:', innerErr);
          alert('Error generating PNG. Please use SVG download.');
        }
      };

      img.onerror = (err) => {
        console.error('Image loading failed:', err);
        alert('Failed to generate image. Please use SVG download.');
        URL.revokeObjectURL(img.src);
      };

      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      img.src = url;

    } catch (e) {
      console.error('Download failed:', e);
      alert('Failed to download diagram. Please use SVG download.');
    }
  };

  return (
    <div className="diagram-viewer">
      <div className="toolbar">
        <button onClick={handleZoomIn} title="Zoom In">
          <ZoomIn size={16} />
        </button>
        <button onClick={handleZoomOut} title="Zoom Out">
          <ZoomOut size={16} />
        </button>
        <span className="text-xs text-gray-500 mx-2">{Math.round(zoomLevel * 100)}%</span>

        <button className="secondary" onClick={handleDownloadSvg} title="Download SVG (Vector)">
          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>SVG</span>
        </button>

        <button className="primary" onClick={handleDownloadPng} title="Download PNG (Image)">
          <span style={{ fontSize: '0.75rem', fontWeight: 600, marginRight: '4px' }}>PNG</span>
          <Download size={14} />
        </button>
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
