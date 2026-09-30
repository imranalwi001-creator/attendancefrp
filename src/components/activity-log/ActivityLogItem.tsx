import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { ScrollText, Clock, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getCategoryLabel, getRoleLabel, ActivityCategory } from '@/lib/activityLogger';

export interface ActivityLog {
  id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  action: string;
  category: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

const categoryColors: Record<string, string> = {
  user_management: 'bg-blue-500',
  academic_year: 'bg-purple-500',
  academic: 'bg-orange-500',
  calendar: 'bg-teal-500',
  counseling: 'bg-pink-500',
  attendance: 'bg-emerald-500',
  leave_request: 'bg-sky-500',
  settings: 'bg-slate-500',
};

const roleColors: Record<string, string> = {
  admin: 'bg-red-100 text-red-700 border-red-200',
  guru: 'bg-blue-100 text-blue-700 border-blue-200',
  walikelas: 'bg-purple-100 text-purple-700 border-purple-200',
  santri: 'bg-green-100 text-green-700 border-green-200',
  orangtua: 'bg-amber-100 text-amber-700 border-amber-200',
  Pembina: 'bg-cyan-100 text-cyan-700 border-cyan-200',
};

interface ActivityLogItemProps {
  log: ActivityLog;
  onClick: () => void;
}

export function ActivityLogItem({ log, onClick }: ActivityLogItemProps) {
  return (
    <div
      onClick={onClick}
      className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
    >
      <div className={`p-2 rounded-full ${categoryColors[log.category] || 'bg-gray-500'} text-white shrink-0`}>
        <ScrollText className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground leading-snug">
          {log.description}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <Badge variant="outline" className={roleColors[log.user_role] || ''}>
            {getRoleLabel(log.user_role)}
          </Badge>
          <Badge variant="secondary">
            {getCategoryLabel(log.category as ActivityCategory)}
          </Badge>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {format(new Date(log.created_at), 'dd MMM yyyy, HH:mm', { locale: id })}
          </span>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
    </div>
  );
}
