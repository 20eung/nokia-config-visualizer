import { useState, useMemo } from 'react';
import { parseNokiaConfig } from './utils/nokiaParser';
import { generateMermaidDiagram } from './utils/mermaidGenerator';
import type { NokiaDevice } from './types';
import { useRef, useCallback, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { InterfaceList } from './components/InterfaceList';
import { DiagramViewer } from './components/DiagramViewer';
import { Layout, Menu } from 'lucide-react';
import './App.css';

function App() {
  const [device, setDevice] = useState<NokiaDevice | null>(null);
  const [selectedInterfaces, setSelectedInterfaces] = useState<string[]>([]);

  // Layout State
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Resizing Logic
  const startResizing = useCallback(() => setIsResizing(true), []);
  const stopResizing = useCallback(() => setIsResizing(false), []);

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing && sidebarRef.current) {
        const newWidth = mouseMoveEvent.clientX - sidebarRef.current.getBoundingClientRect().left;
        if (newWidth > 200 && newWidth < 600) {
          setSidebarWidth(newWidth);
        }
      }
    },
    [isResizing]
  );

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  // Auto-load test config in beta environment
  useEffect(() => {
    const isBetaEnvironment = window.location.hostname.includes('beta');

    if (isBetaEnvironment && !device) {
      fetch('/docs/config.txt')
        .then(response => {
          if (!response.ok) throw new Error('Failed to load test config');
          return response.text();
        })
        .then(text => {
          handleConfigLoaded(text);
          console.log('✅ Beta environment: Auto-loaded docs/config.txt');
        })
        .catch(error => {
          console.warn('⚠️ Beta environment: Could not auto-load config:', error);
        });
    }
  }, []); // Run once on mount

  const handleConfigLoaded = (text: string) => {
    try {
      const parsedDevice = parseNokiaConfig(text);
      setDevice(parsedDevice);
      setSelectedInterfaces([]); // Reset selection
    } catch (e) {
      alert('Failed to parse config file.');
      console.error(e);
    }
  };

  const handleToggleInterface = (name: string) => {
    setSelectedInterfaces(prev =>
      prev.includes(name)
        ? prev.filter(n => n !== name)
        : [...prev, name]
    );
  };

  const handleSetSelected = (names: string[]) => {
    setSelectedInterfaces(names);
  };

  const diagrams = useMemo(() => {
    if (!device) return [];
    return generateMermaidDiagram(device, selectedInterfaces);
  }, [device, selectedInterfaces]);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <button
            className="icon-btn"
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            title="Toggle Sidebar"
          >
            <Menu size={20} />
          </button>
          <div className="logo">
            <Layout className="icon" />
            <h1>Nokia Config Visualizer</h1>
          </div>
        </div>

        <div className="header-right">
          <FileUpload onConfigLoaded={handleConfigLoaded} variant="header" />
        </div>
      </header>

      <main className="app-main" onMouseUp={stopResizing}>
        <aside
          ref={sidebarRef}
          className={`sidebar ${!isSidebarOpen ? 'collapsed' : ''}`}
          style={{ width: isSidebarOpen ? sidebarWidth : 0 }}
        >
          <div className="sidebar-content">
            {device ? (
              <InterfaceList
                interfaces={device.interfaces}
                selectedNames={selectedInterfaces}
                onToggle={handleToggleInterface}
                onSetSelected={handleSetSelected}
              />
            ) : (
              <div className="empty-sidebar">
                <p>Upload a config file to see interfaces.</p>
              </div>
            )}
          </div>
        </aside>

        <div
          className={`resizer ${isResizing ? 'resizing' : ''}`}
          onMouseDown={startResizing}
          style={{ display: isSidebarOpen ? 'block' : 'none' }}
        />

        <section className="content">
          {device ? (
            <DiagramViewer diagrams={diagrams} />
          ) : (
            <div className="empty-state">
              <h3>No Configuration Loaded</h3>
              <p>Please upload a file to start.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
