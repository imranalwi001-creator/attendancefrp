import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { FormDrawer } from '@/components/ui/form-drawer';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { validateGDriveUrl, extractFileInfo, getFileTypeLabel, getFileTypeColor, GDriveFileType } from '@/lib/gdriveUtils';
import { GDrivePreview } from './GDrivePreview';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  judul: z.string().min(1, 'Judul wajib diisi'),
  deskripsi: z.string().optional(),
  drive_url: z.string().min(1, 'Link Google Drive wajib diisi'),
  kelas_id: z.string().optional(),
  mapel_id: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface BahanBelajarFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editData?: {
    id: string;
    judul: string;
    deskripsi?: string | null;
    drive_url: string;
    kelas_id?: string | null;
    mapel_id?: string | null;
  } | null;
}

export function BahanBelajarForm({ open, onOpenChange, onSuccess, editData }: BahanBelajarFormProps) {
  const [loading, setLoading] = useState(false);
  const [urlValidation, setUrlValidation] = useState<{ valid: boolean; error?: string; fileType?: GDriveFileType } | null>(null);
  const [fileInfo, setFileInfo] = useState<{ fileId: string; fileType: GDriveFileType; embedUrl: string; thumbnailUrl: string } | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      judul: '',
      deskripsi: '',
      drive_url: '',
      kelas_id: '',
      mapel_id: '',
    },
  });

  const driveUrl = form.watch('drive_url');
  const debouncedUrl = useDebounce(driveUrl, 500);
  const selectedKelasId = form.watch('kelas_id');
  const { activeAcademicYear } = useAcademicYear();

  // Fetch kelas list - only from active academic year
  const { data: kelasList = [] } = useQuery({
    queryKey: ['kelas-list-for-bahan', activeAcademicYear?.name],
    queryFn: async () => {
      if (!activeAcademicYear?.name) return [];
      const { data, error } = await supabase
        .from('kelas')
        .select('id, nama, tingkat')
        .eq('status', 'aktif')
        .eq('tahun_ajaran', activeAcademicYear.name)
        .order('tingkat')
        .order('nama');
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeAcademicYear?.name,
  });

  // Fetch mapel list based on selected kelas
  const { data: mapelList = [] } = useQuery({
    queryKey: ['mapel-list-for-bahan', selectedKelasId],
    queryFn: async () => {
      if (!selectedKelasId) return [];
      const { data, error } = await supabase
        .from('mapel')
        .select('id, nama')
        .eq('kelas_id', selectedKelasId)
        .eq('status', 'aktif')
        .order('nama');
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedKelasId,
  });

  // Validate URL when it changes
  useEffect(() => {
    if (!debouncedUrl) {
      setUrlValidation(null);
      setFileInfo(null);
      return;
    }

    const validation = validateGDriveUrl(debouncedUrl);
    if (validation.valid) {
      const info = extractFileInfo(debouncedUrl);
      setFileInfo(info);
      setUrlValidation({ valid: true, fileType: info?.fileType });
    } else {
      setUrlValidation({ valid: false, error: validation.error });
      setFileInfo(null);
    }
  }, [debouncedUrl]);

  // Reset form when editData changes
  useEffect(() => {
    if (editData) {
      form.reset({
        judul: editData.judul,
        deskripsi: editData.deskripsi || '',
        drive_url: editData.drive_url,
        kelas_id: editData.kelas_id || '',
        mapel_id: editData.mapel_id || '',
      });
    } else {
      form.reset({
        judul: '',
        deskripsi: '',
        drive_url: '',
        kelas_id: '',
        mapel_id: '',
      });
    }
  }, [editData, form, open]);

  const onSubmit = async (values: FormValues) => {
    if (!fileInfo) {
      form.setError('drive_url', { message: 'Link Google Drive tidak valid' });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const payload = {
        judul: values.judul,
        deskripsi: values.deskripsi || null,
        drive_url: values.drive_url,
        file_id: fileInfo.fileId,
        file_type: fileInfo.fileType,
        embed_url: fileInfo.embedUrl,
        kelas_id: values.kelas_id || null,
        mapel_id: values.mapel_id || null,
        sampul_url: fileInfo.thumbnailUrl, // Auto-generated from Google Drive
        created_by: user?.id,
      };

      if (editData) {
        const { error } = await supabase
          .from('bahan_belajar')
          .update(payload)
          .eq('id', editData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('bahan_belajar')
          .insert(payload);
        if (error) throw error;
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving bahan belajar:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={editData ? 'Edit Bahan Belajar' : 'Tambah Bahan Belajar'}
      onSubmit={form.handleSubmit(onSubmit)}
      loading={loading}
    >
      <div className="space-y-6">
        {/* Section 1: File & Sampul */}
        <div className="rounded-xl border bg-card p-4 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            File & Sampul
          </h3>

          {/* Link Google Drive */}
          <div className="space-y-2">
            <Label htmlFor="drive_url">Link Google Drive <span className="text-destructive">*</span></Label>
            <Input
              id="drive_url"
              placeholder="https://drive.google.com/file/d/xxx/view"
              className="bg-muted/50 focus:bg-background transition-colors"
              {...form.register('drive_url')}
            />
            
            {/* Validation Status */}
            {driveUrl && (
              <div className="flex items-center gap-2">
                {urlValidation === null ? (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span className="text-xs">Memvalidasi...</span>
                  </div>
                ) : urlValidation.valid ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-xs text-emerald-600">Link valid</span>
                    {urlValidation.fileType && (
                      <Badge className={cn('text-[10px]', getFileTypeColor(urlValidation.fileType))}>
                        {getFileTypeLabel(urlValidation.fileType)}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-destructive">
                    <XCircle className="h-3.5 w-3.5" />
                    <span className="text-xs">{urlValidation.error}</span>
                  </div>
                )}
              </div>
            )}
            
            {form.formState.errors.drive_url && (
              <p className="text-xs text-destructive">{form.formState.errors.drive_url.message}</p>
            )}
            
            <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="h-4 w-4 shrink-0 mt-0.5 rounded-full bg-primary/10 flex items-center justify-center">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              </div>
              <p className="text-xs text-primary/80">
                Pastikan file di-share sebagai "Anyone with the link" dengan akses Viewer
              </p>
            </div>
          </div>

          {/* Preview with Thumbnail */}
          {fileInfo && urlValidation?.valid && (
            <div className="space-y-3">
              <Label>Preview & Sampul</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Auto-generated Thumbnail */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Sampul Otomatis</p>
                  <div className="aspect-video rounded-lg overflow-hidden border bg-muted/50">
                    <img 
                      src={fileInfo.thumbnailUrl} 
                      alt="Thumbnail" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                </div>
                {/* File Preview */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Preview File</p>
                  <div className="aspect-video rounded-lg overflow-hidden border">
                    <GDrivePreview
                      embedUrl={fileInfo.embedUrl}
                      driveUrl={driveUrl}
                      title={form.watch('judul')}
                      aspectRatio="video"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Informasi Utama */}
        <div className="rounded-xl border bg-card p-4 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            Informasi Utama
          </h3>
          
          {/* Judul */}
          <div className="space-y-2">
            <Label htmlFor="judul">Judul <span className="text-destructive">*</span></Label>
            <Input
              id="judul"
              placeholder="Masukkan judul bahan belajar"
              className="bg-muted/50 focus:bg-background transition-colors"
              {...form.register('judul')}
            />
            {form.formState.errors.judul && (
              <p className="text-xs text-destructive">{form.formState.errors.judul.message}</p>
            )}
          </div>

          {/* Deskripsi */}
          <div className="space-y-2">
            <Label htmlFor="deskripsi">Deskripsi</Label>
            <Textarea
              id="deskripsi"
              placeholder="Deskripsi singkat (opsional)"
              rows={3}
              className="bg-muted/50 focus:bg-background transition-colors"
              {...form.register('deskripsi')}
            />
          </div>
        </div>

        {/* Section 3: Target */}
        <div className="rounded-xl border bg-card p-4 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            Target Materi
          </h3>

          {/* Kelas */}
          <div className="space-y-2">
            <Label>Kelas Target</Label>
            <Select
              value={form.watch('kelas_id') || 'all'}
              onValueChange={(value) => {
                form.setValue('kelas_id', value === 'all' ? '' : value);
                form.setValue('mapel_id', '');
              }}
            >
              <SelectTrigger className="bg-muted/50 focus:bg-background transition-colors">
                <SelectValue placeholder="Semua Kelas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kelas</SelectItem>
                {kelasList.map((kelas) => (
                  <SelectItem key={kelas.id} value={kelas.id}>
                    {kelas.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mapel */}
          {selectedKelasId && (
            <div className="space-y-2">
              <Label>Mapel Terkait</Label>
              <Select
                value={form.watch('mapel_id') || 'none'}
                onValueChange={(value) => form.setValue('mapel_id', value === 'none' ? '' : value)}
              >
                <SelectTrigger className="bg-muted/50 focus:bg-background transition-colors">
                  <SelectValue placeholder="Pilih mapel (opsional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak ada</SelectItem>
                  {mapelList.map((mapel) => (
                    <SelectItem key={mapel.id} value={mapel.id}>
                      {mapel.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>
    </FormDrawer>
  );
}
