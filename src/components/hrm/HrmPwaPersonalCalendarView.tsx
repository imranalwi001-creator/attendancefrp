import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Coffee, 
  Umbrella, 
  Briefcase, 
  Sparkles, 
  Flag,
  FileText
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { hrmHolidayService, NationalHoliday } from '@/services/hrmHolidayService';
import { User, AttendanceRecord, Shift } from '@/types/hrm';

interface HrmPwaPersonalCalendarViewProps {
  user: User;
  allShifts?: Shift[];
  onOpenLeaveModal?: () => void;
  onOpenOvertimeModal?: () => void;
}

export const HrmPwaPersonalCalendarView: React.FC<HrmPwaPersonalCalendarViewProps> = ({
  user,
  allShifts = [],
  onOpenLeaveModal,
  onOpenOvertimeModal,
}) => {
  const currentMonthStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [schedulesMap, setSchedulesMap] = useState<Map<string, any>>(new Map());
  const [attendancesMap, setAttendancesMap] = useState<Map<string, AttendanceRecord>>(new Map());
  const [leavesMap, setLeavesMap] = useState<Map<string, any>>(new Map());
  const [overtimesMap, setOvertimesMap] = useState<Map<string, any[]>>(new Map());
  const [nationalHolidays, setNationalHolidays] = useState<Map<string, NationalHoliday>>(new Map());
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [yearNum, monthNum] = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return [y, m];
  }, [selectedMonth]);

  const monthLabel = useMemo(() => {
    const d = new Date(yearNum, monthNum - 1, 1);
    return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }, [yearNum, monthNum]);

  // Fetch all synchronized schedule, attendance, leave, overtime, and national holiday data
  const loadData = useCallback(async () => {
    if (!user?.id && !user?.nip) return;
    setIsLoading(true);

    const targetUserId = user.id || user.nip;

    try {
      // 1. Fetch Roster Matrix Schedules from Database
      const schedPromise = fetch(`/api/employee-schedules?month=${selectedMonth}&userId=${encodeURIComponent(targetUserId)}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success && Array.isArray(res.data)) {
            const sm = new Map<string, any>();
            res.data.forEach((item: any) => {
              if (item.scheduleDate) sm.set(item.scheduleDate, item);
            });
            setSchedulesMap(sm);
          }
        })
        .catch(() => {});

      // 2. Fetch Actual Attendance Records
      const attPromise = fetch(`/api/attendances?month=${selectedMonth}&userId=${encodeURIComponent(targetUserId)}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success && Array.isArray(res.data)) {
            const am = new Map<string, AttendanceRecord>();
            res.data.forEach((att: any) => {
              const d = att.attendanceDate || (att as any).attendance_date || (att as any).date;
              if (d) am.set(String(d).substring(0, 10), att);
            });
            setAttendancesMap(am);
          }
        })
        .catch(() => {});

      // 3. Fetch Approved Leaves
      const leavePromise = fetch(`/api/leaves?userId=${encodeURIComponent(targetUserId)}&status=approved`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success && Array.isArray(res.data)) {
            const lm = new Map<string, any>();
            res.data.forEach((l: any) => {
              const start = l.start_date || l.startDate;
              const end = l.end_date || l.endDate || start;
              if (start && end) {
                let curr = new Date(start);
                const stop = new Date(end);
                while (curr <= stop) {
                  const cStr = curr.toISOString().split('T')[0];
                  lm.set(cStr, l);
                  curr.setDate(curr.getDate() + 1);
                }
              }
            });
            setLeavesMap(lm);
          }
        })
        .catch(() => {});

      // 4. Fetch Approved/Pending Overtime Records (SPKL)
      const otPromise = fetch(`/api/overtime?userId=${encodeURIComponent(targetUserId)}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success && Array.isArray(res.data)) {
            const om = new Map<string, any[]>();
            res.data.forEach((ot: any) => {
              const d = String(ot.date).substring(0, 10);
              if (!om.has(d)) om.set(d, []);
              om.get(d)!.push(ot);
            });
            setOvertimesMap(om);
          }
        })
        .catch(() => {});

      // 5. Fetch Official National Holidays (SKB 3 Menteri)
      const holidayPromise = hrmHolidayService.fetchHolidays(yearNum).then((hols) => {
        const hm = new Map<string, NationalHoliday>();
        hols.forEach((h) => hm.set(h.date, h));
        setNationalHolidays(hm);
      });

      await Promise.allSettled([schedPromise, attPromise, leavePromise, otPromise, holidayPromise]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, user?.nip, selectedMonth, yearNum]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Navigate Months
  const handlePrevMonth = () => {
    const prevDate = new Date(yearNum, monthNum - 2, 1);
    const pStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(pStr);
    setSelectedDateStr(`${pStr}-01`);
  };

  const handleNextMonth = () => {
    const nextDate = new Date(yearNum, monthNum, 1);
    const nStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(nStr);
    setSelectedDateStr(`${nStr}-01`);
  };

  const handleCurrentMonth = () => {
    setSelectedMonth(currentMonthStr);
    setSelectedDateStr(new Date().toISOString().split('T')[0]);
  };

  // Build Calendar Days
  const calendarDays = useMemo(() => {
    const firstDay = new Date(yearNum, monthNum - 1, 1);
    const lastDay = new Date(yearNum, monthNum, 0);
    const daysInMonth = lastDay.getDate();

    // Senin = 0, Selasa = 1, ..., Minggu = 6
    let startingDay = firstDay.getDay() - 1;
    if (startingDay === -1) startingDay = 6;

    const days: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSunday: boolean;
      isSaturday: boolean;
    }> = [];

    const todayStr = new Date().toISOString().split('T')[0];

    // Previous month padding
    const prevMonthLastDay = new Date(yearNum, monthNum - 1, 0).getDate();
    for (let i = startingDay - 1; i >= 0; i--) {
      const pDayNum = prevMonthLastDay - i;
      const prevDate = new Date(yearNum, monthNum - 2, pDayNum);
      const dStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(pDayNum).padStart(2, '0')}`;
      days.push({
        dateStr: dStr,
        dayNum: pDayNum,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        isSunday: prevDate.getDay() === 0,
        isSaturday: prevDate.getDay() === 6,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dObj = new Date(yearNum, monthNum - 1, d);
      days.push({
        dateStr: dStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
        isSunday: dObj.getDay() === 0,
        isSaturday: dObj.getDay() === 6,
      });
    }

    // Next month padding to fill complete grid of 35 or 42 cells
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const nextDate = new Date(yearNum, monthNum, i);
        const dStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        days.push({
          dateStr: dStr,
          dayNum: i,
          isCurrentMonth: false,
          isToday: dStr === todayStr,
          isSunday: nextDate.getDay() === 0,
          isSaturday: nextDate.getDay() === 6,
        });
      }
    }

    return days;
  }, [yearNum, monthNum]);

  // Monthly Metrics Calculation for the employee
  const monthlyMetrics = useMemo(() => {
    let totalDutyDays = 0;
    let totalOffDays = 0;
    let attendedDays = 0;
    let approvedOtHours = 0;
    let approvedOtCount = 0;

    calendarDays.forEach((d) => {
      if (!d.isCurrentMonth) return;
      const sched = schedulesMap.get(d.dateStr);
      const att = attendancesMap.get(d.dateStr);
      const otList = overtimesMap.get(d.dateStr) || [];

      if (sched) {
        if (sched.isOff || sched.shiftCode === 'OFF') {
          totalOffDays++;
        } else {
          totalDutyDays++;
        }
      } else {
        if (d.isSunday || d.isSaturday) {
          totalOffDays++;
        } else {
          totalDutyDays++;
        }
      }

      if (att && ['hadir', 'terlambat'].includes(att.status)) {
        attendedDays++;
      }

      otList.forEach((o) => {
        if (o.status === 'approved') {
          approvedOtHours += Number(o.duration_hours || o.durationHours || 0);
          approvedOtCount++;
        }
      });
    });

    return {
      totalDutyDays,
      totalOffDays,
      attendedDays,
      approvedOtHours: parseFloat(approvedOtHours.toFixed(1)),
      approvedOtCount,
    };
  }, [calendarDays, schedulesMap, attendancesMap, overtimesMap]);

  // Selected Date Details
  const selectedDateData = useMemo(() => {
    const sched = schedulesMap.get(selectedDateStr);
    const att = attendancesMap.get(selectedDateStr);
    const leave = leavesMap.get(selectedDateStr);
    const otList = overtimesMap.get(selectedDateStr) || [];
    const holiday = nationalHolidays.get(selectedDateStr) || hrmHolidayService.isNationalHoliday(selectedDateStr).holiday;

    const dObj = new Date(selectedDateStr + 'T00:00:00');
    const dayName = dObj.toLocaleDateString('id-ID', { weekday: 'long' });
    const fullDateLabel = dObj.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    return {
      dateStr: selectedDateStr,
      dayName,
      fullDateLabel,
      sched,
      att,
      leave,
      otList,
      holiday,
      isWeekend: dObj.getDay() === 0 || dObj.getDay() === 6,
    };
  }, [selectedDateStr, schedulesMap, attendancesMap, leavesMap, overtimesMap, nationalHolidays]);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* ─── CARD HEADER & MONTH NAVIGATION ─── */}
      <div className="p-4 rounded-3xl bg-card border border-border/70 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-foreground flex items-center gap-1.5">
                <span>Jadwal &amp; Kalender Roster</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </h2>
              <p className="text-[11px] text-muted-foreground font-medium">
                {user.fullName} ({user.nip || 'FRP'})
              </p>
            </div>
          </div>

          {/* Quick Return to Current Month */}
          {selectedMonth !== currentMonthStr && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCurrentMonth}
              className="text-[11px] h-7 px-2.5 rounded-xl border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
            >
              Bulan Berjalan
            </Button>
          )}
        </div>

        {/* Month Navigation Control */}
        <div className="flex items-center justify-between p-2 rounded-2xl bg-muted/40 border border-border/50">
          <Button
            size="icon"
            variant="ghost"
            onClick={handlePrevMonth}
            className="w-8 h-8 rounded-xl hover:bg-muted text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <span className="text-xs font-black uppercase tracking-wider text-foreground">
            {monthLabel}
          </span>

          <Button
            size="icon"
            variant="ghost"
            onClick={handleNextMonth}
            className="w-8 h-8 rounded-xl hover:bg-muted text-foreground"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* ─── MONTHLY METRICS SUMMARY ─── */}
        <div className="grid grid-cols-4 gap-2 pt-1 text-center">
          <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold block">
              Shift Dinas
            </span>
            <span className="text-sm font-black font-mono text-emerald-700 dark:text-emerald-400">
              {monthlyMetrics.totalDutyDays}
            </span>
            <span className="text-[9px] text-muted-foreground block">Hari</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-slate-500/10 border border-slate-500/20">
            <span className="text-[10px] text-slate-700 dark:text-slate-300 font-bold block">
              Libur (OFF)
            </span>
            <span className="text-sm font-black font-mono text-slate-700 dark:text-slate-400">
              {monthlyMetrics.totalOffDays}
            </span>
            <span className="text-[9px] text-muted-foreground block">Hari</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-sky-500/10 border border-sky-500/20">
            <span className="text-[10px] text-sky-700 dark:text-sky-300 font-bold block">
              Realisasi Hadir
            </span>
            <span className="text-sm font-black font-mono text-sky-700 dark:text-sky-400">
              {monthlyMetrics.attendedDays}
            </span>
            <span className="text-[9px] text-muted-foreground block">Hari</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-purple-500/10 border border-purple-500/20">
            <span className="text-[10px] text-purple-700 dark:text-purple-300 font-bold block">
              Lembur Sah
            </span>
            <span className="text-sm font-black font-mono text-purple-700 dark:text-purple-400">
              {monthlyMetrics.approvedOtHours} <span className="text-[10px] font-normal">Jam</span>
            </span>
            <span className="text-[9px] text-purple-700 dark:text-purple-300 font-semibold block">
              {monthlyMetrics.approvedOtCount}x Lembur
            </span>
          </div>
        </div>
      </div>

      {/* ─── 7-DAY CALENDAR GRID ─── */}
      <div className="p-3.5 rounded-3xl bg-card border border-border/70 shadow-xs space-y-2">
        {/* Day Name Header */}
        <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10.5px] pb-1 border-b border-border/50 text-muted-foreground">
          <span>SEN</span>
          <span>SEL</span>
          <span>RAB</span>
          <span>KAM</span>
          <span>JUM</span>
          <span>SAB</span>
          <span className="text-rose-500 font-black">MIN</span>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((d) => {
            const isSelected = d.dateStr === selectedDateStr;
            const sched = schedulesMap.get(d.dateStr);
            const att = attendancesMap.get(d.dateStr);
            const leave = leavesMap.get(d.dateStr);
            const otList = overtimesMap.get(d.dateStr) || [];
            const holiday = nationalHolidays.get(d.dateStr) || hrmHolidayService.isNationalHoliday(d.dateStr).holiday;

            // Shift resolution
            const sCode = (sched?.shiftCode || '').toUpperCase();
            const isOff = sched?.isOff || sCode === 'OFF';
            const isP = sCode === 'P';
            const isS = sCode === 'S';
            const isM = sCode === 'M';
            const isDay = sCode === 'DAY';

            let cellBg = 'bg-slate-50/60 dark:bg-slate-900/40 hover:bg-muted/50';
            if (isSelected) {
              cellBg = 'bg-emerald-500/15 ring-2 ring-emerald-500 shadow-xs';
            } else if (d.isToday) {
              cellBg = 'bg-amber-500/10 ring-1.5 ring-amber-500/60';
            } else if (isOff) {
              cellBg = 'bg-slate-100/50 dark:bg-slate-800/30';
            }

            return (
              <button
                key={d.dateStr}
                type="button"
                onClick={() => setSelectedDateStr(d.dateStr)}
                className={`min-h-[64px] p-1 rounded-2xl flex flex-col justify-between items-center transition-all text-left relative ${cellBg} ${
                  !d.isCurrentMonth ? 'opacity-30' : ''
                }`}
              >
                {/* Date Number + Today dot */}
                <div className="w-full flex items-center justify-between px-0.5">
                  <span
                    className={`text-[11px] font-black font-mono leading-tight ${
                      isSelected
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : d.isToday
                        ? 'text-amber-600 dark:text-amber-400'
                        : d.isSunday || holiday
                        ? 'text-rose-500'
                        : 'text-foreground'
                    }`}
                  >
                    {d.dayNum}
                  </span>

                  {/* Attendance checkmark indicator */}
                  {att && ['hadir', 'terlambat'].includes(att.status) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Tercatat Hadir" />
                  )}
                  {att && att.status === 'terlambat' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Terlambat" />
                  )}
                </div>

                {/* Shift / Status Badge */}
                <div className="w-full flex flex-col items-center gap-0.5 my-auto">
                  {holiday ? (
                    <span className="text-[7.5px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/15 px-1 py-0.2 rounded leading-tight text-center truncate max-w-full">
                      Libur
                    </span>
                  ) : leave ? (
                    <span className="text-[8px] font-bold text-purple-700 dark:text-purple-300 bg-purple-500/15 px-1 py-0.2 rounded leading-tight">
                      Cuti
                    </span>
                  ) : sched ? (
                    isOff ? (
                      <span className="text-[8px] font-bold text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-1 py-0.2 rounded leading-tight">
                        OFF
                      </span>
                    ) : (
                      <span
                        className={`text-[8.5px] font-black font-mono px-1 py-0.2 rounded leading-tight ${
                          isP
                            ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300'
                            : isS
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                            : isM
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300'
                            : isDay
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                            : 'bg-muted text-foreground'
                        }`}
                      >
                        {sCode === 'DAY' ? 'DAY' : `Shf ${sCode}`}
                      </span>
                    )
                  ) : d.isSunday ? (
                    <span className="text-[8px] font-medium text-rose-500/70 italic">Libur</span>
                  ) : (
                    <span className="text-[7.5px] text-muted-foreground/50 font-mono">Dinas</span>
                  )}

                  {/* Overtime indicator pill */}
                  {otList.length > 0 && (
                    <span className="text-[7px] font-bold text-orange-600 dark:text-orange-400 leading-none">
                      +SPL
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="pt-2 border-t border-border/50 flex items-center justify-between flex-wrap gap-2 text-[10px] text-muted-foreground font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-sky-200 dark:bg-sky-900 border border-sky-400" />
            <span>Shift P (07:30)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-amber-200 dark:bg-amber-900 border border-amber-400" />
            <span>Shift S (15:30)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-purple-200 dark:bg-purple-900 border border-purple-400" />
            <span>Shift M (22:30)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-slate-200 dark:bg-slate-700 border border-slate-400" />
            <span>OFF (Libur)</span>
          </div>
        </div>
      </div>

      {/* ─── INTERACTIVE DAY DETAILS BOTTOM CARD ─── */}
      <div className="p-4 rounded-3xl bg-card border border-border shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-border/60">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Rincian Hari &amp; Jadwal
            </span>
            <h3 className="text-sm font-black text-foreground capitalize">
              {selectedDateData.fullDateLabel}
            </h3>
          </div>
          {selectedDateData.dateStr === new Date().toISOString().split('T')[0] && (
            <Badge className="bg-emerald-600 text-white text-[10px]">Hari Ini</Badge>
          )}
        </div>

        {/* 1. Jadwal Roster Shift */}
        <div className="p-3 rounded-2xl bg-muted/40 border border-border/60 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
              <span>Jadwal Roster Resmi:</span>
            </span>
            {selectedDateData.otList.length > 0 && selectedDateData.sched && !selectedDateData.sched.isOff ? (
              <Badge className="bg-purple-600 text-white text-[10px] font-bold shadow-xs">
                ⚡ Shift {selectedDateData.sched.shiftCode} + Lembur Sambung
              </Badge>
            ) : selectedDateData.sched ? (
              selectedDateData.sched.isOff || selectedDateData.sched.shiftCode === 'OFF' ? (
                <Badge variant="outline" className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800">
                  <Coffee className="w-3 h-3 mr-1" /> Libur Rotasi (OFF)
                </Badge>
              ) : (
                <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                  Shift {selectedDateData.sched.shiftCode} ({selectedDateData.sched.shiftName || 'Dinas Lapangan'})
                </Badge>
              )
            ) : selectedDateData.isWeekend ? (
              <Badge variant="outline" className="text-[10px] text-rose-500 bg-rose-50 dark:bg-rose-950/40">
                Libur Akhir Pekan
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                Jadwal Reguler (07:30 - 16:30)
              </Badge>
            )}
          </div>

          <div className="text-[11px] text-muted-foreground space-y-1">
            {selectedDateData.sched && !selectedDateData.sched.isOff ? (
              <div>
                Jam Dinas Reguler:{' '}
                <strong className="text-foreground font-mono">
                  {selectedDateData.sched.startTime?.substring(0, 5) || '07:30'} -{' '}
                  {selectedDateData.sched.endTime?.substring(0, 5) || '15:30'} WITA
                </strong>
                {' '}({selectedDateData.sched.shiftName})
                {selectedDateData.sched.isNightShift && ' • (Melintasi Hari)'}
              </div>
            ) : selectedDateData.sched?.isOff ? (
              <div>Bebas tugas rotasi shift operasional sesuai Matriks Penjadwalan Roster.</div>
            ) : (
              <div>Mengikuti jadwal penugasan kerja reguler PT FRP.</div>
            )}

            {selectedDateData.otList.map((ot: any, idx: number) => (
              <div key={idx} className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-900 dark:text-purple-200">
                ⚡ Penugasan Lembur:{' '}
                <strong className="font-mono font-bold">
                  {(ot.start_time || ot.startTime || '').substring(0, 5)} - {(ot.end_time || ot.endTime || '').substring(0, 5)} WITA
                </strong>
                {' '}({ot.duration_hours || ot.durationHours} Jam) • {ot.task_description || ot.taskDescription}
              </div>
            ))}
          </div>
        </div>

        {/* 2. Hari Libur Nasional SKB 3 Menteri (Jika ada) */}
        {selectedDateData.holiday && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5 text-rose-600" />
                <span>Hari Libur Nasional Resmi</span>
              </span>
              <Badge className="bg-rose-600 text-white text-[9px]">SKB 3 Menteri</Badge>
            </div>
            <p className="text-xs font-black text-rose-900 dark:text-rose-200">
              {selectedDateData.holiday.name}
            </p>
          </div>
        )}

        {/* 3. Realisasi Presensi */}
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-border space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>Realisasi Kehadiran:</span>
            </span>
            {selectedDateData.att ? (
              <Badge
                variant="outline"
                className={`text-[10px] font-bold ${
                  selectedDateData.att.status === 'hadir'
                    ? 'border-emerald-500 text-emerald-700 bg-emerald-50'
                    : selectedDateData.att.status === 'terlambat'
                    ? 'border-amber-500 text-amber-700 bg-amber-50'
                    : 'border-slate-400 text-slate-700'
                }`}
              >
                {selectedDateData.att.status.toUpperCase()}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                Belum Ada Absen
              </Badge>
            )}
          </div>

          {selectedDateData.att ? (
            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-mono">
              <p>
                Masuk:{' '}
                <strong className="text-foreground">
                  {selectedDateData.att.clockIn?.substring(0, 5) || '-'} WITA
                </strong>
              </p>
              <p>
                Pulang:{' '}
                <strong className="text-foreground">
                  {selectedDateData.att.clockOut?.substring(0, 5) || '-'} WITA
                </strong>
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Tidak ada data scan presensi tercatat untuk tanggal ini.
            </p>
          )}
        </div>

        {/* 4. Surat Perintah Kerja Lembur (SPKL) - TANPA NOMINAL RUPIAH */}
        {selectedDateData.otList.length > 0 && (
          <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/25 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>Surat Perintah Lembur (SPKL Digital)</span>
              </span>
              <Badge className="bg-purple-600 text-white text-[10px]">
                {selectedDateData.otList.length} Penugasan
              </Badge>
            </div>

            {selectedDateData.otList.map((ot: any, idx: number) => (
              <div
                key={ot.id || idx}
                className="p-2.5 rounded-xl bg-card border border-border/70 text-[11px] space-y-1.5 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-purple-600" />
                    <span>Jam: {(ot.start_time || ot.startTime || '').substring(0, 5)} - {(ot.end_time || ot.endTime || '').substring(0, 5)} WITA</span>
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono border-purple-400 text-purple-700 dark:text-purple-300 font-bold">
                    {ot.duration_hours || ot.durationHours} Jam
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">
                    Kategori: {ot.is_weekend_holiday ? 'Hari Libur / Weekend (2x)' : 'Hari Kerja Normal'}
                  </span>
                  <span
                    className={`font-bold ${
                      ot.status === 'approved'
                        ? 'text-emerald-600'
                        : ot.status === 'rejected'
                        ? 'text-rose-600'
                        : 'text-amber-600'
                    }`}
                  >
                    {ot.status === 'approved' ? '✓ Disetujui' : ot.status === 'rejected' ? '✗ Ditolak' : 'Menunggu Approval'}
                  </span>
                </div>
                <p className="text-muted-foreground italic">
                  "{ot.task_description || ot.taskDescription || 'Tugas operasional lapangan'}"
                </p>
              </div>
            ))}
          </div>
        )}

        {/* 5. Cuti / Izin */}
        {selectedDateData.leave && (
          <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/25 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                <Umbrella className="w-3.5 h-3.5 text-blue-600" />
                <span>Pengajuan Cuti / Izin Sah</span>
              </span>
              <Badge className="bg-blue-600 text-white text-[10px]">
                {selectedDateData.leave.leave_type || selectedDateData.leave.type || 'Cuti'}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Alasan: "{selectedDateData.leave.reason || 'Izin dinas resmi'}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

