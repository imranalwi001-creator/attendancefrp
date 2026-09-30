import { useEffect, useState, useMemo } from 'react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { JENIS_UJIAN_OPTIONS, DURASI_UJIAN_OPTIONS } from '@/lib/ujianUtils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Ujian } from '@/hooks/useUjian';

export interface PelaksanaanFormData {
  jenis: string;
  mapelId: string;
  tanggal: Date | undefined;
  durasiMenit: string;
  ruangan: string;
  pengawasId: string;
  aiGradingEnabled: boolean;
}

interface UjianPelaksanaanTabProps {
  ujian?: Ujian | null;
  value: PelaksanaanFormData;
  onChange: (data: PelaksanaanFormData) => void;
  disabled?: boolean;
}

export function UjianPelaksanaanTab({ ujian, value, onChange, disabled = false }: UjianPelaksanaanTabProps) {
  // Check if current duration is a custom value (not in predefined options)
  const predefinedValues = DURASI_UJIAN_OPTIONS.map(opt => opt.value);
  const isCustomDuration = useMemo(() => {
    return value.durasiMenit && !predefinedValues.includes(value.durasiMenit as any);
  }, [value.durasiMenit]);

  // State for custom duration input
  const [customDuration, setCustomDuration] = useState<string>(isCustomDuration ? value.durasiMenit : '');
  const [showCustomInput, setShowCustomInput] = useState<boolean>(isCustomDuration);

  // Update custom input visibility when value changes
  useEffect(() => {
    if (isCustomDuration) {
      setShowCustomInput(true);
      setCustomDuration(value.durasiMenit);
    }
  }, [isCustomDuration, value.durasiMenit]);

  // Fetch mapel list
  const { data: mapelList } = useQuery({
    queryKey: ['mapel-for-ujian'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mapel')
        .select('id, nama, kelas_id')
        .eq('status', 'aktif')
        .order('nama');

      if (error) throw error;
      
      // Fetch kelas separately
      const kelasIds = [...new Set(data.map(m => m.kelas_id))];
      const { data: kelasData } = await supabase
        .from('kelas')
        .select('id, nama, tingkat')
        .in('id', kelasIds);
      
      return data.map(m => ({
        ...m,
        kelas: kelasData?.find(k => k.id === m.kelas_id)
      }));
    },
  });

  // Fetch staff list for pengawas
  const { data: staffList } = useQuery({
    queryKey: ['staff-for-pengawas'],
    queryFn: async (): Promise<{ id: string; profile?: { id: string; name: string } }[]> => {
      const { data: staffData, error } = await supabase.from('staff').select('id');

      if (error) throw error;
      if (!staffData || staffData.length === 0) return [];
      
      const ids = (staffData as { id: string }[]).map(s => s.id);
      const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', ids);
      
      return (staffData as { id: string }[]).map(s => ({
        id: s.id,
        profile: (profiles as { id: string; name: string }[] | null)?.find(p => p.id === s.id)
      }));
    },
  });

  // Sync from ujian prop on initial load
  useEffect(() => {
    if (ujian && !value.mapelId) {
      onChange({
        jenis: ujian.jenis,
        mapelId: ujian.mapel_id,
        tanggal: ujian.tanggal_pelaksanaan ? new Date(ujian.tanggal_pelaksanaan) : undefined,
        durasiMenit: ujian.durasi_menit != null ? String(ujian.durasi_menit) : '0',
        ruangan: ujian.ruangan || '',
        pengawasId: ujian.pengawas_id || '',
        aiGradingEnabled: ujian.ai_grading_enabled ?? true,
      });
    }
  }, [ujian]);

  const updateField = <K extends keyof PelaksanaanFormData>(field: K, fieldValue: PelaksanaanFormData[K]) => {
    onChange({ ...value, [field]: fieldValue });
  };

  // Handle duration select change
  const handleDurationChange = (selectedValue: string) => {
    if (selectedValue === 'custom') {
      setShowCustomInput(true);
      setCustomDuration('');
      // Don't update parent yet - wait for custom input
    } else {
      setShowCustomInput(false);
      setCustomDuration('');
      updateField('durasiMenit', selectedValue);
    }
  };

  // Handle custom duration input change
  const handleCustomDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value.replace(/\D/g, ''); // Only allow digits
    setCustomDuration(inputValue);
    if (inputValue) {
      updateField('durasiMenit', inputValue);
    }
  };

  // Get selected value for dropdown
  const getDropdownValue = () => {
    if (showCustomInput) return 'custom';
    return value.durasiMenit;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Jenis Ujian */}
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70">
            Jenis Ujian *
          </Label>
          <Select value={value.jenis} onValueChange={(v) => updateField('jenis', v)} disabled={disabled}>
            <SelectTrigger className="text-sm" disabled={disabled}>
              <SelectValue placeholder="Pilih jenis ujian" />
            </SelectTrigger>
            <SelectContent>
              {JENIS_UJIAN_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-sm">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mata Pelajaran */}
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70">
            Mata Pelajaran *
          </Label>
          <Select value={value.mapelId} onValueChange={(v) => updateField('mapelId', v)} disabled={disabled}>
            <SelectTrigger className="text-sm" disabled={disabled}>
              <SelectValue placeholder="Pilih mata pelajaran" />
            </SelectTrigger>
            <SelectContent>
              {mapelList?.map((mapel: any) => (
                <SelectItem key={mapel.id} value={mapel.id} className="text-sm">
                  {mapel.nama} - {mapel.kelas?.tingkat} {mapel.kelas?.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tanggal Pelaksanaan */}
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70">
            Tanggal Pelaksanaan *
          </Label>
          {disabled ? (
            <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm">
              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              {value.tanggal ? format(value.tanggal, 'PPP', { locale: localeId }) : 'Tidak ada tanggal'}
            </div>
          ) : (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left text-sm font-normal',
                    !value.tanggal && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {value.tanggal ? format(value.tanggal, 'PPP', { locale: localeId }) : 'Pilih tanggal'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={value.tanggal}
                  onSelect={(date) => updateField('tanggal', date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Durasi Waktu */}
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70">
            Durasi Waktu
          </Label>
          <div className="flex gap-2">
            <Select value={getDropdownValue()} onValueChange={handleDurationChange} disabled={disabled}>
              <SelectTrigger className={cn("text-sm", showCustomInput && "w-1/2")} disabled={disabled}>
                <SelectValue placeholder="Pilih durasi waktu" />
              </SelectTrigger>
              <SelectContent>
                {DURASI_UJIAN_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-sm">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {showCustomInput && (
              <div className="flex-1 relative">
                <Input
                  type="text"
                  inputMode="numeric"
                  value={customDuration}
                  onChange={handleCustomDurationChange}
                  placeholder="Masukkan menit"
                  className="text-sm pr-14"
                  disabled={disabled}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  menit
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Ruangan (Optional) */}
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70">
            Ruangan
          </Label>
          <Input
            value={value.ruangan}
            onChange={(e) => updateField('ruangan', e.target.value)}
            placeholder="Nama ruangan (opsional)"
            className="text-sm"
            disabled={disabled}
          />
        </div>

        {/* Pengawas */}
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70">
            Pengawas
          </Label>
          <Select value={value.pengawasId || 'none'} onValueChange={(v) => updateField('pengawasId', v === 'none' ? '' : v)} disabled={disabled}>
            <SelectTrigger className="text-sm" disabled={disabled}>
              <SelectValue placeholder="Pilih pengawas (opsional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Tidak ada pengawas</SelectItem>
              {staffList?.map((staff: any) => (
                <SelectItem key={staff.id} value={staff.id} className="text-sm">
                  {staff.profile?.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

export default UjianPelaksanaanTab;
