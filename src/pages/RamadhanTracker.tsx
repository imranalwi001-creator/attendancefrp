import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ArrowLeft, CalendarIcon, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActionButtonGroup, BackButton } from '@/components/ui/action-buttons';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  useRamadhanActivities,
  useRamadhanDailyLogs,
  useSaveRamadhanLog,
  useRamadhanMood,
  useSaveRamadhanMood,
  useRamadhanConfig,
  getRamadhanStartDate,
  getHijriDay,
} from '@/hooks/useRamadhanLog';
import { RamadhanLogForm } from '@/components/ramadhan/RamadhanLogForm';
import { FeelingDrawer } from '@/components/ramadhan/FeelingDrawer';
import { RamadhanCalendarGrid } from '@/components/ramadhan/RamadhanCalendarGrid';

interface Child {
  id: string;
  name: string;
}

export default function RamadhanTracker() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isParent = user?.role === 'orangtua';

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showFeeling, setShowFeeling] = useState(false);
  const [lastSavedCount, setLastSavedCount] = useState(0);
  const [activeTab, setActiveTab] = useState('ringkasan');

  // Parent: child selection
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [loadingChildren, setLoadingChildren] = useState(isParent);

  useEffect(() => {
    if (!isParent || !user?.id) return;
    const fetchChildren = async () => {
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
  }, [isParent, user?.id]);

  const targetUserId = isParent ? selectedChild : user?.id;
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const { data: ramadhanConfig, isSuccess: configLoaded } = useRamadhanConfig();
  const ramadhanStart = getRamadhanStartDate(ramadhanConfig);
  const rawHijriDay = getHijriDay(selectedDate, ramadhanStart, false);
  const hijriDay = Math.max(1, Math.min(30, rawHijriDay));
  const isInRamadhan = rawHijriDay >= 1 && rawHijriDay <= 30;

  // Always start on today's date

  const { data: activities = [], isLoading: loadingActivities } = useRamadhanActivities();
  const { data: logs = [], isLoading: loadingLogs } = useRamadhanDailyLogs(targetUserId || undefined, dateStr);
  const { data: mood } = useRamadhanMood(targetUserId || undefined, dateStr);
  const saveLog = useSaveRamadhanLog();
  const saveMood = useSaveRamadhanMood();

  const handlePrevDay = () => {
    setSelectedDate((d) => {
      const prev = new Date(d);
      prev.setDate(prev.getDate() - 1);
      return prev;
    });
  };

  const handleNextDay = () => {
    setSelectedDate((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      return next;
    });
  };

  const [pendingCheckedIds, setPendingCheckedIds] = useState<string[]>([]);
  const [pendingTilawahAwal, setPendingTilawahAwal] = useState('');
  const [pendingTilawahAkhir, setPendingTilawahAkhir] = useState('');
  const [pendingExcuses, setPendingExcuses] = useState<Record<string, string> | undefined>(undefined);

  const handleSave = (checkedIds: string[], tilawahAwal: string, tilawahAkhir: string, excuses?: Record<string, string>) => {
    if (!user?.id) return;
    setPendingCheckedIds(checkedIds);
    setPendingTilawahAwal(tilawahAwal);
    setPendingTilawahAkhir(tilawahAkhir);
    setPendingExcuses(excuses);
    setLastSavedCount(checkedIds.length);
    setShowFeeling(true);
  };

  const handleFeelingClose = (selectedMood: string | null) => {
    setShowFeeling(false);
    if (!selectedMood || !user?.id) {
      setPendingCheckedIds([]);
      setPendingTilawahAwal('');
      setPendingTilawahAkhir('');
      return;
    }
    saveLog.mutate(
      {
        santriId: user.id,
        date: dateStr,
        checkedActivityIds: pendingCheckedIds,
        hijriDay,
        excuses: pendingExcuses,
      },
      {
        onSuccess: () => {
          saveMood.mutate({ santriId: user.id!, date: dateStr, mood: selectedMood, tilawah_surah_awal: pendingTilawahAwal, tilawah_surah_akhir: pendingTilawahAkhir });
          setPendingCheckedIds([]);
          setPendingTilawahAwal('');
          setPendingTilawahAkhir('');
        },
      }
    );
  };

  const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;

  return (
    <div className="space-y-4 pb-24">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Header with integrated tabs - MapelDetail style */}
        <div className="rounded-2xl bg-primary p-4 md:p-6 shadow-lg space-y-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => window.history.length > 2 ? navigate(-1) : navigate('/app/dashboard')}
              className="rounded-xl h-10 w-10 shrink-0 border-2 border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/20 hover:border-white/30 transition-all duration-200"
            >
              <ArrowLeft className="h-4 w-4 text-white" />
            </Button>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg md:text-xl font-bold text-white truncate">
                {isParent ? "Monitoring Ramadhan" : "Mutaba'ah Ramadhan"}
              </h2>
              <p className="text-sm text-white/70 truncate flex items-center gap-1.5">
                <Moon className="h-3.5 w-3.5" />
                {isParent ? "Pantau amalan harian anak" : "Catat amalan harianmu selama Ramadhan"}
              </p>
            </div>
          </div>

          <TabsList className="grid w-full grid-cols-2 gap-1.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 p-1.5 h-auto">
            <TabsTrigger value="ringkasan" className="rounded-lg py-2.5 px-3 text-white/70 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=inactive]:hover:bg-white/10 transition-all duration-200 font-medium text-sm">
              Ringkasan
            </TabsTrigger>
            <TabsTrigger value="aktivitas" className="rounded-lg py-2.5 px-3 text-white/70 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=inactive]:hover:bg-white/10 transition-all duration-200 font-medium text-sm">
              Aktifitas Hari Ini
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="ringkasan">
          {targetUserId && configLoaded ? (
            <RamadhanCalendarGrid
              ramadhanStart={ramadhanStart}
              activities={activities}
              santriId={targetUserId}
              hideReminder={isParent}
              onDayClick={(date) => {
                setSelectedDate(date);
                setActiveTab('aktivitas');
              }}
            />
          ) : (
            <div className="text-center text-sm text-muted-foreground py-12">
              Memuat data...
            </div>
          )}
        </TabsContent>

        <TabsContent value="aktivitas">
          {/* Parent: child selector */}
          {isParent && children.length > 1 && (
            <Select value={selectedChild || ''} onValueChange={setSelectedChild}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih anak" />
              </SelectTrigger>
              <SelectContent>
                {children.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Form */}
          {loadingActivities || loadingChildren ? (
            <div className="text-center text-sm text-muted-foreground py-8">Memuat data...</div>
          ) : isParent && !selectedChild ? (
            <div className="text-center text-sm text-muted-foreground py-8">Tidak ada data anak ditemukan.</div>
          ) : !isInRamadhan ? (
            <div className="text-center text-sm text-muted-foreground py-12 space-y-2">
              <Moon className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <p className="font-medium">Belum memasuki bulan Ramadhan</p>
              <p className="text-xs">Pengisian aktivitas hanya tersedia pada 1-30 Ramadhan</p>
            </div>
          ) : (
            <RamadhanLogForm
              activities={activities}
              existingLogs={logs}
              isLoadingLogs={loadingLogs}
              isSaving={saveLog.isPending}
              onSave={handleSave}
              savedMood={mood?.mood || null}
              savedTilawahAwal={mood?.tilawah_surah_awal || null}
              savedTilawahAkhir={mood?.tilawah_surah_akhir || null}
              readOnly={isParent}
              dateLabel={format(selectedDate, 'EEEE, d MMMM yyyy', { locale: localeId })}
              hijriLabel={isInRamadhan ? `Ramadhan Hari ke-${hijriDay}` : rawHijriDay < 1 ? `${Math.abs(rawHijriDay - 1)} hari sebelum Ramadhan` : 'Ramadhan telah berakhir'}
              isInRamadhan={isInRamadhan}
              onPrevDay={handlePrevDay}
              onNextDay={handleNextDay}
            />
          )}
        </TabsContent>
      </Tabs>

      {!isParent && (
        <FeelingDrawer
          open={showFeeling}
          onClose={handleFeelingClose}
          completedCount={lastSavedCount}
          totalCount={activities.length}
        />
      )}
    </div>
  );
}