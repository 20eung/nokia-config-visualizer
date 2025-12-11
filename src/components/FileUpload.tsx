import React, { type ChangeEvent } from 'react';
import { Upload } from 'lucide-react';

interface FileUploadProps {
  onConfigLoaded: (content: string) => void;
}

export const FileUpload: React.FC<FileUploadProps & { variant?: 'default' | 'header' }> = ({ 
  onConfigLoaded, 
  variant = 'default' 
}) => {
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    onConfigLoaded(text);
    
    // Reset value to allow uploading same file again
    e.target.value = '';
  };

  if (variant === 'header') {
    return (
      <div className="file-upload-header">
        <input
          type="file"
          accept=".cfg,.txt,.conf"
          onChange={handleFileChange}
          id="header-upload"
          style={{ display: 'none' }}
        />
        <label htmlFor="header-upload" className="btn-upload">
          <Upload size={16} />
          <span>Upload Config</span>
        </label>
      </div>
    );
  }

  return (
    <div className="file-upload-container">
      <input
        type="file"
        accept=".cfg,.txt,.conf"
        onChange={handleFileChange}
        id="file-upload"
      />
      <label htmlFor="file-upload" className="file-upload-area compact">
        <Upload className="icon" size={28} strokeWidth={1.5} />
        <span className="text">Click to upload Config File</span>
        <span className="subtext">.cfg, .txt support</span>
      </label>
    </div>
  );
};
