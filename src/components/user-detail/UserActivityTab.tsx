import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { UserActivityTabProps } from './types';

export function UserActivityTab({ activityLogs }: UserActivityTabProps) {
  return (
    <Card className="rounded-2xl border-0 bg-gradient-to-br from-card via-card to-primary/5 shadow-md">
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Log Aktivitas
        </CardTitle>
        <CardDescription>Riwayat aktivitas pengguna dalam sistem</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activityLogs.map(log => (
            <div 
              key={log.id} 
              className="group flex items-start gap-4 p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all duration-300 border border-transparent hover:border-primary/20"
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors duration-300">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium mb-1">{log.action}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(log.timestamp, 'dd MMM yyyy, HH:mm', { locale: localeId })}
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                {log.type}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
