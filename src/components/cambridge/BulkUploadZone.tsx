import { useState, useRef, useCallback } from 'react';
import { Upload, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BulkUploadZoneProps {
  onFilesDropped: (files: File[]) => void;
  isUploading: boolean;
  disabled?: boolean;
  accept?: string;
}

export function BulkUploadZone({
  onFilesDropped,
  isUploading,
  disabled = false,
  accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png'
}: BulkUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  }, [disabled, isUploading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || isUploading) return;

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      onFilesDropped(droppedFiles);
    }
  }, [disabled, isUploading, onFilesDropped]);

  const handleClick = () => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      onFilesDropped(selectedFiles);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "relative flex flex-col items-center justify-center gap-4 p-8 rounded-xl border-2 border-dashed transition-all cursor-pointer",
        isDragging 
          ? "border-primary bg-primary/5 scale-[1.02]" 
          : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
        (disabled || isUploading) && "opacity-50 cursor-not-allowed hover:border-muted-foreground/25 hover:bg-transparent"
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isUploading}
      />

      <div className={cn(
        "w-16 h-16 rounded-full flex items-center justify-center transition-colors",
        isDragging ? "bg-primary/20" : "bg-muted"
      )}>
        {isUploading ? (
          <FileText className="h-8 w-8 text-muted-foreground animate-pulse" />
        ) : (
          <Upload className={cn(
            "h-8 w-8 transition-colors",
            isDragging ? "text-primary" : "text-muted-foreground"
          )} />
        )}
      </div>

      <div className="text-center">
        <p className={cn(
          "font-medium transition-colors",
          isDragging ? "text-primary" : "text-foreground"
        )}>
          {isUploading 
            ? "Mengupload dokumen..."
            : isDragging 
              ? "Lepaskan file di sini"
              : "Drag & drop file di sini"
          }
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {isUploading 
            ? "Mohon tunggu proses upload selesai"
            : "atau klik untuk memilih file (PDF, DOC, JPG, PNG)"
          }
        </p>
      </div>

      {!isUploading && !disabled && (
        <p className="text-xs text-muted-foreground">
          Mendukung upload banyak file sekaligus
        </p>
      )}
    </div>
  );
}
