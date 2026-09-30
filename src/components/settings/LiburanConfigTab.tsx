import { useState, useMemo } from 'react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Plus, Power, PowerOff, Trash2, CalendarDays, Loader2, Palmtree } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExtractionCardHeader } from '@/components/ui/extraction-card-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import {
  useLiburanNasionalEvents,
  useLiburanConfigs,
  useCreateLiburanConfig,
  useToggleLiburanConfig,
  useDeleteLiburanConfig,
} from '@/hooks/useLiburanConfig';

export default function LiburanConfigTab() {
  const { data: events = [], isLoading: eventsLoading } = useLiburanNasionalEvents();
  const { data: configs = [], isLoading: configsLoading } = useLiburanConfigs();
  const createMutation = useCreateLiburanConfig();
  const toggleMutation = useToggleLiburanConfig();
  const deleteMutation = useDeleteLiburanConfig();

  const [open, setOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [nama, setNama] = useState('');

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId),
    [events, selectedEventId]
  );

  const handleEventSelect = (eventId: string) => {
    setSelectedEventId(eventId);
    const ev = events.find((e) => e.id === eventId);
    if (ev) setNama(ev.judul);
  };

  const handleSubmit = () => {
    if (!selectedEvent || !nama.trim()) return;
    createMutation.mutate(
      {
        nama: nama.trim(),
        tanggal_mulai: selectedEvent.tanggal_mulai,
        tanggal_selesai: selectedEvent.tanggal_selesai,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setSelectedEventId('');
          setNama('');
        },
      }
    );
  };

  const formatDate = (d: string) => format(parseISO(d), 'd MMM yyyy', { locale: localeId });

  const isLoading = eventsLoading || configsLoading;

  return (
    <Card className="rounded-2xl border shadow-sm">
      <ExtractionCardHeader
        icon={<Palmtree className="h-4 w-4 text-primary" />}
        title="Konfigurasi Liburan"
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Tambah
          </Button>
        }
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat Konfigurasi Liburan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Pilih Event Libur Nasional</Label>
              <Select value={selectedEventId} onValueChange={handleEventSelect}>
                <SelectTrigger>
                  <SelectValue placeholder={eventsLoading ? 'Memuat...' : 'Pilih event kalender'} />
                </SelectTrigger>
                <SelectContent>
                  {events.map((ev) => (
                    <SelectItem key={ev.id} value={ev.id}>
                      {ev.judul} ({formatDate(ev.tanggal_mulai)} – {formatDate(ev.tanggal_selesai)})
                    </SelectItem>
                  ))}
                  {events.length === 0 && !eventsLoading && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Tidak ada event Libur Nasional yang tersedia
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedEvent && (
              <>
                <div className="space-y-2">
                  <Label>Nama Konfigurasi</Label>
                  <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama liburan" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Tanggal Mulai</Label>
                    <div className="text-sm font-medium">{formatDate(selectedEvent.tanggal_mulai)}</div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Tanggal Selesai</Label>
                    <div className="text-sm font-medium">{formatDate(selectedEvent.tanggal_selesai)}</div>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  Durasi: {differenceInDays(parseISO(selectedEvent.tanggal_selesai), parseISO(selectedEvent.tanggal_mulai)) + 1} hari
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Batal</Button>
            </DialogClose>
            <Button onClick={handleSubmit} disabled={!selectedEvent || !nama.trim() || createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CardContent className="pt-4 space-y-4">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : configs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <CalendarDays className="h-10 w-10 mb-3" />
            <p className="text-sm">Belum ada konfigurasi liburan</p>
            <p className="text-xs">Tambahkan konfigurasi dari event Libur Nasional di kalender</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {configs.map((cfg) => {
            const durasi = differenceInDays(parseISO(cfg.tanggal_selesai), parseISO(cfg.tanggal_mulai)) + 1;
            return (
              <Card key={cfg.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{cfg.nama}</CardTitle>
                    <Badge variant={cfg.is_active ? 'default' : 'secondary'}>
                      {cfg.is_active ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {formatDate(cfg.tanggal_mulai)} – {formatDate(cfg.tanggal_selesai)} · {durasi} hari
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={cfg.is_active ? 'outline' : 'default'}
                        onClick={() => toggleMutation.mutate({ id: cfg.id, is_active: !cfg.is_active })}
                        disabled={toggleMutation.isPending}
                      >
                        {cfg.is_active ? <PowerOff className="h-4 w-4 mr-1" /> : <Power className="h-4 w-4 mr-1" />}
                        {cfg.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Hapus konfigurasi?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Konfigurasi "{cfg.nama}" akan dihapus permanen.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(cfg.id)}>
                              Hapus
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      </CardContent>
    </Card>
  );
}
