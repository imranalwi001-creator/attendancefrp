import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import { api } from '@/services/apiClient';
import { getTodayDateStr } from '@/services/hrmService';
import { HrmPimpinanDashboard } from './HrmPimpinanDashboard';
import { HrmGhostSwitcherModal } from '@/components/hrm/HrmGhostSwitcherModal';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Users,
  CheckCircle2,
  Coffee,
  CalendarDays,
  FileText,
  AlertTriangle,
  Zap,
  RefreshCw,
  Smartphone,
  ShieldCheck,
  TrendingUp,
  Clock,
  Layers,
  Search,
  ExternalLink,
  Sun,
  Sunset,
  Moon,
  Briefcase,
  Building2,
  Home,
  Star,
  ArrowUpRight,
  Bell,
  UserX,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  Bar,
  BarChart,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';

type GroupFilter = 'ALL' | 'SHIPMENT' | 'RUMAH TANGGA' | 'KARYAWAN TETAP';
type ShiftKey = 'SHIFT_I' | 'SHIFT_II' | 'SHIFT_III' | 'DAY_SHIFT' | 'OFF_ROSTER';
type ActiveShiftKey = 'SHIFT_I' | 'SHIFT_II' | 'SHIFT_III' | 'DAY_SHIFT';
type DrillCategory =
  | 'ALL'
  | 'hadir'
  | 'off'
  | 'cuti'
  | 'izin'
  | 'cuti_izin'
  | 'mangkir'
  | 'belum_absen'
  | 'belum_terdaftar'
  | 'lembur'
  | 'lembur_kerja'
  | 'lembur_off';

interface ShiftBucketStats {
  key: ShiftKey;
  label: string;
  range: string;
  total: number;
  hadir: number;
  tepatWaktu: number;
  terlambat: number;
  off: number;
  cuti: number;
  izin: number;
  sakit: number;
  mangkir: number;
  belumAbsen: number;
  belumTerdaftar: number;
  lemburOrang: number;
  lemburJam: number;
}

interface GroupAccumulator {
  group: 'SHIPMENT' | 'RUMAH TANGGA' | 'KARYAWAN TETAP';
  total: number;
  today: {
    hadir: number;
    tepatWaktu: number;
    terlambat: number;
    off: number;
    cuti: number;
    izin: number;
    sakit: number;
    mangkir: number;
    belumAbsen: number;
    belumTerdaftar: number;
    lemburOrang: number;
    lemburJam: number;
  };
  month: {
    hadir: number;
    tepatWaktu: number;
    terlambat: number;
    off: number;
    cuti: number;
    izin: number;
    sakit: number;
    mangkir: number;
    belumTerdaftar: number;
    lemburSpkl: number;
    lemburJam: number;
  };
}

interface DailyPoint {
  date: string;
  day: number;
  label: string;
  hadir: number;
  tepatWaktu: number;
  terlambat: number;
  off: number;
  cuti: number;
  izin: number;
  sakit: number;
  mangkir: number;
  belumAbsen: number;
  belumTerdaftar: number;
  wajibAktif?: number;
  attendanceRate?: number | null;
  lemburOrang: number;
  lemburJam: number;
  lemburKerjaJam?: number;
  lemburOffJam?: number;
  isToday: boolean;
  isFuture: boolean;
}

interface EmployeeDetailRow {
  id: string;
  fullName: string;
  nip: string;
  group: string;
  divisionName: string;
  avatarUrl: string | null;
  shiftBucket: ShiftKey;
  shiftLabel: string;
  status: string;
  isUnenrolled?: boolean;
  isLate: boolean;
  clockIn: string | null;
  clockOut: string | null;
  lateMinutes: number;
  hasOvertime: boolean;
  overtimeType?: 'hari_kerja' | 'hari_off' | null;
  overtimeHours: number;
  overtimeShiftBucket: ShiftKey | null;
  overtimeRange: string | null;
  overtimeDesc: string | null;
  leaveReason: string | null;
}

interface LiveOverviewPayload {
  meta: {
    date: string;
    month: string;
    todayWita: string;
    serverTimeWita: string;
    activeShiftNow: ShiftKey;
    groupFilter: GroupFilter;
    filteredTotal: number;
  };
  headcount: {
    total: number;
    shipment: number;
    rumahTangga: number;
    karyawanTetap: number;
  };
  pendingApprovals: {
    leaves: number;
    overtimes: number;
    total: number;
  };
  groups: GroupAccumulator[];
  today: {
    hadir: number;
    tepatWaktu: number;
    terlambat: number;
    off: number;
    cuti: number;
    izin: number;
    sakit: number;
    mangkir: number;
    belumAbsen: number;
    belumTerdaftar: number;
    lemburOrang: number;
    lemburJam: number;
    lemburKerjaOrang?: number;
    lemburKerjaJam?: number;
    lemburOffOrang?: number;
    lemburOffJam?: number;
    wajibTugas: number;
    attendanceRate: number;
    shifts: Record<ShiftKey, ShiftBucketStats>;
  };
  month: {
    daysElapsed: number;
    totalDaysInMonth: number;
    hadir: number;
    tepatWaktu: number;
    terlambat: number;
    off: number;
    cuti: number;
    izin: number;
    sakit: number;
    mangkir: number;
    belumTerdaftar: number;
    lemburSpkl: number;
    lemburOrangUnik: number;
    lemburJam: number;
    lemburKerjaSpkl?: number;
    lemburKerjaJam?: number;
    lemburOffSpkl?: number;
    lemburOffJam?: number;
    shifts: Record<ShiftKey, ShiftBucketStats>;
  };
  dailySeries: DailyPoint[];
  todayDetails: EmployeeDetailRow[];
}

const STATUS_COLORS = {
  hadir: '#059669',
  off: '#64748b',
  cuti: '#0284c7',
  izin: '#6366f1',
  mangkir: '#e11d48',
  belumTerdaftar: '#9333ea',
  belumAbsen: '#cbd5e1',
  lembur: '#d97706',
};

const SHIFT_META: Record<ShiftKey, { icon: React.ComponentType<any>; accent: string; badgeBg: string }> = {
  SHIFT_I: { icon: Sun, accent: 'text-sky-600 dark:text-sky-400', badgeBg: 'bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-300' },
  SHIFT_II: { icon: Sunset, accent: 'text-amber-600 dark:text-amber-400', badgeBg: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300' },
  SHIFT_III: { icon: Moon, accent: 'text-indigo-600 dark:text-indigo-400', badgeBg: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300' },
  DAY_SHIFT: { icon: Briefcase, accent: 'text-emerald-600 dark:text-emerald-400', badgeBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300' },
  OFF_ROSTER: { icon: Coffee, accent: 'text-slate-600 dark:text-slate-300', badgeBg: 'bg-slate-500/10 border-slate-400/30 text-slate-700 dark:text-slate-300' },
};

const formatMonthId = (ym: string) => {
  if (!ym || !ym.includes('-')) return ym;
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
};

const formatDateId = (ymd: string) => {
  if (!ymd || !ymd.includes('-')) return ymd;
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const HrmSuperadminDashboard: React.FC = () => {
  const { user } = useHrmAuth();
  const [viewMode, setViewMode] = useState<'admin' | 'executive'>('admin');
  const [ghostModalOpen, setGhostModalOpen] = useState(false);

  const initialToday = getTodayDateStr();
  const [selectedMonth, setSelectedMonth] = useState<string>(initialToday.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState<string>(initialToday);
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('ALL');

  const [shiftScope, setShiftScope] = useState<'today' | 'month'>('today');
  const [groupTableScope, setGroupTableScope] = useState<'today' | 'month'>('today');
  const [overtimeScope, setOvertimeScope] = useState<'today' | 'month'>('today');
  const [trendMode, setTrendMode] = useState<'rate' | 'composition'>('rate');

  const [overview, setOverview] = useState<LiveOverviewPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');
  const [liveWitaClock, setLiveWitaClock] = useState<string>('');

  // Click-to-Inspect Drill-Down state
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillTitle, setDrillTitle] = useState('');
  const [drillCategory, setDrillCategory] = useState<DrillCategory>('ALL');
  const [drillShift, setDrillShift] = useState<ShiftKey | 'ALL'>('ALL');
  const [drillSearch, setDrillSearch] = useState('');

  // Live WITA digital clock
  useEffect(() => {
    const tick = () => {
      setLiveWitaClock(
        new Date().toLocaleTimeString('id-ID', {
          timeZone: 'Asia/Makassar',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchOverview = useCallback(
    async (silent = false) => {
      if (silent) setIsRefreshing(true);
      else setIsLoading(true);
      try {
        const params = new URLSearchParams({
          month: selectedMonth,
          date: selectedDate,
          group: groupFilter,
        });
        const res = await api.get<{ success: boolean; data: LiveOverviewPayload }>(
          `/superadmin/live-overview?${params.toString()}`
        );
        if (res?.success && res.data) {
          setOverview(res.data);
          setLastSyncedAt(res.data.meta.serverTimeWita || '');
        }
      } catch (err) {
        console.error('[Superadmin Dashboard] Gagal memuat live-overview:', err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedMonth, selectedDate, groupFilter]
  );

  // Initial & filter-driven load + auto-refresh every 30s
  useEffect(() => {
    fetchOverview(Boolean(overview));
    const interval = setInterval(() => {
      fetchOverview(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchOverview]);

  // Listen to global attendance/data mutation events
  useEffect(() => {
    const onMutated = () => fetchOverview(true);
    window.addEventListener('hrm_attendance_updated', onMutated);
    window.addEventListener('hrm_data_updated', onMutated);
    return () => {
      window.removeEventListener('hrm_attendance_updated', onMutated);
      window.removeEventListener('hrm_data_updated', onMutated);
    };
  }, [fetchOverview]);

  const handleMonthChange = (nextMonth: string) => {
    setSelectedMonth(nextMonth);
    const todayStr = getTodayDateStr();
    if (nextMonth === todayStr.slice(0, 7)) {
      setSelectedDate(todayStr);
    } else {
      const [y, m] = nextMonth.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      setSelectedDate(`${nextMonth}-${String(lastDay).padStart(2, '0')}`);
    }
  };

  const openDrillDown = (title: string, category: DrillCategory, shift: ShiftKey | 'ALL' = 'ALL') => {
    setDrillTitle(title);
    setDrillCategory(category);
    setDrillShift(shift);
    setDrillSearch('');
    setDrillOpen(true);
  };

  const drillFilteredRows = useMemo(() => {
    if (!overview?.todayDetails) return [];
    const q = drillSearch.trim().toLowerCase();
    return overview.todayDetails.filter((row) => {
      if (drillShift !== 'ALL') {
        if (drillCategory === 'lembur') {
          if ((row.overtimeShiftBucket || row.shiftBucket) !== drillShift) return false;
        } else if (row.shiftBucket !== drillShift) {
          return false;
        }
      }
      if (drillCategory === 'hadir' && row.status !== 'hadir') return false;
      if (drillCategory === 'off' && row.status !== 'off') return false;
      if (drillCategory === 'cuti' && row.status !== 'cuti') return false;
      if (drillCategory === 'izin' && row.status !== 'izin' && row.status !== 'sakit') return false;
      if (drillCategory === 'cuti_izin' && row.status !== 'cuti' && row.status !== 'izin' && row.status !== 'sakit') return false;
      if (drillCategory === 'mangkir' && row.status !== 'mangkir') return false;
      if (drillCategory === 'belum_absen' && row.status !== 'belum_absen') return false;
      if (drillCategory === 'belum_terdaftar' && row.status !== 'belum_terdaftar') return false;
      if (drillCategory === 'lembur' && !row.hasOvertime) return false;
      if (drillCategory === 'lembur_kerja' && (!row.hasOvertime || row.overtimeType !== 'hari_kerja')) return false;
      if (drillCategory === 'lembur_off' && (!row.hasOvertime || row.overtimeType !== 'hari_off')) return false;

      if (q) {
        return (
          row.fullName.toLowerCase().includes(q) ||
          row.nip.toLowerCase().includes(q) ||
          row.divisionName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [overview?.todayDetails, drillCategory, drillShift, drillSearch]);

  // Data chart Donut untuk proporsi status (hari ini atau bulan)
  const donutData = useMemo(() => {
    if (!overview) return [];
    const src = groupTableScope === 'today' ? overview.today : overview.month;
    const list = [
      { name: 'Hadir', value: src.hadir, color: STATUS_COLORS.hadir },
      { name: 'OFF Roster', value: src.off, color: STATUS_COLORS.off },
      { name: 'Cuti', value: src.cuti, color: STATUS_COLORS.cuti },
      { name: 'Izin / Sakit', value: src.izin, color: STATUS_COLORS.izin },
      { name: 'Mangkir', value: src.mangkir, color: STATUS_COLORS.mangkir },
      { name: 'Belum Terdaftar', value: src.belumTerdaftar || 0, color: STATUS_COLORS.belumTerdaftar },
    ];
    if (groupTableScope === 'today' && overview.today.belumAbsen > 0) {
      list.push({ name: 'Menunggu Shift', value: overview.today.belumAbsen, color: STATUS_COLORS.belumAbsen });
    }
    return list.filter((d) => d.value > 0);
  }, [overview, groupTableScope]);

  // Data bar chart perbandingan 4 Shift Kerja Aktif (OFF Roster tampil di strip tersendiri agar tidak membingungkan)
  const shiftChartData = useMemo(() => {
    if (!overview) return [];
    const shiftsObj = shiftScope === 'today' ? overview.today.shifts : overview.month.shifts;
    return (['SHIFT_I', 'SHIFT_II', 'SHIFT_III', 'DAY_SHIFT'] as ActiveShiftKey[])
      .filter((k) => Boolean(shiftsObj[k]))
      .map((k) => ({
        name: shiftsObj[k].label,
        Hadir: shiftsObj[k].hadir,
        'Cuti/Izin': shiftsObj[k].cuti + shiftsObj[k].izin,
        Mangkir: shiftsObj[k].mangkir,
        'Blm Daftar': shiftsObj[k].belumTerdaftar || 0,
      }));
  }, [overview, shiftScope]);

  if (viewMode === 'executive') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3.5 bg-card border border-border rounded-2xl">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode('admin')}
            className="rounded-xl text-xs gap-1.5 font-semibold h-8"
          >
            ← Kembali ke Command Center Superadmin
          </Button>
          <Badge className="bg-emerald-600 text-white text-xs">Mode Radar Eksekutif Direksi</Badge>
        </div>
        <HrmPimpinanDashboard />
      </div>
    );
  }

  const headcount = overview?.headcount || { total: 83, shipment: 47, rumahTangga: 33, karyawanTetap: 3 };
  const today = overview?.today;
  const month = overview?.month;
  const shiftStatsMap = shiftScope === 'today' ? today?.shifts : month?.shifts;
  const activeShiftNow = overview?.meta.activeShiftNow || 'SHIFT_I';
  const isViewingToday = overview?.meta.date === overview?.meta.todayWita;

  const pctShipment = headcount.total > 0 ? ((headcount.shipment / headcount.total) * 100).toFixed(1) : '56.6';
  const pctRumahTangga = headcount.total > 0 ? ((headcount.rumahTangga / headcount.total) * 100).toFixed(1) : '39.8';
  const pctTetap = headcount.total > 0 ? ((headcount.karyawanTetap / headcount.total) * 100).toFixed(1) : '3.6';

  return (
    <div className="space-y-5 pb-8">
      {/* ─── BARIS 1: COMPACT EXECUTIVE COMMAND BAR ─── */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                LIVE POSTGRESQL
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                {liveWitaClock || '--:--:--'} WITA
              </span>
              {lastSyncedAt && (
                <span className="text-[11px] text-muted-foreground hidden sm:inline">
                  • Update: <span className="font-mono font-semibold text-foreground">{lastSyncedAt}</span>
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
              Pusat Kendali Operasional PT. FRP
            </h1>
            <p className="text-xs text-muted-foreground">
              {headcount.total} Personil Resmi ({headcount.shipment} Shipment • {headcount.rumahTangga} Rumah Tangga • {headcount.karyawanTetap} Tetap) — Halo, <span className="font-semibold text-foreground">{user?.fullName || 'Superadmin'}</span>
            </p>
          </div>

          {/* Primary Actions & Pending Counter */}
          <div className="flex flex-wrap items-center gap-2">
            {overview && overview.pendingApprovals.total > 0 && (
              <Link to="/admin/persetujuan">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl text-xs gap-1.5 border-amber-400/60 bg-amber-50/70 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 hover:bg-amber-100"
                >
                  <Bell className="w-3.5 h-3.5 text-amber-600" />
                  <span className="font-bold">{overview.pendingApprovals.total} Menunggu</span>
                </Button>
              </Link>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchOverview(true)}
              disabled={isRefreshing}
              className="h-9 rounded-xl text-xs gap-1.5 font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Sync Live
            </Button>
            <Button
              size="sm"
              onClick={() => setGhostModalOpen(true)}
              className="h-9 rounded-xl text-xs gap-1.5 font-semibold bg-teal-600 hover:bg-teal-700 text-white"
            >
              <Smartphone className="w-3.5 h-3.5" />
              Pantau PWA
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode('executive')}
              className="h-9 rounded-xl text-xs gap-1.5 font-semibold"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Mode Direksi
            </Button>
          </div>
        </div>

        {/* Filter Bar: Group Segmented Control + Month/Date Selector */}
        <div className="pt-3 border-t border-border/70 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/60 w-fit">
            {(
              [
                { id: 'ALL', label: `Semua (${headcount.total})` },
                { id: 'SHIPMENT', label: `Shipment (${headcount.shipment})` },
                { id: 'RUMAH TANGGA', label: `Rumah Tangga (${headcount.rumahTangga})` },
                { id: 'KARYAWAN TETAP', label: `Tetap (${headcount.karyawanTetap})` },
              ] as { id: GroupFilter; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setGroupFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  groupFilter === tab.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/70'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-muted/40 border border-border rounded-xl px-2.5 py-1">
              <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[11px] font-semibold text-muted-foreground">Bulan:</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="bg-transparent text-xs font-mono font-bold text-foreground focus:outline-none"
              />
            </div>
            {!isViewingToday && overview && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedMonth(overview.meta.todayWita.slice(0, 7));
                  setSelectedDate(overview.meta.todayWita);
                }}
                className="h-8 text-[11px] text-emerald-700 dark:text-emerald-400 font-bold"
              >
                Kembali ke Hari Ini
              </Button>
            )}
          </div>
        </div>

        {/* Urutan Tanggal Bulan Berjalan (1 s/d 30/31) — 1-Klik Ganti Hari */}
        {(() => {
          const [yNum, mNum] = selectedMonth.split('-').map(Number);
          const totalDays = month?.totalDaysInMonth || new Date(yNum || 2026, mNum || 11, 0).getDate();
          const todayStr = overview?.meta.todayWita || initialToday;
          return (
            <div className="pt-2.5 border-t border-border/50 space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
                  Pilih Tanggal ({formatMonthId(selectedMonth)}):
                  <strong className="text-foreground font-mono">{formatDateId(selectedDate)}</strong>
                </span>
                <span className="text-[10.5px] text-muted-foreground hidden sm:inline">
                  Klik angka tanggal untuk melihat rekap hari tersebut
                </span>
              </div>
              <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
                {Array.from({ length: totalDays }, (_, idx) => {
                  const dayNum = idx + 1;
                  const dStr = `${selectedMonth}-${String(dayNum).padStart(2, '0')}`;
                  const isSelected = dStr === selectedDate;
                  const isTodayBtn = dStr === todayStr;
                  const isFutureBtn = dStr > todayStr;
                  return (
                    <button
                      key={dStr}
                      type="button"
                      disabled={isFutureBtn}
                      onClick={() => setSelectedDate(dStr)}
                      title={formatDateId(dStr)}
                      className={`relative min-w-[30px] h-8 px-1.5 rounded-lg font-mono text-xs font-bold transition-all shrink-0 flex items-center justify-center ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : isFutureBtn
                          ? 'bg-muted/30 text-muted-foreground/40 cursor-not-allowed'
                          : isTodayBtn
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/50 hover:bg-emerald-500/25'
                          : 'bg-muted/50 text-foreground/80 hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300 border border-transparent hover:border-emerald-500/30'
                      }`}
                    >
                      {dayNum}
                      {isTodayBtn && !isSelected && (
                        <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-emerald-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Loading Skeleton */}
      {isLoading && !overview ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-2xl bg-muted/50 animate-pulse border border-border" />
          ))}
        </div>
      ) : overview ? (
        <>
          {/* ─── BARIS 2: KOMPOSISI 83 PERSONIL RESMI & KESIAPAN HARIAN ─── */}
          <Card className="border-border bg-card rounded-2xl shadow-xs overflow-hidden">
            <CardContent className="p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Struktur Tenaga Kerja Resmi PT. FAWWAZ RESKI PERWIRA
                    </p>
                    <p className="text-sm font-bold text-foreground">
                      Total <span className="font-mono text-base text-emerald-600 dark:text-emerald-400">{headcount.total}</span> Personil Aktif • Tingkat Kehadiran {isViewingToday ? 'Hari Ini' : formatDateId(overview.meta.date)}:{' '}
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">{today?.attendanceRate ?? 0}%</span>
                    </p>
                  </div>
                </div>
                <Link to="/admin/monitoring">
                  <Button variant="outline" size="sm" className="h-8 rounded-xl text-xs gap-1.5 font-semibold">
                    Radar Monitoring Live
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>

              {/* Stacked Headcount Proportion Bar */}
              <div className="space-y-1.5">
                <div className="h-3 w-full rounded-full overflow-hidden flex bg-muted">
                  <div
                    style={{ width: `${pctShipment}%` }}
                    className="bg-emerald-600 transition-all duration-500"
                    title={`Shipment: ${headcount.shipment} Orang (${pctShipment}%)`}
                  />
                  <div
                    style={{ width: `${pctRumahTangga}%` }}
                    className="bg-teal-500 transition-all duration-500"
                    title={`Rumah Tangga: ${headcount.rumahTangga} Orang (${pctRumahTangga}%)`}
                  />
                  <div
                    style={{ width: `${pctTetap}%` }}
                    className="bg-amber-500 transition-all duration-500"
                    title={`Karyawan Tetap: ${headcount.karyawanTetap} Orang (${pctTetap}%)`}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between text-[11px] text-muted-foreground font-medium gap-2">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600" />
                    Shipment: <strong className="font-mono text-foreground">{headcount.shipment} Org</strong> ({pctShipment}%)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-teal-500" />
                    Rumah Tangga: <strong className="font-mono text-foreground">{headcount.rumahTangga} Org</strong> ({pctRumahTangga}%)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                    Karyawan Tetap: <strong className="font-mono text-foreground">{headcount.karyawanTetap} Org</strong> ({pctTetap}%)
                  </span>
                </div>
              </div>

              {/* 3 Interactive Group Pillars */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {overview.groups.map((g) => {
                  const isSelected = groupFilter === g.group;
                  const wajib = Math.max(g.total - g.today.off - g.today.cuti - g.today.izin - (g.today.belumTerdaftar || 0), 0);
                  const rate = wajib > 0 ? Math.round((g.today.hadir / wajib) * 100) : 100;
                  const Icon = g.group === 'SHIPMENT' ? Building2 : g.group === 'RUMAH TANGGA' ? Home : Star;
                  const accent =
                    g.group === 'SHIPMENT'
                      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                      : g.group === 'RUMAH TANGGA'
                      ? 'text-teal-600 dark:text-teal-400 bg-teal-500/10'
                      : 'text-amber-600 dark:text-amber-400 bg-amber-500/10';

                  return (
                    <button
                      key={g.group}
                      type="button"
                      onClick={() => setGroupFilter(isSelected ? 'ALL' : g.group)}
                      className={`text-left p-3.5 rounded-2xl border transition-all ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/40'
                          : 'border-border bg-muted/20 hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accent}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p className="text-xs font-extrabold text-foreground">{g.group}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{g.total} Personil</p>
                          </div>
                        </div>
                        <span className="text-xs font-mono font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                          {rate}% Hadir
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-[11px] pt-2 border-t border-border/60">
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Hadir / Aktif</span>
                          <span className="font-mono font-bold text-foreground">
                            {g.today.hadir}/{wajib}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">OFF • C/I</span>
                          <span className="font-mono font-bold text-foreground">
                            {g.today.off} • {g.today.cuti + g.today.izin}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-muted-foreground block text-[10px]">Mangkir • Blm</span>
                          <span className="font-mono font-bold text-foreground">
                            <span className={g.today.mangkir > 0 ? 'text-rose-600' : ''}>{g.today.mangkir}</span> •{' '}
                            <span className={(g.today.belumTerdaftar || 0) > 0 ? 'text-purple-600 dark:text-purple-400' : ''}>
                              {g.today.belumTerdaftar || 0}
                            </span>
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* ─── BARIS 3: 6 KARTU KPI STATUS KEHADIRAN MURNI (MUTUALLY EXCLUSIVE = 100% HEADCOUNT) ─── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            {/* 1. HADIR */}
            <button
              type="button"
              onClick={() => openDrillDown(`Daftar Karyawan Hadir (${formatDateId(overview.meta.date)})`, 'hadir')}
              className="text-left group bg-card border border-border hover:border-emerald-500/60 rounded-2xl p-3.5 shadow-xs transition-all"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Hadir</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-mono font-black text-emerald-600 dark:text-emerald-400">
                  {today?.hadir ?? 0}
                </span>
                <span className="text-[11px] font-semibold text-muted-foreground">Org</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                Tepat {today?.tepatWaktu ?? 0} • Telat {today?.terlambat ?? 0}
              </p>
              <div className="mt-2 pt-1.5 border-t border-border/60 flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">Bulan Ini</span>
                <span className="font-mono font-bold text-foreground">{(month?.hadir ?? 0).toLocaleString('id-ID')} Hr</span>
              </div>
            </button>

            {/* 2. OFF */}
            <button
              type="button"
              onClick={() => openDrillDown(`Daftar Karyawan Libur / OFF (${formatDateId(overview.meta.date)})`, 'off')}
              className="text-left group bg-card border border-border hover:border-slate-400 rounded-2xl p-3.5 shadow-xs transition-all"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">OFF Roster</span>
                <div className="w-7 h-7 rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-400 flex items-center justify-center">
                  <Coffee className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-mono font-black text-slate-700 dark:text-slate-200">
                  {today?.off ?? 0}
                </span>
                <span className="text-[11px] font-semibold text-muted-foreground">Org</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Libur rotasi shift</p>
              <div className="mt-2 pt-1.5 border-t border-border/60 flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">Bulan Ini</span>
                <span className="font-mono font-bold text-foreground">{(month?.off ?? 0).toLocaleString('id-ID')} Hr</span>
              </div>
            </button>

            {/* 3. CUTI */}
            <button
              type="button"
              onClick={() => openDrillDown(`Daftar Karyawan Cuti (${formatDateId(overview.meta.date)})`, 'cuti')}
              className="text-left group bg-card border border-border hover:border-sky-500/60 rounded-2xl p-3.5 shadow-xs transition-all"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Cuti</span>
                <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-600 flex items-center justify-center">
                  <CalendarDays className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-mono font-black text-sky-600 dark:text-sky-400">
                  {today?.cuti ?? 0}
                </span>
                <span className="text-[11px] font-semibold text-muted-foreground">Org</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Cuti disetujui</p>
              <div className="mt-2 pt-1.5 border-t border-border/60 flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">Bulan Ini</span>
                <span className="font-mono font-bold text-foreground">{month?.cuti ?? 0} Hr</span>
              </div>
            </button>

            {/* 4. IZIN / SAKIT */}
            <button
              type="button"
              onClick={() => openDrillDown(`Daftar Karyawan Izin & Sakit (${formatDateId(overview.meta.date)})`, 'izin')}
              className="text-left group bg-card border border-border hover:border-indigo-500/60 rounded-2xl p-3.5 shadow-xs transition-all"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Izin / Sakit</span>
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-mono font-black text-indigo-600 dark:text-indigo-400">
                  {today?.izin ?? 0}
                </span>
                <span className="text-[11px] font-semibold text-muted-foreground">Org</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                Izin {(today?.izin ?? 0) - (today?.sakit ?? 0)} • Sakit {today?.sakit ?? 0}
              </p>
              <div className="mt-2 pt-1.5 border-t border-border/60 flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">Bulan Ini</span>
                <span className="font-mono font-bold text-foreground">{month?.izin ?? 0} Hr</span>
              </div>
            </button>

            {/* 5. MANGKIR / ALPA RIIL */}
            <button
              type="button"
              onClick={() =>
                openDrillDown(
                  (today?.mangkir ?? 0) > 0
                    ? `Daftar Karyawan Mangkir / Alpa (${formatDateId(overview.meta.date)})`
                    : `Menunggu Ceklok Shift (${formatDateId(overview.meta.date)})`,
                  (today?.mangkir ?? 0) > 0 ? 'mangkir' : 'belum_absen'
                )
              }
              className={`text-left group rounded-2xl p-3.5 shadow-xs border transition-all ${
                (today?.mangkir ?? 0) > 0
                  ? 'bg-rose-50/70 dark:bg-rose-950/25 border-rose-300 dark:border-rose-800 hover:border-rose-500'
                  : 'bg-card border-border hover:border-rose-400/60'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Mangkir</span>
                <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-mono font-black text-rose-600 dark:text-rose-400">
                  {today?.mangkir ?? 0}
                </span>
                <span className="text-[11px] font-semibold text-muted-foreground">Org</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                {isViewingToday ? `Tunggu shift: ${today?.belumAbsen ?? 0}` : 'Alpa tanpa ket.'}
              </p>
              <div className="mt-2 pt-1.5 border-t border-border/60 flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">Bulan Ini</span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{month?.mangkir ?? 0} Hr</span>
              </div>
            </button>

            {/* 6. BELUM TERDAFTAR WAJAH / BELUM AKTIF APLIKASI */}
            <button
              type="button"
              onClick={() =>
                openDrillDown(`Belum Terdaftar Wajah / Aplikasi (${formatDateId(overview.meta.date)})`, 'belum_terdaftar')
              }
              className={`text-left group rounded-2xl p-3.5 shadow-xs border transition-all ${
                (today?.belumTerdaftar ?? 0) > 0
                  ? 'bg-purple-50/60 dark:bg-purple-950/20 border-purple-300/70 dark:border-purple-800/70 hover:border-purple-500'
                  : 'bg-card border-border hover:border-purple-400/60'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Blm Daftar</span>
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <UserX className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-mono font-black text-purple-600 dark:text-purple-400">
                  {today?.belumTerdaftar ?? 0}
                </span>
                <span className="text-[11px] font-semibold text-muted-foreground">Org</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">Belum enroll wajah</p>
              <div className="mt-2 pt-1.5 border-t border-border/60 flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">Akum. Bln</span>
                <span className="font-mono font-bold text-purple-600 dark:text-purple-400">{month?.belumTerdaftar ?? 0} Hr</span>
              </div>
            </button>
          </div>

          {/* ─── BARIS 4: MATRIKS OPERASIONAL PER-SHIFT (SHIFT I, II, III, DAY SHIFT + OFF ROSTER) ─── */}
          <Card className="border-border bg-card rounded-2xl shadow-xs">
            <CardHeader className="pb-3 border-b border-border/70">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    Matriks Operasional Per-Shift (Shift I, II, III, Day Shift & OFF Roster)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {shiftScope === 'today'
                      ? `Rekap akurat tanggal ${formatDateId(overview.meta.date)} — total semua shift + OFF selalu tepat ${overview.meta.filteredTotal} personil.`
                      : `Akumulasi total bulan ${formatMonthId(overview.meta.month)} (${month?.daysElapsed ?? 0} hari berjalan).`}
                  </CardDescription>
                </div>

                {/* Scope Toggle */}
                <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl border border-border/60 w-fit">
                  <button
                    type="button"
                    onClick={() => setShiftScope('today')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      shiftScope === 'today'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Live Hari Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => setShiftScope('month')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      shiftScope === 'month'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Total Bulan Berjalan
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 space-y-4">
              {/* Banner Rekonsiliasi Eksplisit 100% Akurat */}
              {shiftScope === 'today' && shiftStatsMap && (() => {
                const s1 = shiftStatsMap.SHIFT_I?.total ?? 0;
                const s2 = shiftStatsMap.SHIFT_II?.total ?? 0;
                const s3 = shiftStatsMap.SHIFT_III?.total ?? 0;
                const ds = shiftStatsMap.DAY_SHIFT?.total ?? 0;
                const offR = shiftStatsMap.OFF_ROSTER?.total ?? 0;
                const sumTotal = s1 + s2 + s3 + ds + offR;
                const isBalanced = sumTotal === overview.meta.filteredTotal;
                return (
                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 font-extrabold text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Rekonsiliasi {overview.meta.groupFilter === 'ALL' ? 'Total' : overview.meta.groupFilter}:
                      </span>
                      <span className="font-mono text-foreground">
                        Shift I (<strong>{s1}</strong>) + Shift II (<strong>{s2}</strong>) + Shift III (<strong>{s3}</strong>) + Day Shift (<strong>{ds}</strong>) + OFF (<strong>{offR}</strong>)
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`font-mono font-extrabold text-xs ${
                        isBalanced
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'border-rose-500/50 bg-rose-500/10 text-rose-700'
                      }`}
                    >
                      = {sumTotal} / {overview.meta.filteredTotal} Org {isBalanced ? '✓' : ''}
                    </Badge>
                  </div>
                );
              })()}

              {/* 4 Active Shift Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
                {(['SHIFT_I', 'SHIFT_II', 'SHIFT_III', 'DAY_SHIFT'] as ActiveShiftKey[]).map((key) => {
                  const s = shiftStatsMap?.[key];
                  if (!s) return null;
                  const meta = SHIFT_META[key];
                  const ShiftIcon = meta.icon;
                  const isActiveNow = isViewingToday && shiftScope === 'today' && activeShiftNow === key;
                  const cutiIzinTotal = s.cuti + s.izin;

                  return (
                    <div
                      key={key}
                      className={`rounded-2xl border p-4 transition-all flex flex-col justify-between ${
                        isActiveNow
                          ? 'border-emerald-500/70 bg-emerald-500/5 ring-1 ring-emerald-500/30'
                          : 'border-border bg-muted/20 hover:bg-muted/35'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${meta.badgeBg}`}>
                              <ShiftIcon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-extrabold text-foreground leading-tight truncate">{s.label}</p>
                              <p className="text-[11px] font-mono text-muted-foreground">{s.range} WITA</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="px-2 py-0.5 rounded-full bg-background border border-border font-mono text-[11px] font-extrabold text-foreground">
                              {s.total} {shiftScope === 'today' ? 'Org' : 'Hr'}
                            </span>
                            {isActiveNow && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[9px] font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                AKTIF
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status Grid (4 Mutual-Exclusive Buckets per Shift) */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => openDrillDown(`${s.label} — Hadir (${formatDateId(overview.meta.date)})`, 'hadir', key)}
                            className="p-2 rounded-xl bg-background/80 border border-border/60 hover:border-emerald-500/50 text-left transition-colors"
                          >
                            <span className="text-[10px] text-muted-foreground block">Hadir</span>
                            <span className="text-base font-mono font-black text-emerald-600 dark:text-emerald-400">
                              {s.hadir}
                            </span>
                            {s.terlambat > 0 && (
                              <span className="text-[9.5px] font-mono text-amber-600 ml-1">({s.terlambat} telat)</span>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => openDrillDown(`${s.label} — Cuti, Izin & Sakit (${formatDateId(overview.meta.date)})`, 'cuti_izin', key)}
                            className="p-2 rounded-xl bg-background/80 border border-border/60 hover:border-sky-500/50 text-left transition-colors"
                          >
                            <span className="text-[10px] text-muted-foreground block">Cuti / Izin</span>
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-base font-mono font-black text-sky-600 dark:text-sky-400">
                                {cutiIzinTotal}
                              </span>
                              {cutiIzinTotal > 0 && (
                                <span className="text-[9.5px] font-mono text-muted-foreground">
                                  ({s.cuti}C•{s.izin}I)
                                </span>
                              )}
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openDrillDown(
                                `${s.label} — ${s.mangkir > 0 ? 'Mangkir / Alpa' : 'Menunggu Shift'} (${formatDateId(overview.meta.date)})`,
                                s.mangkir > 0 ? 'mangkir' : 'belum_absen',
                                key
                              )
                            }
                            className="p-2 rounded-xl bg-background/80 border border-border/60 hover:border-rose-500/50 text-left transition-colors"
                          >
                            <span className="text-[10px] text-muted-foreground block">
                              Mangkir{shiftScope === 'today' && s.belumAbsen > 0 ? ' • Tunggu' : ''}
                            </span>
                            <span className={`text-base font-mono font-black ${s.mangkir > 0 ? 'text-rose-600' : 'text-foreground'}`}>
                              {s.mangkir}
                              {shiftScope === 'today' && s.belumAbsen > 0 && (
                                <span className="text-xs text-muted-foreground font-semibold"> • {s.belumAbsen}</span>
                              )}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openDrillDown(`${s.label} — Belum Terdaftar Wajah (${formatDateId(overview.meta.date)})`, 'belum_terdaftar', key)}
                            className="p-2 rounded-xl bg-background/80 border border-border/60 hover:border-purple-500/50 text-left transition-colors"
                          >
                            <span className="text-[10px] text-muted-foreground block">Blm Daftar</span>
                            <span className={`text-base font-mono font-black ${(s.belumTerdaftar || 0) > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground'}`}>
                              {s.belumTerdaftar || 0}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Dedicated OFF Roster Strip (Terpisah dari Day Shift agar 100% Jelas) */}
              {shiftStatsMap?.OFF_ROSTER && (
                <button
                  type="button"
                  onClick={() => openDrillDown(`Daftar Karyawan OFF / Libur Roster (${formatDateId(overview.meta.date)})`, 'off', 'OFF_ROSTER')}
                  className="w-full rounded-2xl border border-slate-300/70 dark:border-slate-700/70 bg-slate-50/70 dark:bg-slate-900/40 hover:border-slate-400 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-left transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-500/15 border border-slate-400/30 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                      <Coffee className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-foreground leading-tight">
                        OFF Roster / Libur Rotasi
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Karyawan yang sedang jadwal libur rotasi (dipisahkan dari Day Shift agar komposisi shift aktif akurat)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-3 py-1 rounded-full bg-background border border-border font-mono text-sm font-black text-slate-700 dark:text-slate-200">
                      {shiftStatsMap.OFF_ROSTER.total} {shiftScope === 'today' ? 'Orang' : 'Hari'}
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      Lihat Daftar →
                    </span>
                  </div>
                </button>
              )}

              {/* Executive Horizontal Stacked Bar Across 4 Active Work Shifts (Zero Gaps, Direct Labels & % Attendance) */}
              <div className="pt-3 border-t border-border/60 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-foreground">
                    Visualisasi Komposisi 4 Shift Kerja Aktif ({shiftScope === 'today' ? formatDateId(overview.meta.date) : formatMonthId(overview.meta.month)})
                  </span>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600" />
                      Hadir
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-sky-600" />
                      Cuti/Izin
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-rose-600" />
                      Mangkir
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-purple-600" />
                      Blm Daftar
                    </span>
                  </div>
                </div>

                {(() => {
                  const activeKeys: ActiveShiftKey[] = ['SHIFT_I', 'SHIFT_II', 'SHIFT_III', 'DAY_SHIFT'];
                  const rows = activeKeys
                    .map((k) => shiftStatsMap?.[k])
                    .filter((x): x is ShiftBucketStats => Boolean(x));
                  const maxTotal = Math.max(...rows.map((r) => r.total || 0), 1);

                  return (
                    <div className="space-y-2.5">
                      {rows.map((s) => {
                        const cutiIzin = s.cuti + s.izin;
                        const blmDaftar = s.belumTerdaftar || 0;
                        const wajibShift = Math.max(s.total - cutiIzin - blmDaftar, 0);
                        const pctHadir = wajibShift > 0 ? Math.round((s.hadir / wajibShift) * 100) : 100;
                        const barScalePct = s.total > 0 ? Math.max((s.total / maxTotal) * 100, 14) : 0;

                        const segments: {
                          key: string;
                          label: string;
                          value: number;
                          bg: string;
                          drill: DrillCategory;
                        }[] = [
                          { key: 'hadir', label: 'Hadir', value: s.hadir, bg: 'bg-emerald-600 hover:bg-emerald-500', drill: 'hadir' },
                          { key: 'cuti_izin', label: 'Cuti/Izin', value: cutiIzin, bg: 'bg-sky-600 hover:bg-sky-500', drill: 'cuti_izin' },
                          { key: 'mangkir', label: 'Mangkir', value: s.mangkir, bg: 'bg-rose-600 hover:bg-rose-500', drill: 'mangkir' },
                          { key: 'belum_terdaftar', label: 'Blm Daftar', value: blmDaftar, bg: 'bg-purple-600 hover:bg-purple-500', drill: 'belum_terdaftar' },
                          { key: 'belum_absen', label: 'Tunggu', value: shiftScope === 'today' ? s.belumAbsen : 0, bg: 'bg-slate-400 hover:bg-slate-500', drill: 'belum_absen' },
                        ].filter((seg) => seg.value > 0);

                        return (
                          <div
                            key={s.key}
                            className="grid grid-cols-12 items-center gap-2 sm:gap-3"
                          >
                            {/* Shift Name & Range */}
                            <div className="col-span-4 sm:col-span-3 min-w-0">
                              <p className="text-xs font-extrabold text-foreground leading-tight truncate">{s.label}</p>
                              <p className="text-[10px] font-mono text-muted-foreground truncate">{s.range}</p>
                            </div>

                            {/* Proportional Horizontal Stacked Bar */}
                            <div className="col-span-5 sm:col-span-6">
                              <div className="w-full h-8 rounded-xl bg-muted/40 p-0.5 flex items-center">
                                {s.total > 0 ? (
                                  <div
                                    style={{ width: `${barScalePct}%` }}
                                    className="h-full rounded-lg overflow-hidden flex gap-[1.5px] transition-all duration-500"
                                  >
                                    {segments.map((seg) => {
                                      const segPct = (seg.value / s.total) * 100;
                                      return (
                                        <button
                                          key={seg.key}
                                          type="button"
                                          style={{ width: `${segPct}%` }}
                                          onClick={() =>
                                            openDrillDown(
                                              `${s.label} — ${seg.label} (${formatDateId(overview.meta.date)})`,
                                              seg.drill,
                                              s.key
                                            )
                                          }
                                          title={`${s.label} • ${seg.label}: ${seg.value} ${shiftScope === 'today' ? 'Org' : 'Hr'}`}
                                          className={`${seg.bg} text-white font-mono text-[11px] font-extrabold flex items-center justify-center transition-colors min-w-[20px]`}
                                        >
                                          {seg.value}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground px-2">Tidak ada jadwal</span>
                                )}
                              </div>
                            </div>

                            {/* Right Summary: Total & % Attendance */}
                            <div className="col-span-3 flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
                              <span className="font-mono text-xs font-extrabold text-foreground whitespace-nowrap">
                                {s.total} {shiftScope === 'today' ? 'Org' : 'Hr'}
                              </span>
                              <span
                                className={`font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                                  pctHadir >= 95
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                    : pctHadir >= 85
                                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                    : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                                }`}
                              >
                                {pctHadir}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </CardContent>
          </Card>

          {/* ─── BARIS 5: VISUALISASI TREN HARIAN BULAN BERJALAN & RINGKASAN GRUP ─── */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            {/* Kiri (8 col): Daily Timeline ComposedChart */}
            <Card className="xl:col-span-8 border-border bg-card rounded-2xl shadow-xs">
              <CardHeader className="pb-2 border-b border-border/70">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                      Tren Kehadiran Harian — {formatMonthId(overview.meta.month)}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {trendMode === 'rate'
                        ? 'Persentase kehadiran aktif harian terhadap target 95%. Titik merah menandai hari dengan kasus Mangkir. Klik tanggal untuk inspeksi.'
                        : 'Komposisi headcount harian (Hadir, OFF, Cuti, Izin/Sakit, Mangkir, Blm Daftar). Klik tanggal untuk inspeksi.'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-lg text-[10.5px]">
                      <button
                        type="button"
                        onClick={() => setTrendMode('rate')}
                        className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                          trendMode === 'rate' ? 'bg-emerald-600 text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        % Kehadiran
                      </button>
                      <button
                        type="button"
                        onClick={() => setTrendMode('composition')}
                        className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                          trendMode === 'composition' ? 'bg-emerald-600 text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Komposisi Orang
                      </button>
                    </div>
                    <Badge variant="outline" className="text-[11px] font-mono w-fit hidden sm:inline-flex">
                      {month?.daysElapsed ?? 0}/{month?.totalDaysInMonth ?? 30} Hr
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="h-[310px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {trendMode === 'rate' ? (
                      <AreaChart
                        data={overview.dailySeries}
                        margin={{ top: 14, right: 14, left: -12, bottom: 0 }}
                        onClick={(state: any) => {
                          const clickedDate = state?.activePayload?.[0]?.payload?.date;
                          if (clickedDate && clickedDate <= (overview.meta.todayWita || initialToday)) {
                            setSelectedDate(clickedDate);
                          }
                        }}
                      >
                        <defs>
                          <linearGradient id="emeraldAttGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#059669" stopOpacity={0.32} />
                            <stop offset="95%" stopColor="#059669" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.18} vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis
                          domain={[60, 100]}
                          tick={{ fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          unit="%"
                        />
                        <ReferenceLine
                          y={95}
                          stroke="#059669"
                          strokeDasharray="4 4"
                          strokeOpacity={0.65}
                          label={{ value: 'Target 95%', position: 'insideTopRight', fill: '#059669', fontSize: 10, fontWeight: 700 }}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload.length) return null;
                            const d = payload[0].payload as DailyPoint;
                            if (d.isFuture) return null;
                            return (
                              <div className="rounded-xl border border-border bg-card p-3 shadow-md text-xs space-y-1">
                                <p className="font-extrabold text-foreground border-b border-border/60 pb-1">
                                  {formatDateId(d.date)}
                                </p>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-muted-foreground">Kehadiran Aktif:</span>
                                  <span className="font-mono font-black text-emerald-600">{d.attendanceRate ?? 100}%</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-muted-foreground">Hadir / Wajib Aktif:</span>
                                  <span className="font-mono font-bold text-foreground">{d.hadir} / {d.wajibAktif ?? d.hadir} Org</span>
                                </div>
                                <div className="flex items-center justify-between gap-4 text-[11px] pt-1 border-t border-border/50">
                                  <span>OFF: <strong className="font-mono">{d.off}</strong></span>
                                  <span>C/I: <strong className="font-mono text-sky-600">{d.cuti + d.izin}</strong></span>
                                  <span>Mangkir: <strong className={`font-mono ${d.mangkir > 0 ? 'text-rose-600' : ''}`}>{d.mangkir}</strong></span>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="attendanceRate"
                          name="Kehadiran Aktif (%)"
                          stroke="#059669"
                          strokeWidth={2.5}
                          fill="url(#emeraldAttGrad)"
                          connectNulls={false}
                          dot={(props: any) => {
                            const { cx, cy, payload } = props;
                            if (payload?.isFuture || payload?.attendanceRate === null || cx == null || cy == null) {
                              return <g key={`empty-${payload?.day}`} />;
                            }
                            const hasMangkir = (payload?.mangkir || 0) > 0;
                            const isSelectedDot = payload?.date === selectedDate;
                            return (
                              <circle
                                key={`dot-${payload.day}`}
                                cx={cx}
                                cy={cy}
                                r={isSelectedDot ? 5.5 : hasMangkir ? 4.5 : 2.8}
                                fill={hasMangkir ? '#e11d48' : '#059669'}
                                stroke="#ffffff"
                                strokeWidth={isSelectedDot ? 2 : 1.5}
                              />
                            );
                          }}
                          activeDot={{ r: 6, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                        />
                      </AreaChart>
                    ) : (
                      <BarChart
                        data={overview.dailySeries}
                        margin={{ top: 10, right: 8, left: -16, bottom: 0 }}
                        onClick={(state: any) => {
                          const clickedDate = state?.activePayload?.[0]?.payload?.date;
                          if (clickedDate) setSelectedDate(clickedDate);
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.18} vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip
                          labelFormatter={(label) => `Tanggal ${label} ${formatMonthId(overview.meta.month)}`}
                          contentStyle={{
                            borderRadius: '12px',
                            border: '1px solid hsl(var(--border))',
                            backgroundColor: 'hsl(var(--card))',
                            fontSize: '12px',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Bar dataKey="hadir" name="Hadir" stackId="a" fill={STATUS_COLORS.hadir} />
                        <Bar dataKey="off" name="OFF" stackId="a" fill={STATUS_COLORS.off} />
                        <Bar dataKey="cuti" name="Cuti" stackId="a" fill={STATUS_COLORS.cuti} />
                        <Bar dataKey="izin" name="Izin/Sakit" stackId="a" fill={STATUS_COLORS.izin} />
                        <Bar dataKey="mangkir" name="Mangkir" stackId="a" fill={STATUS_COLORS.mangkir} />
                        <Bar dataKey="belumTerdaftar" name="Blm Daftar" stackId="a" fill={STATUS_COLORS.belumTerdaftar} radius={[3, 3, 0, 0]} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Kanan (4 col): Donut Proporsi + Tabel Ringkas Grup × Status */}
            <Card className="xl:col-span-4 border-border bg-card rounded-2xl shadow-xs flex flex-col">
              <CardHeader className="pb-2 border-b border-border/70">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-bold">Proporsi & Ringkasan Grup</CardTitle>
                  <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-lg text-[10px]">
                    <button
                      type="button"
                      onClick={() => setGroupTableScope('today')}
                      className={`px-2 py-1 rounded-md font-bold ${
                        groupTableScope === 'today' ? 'bg-emerald-600 text-white' : 'text-muted-foreground'
                      }`}
                    >
                      Hari Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => setGroupTableScope('month')}
                      className={`px-2 py-1 rounded-md font-bold ${
                        groupTableScope === 'month' ? 'bg-emerald-600 text-white' : 'text-muted-foreground'
                      }`}
                    >
                      Bulan Ini
                    </button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-4">
                {/* Donut Chart */}
                <div className="relative h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={76}
                        paddingAngle={2}
                      >
                        {donutData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: '10px',
                          border: '1px solid hsl(var(--border))',
                          backgroundColor: 'hsl(var(--card))',
                          fontSize: '11px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-mono font-black text-foreground">
                      {groupTableScope === 'today' ? overview.meta.filteredTotal : (month?.hadir ?? 0).toLocaleString('id-ID')}
                    </span>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                      {groupTableScope === 'today' ? 'Personil' : 'Hadir Bln'}
                    </span>
                  </div>
                </div>

                {/* Compact Group × Status Table */}
                <div className="overflow-x-auto rounded-xl border border-border/70">
                  <table className="w-full text-[11px]">
                    <thead className="bg-muted/50 text-muted-foreground border-b border-border/70">
                      <tr>
                        <th className="py-2 px-2 text-left font-bold">Grup</th>
                        <th className="py-2 px-1.5 text-center font-bold text-emerald-600">H</th>
                        <th className="py-2 px-1.5 text-center font-bold">OFF</th>
                        <th className="py-2 px-1.5 text-center font-bold text-sky-600">C/I</th>
                        <th className="py-2 px-1.5 text-center font-bold text-rose-600">A</th>
                        <th className="py-2 px-1.5 text-center font-bold text-purple-600">Blm</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 font-mono">
                      {overview.groups.map((g) => {
                        const src = groupTableScope === 'today' ? g.today : g.month;
                        const shortName =
                          g.group === 'SHIPMENT' ? 'Shipment (47)' : g.group === 'RUMAH TANGGA' ? 'R. Tangga (33)' : 'Tetap (3)';
                        return (
                          <tr key={g.group} className="hover:bg-muted/30">
                            <td className="py-2 px-2 font-sans font-semibold text-foreground">{shortName}</td>
                            <td className="py-2 px-1.5 text-center font-bold text-emerald-600">{src.hadir}</td>
                            <td className="py-2 px-1.5 text-center text-muted-foreground">{src.off}</td>
                            <td className="py-2 px-1.5 text-center text-sky-600">{src.cuti + src.izin}</td>
                            <td className={`py-2 px-1.5 text-center font-bold ${src.mangkir > 0 ? 'text-rose-600' : 'text-muted-foreground'}`}>
                              {src.mangkir}
                            </td>
                            <td className={`py-2 px-1.5 text-center font-bold ${(src.belumTerdaftar || 0) > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground'}`}>
                              {src.belumTerdaftar || 0}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-muted/40 font-bold">
                        <td className="py-2 px-2 font-sans text-foreground">TOTAL ({headcount.total})</td>
                        <td className="py-2 px-1.5 text-center text-emerald-600">
                          {overview.groups.reduce((s, g) => s + (groupTableScope === 'today' ? g.today.hadir : g.month.hadir), 0)}
                        </td>
                        <td className="py-2 px-1.5 text-center">
                          {overview.groups.reduce((s, g) => s + (groupTableScope === 'today' ? g.today.off : g.month.off), 0)}
                        </td>
                        <td className="py-2 px-1.5 text-center text-sky-600">
                          {overview.groups.reduce(
                            (s, g) =>
                              s +
                              (groupTableScope === 'today'
                                ? g.today.cuti + g.today.izin
                                : g.month.cuti + g.month.izin),
                            0
                          )}
                        </td>
                        <td className="py-2 px-1.5 text-center text-rose-600">
                          {overview.groups.reduce((s, g) => s + (groupTableScope === 'today' ? g.today.mangkir : g.month.mangkir), 0)}
                        </td>
                        <td className="py-2 px-1.5 text-center text-purple-600 dark:text-purple-400">
                          {overview.groups.reduce((s, g) => s + (groupTableScope === 'today' ? (g.today.belumTerdaftar || 0) : (g.month.belumTerdaftar || 0)), 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ─── BARIS 6 (OPSI B): PANEL RINGKASAN LEMBUR SPKL TERPISAH DARI HEADCOUNT KEHADIRAN ─── */}
          <Card className="border-amber-400/40 bg-card rounded-2xl shadow-xs">
            <CardHeader className="pb-3 border-b border-border/70">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-600 fill-amber-500/30" />
                    Ringkasan Beban Lembur SPKL (Terpisah dari Headcount Kehadiran)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Dipisahkan agar karyawan yang lembur di Hari Kerja maupun Hari OFF tidak menimbulkan penghitungan ganda pada matriks kehadiran.
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl border border-border/60">
                    <button
                      type="button"
                      onClick={() => setOvertimeScope('today')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        overtimeScope === 'today'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {formatDateId(overview.meta.date)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOvertimeScope('month')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        overtimeScope === 'month'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Total {formatMonthId(overview.meta.month)}
                    </button>
                  </div>

                  <Link to="/admin/lembur">
                    <Button variant="outline" size="sm" className="h-8 rounded-xl text-xs gap-1.5 font-semibold border-amber-400/60 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10">
                      Buka Manajemen Lembur
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* Total SPKL Lembur */}
                <button
                  type="button"
                  onClick={() => openDrillDown(`Semua SPKL Lembur (${formatDateId(overview.meta.date)})`, 'lembur')}
                  className="text-left p-4 rounded-2xl border border-amber-400/40 bg-amber-500/5 hover:border-amber-500 transition-all"
                >
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    Total Lembur SPKL Disetujui
                  </p>
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span className="text-2xl font-mono font-black text-amber-600 dark:text-amber-400">
                      {overtimeScope === 'today' ? (today?.lemburOrang ?? 0) : (month?.lemburSpkl ?? 0)}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {overtimeScope === 'today' ? 'SPKL / Orang' : `SPKL (${month?.lemburOrangUnik ?? 0} Org unik)`}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-mono font-bold text-foreground">
                    Akumulasi: {overtimeScope === 'today' ? (today?.lemburJam ?? 0) : (month?.lemburJam ?? 0)} Jam
                  </p>
                </button>

                {/* Lembur Hari Kerja */}
                <button
                  type="button"
                  onClick={() => openDrillDown(`Lembur Hari Kerja (${formatDateId(overview.meta.date)})`, 'lembur_kerja')}
                  className="text-left p-4 rounded-2xl border border-border bg-muted/20 hover:border-amber-500/60 transition-all"
                >
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Lembur Hari Kerja
                  </p>
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span className="text-2xl font-mono font-black text-amber-600 dark:text-amber-400">
                      {overtimeScope === 'today' ? (today?.lemburKerjaOrang ?? 0) : (month?.lemburKerjaSpkl ?? 0)}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">SPKL</span>
                  </div>
                  <p className="mt-1 text-xs font-mono text-muted-foreground">
                    Total <strong className="text-foreground">{overtimeScope === 'today' ? (today?.lemburKerjaJam ?? 0) : (month?.lemburKerjaJam ?? 0)} Jam</strong> • Lanjutan/awal shift kerja
                  </p>
                </button>

                {/* Lembur Hari OFF */}
                <button
                  type="button"
                  onClick={() => openDrillDown(`Lembur Hari OFF / Libur Roster (${formatDateId(overview.meta.date)})`, 'lembur_off')}
                  className="text-left p-4 rounded-2xl border border-border bg-muted/20 hover:border-sky-500/60 transition-all"
                >
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Lembur Hari OFF (Libur Roster)
                  </p>
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span className="text-2xl font-mono font-black text-sky-600 dark:text-sky-400">
                      {overtimeScope === 'today' ? (today?.lemburOffOrang ?? 0) : (month?.lemburOffSpkl ?? 0)}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">SPKL</span>
                  </div>
                  <p className="mt-1 text-xs font-mono text-muted-foreground">
                    Total <strong className="text-foreground">{overtimeScope === 'today' ? (today?.lemburOffJam ?? 0) : (month?.lemburOffJam ?? 0)} Jam</strong> • Pengganti pos saat OFF
                  </p>
                </button>
              </div>

              {/* 2-Color Stacked Bar Harian: Jam Lembur Hari Kerja vs Jam Lembur Hari OFF + Rata-Rata Harian */}
              {(() => {
                const elapsedDays = Math.max(month?.daysElapsed || 1, 1);
                const avgDailyOt = Math.round(((month?.lemburJam || 0) / elapsedDays) * 10) / 10;
                return (
                  <div className="pt-3 border-t border-border/60 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-foreground">
                        Tren Harian Jam Lembur: Hari Kerja vs Hari OFF — {formatMonthId(overview.meta.month)}
                      </span>
                      <span className="text-[11px] font-mono text-amber-700 dark:text-amber-300 font-semibold">
                        Rata-rata: {avgDailyOt} jam/hari
                      </span>
                    </div>
                    <div className="h-[220px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={overview.dailySeries}
                          margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
                          onClick={(state: any) => {
                            const clickedDate = state?.activePayload?.[0]?.payload?.date;
                            if (clickedDate && clickedDate <= (overview.meta.todayWita || initialToday)) {
                              setSelectedDate(clickedDate);
                            }
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.18} vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} unit="j" />
                          {avgDailyOt > 0 && (
                            <ReferenceLine
                              y={avgDailyOt}
                              stroke="#b45309"
                              strokeDasharray="4 4"
                              strokeOpacity={0.65}
                            />
                          )}
                          <Tooltip
                            labelFormatter={(label) => `Tanggal ${label} ${formatMonthId(overview.meta.month)}`}
                            formatter={(val: any, name: any) => [`${val} Jam`, name]}
                            contentStyle={{
                              borderRadius: '12px',
                              border: '1px solid hsl(var(--border))',
                              backgroundColor: 'hsl(var(--card))',
                              fontSize: '12px',
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                          <Bar dataKey="lemburKerjaJam" name="Lembur Hari Kerja" stackId="ot" fill="#d97706" maxBarSize={24} />
                          <Bar dataKey="lemburOffJam" name="Lembur Hari OFF" stackId="ot" fill="#0284c7" radius={[4, 4, 0, 0]} maxBarSize={24} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-border rounded-2xl p-8 text-center">
          <p className="text-sm font-semibold text-muted-foreground">
            Gagal memuat telemetri real-time dari server. Silakan klik tombol Sync Live.
          </p>
        </Card>
      )}

      {/* ─── CLICK-TO-INSPECT DRILL-DOWN MODAL ─── */}
      <Dialog open={drillOpen} onOpenChange={setDrillOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold flex items-center gap-2">
              {drillTitle}
              <Badge variant="secondary" className="font-mono text-xs">
                {drillFilteredRows.length} Personil
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Data langsung dari PostgreSQL PT. FAWWAZ RESKI PERWIRA untuk tanggal {overview ? formatDateId(overview.meta.date) : selectedDate}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 py-1">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={drillSearch}
                onChange={(e) => setDrillSearch(e.target.value)}
                placeholder="Cari nama, NIP, atau divisi..."
                className="pl-8 h-9 text-xs rounded-xl"
              />
            </div>
            <Link to="/admin/monitoring">
              <Button variant="outline" size="sm" className="h-9 rounded-xl text-xs gap-1.5">
                Buka Monitoring
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>

          <div className="overflow-y-auto flex-1 border border-border rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 sticky top-0 border-b border-border text-[10.5px] uppercase text-muted-foreground">
                <tr>
                  <th className="py-2.5 px-3">Karyawan</th>
                  <th className="py-2.5 px-3">Grup / Divisi</th>
                  <th className="py-2.5 px-3">Shift</th>
                  <th className="py-2.5 px-3">Presensi</th>
                  <th className="py-2.5 px-3 text-right">Lembur SPKL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {drillFilteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      Tidak ada personil pada kategori ini.
                    </td>
                  </tr>
                ) : (
                  drillFilteredRows.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/30">
                      <td className="py-2.5 px-3">
                        <p className="font-bold text-foreground">{row.fullName}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{row.nip}</p>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-foreground">
                          {row.group}
                        </span>
                        <p className="text-[10.5px] text-muted-foreground mt-0.5">{row.divisionName}</p>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">{row.shiftLabel}</td>
                      <td className="py-2.5 px-3">
                        {row.status === 'hadir' ? (
                          <div>
                            <span className="font-mono font-bold text-emerald-600">
                              {row.clockIn || '--:--'} – {row.clockOut || 'Aktif'}
                            </span>
                            {row.isLate && (
                              <span className="block text-[10px] text-amber-600 font-semibold">
                                Telat {row.lateMinutes}m
                              </span>
                            )}
                          </div>
                        ) : (
                          <Badge
                            variant="outline"
                            className={`text-[10px] uppercase font-bold ${
                              row.status === 'mangkir'
                                ? 'border-rose-400 text-rose-600'
                                : row.status === 'belum_terdaftar'
                                ? 'border-purple-400 text-purple-600 dark:text-purple-400'
                                : row.status === 'cuti'
                                ? 'border-sky-400 text-sky-600'
                                : row.status === 'izin' || row.status === 'sakit'
                                ? 'border-indigo-400 text-indigo-600'
                                : 'border-slate-300 text-slate-600'
                            }`}
                          >
                            {row.status === 'belum_terdaftar' ? 'Belum Terdaftar' : row.status.replace('_', ' ')}
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {row.hasOvertime ? (
                          <div>
                            <span className="font-mono font-bold text-amber-600">
                              {row.overtimeHours} Jam ({row.overtimeRange})
                            </span>
                            {row.overtimeDesc && (
                              <p className="text-[10px] text-muted-foreground truncate max-w-[200px] ml-auto" title={row.overtimeDesc}>
                                {row.overtimeDesc}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <HrmGhostSwitcherModal open={ghostModalOpen} onOpenChange={setGhostModalOpen} />
    </div>
  );
};
