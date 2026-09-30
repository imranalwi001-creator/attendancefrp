import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Moon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  useRamadhanActivities,
  useRamadhanChildLogs,
  useRamadhanConfig,
  getRamadhanStartDate,
  getHijriDay,
} from '@/hooks/useRamadhanLog';

interface Child {
  id: string;
  name: string;
}

export function RamadhanChildSummary() {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [loadingChildren, setLoadingChildren] = useState(true);

  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: ramadhanConfig } = useRamadhanConfig();
  const ramadhanStart = getRamadhanStartDate(ramadhanConfig);
  const hijriDay = getHijriDay(new Date(), ramadhanStart);

  const { data: activities = [] } = useRamadhanActivities();
  const { data: logs = [], isLoading: loadingLogs } = useRamadhanChildLogs(selectedChild || undefined, today);

  // Fetch children
  useEffect(() => {
    const fetchChildren = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('parent_children')
        .select('child_id')
        .eq('parent_id', user.id);
      if (!data || data.length === 0) { setLoadingChildren(false); return; }
      const childIds = data.map((d: any) => d.child_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', childIds);
      const kids: Child[] = (profiles || []).map((p: any) => ({
        id: p.id,
        name: p.name || 'Anak',
      }));
      setChildren(kids);
      if (kids.length > 0) setSelectedChild(kids[0].id);
      setLoadingChildren(false);
    };
    fetchChildren();
  }, [user?.id]);

  if (loadingChildren) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }

  if (children.length === 0) return null;

  const totalActivities = activities.length;
  const completedCount = logs.length;
  const percentage = totalActivities > 0 ? Math.round((completedCount / totalActivities) * 100) : 0;

  // Check shalat 5 waktu + puasa
  const loggedIds = new Set(logs.map((l) => l.activity_id));
  const shalatTitles = ['Shalat Subuh', 'Shalat Dhuhur', 'Shalat Ashar', 'Shalat Maghrib', 'Shalat Isya'];
  const puasaTitle = 'Puasa';

  const statusItems = [
    ...shalatTitles.map((title) => {
      const activity = activities.find((a) => a.title === title);
      return { label: title.replace('Shalat ', ''), done: activity ? loggedIds.has(activity.id) : false };
    }),
    {
      label: 'Puasa',
      done: (() => {
        const a = activities.find((a) => a.title === puasaTitle);
        return a ? loggedIds.has(a.id) : false;
      })(),
    },
  ];

  return (
    <Card className="rounded-2xl border shadow-sm overflow-hidden">
      <CardHeader className="pb-2 px-4 pt-0 bg-gradient-to-r from-primary/10 via-primary/5 to-background">
        <div className="flex items-center justify-between pt-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Moon className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-sm font-semibold">Ramadhan Hari ke-{hijriDay}</CardTitle>
          </div>
          {children.length > 1 && (
            <Select value={selectedChild || ''} onValueChange={setSelectedChild}>
              <SelectTrigger className="w-32 h-8 text-xs bg-muted/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {children.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-3 space-y-3">
        {loadingLogs ? (
          <Skeleton className="h-16 w-full" />
        ) : logs.length === 0 ? (
          <div className="text-center py-4 space-y-1">
            <p className="text-sm text-muted-foreground">Belum ada aktivitas hari ini</p>
            <p className="text-xs text-muted-foreground/70">Anak belum mengisi mutaba'ah</p>
          </div>
        ) : (
          <>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">Amalan Hari Ini</span>
                <span className="text-xs font-bold text-primary">{percentage}%</span>
              </div>
              <Progress value={percentage} className="h-2.5" />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {statusItems.map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg border transition-colors ${
                    item.done
                      ? 'bg-primary/5 border-primary/20 text-foreground'
                      : 'bg-muted/30 border-border/50 text-muted-foreground'
                  }`}
                >
                  {item.done ? (
                    <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                  )}
                  <span className="truncate">{item.label}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
