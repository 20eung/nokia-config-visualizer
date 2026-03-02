import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { parseL2VPNConfig } from '../utils/v3/parserV3';
import { generateServiceDiagram } from '../utils/v3/mermaidGeneratorV3';
import type { ParsedConfigV3 } from '../utils/v3/parserV3';
import type { NokiaService, IESService, VPRNService, EpipeService } from '../types/services';
import { ServiceListV3 } from '../components/v3/ServiceListV3';
import { ServiceDiagram } from '../components/v3/ServiceDiagram';
import { Dashboard } from '../components/v3/Dashboard';
import { FileUpload } from '../components/FileUpload';
import PanelLeft from 'lucide-react/dist/esm/icons/panel-left';
import PanelLeftClose from 'lucide-react/dist/esm/icons/panel-left-close';
import FolderOpen from 'lucide-react/dist/esm/icons/folder-open';
import FolderIcon from 'lucide-react/dist/esm/icons/folder';
import LayoutDashboard from 'lucide-react/dist/esm/icons/layout-dashboard';
import List from 'lucide-react/dist/esm/icons/list';
import Sun from 'lucide-react/dist/esm/icons/sun';
import Moon from 'lucide-react/dist/esm/icons/moon';
import X from 'lucide-react/dist/esm/icons/x';
import { convertIESToV1Format, generateCrossDeviceIESDiagrams } from '../utils/v1IESAdapter';
import { useConfigWebSocket } from '../hooks/useConfigWebSocket';
import { ConfigFileList } from '../components/v3/ConfigFileList';
import { FolderPathSettings } from '../components/v3/FolderPathSettings';
import { useConfigSync } from '../hooks/useConfigSync';
import { useDarkMode } from '../hooks/useDarkMode';

type ViewMode = 'dashboard' | 'services';

export function V3Page() {
  const [configs, setConfigs] = useState<ParsedConfigV3[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');

  const { isDark, toggleTheme } = useDarkMode();

  const {
    status: wsStatus,
    configFiles,
    fileGroups,
    activeFiles,
    toggleFile
  } = useConfigWebSocket();

  useConfigSync(configs);

  const [showFolderSettings, setShowFolderSettings] = useState(false);
  const [showConfigFileList, setShowConfigFileList] = useState(false);

  useEffect(() => {
    const isDemoEnvironment = window.location.hostname.includes('demo') || window.location.hostname.includes('beta');

    if (isDemoEnvironment && configs.length === 0) {
      Promise.all([
        fetch('/config1.txt').then(r => r.text()),
        fetch('/config2.txt').then(r => r.text())
      ])
        .then(texts => {
          handleConfigLoaded(texts);
          console.log('Demo/Beta environment: Auto-loaded config1.txt & config2.txt');
        })
        .catch(error => {
          console.warn('Demo/Beta environment: Could not auto-load sample config:', error);
        });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfigLoaded = (contents: string[]) => {
    try {
      const parsedConfigs: ParsedConfigV3[] = [];
      contents.forEach(content => {
        const parsed = parseL2VPNConfig(content);
        if (parsed.hostname || parsed.services.length > 0) {
          parsedConfigs.push(parsed);
        }
      });

      if (parsedConfigs.length > 0) {
        setConfigs(parsedConfigs);
        setSelectedServiceIds([]);
      } else {
        alert('No valid configuration found in the uploaded files.');
      }
    } catch (error) {
      console.error('Failed to parse L2 VPN config:', error);
      alert('Failed to parse L2 VPN configuration file.');
    }
  };

  // Auto Config Loading 이벤트 리스닝
  useEffect(() => {
    const handleFileToggle = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { activeFiles: newActiveFiles } = customEvent.detail;
      try {
        const contents = await Promise.all(
          newActiveFiles.map(async (filename: string) => {
            const res = await fetch(`/api/config/file/${filename}`);
            return res.text();
          })
        );
        handleConfigLoaded(contents);
      } catch (error) {
        console.error('[V3Page] Failed to load config files:', error);
        alert('Config 파일 로드 실패');
      }
    };

    window.addEventListener('config-file-selected', handleFileToggle);
    window.addEventListener('config-file-removed', handleFileToggle);
    return () => {
      window.removeEventListener('config-file-selected', handleFileToggle);
      window.removeEventListener('config-file-removed', handleFileToggle);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleLoadAll = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { filenames } = customEvent.detail;
      try {
        // 배치 fetch: 브라우저 동시 연결 제한 대응 (10개씩)
        const BATCH_SIZE = 10;
        const contents: string[] = [];
        for (let i = 0; i < filenames.length; i += BATCH_SIZE) {
          const batch = filenames.slice(i, i + BATCH_SIZE);
          const batchContents = await Promise.all(
            batch.map(async (filename: string) => {
              const res = await fetch(`/api/config/file/${filename}`);
              return res.text();
            })
          );
          contents.push(...batchContents);
        }
        handleConfigLoaded(contents);
      } catch (error) {
        console.error('[V3Page] Failed to load config files:', error);
        alert('Config 파일 로드 실패');
      }
    };

    window.addEventListener('config-files-load-all', handleLoadAll);
    return () => window.removeEventListener('config-files-load-all', handleLoadAll);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeFilesRef = useRef(activeFiles);
  useEffect(() => {
    activeFilesRef.current = activeFiles;
  });

  useEffect(() => {
    const handleFileChanged = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { filename } = customEvent.detail;
      try {
        const contents = await Promise.all(
          activeFilesRef.current.map(async (fname: string) => {
            const res = await fetch(`/api/config/file/${fname}`);
            return res.text();
          })
        );
        handleConfigLoaded(contents);
        alert(`파일이 변경되어 자동으로 다시 로드되었습니다: ${filename}`);
      } catch (error) {
        console.error('[V3Page] Failed to reload changed file:', error);
      }
    };

    window.addEventListener('config-file-changed', handleFileChanged);
    return () => window.removeEventListener('config-file-changed', handleFileChanged);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleService = useCallback((serviceKey: string) => {
    setSelectedServiceIds(prev =>
      prev.includes(serviceKey)
        ? prev.filter(key => key !== serviceKey)
        : [...prev, serviceKey]
    );
  }, []);

  const handleSetSelected = useCallback(
    (updater: string[] | ((prev: string[]) => string[])) => {
      setSelectedServiceIds(updater);
    },
    []
  );

  // Dashboard에서 사이트 클릭 시 해당 사이트 Config 선택 + 서비스 뷰 전환
  const handleSiteClick = useCallback((hostnames: string[]) => {
    // 해당 사이트의 모든 서비스를 선택
    const keys: string[] = [];
    configs.forEach(c => {
      if (hostnames.includes(c.hostname)) {
        c.services.forEach(s => {
          if (s.serviceType === 'ies') {
            (s as IESService).interfaces.forEach(intf => {
              keys.push(`ies___${c.hostname}___${intf.interfaceName}`);
            });
          } else {
            keys.push(`${s.serviceType}-${s.serviceId}`);
          }
        });
      }
    });
    setSelectedServiceIds(keys);
    setViewMode('services');
  }, [configs]);

  const startResizing = (mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);
  };

  const stopResizing = () => setIsResizing(false);

  const resize = (mouseMoveEvent: MouseEvent) => {
    if (isResizing) {
      const newWidth = mouseMoveEvent.clientX;
      if (newWidth > 200 && newWidth < 800) {
        setSidebarWidth(newWidth);
      }
    }
  };

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing]);

  const allServices = useMemo(() =>
    configs.flatMap(c =>
      c.services.map(s => {
        const serviceWithHostname = { ...s, _hostname: c.hostname };
        if ('saps' in serviceWithHostname && serviceWithHostname.saps) {
          serviceWithHostname.saps = serviceWithHostname.saps.map(sap => ({ ...sap, _hostname: c.hostname }));
        }
        if ('interfaces' in serviceWithHostname && serviceWithHostname.interfaces) {
          serviceWithHostname.interfaces = serviceWithHostname.interfaces.map(intf => ({ ...intf, _hostname: c.hostname }));
        }
        return serviceWithHostname;
      })
    ),
    [configs]
  );

  const selectedServices = useMemo(() =>
    ((allServices as any[]).flatMap(s => {
      if (s.serviceType === 'ies') {
        const hostname = (s as any)._hostname;
        if (selectedServiceIds.includes(`ies-${hostname}`)) return [s];
        const prefix = `ies___${hostname}___`;
        const selectedInterfaceKeys = selectedServiceIds.filter(id => id.startsWith(prefix));
        if (selectedInterfaceKeys.length > 0) {
          const selectedInterfaceNames = new Set(selectedInterfaceKeys.map(key => key.replace(prefix, '')));
          const iesService = s as IESService & { _hostname: string };
          return [{ ...iesService, interfaces: iesService.interfaces.filter((intf: any) => selectedInterfaceNames.has(intf.interfaceName)) }];
        }
        return [];
      }
      if (s.serviceType === 'vprn') {
        const hostname = (s as any)._hostname;
        const serviceId = s.serviceId;
        if (selectedServiceIds.includes(`vprn-${serviceId}`)) return [s];
        const prefix = `vprn___${serviceId}___${hostname}___`;
        const selectedInterfaceKeys = selectedServiceIds.filter(id => id.startsWith(prefix));
        if (selectedInterfaceKeys.length > 0) {
          const selectedInterfaceNames = new Set(selectedInterfaceKeys.map(key => key.replace(prefix, '')));
          const vprnService = s as VPRNService & { _hostname: string };
          return [{ ...vprnService, interfaces: vprnService.interfaces.filter((intf: any) => selectedInterfaceNames.has(intf.interfaceName)) }];
        }
        return [];
      }
      if (selectedServiceIds.includes(`${s.serviceType}-${s.serviceId}`)) return [s];
      return [];
    })) as (NokiaService & { _hostname: string })[],
    [allServices, selectedServiceIds]
  );

  const remoteDeviceMap = useMemo(() => {
    const map = new Map<string, string>();
    configs.forEach(c => { if (c.systemIp && c.hostname) map.set(c.systemIp, c.hostname); });
    return map;
  }, [configs]);

  const configByHostname = useMemo(() =>
    new Map(configs.map(c => [c.hostname, c])),
    [configs]
  );

  const serviceGroups = useMemo(() => selectedServices.reduce((acc, service) => {
    let key = `${service.serviceType}-${service.serviceId}`;
    if (service.serviceType === 'ies') {
      const hostname = (service as any)._hostname || 'Unknown';
      key = `ies-${hostname}`;
    }
    if (!acc[key]) acc[key] = [];
    acc[key].push(service);
    return acc;
  }, {} as Record<string, typeof selectedServices>), [selectedServices]);

  type DiagramItem = {
    service: NokiaService & { _hostname: string };
    diagram: string;
    hostname: string;
    diagramName?: string;
    description?: string;
  };

  const iesGroupEntries = useMemo(() =>
    Object.entries(serviceGroups).filter(([, group]) => group[0].serviceType === 'ies'),
    [serviceGroups]
  );
  const nonIesGroupEntries = useMemo(() =>
    Object.entries(serviceGroups).filter(([, group]) => group[0].serviceType !== 'ies'),
    [serviceGroups]
  );

  const iesDiagrams: DiagramItem[] = useMemo(() => {
    if (iesGroupEntries.length === 0) return [];
    const deviceEntries: Array<{
      v1Device: import('../types').NokiaDevice;
      selectedInterfaceNames: string[];
      hostname: string;
      representativeService: NokiaService & { _hostname: string };
    }> = [];

    iesGroupEntries.forEach(([, group]) => {
      const iesServices = group as (IESService & { _hostname: string })[];
      const hostname = iesServices[0]._hostname || 'Unknown';
      const mergedInterfaces = iesServices.flatMap(s => s.interfaces.map(intf => ({ ...intf, _hostname: s._hostname })));
      const mergedService: IESService & { _hostname: string } = { ...iesServices[0], interfaces: mergedInterfaces };
      const parentConfig = configByHostname.get(hostname);
      const aggregatedStaticRoutes: Array<{ prefix: string; nextHop: string }> = [];
      if (parentConfig) {
        parentConfig.services.forEach(service => {
          if (service.serviceType === 'ies') {
            const ies = service as IESService;
            ies.staticRoutes?.forEach(route => aggregatedStaticRoutes.push({ prefix: route.prefix, nextHop: route.nextHop }));
          }
        });
      }
      const v1Device = convertIESToV1Format(mergedService, hostname, aggregatedStaticRoutes);
      const fullHostKey = `ies-${hostname}`;
      const selectedInterfaceNames = selectedServiceIds.includes(fullHostKey)
        ? mergedInterfaces.map(i => i.interfaceName)
        : selectedServiceIds.filter(id => id.startsWith(`ies___${hostname}___`)).map(id => id.replace(`ies___${hostname}___`, ''));
      if (selectedInterfaceNames.length > 0) {
        deviceEntries.push({ v1Device, selectedInterfaceNames, hostname, representativeService: mergedService });
      }
    });

    if (deviceEntries.length === 0) return [];
    const crossDeviceDiagrams = generateCrossDeviceIESDiagrams(
      deviceEntries.map(e => ({ v1Device: e.v1Device, selectedInterfaceNames: e.selectedInterfaceNames }))
    );

    return crossDeviceDiagrams.map(d => {
      const diagramInterfaces = deviceEntries.flatMap(e => {
        const service = e.representativeService as IESService & { _hostname: string };
        if (!d.usedHostnames.includes(e.hostname)) return [];
        return service.interfaces.filter(intf => intf.portId && d.usedPortIds.includes(intf.portId));
      });
      const representativeService: IESService & { _hostname: string } = {
        ...(deviceEntries[0].representativeService as IESService & { _hostname: string }),
        interfaces: diagramInterfaces,
      };
      return {
        service: representativeService as NokiaService & { _hostname: string },
        diagram: d.code,
        hostname: d.usedHostnames.join(' + '),
        diagramName: d.name,
        description: d.description
      };
    });
  }, [iesGroupEntries, configByHostname, selectedServiceIds]);

  const nonIesDiagrams: DiagramItem[] = useMemo(() => nonIesGroupEntries.flatMap<DiagramItem>(([, group]) => {
    const servicesWithContext = group.map(service => {
      const hostname = (service as any)._hostname || 'Unknown';
      const parentConfig = configByHostname.get(hostname);
      return { service, hostname, sdps: parentConfig?.sdps || [] };
    });
    const representativeService = servicesWithContext[0].service;

    if (representativeService.serviceType === 'vprn') {
      const allInterfaces = servicesWithContext.flatMap(ctx => (ctx.service as VPRNService & { _hostname: string }).interfaces || []);
      const mergedVPRNService = { ...(representativeService as VPRNService), interfaces: allInterfaces } as NokiaService & { _hostname: string };
      return [{ service: mergedVPRNService, diagram: generateServiceDiagram(servicesWithContext.map(s => s.service), servicesWithContext.map(s => s.hostname), servicesWithContext[0].sdps, remoteDeviceMap), hostname: servicesWithContext.map(s => s.hostname).join(' + ') }];
    }

    if (representativeService.serviceType === 'epipe') {
      const sdpSubGroups = new Map<string, typeof servicesWithContext>();
      servicesWithContext.forEach(ctx => {
        const epipe = ctx.service as EpipeService;
        const sdpKey = epipe.spokeSdps?.length ? `${epipe.spokeSdps[0].sdpId}:${epipe.spokeSdps[0].vcId}` : 'no-sdp';
        if (!sdpSubGroups.has(sdpKey)) sdpSubGroups.set(sdpKey, []);
        sdpSubGroups.get(sdpKey)!.push(ctx);
      });
      return Array.from(sdpSubGroups.values()).map(subGroup => {
        const allSaps = subGroup.flatMap(ctx => (ctx.service as EpipeService & { _hostname: string }).saps || []);
        const mergedEpipeService = { ...(subGroup[0].service as EpipeService), saps: allSaps } as NokiaService & { _hostname: string };
        return { service: mergedEpipeService, diagram: generateServiceDiagram(subGroup.map(s => s.service), subGroup.map(s => s.hostname), subGroup[0].sdps, remoteDeviceMap), hostname: subGroup.map(s => s.hostname).join(' + ') };
      });
    }

    const allSaps = servicesWithContext.flatMap(ctx => { const s = ctx.service; return 'saps' in s && s.saps ? s.saps : []; });
    const mergedService = { ...representativeService, saps: allSaps } as NokiaService & { _hostname: string };
    return [{ service: mergedService, diagram: generateServiceDiagram(servicesWithContext.map(s => s.service), servicesWithContext.map(s => s.hostname), servicesWithContext[0].sdps, remoteDeviceMap), hostname: servicesWithContext.map(s => s.hostname).join(' + ') }];
  }), [nonIesGroupEntries, configByHostname, remoteDeviceMap]);

  const diagrams: DiagramItem[] = useMemo(() => [...iesDiagrams, ...nonIesDiagrams], [iesDiagrams, nonIesDiagrams]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-gray-900">
      {/* Header */}
      <header className="flex items-center justify-between h-16 px-3 sm:px-6 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          {/* Config 파일 목록 토글 */}
          <button
            className={`flex items-center gap-1.5 px-2 sm:px-3 py-2 border rounded-md text-sm font-medium transition-all shrink-0 ${
              showConfigFileList
                ? 'bg-sky-100 dark:bg-sky-900/40 border-sky-600 text-sky-600 dark:text-sky-400'
                : 'bg-transparent border-slate-200 dark:border-gray-600 text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700 hover:border-slate-300 hover:text-slate-700 dark:hover:text-gray-200'
            }`}
            onClick={() => setShowConfigFileList(!showConfigFileList)}
            title={showConfigFileList ? "Config 목록 닫기" : "Config 목록 열기"}
          >
            {showConfigFileList ? <FolderOpen size={20} /> : <FolderIcon size={20} />}
            <span className="select-none hidden sm:inline">Config</span>
          </button>

          {/* Services 사이드바 토글 */}
          {viewMode === 'services' && (
            <button
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-2 border rounded-md text-sm font-medium transition-all shrink-0 ${
                !isSidebarCollapsed
                  ? 'bg-sky-100 dark:bg-sky-900/40 border-sky-600 text-sky-600 dark:text-sky-400'
                  : 'bg-transparent border-slate-200 dark:border-gray-600 text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700'
              }`}
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              title={isSidebarCollapsed ? "Network Services 목록 열기" : "Network Services 목록 닫기"}
            >
              {isSidebarCollapsed ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
              <span className="select-none hidden sm:inline">Services</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            <img src="/favicon.svg" alt="App Icon" className="w-6 h-6 sm:w-8 sm:h-8 shrink-0" />
            <h1 className="hidden sm:block text-lg lg:text-xl font-semibold text-slate-900 dark:text-gray-100 m-0 truncate">
              NCV v{__APP_VERSION__}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-2">
          {/* Dashboard / Services 모드 토글 */}
          {configs.length > 0 && (
            <div className="flex border border-slate-200 dark:border-gray-600 rounded-lg overflow-hidden">
              <button
                className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 text-sm ${
                  viewMode === 'dashboard'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                onClick={() => setViewMode('dashboard')}
                title="Dashboard"
              >
                <LayoutDashboard size={16} />
                <span className="hidden sm:inline">Dashboard</span>
              </button>
              <button
                className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 text-sm ${
                  viewMode === 'services'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                onClick={() => setViewMode('services')}
                title="Services"
              >
                <List size={16} />
                <span className="hidden sm:inline">Services</span>
              </button>
            </div>
          )}

          {/* 다크모드 토글 */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg border border-slate-200 dark:border-gray-600 text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700 transition-all"
            title={isDark ? '라이트 모드' : '다크 모드'}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {/* Folder Settings Modal */}
      {showFolderSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
          <div className="relative bg-white dark:bg-gray-800 rounded-lg max-w-[700px] w-[90%] max-h-[90vh] overflow-auto">
            <button
              onClick={() => setShowFolderSettings(false)}
              className="absolute top-4 right-4 bg-transparent border-none cursor-pointer p-1 flex items-center text-gray-500 dark:text-gray-400"
            >
              <X size={24} />
            </button>
            <FolderPathSettings />
          </div>
        </div>
      )}

      <main className="flex flex-1 min-h-0 min-w-0 overflow-hidden" onMouseUp={stopResizing}>
        {/* Config File List Sidebar */}
        {showConfigFileList && (
        <aside
          className="w-[300px] min-w-[300px] bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shrink-0 overflow-hidden"
        >
          <ConfigFileList
            files={configFiles}
            groups={fileGroups}
            activeFiles={activeFiles}
            onToggleFile={toggleFile}
            isLoading={wsStatus === 'connecting'}
            connectionStatus={wsStatus}
            onShowSettings={() => setShowFolderSettings(true)}
            onUploadConfig={handleConfigLoaded}
          />
        </aside>
        )}

        {configs.length > 0 ? (
          viewMode === 'dashboard' ? (
            <Dashboard configs={configs} onSiteClick={handleSiteClick} />
          ) : (
            <>
              <aside
                className={`bg-white dark:bg-gray-800 border-r border-slate-200 dark:border-gray-700 flex flex-col shrink-0 transition-[width] duration-300 ease-linear ${
                  isSidebarCollapsed ? 'w-0 overflow-hidden border-r-0' : ''
                }`}
                style={{ width: isSidebarCollapsed ? 0 : sidebarWidth, transition: isResizing ? 'none' : undefined }}
              >
                <ServiceListV3
                  services={allServices}
                  configs={configs}
                  selectedServiceIds={selectedServiceIds}
                  onToggleService={handleToggleService}
                  onSetSelected={handleSetSelected}
                />
              </aside>

              {!isSidebarCollapsed && (
                <div
                  className={`w-2 shrink-0 cursor-col-resize z-10 transition-colors ${
                    isResizing ? 'bg-blue-500' : 'bg-slate-200 dark:bg-gray-700 hover:bg-slate-400 dark:hover:bg-gray-500'
                  }`}
                  onMouseDown={startResizing}
                />
              )}

              <section className="flex-1 overflow-y-auto p-6 bg-slate-100 dark:bg-gray-900">
                {diagrams.length > 0 ? (
                  <div className="flex flex-col gap-6 max-w-[1200px] mx-auto">
                    {Object.entries(
                      diagrams.reduce((acc, item) => {
                        const key = `${item.service.serviceType}_${item.service.serviceId}`;
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(item);
                        return acc;
                      }, {} as Record<string, typeof diagrams>)
                    ).map(([groupKey, group]) => {
                      const firstService = group[0].service;
                      return (
                        <div key={groupKey} className={`flex flex-col gap-4 ${group.length > 1 ? 'bg-slate-200/40 dark:bg-gray-800/60 border-2 border-dashed border-slate-300 dark:border-gray-600 rounded-xl p-5' : ''}`}>
                          {group.length > 1 && firstService.serviceType !== 'ies' && (
                            <div className="flex items-center gap-2 pb-2 border-b-2 border-dashed border-slate-300 dark:border-gray-600 mb-2">
                              <h3 className="m-0 text-lg text-slate-600 dark:text-gray-300 font-semibold">Service Group (ID: {firstService.serviceId})</h3>
                            </div>
                          )}
                          <div className="flex flex-col gap-6">
                            {group.map(({ service, diagram, hostname, diagramName }, idx) => (
                              <ServiceDiagram
                                key={`${hostname}-${service.serviceId}-${idx}`}
                                service={service as any}
                                diagram={diagram}
                                hostname={hostname}
                                diagramName={diagramName}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-gray-400 text-lg gap-4 text-center">
                    <p>Select a service from the sidebar to view its diagram.</p>
                  </div>
                )}
              </section>
            </>
          )
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 text-slate-500 dark:text-gray-400 text-lg gap-4 text-center">
            <h3 className="text-gray-700 dark:text-gray-300">No Configuration Loaded</h3>
            <p>Please upload a Nokia configuration file to start.</p>
            <div>
              <FileUpload onConfigLoaded={handleConfigLoaded} variant="default" />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
