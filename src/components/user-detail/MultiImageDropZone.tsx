import { useState, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Upload, X, Plus, ImageIcon, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MultiImageDropZoneProps {
  label: string;
  icon: React.ReactNode;
  previews: string[];
  onChange: (previews: string[]) => void;
  emptyText: string;
  maxFiles?: number;
  disabled?: boolean;
  onExtract?: () => void;
  isExtracting?: boolean;
  compact?: boolean;
}

export function MultiImageDropZone({ 
  label, 
  icon, 
  previews, 
  onChange, 
  emptyText, 
  maxFiles = 3, 
  disabled = false,
  onExtract,
  isExtracting = false,
  compact = false
}: MultiImageDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const processFiles = (files: FileList | null) => {
    if (!files) return;
    
    const remainingSlots = maxFiles - previews.length;
    if (remainingSlots <= 0) {
      toast.error(`Maksimal ${maxFiles} gambar`);
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    const newPreviews: string[] = [];

    filesToProcess.forEach((file) => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} bukan file gambar`);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} terlalu besar (maks. 5MB)`);
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        newPreviews.push(reader.result as string);
        if (newPreviews.length === filesToProcess.length) {
          onChange([...previews, ...newPreviews]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const handleClick = () => {
    if (disabled || previews.length >= maxFiles) return;
    inputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    // Reset input so same file can be selected again
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRemove = (index: number, e: React.MouseEvent) => {
    if (disabled) return;
    e.stopPropagation();
    const newPreviews = previews.filter((_, i) => i !== index);
    onChange(newPreviews);
  };

  const canAddMore = previews.length < maxFiles;

  // Compact mode for side-by-side layout
  if (compact) {
    return (
      <div className="h-full">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
          multiple
        />
        <div
          onClick={previews.length === 0 ? handleClick : undefined}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-2xl transition-all h-full min-h-[180px] flex flex-col p-3",
            disabled ? "opacity-70" : "",
            isDragging 
              ? "border-primary bg-primary/10" 
              : disabled 
                ? "border-border" 
                : "border-border hover:border-primary/50 hover:bg-muted/30",
            previews.length === 0 && !disabled ? "cursor-pointer" : ""
          )}
        >
          {previews.length > 0 ? (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-2">
                <Label className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  {icon}
                  {label}
                </Label>
                <span className="text-[10px] text-muted-foreground">{previews.length}/{maxFiles}</span>
              </div>
              <div className="flex-1 grid grid-cols-3 gap-2">
                {previews.map((preview, index) => (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden border bg-muted/50 group">
                    <img 
                      src={preview} 
                      alt={`${label} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {!disabled && (
                      <button
                        onClick={(e) => handleRemove(index, e)}
                        className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full shadow-md hover:bg-destructive/90 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                ))}
                {canAddMore && !disabled && (
                  <button
                    onClick={handleClick}
                    className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-0.5 transition-colors border-border hover:border-primary/50 hover:bg-muted/40"
                  >
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
              {previews.length > 0 && onExtract && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onExtract}
                  disabled={isExtracting || disabled}
                  className="gap-1.5 h-7 text-xs mt-2 w-full"
                >
                  {isExtracting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  Ekstrak Data
                </Button>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                {icon}
              </div>
              <p className="text-xs font-medium text-foreground mb-0.5">{label}</p>
              <p className="text-[10px] text-muted-foreground">
                {disabled ? 'Klik Edit' : `Maks. ${maxFiles} gambar`}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wide">
          {icon}
          {label}
        </Label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {previews.length}/{maxFiles} gambar
          </span>
          {previews.length > 0 && onExtract && (
            <Button
              size="sm"
              variant="outline"
              onClick={onExtract}
              disabled={isExtracting || disabled}
              className="gap-1.5 h-7 text-xs"
            >
              {isExtracting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              Ekstrak Data
            </Button>
          )}
        </div>
      </div>
      
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
        multiple
      />

      {previews.length > 0 ? (
        <div className="space-y-3">
          {/* Image Grid */}
          <div className="grid grid-cols-3 gap-3">
            {previews.map((preview, index) => (
              <div key={index} className="relative aspect-square rounded-lg overflow-hidden border bg-muted/50 group">
                <img 
                  src={preview} 
                  alt={`${label} ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                {!disabled && (
                  <button
                    onClick={(e) => handleRemove(index, e)}
                    className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full shadow-md hover:bg-destructive/90 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
            
            {/* Add more button */}
            {canAddMore && !disabled && (
              <button
                onClick={handleClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors",
                  isDragging 
                    ? "border-primary bg-primary/10" 
                    : "border-border hover:border-primary/50 hover:bg-muted/40"
                )}
              >
                <Plus className="h-5 w-5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">Tambah</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative border-2 border-dashed rounded-xl transition-all p-8",
            disabled ? "cursor-default opacity-70" : "cursor-pointer",
            isDragging 
              ? "border-primary bg-primary/10" 
              : disabled 
                ? "border-border" 
                : "border-border hover:border-primary/50 hover:bg-muted/40"
          )}
        >
          <div className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <ImageIcon className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {disabled ? 'Klik Edit untuk mengunggah' : 'Klik atau drag & drop gambar di sini'}
            </p>
            <p className="text-xs text-muted-foreground">
              Format: JPG, PNG, WEBP (Maks. {maxFiles} gambar, 5MB per file)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
