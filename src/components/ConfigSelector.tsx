
import React, { useState } from 'react';
import { FileText, ChevronDown } from 'lucide-react';

interface ConfigSelectorProps {
    onConfigLoaded: (content: string) => void;
}

const DEMO_CONFIGS = [
    { id: 'custom', name: 'Select Config', path: '' },
    { id: 'conf1', name: 'Demo Config 1 (BB3)', path: '/docs/config1.txt' },
    { id: 'conf2', name: 'Demo Config 2 (BB4)', path: '/docs/config2.txt' },
];

export const ConfigSelector: React.FC<ConfigSelectorProps> = ({ onConfigLoaded }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSelect = async (path: string) => {
        if (!path) return;

        setLoading(true);
        setIsOpen(false);

        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error('Failed to load config');
            const text = await response.text();
            onConfigLoaded(text);
        } catch (error) {
            console.error('Error loading config:', error);
            alert('Failed to load demo configuration.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="config-selector relative inline-block text-left">
            <div>
                <button
                    type="button"
                    className="btn-upload"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <FileText size={16} />
                    <span>{loading ? 'Loading...' : 'Select Config'}</span>
                    <ChevronDown size={16} />
                </button>
            </div>

            {isOpen && (
                <div className="dropdown-menu">
                    <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                        {DEMO_CONFIGS.filter(c => c.path).map((config) => (
                            <button
                                key={config.id}
                                onClick={() => handleSelect(config.path)}
                                className="dropdown-item"
                                role="menuitem"
                            >
                                {config.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Backdrop to close menu */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
};
