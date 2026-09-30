import { useState } from 'react';
import { Book, Clock, MapPin, User, Calendar, Layers, Pencil, Copy, Coffee, Moon, Pause, MoreHorizontal, ArrowRightLeft } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  DetailSheet, 
  DetailSheetInfoItem, 
  DetailSheetInfoGrid 
} from '@/components/ui/detail-sheet';
import { JadwalTipe } from '@/types';

const HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

// Jadwal tipe configuration
const JADWAL_TIPE_CONFIG: Record<JadwalTipe, { label: string; icon: React.ReactNode; bgColor: string; textColor: string }> = {
  pelajaran: { label: 'Mata Pelajaran', icon: <Book className="h-6 w-6" />, bgColor: 'bg-primary/10', textColor: 'text-primary' },
  istirahat: { label: 'Istirahat', icon: <Coffee className="h-6 w-6" />, bgColor: 'bg-amber-500/10', textColor: 'text-amber-600' },
  tidur_siang: { label: 'Tidur Siang', icon: <Moon className="h-6 w-6" />, bgColor: 'bg-blue-400/10', textColor: 'text-blue-500' },
  break: { label: 'Break', icon: <Pause className="h-6 w-6" />, bgColor: 'bg-slate-400/10', textColor: 'text-slate-500' },
  lainnya: { label: 'Lainnya', icon: <MoreHorizontal className="h-6 w-6" />, bgColor: 'bg-purple-500/10', textColor: 'text-purple-600' }
};

interface JadwalDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jadwal: any;
  mapelNama: string;
  guruNama: string;
  kelasNama: string;
  onEdit?: () => void;
  onDuplicate?: (targetDays: string[]) => void;
  onMoveToBlock?: () => void;
  // Block system props
  isBlockSystem?: boolean;
  blockLabel?: string;
  blockDates?: string[];
  validDays?: string[];
}

export function JadwalDetailModal({
  open,
  onOpenChange,
  jadwal,
  mapelNama,
  guruNama,
  kelasNama,
  onEdit,
  onDuplicate,
  onMoveToBlock,
  isBlockSystem = false,
  blockLabel,
  blockDates = [],
  validDays
}: JadwalDetailModalProps) {
  const [showDuplicatePanel, setShowDuplicatePanel] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  if (!jadwal) return null;

  const jadwalTipe = (jadwal.tipe || 'pelajaran') as JadwalTipe;
  const tipeConfig = JADWAL_TIPE_CONFIG[jadwalTipe];
  const isPelajaran = jadwalTipe === 'pelajaran';

  // Get available days to duplicate to (exclude current day)
  const availableDays = (validDays || HARI_LIST).filter(day => day !== jadwal.hari);

  const handleDayToggle = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day) 
        : [...prev, day]
    );
  };

  const handleDuplicate = () => {
    if (selectedDays.length > 0 && onDuplicate) {
      onDuplicate(selectedDays);
      setShowDuplicatePanel(false);
      setSelectedDays([]);
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setShowDuplicatePanel(false);
    setSelectedDays([]);
    onOpenChange(false);
  };

  // Display title based on tipe
  const displayTitle = isPelajaran 
    ? mapelNama 
    : jadwal.label || tipeConfig.label;

  const footer = (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClose}
        className="rounded-xl"
      >
        Tutup
      </Button>
      {onDuplicate && !showDuplicatePanel && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDuplicatePanel(true)}
          className="rounded-xl gap-2"
        >
          <Copy className="h-4 w-4" />
          Duplikasi
        </Button>
      )}
      {onMoveToBlock && isBlockSystem && !showDuplicatePanel && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            handleClose();
            onMoveToBlock();
          }}
          className="rounded-xl gap-2"
        >
          <ArrowRightLeft className="h-4 w-4" />
          Pindahkan ke Fase Lain
        </Button>
      )}
      {onEdit && !showDuplicatePanel && (
        <Button
          size="sm"
          onClick={() => {
            handleClose();
            onEdit();
          }}
          className="rounded-xl gap-2"
        >
          <Pencil className="h-4 w-4" />
          Edit Jadwal
        </Button>
      )}
    </>
  );

  return (
    <DetailSheet
      open={open}
      onOpenChange={handleClose}
      icon={tipeConfig.icon}
      iconBgColor={tipeConfig.bgColor}
      iconTextColor={tipeConfig.textColor}
      title={displayTitle}
      subtitle={kelasNama}
      badge={{
        label: jadwal.status === 'aktif' ? 'Aktif' : 'Nonaktif',
        variant: jadwal.status === 'aktif' ? 'success' : 'secondary',
        className: jadwal.status === 'aktif' ? 'bg-green-500' : ''
      }}
      footer={footer}
    >
      {/* Block Info */}
      {isBlockSystem && blockLabel && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <Layers className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">{blockLabel}</span>
        </div>
      )}

      {/* Schedule Info Grid */}
      <DetailSheetInfoGrid columns={2}>
        <DetailSheetInfoItem
          icon={<Calendar className="h-3.5 w-3.5" />}
          label="Hari"
          value={jadwal.hari}
        />
        <DetailSheetInfoItem
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Waktu"
          value={`${jadwal.jamMulai || jadwal.jam_mulai} - ${jadwal.jamSelesai || jadwal.jam_selesai}`}
        />
        {isPelajaran && (
          <DetailSheetInfoItem
            icon={<User className="h-3.5 w-3.5" />}
            label="Guru Pengampu"
            value={guruNama}
          />
        )}
        <DetailSheetInfoItem
          icon={<MapPin className="h-3.5 w-3.5" />}
          label="Ruangan"
          value={jadwal.ruangan || '-'}
        />
      </DetailSheetInfoGrid>

      {/* Block Dates */}
      {isBlockSystem && blockDates.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Jadwal Berlaku Pada:</p>
            <div className="flex flex-wrap gap-2">
              {blockDates.map((dateStr) => {
                const date = new Date(dateStr);
                return (
                  <Badge 
                    key={dateStr} 
                    variant="outline" 
                    className="bg-background text-xs font-normal"
                  >
                    {format(date, 'd MMM yyyy', { locale: idLocale })}
                  </Badge>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Duplicate Panel */}
      {showDuplicatePanel && (
        <>
          <Separator />
          <div className="space-y-3 p-4 rounded-xl bg-muted/50 border border-border">
            <div className="flex items-center gap-2">
              <Copy className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Duplikasi ke Hari Lain</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Jadwal akan diduplikasi dengan jam yang sama ({jadwal.jamMulai || jadwal.jam_mulai} - {jadwal.jamSelesai || jadwal.jam_selesai})
            </p>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {availableDays.map((day) => (
                <div 
                  key={day} 
                  className="flex items-center space-x-2"
                >
                  <Checkbox
                    id={`day-${day}`}
                    checked={selectedDays.includes(day)}
                    onCheckedChange={() => handleDayToggle(day)}
                  />
                  <Label 
                    htmlFor={`day-${day}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {day}
                  </Label>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowDuplicatePanel(false);
                  setSelectedDays([]);
                }}
                className="rounded-xl"
              >
                Batal
              </Button>
              <Button
                size="sm"
                onClick={handleDuplicate}
                disabled={selectedDays.length === 0}
                className="rounded-xl gap-2"
              >
                <Copy className="h-4 w-4" />
                Duplikasi ({selectedDays.length})
              </Button>
            </div>
          </div>
        </>
      )}
    </DetailSheet>
  );
}
