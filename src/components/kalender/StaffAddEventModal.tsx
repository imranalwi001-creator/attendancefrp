import { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { CalendarIcon, Upload, X, FileText, AlertCircle } from 'lucide-react';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FormDrawer } from '@/components/ui/form-drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useKalenderKategori } from '@/hooks/useKalenderEvents';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { useAuth } from '@/contexts/AuthContext';
import { logActivity } from '@/lib/activityLogger';

interface StaffAddEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: Date | null;
}

export function StaffAddEventModal({
  open,
  onOpenChange,
  initialDate,
}: StaffAddEventModalProps) {
  const queryClient = useQueryClient();
  const { activeAcademicYear } = useAcademicYear();
  const { user } = useAuth();
  const { data: kategoriList = [] } = useKalenderKategori();

  const [judul, setJudul] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [tanggalMulai, setTanggalMulai] = useState<Date | undefined>(initialDate || undefined);
  const [tanggalSelesai, setTanggalSelesai] = useState<Date | undefined>(initialDate || undefined);
  const [kategoriId, setKategoriId] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<string>('');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | undefined>(undefined);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setJudul('');
      setDeskripsi('');
      setTanggalMulai(initialDate || undefined);
      setTanggalSelesai(initialDate || undefined);
      setKategoriId('');
      setIsRecurring(false);
      setRecurrenceType('');
      setRecurrenceEndDate(undefined);
      setDocumentFile(null);
    }
  }, [open, initialDate]);

  // Handle file upload
  const uploadDocument = async (file: File): Promise<{ url: string; name: string }> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `documents/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('kalender-documents')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('kalender-documents')
      .getPublicUrl(filePath);

    return { url: urlData.publicUrl, name: file.name };
  };

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Ukuran file maksimal 10MB');
        return;
      }
      setDocumentFile(file);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Ukuran file maksimal 10MB');
        return;
      }
      setDocumentFile(file);
    }
  };

  const removeDocument = () => {
    setDocumentFile(null);
  };

  const createEventMutation = useMutation({
    mutationFn: async () => {
      if (!tanggalMulai || !tanggalSelesai) {
        throw new Error('Tanggal harus diisi');
      }

      setIsUploading(true);
      let documentData = { url: null as string | null, name: null as string | null };
      
      if (documentFile) {
        const uploadResult = await uploadDocument(documentFile);
        documentData = { url: uploadResult.url, name: uploadResult.name };
      }

      const { error } = await supabase.from('kalender_events').insert({
        judul,
        deskripsi: deskripsi || null,
        tanggal_mulai: format(tanggalMulai, 'yyyy-MM-dd'),
        tanggal_selesai: format(tanggalSelesai, 'yyyy-MM-dd'),
        kategori_id: kategoriId || null,
        is_recurring: isRecurring,
        recurrence_type: isRecurring ? recurrenceType : null,
        recurrence_end_date: isRecurring && recurrenceEndDate 
          ? format(recurrenceEndDate, 'yyyy-MM-dd') 
          : null,
        academic_year_id: activeAcademicYear?.id || null,
        pic_id: user?.id || null, // Set the submitter as PIC
        status: 'pending', // Always pending for staff submissions
        document_url: documentData.url,
        document_name: documentData.name,
        created_by: user?.id || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setIsUploading(false);
      toast.success('Pengajuan agenda berhasil dikirim. Menunggu persetujuan admin.');
      
      logActivity({
        action: 'calendar_agenda_submit',
        category: 'calendar',
        description: `Mengajukan agenda Kalender Pendidikan "${judul}"`,
        metadata: { judul, tanggalMulai: tanggalMulai?.toISOString() }
      });
      
      queryClient.invalidateQueries({ queryKey: ['kalender-events'] });
      queryClient.invalidateQueries({ queryKey: ['kalender-events-list'] });
      onOpenChange(false);
    },
    onError: (error) => {
      setIsUploading(false);
      toast.error('Gagal mengajukan agenda: ' + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!judul.trim()) {
      toast.error('Nama agenda harus diisi');
      return;
    }
    if (!tanggalMulai || !tanggalSelesai) {
      toast.error('Tanggal harus diisi');
      return;
    }
    if (tanggalSelesai < tanggalMulai) {
      toast.error('Tanggal selesai tidak boleh sebelum tanggal mulai');
      return;
    }
    if (isRecurring && !recurrenceType) {
      toast.error('Tipe pengulangan harus dipilih');
      return;
    }

    createEventMutation.mutate();
  };

  const isPending = createEventMutation.isPending || isUploading;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Ajukan Agenda"
      onSubmit={handleSubmit}
      submitLabel="Kirim Pengajuan"
      cancelLabel="Batal"
      loading={isPending}
    >
      <div className="space-y-4">
        {/* Info Alert */}
        <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
            Agenda yang diajukan akan menunggu persetujuan dari admin sebelum ditampilkan di kalender.
          </AlertDescription>
        </Alert>

        {/* Nama Agenda */}
        <div className="space-y-2">
          <Label htmlFor="judul">Nama Agenda *</Label>
          <Input
            id="judul"
            value={judul}
            onChange={(e) => setJudul(e.target.value)}
            placeholder="Masukkan nama agenda"
            className="rounded-xl font-semibold"
          />
        </div>

        {/* Deskripsi */}
        <div className="space-y-2">
          <Label htmlFor="deskripsi">Uraian Program</Label>
          <Textarea
            id="deskripsi"
            value={deskripsi}
            onChange={(e) => setDeskripsi(e.target.value)}
            placeholder="Deskripsi agenda (opsional)"
            className="rounded-xl resize-none font-medium"
            rows={3}
          />
        </div>

        {/* Kategori */}
        <div className="space-y-2">
          <Label>Kategori</Label>
          <Select value={kategoriId} onValueChange={setKategoriId}>
            <SelectTrigger className="rounded-xl font-semibold">
              <SelectValue placeholder="Pilih kategori" />
            </SelectTrigger>
            <SelectContent>
              {kategoriList.map((kat) => (
                <SelectItem key={kat.id} value={kat.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: kat.warna }}
                    />
                    {kat.nama}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tanggal */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Tanggal Mulai *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-medium rounded-xl',
                    !tanggalMulai && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {tanggalMulai
                    ? format(tanggalMulai, 'd MMM yyyy', { locale: localeId })
                    : 'Pilih tanggal'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={tanggalMulai}
                  onSelect={(date) => {
                    setTanggalMulai(date);
                    if (!tanggalSelesai || (date && tanggalSelesai < date)) {
                      setTanggalSelesai(date);
                    }
                  }}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Tanggal Selesai *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-medium rounded-xl',
                    !tanggalSelesai && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {tanggalSelesai
                    ? format(tanggalSelesai, 'd MMM yyyy', { locale: localeId })
                    : 'Pilih tanggal'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={tanggalSelesai}
                  onSelect={setTanggalSelesai}
                  disabled={(date) => tanggalMulai ? date < tanggalMulai : false}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Recurring */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="recurring">Agenda Berulang</Label>
            <Switch
              id="recurring"
              checked={isRecurring}
              onCheckedChange={setIsRecurring}
            />
          </div>

          {isRecurring && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipe Pengulangan</Label>
                <Select value={recurrenceType} onValueChange={setRecurrenceType}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Pilih tipe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Harian</SelectItem>
                    <SelectItem value="weekly">Mingguan</SelectItem>
                    <SelectItem value="monthly">Bulanan</SelectItem>
                    <SelectItem value="yearly">Tahunan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Berakhir Pada</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-medium rounded-xl',
                        !recurrenceEndDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {recurrenceEndDate
                        ? format(recurrenceEndDate, 'd MMM yyyy', { locale: localeId })
                        : 'Pilih tanggal'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={recurrenceEndDate}
                      onSelect={setRecurrenceEndDate}
                      disabled={(date) => tanggalSelesai ? date < tanggalSelesai : false}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
        </div>

        {/* Document Upload */}
        <div className="space-y-2">
          <Label>Dokumen Pendukung</Label>
          {documentFile ? (
            <div className="flex items-center gap-2 p-3 border rounded-xl bg-muted/50">
              <FileText className="h-5 w-5 text-primary" />
              <span className="flex-1 text-sm font-medium truncate">{documentFile.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={removeDocument}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div
              className={cn(
                'border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer',
                isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drag & drop atau klik untuk upload
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Maks. 10MB (PDF, DOC, DOCX, JPG, PNG)
              </p>
              <input
                id="file-input"
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
              />
            </div>
          )}
        </div>
      </div>
    </FormDrawer>
  );
}
