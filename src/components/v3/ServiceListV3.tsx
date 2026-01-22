import { useState } from 'react';
import type { ParsedConfigV3, NokiaServiceV3 } from '../../utils/v3/parserV3';
import type { IESService, L3Interface } from '../../types/v2';
import { ChevronDown, ChevronRight } from 'lucide-react';
import '../v2/ServiceList.css';

interface ServiceListProps {
    services: NokiaServiceV3[];
    configs: ParsedConfigV3[];
    selectedServiceIds: string[];
    onToggleService: (serviceKey: string) => void;
    onSetSelected: (serviceKeys: string[]) => void;
}

export function ServiceListV3({
    services,
    configs: _configs,
    selectedServiceIds,
    onToggleService,
    onSetSelected,
}: ServiceListProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'epipe' | 'vpls' | 'vprn' | 'ies'>('all');

    // 필터링된 서비스
    const filteredServices = services.filter(service => {
        // 타입 필터 (IES 포함)
        if (filterType !== 'all' && service.serviceType !== filterType) {
            return false;
        }

        // 검색 필터 (Enhanced with Hostname, Interfaces, IPs, BGP/OSPF, SAP/SDP)
        if (searchQuery) {
            const query = searchQuery.toLowerCase();

            // 기본 서비스 정보
            const basicMatch = (
                service.serviceId.toString().includes(query) ||
                service.description.toLowerCase().includes(query) ||
                (service.serviceName && service.serviceName.toLowerCase().includes(query)) ||
                service.customerId.toString().includes(query)
            );

            if (basicMatch) return true;

            // Hostname 검색
            const hostname = (service as any)._hostname;
            if (hostname && hostname.toLowerCase().includes(query)) return true;

            // 서비스 타입별 상세 검색
            if (service.serviceType === 'epipe') {
                // SAP IDs
                if ('saps' in service && service.saps) {
                    if (service.saps.some(sap => sap.sapId.toLowerCase().includes(query))) return true;
                }
                // SDP IDs
                if ('spokeSdps' in service && service.spokeSdps) {
                    if (service.spokeSdps.some(sdp =>
                        sdp.sdpId.toString().includes(query) ||
                        sdp.vcId.toString().includes(query)
                    )) return true;
                }
            } else if (service.serviceType === 'vpls') {
                // SAP IDs
                if ('saps' in service && service.saps) {
                    if (service.saps.some(sap => sap.sapId.toLowerCase().includes(query))) return true;
                }
                // Spoke SDP IDs
                if ('spokeSdps' in service && service.spokeSdps) {
                    if (service.spokeSdps.some(sdp =>
                        sdp.sdpId.toString().includes(query) ||
                        sdp.vcId.toString().includes(query)
                    )) return true;
                }
                // Mesh SDP IDs
                if ('meshSdps' in service && service.meshSdps) {
                    if (service.meshSdps.some(sdp => sdp.sdpId.toString().includes(query))) return true;
                }
            } else if (service.serviceType === 'vprn') {
                // Interfaces
                if ('interfaces' in service && service.interfaces) {
                    for (const iface of service.interfaces) {
                        // Interface Name
                        if (iface.interfaceName && iface.interfaceName.toLowerCase().includes(query)) return true;
                        // Interface Description
                        if (iface.description && iface.description.toLowerCase().includes(query)) return true;
                        // Port ID
                        if (iface.portId && iface.portId.toLowerCase().includes(query)) return true;
                        // IP Address
                        if (iface.ipAddress && iface.ipAddress.toLowerCase().includes(query)) return true;
                        // VPLS Name
                        if (iface.vplsName && iface.vplsName.toLowerCase().includes(query)) return true;
                        // Spoke SDP
                        if (iface.spokeSdpId && iface.spokeSdpId.toLowerCase().includes(query)) return true;
                    }
                }
                // BGP Information
                if ('bgpRouterId' in service && service.bgpRouterId) {
                    if (service.bgpRouterId.toLowerCase().includes(query)) return true;
                }
                if ('bgpNeighbors' in service && service.bgpNeighbors) {
                    if (service.bgpNeighbors.some(nbr =>
                        nbr.neighborIp.toLowerCase().includes(query) ||
                        (nbr.autonomousSystem && nbr.autonomousSystem.toString().includes(query))
                    )) return true;
                }
                // OSPF Information
                if ('ospf' in service && service.ospf && service.ospf.areas) {
                    for (const area of service.ospf.areas) {
                        // Area ID
                        if (area.areaId.toLowerCase().includes(query)) return true;
                        // OSPF Interfaces
                        if (area.interfaces && area.interfaces.some(intf =>
                            intf.interfaceName.toLowerCase().includes(query)
                        )) return true;
                    }
                }
                // AS, RD
                if ('autonomousSystem' in service && service.autonomousSystem) {
                    if (service.autonomousSystem.toString().includes(query)) return true;
                }
                if ('routeDistinguisher' in service && service.routeDistinguisher) {
                    if (service.routeDistinguisher.toLowerCase().includes(query)) return true;
                }
            } else if (service.serviceType === 'ies') {
                if ('interfaces' in service && service.interfaces) {
                    for (const iface of service.interfaces) {
                        if (iface.interfaceName && iface.interfaceName.toLowerCase().includes(query)) return true;
                        if (iface.description && iface.description.toLowerCase().includes(query)) return true;
                        if (iface.portId && iface.portId.toLowerCase().includes(query)) return true;
                        if (iface.ipAddress && iface.ipAddress.toLowerCase().includes(query)) return true;
                    }
                }
                if ('staticRoutes' in service && service.staticRoutes) {
                    if (service.staticRoutes.some(route => route.prefix.toLowerCase().includes(query))) return true;
                }
            }

            return false;
        }

        return true;
    }).sort((a, b) => a.serviceId - b.serviceId);

    // 서비스를 serviceId와 serviceType별로 그룹화
    const groupedServices = filteredServices.reduce((acc, service) => {
        let key = `${service.serviceType}-${service.serviceId}`;

        // IES (Base Router) special grouping by Hostname
        if (service.serviceType === 'ies') {
            const hostname = (service as any)._hostname || 'Unknown';
            key = `ies-${hostname}`;
        }

        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(service);
        return acc;
    }, {} as Record<string, NokiaServiceV3[]>);

    // 타입별 그룹화 (그룹화된 서비스 기준)
    const epipeServices = Object.values(groupedServices).filter(group => group[0].serviceType === 'epipe');
    const vplsServices = Object.values(groupedServices).filter(group => group[0].serviceType === 'vpls');
    const vprnServices = Object.values(groupedServices).filter(group => group[0].serviceType === 'vprn');
    const iesServices = Object.values(groupedServices).filter(group => group[0].serviceType === 'ies');

    const handleSelectAll = () => {
        onSetSelected(filteredServices.map(s => {
            if (s.serviceType === 'ies') {
                const hostname = (s as any)._hostname || 'Unknown';
                return `ies-${hostname}`;
            }
            return `${s.serviceType}-${s.serviceId}`;
        }));
    };

    const handleSelectNone = () => {
        onSetSelected([]);
    };

    // 그룹 접기/펼침 상태 (기본값: 모두 펼침)
    const [expandedGroups, setExpandedGroups] = useState<{ [key: string]: boolean }>({
        epipe: true,
        vpls: true,
        vprn: true,
        ies: true,
    });

    const [expandedIESHosts, setExpandedIESHosts] = useState<{ [key: string]: boolean }>({});

    const toggleGroup = (group: string) => {
        setExpandedGroups(prev => ({
            ...prev,
            [group]: !prev[group]
        }));
    };

    return (
        <div className="service-list">
            <div className="service-list-header">
                <h2>Network Services</h2>
                <div className="service-count">
                    {filteredServices.length} service{filteredServices.length !== 1 ? 's' : ''}
                </div>
            </div>

            {/* 검색 */}
            <div className="service-search">
                <input
                    type="text"
                    placeholder="🔍 Search services..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                />
            </div>

            {/* 필터 */}
            <div className="service-filters">
                <div className="filter-group">
                    <label>Type:</label>
                    <div className="filter-buttons">
                        <button
                            className={filterType === 'all' ? 'active' : ''}
                            onClick={() => setFilterType('all')}
                        >
                            All
                        </button>
                        <button
                            className={filterType === 'epipe' ? 'active' : ''}
                            onClick={() => setFilterType('epipe')}
                        >
                            Epipe
                        </button>
                        <button
                            className={filterType === 'vpls' ? 'active' : ''}
                            onClick={() => setFilterType('vpls')}
                        >
                            VPLS
                        </button>
                        <button
                            className={filterType === 'vprn' ? 'active' : ''}
                            onClick={() => setFilterType('vprn')}
                        >
                            VPRN
                        </button>
                        <button
                            className={filterType === 'ies' ? 'active' : ''}
                            onClick={() => setFilterType('ies')}
                        >
                            IES
                        </button>
                    </div>
                </div>
            </div>

            {/* 선택 버튼 */}
            <div className="service-actions">
                <button onClick={handleSelectAll} className="action-btn">
                    Select All
                </button>
                <button onClick={handleSelectNone} className="action-btn">
                    Select None
                </button>
            </div>


            {/* Services Content (Scrollable) - Force Remount on Search Change */}
            <div className="service-list-content" key={searchQuery}>
                {/* Epipe 서비스 */}
                {epipeServices.length > 0 && (
                    <div className="service-group">
                        <div
                            className="service-group-header clickable"
                            onClick={() => toggleGroup('epipe')}
                        >
                            <span className="group-toggle-icon">
                                {expandedGroups['epipe'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </span>
                            <span className="service-icon">🔗</span>
                            <h3>Epipe Services ({epipeServices.length})</h3>
                        </div>
                        {expandedGroups['epipe'] && (
                            <div className="service-items" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
                                {epipeServices.map(serviceGroup => {
                                    // 대표 서비스 (첫 번째)
                                    const representative = serviceGroup[0];

                                    return (
                                        <div
                                            key={representative.serviceId}
                                            className={`service-item ${selectedServiceIds.includes(`${representative.serviceType}-${representative.serviceId}`) ? 'selected' : ''}`}
                                            onClick={() => onToggleService(`${representative.serviceType}-${representative.serviceId}`)}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedServiceIds.includes(`${representative.serviceType}-${representative.serviceId}`)}
                                                onChange={() => { }}
                                                className="service-checkbox"
                                            />
                                            <div className="service-info">
                                                <div className="service-title">
                                                    Epipe {representative.serviceId}
                                                </div>
                                                <div className="service-description">
                                                    {representative.description}
                                                </div>
                                                {serviceGroup.map((service, idx) => {
                                                    // Use _hostname property that was injected in V3Page
                                                    const hostname = (service as any)._hostname || 'Unknown';

                                                    // SAP IDs 추출
                                                    const sapIds = 'saps' in service
                                                        ? service.saps.map(sap => sap.sapId).join(', ')
                                                        : '';

                                                    // SDP IDs 추출
                                                    const sdpIds = 'spokeSdps' in service && service.spokeSdps
                                                        ? service.spokeSdps.map(sdp => `${sdp.sdpId}:${sdp.vcId}`).join(', ')
                                                        : '';

                                                    return (
                                                        <div key={idx}>
                                                            <div className="service-meta">
                                                                <span className="meta-item" style={{ fontWeight: 'bold', color: '#0066cc' }}>{hostname}</span>
                                                            </div>
                                                            <div className="service-meta">
                                                                {sapIds && (
                                                                    <span className="meta-item">SAP: {sapIds}</span>
                                                                )}
                                                                {sdpIds && (
                                                                    <span className="meta-item">SDP: {sdpIds}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* VPLS 서비스 */}
                {vplsServices.length > 0 && (
                    <div className="service-group">
                        <div
                            className="service-group-header clickable"
                            onClick={() => toggleGroup('vpls')}
                        >
                            <span className="group-toggle-icon">
                                {expandedGroups['vpls'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </span>
                            <span className="service-icon">🌐</span>
                            <h3>VPLS Services ({vplsServices.length})</h3>
                        </div>
                        {expandedGroups['vpls'] && (
                            <div className="service-items" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
                                {vplsServices.map(serviceGroup => {
                                    const representative = serviceGroup[0];

                                    return (
                                        <div
                                            key={representative.serviceId}
                                            className={`service-item ${selectedServiceIds.includes(`${representative.serviceType}-${representative.serviceId}`) ? 'selected' : ''}`}
                                            onClick={() => onToggleService(`${representative.serviceType}-${representative.serviceId}`)}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedServiceIds.includes(`${representative.serviceType}-${representative.serviceId}`)}
                                                onChange={() => { }}
                                                className="service-checkbox"
                                            />
                                            <div className="service-info">
                                                <div className="service-title">
                                                    VPLS {representative.serviceId}
                                                </div>
                                                <div className="service-description">
                                                    {representative.description}
                                                </div>
                                                {serviceGroup.map((service, idx) => {
                                                    const hostname = (service as any)._hostname || 'Unknown';

                                                    const sapIds = 'saps' in service ? service.saps.map(sap => sap.sapId).join(', ') : '';
                                                    const spokeSdpIds = 'spokeSdps' in service && service.spokeSdps ? service.spokeSdps.map(sdp => `${sdp.sdpId}:${sdp.vcId}`).join(', ') : '';
                                                    const meshSdpIds = 'meshSdps' in service && service.meshSdps ? service.meshSdps.map(sdp => `${sdp.sdpId}`).join(', ') : '';

                                                    return (
                                                        <div key={idx}>
                                                            <div className="service-meta">
                                                                <span className="meta-item" style={{ fontWeight: 'bold', color: '#0066cc' }}>{hostname}</span>
                                                            </div>
                                                            <div className="service-meta">
                                                                {sapIds && <span className="meta-item">SAP: {sapIds}</span>}
                                                                {spokeSdpIds && <span className="meta-item">Spoke SDP: {spokeSdpIds}</span>}
                                                                {meshSdpIds && <span className="meta-item">Mesh SDP: {meshSdpIds}</span>}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* VPRN 서비스 */}
                {vprnServices.length > 0 && (
                    <div className="service-group">
                        <div
                            className="service-group-header clickable"
                            onClick={() => toggleGroup('vprn')}
                        >
                            <span className="group-toggle-icon">
                                {expandedGroups['vprn'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </span>
                            <span className="service-icon">📡</span>
                            <h3>VPRN Services ({vprnServices.length})</h3>
                        </div>
                        {expandedGroups['vprn'] && (
                            <div className="service-items" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
                                {vprnServices.map(serviceGroup => {
                                    const representative = serviceGroup[0];

                                    return (
                                        <div
                                            key={representative.serviceId}
                                            className={`service-item ${selectedServiceIds.includes(`${representative.serviceType}-${representative.serviceId}`) ? 'selected' : ''}`}
                                            onClick={() => onToggleService(`${representative.serviceType}-${representative.serviceId}`)}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedServiceIds.includes(`${representative.serviceType}-${representative.serviceId}`)}
                                                onChange={() => { }}
                                                className="service-checkbox"
                                            />
                                            <div className="service-info">
                                                <div className="service-title">
                                                    VPRN {representative.serviceId}
                                                </div>
                                                <div className="service-description">
                                                    {representative.description}
                                                </div>
                                                {serviceGroup.map((service, idx) => {
                                                    const hostname = (service as any)._hostname || 'Unknown';

                                                    const ifNames = 'interfaces' in service ? service.interfaces.map(intf => intf.interfaceName).join(', ') : '';

                                                    return (
                                                        <div key={idx}>
                                                            <div className="service-meta">
                                                                <span className="meta-item" style={{ fontWeight: 'bold', color: '#0066cc' }}>{hostname}</span>
                                                            </div>
                                                            <div className="service-meta">
                                                                {ifNames && <span className="meta-item">IF: {ifNames}</span>}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* IES 서비스 (Base Router) */}
                {iesServices.length > 0 && (
                    <div className="service-group">
                        <div
                            className="service-group-header clickable"
                            onClick={() => toggleGroup('ies')}
                        >
                            <span className="group-toggle-icon">
                                {expandedGroups['ies'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </span>
                            <span className="service-icon">🌐</span>
                            <h3>IES Services ({iesServices.length})</h3>
                        </div>
                        {expandedGroups['ies'] && (
                            <div className="service-items" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
                                {iesServices.map(serviceGroup => {
                                    const representative = serviceGroup[0] as IESService;
                                    const hostname = (representative as any)._hostname || 'Unknown';
                                    const fullHostKey = `ies-${hostname}`;

                                    // Collect all interfaces from this group (usually one service object but handled loosely)
                                    const allInterfaces: (L3Interface & { _parentService: IESService })[] = [];
                                    serviceGroup.forEach(s => {
                                        if ((s as IESService).interfaces) {
                                            (s as IESService).interfaces.forEach(i => allInterfaces.push({ ...i, _parentService: s as IESService }));
                                        }
                                    });

                                    const isHostExpanded = expandedIESHosts[hostname];

                                    // Calculate Selection State
                                    const isFullHostSelected = selectedServiceIds.includes(fullHostKey);
                                    const selectedCount = allInterfaces.filter(intf =>
                                        isFullHostSelected || selectedServiceIds.includes(`ies___${hostname}___${intf.interfaceName}`)
                                    ).length;
                                    const isAllSelected = allInterfaces.length > 0 && selectedCount === allInterfaces.length;
                                    const isPartialSelected = selectedCount > 0 && selectedCount < allInterfaces.length;

                                    // Handlers
                                    const toggleHostAccordion = (e: React.MouseEvent) => {
                                        e.stopPropagation();
                                        setExpandedIESHosts(prev => ({ ...prev, [hostname]: !prev[hostname] }));
                                    };

                                    const handleHostSelect = (e: React.MouseEvent) => {
                                        e.stopPropagation();
                                        let newSelected = [...selectedServiceIds];

                                        // Remove full host key and all specific keys for this host
                                        newSelected = newSelected.filter(id =>
                                            id !== fullHostKey && !id.startsWith(`ies___${hostname}___`)
                                        );

                                        if (!isAllSelected) {
                                            // Select All: Add individual keys for granular control
                                            allInterfaces.forEach(intf => {
                                                newSelected.push(`ies___${hostname}___${intf.interfaceName}`);
                                            });
                                        }
                                        onSetSelected(newSelected);
                                    };

                                    const handleInterfaceToggle = (interfaceName: string) => {
                                        const specificKey = `ies___${hostname}___${interfaceName}`;
                                        let newSelected = [...selectedServiceIds];

                                        // If full host currently selected, explode it
                                        if (newSelected.includes(fullHostKey)) {
                                            newSelected = newSelected.filter(id => id !== fullHostKey);
                                            // Add all other interfaces
                                            allInterfaces.forEach(intf => {
                                                if (intf.interfaceName !== interfaceName) {
                                                    newSelected.push(`ies___${hostname}___${intf.interfaceName}`);
                                                }
                                            });
                                            // Don't add specificKey (we are toggling it OFF)
                                        } else {
                                            if (newSelected.includes(specificKey)) {
                                                newSelected = newSelected.filter(id => id !== specificKey);
                                            } else {
                                                newSelected.push(specificKey);
                                            }
                                        }
                                        onSetSelected(newSelected);
                                    };

                                    return (
                                        <div key={`ies-group-${hostname}`} className="service-subgroup" style={{ marginBottom: '8px', border: '1px solid #eee', borderRadius: '4px', overflow: 'hidden' }}>
                                            {/* Hostname Header (Accordion) */}
                                            <div
                                                className="subgroup-header clickable"
                                                onClick={toggleHostAccordion}
                                                style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', background: '#f9fafb', cursor: 'pointer' }}
                                            >
                                                <span style={{ marginRight: '8px', display: 'flex' }}>
                                                    {isHostExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                </span>
                                                <input
                                                    type="checkbox"
                                                    checked={isAllSelected}
                                                    ref={el => { if (el) el.indeterminate = isPartialSelected; }}
                                                    onChange={() => { }} // Handled by div click or separate click handler
                                                    onClick={handleHostSelect}
                                                    style={{ marginRight: '8px' }}
                                                />
                                                <span className="service-title" style={{ flex: 1, margin: 0 }}>{hostname} ({allInterfaces.length})</span>
                                            </div>

                                            {/* Interfaces List */}
                                            {isHostExpanded && (
                                                <div className="subgroup-items" style={{ padding: '8px' }}>
                                                    {/* Quick Filters (Optional, can add later) */}
                                                    {allInterfaces.map((intf) => {
                                                        const isSelected = isFullHostSelected || selectedServiceIds.includes(`ies___${hostname}___${intf.interfaceName}`);
                                                        return (
                                                            <div
                                                                key={`${hostname}-${intf.interfaceName}`}
                                                                className={`interface-card ${isSelected ? 'selected' : ''}`}
                                                                onClick={() => handleInterfaceToggle(intf.interfaceName)}
                                                                style={{
                                                                    display: 'flex', alignItems: 'center',
                                                                    padding: '6px 10px', marginBottom: '4px',
                                                                    background: isSelected ? '#e3f2fd' : 'white',
                                                                    border: '1px solid #eee', borderRadius: '4px',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    onChange={() => { }}
                                                                    style={{ marginRight: '10px' }}
                                                                />
                                                                <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.9em' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                                        <span style={{ fontWeight: 'bold', color: '#0066cc', fontSize: '12px', marginRight: '8px' }}>{intf.interfaceName}</span>
                                                                        {intf.ipAddress && (
                                                                            <span style={{
                                                                                background: '#e8f5e9', color: '#2e7d32',
                                                                                padding: '1px 6px', borderRadius: '4px', fontSize: '0.85em'
                                                                            }}>
                                                                                {intf.ipAddress}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div style={{ color: '#666', fontSize: '0.85em', marginTop: '2px' }}>
                                                                        {intf.description || ''}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {filteredServices.length === 0 && (
                    <div className="no-results">
                        <p>No services found matching your filters.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
