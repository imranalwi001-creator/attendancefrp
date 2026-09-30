import { Search, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { BankSoalFilter } from '@/hooks/useBankSoal';

interface BankSoalFiltersProps {
  filters: BankSoalFilter;
  onFilterChange: (filters: BankSoalFilter) => void;
}

const MATA_PELAJARAN_OPTIONS = [
  'Matematika',
  'Bahasa Indonesia',
  'Bahasa Inggris',
  'IPA',
  'IPS',
  'PKN',
  'Pendidikan Agama Islam',
  'Seni Budaya',
  'PJOK',
  'Informatika',
];

const KELAS_OPTIONS = ['7', '8', '9'];

const JENIS_SOAL_OPTIONS = [
  { value: 'pilihan_ganda', label: 'Pilihan Ganda' },
  { value: 'true_false', label: 'Benar/Salah' },
  { value: 'essai', label: 'Essai' },
];

export function BankSoalFilters({ filters, onFilterChange }: BankSoalFiltersProps) {
  const activeFilterCount = [
    filters.mata_pelajaran,
    filters.kelas,
    filters.jenis_soal,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-1 flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari pertanyaan..."
          value={filters.search || ''}
          onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
          className="pl-9"
        />
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Filter
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-4" align="end">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Mata Pelajaran</label>
              <Select
                value={filters.mata_pelajaran || 'all'}
                onValueChange={(value) =>
                  onFilterChange({ ...filters, mata_pelajaran: value === 'all' ? undefined : value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Semua Mapel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Mapel</SelectItem>
                  {MATA_PELAJARAN_OPTIONS.map((mapel) => (
                    <SelectItem key={mapel} value={mapel}>
                      {mapel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tingkat Kelas</label>
              <Select
                value={filters.kelas || 'all'}
                onValueChange={(value) =>
                  onFilterChange({ ...filters, kelas: value === 'all' ? undefined : value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Semua Kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kelas</SelectItem>
                  {KELAS_OPTIONS.map((kelas) => (
                    <SelectItem key={kelas} value={kelas}>
                      Kelas {kelas}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Jenis Soal</label>
              <Select
                value={filters.jenis_soal || 'all'}
                onValueChange={(value) =>
                  onFilterChange({ ...filters, jenis_soal: value === 'all' ? undefined : value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Semua Jenis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Jenis</SelectItem>
                  {JENIS_SOAL_OPTIONS.map((jenis) => (
                    <SelectItem key={jenis.value} value={jenis.value}>
                      {jenis.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
