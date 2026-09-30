import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type DatePreset = 'today' | 'yesterday' | 'week' | 'month';

interface ActivityLogFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  roleFilter: string;
  onRoleFilterChange: (value: string) => void;
  datePreset: DatePreset;
  onDatePresetChange: (value: DatePreset) => void;
}

const datePresetLabels: Record<DatePreset, string> = {
  today: 'Hari Ini',
  yesterday: 'Kemarin',
  week: 'Minggu Ini',
  month: 'Bulan Ini',
};

export function ActivityLogFilters({
  search,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  datePreset,
  onDatePresetChange,
}: ActivityLogFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Cari aktivitas..." 
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={roleFilter} onValueChange={onRoleFilterChange}>
        <SelectTrigger className="w-full sm:w-[160px]">
          <SelectValue placeholder="Semua role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua Role</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
          <SelectItem value="guru">Guru</SelectItem>
          <SelectItem value="walikelas">Wali Kelas</SelectItem>
          <SelectItem value="santri">Santri</SelectItem>
          <SelectItem value="orangtua">Orang Tua</SelectItem>
          <SelectItem value="Pembina">Pembina</SelectItem>
        </SelectContent>
      </Select>
      <Select value={datePreset} onValueChange={(v) => onDatePresetChange(v as DatePreset)}>
        <SelectTrigger className="w-full sm:w-[140px]">
          <SelectValue placeholder="Periode" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">{datePresetLabels.today}</SelectItem>
          <SelectItem value="yesterday">{datePresetLabels.yesterday}</SelectItem>
          <SelectItem value="week">{datePresetLabels.week}</SelectItem>
          <SelectItem value="month">{datePresetLabels.month}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
