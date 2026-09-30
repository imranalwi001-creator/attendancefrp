import { Badge } from '@/components/ui/badge';
import { getStatusUjianLabel, type StatusUjian } from '@/lib/ujianUtils';
import { cn } from '@/lib/utils';

interface StatusUjianBadgeProps {
  status: StatusUjian;
  className?: string;
}

export function StatusUjianBadge({ status, className }: StatusUjianBadgeProps) {
  const label = getStatusUjianLabel(status);

  const variantClasses = {
    terjadwal: 'bg-muted text-muted-foreground border-border',
    berlangsung: 'bg-primary/10 text-primary border-primary/20 animate-pulse',
    selesai: 'bg-primary/10 text-primary border-primary/20',
  };

  return (
    <Badge 
      variant="outline" 
      className={cn(
        'text-[10px] font-medium border',
        variantClasses[status] || variantClasses.terjadwal,
        className
      )}
    >
      {label}
    </Badge>
  );
}

export default StatusUjianBadge;
