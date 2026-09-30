import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { AlertTriangle, Calendar, Check, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DetailButton, DeleteButton, ActionButtonGroup } from '@/components/ui/action-buttons';
import type { AcademicYear } from '@/contexts/AcademicYearContext';

interface AcademicYearListProps {
  years: AcademicYear[];
  isLoading: boolean;
  onEdit: (year: AcademicYear) => void;
  onDelete: (year: AcademicYear) => void;
}

export default function AcademicYearList({
  years,
  isLoading,
  onEdit,
  onDelete,
}: AcademicYearListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredYears = useMemo(() => {
    if (!searchQuery.trim()) return years;
    const query = searchQuery.toLowerCase();
    return years.filter((year) => year.name.toLowerCase().includes(query));
  }, [years, searchQuery]);

  // Check if today is outside semester range for an active year
  const isOutsideSemesterRange = (year: AcademicYear): boolean => {
    if (!year.is_active) return false;
    
    const today = new Date();
    const oddStart = new Date(year.odd_semester_start);
    const oddEnd = new Date(year.odd_semester_end);
    const evenStart = new Date(year.even_semester_start);
    const evenEnd = new Date(year.even_semester_end);

    const inOddSemester = today >= oddStart && today <= oddEnd;
    const inEvenSemester = today >= evenStart && today <= evenEnd;

    return !inOddSemester && !inEvenSemester;
  };
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border-2 border-border/50 bg-card p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <Skeleton className="h-5 w-32" />
              </div>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-9 w-9 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (years.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-border/50 bg-card p-10">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="rounded-lg p-3 mb-4" style={{ backgroundColor: '#E7F6F8' }}>
            <Calendar className="h-8 w-8 text-primary" />
          </div>
          <p className="text-muted-foreground font-medium">Belum ada tahun ajaran</p>
          <p className="text-sm text-muted-foreground">Klik tombol "Tambah" untuk membuat tahun ajaran baru</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari tahun ajaran..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {filteredYears.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border/50 bg-card p-6 text-center">
          <p className="text-muted-foreground">Tidak ada hasil untuk "{searchQuery}"</p>
        </div>
      ) : (
        filteredYears.map((year) => (
        <div 
          key={year.id} 
          className={`rounded-xl border-2 bg-card hover:bg-muted/30 transition-all duration-200 p-4 cursor-pointer ${
            year.is_active ? 'border-primary/50 bg-primary/5' : 'border-border/50'
          }`}
        >
          <div className="flex items-center justify-between gap-6">
            {/* Icon + Nama Tahun Ajaran */}
            <div className="w-[220px] shrink-0 flex items-center gap-3">
              <div className="rounded-lg p-2.5 shrink-0" style={{ backgroundColor: '#E7F6F8' }}>
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground text-base truncate" title={year.name}>{year.name}</p>
              </div>
            </div>

            {/* Semester Ganjil */}
            <div className="w-[220px] shrink-0">
              <p className="text-sm text-muted-foreground">Semester Ganjil</p>
              <p className="font-medium text-foreground text-base">
                {format(new Date(year.odd_semester_start), 'dd MMM yyyy', { locale: idLocale })} - {format(new Date(year.odd_semester_end), 'dd MMM yyyy', { locale: idLocale })}
              </p>
            </div>

            {/* Semester Genap */}
            <div className="w-[220px] shrink-0">
              <p className="text-sm text-muted-foreground">Semester Genap</p>
              <p className="font-medium text-foreground text-base">
                {format(new Date(year.even_semester_start), 'dd MMM yyyy', { locale: idLocale })} - {format(new Date(year.even_semester_end), 'dd MMM yyyy', { locale: idLocale })}
              </p>
            </div>

            {/* Status */}
            <div className="w-[140px] shrink-0 flex items-center gap-2">
              <Badge 
                variant={year.is_active ? 'default' : 'secondary'} 
                className="gap-1 font-normal"
              >
                {year.is_active && <Check className="h-3 w-3" />}
                {year.is_active ? 'Aktif' : 'Nonaktif'}
              </Badge>
              {isOutsideSemesterRange(year) && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-center h-6 w-6 rounded-full bg-amber-100 dark:bg-amber-900/30">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Tanggal hari ini di luar rentang semester</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* Actions */}
            <ActionButtonGroup>
              <DetailButton onClick={() => onEdit(year)} />
              <DeleteButton 
                onClick={() => onDelete(year)} 
                disabled={year.is_active}
              />
            </ActionButtonGroup>
          </div>
        </div>
        ))
      )}
    </div>
  );
}
