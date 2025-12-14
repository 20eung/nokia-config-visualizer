import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, Check, AlertCircle, Plus } from 'lucide-react';

interface FilePreviewModalProps {
    files: File[];
    onConfirm: (files: File[]) => void;
    onCancel: () => void;
    onAddFiles: (files: File[]) => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ files, onConfirm, onCancel, onAddFiles }) => {
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize all selected by default
    useEffect(() => {
        // When files change, we want to keep previous selections or re-select all?
        // User requested: "Append files". Usually appending means existing selections stay, new ones get selected.
        // For simplicity, let's just select everything when the file list length increases (i.e. new files added).
        // Or better: Re-calculate indices.
        // If we simply rely on the index, filtering might get messed up if order changes.
        // But here files array grows. Let's just select all for now to be safe and simple.
        const initial = new Set<number>();
        files.forEach((_, idx) => initial.add(idx));
        setSelectedIndices(initial);
    }, [files]);

    const toggleFile = (index: number) => {
        const next = new Set(selectedIndices);
        if (next.has(index)) {
            next.delete(index);
        } else {
            next.add(index);
        }
        setSelectedIndices(next);
    };

    const handleConfirm = () => {
        const finalFiles = files.filter((_, idx) => selectedIndices.has(idx));
        onConfirm(finalFiles);
    };

    const handleAddClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onAddFiles(Array.from(e.target.files));
            e.target.value = ''; // Reset
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        const k = bytes / 1024;
        return k.toFixed(1) + ' KB';
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h3>
                        <FileText size={20} />
                        Upload Preview
                    </h3>
                    <button onClick={onCancel} className="icon-btn-text">
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    <p className="description">
                        Please review the files to be analyzed. Uncheck any files you wish to exclude.
                    </p>

                    <div className="file-list">
                        {files.map((file, idx) => {
                            const isSelected = selectedIndices.has(idx);
                            return (
                                <div
                                    key={`${file.name}-${idx}`}
                                    className={`file-item ${isSelected ? 'selected' : 'excluded'}`}
                                    onClick={() => toggleFile(idx)}
                                >
                                    <div className={`checkbox ${isSelected ? 'checked' : ''}`}>
                                        {isSelected && <Check size={14} />}
                                    </div>
                                    <div className="file-info">
                                        <span className="name">{file.name}</span>
                                        <span className="size">{formatSize(file.size)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {selectedIndices.size === 0 && (
                        <div className="warning-msg">
                            <AlertCircle size={16} />
                            <span>No files selected. upload will be cancelled.</span>
                        </div>
                    )}
                </div>

                <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                    <div className="left-actions">
                        <input
                            type="file"
                            multiple
                            accept=".cfg,.txt,.conf"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                            id="modal-add-file"
                        />
                        <button onClick={handleAddClick} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Plus size={16} />
                            Add Files
                        </button>
                    </div>
                    <div className="right-actions" style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={onCancel} className="btn-secondary">
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="btn-primary"
                            disabled={selectedIndices.size === 0}
                        >
                            Start Analysis ({selectedIndices.size})
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
