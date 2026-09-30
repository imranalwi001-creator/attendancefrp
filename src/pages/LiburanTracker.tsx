import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ArrowLeft, Palmtree } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  useLiburanActivities,
  useLiburanDailyLogs,
  useSaveLiburanLog,
  useLiburanMood,
  useSaveLiburanMood,
  useLiburanConfig,
  getLiburanStartDate,
  getLiburanDay,
  getLiburanDuration,
} from '@/hooks/useLiburanLog';
import { LiburanLogForm } from '@/components/liburan/LiburanLogForm';
import { FeelingDrawer } from '@/components/ramadhan/FeelingDrawer';
import { LiburanCalendarGrid } from '@/components/liburan/LiburanCalendarGrid';

interface Child { id: string; name: string; }

export default function LiburanTracker() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isParent = user?.role === 'orangtua';
  // Kebalikan dari Ramadhan: orangtua yang mengisi, santri hanya melihat
  const isSantri = user?.role === 'santri';
  const canEdit = isParent; // Orangtua yang bisa edit
  const isReadOnly = !canEdit; // Santri dan role lain hanya view

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showFeeling, setShowFeeling] = useState(false);
  const [lastSavedCount, setLastSavedCount] = useState(0);
  const [activeTab, setActiveTab] = useState(isParent ? 'aktivitas' : 'ringkasan');

  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [loadingChildren, setLoadingChildren] = useState(isParent);

  useEffect(() => {
    if (!isParent || !user?.id) return;
    const fetchChildren = async () => {
      const { data } = await supabase.from('parent_children').select('child_id').eq('parent_id', user.id);
      if (!data || data.length === 0) { setLoadingChildren(false); return; }
      const childIds = data.map((d: any) => d.child_id);
      const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', childIds);
      const kids: Child[] = (profiles || []).map((p: any) => ({ id: p.id, name: p.name || 'Anak' }));
      setChildren(kids);
      if (kids.length > 0) setSelectedChild(kids[0].id);
      setLoadingChildren(false);
    };
    fetchChildren();
  }, [isParent, user?.id]);

  const targetUserId = isParent ? selectedChild : user?.id;
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const { data: liburanConfig, isSuccess: configLoaded } = useLiburanConfig();
  const liburanStart = getLiburanStartDate(liburanConfig);
  const totalDays = getLiburanDuration(liburanConfig);
  const liburanEnd = new Date(liburanConfig?.tanggal_selesai ? liburanConfig.tanggal_selesai + 'T00:00:00' : liburanStart.getTime() + (totalDays - 1) * 86400000);
  const rawDay = getLiburanDay(selectedDate, liburanStart, totalDays, false);
  const dayNumber = Math.max(1, Math.min(totalDays, rawDay));
  const isInPeriod = rawDay >= 1 && rawDay <= totalDays;

  const { data: activities = [], isLoading: loadingActivities } = useLiburanActivities();
  const { data: logs = [], isLoading: loadingLogs } = useLiburanDailyLogs(targetUserId || undefined, dateStr);
  const { data: mood } = useLiburanMood(targetUserId || undefined, dateStr);
  const saveLog = useSaveLiburanLog();
  const saveMood = useSaveLiburanMood();

  const handlePrevDay = () => setSelectedDate((d) => { const prev = new Date(d); prev.setDate(prev.getDate() - 1); return prev; });
  const handleNextDay = () => setSelectedDate((d) => { const next = new Date(d); next.setDate(next.getDate() + 1); return next; });

  const [pendingCheckedIds, setPendingCheckedIds] = useState<string[]>([]);
  const [pendingExcuses, setPendingExcuses] = useState<Record<string, string> | undefined>(undefined);

  const handleSave = (checkedIds: string[], excuses?: Record<string, string>) => {
    if (!targetUserId) return;
    setPendingCheckedIds(checkedIds);
    setPendingExcuses(excuses);
    setLastSavedCount(checkedIds.length);
    setShowFeeling(true);
  };

  const handleFeelingClose = (selectedMood: string | null) => {
    setShowFeeling(false);
    if (!selectedMood || !targetUserId) { setPendingCheckedIds([]); return; }
    saveLog.mutate(
      { santriId: targetUserId, date: dateStr, checkedActivityIds: pendingCheckedIds, dayNumber, excuses: pendingExcuses },
      { onSuccess: () => { saveMood.mutate({ santriId: targetUserId!, date: dateStr, mood: selectedMood }); setPendingCheckedIds([]); } }
    );
  };

  return (
    <div className="space-y-4 pb-24">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="rounded-2xl bg-primary p-4 md:p-6 shadow-lg space-y-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => window.history.length > 2 ? navigate(-1) : navigate('/app/dashboard')} className="rounded-xl h-10 w-10 shrink-0 border-2 border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/20 hover:border-white/30 transition-all duration-200">
              <ArrowLeft className="h-4 w-4 text-white" />
            </Button>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg md:text-xl font-bold text-white truncate">{isParent ? "Kontroling Liburan" : "Aktifitas Liburan"}</h2>
              <p className="text-sm text-white/70 truncate flex items-center gap-1.5"><Palmtree className="h-3.5 w-3.5" />{isParent ? "Catat aktivitas harian anak" : "Lihat aktivitasmu selama liburan"}</p>
            </div>
          </div>
          <TabsList className="grid w-full grid-cols-2 gap-1.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 p-1.5 h-auto">
            <TabsTrigger value="ringkasan" className="rounded-lg py-2.5 px-3 text-white/70 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=inactive]:hover:bg-white/10 transition-all duration-200 font-medium text-sm">Ringkasan</TabsTrigger>
            <TabsTrigger value="aktivitas" className="rounded-lg py-2.5 px-3 text-white/70 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=inactive]:hover:bg-white/10 transition-all duration-200 font-medium text-sm">Aktifitas Hari Ini</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="ringkasan">
          {targetUserId && configLoaded && liburanConfig ? (
            <LiburanCalendarGrid liburanStart={liburanStart} liburanEnd={liburanEnd} activities={activities} santriId={targetUserId} hideReminder={isSantri} onDayClick={(date) => { setSelectedDate(date); setActiveTab('aktivitas'); }} />
          ) : (
            <div className="text-center text-sm text-muted-foreground py-12">Memuat data...</div>
          )}
        </TabsContent>

        <TabsContent value="aktivitas">
          {isParent && children.length > 1 && (
            <Select value={selectedChild || ''} onValueChange={setSelectedChild}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Pilih anak" /></SelectTrigger>
              <SelectContent>{children.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
            </Select>
          )}

          {loadingActivities || loadingChildren ? (
            <div className="text-center text-sm text-muted-foreground py-8">Memuat data...</div>
          ) : isParent && !selectedChild ? (
            <div className="text-center text-sm text-muted-foreground py-8">Tidak ada data anak ditemukan.</div>
          ) : !isInPeriod ? (
            <div className="text-center text-sm text-muted-foreground py-12 space-y-2">
              <Palmtree className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <p className="font-medium">Di luar periode liburan</p>
              <p className="text-xs">Pengisian aktivitas hanya tersedia selama periode liburan aktif</p>
            </div>
          ) : (
            <LiburanLogForm
              activities={activities}
              existingLogs={logs}
              isLoadingLogs={loadingLogs}
              isSaving={saveLog.isPending}
              onSave={handleSave}
              savedMood={mood?.mood || null}
              readOnly={isReadOnly}
              dateLabel={format(selectedDate, 'EEEE, d MMMM yyyy', { locale: localeId })}
              dayLabel={isInPeriod ? `Liburan Hari ke-${dayNumber}` : rawDay < 1 ? `${Math.abs(rawDay - 1)} hari sebelum liburan` : 'Liburan telah berakhir'}
              isInPeriod={isInPeriod}
              onPrevDay={handlePrevDay}
              onNextDay={handleNextDay}
            />
          )}
        </TabsContent>
      </Tabs>

      {canEdit && (
        <FeelingDrawer open={showFeeling} onClose={handleFeelingClose} completedCount={lastSavedCount} totalCount={activities.length} />
      )}
    </div>
  );
}
