import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Moon, Plus, Trash2, Check, CalendarIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ActionButtonGroup, DeleteButton } from '@/components/ui/action-buttons';

interface RamadhanConfig {
  id: string;
  tahun_hijriah: string;
  tanggal_mulai: string;
  is_active: boolean;
  created_at: string;
}

export default function RamadhanConfigForm() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<RamadhanConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [tahunHijriah, setTahunHijriah] = useState('');
  const [tanggalMulai, setTanggalMulai] = useState<Date | undefined>();
  const [showForm, setShowForm] = useState(false);
  const [toggleConfirm, setToggleConfirm] = useState<'activate' | 'deactivate' | null>(null);

  const fetchConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('ramadhan_config' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setConfigs((data || []) as unknown as RamadhanConfig[]);
    } catch (error) {
      console.error('Error fetching ramadhan config:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleSave = async () => {
    if (!tahunHijriah.trim() || !tanggalMulai) {
      toast({ title: 'Error', description: 'Lengkapi semua field', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('ramadhan_config' as any)
        .insert({
          tahun_hijriah: tahunHijriah.trim(),
          tanggal_mulai: format(tanggalMulai, 'yyyy-MM-dd'),
          is_active: true,
        });
      if (error) throw error;
      toast({ title: 'Berhasil', description: 'Konfigurasi Ramadhan berhasil disimpan' });
      setShowForm(false);
      setTahunHijriah('');
      setTanggalMulai(undefined);
      fetchConfigs();
    } catch (error) {
      console.error('Error saving config:', error);
      toast({ title: 'Error', description: 'Gagal menyimpan konfigurasi', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('ramadhan_config' as any)
        .update({ is_active: true })
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'Berhasil', description: 'Konfigurasi diaktifkan' });
      fetchConfigs();
    } catch (error) {
      toast({ title: 'Error', description: 'Gagal mengaktifkan', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('ramadhan_config' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'Berhasil', description: 'Konfigurasi dihapus' });
      fetchConfigs();
    } catch (error) {
      toast({ title: 'Error', description: 'Gagal menghapus', variant: 'destructive' });
    }
  };

  if (loading) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Moon className="h-4 w-4 text-primary" />
          </div>
          <CardTitle className="text-base">Konfigurasi Ramadhan</CardTitle>
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Tambah
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Feature Toggle */}
        {configs.length > 0 && (
          <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/30">
            <div>
              <p className="text-sm font-medium">Tampilkan fitur Ramadhan</p>
              <p className="text-xs text-muted-foreground">Jika nonaktif, menu Ramadhan tersembunyi di semua dashboard</p>
            </div>
            <Switch
              checked={configs.some(c => c.is_active)}
              onCheckedChange={(checked) => {
                setToggleConfirm(checked ? 'activate' : 'deactivate');
              }}
            />
          </div>
        )}

        {/* Toggle Confirmation Dialog */}
        <AlertDialog open={!!toggleConfirm} onOpenChange={(open) => !open && setToggleConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {toggleConfirm === 'activate' ? 'Aktifkan Fitur Ramadhan?' : 'Nonaktifkan Fitur Ramadhan?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {toggleConfirm === 'activate'
                  ? 'Menu Ramadhan akan ditampilkan kembali di dashboard semua role yang memiliki akses.'
                  : 'Menu Ramadhan akan disembunyikan dari dashboard semua role. Data yang sudah ada tetap tersimpan.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={async () => {
                try {
                  if (toggleConfirm === 'activate') {
                    const latestConfig = configs[0];
                    await supabase
                      .from('ramadhan_config' as any)
                      .update({ is_active: true })
                      .eq('id', latestConfig.id);
                  } else {
                    const activeIds = configs.filter(c => c.is_active).map(c => c.id);
                    if (activeIds.length > 0) {
                      await supabase
                        .from('ramadhan_config' as any)
                        .update({ is_active: false })
                        .in('id', activeIds);
                    }
                  }
                  toast({ title: 'Berhasil', description: toggleConfirm === 'activate' ? 'Fitur Ramadhan diaktifkan' : 'Fitur Ramadhan dinonaktifkan' });
                  fetchConfigs();
                } catch (error) {
                  toast({ title: 'Error', description: 'Gagal mengubah status', variant: 'destructive' });
                } finally {
                  setToggleConfirm(null);
                }
              }}>
                {toggleConfirm === 'activate' ? 'Aktifkan' : 'Nonaktifkan'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* Add form */}
        {showForm && (
          <div className="p-4 rounded-xl border bg-muted/30 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tahun Hijriah</Label>
                <Input
                  placeholder="Contoh: 1447H"
                  value={tahunHijriah}
                  onChange={(e) => setTahunHijriah(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>Tanggal 1 Ramadhan</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !tanggalMulai && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {tanggalMulai
                        ? format(tanggalMulai, 'dd MMMM yyyy', { locale: localeId })
                        : 'Pilih tanggal'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={tanggalMulai}
                      onSelect={setTanggalMulai}
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setTahunHijriah(''); setTanggalMulai(undefined); }}>
                Batal
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Menyimpan...' : 'Simpan & Aktifkan'}
              </Button>
            </div>
          </div>
        )}

        {/* Config list */}
        {configs.length === 0 && !showForm ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Belum ada konfigurasi Ramadhan. Tambahkan untuk mengaktifkan fitur Mutaba'ah Ramadhan.
          </div>
        ) : (
          <div className="space-y-2">
            {configs.map((config) => (
              <div
                key={config.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-xl border transition-all',
                  config.is_active
                    ? 'bg-primary/5 border-primary/20'
                    : 'bg-muted/30 border-transparent'
                )}
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">Ramadhan {config.tahun_hijriah}</span>
                      {config.is_active && (
                        <Badge variant="success" className="text-[10px] px-1.5 py-0.5">Aktif</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      1 Ramadhan: {format(new Date(config.tanggal_mulai), 'dd MMMM yyyy', { locale: localeId })}
                    </span>
                  </div>
                </div>
                <ActionButtonGroup>
                  {!config.is_active && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleActivate(config.id)}
                      className="gap-1 text-xs"
                    >
                      <Check className="h-3 w-3" /> Aktifkan
                    </Button>
                  )}
                  <DeleteButton onClick={() => handleDelete(config.id)} />
                </ActionButtonGroup>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
