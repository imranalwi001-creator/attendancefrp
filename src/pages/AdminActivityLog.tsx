import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { subDays, startOfDay, startOfWeek, startOfMonth } from 'date-fns';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import {
  ActivityLogFilters,
  ActivityLogItem,
  ActivityLogDetailSheet,
  ActivityLogStats,
  type DatePreset,
  type ActivityLog,
} from '@/components/activity-log';

function getDateRange(preset: DatePreset): { start: Date; end: Date } {
  const now = new Date();
  const end = now;
  
  switch (preset) {
    case 'today':
      return { start: startOfDay(now), end };
    case 'yesterday':
      return { start: startOfDay(subDays(now, 1)), end: startOfDay(now) };
    case 'week':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end };
    case 'month':
      return { start: startOfMonth(now), end };
    default:
      return { start: startOfDay(now), end };
  }
}

export default function AdminActivityLog() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  const dateRange = useMemo(() => getDateRange(datePreset), [datePreset]);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['activity-logs', search, roleFilter, datePreset],
    queryFn: async () => {
      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .limit(100);

      if (search) {
        query = query.or(`description.ilike.%${search}%,user_name.ilike.%${search}%`);
      }

      if (roleFilter && roleFilter !== 'all') {
        query = query.eq('user_role', roleFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ActivityLog[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['activity-logs-stats'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const startOfMonthDate = startOfMonth(new Date()).toISOString().split('T')[0];

      const [todayResult, monthResult, usersResult] = await Promise.all([
        supabase
          .from('activity_logs')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', `${today}T00:00:00`),
        supabase
          .from('activity_logs')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', `${startOfMonthDate}T00:00:00`),
        supabase
          .from('activity_logs')
          .select('user_id')
          .gte('created_at', `${today}T00:00:00`),
      ]);

      const uniqueUsers = new Set(usersResult.data?.map(u => u.user_id) || []);

      return {
        todayCount: todayResult.count || 0,
        monthCount: monthResult.count || 0,
        activeUsers: uniqueUsers.size,
      };
    },
  });

  return (
    <div className="space-y-6 pb-24">
      <PageHeader 
        title="Aktifitas Log" 
        subtitle="Catatan aksi penting user berdasarkan role"
      />

      <ActivityLogStats 
        activeUsers={stats?.activeUsers ?? 0}
        todayCount={stats?.todayCount ?? 0}
        monthCount={stats?.monthCount ?? 0}
      />


      <Card>
        <CardContent className="pt-6 space-y-4">
          <ActivityLogFilters
            search={search}
            onSearchChange={setSearch}
            roleFilter={roleFilter}
            onRoleFilterChange={setRoleFilter}
            datePreset={datePreset}
            onDatePresetChange={setDatePreset}
          />
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-start gap-4 p-4 border rounded-lg">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : logs && logs.length > 0 ? (
            <div className="space-y-3">
              {logs.map((log) => (
                <ActivityLogItem
                  key={log.id}
                  log={log}
                  onClick={() => setSelectedLog(log)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <ScrollText className="h-16 w-16 mb-4 opacity-20" />
              <h3 className="text-lg font-medium mb-2">Belum Ada Data Log</h3>
              <p className="text-sm max-w-md">
                Belum ada aktivitas yang tercatat. Log akan muncul saat user melakukan aksi penting dalam sistem.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <ActivityLogDetailSheet
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  );
}
