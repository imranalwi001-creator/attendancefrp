import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { getCategoryLabel, getActionLabel, getRoleLabel, ActivityCategory } from '@/lib/activityLogger';
import type { ActivityLog } from './ActivityLogItem';

const roleColors: Record<string, string> = {
  admin: 'bg-red-100 text-red-700 border-red-200',
  guru: 'bg-blue-100 text-blue-700 border-blue-200',
  walikelas: 'bg-purple-100 text-purple-700 border-purple-200',
  santri: 'bg-green-100 text-green-700 border-green-200',
  orangtua: 'bg-amber-100 text-amber-700 border-amber-200',
  Pembina: 'bg-cyan-100 text-cyan-700 border-cyan-200',
};

interface ActivityLogDetailSheetProps {
  log: ActivityLog | null;
  onClose: () => void;
}

export function ActivityLogDetailSheet({ log, onClose }: ActivityLogDetailSheetProps) {
  return (
    <Sheet open={!!log} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Detail Aktivitas</SheetTitle>
        </SheetHeader>
        {log && (
          <div className="space-y-4 mt-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Deskripsi</p>
              <p className="font-medium">{log.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">User</p>
                <p className="font-medium">{log.user_name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Role</p>
                <Badge variant="outline" className={roleColors[log.user_role] || ''}>
                  {getRoleLabel(log.user_role)}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Kategori</p>
                <Badge variant="secondary">
                  {getCategoryLabel(log.category as ActivityCategory)}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Aksi</p>
                <p className="font-medium">{getActionLabel(log.action as any)}</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Waktu</p>
              <p className="font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {format(new Date(log.created_at), 'EEEE, dd MMMM yyyy - HH:mm:ss', { locale: id })}
              </p>
            </div>
            {log.metadata && Object.keys(log.metadata).length > 0 && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Detail Tambahan</p>
                <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-40">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
