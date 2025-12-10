import React, { type ChangeEvent } from 'react';
import { Upload, FileText } from 'lucide-react';

interface FileUploadProps {
    onConfigLoaded: (content: string) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onConfigLoaded }) => {
    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const text = await file.text();
        onConfigLoaded(text);
    };

    return (
        <div className="file-upload-container">
            <input
                type="file"
                accept=".cfg,.txt,.conf"
                onChange={handleFileChange}
                id="file-upload"
            />
            <label htmlFor="file-upload" className="file-upload-area">
                <Upload className="icon" size={40} strokeWidth={1.5} />
                <span className="text">Click to upload Config File</span>
                <span className="subtext">.cfg, .txt support</span>
            </label>

            <div className="divider">
                <span>OR</span>
            </div>

            <div className="paste-area">
                <p className="label"><FileText size={12} /> Paste content manually</p>
                <textarea
                    placeholder="Paste config content here..."
                    onChange={(e) => onConfigLoaded(e.target.value)}
                />
            </div>
        </div>
    );
};
