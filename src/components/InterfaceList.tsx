import React, { useState, useMemo } from 'react';
import type { NokiaInterface } from '../types';
import { CheckSquare, Square, Network, Search } from 'lucide-react';

interface InterfaceListProps {
    interfaces: NokiaInterface[];
    selectedNames: string[];
    onToggle: (name: string) => void;
    onSetSelected: (names: string[]) => void;
}

export const InterfaceList: React.FC<InterfaceListProps> = ({
    interfaces,
    selectedNames,
    onToggle,
    onSetSelected
}) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredInterfaces = useMemo(() => {
        if (!searchTerm) {
            return interfaces;
        }
        const lowercasedFilter = searchTerm.toLowerCase();
        return interfaces.filter((intf) => {
            const portId = intf.portId?.toLowerCase() ?? '';
            const name = intf.name.toLowerCase();
            const description = intf.description?.toLowerCase() ?? '';
            const portDescription = intf.portDescription?.toLowerCase() ?? '';
            const serviceDescription = intf.serviceDescription?.toLowerCase() ?? '';
            const ipAddress = intf.ipAddress?.toLowerCase() ?? '';

            return (
                portId.includes(lowercasedFilter) ||
                name.includes(lowercasedFilter) ||
                description.includes(lowercasedFilter) ||
                portDescription.includes(lowercasedFilter) ||
                serviceDescription.includes(lowercasedFilter) ||
                ipAddress.includes(lowercasedFilter)
            );
        });
    }, [interfaces, searchTerm]);

    const sortedInterfaces = useMemo(() =>
        [...filteredInterfaces].sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        ), [filteredInterfaces]);

    if (interfaces.length === 0) {
        return <div className="no-data">No interfaces found.</div>;
    }

    return (
        <div className="interface-list-container">
            <div className="search-container">
                <Search className="search-icon" size={18} />
                <input
                    type="text"
                    className="search-input"
                    placeholder="Search interfaces..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="list-header">
                <h3 className="title">
                    <Network size={16} /> Interfaces ({sortedInterfaces.length})
                </h3>
                <div className="actions">
                    <button onClick={() => onSetSelected(sortedInterfaces.map(i => i.name))} className="btn-link">All</button>
                    <span className="sep">|</span>
                    <button onClick={() => onSetSelected([])} className="btn-link text-secondary">None</button>
                </div>
            </div>

            <div className="list-content">
                {sortedInterfaces.length > 0 ? (
                    sortedInterfaces.map((intf) => {
                        const isSelected = selectedNames.includes(intf.name);
                        return (
                            <div
                                key={intf.name}
                                onClick={() => onToggle(intf.name)}
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
                                        {intf.serviceId && (
                                            <span className="tag svc">Svc: {intf.serviceId}</span>
                                        )}
                                    </div>
                                </div>
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
