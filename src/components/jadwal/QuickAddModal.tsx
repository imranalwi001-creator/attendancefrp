import { useState, useEffect, useMemo, useCallback } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Save, AlertTriangle, Layers, Calendar, Coffee, Moon, Pause, MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Jadwal, Mapel, Kelas, User, JadwalTipe } from '@/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

// Schedule type configuration
const JADWAL_TIPE_CONFIG: Record<JadwalTipe, { label: string; icon: React.ReactNode; color: string }> = {
  pelajaran: { label: 'Mata Pelajaran', icon: null, color: 'bg-primary' },
  istirahat: { label: 'Istirahat', icon: <Coffee className="h-4 w-4" />, color: 'bg-amber-500' },
  tidur_siang: { label: 'Tidur Siang', icon: <Moon className="h-4 w-4" />, color: 'bg-blue-400' },
  break: { label: 'Break', icon: <Pause className="h-4 w-4" />, color: 'bg-slate-400' },
  lainnya: { label: 'Lainnya', icon: <MoreHorizontal className="h-4 w-4" />, color: 'bg-purple-500' }
};

// Base schema for all jadwal types
const baseJadwalSchema = z.object({
  kelasId: z.string().min(1, 'Kelas harus dipilih'),
  tipe: z.enum(['pelajaran', 'istirahat', 'tidur_siang', 'break', 'lainnya']),
  hari: z.enum(['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']),
  jamMulai: z.string().min(1, 'Jam mulai harus diisi'),
  jamSelesai: z.string().min(1, 'Jam selesai harus diisi'),
  ruangan: z.string().optional(),
  status: z.enum(['aktif', 'nonaktif']),
  // Conditional fields
  mapelId: z.string().optional(),
  pengampuId: z.string().optional(),
  label: z.string().optional()
});

// Refined schema with conditional validation
const jadwalSchema = baseJadwalSchema.superRefine((data, ctx) => {
  if (data.tipe === 'pelajaran') {
    if (!data.mapelId || data.mapelId.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Mata pelajaran harus dipilih',
        path: ['mapelId']
      });
    }
    if (!data.pengampuId || data.pengampuId.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Guru pengampu harus dipilih',
        path: ['pengampuId']
      });
    }
  } else if (data.tipe === 'lainnya') {
    if (!data.label || data.label.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Label harus diisi',
        path: ['label']
      });
    }
  }
});

type JadwalFormData = z.infer<typeof baseJadwalSchema>;

interface QuickAddModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingJadwal: Jadwal | null;
  defaultValues?: Partial<JadwalFormData>;
  kelasList: Kelas[] | any[];
  mapelList: Mapel[] | any[];
  guruList: User[] | any[];
  allJadwalList?: any[]; // All schedules for conflict checking
  onSubmit: (data: JadwalFormData) => void;
  // Block system props
  isBlockSystem?: boolean;
  selectedBlockLabel?: string;
  validDays?: string[]; // Valid days from selected block dates
  blockDatesForDay?: string[]; // All dates matching the selected day within the block
}

// Helper function to check time overlap
const hasTimeOverlap = (start1: string, end1: string, start2: string, end2: string): boolean => {
  return start1 < end2 && end1 > start2;
};

export function QuickAddModal({
  open,
  onOpenChange,
  editingJadwal,
  defaultValues,
  kelasList,
  mapelList,
  guruList,
  allJadwalList = [],
  onSubmit,
  isBlockSystem = false,
  selectedBlockLabel,
  validDays,
  blockDatesForDay = []
}: QuickAddModalProps) {
  // Determine which days to show in the dropdown
  const availableDays = validDays && validDays.length > 0 
    ? validDays 
    : ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  
  // Store initial values to track changes
  const [initialValues, setInitialValues] = useState<JadwalFormData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<JadwalFormData>({
    resolver: zodResolver(jadwalSchema),
    defaultValues: {
      kelasId: '',
      tipe: 'pelajaran',
      mapelId: '',
      pengampuId: '',
      hari: 'Senin',
      jamMulai: '',
      jamSelesai: '',
      ruangan: '',
      label: '',
      status: 'aktif',
      ...defaultValues
    }
  });

  const watchedTipe = form.watch('tipe');
  const watchedValues = form.watch(['pengampuId', 'hari', 'jamMulai', 'jamSelesai', 'kelasId', 'mapelId', 'ruangan', 'status', 'tipe', 'label']);
  const [pengampuId, hari, jamMulai, jamSelesai, kelasId, mapelId, ruangan, status, tipe, label] = watchedValues;

  // Check if form has changes compared to initial values
  const hasChanges = useMemo(() => {
    if (!editingJadwal) return true; // New jadwal - always show save
    if (!initialValues) return false;
    
    return (
      initialValues.tipe !== tipe ||
      initialValues.mapelId !== mapelId ||
      initialValues.pengampuId !== pengampuId ||
      initialValues.hari !== hari ||
      initialValues.jamMulai !== jamMulai ||
      initialValues.jamSelesai !== jamSelesai ||
      initialValues.ruangan !== (ruangan || '') ||
      initialValues.label !== (label || '') ||
      initialValues.status !== status
    );
  }, [editingJadwal, initialValues, tipe, mapelId, pengampuId, hari, jamMulai, jamSelesai, ruangan, label, status]);

  // Check for teacher schedule conflicts - only for 'pelajaran' type
  const conflictWarning = useMemo(() => {
    if (tipe !== 'pelajaran') return null; // No teacher conflict for non-pelajaran
    if (!pengampuId || !hari || !jamMulai || !jamSelesai) return null;
    if (jamMulai.length < 5 || jamSelesai.length < 5) return null;

    const conflicts: any[] = [];
    for (const jadwal of allJadwalList) {
      if (editingJadwal && jadwal.id === editingJadwal.id) continue;
      
      const jadwalTipe = jadwal.tipe || 'pelajaran';
      if (jadwalTipe !== 'pelajaran') continue; // Skip non-pelajaran for conflict
      
      const jadwalPengampuId = jadwal.pengampu_id || jadwal.pengampuId;
      if (jadwalPengampuId !== pengampuId || jadwal.hari !== hari) continue;

      const existingStart = jadwal.jam_mulai || jadwal.jamMulai;
      const existingEnd = jadwal.jam_selesai || jadwal.jamSelesai;

      if (hasTimeOverlap(jamMulai, jamSelesai, existingStart, existingEnd)) {
        conflicts.push(jadwal);
      }
    }

    if (conflicts.length === 0) return null;

    const guruName = guruList.find(g => g.id === pengampuId)?.name || 'Guru ini';
    const conflictDetails = conflicts.slice(0, 3).map(c => {
      const kelasName = kelasList.find((k: any) => k.id === (c.kelas_id || c.kelasId))?.nama || 'Kelas';
      const mapelName = c.mapelNama || mapelList.find((m: any) => m.id === (c.mapel_id || c.mapelId))?.nama || 'Mapel';
      return `${mapelName} di ${kelasName} (${c.jam_mulai || c.jamMulai} - ${c.jam_selesai || c.jamSelesai})`;
    });

    return {
      guruName,
      conflicts: conflictDetails
    };
  }, [tipe, pengampuId, hari, jamMulai, jamSelesai, allJadwalList, editingJadwal, guruList, kelasList, mapelList]);

  // Check for class schedule conflicts
  const classConflictWarning = useMemo(() => {
    if (!kelasId || !hari || !jamMulai || !jamSelesai) return null;
    if (jamMulai.length < 5 || jamSelesai.length < 5) return null;

    const conflicts: any[] = [];
    for (const jadwal of allJadwalList) {
      if (editingJadwal && jadwal.id === editingJadwal.id) continue;
      
      const jadwalKelasId = jadwal.kelas_id || jadwal.kelasId;
      if (jadwalKelasId !== kelasId || jadwal.hari !== hari) continue;

      const existingStart = jadwal.jam_mulai || jadwal.jamMulai;
      const existingEnd = jadwal.jam_selesai || jadwal.jamSelesai;

      if (hasTimeOverlap(jamMulai, jamSelesai, existingStart, existingEnd)) {
        conflicts.push(jadwal);
      }
    }

    if (conflicts.length === 0) return null;

    const kelasName = kelasList.find((k: any) => k.id === kelasId)?.nama || 'Kelas ini';
    const conflictDetails = conflicts.slice(0, 3).map(c => {
      const jadwalTipe = c.tipe || 'pelajaran';
      if (jadwalTipe === 'pelajaran') {
        const mapelName = c.mapelNama || mapelList.find((m: any) => m.id === (c.mapel_id || c.mapelId))?.nama || 'Mapel';
        return `${mapelName} (${c.jam_mulai || c.jamMulai} - ${c.jam_selesai || c.jamSelesai})`;
      } else {
        const tipeLabel = JADWAL_TIPE_CONFIG[jadwalTipe as JadwalTipe]?.label || jadwalTipe;
        return `${c.label || tipeLabel} (${c.jam_mulai || c.jamMulai} - ${c.jam_selesai || c.jamSelesai})`;
      }
    });

    return {
      kelasName,
      conflicts: conflictDetails
    };
  }, [kelasId, hari, jamMulai, jamSelesai, allJadwalList, editingJadwal, kelasList, mapelList]);

  useEffect(() => {
    if (!open) return;
    
    if (editingJadwal) {
      const values: JadwalFormData = {
        kelasId: editingJadwal.kelasId || editingJadwal.kelas_id || '',
        tipe: (editingJadwal.tipe || 'pelajaran') as JadwalTipe,
        mapelId: editingJadwal.mapelId || editingJadwal.mapel_id || '',
        pengampuId: editingJadwal.pengampuId || editingJadwal.pengampu_id || '',
        hari: editingJadwal.hari as 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu' | 'Minggu',
        jamMulai: editingJadwal.jamMulai || editingJadwal.jam_mulai || '',
        jamSelesai: editingJadwal.jamSelesai || editingJadwal.jam_selesai || '',
        ruangan: editingJadwal.ruangan || '',
        label: editingJadwal.label || '',
        status: (editingJadwal.status === 'aktif' || editingJadwal.status === 'nonaktif') 
          ? editingJadwal.status 
          : 'aktif'
      };
      form.reset(values);
      setInitialValues(values);
    } else {
      const values = {
        kelasId: defaultValues?.kelasId || '',
        tipe: 'pelajaran' as JadwalTipe,
        mapelId: '',
        pengampuId: '',
        hari: defaultValues?.hari || 'Senin',
        jamMulai: '',
        jamSelesai: '',
        ruangan: '',
        label: '',
        status: 'aktif' as const,
      };
      form.reset(values);
      setInitialValues(null);
    }
  }, [open, editingJadwal, defaultValues, form]);

  const handleSubmit = async (data: JadwalFormData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      form.reset();
      setInitialValues(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto p-0 flex flex-col">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-lg font-semibold">
            {editingJadwal ? 'Edit Jadwal' : `Tambah Jadwal di ${defaultValues?.hari || 'Senin'}`}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Atur tipe jadwal, waktu, pengampu, dan ruangan lalu simpan perubahan.
          </DialogDescription>
          {/* Block System Info */}
          {isBlockSystem && selectedBlockLabel && (
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="secondary" className="bg-primary/10 text-primary border border-primary/20">
                <Layers className="h-3 w-3 mr-1" />
                {selectedBlockLabel}
              </Badge>
            </div>
          )}
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1">
            {/* Content */}
            <div className="px-6 flex-1 overflow-y-auto pt-4 pb-6">
              <div className="space-y-4">
                {/* Show dates for the selected day */}
                {isBlockSystem && blockDatesForDay.length > 0 && (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                      <span>Jadwal berlaku pada tanggal:</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {blockDatesForDay.map((dateStr) => {
                        const date = new Date(dateStr);
                        return (
                          <Badge 
                            key={dateStr} 
                            variant="outline" 
                            className="bg-background text-xs font-normal"
                          >
                            {format(date, 'EEEE, d MMMM yyyy', { locale: idLocale })}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Schedule Type Selector */}
                <FormField
                  control={form.control}
                  name="tipe"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Tipe Jadwal</FormLabel>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value);
                            // Clear mapelId and pengampuId when switching to non-pelajaran
                            if (value !== 'pelajaran') {
                              form.setValue('mapelId', '');
                              form.setValue('pengampuId', '');
                            }
                            // Clear label when switching to pelajaran
                            if (value === 'pelajaran') {
                              form.setValue('label', '');
                            }
                          }}
                          className="grid grid-cols-2 sm:grid-cols-3 gap-2"
                        >
                          {(Object.entries(JADWAL_TIPE_CONFIG) as [JadwalTipe, typeof JADWAL_TIPE_CONFIG[JadwalTipe]][]).map(([key, config]) => (
                            <div key={key}>
                              <RadioGroupItem
                                value={key}
                                id={`tipe-${key}`}
                                className="peer sr-only"
                              />
                              <Label
                                htmlFor={`tipe-${key}`}
                                className={`flex items-center gap-2 rounded-lg border-2 p-3 cursor-pointer transition-all
                                  peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5
                                  hover:bg-muted/50 border-border`}
                              >
                                {config.icon && (
                                  <span className={`p-1.5 rounded-md text-white ${config.color}`}>
                                    {config.icon}
                                  </span>
                                )}
                                <span className="text-sm font-medium">{config.label}</span>
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Teacher Conflict Warning - Only for pelajaran */}
                {conflictWarning && (
                  <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      <span className="font-medium">{conflictWarning.guruName}</span> sudah memiliki jadwal mengajar di waktu yang sama:
                      <ul className="list-disc list-inside mt-1 text-xs">
                        {conflictWarning.conflicts.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Class Conflict Warning */}
                {classConflictWarning && (
                  <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      <span className="font-medium">{classConflictWarning.kelasName}</span> sudah memiliki jadwal di waktu yang sama:
                      <ul className="list-disc list-inside mt-1 text-xs">
                        {classConflictWarning.conflicts.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Conditional: Mapel selector - only for pelajaran */}
                {watchedTipe === 'pelajaran' && (
                  <FormField
                    control={form.control}
                    name="mapelId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Mata Pelajaran</FormLabel>
                        <Select
                          onValueChange={value => {
                            field.onChange(value);
                            const selectedMapel = mapelList.find(m => m.id === value);
                            if (selectedMapel) {
                              const pengampuId = selectedMapel.pengampu_id || (selectedMapel as any).pengampuId;
                              if (pengampuId) form.setValue('pengampuId', pengampuId);
                            }
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Pilih mata pelajaran" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[300px]">
                            {mapelList.map(mapel => {
                              const pengampuId = mapel.pengampu_id || (mapel as any).pengampuId;
                              const guru = guruList.find(g => g.id === pengampuId);
                              return (
                                <SelectItem key={mapel.id} value={mapel.id}>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{mapel.nama}</span>
                                    {guru && (
                                      <span className="text-xs text-muted-foreground">
                                        - {guru.name}
                                      </span>
                                    )}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Conditional: Label input - only for 'lainnya' type */}
                {watchedTipe === 'lainnya' && (
                  <FormField
                    control={form.control}
                    name="label"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Keterangan</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Masukkan keterangan"
                            {...field} 
                            className="h-10" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="jamMulai"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Jam Mulai</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="08:00"
                            {...field}
                            list="time-suggestions-start"
                            className="h-10"
                            pattern="([0-1][0-9]|2[0-3]):[0-5][0-9]"
                          />
                        </FormControl>
                        <datalist id="time-suggestions-start">
                          {Array.from({ length: 24 }, (_, h) =>
                            ['00', '15', '30', '45'].map(m => {
                              const time = `${String(h).padStart(2, '0')}:${m}`;
                              return <option key={time} value={time} />;
                            })
                          ).flat()}
                        </datalist>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="jamSelesai"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Jam Selesai</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="09:30"
                            {...field}
                            list="time-suggestions-end"
                            className="h-10"
                            pattern="([0-1][0-9]|2[0-3]):[0-5][0-9]"
                          />
                        </FormControl>
                        <datalist id="time-suggestions-end">
                          {Array.from({ length: 24 }, (_, h) =>
                            ['00', '15', '30', '45'].map(m => {
                              const time = `${String(h).padStart(2, '0')}:${m}`;
                              return <option key={time} value={time} />;
                            })
                          ).flat()}
                        </datalist>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="ruangan"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Ruangan (Opsional)</FormLabel>
                      <FormControl>
                        <Input placeholder="R-101, Lab Komputer" {...field} className="h-10" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t bg-muted/30">
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="rounded-xl border-primary text-primary hover:bg-primary hover:text-primary-foreground text-xs sm:text-sm h-9 sm:h-10"
                >
                  Batal
                </Button>
                {hasChanges && (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-xl bg-primary hover:bg-primary/90 text-xs sm:text-sm h-9 sm:h-10 gap-2"
                  >
                    {isSubmitting ? (
                      <span className="animate-pulse">Menyimpan...</span>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Simpan
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
