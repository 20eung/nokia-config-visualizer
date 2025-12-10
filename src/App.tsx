import { useState, useMemo } from 'react';
import { parseNokiaConfig } from './utils/nokiaParser';
import { generateMermaidDiagram } from './utils/mermaidGenerator';
import type { NokiaDevice } from './types';
import { FileUpload } from './components/FileUpload';
import { InterfaceList } from './components/InterfaceList';
import { DiagramViewer } from './components/DiagramViewer';
import { Layout } from 'lucide-react';
import './App.css';

function App() {
  const [device, setDevice] = useState<NokiaDevice | null>(null);
  const [selectedInterfaces, setSelectedInterfaces] = useState<string[]>([]);

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

  const handleSelectAll = () => {
    if (device) setSelectedInterfaces(device.interfaces.map(i => i.name));
  };

  const handleClearAll = () => {
    setSelectedInterfaces([]);
  };

  const mermaidCode = useMemo(() => {
    if (!device) return '';
    return generateMermaidDiagram(device, selectedInterfaces);
  }, [device, selectedInterfaces]);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <Layout className="icon" />
          <h1>Nokia Config Visualizer</h1>
        </div>
        <p>Upload a config file to generate network topology diagrams.</p>
      </header>

      <main className="app-main">
        <aside className="sidebar">
          <div className="card">
            <h2>Configuration</h2>
            <FileUpload onConfigLoaded={handleConfigLoaded} />
          </div>

          {device && (
            <div className="card list-card">
              <InterfaceList
                interfaces={device.interfaces}
                selectedNames={selectedInterfaces}
                onToggle={handleToggleInterface}
                onSelectAll={handleSelectAll}
                onClearAll={handleClearAll}
              />
            </div>
          )}
        </aside>

        <section className="content">
          {device ? (
            <DiagramViewer chart={mermaidCode} />
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
