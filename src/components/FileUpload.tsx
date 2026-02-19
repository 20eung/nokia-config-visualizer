import React, { type ChangeEvent, useState } from 'react';
import { Upload } from 'lucide-react';
import { FilePreviewModal } from './FilePreviewModal';

interface FileUploadProps {
  onConfigLoaded: (contents: string[]) => void;
}

export const FileUpload: React.FC<FileUploadProps & { variant?: 'default' | 'header' | 'compact' }> = ({
  onConfigLoaded,
  variant = 'default'
}) => {
  const [previewFiles, setPreviewFiles] = useState<File[] | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setPreviewFiles(Array.from(e.target.files));
      e.target.value = ''; // Reset input to allow re-selection if cancelled
    }
  };

  const handleConfirmUpload = async (files: File[]) => {
    const fileContents: string[] = [];
    for (const file of files) {
      const text = await file.text();
      fileContents.push(text);
    }
    onConfigLoaded(fileContents);
    setPreviewFiles(null);
  };

  const handleCancelUpload = () => {
    setPreviewFiles(null);
  };

  const inputId = `file-upload-${variant}`;

  return (
    <>
      {variant === 'header' ? (
        <div className="file-upload-header">
          <input
            type="file"
            accept=".cfg,.txt,.conf"
            onChange={handleFileChange}
            id={inputId}
            style={{ display: 'none' }}
            multiple
          />
          <label htmlFor={inputId} className="btn-upload">
            <Upload size={16} />
            <span>Upload Config</span>
          </label>
        </div>
      ) : variant === 'compact' ? (
        <div className="file-upload-compact">
          <input
            type="file"
            accept=".cfg,.txt,.conf"
            onChange={handleFileChange}
            id={inputId}
            style={{ display: 'none' }}
            multiple
          />
          <label htmlFor={inputId} className="btn-upload-compact">
            <Upload size={16} />
            <span>Upload</span>
          </label>
        </div>
      ) : (
        <div className="file-upload-container">
          <input
            type="file"
            accept=".cfg,.txt,.conf"
            onChange={handleFileChange}
            id={inputId}
            multiple
          />
          <label htmlFor={inputId} className="file-upload-area compact">
            <Upload className="icon" size={28} strokeWidth={1.5} />
            <span className="text">Click to upload Config File</span>
            <span className="subtext">.cfg, .txt support</span>
          </label>
        </div>
      )}

      {previewFiles && (
        <FilePreviewModal
          files={previewFiles}
          onConfirm={handleConfirmUpload}
          onCancel={handleCancelUpload}
          onAddFiles={(newFiles) => setPreviewFiles(prev => [...(prev || []), ...newFiles])}
        />
      )}
    </>
  );
};
