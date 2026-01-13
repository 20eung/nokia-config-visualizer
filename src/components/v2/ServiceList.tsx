import { useState } from 'react';
import type { L2VPNService } from '../../types/v2';
import { ChevronDown, ChevronRight } from 'lucide-react';
import './ServiceList.css';

interface ServiceListProps {
    services: L2VPNService[];
    selectedServiceIds: number[];
    onToggleService: (serviceId: number) => void;
    onSetSelected: (serviceIds: number[]) => void;
}

export function ServiceList({
    services,
    selectedServiceIds,
    onToggleService,
    onSetSelected,
}: ServiceListProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'epipe' | 'vpls' | 'vprn'>('all');
    const [filterCustomer, setFilterCustomer] = useState<number | 'all'>('all');

    // 고유한 Customer ID 목록
    const customerIds = Array.from(new Set(services.map(s => s.customerId))).sort((a, b) => a - b);

    // 필터링된 서비스
    const filteredServices = services.filter(service => {
        // 타입 필터
        if (filterType !== 'all' && service.serviceType !== filterType) {
            return false;
        }

        // Customer 필터
        if (filterCustomer !== 'all' && service.customerId !== filterCustomer) {
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

    // 타입별 그룹화
    const epipeServices = filteredServices.filter(s => s.serviceType === 'epipe');
    const vplsServices = filteredServices.filter(s => s.serviceType === 'vpls');
    const vprnServices = filteredServices.filter(s => s.serviceType === 'vprn');

    const handleSelectAll = () => {
        onSetSelected(filteredServices.map(s => s.serviceId));
    };

    const handleSelectNone = () => {
        onSetSelected([]);
    };

    // 그룹 접기/펼침 상태 (기본값: 모두 펼침)
    const [expandedGroups, setExpandedGroups] = useState<{ [key: string]: boolean }>({
        epipe: true,
        vpls: true,
        vprn: true,
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
                <h2>L2 VPN Services</h2>
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
                    </div>
                </div>

                {/* Customer 필터: 사용자가 2명 이상일 때만 표시 */}
                {customerIds.length > 1 && (
                    <div className="filter-group">
                        <label>Customer:</label>
                        <select
                            value={filterCustomer}
                            onChange={(e) => setFilterCustomer(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                            className="filter-select"
                        >
                            <option value="all">All</option>
                            {customerIds.map(id => (
                                <option key={id} value={id}>Customer {id}</option>
                            ))}
                        </select>
                    </div>
                )}
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
                                {epipeServices.map(service => {
                                    // Debug: Determine match reason
                                    const query = searchQuery.toLowerCase();
                                    const matchReasons = [];
                                    if (searchQuery) {
                                        if (service.serviceId.toString().includes(query)) matchReasons.push('ID');
                                        if (service.description.toLowerCase().includes(query)) matchReasons.push('Desc');
                                        if (service.serviceName && service.serviceName.toLowerCase().includes(query)) matchReasons.push('Name');
                                        if (service.customerId.toString().includes(query)) matchReasons.push('Cust');
                                    }

                                    return (
                                        <div
                                            key={service.serviceId}
                                            className={`service-item ${selectedServiceIds.includes(service.serviceId) ? 'selected' : ''}`}
                                            onClick={() => onToggleService(service.serviceId)}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedServiceIds.includes(service.serviceId)}
                                                onChange={() => { }}
                                                className="service-checkbox"
                                            />
                                            <div className="service-info">
                                                <div className="service-title">
                                                    Epipe {service.serviceId}
                                                </div>
                                                <div className="service-description">
                                                    {service.description}
                                                </div>
                                                <div className="service-meta">
                                                    <span className="meta-item">Customer {service.customerId}</span>
                                                    {/* @ts-ignore */}
                                                    <span className="meta-item">{service.saps.length} SAPs</span>
                                                    {'spokeSdps' in service && service.spokeSdps && service.spokeSdps.length > 0 && (
                                                        <span className="meta-item">{service.spokeSdps.length} SDPs</span>
                                                    )}
                                                </div>
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
                                {vplsServices.map(service => (
                                    <div
                                        key={service.serviceId}
                                        className={`service-item ${selectedServiceIds.includes(service.serviceId) ? 'selected' : ''}`}
                                        onClick={() => onToggleService(service.serviceId)}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedServiceIds.includes(service.serviceId)}
                                            onChange={() => { }}
                                            className="service-checkbox"
                                        />
                                        <div className="service-info">
                                            <div className="service-title">
                                                VPLS {service.serviceId}
                                            </div>
                                            <div className="service-description">
                                                {service.description}
                                            </div>
                                            <div className="service-meta">
                                                <span className="meta-item">Customer {service.customerId}</span>
                                                {/* @ts-ignore */}
                                                <span className="meta-item">{service.saps.length} SAPs</span>
                                                {'spokeSdps' in service && service.spokeSdps && service.spokeSdps.length > 0 && (
                                                    <span className="meta-item">{service.spokeSdps.length} Spoke SDPs</span>
                                                )}
                                                {'meshSdps' in service && service.meshSdps && service.meshSdps.length > 0 && (
                                                    <span className="meta-item">{service.meshSdps.length} Mesh SDPs</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
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
                                {vprnServices.map(service => (
                                    <div
                                        key={service.serviceId}
                                        className={`service-item ${selectedServiceIds.includes(service.serviceId) ? 'selected' : ''}`}
                                        onClick={() => onToggleService(service.serviceId)}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedServiceIds.includes(service.serviceId)}
                                            onChange={() => { }}
                                            className="service-checkbox"
                                        />
                                        <div className="service-info">
                                            <div className="service-title">
                                                VPRN {service.serviceId}
                                            </div>
                                            <div className="service-description">
                                                {service.description}
                                            </div>
                                            <div className="service-meta">
                                                <span className="meta-item">Customer {service.customerId}</span>
                                                {/* @ts-ignore */}
                                                <span className="meta-item">{service.interfaces.length} IFs</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {filteredServices.length === 0 && (
                    <div className="no-results">
                        <p>No services found showing</p>
                    </div>
                )}
            </div>
        </div>
    );
}
