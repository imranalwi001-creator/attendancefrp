import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { useAcademicYearsList } from '@/hooks/useAcademicYears';
import { cn } from '@/lib/utils';

interface SemesterFilterProps {
  value: string;
  onChange: (value: string, tahunAjaranId: string | null, semester: string | null) => void;
  className?: string;
}

export function SemesterFilter({ value, onChange, className }: SemesterFilterProps) {
  const { activeAcademicYear } = useAcademicYear();
  const { data: academicYears = [] } = useAcademicYearsList();

  const options = [
    { value: 'aktif', label: 'Semester Aktif' },
    ...academicYears.flatMap(ay => [
      { value: `${ay.id}_ganjil`, label: `${ay.name} - Ganjil`, tahunAjaranId: ay.id, semester: 'ganjil' },
      { value: `${ay.id}_genap`, label: `${ay.name} - Genap`, tahunAjaranId: ay.id, semester: 'genap' },
    ]),
  ];

  const handleChange = (val: string) => {
    if (val === 'aktif') {
      onChange(val, null, null);
    } else {
      const option = options.find(o => o.value === val);
      onChange(val, (option as any)?.tahunAjaranId || null, (option as any)?.semester || null);
    }
  };

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className={cn("w-full", className)}>
        <SelectValue placeholder="Pilih Semester" />
      </SelectTrigger>
      <SelectContent>
        {options.map(opt => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
