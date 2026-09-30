import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CalendarIcon, Save, Lock, X } from 'lucide-react';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';
import { cn } from '@/lib/utils';
import { Tugas } from '@/types';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface TugasFormProps {
  tugas?: Tugas;
  mapelId: string;
  semester: 'ganjil' | 'genap';
  onBack: () => void;
  onSave: (tugas: Partial<Tugas>) => void;
  renderFooter?: boolean;
}

export default function TugasForm({ tugas, mapelId, semester, onBack, onSave, renderFooter = true }: TugasFormProps) {
  const [loading, setLoading] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [materiList, setMateriList] = useState<Array<{ id: string; judul: string }>>([]);
  const [formData, setFormData] = useState<{
    judul: string;
    deskripsi: string;
    bab: string;
    tipeJawaban: 'file' | 'teks' | 'link' | 'semua';
    deadline: Date | undefined;
    status: string;
  }>({
    judul: tugas?.judul || '',
    deskripsi: tugas?.deskripsi || '',
    bab: tugas?.bab || '',
    tipeJawaban: (tugas?.tipe_jawaban || tugas?.tipeJawaban || 'teks') as 'file' | 'teks' | 'link' | 'semua',
    deadline: tugas?.tanggal_deadline ? new Date(tugas.tanggal_deadline) : tugas?.deadline ? new Date(tugas.deadline) : undefined,
    status: tugas?.status || 'aktif'
  });

  // Fetch materi list for bab/topik options
  useEffect(() => {
    const fetchMateri = async () => {
      try {
        const { data, error } = await supabase
          .from('materi')
          .select('id, judul')
          .eq('mapel_id', mapelId)
          .eq('status', 'aktif')
          .order('urutan', { ascending: true });

        if (error) throw error;
        setMateriList(data || []);
      } catch (error) {
        console.error('Error fetching materi:', error);
      }
    };

    if (mapelId) {
      fetchMateri();
    }
  }, [mapelId]);


  const handleSave = async () => {
    if (!formData.judul.trim()) {
      toast.error('Judul tugas wajib diisi');
      return;
    }

    if (!formData.deadline) {
      toast.error('Deadline tugas wajib diisi');
      return;
    }

    setLoading(true);
    try {
      const tugasData = {
        mapel_id: mapelId,
        judul: formData.judul,
        deskripsi: formData.deskripsi,
        bab: formData.bab === 'tidak-ada' ? null : formData.bab || null,
        tipe_jawaban: formData.tipeJawaban,
        tanggal_mulai: new Date().toISOString(),
        tanggal_deadline: formData.deadline.toISOString(),
        status: formData.status,
        semester: semester
      };

      if (tugas?.id) {
        const { error } = await supabase
          .from('tugas')
          .update(tugasData)
          .eq('id', tugas.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tugas')
          .insert([tugasData]);

        if (error) throw error;
      }

      toast.success(tugas ? 'Tugas berhasil diperbarui' : 'Tugas berhasil disimpan');
      
      onSave({
        id: tugas?.id || Date.now().toString(),
        mapelId,
        judul: formData.judul,
        deskripsi: formData.deskripsi,
        bab: formData.bab,
        tipeJawaban: formData.tipeJawaban,
        deadline: formData.deadline?.toISOString(),
        status: formData.status,
        createdAt: tugas?.createdAt || new Date().toISOString()
      });
    } catch (error: any) {
      toast.error(error.message || 'Gagal menyimpan tugas');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    if (!tugas?.id) return;

    setLoading(true);
    setShowCloseDialog(false); // Close the dialog
    
    try {
      console.log('Closing tugas with id:', tugas.id);
      
      const { data, error } = await supabase
        .from('tugas')
        .update({ status: 'ditutup' })
        .eq('id', tugas.id)
        .select();

      if (error) {
        console.error('Error closing tugas:', error);
        throw error;
      }

      console.log('Tugas closed successfully:', data);
      toast.success('Tugas berhasil ditutup');

      // Wait a bit for database to update
      await new Promise(resolve => setTimeout(resolve, 500));

      onSave({
        id: tugas?.id || Date.now().toString(),
        mapelId,
        judul: formData.judul,
        deskripsi: formData.deskripsi,
        bab: formData.bab,
        tipeJawaban: formData.tipeJawaban,
        deadline: formData.deadline?.toISOString(),
        status: 'ditutup',
        createdAt: tugas?.createdAt || new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Failed to close tugas:', error);
      toast.error(error.message || 'Gagal menutup tugas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Hidden buttons for external trigger */}
      <button
        type="button"
        data-tugas-save
        onClick={handleSave}
        className="hidden"
      />
      <button
        type="button"
        data-tugas-close
        onClick={() => setShowCloseDialog(true)}
        className="hidden"
      />
    <div className="space-y-6">
        {/* Judul Tugas */}
        <div className="space-y-2">
          <Label htmlFor="judul">Judul Tugas *</Label>
          <Input
            id="judul"
            placeholder="Masukkan judul tugas"
            value={formData.judul}
            onChange={(e) => setFormData({ ...formData, judul: e.target.value })}
            className="rounded-xl bg-background border-border"
          />
        </div>

        {/* Deskripsi */}
        <div className="space-y-2">
          <Label htmlFor="deskripsi">Deskripsi</Label>
          <RichTextEditor
            value={formData.deskripsi}
            onChange={(value) => setFormData({ ...formData, deskripsi: value })}
            placeholder="Masukkan deskripsi tugas..."
          />
        </div>

        {/* Bab / Topik */}
        <div className="space-y-2">
          <Label htmlFor="bab">Bab / Topik <span className="text-muted-foreground text-xs">(Opsional)</span></Label>
          <Select
            value={formData.bab}
            onValueChange={(value) => setFormData({ ...formData, bab: value })}
          >
            <SelectTrigger className="rounded-xl bg-background border-border">
              <SelectValue placeholder="Pilih materi atau kosongkan jika tidak ada" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tidak-ada">Tidak ada</SelectItem>
              {materiList.map((materi) => (
                <SelectItem key={materi.id} value={materi.judul}>
                  {materi.judul}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Tipe Jawaban */}
          <div className="space-y-2">
            <Label htmlFor="tipeJawaban">Tipe Jawaban *</Label>
            <Select
              value={formData.tipeJawaban}
              onValueChange={(value: 'file' | 'teks' | 'link' | 'semua') => setFormData({ ...formData, tipeJawaban: value })}
            >
              <SelectTrigger id="tipeJawaban" className="rounded-xl bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="teks">Teks</SelectItem>
                <SelectItem value="file">File</SelectItem>
                <SelectItem value="link">Link</SelectItem>
                <SelectItem value="semua">Semua Tipe (Teks, File, atau Link)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value: 'aktif' | 'draft') => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger id="status" className="rounded-xl bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="aktif">Publish</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Deadline */}
        <div className="space-y-2">
          <Label>Deadline</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal rounded-xl bg-background border-border",
                  !formData.deadline && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.deadline ? (
                  format(formData.deadline, 'PPP HH:mm', { locale: idLocale })
                ) : (
                  <span>Pilih tanggal deadline</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-xl" align="start">
              <Calendar
                mode="single"
                selected={formData.deadline}
                onSelect={(date) => setFormData({ ...formData, deadline: date })}
                initialFocus
                className="rounded-xl pointer-events-auto"
              />
              {formData.deadline && (
                <div className="p-3 border-t">
                  <Label className="text-xs">Waktu</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Select
                      value={format(formData.deadline, 'HH')}
                      onValueChange={(hour) => {
                        const newDate = new Date(formData.deadline!);
                        newDate.setHours(parseInt(hour));
                        setFormData({ ...formData, deadline: newDate });
                      }}
                    >
                      <SelectTrigger className="w-20 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={i.toString().padStart(2, '0')}>
                            {i.toString().padStart(2, '0')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground">:</span>
                    <Select
                      value={format(formData.deadline, 'mm')}
                      onValueChange={(minute) => {
                        const newDate = new Date(formData.deadline!);
                        newDate.setMinutes(parseInt(minute));
                        setFormData({ ...formData, deadline: newDate });
                      }}
                    >
                      <SelectTrigger className="w-20 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 60 }, (_, i) => (
                          <SelectItem key={i} value={i.toString().padStart(2, '0')}>
                            {i.toString().padStart(2, '0')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Action Buttons - only show when renderFooter is true */}
        {renderFooter && (
          <div className="flex flex-wrap gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onBack}
              className="rounded-xl"
              disabled={loading}
            >
              <X className="h-4 w-4 mr-2" />
              Batal
            </Button>
            <Button
              onClick={handleSave}
              className="rounded-xl"
              disabled={loading}
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Menyimpan...' : 'Simpan Tugas'}
            </Button>
            {tugas && formData.status === 'aktif' && (
              <Button
                onClick={() => setShowCloseDialog(true)}
                variant="secondary"
                className="rounded-xl ml-auto"
                disabled={loading}
              >
                <Lock className="h-4 w-4 mr-2" />
                Tutup Tugas
              </Button>
            )}
          </div>
        )}
      </div>

    {/* Close Confirmation Dialog */}
    <AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-destructive/10">
              <Lock className="h-5 w-5 text-destructive" />
            </div>
            Tutup Tugas?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base pt-2">
            Apakah Anda yakin ingin menutup tugas <span className="font-semibold text-foreground">"{tugas?.judul}"</span>?
            <div className="mt-3 p-3 bg-muted rounded-lg space-y-2">
              <p className="text-sm font-medium text-foreground">Setelah ditutup:</p>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>Santri tidak bisa lagi mengumpulkan tugas</li>
                <li>Santri tidak bisa mengedit jawaban yang sudah dikumpulkan</li>
                <li>Status tugas akan berubah menjadi "Ditutup"</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleClose}
            className="rounded-xl bg-destructive hover:bg-destructive/90"
            disabled={loading}
          >
            {loading ? 'Menutup...' : 'Ya, Tutup Tugas'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
