import { useState, useRef, useEffect, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Upload, X, Loader2, Pencil, Save, XCircle, FileText, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PsikologiExtractionResult } from './PsikologiExtractionResult';
import { MultiImageDropZone } from './MultiImageDropZone';
import { StifinExtractionResult } from './StifinExtractionResult';
interface DropZoneProps {
  label: string;
  icon: React.ReactNode;
  preview: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  emptyText: string;
  maxWidth?: string;
  disabled?: boolean;
  acceptPdf?: boolean;
}
function CompactDropZone({
  label,
  icon,
  preview,
  onChange,
  disabled = false,
  acceptPdf = true
}: DropZoneProps) {
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
  const handleDrop = (e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/') || acceptPdf && file.type === 'application/pdf') {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        if (inputRef.current) {
          inputRef.current.files = dataTransfer.files;
          const event = {
            target: inputRef.current
          } as React.ChangeEvent<HTMLInputElement>;
          onChange(event);
        }
      }
    }
  };
  const handleClick = () => {
    if (disabled) return;
    if (inputRef.current) {
      inputRef.current.click();
    }
  };
  const handleRemove = (e: React.MouseEvent) => {
    if (disabled) return;
    e.stopPropagation();
    if (inputRef.current) {
      inputRef.current.value = '';
      const event = {
        target: {
          files: null
        }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      onChange(event);
    }
  };
  const isPdf = preview?.includes('application/pdf') || preview?.endsWith('.pdf');
  return <div className="h-full">
      <input ref={inputRef} type="file" accept={acceptPdf ? "image/*,application/pdf" : "image/*"} onChange={onChange} className="hidden" disabled={disabled} />
      <div onClick={handleClick} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className={cn("relative border-2 border-dashed rounded-2xl transition-all h-full min-h-[180px] flex flex-col", disabled ? "cursor-default opacity-70" : "cursor-pointer", isDragging ? "border-primary bg-primary/10" : disabled ? "border-border" : "border-border hover:border-primary/50 hover:bg-muted/30", preview ? "p-3" : "p-6")}>
        {preview ? <div className="relative flex-1 flex flex-col">
            <Label className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">
              {icon}
              {label}
            </Label>
            {isPdf ? <div className="flex-1 flex items-center justify-center p-4 bg-muted/50 rounded-lg border">
                <div className="text-center">
                  <FileText className="h-10 w-10 mx-auto text-primary mb-2" />
                  <p className="text-sm font-medium text-foreground">Dokumen PDF</p>
                </div>
              </div> : <div className="flex-1 flex items-center justify-center">
                <img src={preview} alt={label} className="max-h-32 w-auto rounded-lg border border-border shadow-sm" />
              </div>}
            {!disabled && <button onClick={handleRemove} className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground rounded-full shadow-md hover:bg-destructive/90 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>}
          </div> : <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              {icon}
            </div>
            <p className="text-xs font-medium text-foreground mb-0.5">{label}</p>
            <p className="text-[10px] text-muted-foreground">
              {disabled ? 'Klik Edit' : 'Drag & drop'}
            </p>
          </div>}
      </div>
    </div>;
}

// Section header component
function SectionHeader({
  title,
  description,
  isEditMode,
  isSaving,
  onEdit,
  onSave,
  onCancel
}: {
  title: string;
  description: string;
  isEditMode: boolean;
  isSaving: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        {isEditMode ? <>
            <Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving} className="gap-1.5">
              <XCircle className="h-4 w-4" />
              Batal
            </Button>
            <Button size="sm" onClick={onSave} disabled={isSaving} className="gap-1.5">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan
            </Button>
          </> : <Button variant="outline" size="sm" onClick={onEdit} className="gap-1.5">
            <Pencil className="h-4 w-4" />
            Edit Dokumen
          </Button>}
      </div>
    </div>;
}
interface UserPsikologiTabProps {
  santriId?: string;
  santriName?: string;
  stifinPreview: string;
  asesmenAwalPreviews: string[];
  onStifinChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAsesmenAwalChange: (previews: string[]) => void;
  onSave?: () => Promise<void>;
}
interface PsikologiResult {
  id: string;
  santri_id: string;
  profil_psikologis: any[];
  analisis: string | null;
  rekomendasi: string[];
  pemeriksa: string | null;
  tanggal_pemeriksaan: string | null;
  source_url: string | null;
  extracted_at: string | null;
}

// Draft storage key
const getDraftKey = (santriId: string) => `psikologi_draft_${santriId}`;
export function UserPsikologiTab({
  santriId,
  santriName,
  stifinPreview,
  asesmenAwalPreviews,
  onStifinChange,
  onAsesmenAwalChange,
  onSave
}: UserPsikologiTabProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<PsikologiResult | null>(null);
  const [isLoadingResult, setIsLoadingResult] = useState(false);
  const [draftResult, setDraftResult] = useState<PsikologiResult | null>(null);
  const [hasDraft, setHasDraft] = useState(false);

  // Load draft from localStorage
  const loadDraft = useCallback(() => {
    if (!santriId) return null;
    try {
      const draftKey = getDraftKey(santriId);
      const storedDraft = localStorage.getItem(draftKey);
      if (storedDraft) {
        return JSON.parse(storedDraft) as PsikologiResult;
      }
    } catch (error) {
      console.error('Error loading draft:', error);
    }
    return null;
  }, [santriId]);

  // Save draft to localStorage
  const saveDraft = useCallback((data: PsikologiResult) => {
    if (!santriId) return;
    try {
      const draftKey = getDraftKey(santriId);
      localStorage.setItem(draftKey, JSON.stringify(data));
      setDraftResult(data);
      setHasDraft(true);
    } catch (error) {
      console.error('Error saving draft:', error);
    }
  }, [santriId]);

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    if (!santriId) return;
    try {
      const draftKey = getDraftKey(santriId);
      localStorage.removeItem(draftKey);
      setDraftResult(null);
      setHasDraft(false);
    } catch (error) {
      console.error('Error clearing draft:', error);
    }
  }, [santriId]);

  // Fetch existing extraction result
  const fetchExtractionResult = useCallback(async () => {
    if (!santriId) return;
    setIsLoadingResult(true);
    try {
      const {
        data,
        error
      } = await supabase.from('santri_psikologi_results').select('*').eq('santri_id', santriId).maybeSingle();
      if (error) {
        console.error('Error fetching psikologi result:', error);
      } else if (data) {
        setExtractionResult({
          ...data,
          profil_psikologis: Array.isArray(data.profil_psikologis) ? data.profil_psikologis : []
        });
        // Clear draft if we have saved result
        clearDraft();
      } else {
        // No saved result, check for draft
        const draft = loadDraft();
        if (draft) {
          setDraftResult(draft);
          setHasDraft(true);
        }
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoadingResult(false);
    }
  }, [santriId, clearDraft, loadDraft]);
  useEffect(() => {
    fetchExtractionResult();
  }, [fetchExtractionResult]);

  // Handle extraction - analyze all uploaded documents
  const handleExtract = async () => {
    if (!santriId || asesmenAwalPreviews.length === 0) {
      toast.error('Dokumen Asesmen Awal belum tersedia');
      return;
    }
    setIsExtracting(true);
    try {
      // Send all document URLs for extraction
      const {
        data,
        error
      } = await supabase.functions.invoke('extract-psikologi-data', {
        body: {
          santri_id: santriId,
          document_urls: asesmenAwalPreviews
        }
      });
      if (error) {
        console.error('Extraction error:', error);
        throw error;
      }
      if (data?.success) {
        setExtractionResult(data.data);
        // Clear any existing draft since we have new saved data
        clearDraft();
        toast.success('Data psikologi berhasil diekstrak');
      } else {
        throw new Error(data?.error || 'Extraction failed');
      }
    } catch (error) {
      console.error('Extraction error:', error);
      toast.error('Gagal mengekstrak data psikologi');
    } finally {
      setIsExtracting(false);
    }
  };

  // Handle draft extraction (doesn't save to DB)
  const handleDraftExtract = async () => {
    if (!santriId || asesmenAwalPreviews.length === 0) {
      toast.error('Dokumen Asesmen Awal belum tersedia');
      return;
    }
    setIsExtracting(true);
    try {
      // Call edge function but with draft_only flag
      const {
        data,
        error
      } = await supabase.functions.invoke('extract-psikologi-data', {
        body: {
          santri_id: santriId,
          document_urls: asesmenAwalPreviews,
          draft_only: true // Flag to not save to DB
        }
      });
      if (error) {
        console.error('Extraction error:', error);
        throw error;
      }
      if (data?.success && data.data) {
        // Save as draft locally
        saveDraft(data.data);
        toast.success('Data psikologi berhasil diekstrak (Draft)');
      } else {
        throw new Error(data?.error || 'Extraction failed');
      }
    } catch (error) {
      console.error('Extraction error:', error);
      toast.error('Gagal mengekstrak data psikologi');
    } finally {
      setIsExtracting(false);
    }
  };

  // Save draft to database
  const handleSaveDraft = async () => {
    if (!draftResult || !santriId) return;
    setIsSaving(true);
    try {
      const {
        data,
        error
      } = await supabase.from('santri_psikologi_results').upsert({
        santri_id: santriId,
        profil_psikologis: draftResult.profil_psikologis,
        analisis: draftResult.analisis,
        rekomendasi: draftResult.rekomendasi,
        pemeriksa: draftResult.pemeriksa,
        tanggal_pemeriksaan: draftResult.tanggal_pemeriksaan,
        source_url: draftResult.source_url,
        extracted_at: new Date().toISOString()
      }, {
        onConflict: 'santri_id'
      }).select().single();
      if (error) throw error;
      setExtractionResult({
        ...data,
        profil_psikologis: Array.isArray(data.profil_psikologis) ? data.profil_psikologis : []
      });
      clearDraft();
      toast.success('Draft berhasil disimpan ke database');
    } catch (error) {
      console.error('Save draft error:', error);
      toast.error('Gagal menyimpan draft');
    } finally {
      setIsSaving(false);
    }
  };
  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave();
      setIsEditMode(false);
      toast.success('Dokumen psikologi berhasil disimpan');
    } catch (error) {
      console.error('Error saving psychology documents:', error);
      toast.error('Gagal menyimpan dokumen psikologi');
    } finally {
      setIsSaving(false);
    }
  };
  const handleCancel = () => {
    setIsEditMode(false);
  };
  return <div className="space-y-8">
      {/* Section: Upload Dokumen */}
      <Card className="rounded-2xl border-0 shadow-md overflow-hidden">
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
          <div className="relative px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Upload className="h-4 w-4 text-primary" />
              </div>
              <div>
                <span className="font-semibold text-foreground">Upload Dokumen</span>
                <p className="text-xs text-muted-foreground">Upload dokumen STIFIN dan Asesmen Awal untuk diekstrak otomatis</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isEditMode ? <>
                <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving} className="gap-1.5 h-8">
                  <XCircle className="h-4 w-4" />
                  Batal
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1.5 h-8">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Simpan
                </Button>
              </> : <Button variant="ghost" size="sm" onClick={() => setIsEditMode(true)} className="gap-1.5 h-8">
                <Pencil className="h-4 w-4" />
                Edit
              </Button>}
            </div>
          </div>
        </div>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CompactDropZone label="Dokumen STIFIN" icon={<Sparkles className="h-5 w-5 text-primary" />} preview={stifinPreview} onChange={onStifinChange} emptyText="" disabled={!isEditMode} />

            <MultiImageDropZone label="Asesmen Awal" icon={<FileText className="h-5 w-5 text-primary" />} previews={asesmenAwalPreviews} onChange={onAsesmenAwalChange} emptyText="" maxFiles={3} disabled={!isEditMode} onExtract={handleExtract} isExtracting={isExtracting} compact />
          </div>
        </CardContent>
      </Card>

      {/* Section: Hasil Ekstraksi */}
      <section>
        

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <StifinExtractionResult santriId={santriId} documentUrl={stifinPreview} />

          <PsikologiExtractionResult santriId={santriId} documentUrls={asesmenAwalPreviews} result={extractionResult} draftResult={draftResult} hasDraft={hasDraft} isLoading={isLoadingResult} isSavingDraft={isSaving} onExtract={handleExtract} onDraftExtract={handleDraftExtract} onSaveDraft={handleSaveDraft} onClearDraft={clearDraft} onRefresh={fetchExtractionResult} />
        </div>
      </section>
    </div>;
}