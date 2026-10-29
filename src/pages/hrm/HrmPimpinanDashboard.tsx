import React, { useState, useEffect, useRef } from 'react';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import { hrmService, getTodayDateStr } from '@/services/hrmService';
import { fieldSentinelService } from '@/services/fieldSentinelService';
import { api } from '@/services/apiClient';
import { UserProfile, AttendanceRecord } from '@/types/hrm';
import {
  Briefcase,
  Building2,
  FileCheck2,
  Users,
  CheckCircle2,
  TrendingUp,
  Clock,
  Award,
  CalendarDays,
  FileSpreadsheet,
  ArrowRight,
  Target,
  ShieldAlert,
  ShieldCheck,
  Banknote,
  Wallet,
  CreditCard,
  DollarSign,
  Search,
  Filter,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  Printer,
  Calendar,
  Layers,
  Activity,
  RefreshCw,
  Radio,
  MapPin,
  Eye,
  Camera,
  CheckCheck,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
} from 'recharts';


// Helper pengecualian akun pimpinan / direksi / superadmin dari tracking absensi operasional
const isExecutiveAccount = (name?: string, nip?: string, role?: string) => {
  const check = `${name || ''} ${nip || ''} ${role || ''}`.toLowerCase();
  return (
    check.includes('pimpinan') ||
    check.includes('dirut') ||
    check.includes('superadmin') ||
    check.includes('reski')
  );
};

// 3 Petugas Lapangan Khusus Pimpinan PT. FAWWAZ RESKI PERWIRA
const SPECIAL_OFFICERS = [
  {
    name: 'Muh Aslam Faisal',
    nip: 'FRP 07065',
    email: 'aslamfaisal10okt@gmail.com',
    uuid: 'ebf10b16-ab2f-4b53-ab22-b3ffc00694db',
    roleTitle: 'Petugas Lapangan Khusus I',
  },
  {
    name: 'LA UNGA SAMSI, S.K.M',
    nip: 'FR.07.066',
    email: 'abangelsamsi@gmail.com',
    uuid: '2ce41a19-0c65-45d3-913e-a68a02203fe2',
    roleTitle: 'Petugas Lapangan Khusus II',
  },
  {
    name: 'TAKDIR',
    nip: 'FRP.07.046',
    email: 'mtakdir46@gmail.com',
    uuid: '0a49f92e-5733-4b72-947c-7361f9490632',
    roleTitle: 'Petugas Lapangan Khusus III',
  },
];

export const HrmPimpinanDashboard: React.FC = () => {
  const { user, role } = useHrmAuth();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Real-time Clock (WITA)
  const [currentTimeWita, setCurrentTimeWita] = useState<string>('');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Basic States
  const [divisions, setDivisions] = useState(hrmService.getDivisions());
  const [users, setUsers] = useState(hrmService.getUsers());
  const [todayAttendances, setTodayAttendances] = useState<AttendanceRecord[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);
  const [pendingOvertimes, setPendingOvertimes] = useState<any[]>([]);
  const [activeBreachCount, setActiveBreachCount] = useState<number>(0);

  // Field Sentinel Live Agents State
  const [activeAgents, setActiveAgents] = useState<UserProfile[]>([]);
  const [specialOfficersData, setSpecialOfficersData] = useState<any[]>([]);

  // Executive Radar Analytics State from Database
  const [radarData, setRadarData] = useState<any>(null);
  const [loadingRadar, setLoadingRadar] = useState(false);

  // Field Recap Roster State (Individual drill-down)
  const [rosterData, setRosterData] = useState<any[]>([]);
  const [rosterDivisionFilter, setRosterDivisionFilter] = useState<string>('all');
  const [rosterSearch, setRosterSearch] = useState<string>('');
  const [loadingRoster, setLoadingRoster] = useState(false);

  // Financial aggregates
  const [salaryProfiles, setSalaryProfiles] = useState(hrmService.getSalaryProfiles());
  const [overtimeAnalytics, setOvertimeAnalytics] = useState(hrmService.getOvertimeAnalytics());

  // Format Currency
  const fmtRp = (n: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(n);

  // Real-time Clock Updater
  useEffect(() => {
    const updateWita = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Makassar',
        hour12: false,
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      };
      const formatted = new Intl.DateTimeFormat('id-ID', options).format(now);
      setCurrentTimeWita(`${formatted} WITA`);
    };

    updateWita();
    const clockInterval = setInterval(updateWita, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Main Data Loader
  const loadDashboardData = async (showLoadingSpinner = false) => {
    if (showLoadingSpinner) {
      setIsRefreshing(true);
      setLoadingRadar(true);
      setLoadingRoster(true);
    }

    try {
      // 1. Sync & fetch live attendances today
      const todayStr = getTodayDateStr();
      const atts = hrmService.getAttendances(todayStr);
      // Filter keluar akun pimpinan / direksi dari daftar presensi
      const sanitizedAtts = (atts || []).filter(
        (a) => !isExecutiveAccount(a.userName, a.userNip, (a as any).userRole)
      );
      setTodayAttendances(sanitizedAtts);

      // 2. Pending leaves & overtimes
      const leaves = hrmService.getLeaves().filter((l) => l.status === 'pending');
      setPendingLeaves(leaves);

      const ots = hrmService.getOvertimeRecords().filter((o) => o.status === 'pending');
      setPendingOvertimes(ots);

      // 3. Perimeter violations
      const violations = hrmService.getPerimeterViolations();
      setActiveBreachCount(violations.filter((v) => v.status === 'active').length);

      // 4. Overtime Analytics
      setOvertimeAnalytics(hrmService.getOvertimeAnalytics());

      // 5. Active Field Sentinel Agents (Live GPS & 3 Special Officers)
      try {
        const agents = await fieldSentinelService.getActiveAgents();
        setActiveAgents(agents || []);

        // Map data for 3 special officers
        const mappedSpecial = SPECIAL_OFFICERS.map((spec) => {
          const match = (agents || []).find(
            (a) =>
              (a.id && a.id === spec.uuid) ||
              (a.nip && a.nip.replace(/[\s._-]/g, '').toLowerCase() === spec.nip.replace(/[\s._-]/g, '').toLowerCase()) ||
              (a.fullName && a.fullName.toLowerCase().includes(spec.name.toLowerCase().split(' ')[0]))
          );

          return {
            ...spec,
            isOnline: Boolean(match),
            lastKnownLat: match?.lastKnownLatitude,
            lastKnownLng: match?.lastKnownLongitude,
            activePostName: match?.currentActivePostName || 'Pos Belum Ditentukan',
            activePostId: match?.currentActivePostId,
            isOutOfBounds: match?.isOutOfBounds || false,
            lastPingTime: match?.lastLocationPingAt,
            lastCheck: (match as any)?.last_patrol_check,
            profile: match,
          };
        });
        setSpecialOfficersData(mappedSpecial);
      } catch (err) {
        console.warn('Field sentinel agents sync warning:', err);
      }

      // 6. Executive Radar Analytics from backend
      try {
        const res = await hrmService.getExecutiveRadar({ year: selectedYear });
        if (res && res.success && res.data) {
          setRadarData(res.data);
        }
      } catch (e) {
        console.warn('Failed to load executive radar:', e);
      }

      // 7. Field Recap Roster
      try {
        const recapRes = await hrmService.getFieldRecap({ period: 'year' });
        if (recapRes && recapRes.success && recapRes.data?.roster) {
          setRosterData(recapRes.data.roster);
        }
      } catch (e) {
        console.warn('Failed to load roster:', e);
      }

      // 8. Basic structures
      setDivisions(hrmService.getDivisions());
      setUsers(hrmService.getUsers());

      // Record refresh timestamp
      const now = new Date();
      setLastRefreshedAt(
        now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour12: false }) + ' WITA'
      );
    } catch (globalErr) {
      console.error('Error refreshing dashboard:', globalErr);
    } finally {
      if (showLoadingSpinner) {
        setIsRefreshing(false);
        setLoadingRadar(false);
        setLoadingRoster(false);
      }
    }
  };

  // Initial Load + Auto-Refresh every 25 seconds for live real-time feel
  useEffect(() => {
    loadDashboardData(true);

    const autoSyncInterval = setInterval(() => {
      loadDashboardData(false);
    }, 25000);

    return () => clearInterval(autoSyncInterval);
  }, [selectedYear]);

  // KPIs Calculation
  const totalEmployees = radarData?.kpis?.totalEmployees ?? users.length;
  const todayHadir = radarData?.kpis?.todayHadir ?? todayAttendances.length;
  const todayTepat = radarData?.kpis?.todayTepat ?? todayAttendances.filter((a) => a.status === 'hadir').length;
  const todayLate = radarData?.kpis?.todayLate ?? todayAttendances.filter((a) => a.status === 'terlambat').length;
  const attendanceRate = radarData?.kpis?.todayAttendanceRate ?? (totalEmployees > 0 ? Math.round((todayHadir / totalEmployees) * 100) : 0);
  const onTimeRateToday = radarData?.kpis?.todayPunctualityRate ?? (todayHadir > 0 ? Math.round((todayTepat / todayHadir) * 100) : 100);

  // Overtime Statutory Rules (PT FRP Standard: Total Rp 76.000.000 / month)
  const CAP_TOTAL = 76000000;
  const CAP_SHIFTMAN = 72000000;
  const CAP_BIRING_ERE = 4000000;

  const approvedOvertimeBudget = overtimeAnalytics.approvedPay || 0;
  const overtimeProgressPct = Math.min(100, Math.round((approvedOvertimeBudget / CAP_TOTAL) * 100));

  // Base Salary Calculation (Single Base Salary, No Allowances per Rule 7)
  const totalBaseSalary = salaryProfiles.length > 0
    ? salaryProfiles.reduce((acc, p) => acc + (p.baseSalary || 4045050), 0)
    : users.length * 4045050;

  // BPJS 4% Baku (3% Ketenagakerjaan + 1% Kesehatan per Rule 8, PPh 21 = Rp 0)
  const estimatedBpjs = Math.round(totalBaseSalary * 0.04);
  const estimatedTotalPayroll = totalBaseSalary + approvedOvertimeBudget;

  // Filtered Roster for individual drilldown
  const filteredRoster = rosterData.filter((r) => {
    if (isExecutiveAccount(r.full_name, r.nip, r.role_name)) return false;
    const matchDiv =
      rosterDivisionFilter === 'all' ||
      r.division_id === rosterDivisionFilter ||
      r.division_name === rosterDivisionFilter;
    const matchSearch =
      !rosterSearch.trim() ||
      r.full_name?.toLowerCase().includes(rosterSearch.toLowerCase()) ||
      r.nip?.toLowerCase().includes(rosterSearch.toLowerCase()) ||
      r.division_name?.toLowerCase().includes(rosterSearch.toLowerCase());
    return matchDiv && matchSearch;
  });

  // Watchlist & Top Performers
  const watchlist = [...rosterData]
    .sort(
      (a, b) =>
        Number(b.total_mangkir) * 10 +
        Number(b.total_terlambat) -
        (Number(a.total_mangkir) * 10 + Number(a.total_terlambat))
    )
    .filter((r) => Number(r.total_mangkir) > 0 || Number(r.total_terlambat) > 1)
    .slice(0, 4);

  const topPerformers = [...rosterData]
    .sort((a, b) => Number(b.tepat_waktu) - Number(a.tepat_waktu))
    .filter((r) => Number(r.total_mangkir) === 0)
    .slice(0, 4);

  // Hanya personil operasional yang BENAR-BENAR telah clock-in masuk hari ini
  const actualClockIns = todayAttendances.filter((a) => {
    const hasValidClockIn = Boolean(a.clockIn && a.clockIn !== '--:--' && a.clockIn.trim() !== '');
    return hasValidClockIn && !isExecutiveAccount(a.userName, a.userNip, (a as any).userRole);
  });

  // Today's Recent Clock-Ins (Live Feed: terurut dari waktu masuk paling baru)
  const recentClockIns = [...actualClockIns]
    .sort((a, b) => (b.clockIn || '').localeCompare(a.clockIn || ''))
    .slice(0, 6);

  const totalPendingActionCount = pendingLeaves.length + pendingOvertimes.length;

  return (
    <div className="space-y-6 pb-12">
      {/* ═══ 1. EXECUTIVE HEADER BANNER DENGAN LIVE CLOCK & AUTO-SYNC PULSE ═══ */}
      <div className="bg-gradient-to-br from-card via-card to-primary/10 border border-border/80 rounded-2xl p-5 md:p-7 text-foreground shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-bold border border-primary/25">
                <Briefcase className="w-3.5 h-3.5" />
                <span>Portal Eksekutif Direktur Utama &amp; Pimpinan FRP</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                <span>Bebas Absensi Mandiri &amp; Bebas Pengajuan</span>
              </span>

              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted/60 text-muted-foreground text-xs font-mono">
                <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
                <span>LIVE RADAR SYNC</span>
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
              Dashboard Eksekutif &amp; Radar Real-Time
            </h1>
            <p className="text-muted-foreground text-xs md:text-sm max-w-2xl leading-relaxed">
              Pusat kendali komprehensif PT. FAWWAZ RESKI PERWIRA. Memantau kehadiran real-time, bank pos lapangan, batasan anggaran lembur sah Rp 76 jt, dan persetujuan kebijakan direksi secara instan.
            </p>
          </div>

          {/* Quick Actions & Live Time Display */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="px-3.5 py-2 rounded-xl bg-card border border-border text-right shadow-xs min-w-[190px]">
              <div className="flex items-center justify-end gap-1.5 text-xs font-bold text-foreground font-mono">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span>{currentTimeWita || 'Memuat waktu...'}</span>
              </div>
              <p className="text-[10.5px] text-muted-foreground mt-0.5 flex items-center justify-end gap-1">
                <span>Sinkron: {lastRefreshedAt || 'Live'}</span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadDashboardData(true)}
                disabled={isRefreshing}
                className="h-9 rounded-xl border-border text-xs font-semibold gap-1.5 hover:bg-muted"
                title="Segarkan data secara realtime"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
                <span>{isRefreshing ? 'Memperbarui...' : 'Segarkan'}</span>
              </Button>

              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                <SelectTrigger className="h-9 text-xs w-[120px] rounded-xl font-semibold border-border">
                  <Calendar className="w-3.5 h-3.5 mr-1 text-primary" />
                  <SelectValue placeholder="Tahun" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2026">Tahun 2026</SelectItem>
                  <SelectItem value="2025">Tahun 2025</SelectItem>
                  <SelectItem value="2024">Tahun 2024</SelectItem>
                </SelectContent>
              </Select>

              <Link to="/admin/approval">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-xs rounded-xl gap-1.5 h-9 relative">
                  <FileCheck2 className="w-3.5 h-3.5" />
                  <span>Approval Direksi</span>
                  {totalPendingActionCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-extrabold animate-pulse ml-0.5">
                      {totalPendingActionCount}
                    </span>
                  )}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 2. URGENT ALERT BANNERS (BREACH & PENDING APPROVAL) ═══ */}
      <div className="space-y-3">
        {/* Perimeter Breach Alert Banner */}
        {activeBreachCount > 0 && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-600 text-white shrink-0 animate-bounce">
                <ShieldAlert size={18} />
              </div>
              <div>
                <p className="font-bold text-rose-950 dark:text-rose-100 text-sm">
                  Radar Integritas: {activeBreachCount} Karyawan Terdeteksi Di Luar Radius Penugasan
                </p>
                <p className="text-rose-800 dark:text-rose-300 text-xs mt-0.5">
                  Sistem mendeteksi deviasi posisi GPS dari seluruh pos penugasan aktif dan mencatatnya ke audit trail kedisiplinan secara otomatis.
                </p>
              </div>
            </div>
            <Link to="/admin/monitoring">
              <Button size="sm" variant="destructive" className="rounded-xl text-xs h-8 px-3 font-semibold shrink-0 gap-1.5 shadow-xs">
                <ShieldAlert className="w-3.5 h-3.5" />
                Buka Radar Monitoring
              </Button>
            </Link>
          </div>
        )}

        {/* Pending Approval Notice Banner for Leadership */}
        {totalPendingActionCount > 0 && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-600 text-white shrink-0">
                <FileCheck2 size={18} />
              </div>
              <div>
                <p className="font-bold text-amber-950 dark:text-amber-100 text-sm">
                  Menunggu Persetujuan Direksi: {pendingLeaves.length} Pengajuan Cuti/Izin &amp; {pendingOvertimes.length} Pengajuan SPKL
                </p>
                <p className="text-amber-800 dark:text-amber-300 text-xs mt-0.5">
                  Pengajuan dari 3 Petugas Lapangan Khusus dan operasional memerlukan pengesahan tingkat pimpinan tertinggi.
                </p>
              </div>
            </div>
            <Link to="/admin/approval">
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs h-8 px-3 font-semibold shrink-0 gap-1.5 shadow-xs">
                <FileCheck2 className="w-3.5 h-3.5" />
                Proses Sekarang ({totalPendingActionCount})
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* ═══ 3. TOP EXECUTIVE KPI METRICS (6-COLUMN DYNAMIC GRID) ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* KPI 1: Kehadiran Hari Ini */}
        <Card className="border-border bg-card rounded-xl shadow-xs hover:border-primary/40 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-muted-foreground">Kehadiran Hari Ini</p>
              <Target className="w-4 h-4 text-primary" />
            </div>
            <div className="flex items-baseline gap-1 mt-1.5">
              <p className="text-2xl font-extrabold text-foreground font-mono">{attendanceRate}%</p>
              <span className="text-[11px] text-emerald-600 font-semibold font-mono">({todayHadir}/{totalEmployees})</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Personil aktif masuk</p>
          </CardContent>
        </Card>

        {/* KPI 2: Ketepatan Waktu */}
        <Card className="border-border bg-card rounded-xl shadow-xs hover:border-emerald-500/40 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-muted-foreground">Ketepatan Waktu</p>
              <Award className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-extrabold text-emerald-600 font-mono mt-1.5">{onTimeRateToday}%</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {todayLate > 0 ? `${todayLate} Terlambat` : 'Semua tepat waktu'}
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: 3 Petugas Lapangan Khusus */}
        <Card className="border-border bg-card rounded-xl shadow-xs hover:border-blue-500/40 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-muted-foreground">Petugas Khusus</p>
              <ShieldCheck className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-extrabold text-blue-600 font-mono mt-1.5">3 / 3</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Terpantau Radar Sentinel
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Kuota Anggaran Lembur Sah (76 Juta) */}
        <Card className="border-border bg-card rounded-xl shadow-xs hover:border-purple-500/40 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-muted-foreground">Serapan Lembur</p>
              <Banknote className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-2xl font-extrabold text-purple-600 font-mono mt-1.5">{overtimeProgressPct}%</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {fmtRp(approvedOvertimeBudget)} / 76jt
            </p>
          </CardContent>
        </Card>

        {/* KPI 5: Antrean Persetujuan Direksi */}
        <Card className="border-border bg-card rounded-xl shadow-xs hover:border-amber-500/40 transition-colors">
          <Link to="/admin/approval">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-muted-foreground">Menunggu Disetujui</p>
                <FileCheck2 className={`w-4 h-4 ${totalPendingActionCount > 0 ? 'text-amber-600' : 'text-muted-foreground'}`} />
              </div>
              <p className={`text-2xl font-extrabold font-mono mt-1.5 ${totalPendingActionCount > 0 ? 'text-amber-600' : 'text-foreground'}`}>
                {totalPendingActionCount} Dokumen
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Cuti &amp; Lembur (SPKL)</p>
            </CardContent>
          </Link>
        </Card>

        {/* KPI 6: Perimeter Radar Lapangan */}
        <Card className={`border-border bg-card rounded-xl shadow-xs transition-colors ${activeBreachCount > 0 ? 'border-rose-500/40 bg-rose-500/5' : ''}`}>
          <Link to="/admin/monitoring">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-muted-foreground">Perimeter Geofence</p>
                <ShieldAlert className={`w-4 h-4 ${activeBreachCount > 0 ? 'text-rose-600 animate-pulse' : 'text-muted-foreground'}`} />
              </div>
              <p className={`text-2xl font-extrabold font-mono mt-1.5 ${activeBreachCount > 0 ? 'text-rose-600' : 'text-foreground'}`}>
                {activeBreachCount} Deviasi
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {activeBreachCount === 0 ? 'Seluruh pos aman' : 'Perlu atensi pimpinan'}
              </p>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* ═══ 4. DEDICATED SENTINEL RADAR: 3 PETUGAS LAPANGAN KHUSUS PIMPINAN ═══ */}
      <Card className="border-border bg-gradient-to-br from-card via-card to-blue-500/5 rounded-2xl shadow-sm border-blue-500/30 overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/70 bg-blue-500/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Radio className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                  Pengawasan Khusus Pimpinan (3 Petugas Lapangan Prioritas)
                  <Badge variant="outline" className="border-blue-500/40 text-blue-700 dark:text-blue-300 text-[10px]">
                    Field Sentinel Multi-Titik
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Mandat pengawasan langsung Direktur Utama &amp; Pimpinan FRP untuk 3 personil lapangan via Geofence Multi-Pos &amp; Biometric Spot-Check.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link to="/admin/monitoring">
                <Button size="sm" variant="outline" className="h-8 rounded-xl text-xs font-semibold gap-1.5 border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10">
                  <MapPin className="w-3.5 h-3.5" />
                  Buka Peta Sentinel
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {specialOfficersData.map((spec, idx) => {
              const isBreach = spec.isOutOfBounds;
              const hasGps = spec.lastKnownLat && spec.lastKnownLng;

              return (
                <div
                  key={spec.uuid || idx}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isBreach
                      ? 'border-rose-500/40 bg-rose-500/5'
                      : 'border-border/80 bg-card hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Badge variant="outline" className="text-[9.5px] font-mono border-border mb-1 text-muted-foreground">
                        {spec.roleTitle}
                      </Badge>
                      <h4 className="font-bold text-sm text-foreground">{spec.name}</h4>
                      <p className="text-[11px] font-mono text-muted-foreground">{spec.nip}</p>
                    </div>

                    <div className="text-right">
                      {isBreach ? (
                        <Badge variant="destructive" className="text-[9px] font-bold animate-pulse">
                          BREACH AREA
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-600 text-white text-[9px] font-semibold">
                          DALAM RADIUS
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-border/60 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-primary" /> Pos Aktif:
                      </span>
                      <span className="font-semibold text-foreground truncate max-w-[150px]">
                        {spec.activePostName}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Radio className="w-3 h-3 text-blue-500" /> Koordinat GPS:
                      </span>
                      <span className="font-mono text-[10.5px] text-foreground">
                        {hasGps
                          ? `${Number(spec.lastKnownLat).toFixed(5)}, ${Number(spec.lastKnownLng).toFixed(5)}`
                          : 'Belum ada ping'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3 text-muted-foreground" /> Ping Terakhir:
                      </span>
                      <span className="text-muted-foreground text-[10.5px]">
                        {spec.lastPingTime
                          ? new Date(spec.lastPingTime).toLocaleTimeString('id-ID', {
                              timeZone: 'Asia/Makassar',
                              hour12: false,
                            }) + ' WITA'
                          : 'Standby'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      Status Bank Pos: Multi-Titik Aktif
                    </span>
                    <Link to="/admin/monitoring">
                      <Button size="sm" variant="ghost" className="h-7 text-[11px] px-2 text-primary hover:bg-primary/10 gap-1 font-semibold">
                        <Eye className="w-3 h-3" />
                        Radar
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ═══ 5. RADAR ANGGARAN LEMBUR RESMI DIREKSI & PIMPINAN (RP 76.000.000) ═══ */}
      <Card className="border-border bg-gradient-to-br from-card via-card to-purple-500/5 rounded-2xl shadow-sm border-purple-500/30 overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/80 bg-purple-500/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
                <Banknote className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                  Monitoring Plafon Anggaran Lembur Sah (Strict Overtime Cap)
                  <Badge variant="outline" className="border-purple-500/40 text-purple-700 dark:text-purple-300 text-[10px]">
                    Ketetapan Baku FRP
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Hak lembur hanya berlaku untuk 80 personil sah (47 Shiftman + 33 Biring Ere). Total plafon resmi Rp 76.000.000/bulan.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link to="/admin/lembur">
                <Button size="sm" variant="outline" className="h-8 rounded-xl text-xs font-semibold gap-1.5 border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Rincian SPKL Lembur
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* Main Progress Bar Total Plafon */}
          <div className="p-3.5 rounded-xl bg-card border border-border space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
                Penyerapan Total Anggaran Lembur Sah Perusahaan (Bulan Berjalan)
              </span>
              <span className="font-extrabold font-mono text-purple-600">
                {fmtRp(approvedOvertimeBudget)} dari {fmtRp(CAP_TOTAL)} ({overtimeProgressPct}%)
              </span>
            </div>
            <Progress value={overtimeProgressPct} className="h-2.5 bg-muted" />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Sisa Kuota Anggaran: {fmtRp(Math.max(0, CAP_TOTAL - approvedOvertimeBudget))}</span>
              <span>Aturan: Cuti Tahunan Hangus (Tanpa Kompensasi Kas), Beban Tunai Hanya Lembur</span>
            </div>
          </div>

          {/* Breakdown 4 Grup */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Box 1: Shiftman Total */}
            <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-900 dark:text-blue-300">Shiftman Lapangan FRP</span>
                <Badge className="bg-blue-600 text-white text-[10px]">47 Karyawan</Badge>
              </div>
              <p className="text-xl font-extrabold text-foreground font-mono">Rp 72.000.000</p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Plafon maksimal gabungan 47 personil (44 Shift Normal + 3 Day Shift). Realisasi tidak boleh melebihi 72jt.
              </p>
            </div>

            {/* Box 2: Shift Normal */}
            <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-card space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-900 dark:text-emerald-300">A. Shift Normal (213 Jam)</span>
                <Badge className="bg-emerald-600 text-white text-[10px]">44 Karyawan</Badge>
              </div>
              <p className="text-xl font-extrabold text-emerald-600 font-mono">30 Jam Real (x2)</p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Dibayar <strong>2x nominal tarif area kerja</strong> (total ekuivalen 60 jam bayar).
              </p>
            </div>

            {/* Box 3: Day Shift */}
            <div className="p-3.5 rounded-xl border border-purple-500/20 bg-card space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-purple-900 dark:text-purple-300">B. Day Shift Normal</span>
                <Badge className="bg-purple-600 text-white text-[10px]">3 Karyawan</Badge>
              </div>
              <p className="text-xl font-extrabold text-purple-600 font-mono">56 Jam Real (x2)</p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Dibayar dikali 2 menjadi <strong>112 jam bayar x tarif upah per jam</strong>.
              </p>
            </div>

            {/* Box 4: Wisma Biring Ere */}
            <div className="p-3.5 rounded-xl border border-amber-500/20 bg-card space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-900 dark:text-amber-300">Wisma Biring Ere</span>
                <Badge className="bg-amber-600 text-white text-[10px]">33 Karyawan</Badge>
              </div>
              <p className="text-xl font-extrabold text-amber-600 font-mono">Rp 4.000.000 (Rata)</p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Budget 4jt <strong>dibagi rata 33 orang</strong>. Kelebihan jam menjadi Flexytime (Libur) bulan berjalan.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ 6. LIVE FEED PRESENSI HARI INI (REALTIME ACTIVITY TICKER) ═══ */}
      <Card className="border-border bg-card rounded-xl shadow-xs overflow-hidden">
        <CardHeader className="pb-3 border-b border-border bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>Feed Presensi Masuk Lapangan Terkini (Hari Ini)</span>
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 bg-emerald-500/10 text-xs font-mono font-bold">
                  {actualClockIns.length} Personil Masuk
                </Badge>
              </CardTitle>
            </div>
            <Link to="/admin/laporan" className="text-xs text-primary hover:underline font-semibold flex items-center gap-1">
              <span>Lihat Rekap Seluruhnya</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </CardHeader>

        <CardContent className="p-3">
          {recentClockIns.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-1.5">
              <Clock className="w-5 h-5 text-muted-foreground/60" />
              <p className="font-semibold text-foreground text-sm">Belum Ada Personil Yang Melakukan Presensi Masuk Hari Ini</p>
              <p className="text-[11px] text-muted-foreground max-w-md">
                Aktivitas kehadiran akan otomatis muncul secara live di sini saat personil lapangan melakukan scan verifikasi masuk di pos masing-masing.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {recentClockIns.map((att, idx) => (
                <div
                  key={att.id || idx}
                  className="p-2.5 rounded-xl border border-border/80 bg-muted/20 flex items-center justify-between gap-2 text-xs hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                      {att.userName ? att.userName.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{att.userName || 'Karyawan'}</p>
                      <p className="text-[10.5px] text-muted-foreground font-mono truncate">
                        {att.divisionName || 'Operasional'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-1 font-mono font-bold text-foreground">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span>{att.clockIn || '--:--'}</span>
                    </div>
                    {att.clockOut ? (
                      <Badge variant="outline" className="border-blue-500/30 text-blue-600 bg-blue-500/10 text-[9px] px-1 py-0 mt-0.5">
                        Pulang {att.clockOut.slice(0, 5)}
                      </Badge>
                    ) : att.status === 'terlambat' ? (
                      <Badge variant="outline" className="border-amber-500/30 text-amber-600 bg-amber-500/10 text-[9px] px-1 py-0 mt-0.5">
                        Terlambat {att.lateMinutes ? `(${att.lateMinutes}m)` : ''}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-500/10 text-[9px] px-1 py-0 mt-0.5">
                        Tepat Waktu
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ 7. GRAFIK TREN 12 BULAN (KOMPARASI MULTI-BULAN SEPANJANG TAHUN) ═══ */}
      <Card className="border-border bg-card rounded-xl shadow-xs">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Tren Kinerja 12 Bulan Sepanjang Tahun {selectedYear}
              </CardTitle>
              <CardDescription className="text-xs">
                Perbandingan volume kehadiran tepat waktu, keterlambatan, alpa/mangkir, dan jam lembur per bulan.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[11px] font-mono border-border bg-muted/40">
                Tahun Buku {selectedYear}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={radarData?.monthlyTrends || []}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="hadirGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="lateGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="alpaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e11d48" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#e11d48" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
                <XAxis dataKey="month_name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Area type="monotone" dataKey="hadir" name="Tepat Waktu" stroke="#0d9488" strokeWidth={2.5} fill="url(#hadirGrad)" />
                <Area type="monotone" dataKey="terlambat" name="Terlambat" stroke="#f59e0b" strokeWidth={2} fill="url(#lateGrad)" />
                <Area type="monotone" dataKey="mangkir" name="Mangkir (Alpa)" stroke="#e11d48" strokeWidth={2} fill="url(#alpaGrad)" />
                <Line type="monotone" dataKey="lembur_jam" name="Jam Lembur" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ═══ 8. DUA GRAFIK KOMPARASI: MATRIKS DIVISI & DETEKSI POLA HARI MINGGUAN ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Matriks Komparatif Divisi */}
        <Card className="border-border bg-card rounded-xl shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Matriks Kinerja Komparatif Antar Divisi ({selectedYear})
            </CardTitle>
            <CardDescription className="text-xs">
              Perbandingan tingkat kedisiplinan hadir, pelanggaran alpa, dan beban lembur tiap divisi.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={radarData?.divisionMatrix || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
                  <XAxis dataKey="division_code" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="total_hadir" name="Total Hadir" fill="#0d9488" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total_terlambat" name="Terlambat" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total_mangkir" name="Alpa/Mangkir" fill="#e11d48" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Deteksi Pola Hari Lapangan (Day of Week Critical Pattern) */}
        <Card className="border-border bg-card rounded-xl shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-500" />
              Deteksi Pola Hari Lapangan (Kerentanan Keterlambatan &amp; Alpa)
            </CardTitle>
            <CardDescription className="text-xs">
              Membaca tren hari apa yang paling rawan terjadi pelanggaran jam masuk atau ketidakhadiran.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={radarData?.dayPatterns || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
                  <XAxis dataKey="day_name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="total_terlambat" name="Terlambat" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total_mangkir" name="Mangkir (Alpa)" fill="#e11d48" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ 9. WATCHLIST PEMBINAAN & PERSONIL TELADAN ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Watchlist Pembinaan */}
        <Card className="border-border bg-card rounded-xl shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-4 h-4" />
              Watchlist Evaluasi &amp; Pembinaan Kedisiplinan
            </CardTitle>
            <CardDescription className="text-xs">
              Personil dengan frekuensi mangkir atau keterlambatan tertinggi yang memerlukan arahan Direksi.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-2">
            {watchlist.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Seluruh karyawan menunjukkan tingkat kedisiplinan yang memuaskan.
              </p>
            ) : (
              watchlist.map((w) => (
                <div key={w.user_id} className="p-2.5 bg-rose-500/5 border border-rose-500/20 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-foreground">{w.full_name}</p>
                    <p className="text-[10.5px] text-muted-foreground font-mono">{w.nip} • {w.division_name}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="destructive" className="text-[10px]">
                      {w.total_mangkir > 0 ? `${w.total_mangkir} Alpa` : `${w.total_terlambat}x Telat`}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{w.total_late_minutes || 0} Menit telat</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Personil Paling Disiplin */}
        <Card className="border-border bg-card rounded-xl shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2 text-emerald-600">
              <Sparkles className="w-4 h-4" />
              Personil Teladan &amp; Kepatuhan Terbaik
            </CardTitle>
            <CardDescription className="text-xs">
              Karyawan dengan rekor kehadiran tepat waktu tertinggi tanpa catatan mangkir.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-2">
            {topPerformers.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Belum ada data rekapan.</p>
            ) : (
              topPerformers.map((t) => (
                <div key={t.user_id} className="p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-foreground">{t.full_name}</p>
                    <p className="text-[10.5px] text-muted-foreground font-mono">{t.nip} • {t.division_name}</p>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-emerald-600 text-white text-[10px]">
                      {t.tepat_waktu} Sesi Tepat
                    </Badge>
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5">0 Alpa • Prima</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ 10. REKAPAN KINERJA MENYELURUH PER INDIVIDU (INDIVIDUAL DRILL-DOWN) ═══ */}
      <Card className="border-border bg-card rounded-xl shadow-xs overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Rekapan Data &amp; Progres Kinerja Per Individu Karyawan
              </CardTitle>
              <CardDescription className="text-xs">
                Data komprehensif kehadiran, alpa, izin, dan lembur seluruh personil lintas divisi sepanjang tahun {selectedYear}.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Select value={rosterDivisionFilter} onValueChange={setRosterDivisionFilter}>
                <SelectTrigger className="h-8 text-xs rounded-xl w-[140px]">
                  <SelectValue placeholder="Semua Divisi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Divisi</SelectItem>
                  {divisions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Cari nama / NIP..."
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  className="h-8 text-xs pl-8 rounded-xl w-[160px]"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-foreground">
            <thead className="bg-muted/40 border-b border-border uppercase text-[11px] text-muted-foreground font-medium tracking-wider">
              <tr>
                <th className="py-3 px-4">Nama &amp; NIP</th>
                <th className="py-3 px-4">Divisi</th>
                <th className="py-3 px-4">Kehadiran</th>
                <th className="py-3 px-4">Keterlambatan</th>
                <th className="py-3 px-4">Mangkir (Alpa)</th>
                <th className="py-3 px-4">Cuti &amp; Sakit</th>
                <th className="py-3 px-4">Lembur (SPKL)</th>
                <th className="py-3 px-4 text-right">Status Kepatuhan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRoster.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    Tidak ada data personil ditemukan.
                  </td>
                </tr>
              ) : (
                filteredRoster.map((r) => {
                  const hadir = Number(r.total_hadir || 0);
                  const tepat = Number(r.tepat_waktu || 0);
                  const telat = Number(r.total_terlambat || 0);
                  const alpa = Number(r.total_mangkir || 0);
                  const cuti = Number(r.total_cuti || 0);
                  const sakit = Number(r.total_sakit || 0);
                  const otHours = Number(r.total_lembur_hours || 0);
                  const punctuality = hadir > 0 ? Math.round((tepat / hadir) * 100) : 100;

                  return (
                    <tr key={r.user_id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-foreground">{r.full_name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{r.nip}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-foreground">{r.division_name || 'Operasional'}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{r.role_name || 'Staf'}</p>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <span className="font-semibold text-emerald-600">{tepat} Tepat</span>
                        <span className="text-[10px] text-muted-foreground block">dari {hadir} hadir</span>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {telat > 0 ? (
                          <div>
                            <span className="font-semibold text-amber-600">{telat}x</span>
                            <span className="text-[10px] text-muted-foreground block">({r.total_late_minutes || 0} mnt)</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">0x</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {alpa > 0 ? (
                          <Badge variant="destructive" className="text-[10px] font-bold">
                            {alpa} Hari Alpa
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">Nihil</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <span>{cuti} Cuti</span>
                        <span className="text-muted-foreground block text-[10px]">{sakit} Sakit</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        {otHours > 0 ? (
                          <div>
                            <span className="font-semibold text-purple-600">{otHours} Jam</span>
                            <span className="text-[10px] text-muted-foreground block">
                              Rp {Number(r.total_lembur_comp || 0).toLocaleString('id-ID')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">0 Jam</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {alpa > 1 ? (
                          <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px]">
                            Perlu Pembinaan
                          </Badge>
                        ) : punctuality >= 90 ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                            {punctuality}% Disiplin
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">
                            {punctuality}% Waspada
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ═══ 11. IKHTISAR PENGGAJIAN EKSEKUTIF (ATURAN BAKU UPAH POKOK TUNGGAL) ═══ */}
      <Card className="border-border bg-card rounded-xl shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-600" />
                Ikhtisar Eksekutif: Anggaran Penggajian &amp; Beban Lembur Terverifikasi
              </CardTitle>
              <CardDescription className="text-xs">
                Sesuai Aturan Resmi PT. FAWWAZ RESKI PERWIRA: Upah Pokok Tunggal (Tanpa Tunjangan) dan PPh 21 Ditiadakan (Rp 0).
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/admin/payroll">
                <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs rounded-xl gap-1.5 shadow-xs">
                  <Banknote className="w-3.5 h-3.5" />
                  Rincian Penggajian
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
              <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-primary" /> Upah Pokok Tunggal (Murni)
              </p>
              <p className="text-lg font-bold text-foreground mt-1 font-mono">{fmtRp(totalBaseSalary)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Berdasarkan {users.length} personil aktif (Tanpa Tunjangan)</p>
            </div>

            <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <p className="text-[11px] font-medium text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-purple-600" /> Beban Lembur Terverifikasi
              </p>
              <p className="text-lg font-bold text-purple-700 dark:text-purple-300 mt-1 font-mono">{fmtRp(approvedOvertimeBudget)}</p>
              <p className="text-[10px] text-purple-800 dark:text-purple-300/80 mt-0.5">{overtimeAnalytics.totalHours} Jam lembur disetujui</p>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <p className="text-[11px] font-medium text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-blue-600" /> Iuran Resmi BPJS (3% + 1%)
              </p>
              <p className="text-lg font-bold text-blue-700 dark:text-blue-300 mt-1 font-mono">{fmtRp(estimatedBpjs)}</p>
              <p className="text-[10px] text-blue-800 dark:text-blue-300/80 mt-0.5">Ketenagakerjaan &amp; Kesehatan (PPh 21 = Rp 0)</p>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-[11px] font-medium text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5 text-emerald-600" /> Total Komitmen Penggajian
              </p>
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-1 font-mono">{fmtRp(estimatedTotalPayroll)}</p>
              <p className="text-[10px] text-emerald-800 dark:text-emerald-300/80 mt-0.5">Gaji Pokok + Uang Lembur Sah</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
