import { Badge } from '@/components/ui/badge';
import { getJenisUjianShortLabel, type JenisUjian } from '@/lib/ujianUtils';
import { cn } from '@/lib/utils';

interface JenisUjianBadgeProps {
  jenis: JenisUjian;
  className?: string;
}

export function JenisUjianBadge({ jenis, className }: JenisUjianBadgeProps) {
  const label = getJenisUjianShortLabel(jenis);

  const variantClasses = {
    harian: 'bg-slate-100 text-slate-700 border-slate-200',
    uts: 'bg-amber-100 text-amber-700 border-amber-200',
    uas: 'bg-violet-100 text-violet-700 border-violet-200',
    uas_sekolah: 'bg-rose-100 text-rose-700 border-rose-200',
  };

  return (
    <Badge 
      variant="outline" 
      className={cn(
        'text-[10px] font-medium border',
        variantClasses[jenis] || variantClasses.harian,
        className
      )}
    >
      {label}
    </Badge>
  );
}

export default JenisUjianBadge;
