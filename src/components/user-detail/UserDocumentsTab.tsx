import { useState, useRef, useEffect } from 'react';
import { ContentCard, ContentCardBody } from '@/components/ui/content-card';
import { ExtractionCardHeader } from '@/components/ui/extraction-card-header';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Camera, Users, BookOpen, Upload, X, Sparkles, Loader2, UserCheck, Baby, GraduationCap, Clock, Pencil, Save, XCircle, FolderOpen } from 'lucide-react';
import { UserDocumentsTabProps } from './types';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DropZoneProps {
  label: string;
  icon: React.ReactNode;
  preview: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  emptyText: string;
  maxWidth?: string;
  children?: React.ReactNode;
  disabled?: boolean;
}

function DropZone({ label, icon, preview, onChange, emptyText, maxWidth = 'max-w-md', children, disabled = false }: DropZoneProps) {
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
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        if (inputRef.current) {
          inputRef.current.files = dataTransfer.files;
          const event = { target: inputRef.current } as React.ChangeEvent<HTMLInputElement>;
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
      const event = { target: { files: null } } as unknown as React.ChangeEvent<HTMLInputElement>;
      onChange(event);
    }
  };

  return (
    <div className="space-y-3 p-4 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors">
      <Label className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wide">
        {icon}
        {label}
      </Label>
      
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={onChange}
        className="hidden"
        disabled={disabled}
      />

      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-xl transition-all",
          disabled ? "cursor-default opacity-70" : "cursor-pointer",
          isDragging 
            ? "border-primary bg-primary/10" 
            : disabled 
              ? "border-border" 
              : "border-border hover:border-primary/50 hover:bg-muted/40",
          preview ? "p-2" : "p-8"
        )}
      >
        {preview ? (
          <div className={cn("relative w-full", maxWidth)}>
            <img 
              src={preview} 
              alt={label} 
              className="w-full h-auto rounded-lg border border-border shadow-md" 
            />
            {!disabled && (
              <>
                <button
                  onClick={handleRemove}
                  className="absolute -top-2 -right-2 p-1.5 bg-destructive text-destructive-foreground rounded-full shadow-md hover:bg-destructive/90 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="absolute inset-0 bg-background/80 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                  <div className="text-center">
                    <Upload className="h-6 w-6 mx-auto text-primary mb-2" />
                    <p className="text-sm font-medium text-foreground">Klik atau drop untuk ganti</p>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {disabled ? 'Klik Edit untuk mengunggah' : 'Klik atau drag & drop file di sini'}
            </p>
            <p className="text-xs text-muted-foreground">
              Format: JPG, PNG, WEBP, PDF (Maks. 5MB)
            </p>
          </div>
        )}
      </div>
      
      {children}
    </div>
  );
}

interface FamilyChild {
  id: string;
  nama: string;
  tanggal_lahir: string | null;
  usia_perkiraan: number | null;
  kategori_potensi: string;
  catatan: string | null;
}

interface FamilyInsight {
  id: string;
  total_anak: number;
  total_anak_potensi_smp: number;
  source: string;
  created_at: string;
}

const kategoriConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  potensi_smp_sekarang: { label: 'Potensi SMP Sekarang', color: 'bg-green-500/10 text-green-600 border-green-500/20', icon: <GraduationCap className="h-3 w-3" /> },
  potensi_smp_1_2_tahun: { label: 'Potensi SMP 1-2 Tahun', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: <Clock className="h-3 w-3" /> },
  belum_relevan: { label: 'Belum Relevan', color: 'bg-gray-500/10 text-gray-600 border-gray-500/20', icon: <Baby className="h-3 w-3" /> },
  lewat_jenjang_smp: { label: 'Lewat Jenjang SMP', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20', icon: <UserCheck className="h-3 w-3" /> },
  usia_smp: { label: 'Usia SMP', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20', icon: <GraduationCap className="h-3 w-3" /> },
  tidak_diketahui: { label: 'Tidak Diketahui', color: 'bg-gray-500/10 text-gray-500 border-gray-500/20', icon: null },
};

interface UserDocumentsTabExtendedProps extends Omit<UserDocumentsTabProps, 'formData' | 'isEditMode'> {
  santriId?: string;
  santriName?: string;
  onSave?: () => Promise<void>;
}

export function UserDocumentsTab({
  photoChildPreview,
  familyCardPreview,
  achievementCertificatePreview,
  onPhotoChildChange,
  onFamilyCardChange,
  onAchievementCertificateChange,
  santriId,
  santriName,
  onSave
}: UserDocumentsTabExtendedProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [familyInsight, setFamilyInsight] = useState<FamilyInsight | null>(null);
  const [familyChildren, setFamilyChildren] = useState<FamilyChild[]>([]);

  // Store original previews for cancel functionality
  const [originalPreviews, setOriginalPreviews] = useState({
    photoChild: photoChildPreview,
    familyCard: familyCardPreview,
    achievementCertificate: achievementCertificatePreview
  });

  // Fetch existing family data
  useEffect(() => {
    if (santriId) {
      fetchFamilyData();
    }
  }, [santriId]);

  // Update original previews when entering edit mode
  useEffect(() => {
    if (isEditMode) {
      setOriginalPreviews({
        photoChild: photoChildPreview,
        familyCard: familyCardPreview,
        achievementCertificate: achievementCertificatePreview
      });
    }
  }, [isEditMode]);

  const fetchFamilyData = async () => {
    if (!santriId) return;

    try {
      const [insightRes, childrenRes] = await Promise.all([
        supabase
          .from('santri_family_insights')
          .select('id, santri_id, total_anak, total_anak_potensi_smp, source, created_at')
          .eq('santri_id', santriId)
          .single(),
        supabase
          .from('santri_family_children')
          .select('id, nama, tanggal_lahir, usia_perkiraan, kategori_potensi, catatan')
          .eq('santri_id', santriId)
          .order('usia_perkiraan', { ascending: true })
          .limit(20)
      ]);

      if (insightRes.data) {
        setFamilyInsight(insightRes.data);
      }

      if (childrenRes.data) {
        setFamilyChildren(childrenRes.data);
      }
    } catch (error) {
      console.error('Error fetching family data:', error);
    }
  };

  const handleSave = async () => {
    if (!onSave) return;
    
    setIsSaving(true);
    try {
      await onSave();
      setIsEditMode(false);
      toast.success('Dokumen berhasil disimpan');
    } catch (error) {
      console.error('Error saving documents:', error);
      toast.error('Gagal menyimpan dokumen');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to original previews would need parent component support
    // For now, just exit edit mode
    setIsEditMode(false);
  };

  const handleExtractFamilyData = async () => {
    if (!santriId || !familyCardPreview) {
      toast.error('Kartu Keluarga harus diunggah terlebih dahulu');
      return;
    }

    setIsExtracting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('extract-family-data', {
        body: {
          santri_id: santriId,
          nama_santri: santriName || '',
          family_card_url: familyCardPreview
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Berhasil mengekstrak ${data.data.total_anak} data anak dari Kartu Keluarga`);
        await fetchFamilyData();
      } else {
        throw new Error(data.error || 'Gagal mengekstrak data');
      }
    } catch (error) {
      console.error('Error extracting family data:', error);
      toast.error('Gagal mengekstrak data keluarga. Pastikan dokumen dapat dibaca dengan jelas.');
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="space-y-6">
      <ContentCard>
        <ExtractionCardHeader
          icon={<FolderOpen className="h-4 w-4 text-primary" />}
          title="Dokumen Santri"
          actions={
            isEditMode ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="gap-1.5"
                >
                  <XCircle className="h-4 w-4" />
                  Batal
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="gap-1.5"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Simpan
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditMode(true)}
                className="gap-1.5"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            )
          }
        />
      <ContentCardBody>
        <div className="space-y-6">
          <DropZone
            label="Foto Anak"
            icon={<Camera className="h-3.5 w-3.5" />}
            preview={photoChildPreview}
            onChange={onPhotoChildChange}
            emptyText="Belum ada foto"
            maxWidth="max-w-xs"
            disabled={!isEditMode}
          />

          <DropZone
            label="Kartu Keluarga"
            icon={<Users className="h-3.5 w-3.5" />}
            preview={familyCardPreview}
            onChange={onFamilyCardChange}
            emptyText="Belum ada kartu keluarga"
            disabled={!isEditMode}
          >
            {/* Extract Family Data Button - only show when not in edit mode and KK exists */}
            {familyCardPreview && santriId && !isEditMode && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExtractFamilyData}
                disabled={isExtracting}
                className="w-full gap-2 mt-3 bg-gradient-to-r from-primary/10 to-purple-500/10 hover:from-primary/20 hover:to-purple-500/20 border-primary/30"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Mengekstrak Data...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Ekstrak Data Keluarga
                  </>
                )}
              </Button>
            )}
          </DropZone>

          <DropZone
            label="Sertifikat Prestasi"
            icon={<BookOpen className="h-3.5 w-3.5" />}
            preview={achievementCertificatePreview}
            onChange={onAchievementCertificateChange}
            emptyText="Belum ada sertifikat prestasi"
            disabled={!isEditMode}
          />
        </div>
      </ContentCardBody>
    </ContentCard>

      {/* Family Data Results - Separate Container */}
      <ContentCard>
        <ExtractionCardHeader
          icon={<Users className="h-4 w-4 text-primary" />}
          title="Hasil Ekstraksi Data Keluarga"
          actions={
            familyInsight && familyCardPreview && santriId && !isEditMode ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExtractFamilyData}
              disabled={isExtracting}
              className="gap-2 bg-gradient-to-r from-primary/10 to-purple-500/10 hover:from-primary/20 hover:to-purple-500/20 border-primary/30"
            >
              {isExtracting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Mengekstrak...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Ekstrak Ulang
                </>
              )}
            </Button>
            ) : undefined
          }
        />
        <ContentCardBody>
          {familyInsight ? (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 text-center">
                  <p className="text-3xl font-bold text-primary">{familyInsight.total_anak}</p>
                  <p className="text-sm text-muted-foreground">Total Anak</p>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20 text-center">
                  <p className="text-3xl font-bold text-green-600">{familyInsight.total_anak_potensi_smp}</p>
                  <p className="text-sm text-muted-foreground">Potensi SMP</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/30 border text-center">
                  <p className="text-lg font-semibold text-foreground">Kartu Keluarga</p>
                  <p className="text-sm text-muted-foreground">Sumber Data</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/30 border text-center">
                  <p className="text-lg font-semibold text-foreground">
                    {new Date(familyInsight.created_at).toLocaleDateString('id-ID', { 
                      day: 'numeric', 
                      month: 'short', 
                      year: 'numeric'
                    })}
                  </p>
                  <p className="text-sm text-muted-foreground">Tanggal Ekstraksi</p>
                </div>
              </div>

              {/* Children List */}
              {familyChildren.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Daftar Anak ({familyChildren.length})
                  </p>
                  <div className="grid gap-3">
                    {familyChildren.map((child) => {
                      const config = kategoriConfig[child.kategori_potensi] || kategoriConfig.tidak_diketahui;
                      return (
                        <div
                          key={child.id}
                          className="p-4 rounded-xl bg-muted/30 border flex items-center justify-between gap-4"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-base truncate">{child.nama}</p>
                            <p className="text-sm text-muted-foreground">
                              {child.usia_perkiraan ? `Usia: ${child.usia_perkiraan} tahun` : 'Usia tidak diketahui'}
                              {child.tanggal_lahir && ` • Lahir: ${new Date(child.tanggal_lahir).toLocaleDateString('id-ID')}`}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn("shrink-0 gap-1.5 px-3 py-1", config.color)}
                          >
                            {config.icon}
                            {config.label}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {familyChildren.length === 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  <Baby className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Tidak ditemukan data anak lain di Kartu Keluarga</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground mb-1">Belum ada data hasil ekstraksi KK.</p>
              <p className="text-sm text-muted-foreground/70">
                Upload Kartu Keluarga dan klik "Ekstrak Data Keluarga" untuk memulai.
              </p>
            </div>
          )}
        </ContentCardBody>
      </ContentCard>
    </div>
  );
}
