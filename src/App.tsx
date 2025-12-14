import { processConfigFiles } from './utils/TopologyEngine';
import { generateMermaidDiagram } from './utils/mermaidGenerator';
import type { NokiaDevice, NetworkTopology } from './types';
import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { FileUpload } from './components/FileUpload';
import { ConfigSelector } from './components/ConfigSelector';
import { InterfaceList } from './components/InterfaceList';
import { DiagramViewer } from './components/DiagramViewer';
import { Menu } from 'lucide-react';
import './App.css';

function App() {
  const [topology, setTopology] = useState<NetworkTopology>({ devices: [], links: [], haPairs: [] });
  const devices = topology.devices;
  const device = devices.length > 0 ? devices[0] : null;
  const [selectedInterfaces, setSelectedInterfaces] = useState<string[]>([]);

  // Layout State
  const [sidebarWidth, setSidebarWidth] = useState(320);
  // Default sidebar to true for easier desktop usage/testing
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

    if (isBetaEnvironment && devices.length === 0) {
      fetch('/docs/config.txt')
        .then(response => {
          if (!response.ok) throw new Error('Failed to load test config');
          return response.text();
        })
        .then(text => {
          handleConfigLoaded([text]);
          console.log('✅ Beta environment: Auto-loaded docs/config.txt');
        })
        .catch(error => {
          console.warn('⚠️ Beta environment: Could not auto-load config:', error);
        });
    }
  }, []); // Run once on mount

  const handleConfigLoaded = (contents: string[]) => {
    try {
      const newTopology = processConfigFiles(contents);
      setTopology(newTopology);
      setSelectedInterfaces([]); // Reset selection
    } catch (e) {
      alert('Failed to parse config file.');
      console.error(e);
    }
  };

  // Temporary debug helper
  useEffect(() => {
    (window as any).loadDebugConfig = (content: string) => handleConfigLoaded([content]);
  }, []);

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
    if (devices.length === 0) return [];
    return generateMermaidDiagram(topology, selectedInterfaces);
  }, [topology, selectedInterfaces]);

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
            <img src="/favicon.svg" alt="App Icon" className="app-icon" style={{ height: '36px', width: '36px' }} />
            <h1>Nokia Config Visualizer</h1>
          </div>
        </div>

        <div className="header-right">
          {window.location.hostname.includes('beta') && (
            <ConfigSelector onConfigLoaded={handleConfigLoaded} />
          )}
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
            {devices.length > 0 ? (
              <InterfaceList
                devices={devices}
                topology={topology}
                selectedIds={selectedInterfaces}
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
