import { DetailButton, ActionButtonGroup } from '@/components/ui/action-buttons';
import { User, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

interface TeacherStats {
  id: string;
  name: string;
  mapelList: string[];
  hadir: number;
  tidakHadir: number;
  tepatWaktu: number;
  terlambat: number;
  sebagaiPengganti?: number;
}

interface TeacherAttendanceCardProps {
  teacher: TeacherStats;
  index?: number;
  onDetailClick?: (teacherId: string) => void;
}

export default function TeacherAttendanceCard({ teacher, index = 0, onDetailClick }: TeacherAttendanceCardProps) {
  return (
    <div 
      className="p-3 md:p-4 rounded-xl border border-border/50 hover:border-primary/20 hover:bg-muted/30 transition-all duration-300 animate-fade-in" 
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_auto] lg:grid-cols-[240px_1fr_auto] items-center gap-3 md:gap-3 lg:gap-4">
        {/* Left: Icon + Name + Mapel */}
        <div className="flex items-center gap-2 md:gap-2.5 min-w-0">
          <div className="flex-shrink-0">
            <div className="w-9 h-9 md:w-9 md:h-9 lg:w-11 lg:h-11 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 md:h-4 md:w-4 lg:h-5 lg:w-5 text-primary" />
            </div>
          </div>
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <h3 className="text-sm md:text-sm lg:text-lg font-semibold text-foreground truncate">{teacher.name}</h3>
            <p className="text-xs md:text-xs lg:text-base text-muted-foreground truncate">
              {teacher.mapelList.length > 0 ? teacher.mapelList.join(', ') : 'Tidak ada mapel'}
            </p>
          </div>
        </div>

        {/* Stats Grid - hidden on mobile, compact on tablet, full on desktop */}
        <div className="hidden md:flex items-center gap-1.5 lg:gap-2 flex-nowrap justify-center">
          {/* Hadir */}
          <div className="flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 lg:py-2 rounded-lg bg-muted/30">
            <div className="w-5 h-5 lg:w-7 lg:h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: 'hsl(var(--success-bg, 142 76% 93%))' }}>
              <div className="w-3.5 h-3.5 lg:w-5 lg:h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'hsl(var(--success, 142 71% 45%))' }}>
                <CheckCircle className="h-2 w-2 lg:h-3 lg:w-3 text-white" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] lg:text-xs text-muted-foreground uppercase tracking-wide font-medium leading-tight">Hadir</span>
              <span className="text-sm lg:text-lg font-bold text-foreground leading-tight">{teacher.hadir}</span>
            </div>
          </div>
          
          {/* Tidak Hadir - temporarily hidden */}
          
          {/* Tepat Waktu */}
          <div className="flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 lg:py-2 rounded-lg bg-muted/30">
            <div className="w-5 h-5 lg:w-7 lg:h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: 'hsl(var(--info-bg, 217 91% 95%))' }}>
              <div className="w-3.5 h-3.5 lg:w-5 lg:h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'hsl(var(--info, 217 91% 60%))' }}>
                <Clock className="h-2 w-2 lg:h-3 lg:w-3 text-white" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] lg:text-xs text-muted-foreground uppercase tracking-wide font-medium leading-tight">On Time</span>
              <span className="text-sm lg:text-lg font-bold text-foreground leading-tight">{teacher.tepatWaktu}</span>
            </div>
          </div>
          
          {/* Terlambat */}
          <div className="flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 lg:py-2 rounded-lg bg-muted/30">
            <div className="w-5 h-5 lg:w-7 lg:h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: 'hsl(var(--warning-bg, 24 94% 93%))' }}>
              <div className="w-3.5 h-3.5 lg:w-5 lg:h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'hsl(var(--warning, 24 94% 50%))' }}>
                <AlertCircle className="h-2 w-2 lg:h-3 lg:w-3 text-white" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] lg:text-xs text-muted-foreground uppercase tracking-wide font-medium leading-tight">Telat</span>
              <span className="text-sm lg:text-lg font-bold text-foreground leading-tight">{teacher.terlambat}</span>
            </div>
          </div>
        </div>

        {/* Mobile Stats Grid - only visible on mobile */}
        <div className="flex md:hidden items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-success/10 text-success">
            <CheckCircle className="h-3 w-3" />
            <span className="text-xs font-medium">{teacher.hadir}</span>
          </div>
          {/* Tidak Hadir mobile - temporarily hidden */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-info/10 text-info">
            <Clock className="h-3 w-3" />
            <span className="text-xs font-medium">{teacher.tepatWaktu}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-warning/10 text-warning">
            <AlertCircle className="h-3 w-3" />
            <span className="text-xs font-medium">{teacher.terlambat}</span>
          </div>
        </div>

        {/* Aksi Detail */}
        <ActionButtonGroup className="hidden md:flex ml-auto flex-shrink-0">
          <DetailButton onClick={() => onDetailClick?.(teacher.id)} />
        </ActionButtonGroup>

        {/* Mobile Action - full width button */}
        <div className="md:hidden w-full">
          <DetailButton onClick={() => onDetailClick?.(teacher.id)} className="w-full justify-center" />
        </div>
      </div>
    </div>
  );
}
