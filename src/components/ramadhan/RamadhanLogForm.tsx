import { useEffect, useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Save, Moon, Star, Heart, CheckCircle, Lock, BookOpen, Sun, Sunset, CloudMoon, Coffee, HandHeart, Smile, BookOpenCheck, Sparkles, Users, HandHelping, Utensils, Clock, Lamp, MessageCircleHeart, GraduationCap, ShieldAlert, CalendarIcon, ChevronLeft, ChevronRight, Droplets, type LucideIcon } from 'lucide-react';
import { RamadhanActivity, RamadhanDailyLog } from '@/hooks/useRamadhanLog';
import { feelings } from '@/components/ramadhan/FeelingDrawer';
import { SurahAyatPicker } from '@/components/ramadhan/SurahAyatPicker';
import { ExcuseDrawer } from '@/components/ramadhan/ExcuseDrawer';

interface RamadhanLogFormProps {
  activities: RamadhanActivity[];
  existingLogs: RamadhanDailyLog[];
  isLoadingLogs: boolean;
  isSaving: boolean;
  onSave: (checkedIds: string[], tilawahSurahAwal: string, tilawahSurahAkhir: string, excuses?: Record<string, string>) => void;
  savedMood: string | null;
  savedTilawahAwal: string | null;
  savedTilawahAkhir: string | null;
  readOnly?: boolean;
  dateLabel?: string;
  hijriLabel?: string;
  isInRamadhan?: boolean;
  onPrevDay?: () => void;
  onNextDay?: () => void;
}

// Icon mapping for activities by keyword
const activityIconMap: Record<string, LucideIcon> = {
  subuh: Sun,
  dhuhur: Clock,
  ashar: Sunset,
  maghrib: CloudMoon,
  isya: Moon,
  puasa: Utensils,
  tarawih: Lamp,
  witir: Sparkles,
  dhuha: Coffee,
  rawatib: BookOpenCheck,
  sedekah: HandHelping,
  tilawah: BookOpen,
  'dzikir pagi': Sun,
  'dzikir petang': Sunset,
  dzikir: MessageCircleHeart,
  doa: HandHeart,
  silaturahmi: Users,
  berbakti: Heart,
  jujur: Smile,
  sabar: HandHeart,
  belajar: GraduationCap,
};

function getActivityIcon(title: string): LucideIcon {
  const lower = title.toLowerCase();
  for (const [key, icon] of Object.entries(activityIconMap)) {
    if (lower.includes(key)) return icon;
  }
  return Star;
}

const categoryConfig: Record<string, { label: string; icon: React.ElementType; color: string; bgClass: string; cardBorder: string; cardChecked: string }> = {
  fardhu: { label: 'Fardhu', icon: Moon, color: 'text-primary', bgClass: 'bg-primary/10', cardBorder: 'border-primary/20', cardChecked: 'bg-primary/10 border-primary/30 shadow-md shadow-primary/10' },
  sunnah: { label: 'Sunnah', icon: Star, color: 'text-primary', bgClass: 'bg-primary/10', cardBorder: 'border-primary/20', cardChecked: 'bg-primary/10 border-primary/30 shadow-md shadow-primary/10' },
  akhlak: { label: 'Akhlak', icon: Heart, color: 'text-primary', bgClass: 'bg-primary/10', cardBorder: 'border-primary/20', cardChecked: 'bg-primary/10 border-primary/30 shadow-md shadow-primary/10' },
};

export function RamadhanLogForm({ activities, existingLogs, isLoadingLogs, isSaving, onSave, savedMood, savedTilawahAwal, savedTilawahAkhir, readOnly = false, dateLabel, hijriLabel, isInRamadhan, onPrevDay, onNextDay }: RamadhanLogFormProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [excuses, setExcuses] = useState<Record<string, string>>({});
  const [tilawahAwal, setTilawahAwal] = useState('');
  const [tilawahAkhir, setTilawahAkhir] = useState('');
  const [excuseDrawerOpen, setExcuseDrawerOpen] = useState(false);
  const [excuseTarget, setExcuseTarget] = useState<RamadhanActivity | null>(null);
  const [isHaid, setIsHaid] = useState(false);

  const isSaved = existingLogs.length > 0 || readOnly;
  const savedActivityIds = new Set(existingLogs.map((l) => l.activity_id));

  // Build saved excuses from existing logs
  const savedExcuses = new Map<string, string>();
  existingLogs.forEach((l) => {
    if (l.excuse_reason && !l.is_completed) {
      savedExcuses.set(l.activity_id, l.excuse_reason);
    }
  });

  useEffect(() => {
    if (!isLoadingLogs) {
      const loggedIds = new Set(existingLogs.filter((l) => l.is_completed).map((l) => l.activity_id));
      setChecked(loggedIds);
      setTilawahAwal(savedTilawahAwal || '');
      setTilawahAkhir(savedTilawahAkhir || '');
      // Restore excuses from saved data
      const restoredExcuses: Record<string, string> = {};
      existingLogs.forEach((l) => {
        if (l.excuse_reason && !l.is_completed) {
          restoredExcuses[l.activity_id] = l.excuse_reason;
        }
      });
      setExcuses(restoredExcuses);

      // Detect if Haid mode was saved (all fardhu+sunnah excused with "Haid")
      const fardhuSunnahIds = activities.filter((a) => a.category === 'fardhu' || a.category === 'sunnah').map((a) => a.id);
      const allHaid = fardhuSunnahIds.length > 0 && fardhuSunnahIds.every((id) => restoredExcuses[id] === 'Haid');
      setIsHaid(allHaid);
    }
  }, [existingLogs, isLoadingLogs, savedTilawahAwal, savedTilawahAkhir, activities]);

  const toggle = (id: string) => {
    if (isSaved) return;
    // If excused, remove excuse when checking
    setExcuses((prev) => {
      if (prev[id]) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return prev;
    });
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (items: RamadhanActivity[]) => {
    if (isSaved) return;
    setChecked((prev) => {
      const next = new Set(prev);
      const allChecked = items.every((i) => next.has(i.id));
      items.forEach((i) => {
        if (allChecked) next.delete(i.id);
        else next.add(i.id);
      });
      return next;
    });
  };

  const handleExcuseClick = (activity: RamadhanActivity, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExcuseTarget(activity);
    setExcuseDrawerOpen(true);
  };

  const handleExcuseSave = (reason: string) => {
    if (!excuseTarget) return;
    // Remove from checked if it was checked
    setChecked((prev) => {
      const next = new Set(prev);
      next.delete(excuseTarget.id);
      return next;
    });
    setExcuses((prev) => ({ ...prev, [excuseTarget.id]: reason }));
  };

  const removeExcuse = (activityId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExcuses((prev) => {
      const next = { ...prev };
      delete next[activityId];
      return next;
    });
  };

  const toggleHaid = () => {
    if (isSaved) return;
    const fardhuSunnahItems = activities.filter((a) => a.category === 'fardhu' || a.category === 'sunnah');
    if (!isHaid) {
      const newExcuses = { ...excuses };
      const newChecked = new Set(checked);
      fardhuSunnahItems.forEach((a) => {
        newExcuses[a.id] = 'Haid';
        newChecked.delete(a.id);
      });
      setExcuses(newExcuses);
      setChecked(newChecked);
      setIsHaid(true);
    } else {
      const newExcuses = { ...excuses };
      fardhuSunnahItems.forEach((a) => {
        if (newExcuses[a.id] === 'Haid') delete newExcuses[a.id];
      });
      setExcuses(newExcuses);
      setIsHaid(false);
    }
  };

  const grouped = activities.reduce<Record<string, RamadhanActivity[]>>((acc, a) => {
    (acc[a.category] = acc[a.category] || []).push(a);
    return acc;
  }, {});

  const totalActivities = activities.length;
  const completedCount = checked.size;
  const percentage = totalActivities > 0 ? Math.round((completedCount / totalActivities) * 100) : 0;

  if (isLoadingLogs) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-card border rounded-xl p-4">
      {/* Date navigation + Progress */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border space-y-3">
        {/* Date nav */}
        {dateLabel && (
          <div className="flex items-center justify-between">
            <button type="button" onClick={onPrevDay} className="h-8 w-8 rounded-lg flex items-center justify-center bg-primary/10 hover:bg-primary/20 transition-colors">
              <ChevronLeft className="h-4 w-4 text-primary" />
            </button>
            <div className="text-center">
              <div className="flex items-center gap-1.5 justify-center">
                <CalendarIcon className="h-3.5 w-3.5 text-primary/60" />
                <span className="text-sm font-semibold text-foreground">{dateLabel}</span>
              </div>
              {hijriLabel && (
                <span className={`text-xs font-medium ${isInRamadhan ? 'text-primary' : 'text-muted-foreground'}`}>
                  {hijriLabel}
                </span>
              )}
            </div>
            <button type="button" onClick={onNextDay} className="h-8 w-8 rounded-lg flex items-center justify-center bg-primary/10 hover:bg-primary/20 transition-colors">
              <ChevronRight className="h-4 w-4 text-primary" />
            </button>
          </div>
        )}

        {dateLabel && <div className="border-t border-primary/10" />}

        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-foreground">Amalan Hari Ini</span>
          <div className="flex items-center gap-2">
            {!isSaved && (
              <button
                type="button"
                onClick={toggleHaid}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all duration-200 ${
                  isHaid
                    ? 'bg-destructive/10 text-destructive ring-1 ring-destructive/30'
                    : 'bg-destructive/10 text-destructive hover:bg-destructive/15'
                }`}
              >
                <Droplets className="h-3.5 w-3.5" />
                Haid
              </button>
            )}
            {isSaved && isHaid && (
              <div className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/30">
                <Droplets className="h-3.5 w-3.5" />
                Haid
              </div>
            )}
            <span className="text-sm font-bold text-primary">{percentage}%</span>
          </div>
        </div>
        <Progress value={percentage} className="h-3" />
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-xs text-muted-foreground">
            {completedCount} dari {totalActivities} amalan tercatat
          </p>
          {savedMood && (() => {
            const feeling = feelings.find((f) => f.value === savedMood);
            if (!feeling) return null;
            return (
              <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full px-3 py-1.5 shadow-sm">
                <span className="text-[10px] font-medium text-primary/70">Ananda hari ini merasa</span>
                <span className="text-base">{feeling.emoji}</span>
                <span className="text-xs font-bold text-primary">{feeling.label}</span>
              </div>
            );
          })()}
        </div>
      </div>

      {isSaved && !readOnly && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
          <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            Data amalan hari ini sudah tersimpan dan tidak dapat diubah.
          </p>
        </div>
      )}

      {/* Category sections */}
      <div className="space-y-3">
        {(['fardhu', 'sunnah', 'akhlak'] as const).map((cat) => {
          const config = categoryConfig[cat];
          const items = grouped[cat] || [];
          const catChecked = items.filter((i) => checked.has(i.id)).length;
          const allDone = catChecked === items.length && items.length > 0;
          const Icon = config.icon;

          return (
            <Accordion key={cat} type="multiple" defaultValue={['fardhu', 'sunnah', 'akhlak']}>
              <AccordionItem value={cat} className="border-0">
                <AccordionTrigger className="px-0 py-2 hover:no-underline">
                  <div className="flex items-center gap-2.5 flex-1">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${config.bgClass}`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="font-semibold text-sm">{config.label}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {catChecked} dari {items.length} selesai
                      </span>
                    </div>
                    <div className="ml-auto mr-2">
                      {!isSaved && items.length > 1 ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleAll(items); }}
                          className="flex items-center gap-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors px-4 py-3 -mr-2 rounded-xl bg-primary/5 active:bg-primary/10 min-h-[44px] min-w-[44px]"
                        >
                          {items.every((i) => checked.has(i.id)) ? 'Batal semua' : 'Checklist semua'}
                        </button>
                      ) : allDone ? (
                        <Badge variant="success" className="text-[10px] px-2 py-0.5 gap-1">
                          <CheckCircle className="h-3 w-3" /> Lengkap
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-medium">
                          {catChecked}/{items.length}
                        </Badge>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-1 pt-2">
                  <div className="grid grid-cols-2 gap-3 pt-1.5 px-0.5 pb-0.5">
                    {items.map((activity) => {
                      const isChecked = checked.has(activity.id);
                      const excuseReason = excuses[activity.id] || savedExcuses.get(activity.id);
                      const isExcused = !!excuseReason;
                      const ActivityIcon = getActivityIcon(activity.title);

                      return (
                        <div
                          key={activity.id}
                          className={`relative rounded-xl border-2 transition-all duration-200 overflow-visible ${
                            isExcused
                              ? 'bg-amber-500/10 border-amber-500/30 shadow-md shadow-amber-500/10'
                              : isChecked
                                ? config.cardChecked
                                : 'bg-muted/20 border-border/50 hover:bg-muted/40'
                          } ${isSaved ? 'cursor-default' : ''}`}
                        >
                          {/* Excuse indicator */}
                          {isExcused && (
                            <div className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-amber-500 flex items-center justify-center shadow-sm z-10">
                              <ShieldAlert className="h-3 w-3 text-white" />
                            </div>
                          )}

                          {/* Main clickable area */}
                          <label
                            className={`flex items-center gap-2.5 px-3 py-2.5 ${isSaved ? 'cursor-default' : 'cursor-pointer active:scale-[0.96]'}`}
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggle(activity.id)}
                              disabled={isSaved || isExcused}
                              className="sr-only"
                            />
                            <div className={`h-8 w-8 shrink-0 rounded-lg flex items-center justify-center transition-colors ${
                              isExcused ? 'bg-amber-500/20' : isChecked ? config.bgClass : 'bg-muted/60'
                            }`}>
                              <ActivityIcon className={`h-4 w-4 transition-colors ${
                                isExcused ? 'text-amber-600' : isChecked ? config.color : 'text-muted-foreground'
                              }`} />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className={`text-xs leading-tight font-medium truncate ${
                                isExcused ? 'text-amber-700 dark:text-amber-400' : isChecked ? 'text-foreground' : 'text-muted-foreground'
                              }`}>
                                {activity.title}
                              </span>
                              {isExcused && (
                                <span className="text-[10px] text-amber-600/80 truncate mt-0.5">
                                  {excuseReason}
                                </span>
                              )}
                            </div>
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggle(activity.id)}
                              disabled={isSaved || isExcused}
                              className="shrink-0"
                            />
                          </label>

                          {/* Berhalangan button - only when not saved, not checked, not excused, not akhlak */}
                          {!isSaved && !isChecked && !isExcused && cat !== 'akhlak' && (
                            <div className="px-3 pb-2 -mt-0.5">
                              <button
                                type="button"
                                onClick={(e) => handleExcuseClick(activity, e)}
                                className="flex items-center gap-1 text-[10px] font-medium text-amber-600 hover:text-amber-700 transition-colors px-2 py-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500/30"
                              >
                                <ShieldAlert className="h-3 w-3" />
                                Berhalangan
                              </button>
                            </div>
                          )}

                          {/* Remove excuse button when excused but not saved */}
                          {!isSaved && isExcused && !savedExcuses.has(activity.id) && (
                            <div className="px-3 pb-2 -mt-0.5">
                              <button
                                type="button"
                                onClick={(e) => removeExcuse(activity.id, e)}
                                className="text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md bg-muted/40 hover:bg-muted/60"
                              >
                                Batalkan
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          );
        })}
      </div>

      {/* Tilawah Al-Quran fields */}
      <div className="p-4 rounded-xl border bg-muted/30 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-emerald-500/10">
            <BookOpen className="h-4 w-4 text-emerald-600" />
          </div>
          <span className="font-semibold text-sm">Tilawah Al-Quran</span>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Surah Awal</label>
            <SurahAyatPicker
              value={tilawahAwal}
              onChange={setTilawahAwal}
              disabled={isSaved}
              placeholder="Pilih surah awal"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Surah Akhir</label>
            <SurahAyatPicker
              value={tilawahAkhir}
              onChange={setTilawahAkhir}
              disabled={isSaved}
              placeholder="Pilih surah akhir"
            />
          </div>
        </div>
      </div>

      {/* Save button */}
      {!isSaved && (
        <Button
          onClick={() => onSave(Array.from(checked), tilawahAwal, tilawahAkhir, Object.keys(excuses).length > 0 ? excuses : undefined)}
          disabled={isSaving || (checked.size === 0 && Object.keys(excuses).length === 0 && !tilawahAwal && !tilawahAkhir)}
          className="w-full"
          size="lg"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Menyimpan...' : 'Simpan Laporan'}
        </Button>
      )}

      {/* Excuse Drawer */}
      <ExcuseDrawer
        open={excuseDrawerOpen}
        onOpenChange={setExcuseDrawerOpen}
        activityTitle={excuseTarget?.title || ''}
        initialValue={excuseTarget ? excuses[excuseTarget.id] : undefined}
        onSave={handleExcuseSave}
      />
    </div>
  );
}
