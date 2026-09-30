import { Search, SlidersHorizontal, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MapelOption {
  id: string;
  nama: string;
}

interface BahanBelajarFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  mapelFilter: string;
  onMapelChange: (value: string) => void;
  mapelList?: MapelOption[];
  kelasFilter?: string;
  onKelasChange?: (value: string) => void;
  kelasList?: Array<{ id: string; nama: string }>;
  showKelasFilter?: boolean;
  showAddButton?: boolean;
  onAddClick?: () => void;
}

export function BahanBelajarFilters({
  searchQuery,
  onSearchChange,
  mapelFilter,
  onMapelChange,
  mapelList = [],
  kelasFilter,
  onKelasChange,
  kelasList = [],
  showKelasFilter = false,
  showAddButton = false,
  onAddClick,
}: BahanBelajarFiltersProps) {
  return (
    <div className="flex gap-3 w-full">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari bahan belajar..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 w-full"
        />
      </div>

      {/* Mapel Filter */}
      <Select value={mapelFilter} onValueChange={onMapelChange}>
        <SelectTrigger className="w-10 sm:w-[180px] shrink-0 px-0 sm:px-3 justify-center sm:justify-between">
          {/* Icon only on mobile */}
          <SlidersHorizontal className="h-4 w-4 sm:hidden" />
          {/* Text on desktop */}
          <span className="hidden sm:inline">
            <SelectValue placeholder="Semua Mapel" />
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua Mapel</SelectItem>
          <SelectItem value="umum">Umum</SelectItem>
          {mapelList.map((mapel) => (
            <SelectItem key={mapel.id} value={mapel.id}>
              {mapel.nama}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Kelas Filter (optional) */}
      {showKelasFilter && onKelasChange && (
        <Select value={kelasFilter || 'all'} onValueChange={onKelasChange}>
          <SelectTrigger className="w-full sm:w-[160px]">
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
      )}

      {/* Add Button */}
      {showAddButton && onAddClick && (
        <Button onClick={onAddClick} className="shrink-0 w-10 sm:w-auto px-0 sm:px-4">
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Tambah</span>
        </Button>
      )}
    </div>
  );
}