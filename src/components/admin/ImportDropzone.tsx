import { useRef, useState } from 'react';
import { CloudUpload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function ImportDropzone({
  disabled,
  accept,
  supportText,
  maxSizeMB,
  onFileSelected,
  onRejected,
  selectedFileName,
}: {
  disabled?: boolean;
  accept: string;
  supportText: string;
  maxSizeMB: number;
  onFileSelected: (file: File) => void;
  onRejected?: (reason: string) => void;
  selectedFileName?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const pickFile = () => inputRef.current?.click();

  const handleFile = (file: File) => {
    if (!file) return;
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      onRejected?.(`Ukuran file terlalu besar (maks ${maxSizeMB}MB)`);
      return;
    }
    onFileSelected(file);
  };

  return (
    <div
      className={cn(
        'rounded-lg border border-dashed bg-muted/20 transition-colors',
        dragActive ? 'border-primary bg-primary/5' : 'border-border/70',
        disabled ? 'opacity-60 pointer-events-none' : '',
      )}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          if (inputRef.current) inputRef.current.value = '';
        }}
      />

      <div className="px-5 py-6 flex flex-col items-center text-center">
        <div className="h-11 w-11 rounded-xl bg-background border border-border/60 shadow-sm flex items-center justify-center">
          <CloudUpload className="h-5 w-5 text-primary" />
        </div>
        <div className="mt-4 text-sm font-semibold text-foreground">
          Drag and drop files here
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {supportText} (Max {maxSizeMB}MB)
        </div>
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={pickFile} disabled={disabled}>
            Browse Files
          </Button>
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          {selectedFileName ? <span className="font-medium text-foreground">{selectedFileName}</span> : 'Belum ada file dipilih'}
        </div>
      </div>
    </div>
  );
}
