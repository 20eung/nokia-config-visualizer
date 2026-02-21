import React, { useState, useMemo } from 'react';
import type { NokiaDevice, NetworkTopology } from '../types';
import { findPeerAndRoutes } from '../utils/mermaidGenerator';
import CheckSquare from 'lucide-react/dist/esm/icons/check-square';
import Square from 'lucide-react/dist/esm/icons/square';
import Network from 'lucide-react/dist/esm/icons/network';
import Search from 'lucide-react/dist/esm/icons/search';
import Server from 'lucide-react/dist/esm/icons/server';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';

interface InterfaceListProps {
    devices: NokiaDevice[];
    topology: NetworkTopology;
    selectedIds: string[];
    onToggle: (id: string) => void;
    onSetSelected: (ids: string[]) => void;
}

export const InterfaceList: React.FC<InterfaceListProps> = ({
    devices,
    topology,
    selectedIds,
    onToggle,
    onSetSelected
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [collapsedDevices, setCollapsedDevices] = useState<Set<string>>(new Set());

    // Helper to generate qualified ID
    const getQualifiedId = (hostname: string, intfName: string) => `${hostname}:${intfName}`;

    const filteredStructure = useMemo(() => {
        if (!searchTerm) {
            return devices.map(d => ({
                hostname: d.hostname,
                interfaces: d.interfaces
            }));
        }

        // Check if AND search (contains ' + ')
        const isAndSearch = searchTerm.includes(' + ');
        const searchTerms = isAndSearch
            ? searchTerm.split(' + ').map(t => t.trim().toLowerCase())
            : searchTerm.split(/\s+/).map(t => t.trim().toLowerCase()).filter(t => t.length > 0);

        return devices.map(d => {
            const matches = d.interfaces.filter(intf => {
                const searchFields = [
                    d.hostname,                    // hostname
                    intf.portId,                   // port
                    intf.portDescription,          // port description
                    intf.name,                     // interface name
                    intf.description,              // interface description
                    intf.ipAddress,                // ip address
                    intf.serviceDescription        // service description
                ].map(f => (f || '').toLowerCase());

                if (isAndSearch) {
                    // AND: All search terms must match at least one field
                    return searchTerms.every(term =>
                        searchFields.some(field => field.includes(term))
                    );
                } else {
                    // OR: At least one search term must match at least one field
                    return searchTerms.some(term =>
                        searchFields.some(field => field.includes(term))
                    );
                }
            });

            return {
                hostname: d.hostname,
                interfaces: matches
            };
        }).filter(group => group.interfaces.length > 0);

    }, [devices, searchTerm]);

    const totalInterfaceCount = filteredStructure.reduce((acc, curr) => acc + curr.interfaces.length, 0);

    const handleSelectAll = () => {
        const allIds = filteredStructure.flatMap(group =>
            group.interfaces.map(i => getQualifiedId(group.hostname, i.name))
        );
        onSetSelected(allIds);
    };

    const handleHAFilter = () => {
        // 1. Identify all Remote HA Pairs
        // A pair is defined by having a common network (routes) or just being in the list
        // findPeerAndRoutes returns a peerIp.
        // If peerIp matches any device in haPairs, we select it.
        // For VRRP pairs, the interface's own IP might also be in haPairs.

        const haIps = new Set<string>();
        topology.haPairs.forEach(pair => {
            haIps.add(pair.device1);
            haIps.add(pair.device2);
        });

        console.log('🔍 [HA Filter] HA IPs from pairs:', Array.from(haIps));

        const haInterfaceIds: string[] = [];

        // Iterate over ALL devices (not filteredStructure) to find all HA interfaces
        // This ensures we don't miss any HA pairs due to search filtering
        devices.forEach(device => {
            device.interfaces.forEach(intf => {
                const { peerIp } = findPeerAndRoutes(device, intf);
                const intfIp = intf.ipAddress?.split('/')[0] || '';

                // Check if either the peer IP or the interface's own IP is in HA pairs
                if (haIps.has(peerIp) || haIps.has(intfIp)) {
                    const qualifiedId = getQualifiedId(device.hostname, intf.name);
                    haInterfaceIds.push(qualifiedId);
                    console.log(`✅ [HA Filter] Selected: ${device.hostname}:${intf.name} (IP: ${intfIp}, Peer: ${peerIp})`);
                }
            });
        });

        console.log(`🎯 [HA Filter] Total interfaces selected: ${haInterfaceIds.length}`);
        onSetSelected(haInterfaceIds);
    };

    if (devices.length === 0) {
        return <div className="no-data">Upload a config file to see interfaces.</div>;
    }

    return (
        <div className="interface-list-container">
            <div className="search-container">
                <Search className="search-icon" size={18} />
                <input
                    type="text"
                    className="search-input"
                    placeholder="Search (OR: space, AND: ' + ')..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="list-header">
                <h3 className="title">
                    <Network size={16} /> Interfaces ({totalInterfaceCount})
                </h3>
                <div className="actions">
                    <button onClick={handleSelectAll} className="btn-link">All</button>
                    <span className="sep">|</span>
                    <button onClick={handleHAFilter} className="btn-link text-primary font-bold">이중화</button>
                    <span className="sep">|</span>
                    <button onClick={() => onSetSelected([])} className="btn-link text-secondary">None</button>
                </div>
            </div>

            <div className="list-content">
                {filteredStructure.length > 0 ? (
                    filteredStructure.map((group) => {
                        const isCollapsed = collapsedDevices.has(group.hostname);

                        return (
                            <div key={group.hostname} className="device-group">
                                <div
                                    className="device-header"
                                    onClick={() => {
                                        const newSet = new Set(collapsedDevices);
                                        if (isCollapsed) {
                                            newSet.delete(group.hostname);
                                        } else {
                                            newSet.add(group.hostname);
                                        }
                                        setCollapsedDevices(newSet);
                                    }}
                                    style={{ cursor: 'pointer', userSelect: 'none' }}
                                >
                                    {isCollapsed ? (
                                        <ChevronRight size={16} style={{ marginRight: '6px', flexShrink: 0 }} />
                                    ) : (
                                        <ChevronDown size={16} style={{ marginRight: '6px', flexShrink: 0 }} />
                                    )}
                                    <Server size={16} className="icon-server" style={{ marginRight: '6px', flexShrink: 0 }} />
                                    <span>{group.hostname}</span>
                                    <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#6b7280' }}>
                                        ({group.interfaces.length})
                                    </span>
                                </div>
                                {!isCollapsed && group.interfaces.map(intf => {
                                    const qId = getQualifiedId(group.hostname, intf.name);
                                    const isSelected = selectedIds.includes(qId);
                                    return (
                                        <div
                                            key={qId}
                                            onClick={() => onToggle(qId)}
                                            className={`int-item ${isSelected ? 'selected' : ''}`}
                                        >
                                            <div className={`checkbox ${isSelected ? 'checked' : ''}`}>
                                                {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                                            </div>
                                            <div className="info">
                                                <div className="name" title={intf.name}>{intf.name}</div>
                                                {intf.description && (
                                                    <div className="desc" title={intf.description}>
                                                        {intf.description}
                                                    </div>
                                                )}
                                                <div className="tags">
                                                    {intf.ipAddress && (
                                                        <span className="tag ip">{intf.ipAddress}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })
                ) : (
                    <div className="no-data">No matching interfaces found.</div>
                )}
            </div>
        </div>
    );
};
