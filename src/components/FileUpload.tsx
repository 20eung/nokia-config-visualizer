import React, { type ChangeEvent, useState } from 'react';
import Upload from 'lucide-react/dist/esm/icons/upload';
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
      e.target.value = '';
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
        <div className="flex items-center">
          <input type="file" accept=".cfg,.txt,.conf" onChange={handleFileChange} id={inputId} className="hidden" multiple />
          <label htmlFor={inputId} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium cursor-pointer hover:bg-blue-700 transition-colors">
            <Upload size={16} />
            <span>Upload Config</span>
          </label>
        </div>
      ) : variant === 'compact' ? (
        <div>
          <input type="file" accept=".cfg,.txt,.conf" onChange={handleFileChange} id={inputId} className="hidden" multiple />
          <label htmlFor={inputId} className="flex items-center justify-center gap-1.5 w-full px-3 py-2.5 bg-slate-500 text-white rounded-md cursor-pointer text-sm font-medium hover:bg-slate-600 transition-colors">
            <Upload size={16} />
            <span>Upload</span>
          </label>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <input type="file" accept=".cfg,.txt,.conf" onChange={handleFileChange} id={inputId} multiple className="hidden" />
          <label htmlFor={inputId} className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-gray-300 dark:border-gray-600 p-5 text-center rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-800 hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
            <Upload className="text-gray-400" size={28} strokeWidth={1.5} />
            <span className="text-sm text-gray-600 dark:text-gray-300">Click to upload Config File</span>
            <span className="text-xs text-gray-400">.cfg, .txt support</span>
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
