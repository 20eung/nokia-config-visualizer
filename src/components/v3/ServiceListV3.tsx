import { useState } from 'react';
import type { ParsedConfigV3, NokiaServiceV3, IESService } from '../../utils/v3/parserV3';
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
    configs,
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

        // 검색 필터
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                service.serviceId.toString().includes(query) ||
                service.description.toLowerCase().includes(query) ||
                (service.serviceName && service.serviceName.toLowerCase().includes(query)) ||
                service.customerId.toString().includes(query)
            );
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
                            <div className="service-items">
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
                                                    // 해당 서비스가 속한 Config 찾기
                                                    const parentConfig = configs.find(c => c.services.includes(service));
                                                    const hostname = parentConfig?.hostname || 'Unknown';

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
                            <div className="service-items">
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
                                                    const parentConfig = configs.find(c => c.services.includes(service));
                                                    const hostname = parentConfig?.hostname || 'Unknown';

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
                            <div className="service-items">
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
                                                    const parentConfig = configs.find(c => c.services.includes(service));
                                                    const hostname = parentConfig?.hostname || 'Unknown';

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
                            <div className="service-items">
                                {iesServices.map(serviceGroup => {
                                    const representative = serviceGroup[0] as IESService;
                                    const hostname = (representative as any)._hostname || 'Unknown';
                                    const serviceKey = `ies-${hostname}`;

                                    return (
                                        <div
                                            key={serviceKey}
                                            className={`service-item ${selectedServiceIds.includes(serviceKey) ? 'selected' : ''}`}
                                            onClick={() => onToggleService(serviceKey)}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedServiceIds.includes(serviceKey)}
                                                onChange={() => { }}
                                                className="service-checkbox"
                                            />
                                            <div className="service-info">
                                                <div className="service-title">
                                                    IES (Base Router)
                                                </div>
                                                <div className="service-description">
                                                    Host: {hostname}
                                                </div>

                                                {/* Device Grouping for IES Interfaces */}
                                                {serviceGroup.map((item, idx) => {
                                                    const service = item as IESService;
                                                    if (!service.interfaces || service.interfaces.length === 0) return null;

                                                    return (
                                                        <div key={idx} className="service-device-group" style={{ marginTop: '8px', paddingLeft: '8px', borderLeft: '2px solid #eee' }}>
                                                            <div className="device-interfaces">
                                                                {service.interfaces.map((iface, ifIdx) => (
                                                                    <div key={ifIdx} className="interface-item" style={{ fontSize: '0.85em', marginLeft: '8px', marginTop: '4px', color: '#555', lineHeight: '1.4' }}>
                                                                        <div>
                                                                            <span style={{ fontWeight: '600' }}>{iface.interfaceName}</span>
                                                                            {iface.portId && <span style={{ marginLeft: '6px', color: '#777' }}>({iface.portId})</span>}
                                                                        </div>
                                                                        {iface.description && (
                                                                            <div style={{ fontStyle: 'italic', color: '#666' }}>{iface.description}</div>
                                                                        )}
                                                                        {iface.ipAddress && (
                                                                            <div style={{ color: '#0066cc' }}>{iface.ipAddress}</div>
                                                                        )}
                                                                    </div>
                                                                ))}
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

                {filteredServices.length === 0 && (
                    <div className="no-results">
                        <p>No services found matching your filters.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
