import { LucideIcon } from 'lucide-react';

interface AttendanceStatCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  bgOuter: string;
  bgInner: string;
  index?: number;
}

export default function AttendanceStatCard({ 
  icon: Icon, 
  label, 
  value, 
  bgOuter, 
  bgInner,
  index = 0 
}: AttendanceStatCardProps) {
  return (
    <div 
      className="bg-card hover:shadow-md transition-all duration-300 animate-fade-in border rounded-lg sm:rounded-xl p-2 sm:p-4" 
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-1 sm:gap-3">
        {/* Double-circle icon badge */}
        <div 
          className="rounded-full p-1.5 sm:p-2.5 shrink-0" 
          style={{ backgroundColor: bgOuter }}
        >
          <div 
            className="rounded-full p-0.5 sm:p-1.5" 
            style={{ backgroundColor: bgInner }}
          >
            <Icon 
              className="h-3 w-3 sm:h-4 sm:w-4" 
              style={{ color: '#FFFFFF' }} 
              strokeWidth={2} 
            />
          </div>
        </div>
        {/* Content */}
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <p className="text-[10px] sm:text-xs text-muted-foreground mb-0 sm:mb-0.5">{label}</p>
          <h3 className="text-base sm:text-2xl font-bold text-foreground">{value}</h3>
        </div>
      </div>
    </div>
  );
}
