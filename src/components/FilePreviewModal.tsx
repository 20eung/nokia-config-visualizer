import React, { useState, useEffect, useRef } from 'react';
import X from 'lucide-react/dist/esm/icons/x';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import Check from 'lucide-react/dist/esm/icons/check';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import Plus from 'lucide-react/dist/esm/icons/plus';

interface FilePreviewModalProps {
    files: File[];
    onConfirm: (files: File[]) => void;
    onCancel: () => void;
    onAddFiles: (files: File[]) => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ files, onConfirm, onCancel, onAddFiles }) => {
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const initial = new Set<number>();
        files.forEach((_, idx) => initial.add(idx));
        setSelectedIndices(initial);
    }, [files]);

    const toggleFile = (index: number) => {
        const next = new Set(selectedIndices);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        setSelectedIndices(next);
    };

    const handleConfirm = () => {
        const finalFiles = files.filter((_, idx) => selectedIndices.has(idx));
        onConfirm(finalFiles);
    };

    const handleAddClick = () => fileInputRef.current?.click();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onAddFiles(Array.from(e.target.files));
            e.target.value = '';
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        return (bytes / 1024).toFixed(1) + ' KB';
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] backdrop-blur-[2px] animate-fade-in">
            <div className="bg-white dark:bg-gray-800 w-[500px] max-w-[90vw] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700 animate-slide-up">
                {/* Header */}
                <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h3 className="m-0 text-lg flex items-center gap-2 text-gray-800 dark:text-gray-100">
                        <FileText size={20} />
                        Upload Preview
                    </h3>
                    <button onClick={onCancel} className="bg-transparent border-none cursor-pointer text-gray-400 dark:text-gray-500 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-all">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 max-h-[60vh] overflow-y-auto">
                    <p className="mb-4 text-gray-500 dark:text-gray-400 text-sm">
                        Please review the files to be analyzed. Uncheck any files you wish to exclude.
                    </p>

                    <div className="flex flex-col gap-2">
                        {files.map((file, idx) => {
                            const isSelected = selectedIndices.has(idx);
                            return (
                                <div
                                    key={`${file.name}-${idx}`}
                                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                                        isSelected
                                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-600'
                                            : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 opacity-60'
                                    } hover:border-blue-500`}
                                    onClick={() => toggleFile(idx)}
                                >
                                    <div className={`w-5 h-5 rounded border-2 mr-3 flex items-center justify-center transition-all ${
                                        isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-400 dark:border-gray-500'
                                    }`}>
                                        {isSelected && <Check size={14} />}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-medium text-gray-800 dark:text-gray-200">{file.name}</span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">{formatSize(file.size)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {selectedIndices.size === 0 && (
                        <div className="flex items-center gap-2 text-red-500 mt-4 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded-md">
                            <AlertCircle size={16} />
                            <span>No files selected. Upload will be cancelled.</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between bg-gray-50 dark:bg-gray-900">
                    <div>
                        <input type="file" multiple accept=".cfg,.txt,.conf" ref={fileInputRef} onChange={handleFileChange} className="hidden" id="modal-add-file" />
                        <button onClick={handleAddClick} className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 dark:border-gray-600 bg-transparent text-gray-700 dark:text-gray-300 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-all text-sm">
                            <Plus size={16} />
                            Add Files
                        </button>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onCancel} className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-transparent text-gray-700 dark:text-gray-300 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-all text-sm">
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md cursor-pointer hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
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
