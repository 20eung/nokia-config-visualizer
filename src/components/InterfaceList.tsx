import React from 'react';
import type { NokiaInterface } from '../types';
import { CheckSquare, Square, Network } from 'lucide-react';

interface InterfaceListProps {
    interfaces: NokiaInterface[];
    selectedNames: string[];
    onToggle: (name: string) => void;
    onSelectAll: () => void;
    onClearAll: () => void;
}

export const InterfaceList: React.FC<InterfaceListProps> = ({
    interfaces,
    selectedNames,
    onToggle,
    onSelectAll,
    onClearAll
}) => {
    // Deduplicate is handled in parser, but sorting should be here or in parent.
    // Deduplicate is handled in parser, but sorting should be here or in parent.
    // Let's sort here to ensure display order.
    const sortedInterfaces = [...interfaces].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    if (sortedInterfaces.length === 0) {
        return <div className="no-data">No interfaces found.</div>;
    }

    return (
        <div className="interface-list-container">
            <div className="list-header">
                <h3 className="title">
                    <Network size={16} /> Interfaces ({sortedInterfaces.length})
                </h3>
                <div className="actions">
                    <button onClick={onSelectAll} className="btn-link">All</button>
                    <span className="sep">|</span>
                    <button onClick={onClearAll} className="btn-link text-secondary">None</button>
                </div>
            </div>

            <div className="list-content">
                {sortedInterfaces.map((intf) => {
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
                })}
            </div>
        </div>
    );
};
