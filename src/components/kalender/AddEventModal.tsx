import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { CalendarIcon, Upload, X, FileText, Check, Ban } from 'lucide-react';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FormDrawer } from '@/components/ui/form-drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
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
import { logActivity } from '@/lib/activityLogger';

export interface EventToEdit {
  id: string;
  judul: string;
  deskripsi: string | null;
  tanggal_mulai: string;
  tanggal_selesai: string;
  kategori_id: string | null;
  is_recurring: boolean;
  recurrence_type: string | null;
  recurrence_end_date?: string | null;
  pic_id?: string | null;
  status?: string;
  document_url?: string | null;
  document_name?: string | null;
  created_by?: string | null;
}

interface AddEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: Date | null;
  eventToEdit?: EventToEdit | null;
  readOnly?: boolean;
  isAdminView?: boolean;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Ditangguhkan', color: 'bg-yellow-500' },
  { value: 'approved', label: 'Disetujui', color: 'bg-green-500' },
  { value: 'rejected', label: 'Ditolak', color: 'bg-red-500' },
  { value: 'postponed', label: 'Ditunda', color: 'bg-gray-500' },
];

export function AddEventModal({
  open,
  onOpenChange,
  initialDate,
  eventToEdit,
  readOnly = false,
  isAdminView = false,
}: AddEventModalProps) {
  const queryClient = useQueryClient();
  const { activeAcademicYear } = useAcademicYear();
  const { data: kategoriList = [] } = useKalenderKategori();

  const [judul, setJudul] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [tanggalMulai, setTanggalMulai] = useState<Date | undefined>(initialDate || undefined);
  const [tanggalSelesai, setTanggalSelesai] = useState<Date | undefined>(initialDate || undefined);
  const [kategoriId, setKategoriId] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<string>('');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | undefined>(undefined);
  const [picId, setPicId] = useState<string>('');
  const [status, setStatus] = useState<string>('pending');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [existingDocumentUrl, setExistingDocumentUrl] = useState<string | null>(null);
  const [existingDocumentName, setExistingDocumentName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const isEditMode = !!eventToEdit;

  // Track if form has changes (for detail view)
  const hasChanges = useMemo(() => {
    if (!eventToEdit) return true; // New event always has "changes" to save
    
    const originalJudul = eventToEdit.judul || '';
    const originalDeskripsi = eventToEdit.deskripsi || '';
    const originalKategoriId = eventToEdit.kategori_id || '';
    const originalPicId = eventToEdit.pic_id || '';
    const originalStatus = eventToEdit.status || 'pending';
    const originalIsRecurring = eventToEdit.is_recurring || false;
    const originalRecurrenceType = eventToEdit.recurrence_type || '';
    
    const tanggalMulaiChanged = tanggalMulai 
      ? format(tanggalMulai, 'yyyy-MM-dd') !== eventToEdit.tanggal_mulai 
      : false;
    const tanggalSelesaiChanged = tanggalSelesai 
      ? format(tanggalSelesai, 'yyyy-MM-dd') !== eventToEdit.tanggal_selesai 
      : false;
    const recurrenceEndChanged = isRecurring && recurrenceEndDate
      ? format(recurrenceEndDate, 'yyyy-MM-dd') !== (eventToEdit.recurrence_end_date || '')
      : false;
    
    return (
      judul !== originalJudul ||
      deskripsi !== originalDeskripsi ||
      kategoriId !== originalKategoriId ||
      picId !== originalPicId ||
      status !== originalStatus ||
      isRecurring !== originalIsRecurring ||
      recurrenceType !== originalRecurrenceType ||
      tanggalMulaiChanged ||
      tanggalSelesaiChanged ||
      recurrenceEndChanged ||
      documentFile !== null
    );
  }, [eventToEdit, judul, deskripsi, kategoriId, picId, status, isRecurring, recurrenceType, tanggalMulai, tanggalSelesai, recurrenceEndDate, documentFile]);

  // Fetch staff list for PIC
  const { data: staffList = [] } = useQuery({
    queryKey: ['staff-list-for-pic'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff')
        .select(`
          id,
          position,
          profiles!inner (
            id,
            name,
            status
          )
        `)
        .eq('profiles.status', 'aktif')
        .order('profiles(name)');
      
      if (error) throw error;
      return data || [];
    },
  });

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      if (eventToEdit) {
        // Edit mode: populate with existing data
        setJudul(eventToEdit.judul);
        setDeskripsi(eventToEdit.deskripsi || '');
        setTanggalMulai(parseISO(eventToEdit.tanggal_mulai));
        setTanggalSelesai(parseISO(eventToEdit.tanggal_selesai));
        setKategoriId(eventToEdit.kategori_id || '');
        setIsRecurring(eventToEdit.is_recurring);
        setRecurrenceType(eventToEdit.recurrence_type || '');
        setRecurrenceEndDate(
          eventToEdit.recurrence_end_date ? parseISO(eventToEdit.recurrence_end_date) : undefined
        );
        setPicId(eventToEdit.pic_id || '');
        setStatus(eventToEdit.status || 'pending');
        setExistingDocumentUrl(eventToEdit.document_url || null);
        setExistingDocumentName(eventToEdit.document_name || null);
        setDocumentFile(null);
      } else {
        // Add mode: reset form
        setJudul('');
        setDeskripsi('');
        setTanggalMulai(initialDate || undefined);
        setTanggalSelesai(initialDate || undefined);
        setKategoriId('');
        setIsRecurring(false);
        setRecurrenceType('');
        setRecurrenceEndDate(undefined);
        setPicId('');
        setStatus('pending');
        setDocumentFile(null);
        setExistingDocumentUrl(null);
        setExistingDocumentName(null);
      }
    }
  }, [open, initialDate, eventToEdit]);

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
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Ukuran file maksimal 10MB');
        return;
      }
      setDocumentFile(file);
      setExistingDocumentUrl(null);
      setExistingDocumentName(null);
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
      setExistingDocumentUrl(null);
      setExistingDocumentName(null);
    }
  };

  const removeDocument = () => {
    setDocumentFile(null);
    setExistingDocumentUrl(null);
    setExistingDocumentName(null);
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
        pic_id: picId || null,
        status,
        document_url: documentData.url,
        document_name: documentData.name,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setIsUploading(false);
      toast.success('Agenda berhasil ditambahkan');
      
      logActivity({
        action: 'calendar_agenda_add',
        category: 'calendar',
        description: `Menambahkan agenda Kalender Pendidikan "${judul}"`,
        metadata: { judul, tanggalMulai: tanggalMulai?.toISOString() }
      });
      
      queryClient.invalidateQueries({ queryKey: ['kalender-events'] });
      queryClient.invalidateQueries({ queryKey: ['kalender-events-list'] });
      onOpenChange(false);
    },
    onError: (error) => {
      setIsUploading(false);
      toast.error('Gagal menambahkan agenda: ' + error.message);
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async () => {
      if (!tanggalMulai || !tanggalSelesai || !eventToEdit) {
        throw new Error('Tanggal harus diisi');
      }

      setIsUploading(true);
      let documentData = { 
        url: existingDocumentUrl, 
        name: existingDocumentName 
      };
      
      if (documentFile) {
        const uploadResult = await uploadDocument(documentFile);
        documentData = { url: uploadResult.url, name: uploadResult.name };
      }

      const { error } = await supabase
        .from('kalender_events')
        .update({
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
          pic_id: picId || null,
          status,
          document_url: documentData.url,
          document_name: documentData.name,
        })
        .eq('id', eventToEdit.id);

      if (error) throw error;
    },
    onSuccess: () => {
      setIsUploading(false);
      toast.success('Agenda berhasil diperbarui');
      
      logActivity({
        action: 'calendar_agenda_edit',
        category: 'calendar',
        description: `Mengedit agenda Kalender Pendidikan "${judul}"`,
        metadata: { eventId: eventToEdit?.id, judul }
      });
      
      queryClient.invalidateQueries({ queryKey: ['kalender-events'] });
      queryClient.invalidateQueries({ queryKey: ['kalender-events-list'] });
      onOpenChange(false);
    },
    onError: (error) => {
      setIsUploading(false);
      toast.error('Gagal memperbarui agenda: ' + error.message);
    },
  });

  // Approve/Reject mutation for admin
  const approveRejectMutation = useMutation({
    mutationFn: async (newStatus: 'approved' | 'rejected') => {
      if (!eventToEdit) throw new Error('No event to update');
      
      const { error } = await supabase
        .from('kalender_events')
        .update({ status: newStatus })
        .eq('id', eventToEdit.id);
      
      if (error) throw error;
      return newStatus;
    },
    onSuccess: (newStatus) => {
      const statusLabel = newStatus === 'approved' ? 'disetujui' : 'ditolak';
      toast.success(`Agenda berhasil ${statusLabel}`);
      
      logActivity({
        action: newStatus === 'approved' ? 'calendar_agenda_approve' : 'calendar_agenda_reject',
        category: 'calendar',
        description: `${newStatus === 'approved' ? 'Menyetujui' : 'Menolak'} agenda "${eventToEdit?.judul}"`,
        metadata: { eventId: eventToEdit?.id, judul: eventToEdit?.judul, status: newStatus }
      });
      
      queryClient.invalidateQueries({ queryKey: ['kalender-events'] });
      queryClient.invalidateQueries({ queryKey: ['kalender-events-list'] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Gagal mengubah status agenda: ' + error.message);
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

    if (isEditMode) {
      updateEventMutation.mutate();
    } else {
      createEventMutation.mutate();
    }
  };

  const isPending = createEventMutation.isPending || updateEventMutation.isPending || isUploading || approveRejectMutation.isPending;

  // Check if this is a staff-submitted event (not created by current admin)
  const isStaffSubmittedEvent = isAdminView && isEditMode && eventToEdit?.created_by && eventToEdit.status === 'pending';

  // Dynamic button label based on changes
  const submitLabel = isEditMode 
    ? (hasChanges ? 'Simpan Perubahan' : 'Tutup') 
    : 'Simpan';

  // Handle close without saving if no changes in edit mode
  const handleFormSubmit = (e: React.FormEvent) => {
    if (isEditMode && !hasChanges) {
      e.preventDefault();
      onOpenChange(false);
      return;
    }
    handleSubmit(e);
  };

  // Custom footer for staff-submitted events
  const renderApprovalFooter = () => {
    if (!isStaffSubmittedEvent) return undefined;
    
    return (
      <div className="flex flex-col gap-3 w-full">
        {/* Approval buttons */}
        <div className="flex gap-2 w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => approveRejectMutation.mutate('rejected')}
            disabled={isPending}
            className="flex-1 rounded-xl border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground h-10"
          >
            <Ban className="h-4 w-4 mr-2" />
            Tolak
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => approveRejectMutation.mutate('approved')}
            disabled={isPending}
            className="flex-1 rounded-xl bg-green-600 hover:bg-green-700 text-white h-10"
          >
            <Check className="h-4 w-4 mr-2" />
            Setujui
          </Button>
        </div>
        {/* Save and Cancel buttons */}
        <div className="flex justify-end gap-3">
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={() => onOpenChange(false)} 
            disabled={isPending} 
            className="rounded-xl border-primary text-primary hover:bg-primary hover:text-primary-foreground text-xs sm:text-sm h-9 sm:h-10"
          >
            Batal
          </Button>
          {hasChanges && (
            <Button 
              type="submit" 
              size="sm" 
              disabled={isPending} 
              className="rounded-xl bg-primary hover:bg-primary/90 text-xs sm:text-sm h-9 sm:h-10"
            >
              Simpan Perubahan
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEditMode ? 'Detail Agenda' : 'Tambah Agenda'}
      onSubmit={readOnly ? undefined : handleFormSubmit}
      submitLabel={readOnly ? undefined : submitLabel}
      cancelLabel={readOnly ? 'Tutup' : 'Batal'}
      loading={isPending}
      hideSubmit={readOnly || isStaffSubmittedEvent}
      footerContent={renderApprovalFooter()}
    >
      <div className="space-y-4">
        {/* Nama Agenda */}
        <div className="space-y-2">
          <Label htmlFor="judul">Nama Agenda {!readOnly && '*'}</Label>
          <Input
            id="judul"
            value={judul}
            onChange={(e) => setJudul(e.target.value)}
            placeholder="Masukkan nama agenda"
            className="rounded-xl font-semibold"
            readOnly={readOnly}
            disabled={readOnly}
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
            readOnly={readOnly}
            disabled={readOnly}
          />
        </div>

        {/* Kategori & Status */}
        <div className="grid grid-cols-2 gap-3">
          {/* Kategori */}
          <div className="space-y-2">
            <Label>Kategori</Label>
            <Select value={kategoriId} onValueChange={setKategoriId} disabled={readOnly}>
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

          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus} disabled={readOnly}>
              <SelectTrigger className="rounded-xl font-semibold">
                <SelectValue placeholder="Pilih status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", opt.color)} />
                      {opt.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* PIC */}
        <div className="space-y-2">
          <Label>PIC (Penanggung Jawab)</Label>
          <Select value={picId} onValueChange={setPicId} disabled={readOnly}>
            <SelectTrigger className="rounded-xl font-semibold">
              <SelectValue placeholder="Pilih PIC" />
            </SelectTrigger>
            <SelectContent>
              {staffList.map((staff: any) => (
                <SelectItem key={staff.id} value={staff.id}>
                  <div className="flex items-center gap-2">
                    <span>{staff.profiles?.name}</span>
                    {staff.position && (
                      <span className="text-xs text-muted-foreground">
                        ({staff.position})
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tanggal Mulai & Selesai */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Tanggal Mulai {!readOnly && '*'}</Label>
            {readOnly ? (
              <div className="w-full flex items-center gap-2 p-2 rounded-xl border bg-muted/30 text-sm font-semibold">
                <CalendarIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span>
                  {tanggalMulai
                    ? format(tanggalMulai, 'd MMM yyyy', { locale: localeId })
                    : '-'}
                </span>
              </div>
            ) : (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left rounded-xl text-xs sm:text-sm px-2 sm:px-3',
                      tanggalMulai ? 'font-semibold' : 'font-normal text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-1 sm:mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">
                      {tanggalMulai
                        ? format(tanggalMulai, 'd MMM yyyy', { locale: localeId })
                        : 'Pilih tanggal'}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={tanggalMulai}
                    onSelect={setTanggalMulai}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>

          <div className="space-y-2">
            <Label>Tanggal Selesai {!readOnly && '*'}</Label>
            {readOnly ? (
              <div className="w-full flex items-center gap-2 p-2 rounded-xl border bg-muted/30 text-sm font-semibold">
                <CalendarIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span>
                  {tanggalSelesai
                    ? format(tanggalSelesai, 'd MMM yyyy', { locale: localeId })
                    : '-'}
                </span>
              </div>
            ) : (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left rounded-xl text-xs sm:text-sm px-2 sm:px-3',
                      tanggalSelesai ? 'font-semibold' : 'font-normal text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-1 sm:mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">
                      {tanggalSelesai
                        ? format(tanggalSelesai, 'd MMM yyyy', { locale: localeId })
                        : 'Pilih tanggal'}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={tanggalSelesai}
                    onSelect={setTanggalSelesai}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        {/* Document Upload */}
        <div className="space-y-2">
          <Label>Dokumen Pendukung</Label>
          {(documentFile || existingDocumentUrl) ? (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30">
              <FileText className="h-8 w-8 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {documentFile?.name || existingDocumentName || 'Document'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {documentFile 
                    ? `${(documentFile.size / 1024).toFixed(1)} KB` 
                    : 'Dokumen tersimpan'}
                </p>
              </div>
              {existingDocumentUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => window.open(existingDocumentUrl, '_blank')}
                  className="flex-shrink-0"
                  title="Lihat dokumen"
                >
                  <FileText className="h-4 w-4" />
                </Button>
              )}
              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={removeDocument}
                  className="flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ) : readOnly ? (
            <div className="text-sm text-muted-foreground p-3 rounded-xl border border-border bg-muted/30">
              Tidak ada dokumen
            </div>
          ) : (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer",
                isDragging 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-primary/50"
              )}
            >
              <input
                type="file"
                id="document-upload"
                className="hidden"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png"
              />
              <label htmlFor="document-upload" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drag & drop file atau <span className="text-primary font-medium">klik untuk upload</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, DOC, XLS, PPT, JPG, PNG (Maks. 10MB)
                </p>
              </label>
            </div>
          )}
        </div>

        {/* Recurring Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/30">
          <div>
            <Label htmlFor="recurring" className={readOnly ? "" : "cursor-pointer"}>
              Agenda Berulang
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              {readOnly 
                ? (isRecurring ? 'Agenda ini berulang' : 'Agenda ini tidak berulang')
                : 'Aktifkan untuk agenda yang berulang'}
            </p>
          </div>
          <Switch
            id="recurring"
            checked={isRecurring}
            onCheckedChange={setIsRecurring}
            disabled={readOnly}
          />
        </div>

        {/* Recurring Options */}
        {isRecurring && (
          <div className="space-y-4 p-4 rounded-xl border border-border bg-muted/20">
            <div className="space-y-2">
              <Label>Tipe Pengulangan {!readOnly && '*'}</Label>
              <Select value={recurrenceType} onValueChange={setRecurrenceType} disabled={readOnly}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Pilih tipe pengulangan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mingguan">Mingguan</SelectItem>
                  <SelectItem value="bulanan">Bulanan</SelectItem>
                  <SelectItem value="tahunan">Tahunan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Berakhir Pada (Opsional)</Label>
              {readOnly ? (
                <div className="w-full flex items-center gap-2 p-2 rounded-xl border bg-muted/30 text-sm">
                  <CalendarIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <span>
                    {recurrenceEndDate
                      ? format(recurrenceEndDate, 'd MMMM yyyy', { locale: localeId })
                      : 'Tidak ada batas'}
                  </span>
                </div>
              ) : (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal rounded-xl',
                        !recurrenceEndDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {recurrenceEndDate
                        ? format(recurrenceEndDate, 'd MMMM yyyy', { locale: localeId })
                        : 'Tidak ada batas'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={recurrenceEndDate}
                      onSelect={setRecurrenceEndDate}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        )}
      </div>
    </FormDrawer>
  );
}