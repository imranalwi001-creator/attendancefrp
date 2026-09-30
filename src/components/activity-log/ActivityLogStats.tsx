import { User, ScrollText, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface ActivityLogStatsProps {
  activeUsers: number;
  todayCount: number;
  monthCount: number;
}

export function ActivityLogStats({ activeUsers, todayCount, monthCount }: ActivityLogStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
              <User className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeUsers}</p>
              <p className="text-sm text-muted-foreground">User Aktif Hari Ini</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-500/10 text-green-500">
              <ScrollText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{todayCount}</p>
              <p className="text-sm text-muted-foreground">Log Hari Ini</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{monthCount}</p>
              <p className="text-sm text-muted-foreground">Log Bulan Ini</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
