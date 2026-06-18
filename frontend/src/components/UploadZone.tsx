import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useApi } from '../hooks/useApi';

interface UploadZoneProps {
  onUploadSuccess: () => void;
}

export default function UploadZone({ onUploadSuccess }: UploadZoneProps) {
  const api = useApi();
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setErrorMsg('Invalid file format. Only PDF documents are allowed.');
      setSuccessMsg(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('File is too large. Limit is 10MB.');
      setSuccessMsg(null);
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsUploading(true);
    setUploadProgress(20); // Initial progress cue

    try {
      setUploadProgress(50);
      await api.uploadDocument(file);
      setUploadProgress(100);
      setSuccessMsg(`"${file.name}" uploaded successfully!`);
      
      // Delay reset of progress states so user sees completion checkmark
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(null);
        onUploadSuccess();
      }, 1000);
    } catch (err: any) {
      console.error('[UploadZone] upload error:', err);
      setErrorMsg(err.response?.data?.error?.message || err.message || 'Failed to upload document.');
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileSelect = () => {
    if (!isUploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="w-full">
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerFileSelect}
        className={`relative w-full p-8 rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center text-center cursor-pointer group 
          ${isDragActive 
            ? 'border-brand-500 bg-brand-500/10 shadow-lg shadow-brand-500/5' 
            : 'border-slate-800 bg-slate-900/10 hover:bg-slate-900/20 hover:border-brand-500/40'
          } 
          ${isUploading ? 'pointer-events-none opacity-80' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="hidden"
          disabled={isUploading}
        />

        {isUploading ? (
          <div className="flex flex-col items-center py-4">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-4" />
            <h4 className="font-semibold text-slate-200 text-sm">Uploading document...</h4>
            <p className="text-xs text-slate-500 mt-1">Please wait while we secure your file</p>
            {uploadProgress !== null && (
              <div className="w-48 bg-slate-850 h-1.5 rounded-full mt-4 overflow-hidden">
                <div 
                  className="bg-brand-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className={`p-4 rounded-full bg-slate-900 border border-slate-800 text-brand-400 group-hover:text-brand-350 transition-colors 
              ${isDragActive ? 'scale-110 text-brand-350 bg-slate-850' : 'group-hover:scale-105'}`}>
              <Upload className="w-6.5 h-6.5" />
            </div>
            
            <h4 className="font-semibold text-slate-200 text-sm mt-4">
              Drag and drop your PDF here, or <span className="text-brand-400 font-medium">browse</span>
            </h4>
            <p className="text-xs text-slate-500 mt-1">PDF format only (Max size: 10MB)</p>
          </div>
        )}
      </div>

      {/* Upload Feedback logs */}
      {errorMsg && (
        <div className="mt-3 p-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="mt-3 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-xs flex items-center gap-2.5">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
    </div>
  );
}
